import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SupabaseService } from './supabase';
import { firstValueFrom } from 'rxjs';

export interface GasStation {
  id: string;
  name: string;
  brand: string;
  chain: 'makpetrol' | 'lukoil' | 'okta' | 'detoil' | 'gulf' | 'shell' | 'pucko' | 'kast' | 'other';
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  is_24_7: boolean;
  working_hours: string;
  has_lpg?: boolean;
  has_cng?: boolean;
  has_ev?: boolean;
  has_car_wash?: boolean;
  has_shop?: boolean;
  phone?: string | null;
  distanceKm?: number;
}

@Injectable({
  providedIn: 'root'
})
export class GasStationService {
  private supabaseService = inject(SupabaseService);
  private http = inject(HttpClient);
  private cacheKey = 'cached_gas_stations';

  public async fetchGasStations(city?: string): Promise<GasStation[]> {
    // 1. Try Supabase first
    try {
      let query = this.supabaseService.supabase
        .from('gas_stations')
        .select('*')
        .order('name');

      if (city && city !== 'all') {
        query = query.eq('city', city);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        if (!city || city === 'all') {
          localStorage.setItem(this.cacheKey, JSON.stringify(data));
        }
        return data as GasStation[];
      }
    } catch (err) {
      console.warn('GasStationService: Supabase fetch error:', err);
    }

    // 2. Fallback to localStorage cache
    const cached = this.getCachedGasStations(city);
    if (cached.length > 0) {
      return cached;
    }

    // 3. Fallback to bundled assets/data/gas_stations.json
    try {
      const localData = await firstValueFrom(
        this.http.get<GasStation[]>('assets/data/gas_stations.json')
      );
      if (localData && localData.length > 0) {
        localStorage.setItem(this.cacheKey, JSON.stringify(localData));
        if (city && city !== 'all') {
          return localData.filter(s => s.city === city);
        }
        return localData;
      }
    } catch (localErr) {
      console.warn('GasStationService: Local JSON fetch error:', localErr);
    }

    return [];
  }

  public getCachedGasStations(city?: string): GasStation[] {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return [];
      const list: GasStation[] = JSON.parse(raw);
      if (city && city !== 'all') {
        return list.filter(s => s.city === city);
      }
      return list;
    } catch {
      return [];
    }
  }

  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public formatDistance(km?: number): string {
    if (km == null || isNaN(km)) return '';
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  }

  public getClosestStation(userLat: number, userLng: number, stations: GasStation[]): GasStation | null {
    if (!stations || stations.length === 0) return null;
    let closest: GasStation | null = null;
    let minDist = Infinity;

    for (const station of stations) {
      const dist = this.calculateDistanceKm(userLat, userLng, station.latitude, station.longitude);
      station.distanceKm = dist;
      if (dist < minDist) {
        minDist = dist;
        closest = station;
      }
    }

    return closest;
  }

  public getBrandBadgeStyle(chain: string): { bg: string; color: string; border: string } {
    switch (chain) {
      case 'makpetrol':
        return { bg: 'rgba(30, 64, 175, 0.2)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.4)' };
      case 'lukoil':
        return { bg: 'rgba(220, 38, 38, 0.2)', color: '#f87171', border: 'rgba(239, 68, 68, 0.4)' };
      case 'okta':
        return { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: 'rgba(16, 185, 129, 0.4)' };
      case 'detoil':
        return { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.4)' };
      case 'gulf':
        return { bg: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', border: 'rgba(249, 115, 22, 0.4)' };
      case 'shell':
        return { bg: 'rgba(234, 179, 8, 0.2)', color: '#fde047', border: 'rgba(234, 179, 8, 0.4)' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
    }
  }

  public openDirections(lat: number, lng: number, name?: string) {
    const encodedName = encodeURIComponent(name || 'Бензинска пумпа');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedName}`;
    window.open(url, '_blank');
  }
}

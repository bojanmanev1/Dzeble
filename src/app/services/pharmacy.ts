import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

export interface DutyPharmacy {
  id: string;
  name: string;
  chain: 'zegin' | 'eurofarm' | 'viola' | 'other';
  city: string;
  city_slug: string;
  municipality?: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  is_24_7: boolean;
  working_hours: string;
  google_maps_url?: string;
  distanceKm?: number;
}

@Injectable({
  providedIn: 'root',
})
export class PharmacyService {
  private cacheKey = 'cached_duty_pharmacies';

  constructor(private supabaseService: SupabaseService) {}

  public async fetchPharmacies(city?: string): Promise<DutyPharmacy[]> {
    try {
      let query = this.supabaseService.supabase
        .from('duty_pharmacies')
        .select('*')
        .order('name');

      if (city) {
        query = query.eq('city', city);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Error fetching pharmacies from Supabase:', error);
        return this.getCachedPharmacies(city);
      }

      if (data && data.length > 0) {
        // Cache whole list if no city filter, or update cache
        if (!city) {
          localStorage.setItem(this.cacheKey, JSON.stringify(data));
        }
        return data as DutyPharmacy[];
      }

      return this.getCachedPharmacies(city);
    } catch (err) {
      console.warn('Failed to load duty pharmacies:', err);
      return this.getCachedPharmacies(city);
    }
  }

  public getCachedPharmacies(city?: string): DutyPharmacy[] {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return [];
      const list: DutyPharmacy[] = JSON.parse(raw);
      if (city) {
        return list.filter((p) => p.city === city);
      }
      return list;
    } catch {
      return [];
    }
  }

  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public formatDistance(km?: number): string {
    if (km == null || isNaN(km)) return '';
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)} km`;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

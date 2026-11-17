import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SupabaseService } from './supabase';
import { firstValueFrom } from 'rxjs';

export interface BankAtm {
  id: string;
  name: string;
  bank: string;
  bank_name?: string;
  bank_slug: string;
  city: string;
  city_slug: string;
  address: string;
  location_description?: string | null;
  latitude: number;
  longitude: number;
  is_24_7: boolean;
  working_hours: string;
  has_deposit?: boolean;
  cash_in?: boolean;
  currency?: string;
  distanceKm?: number;
  google_maps_url?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AtmService {
  private supabaseService = inject(SupabaseService);
  private http = inject(HttpClient);
  private cacheKey = 'cached_bank_atms';

  public async fetchAtms(city?: string, bankSlug?: string): Promise<BankAtm[]> {
    // 1. Try Supabase first
    try {
      let query = this.supabaseService.supabase
        .from('bank_atms')
        .select('*')
        .order('bank');

      if (city && city !== 'all') {
        query = query.eq('city', city);
      }
      if (bankSlug && bankSlug !== 'all') {
        query = query.eq('bank_slug', bankSlug);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        if ((!city || city === 'all') && (!bankSlug || bankSlug === 'all')) {
          localStorage.setItem(this.cacheKey, JSON.stringify(data));
        }
        return data as BankAtm[];
      }
    } catch (err) {
      console.warn('AtmService: Supabase fetch error:', err);
    }

    // 2. Fallback to localStorage cache
    const cached = this.getCachedAtms(city, bankSlug);
    if (cached.length > 0) {
      return cached;
    }

    // 3. Fallback to bundled assets/data/bank_atms.json
    try {
      const localData = await firstValueFrom(
        this.http.get<BankAtm[]>('assets/data/bank_atms.json')
      );
      if (localData && localData.length > 0) {
        localStorage.setItem(this.cacheKey, JSON.stringify(localData));
        let filtered = localData;
        if (city && city !== 'all') {
          filtered = filtered.filter(a => a.city === city);
        }
        if (bankSlug && bankSlug !== 'all') {
          filtered = filtered.filter(a => a.bank_slug === bankSlug);
        }
        return filtered;
      }
    } catch (localErr) {
      console.warn('AtmService: Local JSON fetch error:', localErr);
    }

    return [];
  }

  public getCachedAtms(city?: string, bankSlug?: string): BankAtm[] {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return [];
      let list: BankAtm[] = JSON.parse(raw);
      if (city && city !== 'all') {
        list = list.filter(a => a.city === city);
      }
      if (bankSlug && bankSlug !== 'all') {
        list = list.filter(a => a.bank_slug === bankSlug);
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

  public getBankColor(bankSlug?: string): string {
    if (!bankSlug) return '#10b981';
    switch (bankSlug) {
      case 'komercijalna':
        return '#15803d'; // Green
      case 'stopanska':
        return '#0369a1'; // Deep Blue
      case 'stopanska-bt':
        return '#0284c7'; // Sky Blue
      case 'nlb':
        return '#4338ca'; // Indigo
      case 'halk':
        return '#b91c1c'; // Red
      case 'sparkasse':
        return '#dc2626'; // Bright Red
      case 'unibanka':
        return '#ea580c'; // Orange
      case 'procredit':
        return '#ca8a04'; // Yellow-Amber
      case 'ttk':
        return '#7c3aed'; // Purple
      case 'ckb':
        return '#0891b2'; // Cyan
      case 'silkroad':
        return '#d97706'; // Amber
      default:
        return '#10b981'; // Emerald
    }
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

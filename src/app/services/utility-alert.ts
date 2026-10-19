import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SupabaseService } from './supabase';
import { firstValueFrom } from 'rxjs';

export interface UtilityAlert {
  id: string;
  type: 'power' | 'water' | 'road' | 'earthquake' | 'other';
  source: string;
  source_title: string;
  title: string;
  city: string;
  municipality?: string;
  location_name?: string;
  address?: string;
  start_time: string;
  end_time?: string;
  status: 'active' | 'upcoming' | 'resolved';
  voltage?: string;
  description: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
}

@Injectable({
  providedIn: 'root'
})
export class UtilityAlertService {
  private supabaseService = inject(SupabaseService);
  private http = inject(HttpClient);
  private cacheKey = 'cached_utility_alerts_v5';

  public async fetchAlerts(city?: string): Promise<UtilityAlert[]> {
    // 1. Try Supabase first
    try {
      let query = this.supabaseService.supabase
        .from('utility_alerts')
        .select('*')
        .order('start_time', { ascending: false });

      if (city && city !== 'all') {
        query = query.ilike('city', `%${city}%`);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        let merged = data as UtilityAlert[];

        // If Supabase currently has 0 water alerts, blend in bundled water alerts so users never see an empty screen
        if (!merged.some(a => a.type === 'water')) {
          try {
            const localData = await firstValueFrom(
              this.http.get<UtilityAlert[]>('assets/data/utility_alerts.json')
            );
            if (localData && localData.length > 0) {
              const localWater = localData.filter(a => a.type === 'water');
              merged = [...merged, ...localWater].sort(
                (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
              );
            }
          } catch {}
        }

        if (!city || city === 'all') {
          localStorage.setItem(this.cacheKey, JSON.stringify(merged));
        }
        return this.recomputeStatuses(merged);
      }
    } catch (err) {
      console.warn('UtilityAlertService: Supabase fetch error:', err);
    }

    // 2. Fallback to localStorage cache
    const cached = this.getCachedAlerts(city);
    if (cached.length > 0) {
      return this.recomputeStatuses(cached);
    }

    // 3. Fallback to bundled assets/data/utility_alerts.json
    try {
      const localData = await firstValueFrom(
        this.http.get<UtilityAlert[]>('assets/data/utility_alerts.json')
      );
      if (localData && localData.length > 0) {
        localStorage.setItem(this.cacheKey, JSON.stringify(localData));
        if (city && city !== 'all') {
          const normCity = city.toLowerCase().trim();
          return this.recomputeStatuses(
            localData.filter(a => a.city.toLowerCase().includes(normCity) || (a.municipality && a.municipality.toLowerCase().includes(normCity)))
          );
        }
        return this.recomputeStatuses(localData);
      }
    } catch (localErr) {
      console.warn('UtilityAlertService: Local JSON fetch error:', localErr);
    }

    return [];
  }

  public getCachedAlerts(city?: string): UtilityAlert[] {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return [];
      const list: UtilityAlert[] = JSON.parse(raw);
      if (city && city !== 'all') {
        const normCity = city.toLowerCase().trim();
        return list.filter(a => a.city.toLowerCase().includes(normCity) || (a.municipality && a.municipality.toLowerCase().includes(normCity)));
      }
      return list;
    } catch {
      return [];
    }
  }

  public recomputeStatuses(alerts: UtilityAlert[]): UtilityAlert[] {
    const now = new Date().getTime();
    return alerts
      .filter(a => {
        const start = new Date(a.start_time).getTime();
        // Earthquakes: keep if within last 72 hours
        if (a.type === 'earthquake') {
          return (now - start) < 72 * 60 * 60 * 1000;
        }
        // Roads: keep if ongoing or within last 24h
        if (a.type === 'road') {
          const end = a.end_time ? new Date(a.end_time).getTime() : start + 7 * 24 * 60 * 60 * 1000;
          return now <= end || (now - end) < 24 * 60 * 60 * 1000;
        }
        // Water: keep recent repairs and outages for 7 days (Vodovod only has a few per week)
        if (a.type === 'water') {
          return (now - start) < 7 * 24 * 60 * 60 * 1000;
        }
        // Power (EVN): purge outages ended more than 24h ago to prevent 100s of obsolete items
        const end = a.end_time ? new Date(a.end_time).getTime() : start + 4 * 60 * 60 * 1000;
        return (now - end) < 24 * 60 * 60 * 1000;
      })
      .map(a => {
        const start = new Date(a.start_time).getTime();
        if (a.type === 'earthquake') {
          const status: 'active' | 'upcoming' | 'resolved' = (now - start) < 24 * 60 * 60 * 1000 ? 'active' : 'resolved';
          return { ...a, status };
        }
        if (a.type === 'road') {
          return { ...a, status: 'active' as const };
        }
        const end = a.end_time ? new Date(a.end_time).getTime() : start + 4 * 60 * 60 * 1000;
        let status: 'active' | 'upcoming' | 'resolved' = 'upcoming';
        if (now >= start && now <= end) {
          status = 'active';
        } else if (now > end) {
          status = 'resolved';
        }
        return { ...a, status };
      });
  }

  public getActiveAlertsCount(city: string, alerts: UtilityAlert[]): number {
    const norm = (city || '').toLowerCase().trim();
    return alerts.filter(a => {
      const matchCity = !norm || norm === 'all' || a.city.toLowerCase().includes(norm) || (a.municipality && a.municipality.toLowerCase().includes(norm));
      return matchCity && (a.status === 'active' || a.status === 'upcoming');
    }).length;
  }

  public formatAlertTime(isoStr: string): string {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      return `${day}.${month} во ${hours}:${mins}`;
    } catch {
      return isoStr;
    }
  }

  public formatTimeWindow(startIso: string, endIso?: string): string {
    if (!startIso) return '';
    try {
      const s = new Date(startIso);
      const sH = s.getHours().toString().padStart(2, '0');
      const sM = s.getMinutes().toString().padStart(2, '0');
      const sDay = s.getDate().toString().padStart(2, '0');
      const sMonth = (s.getMonth() + 1).toString().padStart(2, '0');

      if (!endIso) {
        return `${sDay}.${sMonth}. од ${sH}:${sM}`;
      }

      const e = new Date(endIso);
      const eH = e.getHours().toString().padStart(2, '0');
      const eM = e.getMinutes().toString().padStart(2, '0');
      const isSameDay = s.toDateString() === e.toDateString();

      if (isSameDay) {
        return `${sDay}.${sMonth}. од ${sH}:${sM} до ${eH}:${eM}`;
      } else {
        const eDay = e.getDate().toString().padStart(2, '0');
        const eMonth = (e.getMonth() + 1).toString().padStart(2, '0');
        return `${sDay}.${sMonth} ${sH}:${sM} — ${eDay}.${eMonth} ${eH}:${eM}`;
      }
    } catch {
      return startIso;
    }
  }

  public cleanAlertText(text?: string | null): string {
    if (!text) return '';
    return text
      // 1. Fix broken years like 2 0 2 6 or 202 6 -> 2026
      .replace(/2\s*0\s*2\s*(\d)/g, '202$1')
      // 2. Fix spaced single digits in dates like "1 8." or "0 9." -> "18." or "09."
      .replace(/(\b\d)\s+(\d\s*\.)/g, '$1$2')
      // 3. Fix dates with spaces around dots like "15 . 10 . 2026" or "18.09. 2026" -> "15.10.2026"
      .replace(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/g, '$1.$2.$3')
      // 4. Fix spaces before punctuation: " , " -> ", ", " . " -> ". "
      .replace(/\s+([.,:;])/g, '$1')
      // 5. Ensure space after punctuation (except in decimal numbers or dates)
      .replace(/([,;])([^\s])/g, '$1 $2')
      .replace(/\.([А-Яа-яA-Za-z])/g, '. $1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  public annotateDistances(alerts: UtilityAlert[], userCoords: { latitude: number; longitude: number } | null): UtilityAlert[] {
    if (!userCoords) return alerts;
    return alerts.map(alert => {
      if (alert.latitude && alert.longitude) {
        const distanceKm = this.calculateDistanceKm(
          userCoords.latitude,
          userCoords.longitude,
          alert.latitude,
          alert.longitude
        );
        return { ...alert, distanceKm };
      }
      return alert;
    });
  }

  public formatDistance(distanceKm?: number): string {
    if (distanceKm == null || isNaN(distanceKm)) return '';
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
  }
}

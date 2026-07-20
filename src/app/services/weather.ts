// src/app/services/weather.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Geolocation } from '@capacitor/geolocation';
import { from, Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private http = inject(HttpClient);
  
  private defaultLat = 41.9965; // Skopje Fallback
  private defaultLng = 21.4314;

  getLocalWeatherData(): Observable<any> {
    return from(this.getCoords()).pipe(
      switchMap((coords) => {
        const lat = coords ? coords.lat : this.defaultLat;
        const lng = coords ? coords.lng : this.defaultLng;
        return this.fetchFromApi(lat, lng);
      })
    );
  }

  private fetchFromApi(lat: number, lng: number): Observable<any> {
    // FIX: Explicitly added hourly temperature_2m, weather_code and daily aggregates to drive modal carousels
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,is_day,weather_code&hourly=temperature_2m,uv_index,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
    return this.http.get(url).pipe(
      catchError(err => {
        console.error('API network breakdown occurred:', err);
        return of(null); 
      })
    );
  }

  getWeatherIcon(code: number, isDay: number = 1): string {
    const dayTime = isDay === 1;

    if (code === 0) return dayTime ? '☀️' : '🌙'; // Clear sky
    if (code >= 1 && code <= 3) return dayTime ? '⛅' : '☁️'; // Partly cloudy
    if (code >= 45 && code <= 48) return '🌫️'; // Fog
    if (code >= 51 && code <= 65) return dayTime ? '🌦️' : '🌧️'; // Drizzle / Rain
    if (code >= 71 && code <= 77) return '❄️'; // Snow
    if (code >= 80 && code <= 82) return dayTime ? '🌧️' : '☔'; // Rain showers
    return '☁️';
  }

  private async getCoords(): Promise<{ lat: number; lng: number } | null> {
    try {
      const checkPerms = await Geolocation.checkPermissions();
      if (checkPerms.location !== 'granted') {
        const reqPerms = await Geolocation.requestPermissions();
        if (reqPerms.location !== 'granted') return null;
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 4000
      });

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    } catch (e) {
      console.warn('GPS hardware access bypassed, using default location.');
      return null;
    }
  }

  /**
   * Resolves coordinates locally without making network calls to prevent CORS blocks
   */
  getCityNameFromCoords(lat: number, lng: number): Observable<string> {
    let city = 'Скопје';

    const fixedLat = Math.round(lat * 100) / 100;
    const fixedLng = Math.round(lng * 100) / 100;

    if (fixedLat >= 41.90 && fixedLat <= 42.05 && fixedLng >= 21.35 && fixedLng <= 21.50) {
      city = 'Скопје';
    } else if (fixedLat >= 41.00 && fixedLat <= 41.15 && fixedLng >= 21.25 && fixedLng <= 21.45) {
      city = 'Битола';
    } else if (fixedLat >= 41.05 && fixedLat <= 41.20 && fixedLng >= 20.75 && fixedLng <= 20.85) {
      city = 'Охрид';
    } else if (fixedLat >= 42.10 && fixedLat <= 42.20 && fixedLng >= 21.65 && fixedLng <= 21.75) {
      city = 'Куманово';
    } else if (fixedLat >= 41.30 && fixedLat <= 41.45 && fixedLng >= 21.50 && fixedLng <= 21.65) {
      city = 'Прилеп';
    } else if (fixedLat >= 42.00 && fixedLat <= 42.05 && fixedLng >= 20.95 && fixedLng <= 21.05) {
      city = 'Тетово';
    }

    return of(city);
  }

  getWeatherDesc(code: number): string {
    if (code === 0) return 'Ведро';
    if (code >= 1 && code <= 3) return 'Делумно Облачно';
    if (code >= 45 && code <= 48) return 'Магла';
    if (code >= 51 && code <= 65) return 'Дождливо';
    if (code >= 71 && code <= 77) return 'Снег';
    if (code >= 80 && code <= 82) return 'Плускови дожд';
    return 'Променливо';
  }
}
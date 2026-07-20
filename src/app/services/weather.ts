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
    // FIXED: Changed temperature_2b -> temperature_2m
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=uv_index&timezone=auto`;
    return this.http.get(url).pipe(
      catchError(err => {
        console.error('API network breakdown occurred:', err);
        return of(null); 
      })
    );
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
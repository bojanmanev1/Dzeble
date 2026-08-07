import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  
  private defaultLat = 41.9965; 
  private defaultLng = 21.4314;

  /**
   * 🌟 NEW: Exposes raw device GPS coordinates as an Observable
   */
  getDeviceCoordinates(): Observable<{ latitude: number; longitude: number }> {
    return from(this.getCoords()).pipe(
      map((coords) => {
        return {
          latitude: coords ? coords.lat : this.defaultLat,
          longitude: coords ? coords.lng : this.defaultLng
        };
      })
    );
  }

  /**
   * Resolves device GPS coordinates into a localized city name matching our database keys
   */
  getCityFromDeviceLocation(): Observable<string> {
    return from(this.getCoords()).pipe(
      map((coords) => {
        const lat = coords ? coords.lat : this.defaultLat;
        const lng = coords ? coords.lng : this.defaultLng;
        return this.resolveCityName(lat, lng);
      })
    );
  }

private async getCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    const checkPerms = await Geolocation.checkPermissions();
    if (checkPerms.location !== 'granted') {
      // Prompt user for fine/coarse location permissions immediately
      const reqPerms = await Geolocation.requestPermissions();
      if (reqPerms.location !== 'granted') return null;
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 5000
    });

    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (e) {
    console.warn('GPS access bypassed, falling back to default Skopje location.', e);
    return null;
  }
}

  // Define the exact coordinates of your seeded database cities
  private macedonianCities = [
    { name: 'Скопје', lat: 42.0000, lng: 21.4333 },
    { name: 'Битола', lat: 41.0311, lng: 21.3403 },
    { name: 'Куманово', lat: 42.1322, lng: 21.7144 },
    { name: 'Прилеп', lat: 41.3461, lng: 21.5542 },
    { name: 'Тетово', lat: 42.0106, lng: 20.9714 },
    { name: 'Охрид', lat: 41.1172, lng: 20.8019 },
    { name: 'Велес', lat: 41.7156, lng: 21.7756 },
    { name: 'Штип', lat: 41.7458, lng: 22.1994 },
    { name: 'Струмица', lat: 41.4375, lng: 22.6433 },
    { name: 'Гостивар', lat: 41.7961, lng: 20.9083 },
    { name: 'Кавадарци', lat: 41.4331, lng: 22.0119 },
    { name: 'Кочани', lat: 41.9167, lng: 22.4125 },
    { name: 'Кичево', lat: 41.5139, lng: 20.9531 },
    { name: 'Струга', lat: 41.1778, lng: 20.6789 },
    { name: 'Гевгелија', lat: 41.1414, lng: 22.5019 }
  ];

  private resolveCityName(userLat: number, userLng: number): string {
    let nearestCity = this.macedonianCities[0].name;
    let shortestDistance = Number.MAX_VALUE;

    for (const city of this.macedonianCities) {
      const distance = Math.sqrt(
        Math.pow(userLat - city.lat, 2) + Math.pow(userLng - city.lng, 2)
      );

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestCity = city.name;
      }
    }

    return nearestCity;
  }

  /**
   * Maps dynamic OpenWeather weather codes to explicit system UI display vector icons
   */
  getWeatherIcon(code: number, isDay: number = 1): string {
    const dayTime = isDay === 1;
    if (code === 800) return dayTime ? '☀️' : '🌙'; // Clear Sky
    if (code >= 801 && code <= 804) return dayTime ? '⛅' : '☁️'; // Clouds
    if (code >= 701 && code <= 781) return '🌫️'; // Atmosphere / Fog
    if (code >= 500 && code <= 531) return '🌧️'; // Rain
    if (code >= 300 && code <= 321) return '🌦️'; // Drizzle
    if (code >= 200 && code <= 232) return '⛈️'; // Thunderstorm
    if (code >= 600 && code <= 622) return '❄️'; // Snow
    return '☁️';
  }

  getWeatherDesc(code: number): string {
    if (code === 800) return 'Ведро';
    if (code >= 801 && code <= 802) return 'Делумно Облачно';
    if (code >= 803 && code <= 804) return 'Облачно';
    if (code >= 701 && code <= 781) return 'Магла';
    if (code >= 500 && code <= 531) return 'Дождливо';
    if (code >= 200 && code <= 232) return 'Грмежи';
    if (code >= 600 && code <= 622) return 'Снег';
    return 'Променливо';
  }
}
import { Injectable, inject } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private translate = inject(TranslateService, { optional: true });
  
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
   * Maps WMO standard codes (0-99) and OpenWeather legacy codes to explicit system UI vector icons
   */
  getWeatherIcon(code: number, isDay: number = 1): string {
    const dayTime = isDay === 1;

    // 1. WMO Standard Codes
    if (code === 0) return dayTime ? '☀️' : '🌙'; // Clear Sky
    if (code === 1) return dayTime ? '🌤️' : '🌙'; // Mainly Clear
    if (code === 2) return dayTime ? '⛅' : '☁️'; // Partly Cloudy
    if (code === 3) return '☁️'; // Overcast
    if (code === 45 || code === 48) return '🌫️'; // Fog
    if (code >= 51 && code <= 57) return '🌦️'; // Drizzle / Freezing Drizzle
    if (code >= 61 && code <= 67) return '🌧️'; // Rain / Freezing Rain
    if (code >= 71 && code <= 77) return '❄️'; // Snow fall / Grains
    if (code >= 80 && code <= 82) return '🌧️'; // Rain Showers
    if (code >= 85 && code <= 86) return '🌨️'; // Snow Showers
    if (code >= 95 && code <= 99) return '⛈️'; // Thunderstorm

    // 2. Legacy OpenWeather Codes fallback
    if (code === 800) return dayTime ? '☀️' : '🌙';
    if (code >= 801 && code <= 804) return dayTime ? '⛅' : '☁️';
    if (code >= 701 && code <= 781) return '🌫️';
    if (code >= 500 && code <= 531) return '🌧️';
    if (code >= 300 && code <= 321) return '🌦️';
    if (code >= 200 && code <= 232) return '⛈️';
    if (code >= 600 && code <= 622) return '❄️';

    return '☁️';
  }

  /**
   * Maps WMO and OpenWeather codes to Ionic vector icon names
   */
  getWeatherIonicIcon(code: number, isDay: number = 1): string {
    const dayTime = isDay === 1;

    // 1. WMO Standard Codes
    if (code === 0) return dayTime ? 'sunny' : 'moon';
    if (code === 1 || code === 2) return dayTime ? 'partly-sunny' : 'cloudy-night';
    if (code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'cloudy';
    if (code >= 51 && code <= 67) return 'rainy';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rainy';
    if (code >= 85 && code <= 86) return 'snow';
    if (code >= 95 && code <= 99) return 'thunderstorm';

    // 2. Legacy OpenWeather Codes fallback
    if (code === 800) return dayTime ? 'sunny' : 'moon';
    if (code >= 801 && code <= 802) return dayTime ? 'partly-sunny' : 'cloudy-night';
    if (code >= 803 && code <= 804) return 'cloudy';
    if (code >= 701 && code <= 781) return 'cloudy';
    if (code >= 500 && code <= 531) return 'rainy';
    if (code >= 300 && code <= 321) return 'rainy';
    if (code >= 200 && code <= 232) return 'thunderstorm';
    if (code >= 600 && code <= 622) return 'snow';

    return 'cloudy';
  }

  /**
   * Accent color for current weather condition
   */
  getWeatherIonicColor(code: number, isDay: number = 1): string {
    const dayTime = isDay === 1;
    if (code === 0) return dayTime ? '#f59e0b' : '#38bdf8';
    if (code === 1 || code === 2) return dayTime ? '#f59e0b' : '#64748b';
    if (code >= 51 && code <= 67) return '#0284c7';
    if (code >= 80 && code <= 82) return '#0284c7';
    if (code >= 71 && code <= 77) return '#06b6d4';
    if (code >= 85 && code <= 86) return '#06b6d4';
    if (code >= 95 && code <= 99) return '#7c3aed';
    if (code >= 500 && code <= 531) return '#0284c7';
    if (code >= 200 && code <= 232) return '#7c3aed';
    if (code >= 600 && code <= 622) return '#06b6d4';
    return '#64748b';
  }

  getWeatherDesc(code: number): string {
    const t = (key: string, fallback: string) => this.translate ? this.translate.instant(key) : fallback;

    // 1. WMO Standard Codes
    if (code === 0) return t('WEATHER_DESC.CLEAR', 'Ведро');
    if (code === 1) return t('WEATHER_DESC.MAINLY_CLEAR', 'Претежно ведро');
    if (code === 2) return t('WEATHER_DESC.PARTLY_CLOUDY', 'Делумно Облачно');
    if (code === 3) return t('WEATHER_DESC.OVERCAST', 'Облачно');
    if (code === 45 || code === 48) return t('WEATHER_DESC.FOG', 'Магла');
    if (code >= 51 && code <= 57) return t('WEATHER_DESC.DRIZZLE', 'Росење');
    if (code >= 61 && code <= 67) return t('WEATHER_DESC.RAIN', 'Дождливо');
    if (code >= 71 && code <= 77) return t('WEATHER_DESC.SNOW', 'Снег');
    if (code >= 80 && code <= 82) return t('WEATHER_DESC.SHOWERS', 'Пороен дожд');
    if (code >= 85 && code <= 86) return t('WEATHER_DESC.SNOW_SHOWERS', 'Снежни врнежи');
    if (code >= 95 && code <= 99) return t('WEATHER_DESC.THUNDERSTORM', 'Грмежи');

    // 2. Legacy OpenWeather Codes fallback
    if (code === 800) return t('WEATHER_DESC.CLEAR', 'Ведро');
    if (code >= 801 && code <= 802) return t('WEATHER_DESC.PARTLY_CLOUDY', 'Делумно Облачно');
    if (code >= 803 && code <= 804) return t('WEATHER_DESC.OVERCAST', 'Облачно');
    if (code >= 701 && code <= 781) return t('WEATHER_DESC.FOG', 'Магла');
    if (code >= 500 && code <= 531) return t('WEATHER_DESC.RAIN', 'Дождливо');
    if (code >= 200 && code <= 232) return t('WEATHER_DESC.THUNDERSTORM', 'Грмежи');
    if (code >= 600 && code <= 622) return t('WEATHER_DESC.SNOW', 'Снег');

    return t('WEATHER_DESC.VARIABLE', 'Променливо');
  }
}
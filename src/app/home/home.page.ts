// src/app/home/home.page.ts
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase';
import { WeatherService } from '../services/weather';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { User } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonSelect, 
  IonSelectOption,
  IonModal 
} from '@ionic/angular/standalone';

interface Widget {
  id: string;
  translationKey: string;
  value: string;
  unit: string;
  icon: string;
  isPremium: boolean;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    TranslatePipe,
    IonContent, 
    IonSelect, 
    IonSelectOption,
    IonModal,
    FormsModule
  ]
})
export class HomePage implements OnInit, OnDestroy {
  private supabaseService = inject(SupabaseService);
  private weatherService = inject(WeatherService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  
  parsedWeatherData: any = null;
  isDetailModalOpen = false;
  activeDetailWidgetId: string | null = null;
  inputEuroAmount: number = 1;
  rawDatabaseRates: any[] = [];
  userTier: 'guest' | 'logged-in' | 'premium' = 'guest';
  currentUser: User | null = null;
  currentLang = 'mk';
  isPremiumModalOpen = false; 
  isUpgrading = false;
  isCurrencyModalOpen = false;
  currentCityName = 'Скопје'; 

  private weatherSub: Subscription | null = null;

  allWidgets: Widget[] = [
    { id: 'weather', translationKey: 'WIDGETS.WEATHER', value: '--°', unit: 'Вчитување...', icon: '☁️', isPremium: false },
    { id: 'uv', translationKey: 'WIDGETS.UV', value: '-', unit: 'UV', icon: '☀️', isPremium: false }, 
    { id: 'currency', translationKey: 'WIDGETS.CURRENCY', value: '61.49', unit: 'МКД', icon: '💶', isPremium: false },
    { id: 'fuel', translationKey: 'WIDGETS.FUEL', value: '82.5', unit: 'МКД', icon: '⛽', isPremium: false },
    { id: 'aqi', translationKey: 'WIDGETS.AQI', value: '42', unit: 'Добро', icon: '💨', isPremium: false },
    { id: 'holiday', translationKey: 'WIDGETS.HOLIDAY', value: '12д', unit: 'Празник', icon: '📅', isPremium: true }
  ];

  visibleWidgets: Widget[] = [];

  constructor() {
    this.translate.use('mk');
  }

  ngOnInit() {
    this.supabaseService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (!user) {
        this.userTier = 'guest';
        this.filterWidgets();
      } else {
        this.supabaseService.isPremium$.subscribe(isPremium => {
          this.userTier = isPremium ? 'premium' : 'logged-in';
          this.filterWidgets();
        });
      }
    });

    this.fetchLiveMetrics();
    this.fetchDatabaseCurrencyRates();
  }

  getCurrencyFlag(currency: string): string {
  const flags: { [key: string]: string } = {
    'MKD': '🇲🇰', 'USD': '🇺🇸', 'CHF': '🇨🇭', 'GBP': '🇬🇧', 'RSD': '🇷🇸',
    'TRY': '🇹🇷', 'AUD': '🇦🇺', 'CAD': '🇨🇦', 'ALL': '🇦🇱', 'BGN': '🇧🇬'
  };
  return flags[currency] || '🏳️';
}

getCurrencyNameLocal(currency: string): string {
  const names: { [key: string]: string } = {
    'MKD': 'Македонски Денар', 'USD': 'УС Долар', 'CHF': 'Швајцарски Франк', 
    'GBP': 'Британска Фунта', 'RSD': 'Сербиски Динар', 'TRY': 'Турска Лира', 
    'AUD': 'Австралиски Долар', 'CAD': 'Канадски Долар', 'ALL': 'Албански Лек', 
    'BGN': 'Бугарски Лев'
  };
  return names[currency] || currency;
}

getCalculatedRateDynamic(rate: number): string {
  const total = this.inputEuroAmount * rate;
  return total.toLocaleString('mk-MK', { maximumFractionDigits: 2 });
}

  fetchLiveMetrics() {
    this.weatherSub = this.weatherService.getLocalWeatherData().subscribe({
      next: async (data) => {
        if (!data || !data.current) {
          console.warn('Weather data was empty or invalid.');
          return;
        }

        this.parsedWeatherData = data; // Cache the complete raw telemetry payload

        const lat = data.latitude || 41.9965;
        const lng = data.longitude || 21.4314;
        
        this.weatherService.getCityNameFromCoords(lat, lng).subscribe(cityName => {
          this.currentCityName = cityName; 
        });

        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        const isDay = data.current.is_day ?? 1; 

        const statusText = this.weatherService.getWeatherDesc(code);
        const dynamicWeatherIcon = this.weatherService.getWeatherIcon(code, isDay);

        const currentHourStr = new Date().toISOString().substring(0, 14) + '00';
        const hourIndex = data.hourly.time.findIndex((t: string) => t.startsWith(currentHourStr));
        const uvValue = hourIndex !== -1 ? Math.round(data.hourly.uv_index[hourIndex]) : 0;
        const dynamicUvIcon = uvValue > 0 ? '☀️' : '🌌';

        this.allWidgets = this.allWidgets.map(widget => {
          if (widget.id === 'weather') {
            return { ...widget, value: `${temp}°`, unit: statusText, icon: dynamicWeatherIcon };
          }
          if (widget.id === 'uv') {
            return { ...widget, value: `${uvValue}`, icon: dynamicUvIcon };
          }
          return widget;
        });
        this.filterWidgets();

        if (this.currentUser) {
          try {
            await this.supabaseService.syncUserWeather({
              userId: this.currentUser.id,
              lat: lat,
              lng: lng,
              temp: temp,
              code: code,
              uv: uvValue
            });
          } catch (syncError) {
            console.error('Weather background pipeline failed:', syncError);
          }
        }
      },
      error: (err) => {
        console.error('Failed to load GPS metrics.', err);
      }
    });
  }

  getHourlyForecast() {
    if (!this.parsedWeatherData || !this.parsedWeatherData.hourly) return [];
    
    const hourly = this.parsedWeatherData.hourly;
    const list = [];
    
    const currentHourStr = new Date().toISOString().substring(0, 14) + '00';
    let startIndex = hourly.time.findIndex((t: string) => t.startsWith(currentHourStr));
    if (startIndex === -1) startIndex = 0;

    // Build the horizontal axis containing the upcoming 5 hours of data
    for (let i = startIndex; i < startIndex + 5; i++) {
      if (!hourly.time[i]) break;
      
      const timeValue = new Date(hourly.time[i]);
      const displayHour = timeValue.toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' });
      const temp = Math.round(hourly.temperature_2m?.[i] ?? 0);
      const code = hourly.weather_code?.[i] ?? 0;
      
      // Approximate is_day for hourly targets: simple check if between 6 AM and 8 PM
      const hourNumber = timeValue.getHours();
      const calculatedIsDay = (hourNumber >= 6 && hourNumber < 20) ? 1 : 0;

      list.push({
        time: i === startIndex ? 'Сега' : displayHour,
        temp: `${temp}°`,
        icon: this.weatherService.getWeatherIcon(code, calculatedIsDay)
      });
    }
    return list;
  }

  getWeeklyForecast() {
    if (!this.parsedWeatherData || !this.parsedWeatherData.daily) return [];
    
    const daily = this.parsedWeatherData.daily;
    const list = [];
    
    for (let i = 1; i <= 3; i++) {
      if (!daily.time[i]) break;
      
      const dateValue = new Date(daily.time[i]);
      const dayName = dateValue.toLocaleDateString('mk-MK', { weekday: 'long' });
      
      const maxTemp = Math.round(daily.temperature_2m_max[i]);
      const minTemp = Math.round(daily.temperature_2m_min[i]);
      const code = daily.weather_code[i];

      list.push({
        day: i === 1 ? 'Утре' : dayName.charAt(0).toUpperCase() + dayName.slice(1),
        temps: `${maxTemp}° / ${minTemp}°`,
        icon: this.weatherService.getWeatherIcon(code, 1) // Always use day icons for weekly aggregates
      });
    }
    return list;
  }

  filterWidgets() {
    if (this.userTier === 'guest' || this.userTier === 'logged-in') {
      this.visibleWidgets = this.allWidgets.slice(0, 4);
    } else {
      this.visibleWidgets = this.allWidgets;
    }
  }

  changeLanguage(event: any) {
    const selectedLang = event.detail.value;
    this.currentLang = selectedLang;
    this.translate.use(selectedLang);
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  setPremiumModal(isOpen: boolean) {
    this.isPremiumModalOpen = isOpen;
  }
  
  setDetailModal(isOpen: boolean) {
    this.isDetailModalOpen = isOpen;
    if (!isOpen) {
      this.activeDetailWidgetId = null; 
    }
  }

  async activatePremium() {
    if (!this.currentUser) return;
    
    this.isUpgrading = true;
    try {
      await this.supabaseService.upgradeToPremium(this.currentUser.id);
      this.isPremiumModalOpen = false;
      alert('Успешно активиран Премиум пакет! Сега ги имате сите привилегии.');
    } catch (err) {
      alert('Грешка при активација.');
    } finally {
      this.isUpgrading = false;
    }
  }

 async fetchDatabaseCurrencyRates() {
  try {
    const ratesData = await this.supabaseService.getLatestCurrencyRates();
    if (!ratesData) return;

    const mkdRecord = ratesData.find((r: any) => r.target_currency === 'MKD');
    
    if (mkdRecord) {
      const liveMkdRate = mkdRecord.rate.toFixed(2); 

      this.allWidgets = this.allWidgets.map(widget => {
        if (widget.id === 'currency') {
          return { 
            ...widget, 
            value: `1 EUR = ${liveMkdRate}`, // Updates the text on the card grid
            unit: 'МКД' 
          };
        }
        return widget;
      });
      
      this.filterWidgets();
    }
  } catch (err) {
    console.error('Failed to resolve local currency rates, using fallback layout.', err);
  }
}

  async onWidgetClick(widgetId: string, isPremium: boolean) {
    if (isPremium && this.userTier !== 'premium') {
      this.setPremiumModal(true); 
      return;
    }
    
    this.activeDetailWidgetId = widgetId;
    
    if (widgetId === 'currency') {
      try {
        this.rawDatabaseRates = await this.supabaseService.getLatestCurrencyRates();
      } catch (e) {
        console.error('Failed to pre-fetch currency lists.');
      }
    }

    this.isDetailModalOpen = true;
  }

  setCurrencyModal(isOpen: boolean) {
    this.isCurrencyModalOpen = isOpen;
  }

  getCalculatedRate(target: string): string {
    const match = this.rawDatabaseRates.find(r => r.target_currency === target);
    if (!match) return '--';
    return (this.inputEuroAmount * match.rate).toLocaleString('mk-MK', { maximumFractionDigits: 2 });
  }

  async openCurrencyConverter() {
    try {
      this.rawDatabaseRates = await this.supabaseService.getLatestCurrencyRates();
      this.isCurrencyModalOpen = true;
    } catch (e) {
      alert('Неможност за вчитување на курсна листа.');
    }
  }

  async logout() {
    try {
      await this.supabaseService.signOut();
      alert('Успешно се одјавивте!');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  }

  ngOnDestroy() {
    if (this.weatherSub) {
      this.weatherSub.unsubscribe();
    }
  }
}
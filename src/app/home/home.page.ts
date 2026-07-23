import { Component, inject, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase';
import { WeatherService } from '../services/weather';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { User } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  leaf, 
  cloudy, 
  logoEuro, 
  speedometer, 
  sunny, 
  calendarNumber, 
  gift, 
  notifications, 
  checkmarkCircleOutline 
} from 'ionicons/icons';
import { 
  IonContent, 
  IonSelect, 
  IonSelectOption,
  IonModal, 
  IonIcon
} from '@ionic/angular/standalone';

interface Widget {
  id: string;
  translationKey: string;
  value: string;
  unit: string;
  icon: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule, 
    // TranslatePipe,
    IonContent, 
    IonSelect, 
    IonSelectOption,
    IonModal,
    IonIcon,
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
  userTier: 'guest' | 'logged-in' | 'premium' = 'premium';
  currentUser: User | null = null;
  currentLang = 'mk';
  isPremiumModalOpen = false; 
  isUpgrading = false;
  currentCityName = 'Скопје'; 
  rawDatabaseFuel: any[] = [];
  private weatherSub: Subscription | null = null;

  // Ordered strictly to match the new 3x3 layout configuration snippet
allWidgets: Widget[] = [
  // --- SYSTEM FIXED WIDGETS ---
  { id: 'aqi', translationKey: 'AQI', value: '42', unit: 'AQI', icon: 'leaf' }, // Air Quality
  { id: 'weather', translationKey: 'Време', value: '--°', unit: 'Вчитување...', icon: 'cloudy' }, // Weather
  { id: 'currency', translationKey: 'EUR', value: '--.-', unit: 'EUR', icon: 'logo-euro' }, // Currency
  { id: 'fuel', translationKey: 'Гориво', value: '--.-', unit: 'МКД', icon: 'speedometer' }, // Petrol/Fuel
  { id: 'uv', translationKey: 'UV', value: '-', unit: 'UV', icon: 'sunny' }, // UV Index

  // --- SYSTEM PRE-DEFINED CALENDARS ---
  { id: 'holiday', translationKey: 'Празник', value: '12д', unit: 'Празник', icon: 'calendar-number' }, 
  { id: 'nameday', translationKey: 'Именден', value: 'Петар', unit: 'Именден', icon: 'gift' },

  // --- CUSTOM USER ADDED WIDGETS (Generic Fallbacks) ---
  // When users add a custom reminder (trash, custom bday, etc.), use these generic indicators:
  { id: 'custom-reminder', translationKey: 'Потсетник', value: 'Среда', unit: 'Нотификација', icon: 'notifications' }, 
  { id: 'custom-task', translationKey: 'Задача', value: 'Ѓубре', unit: 'Распоред', icon: 'checkmark-circle-outline' }
];

  visibleWidgets: Widget[] = [];

  constructor() {
    this.translate.use('mk');

    addIcons({ 
      'leaf': leaf,
      'cloudy': cloudy,
      'logo-euro': logoEuro,
      'speedometer': speedometer,
      'sunny': sunny,
      'calendar-number': calendarNumber,
      'gift': gift,
      'notifications': notifications,
      'checkmark-circle-outline': checkmarkCircleOutline
    });
  }

  ngOnInit() {
    this.supabaseService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.fetchLiveMetrics();
    this.fetchDatabaseCurrencyRates();
    this.fetchDatabaseFuelPrices();
    this.filterWidgets();
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

  async fetchDatabaseFuelPrices() {
    try {
      const fuelData = await this.supabaseService.getLatestFuelPrices();
      this.rawDatabaseFuel = fuelData || []; 

      if (this.rawDatabaseFuel.length === 0) return;

      const dieselRecord = this.rawDatabaseFuel.find((f: any) => f.fuel_type === 'Дизел');
      const displayPrice = dieselRecord ? dieselRecord.price_mkd.toFixed(1) : '82.5';

      this.allWidgets = this.allWidgets.map(widget => {
        if (widget.id === 'fuel') {
          return { ...widget, value: `${displayPrice}` };
        }
        return widget;
      });
      
      this.filterWidgets();
    } catch (err) {
      console.error('Failed to resolve local fuel matrices.', err);
    }
  }

  getDynamicFuelPrice(fuelName: string): string {
    const match = this.rawDatabaseFuel.find(f => f.fuel_type === fuelName);
    if (!match) return '--.--';
    return match.price_mkd.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getFuelEffectiveDate(): string {
    if (!this.rawDatabaseFuel || this.rawDatabaseFuel.length === 0) return '--.--.----';
    const recordWithDate = this.rawDatabaseFuel.find(f => f.effective_from);
    return recordWithDate ? recordWithDate.effective_from : '--.--.----';
  }

  getCalculatedRateDynamic(rate: number): string {
    const total = this.inputEuroAmount * rate;
    return total.toLocaleString('mk-MK', { maximumFractionDigits: 2 });
  }

  fetchLiveMetrics() {
    this.weatherSub = this.weatherService.getLocalWeatherData().subscribe({
      next: async (data) => {
        if (!data || !data.current) return;

        this.parsedWeatherData = data; 
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

        this.allWidgets = this.allWidgets.map(widget => {
          if (widget.id === 'weather') {
            return { ...widget, value: `${temp}°`, unit: 'Време' };
          }
          if (widget.id === 'uv') {
            return { ...widget, value: `${uvValue}` };
          }
          return widget;
        });
        this.filterWidgets();
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

    for (let i = startIndex; i < startIndex + 5; i++) {
      if (!hourly.time[i]) break;
      const timeValue = new Date(hourly.time[i]);
      const displayHour = timeValue.toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' });
      const temp = Math.round(hourly.temperature_2m?.[i] ?? 0);
      const code = hourly.weather_code?.[i] ?? 0;
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
        icon: this.weatherService.getWeatherIcon(code, 1) 
      });
    }
    return list;
  }

  filterWidgets() {
    this.visibleWidgets = [...this.allWidgets];
  }

  changeLanguage(event: any) {
    const selectedLang = event.detail.value;
    this.currentLang = selectedLang;
    this.translate.use(selectedLang);
  }

  setDetailModal(isOpen: boolean) {
    this.isDetailModalOpen = isOpen;
    if (!isOpen) this.activeDetailWidgetId = null; 
  }
async fetchDatabaseCurrencyRates() {
  try {
    const ratesData = await this.supabaseService.getLatestCurrencyRates();
    if (!ratesData) return;

    const mkdRecord = ratesData.find((r: any) => r.target_currency === 'MKD');
    if (mkdRecord) {
      // 🌟 Change .toFixed(1) to .toFixed(2) right here:
      const liveMkdRate = mkdRecord.rate.toFixed(2); 

      this.allWidgets = this.allWidgets.map(widget => {
        if (widget.id === 'currency') {
          return { ...widget, value: `${liveMkdRate}` };
        }
        return widget;
      });
      
      this.filterWidgets();
    }
  } catch (err) {
    console.error('Failed to resolve currency rates.', err);
  }
}

  async onWidgetClick(widgetId: string) {
    this.activeDetailWidgetId = widgetId;
    if (widgetId === 'currency') {
      try { this.rawDatabaseRates = await this.supabaseService.getLatestCurrencyRates(); } catch (e) {}
    }
    if (widgetId === 'fuel') {
      try { await this.fetchDatabaseFuelPrices(); } catch (e) {}
    }
    this.isDetailModalOpen = true;
  }

  ngOnDestroy() {
    if (this.weatherSub) this.weatherSub.unsubscribe();
  }
}
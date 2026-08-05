import { Component, inject, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase';
import { WeatherService } from '../services/weather';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
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
  checkmarkCircleOutline ,
  footsteps
} from 'ionicons/icons';
import { 
  IonContent, 
  IonSelect, 
  IonSelectOption,
  IonModal, 
  IonIcon,
  IonDatetime,
  AlertController
} from '@ionic/angular/standalone';
import { HealthData, HealthService } from '../services/health';

interface Widget {
  id: string;
  translationKey: string;
  value: string;
  unit: string;
  icon: string;
  isCustom?: boolean;
  rawTitle?: string;
  eventDate?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule, 
    IonContent, 
    IonSelect, 
    IonSelectOption,
    IonModal,
    IonIcon,
    IonDatetime,
    FormsModule
  ]
})
export class HomePage implements OnInit, OnDestroy {
  private supabaseService = inject(SupabaseService);
  private weatherService = inject(WeatherService);
  private translate = inject(TranslateService);
  private healthService = inject(HealthService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  
  parsedWeatherData: any = null;
  isDetailModalOpen = false;
  activeDetailWidgetId: string | null = null;
  inputEuroAmount: number = 1;
  rawDatabaseRates: any[] = [];
  currentUser: User | null = null;
  currentLang = 'mk';
  currentCityName = 'Скопје'; 
  rawDatabaseFuel: any[] = [];
  private weatherSub: Subscription | null = null;

  // 🌟 NEW: Custom Widget Creation State
  isAddWidgetModalOpen = false;
  newWidgetTitle = '';
  newWidgetDate: string = new Date().toISOString();

  todayHealthData: HealthData = { steps: 0, calories: 0, distanceKm: 0 };
  last7DaysHealth: any[] = [];
  notified10k = false;
  notified15k = false;

  allWidgets: Widget[] = [
    { id: 'aqi', translationKey: 'AQI', value: '42', unit: 'AQI', icon: 'leaf' },
    { id: 'weather', translationKey: 'Време', value: '--°', unit: 'Вчитување...', icon: 'cloudy' },
    { id: 'currency', translationKey: 'EUR', value: '--.-', unit: 'EUR', icon: 'logo-euro' },
    { id: 'fuel', translationKey: 'Гориво', value: '--.-', unit: 'МКД', icon: 'speedometer' },
    { id: 'uv', translationKey: 'UV', value: '-', unit: 'UV', icon: 'sunny' },
    { id: 'activity', translationKey: 'Чекори', value: '0', unit: '0 kcal', icon: 'footsteps' },
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
      'checkmark-circle-outline': checkmarkCircleOutline,
      'footsteps': footsteps
    });
  }

ngOnInit() {
    this.supabaseService.currentUser$.subscribe(async (user) => {
      this.currentUser = user;
      if (user) {
        await this.loadUserCustomWidgets(user.id);
        await this.syncHealthData(user.id); // 👈 Sync steps on login/load
      } else {
        this.filterWidgets();
      }
    });

    this.fetchLiveMetrics();
    this.fetchDatabaseCurrencyRates();
    this.fetchDatabaseFuelPrices();
  }


// inside home.page.ts

async syncHealthData(userId: string) {
  console.log('Starting syncHealthData for user:', userId);
  const hardwareSteps = await this.healthService.getTodayDeviceSteps();
  console.log('Fetched hardware steps:', hardwareSteps);

  const calculated = this.healthService.calculateMetrics(hardwareSteps);
  this.todayHealthData = calculated;

  const milestoneRes = await this.healthService.checkAndNotifyMilestones(
    calculated.steps, 
    this.notified10k, 
    this.notified15k
  );
  this.notified10k = milestoneRes.update10k;
  this.notified15k = milestoneRes.update15k;

  // Always sync to Supabase so the record exists
  await this.supabaseService.syncTodayHealthMetrics(userId, {
    steps: calculated.steps,
    calories: calculated.calories,
    distanceKm: calculated.distanceKm,
    notified10k: this.notified10k,
    notified15k: this.notified15k
  });

  this.allWidgets = this.allWidgets.map(widget => {
    if (widget.id === 'activity') {
      return {
        ...widget,
        value: calculated.steps.toLocaleString('mk-MK'),
        unit: `${calculated.calories} kcal`
      };
    }
    return widget;
  });
  this.filterWidgets();
}

  // 🌟 Helper: Calculates remaining days until event date
  private calculateDaysUntil(dateString: string): string {
    const target = new Date(dateString);
    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Денес!';
    if (diffDays < 0) return 'Помина';
    return `${diffDays}д`;
  }
// 🌟 Updated Alert Redirect for Guest Users clicking the '+' Widget Card
async openAddWidgetModal() {
  if (!this.currentUser) {
    const alert = await this.alertCtrl.create({
      header: 'Најавата е задолжителна',
      message: 'За да креирате ваши виџети, ве молиме најавете се на вашиот профил.',
      buttons: [
        { text: 'Откажи', role: 'cancel' },
        { text: 'Најава', handler: () => this.router.navigate(['/login']) } // Points to /login
      ]
    });
    await alert.present();
    return;
  }

  this.newWidgetTitle = '';
  this.newWidgetDate = new Date().toISOString();
  this.isAddWidgetModalOpen = true;
}

  setAddWidgetModal(isOpen: boolean) {
    this.isAddWidgetModalOpen = isOpen;
  }

  openAuthModal() {
    if (!this.currentUser) {
      this.router.navigate(['/auth']);
    }
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
    this.weatherSub = this.weatherService.getDeviceCoordinates().subscribe({
      next: async (coords: { latitude: number; longitude: number }) => {
        const metrics = await this.supabaseService.getNearestCityMetrics(
          coords.latitude, 
          coords.longitude
        );

        if (!metrics) return;

        this.currentCityName = metrics.city_name;
        this.parsedWeatherData = metrics;

        this.allWidgets = this.allWidgets.map(widget => {
          if (widget.id === 'weather') {
            return { 
              ...widget, 
              value: `${Math.round(metrics.current_temp)}°`, 
              unit: this.weatherService.getWeatherDesc(metrics.weather_code) 
            };
          }
          if (widget.id === 'uv') {
            return { ...widget, value: `${Math.round(metrics.uv_index)}` };
          }
          if (widget.id === 'aqi') {
            return { 
              ...widget, 
              value: metrics.aqi_status_text, 
              unit: `Индекс: ${metrics.aqi_value}` 
            };
          }
          return widget;
        });

        this.filterWidgets();
      },
      error: (err: any) => {
        console.error('Failed to get device coordinates:', err);
      }
    });
  }

  getHourlyForecast() {
    if (!this.parsedWeatherData || !this.parsedWeatherData.hourly_forecast) return [];
    return this.parsedWeatherData.hourly_forecast;
  }

  getWeeklyForecast() {
    if (!this.parsedWeatherData || !this.parsedWeatherData.weekly_forecast) return [];
    return this.parsedWeatherData.weekly_forecast;
  }

  filterWidgets() {
    this.visibleWidgets = [...this.allWidgets];
  }

  getAqiColor(aqiValue: number): string {
    switch(Number(aqiValue)) {
      case 1: return '#2a9d8f';
      case 2: return '#e9c46a';
      case 3: return '#f4a261';
      case 4: return '#e76f51';
      case 5: return '#d62828';
      default: return '#2a9d8f';
    }
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
    
    if (widgetId === 'activity' && this.currentUser) {
      this.last7DaysHealth = await this.supabaseService.getLast7DaysHealthMetrics(this.currentUser.id);
    }
    if (widgetId === 'currency') {
      try { this.rawDatabaseRates = await this.supabaseService.getLatestCurrencyRates(); } catch (e) {}
    }
    if (widgetId === 'fuel') {
      try { await this.fetchDatabaseFuelPrices(); } catch (e) {}
    }
    this.isDetailModalOpen = true;
  }

  formatHistoryDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('mk-MK', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }

  ngOnDestroy() {
    if (this.weatherSub) this.weatherSub.unsubscribe();
  }

  // 🌟 Avatar Action: Toggles Login or Signs Out
async onAvatarClick() {
  if (this.currentUser) {
    const alert = await this.alertCtrl.create({
      header: 'Одјава',
      message: 'Дали сте сигурни дека сакате да се одјавите?',
      buttons: [
        { text: 'Откажи', role: 'cancel' },
        { 
          text: 'Одјави се', 
          handler: async () => {
            await this.supabaseService.signOut();
            this.allWidgets = this.allWidgets.filter(w => !w.isCustom);
            this.filterWidgets();
          } 
        }
      ]
    });
    await alert.present();
  } else {
    this.router.navigate(['/login']);
  }
}

async loadUserCustomWidgets(userId: string) {
  try {
    const dbWidgets = await this.supabaseService.getUserWidgets(userId);
    
    const customMappedWidgets: Widget[] = dbWidgets.map((w: any) => ({
      id: w.id,
      translationKey: w.title,
      rawTitle: w.title,
      eventDate: w.event_date,
      value: this.calculateDaysUntil(w.event_date),
      unit: 'Днови',
      icon: w.icon || 'calendar-number',
      isCustom: true
    }));

    const baseWidgets = this.allWidgets.filter(w => !w.isCustom);
    this.allWidgets = [...baseWidgets, ...customMappedWidgets];
    this.filterWidgets();
  } catch (err) {
    console.error('Error binding custom user widgets:', err);
  }
}

async saveCustomWidget() {
  if (!this.newWidgetTitle.trim() || !this.currentUser) return;

  try {
    const newWidget = await this.supabaseService.addUserWidget(
      this.currentUser.id,
      this.newWidgetTitle.trim(),
      this.newWidgetDate
    );

    const createdWidget: Widget = {
      id: newWidget.id,
      translationKey: newWidget.title,
      rawTitle: newWidget.title,
      eventDate: newWidget.event_date,
      value: this.calculateDaysUntil(newWidget.event_date),
      unit: 'Днови',
      icon: newWidget.icon,
      isCustom: true
    };

    this.allWidgets.push(createdWidget);
    this.filterWidgets();
    this.setAddWidgetModal(false);
  } catch (err) {
    console.error('Failed to create widget:', err);
  }
}

// 🌟 Get currently selected custom widget for the detail modal
getActiveCustomWidget(): Widget | undefined {
  return this.allWidgets.find(w => w.id === this.activeDetailWidgetId && w.isCustom);
}

// 🌟 Format raw date (e.g. "2026-08-20" -> "20.08.2026")
formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// 🌟 Delete Custom Widget Action
async deleteCurrentCustomWidget(widgetId: string) {
  const alert = await this.alertCtrl.create({
    header: 'Избриши Виџет',
    message: 'Дали сте сигурни дека сакате да го избришете овој виџет?',
    buttons: [
      { text: 'Откажи', role: 'cancel' },
      {
        text: 'Избриши',
        role: 'destructive',
        handler: async () => {
          try {
            await this.supabaseService.deleteUserWidget(widgetId);
            this.allWidgets = this.allWidgets.filter(w => w.id !== widgetId);
            this.filterWidgets();
            this.setDetailModal(false);
          } catch (e) {
            console.error('Failed to delete widget', e);
          }
        }
      }
    ]
  });
  await alert.present();
}


}
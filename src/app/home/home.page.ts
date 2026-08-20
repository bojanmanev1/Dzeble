import { Component, inject, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase';
import { WeatherService } from '../services/weather';
import { CryptoService, CryptoTicker } from '../services/crypto';
import { CommonModule } from '@angular/common';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { User } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { NetworkService } from '../services/network';
import { 
  leaf, 
  cloudy, 
  logoEuro, 
  speedometer, 
  sunny, 
  calendarNumber, 
  gift, 
  notifications, 
  checkmarkCircleOutline,
  footsteps,
  card,
  personOutline,
  statsChart,
  trendingUp
} from 'ionicons/icons';

import { 
  IonContent, 
  IonSelect, 
  IonSelectOption,
  IonModal, 
  IonIcon,
  IonDatetime,
  IonToggle,
  AlertController
} from '@ionic/angular/standalone';

import { HealthData, HealthService } from '../services/health';
import { LoyaltyService, LoyaltyCard } from '../services/loyalty';
import { BarcodeRenderDirective } from '../directives/barcode-render';
import { MACEDONIAN_STORES, StorePreset } from '../config/loyalty-stores.config';

interface Widget {
  id: string;
  translationKey: string;
  value?: string;
  unit: string;
  icon: string;
  isCustom?: boolean;
  rawTitle?: string;
  eventDate?: string;
}

export interface TickerItem {
  id: string;
  type: 'news' | 'holiday' | 'alert' | 'system';
  headerKey?: string;
  rawHeader?: string;
  title: string;
  linkUrl?: string;
  date?: string;
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
    IonToggle,
    FormsModule,
    BarcodeRenderDirective,
    TranslatePipe
  ]
})
export class HomePage implements OnInit, OnDestroy {
  private supabaseService = inject(SupabaseService);
  private weatherService = inject(WeatherService);
  private cryptoService = inject(CryptoService);
  private translate = inject(TranslateService);
  private healthService = inject(HealthService);
  private loyaltyService = inject(LoyaltyService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  public networkService = inject(NetworkService);
  currentYear = new Date().getFullYear();
  minCalendarDate = `${this.currentYear}-01-01`;
  maxCalendarDate = `${this.currentYear + 1}-12-31`;

  parsedWeatherData: any = null;
  tickerItems: TickerItem[] = [];
  currentTickerIndex = 0;
  private tickerIntervalSub: any = null;

  isDetailModalOpen = false;
  activeDetailWidgetId: string | null = null;
  inputEuroAmount: number = 1;
  rawDatabaseRates: any[] = [];
  currentUser: User | null = null;
  currentLang = 'mk';
  currentCityName = 'Скопје'; 
  rawDatabaseFuel: any[] = [];
  private weatherSub: Subscription | null = null;
  private cryptoSub: Subscription | null = null;
  selectedDefaultFuel = localStorage.getItem('default_fuel_type') || 'Дизел';
  selectedDefaultCurrency = localStorage.getItem('default_currency') || 'EUR';

  // Live Crypto Map
  cryptoMap = new Map<string, CryptoTicker>();
  selectedCryptoPair = localStorage.getItem('crypto_selected_pair') || 'BTCUSDT';

  isAddWidgetModalOpen = false;
  isSettingsSheetOpen = false;
  isDarkMode = localStorage.getItem('theme_mode') === 'dark';

  newWidgetTitle = '';
  newWidgetDate: string = new Date().toISOString();
  inputMkdAmount: number = 100;
  todayHealthData: HealthData = { steps: 0, calories: 0, distanceKm: 0 };
  last7DaysHealth: any[] = [];
  notified10k = false;
  notified15k = false;
selectedCryptoCurrency: 'USD' | 'MKD' | 'EUR' = (localStorage.getItem('crypto_display_currency') as any) || 'MKD';
  private storeColorMap: { [key: string]: string } = {
    'tinex': '#D32F2F',
    'ramstore': '#E65100',
    'vero': '#1976D2',
    'neptun': '#0D47A1',
    'sport reality': '#212121',
    'sport vision': '#D50000',
    'kam': '#FF6F00',
    'stokomak': '#C2185B',
    'dm': '#3F51B5',
    'cosmo': '#8E24AA'
  };

  loyaltyCards: LoyaltyCard[] = [];
  selectedLoyaltyCard: LoyaltyCard | null = null;
  loyaltyModalView: 'list' | 'view' | 'add' = 'list';
  cryptoModalView: 'list' | 'detail' = 'list';
  selectedCoinDetail: CryptoTicker | null = null;
  stores: StorePreset[] = MACEDONIAN_STORES;
  newCardStore: string = 'Tinex';
  newCustomStoreName: string = '';
  newBarcodeData: string = '';
  newBarcodeFormat: string = 'CODE128';
  newCardColor: string = '#D32F2F';
  holidaysList: any[] = [];
  highlightedHolidayDates: any[] = [];
  selectedHolidayDetail: any = null;

  allWidgets: Widget[] = [
    { id: 'aqi', translationKey: 'WIDGETS.AQI', value: '--', unit: 'AQI', icon: 'leaf' },
    { id: 'fuel', translationKey: 'WIDGETS.FUEL', value: '--.-', unit: 'МКД', icon: 'speedometer' },
    { id: 'currency', translationKey: 'WIDGETS.CURRENCY', value: '--.-', unit: 'EUR', icon: 'logo-euro' },
    { id: 'weather', translationKey: 'WIDGETS.WEATHER', value: '--°', unit: '...', icon: 'cloudy' },
{ id: 'crypto', translationKey: '--', value: 'BTC', unit: 'BTC', icon: 'stats-chart' },    { id: 'holidays', translationKey: 'WIDGETS.HOLIDAY', value: '--.--', unit: 'Празник', icon: 'calendar-number' },    
    { id: 'uv', translationKey: 'WIDGETS.UV', value: '-', unit: 'UV', icon: 'sunny' },
    { id: 'activity', translationKey: 'WIDGETS.STEPS', value: '0', unit: '0 kcal', icon: 'footsteps' },
    { id: 'loyalty', translationKey: 'WIDGETS.LOYALTY', value: '0', unit: 'CARD_UNIT', icon: 'card' }
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
      'footsteps': footsteps,
      'card': card,
      'person-outline': personOutline,
      'stats-chart': statsChart,
      'trending-up': trendingUp
    });
  }

  ngOnInit() {
    this.supabaseService.currentUser$.subscribe(async (user) => {
      this.currentUser = user;

      if (user) {
        await this.healthService.requestHealthPermissions();
        await this.loadUserCustomWidgets(user.id);
        await this.syncHealthData(user.id);
        await this.loadLoyaltyCards(user.id);
      } else {
        this.loyaltyCards = [];
        this.filterWidgets();
      }
    });

    this.fetchHolidays();
    this.fetchLiveMetrics();
    this.fetchDatabaseCurrencyRates();
    this.fetchDatabaseFuelPrices();
    this.initLiveCrypto();
  }

  // --- CRYPTO STREAMING LOGIC ---

initLiveCrypto() {
  this.cryptoService.connect();
  this.cryptoSub = this.cryptoService.cryptoData$.subscribe((map) => {
    this.cryptoMap = map;
    this.updateCryptoWidgetDisplay();
  });
}

updateCryptoWidgetDisplay() {
  const ticker = this.cryptoMap.get(this.selectedCryptoPair);
  if (!ticker) return;

  const displayPrice = this.formatCompactPrice(ticker.price, this.selectedCryptoCurrency);

  this.allWidgets = this.allWidgets.map(w => {
    if (w.id === 'crypto') {
      return {
        ...w,
        value: ticker.symbol,         // 👈 Big center text: "BTC"
        translationKey: displayPrice  // 👈 Gray subtext: "3.79M ден."
      };
    }
    return w;
  });
  this.filterWidgets();
}

  getCryptoList(): CryptoTicker[] {
    return Array.from(this.cryptoMap.values());
  }

 selectCryptoForWidget(pair: string) {
  this.selectedCryptoPair = pair;
  localStorage.setItem('crypto_selected_pair', pair);
  this.updateCryptoWidgetDisplay();
}

  openSettingsSheet() {
    this.isSettingsSheetOpen = true;
  }

  goToLogin() {
    this.isSettingsSheetOpen = false;
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 150);
  }

  toggleDarkMode(event: any) {
    this.isDarkMode = event.detail.checked;
    localStorage.setItem('theme_mode', this.isDarkMode ? 'dark' : 'light');
    document.body.classList.toggle('dark', this.isDarkMode);
  }

  async handleLogout() {
    this.isSettingsSheetOpen = false;
    await this.supabaseService.signOut();
    this.allWidgets = this.allWidgets.filter(w => !w.isCustom);
    this.filterWidgets();
  }

  async loadLoyaltyCards(userId: string) {
    this.loyaltyCards = await this.loyaltyService.getUserCards(userId);
    this.updateLoyaltyWidgetValue();
  }

  updateLoyaltyWidgetValue() {
    this.allWidgets = this.allWidgets.map(widget => {
      if (widget.id === 'loyalty') {
        return {
          ...widget,
          value: `${this.loyaltyCards.length}`,
          unit: 'CARD_UNIT'
        };
      }
      return widget;
    });
    this.filterWidgets();
  }

  openLoyaltyCardView(card: LoyaltyCard) {
    this.selectedLoyaltyCard = card;
    this.loyaltyModalView = 'view';
    this.loyaltyService.setMaxBrightness();
  }

  openAddLoyaltyCardView() {
    this.newBarcodeData = '';
    this.newCustomStoreName = '';
    this.newCardColor = '#1e293b';
    this.loyaltyModalView = 'add';
  }

  closeLoyaltySubView() {
    this.loyaltyModalView = 'list';
    this.selectedLoyaltyCard = null;
    this.loyaltyService.resetBrightness();
  }
  openCoinDetail(coin: CryptoTicker) {
  this.selectedCoinDetail = coin;
  this.cryptoModalView = 'detail';
}

closeCoinDetail() {
  this.cryptoModalView = 'list';
  this.selectedCoinDetail = null;
}

  onStoreNameInput() {
    const cleanName = this.newCustomStoreName.trim().toLowerCase();
    this.newCardColor = this.storeColorMap[cleanName] || '#1e293b';
  }

  async scanBarcode() {
    try {
      const perm = await BarcodeScanner.checkPermissions();
      if (perm.camera !== 'granted') {
        const req = await BarcodeScanner.requestPermissions();
        if (req.camera !== 'granted') return;
      }

      const isAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!isAvailable.available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      const result = await BarcodeScanner.scan();
      if (result.barcodes && result.barcodes.length > 0) {
        const code = result.barcodes[0];
        this.newBarcodeData = code.rawValue || '';
        this.newBarcodeFormat = code.format || 'CODE128';
      }
    } catch (e) {
      console.error('Barcode scan error:', e);
    }
  }

  async saveLoyaltyCard() {
    if (!this.currentUser || !this.newBarcodeData.trim() || !this.newCustomStoreName.trim()) return;

    const saved = await this.loyaltyService.addCard({
      user_id: this.currentUser.id,
      store_name: this.newCustomStoreName.trim(),
      barcode_data: this.newBarcodeData.trim(),
      barcode_format: this.newBarcodeFormat,
      card_color: this.newCardColor
    });

    if (saved) {
      await this.loadLoyaltyCards(this.currentUser.id);
      this.closeLoyaltySubView();
    }
  }

  async deleteLoyaltyCard(cardId?: string) {
    if (!cardId || !this.currentUser) return;

    const success = await this.loyaltyService.deleteCard(cardId);
    if (success) {
      await this.loadLoyaltyCards(this.currentUser.id);
      this.closeLoyaltySubView();
    }
  }

  async syncHealthData(userId: string) {
    const hardwareSteps = await this.healthService.getTodayDeviceSteps();
    const calculated = this.healthService.calculateMetrics(hardwareSteps);
    this.todayHealthData = calculated;

    const milestoneRes = await this.healthService.checkAndNotifyMilestones(
      calculated.steps, 
      this.notified10k, 
      this.notified15k
    );
    this.notified10k = milestoneRes.update10k;
    this.notified15k = milestoneRes.update15k;

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

  private calculateDaysUntil(dateString: string): string {
    const target = new Date(dateString);
    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return this.translate.instant('CUSTOM_WIDGET.TODAY_EVENT');
    if (diffDays < 0) return this.translate.instant('CUSTOM_WIDGET.PASSED_EVENT');
    return `${diffDays}d`;
  }

  async openAddWidgetModal() {
    if (!this.currentUser) {
      const alert = await this.alertCtrl.create({
        header: this.translate.instant('HOME.LOGIN_REQUIRED_TITLE'),
        message: this.translate.instant('HOME.LOGIN_REQUIRED_MSG'),
        buttons: [
          { text: this.translate.instant('HOME.CANCEL'), role: 'cancel' },
          { text: this.translate.instant('HOME.LOGIN'), handler: () => this.router.navigate(['/login']) }
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

  getCurrencyFlag(currency: string): string {
    const flags: { [key: string]: string } = {
      'MKD': '🇲🇰', 'USD': '🇺🇸', 'CHF': '🇨🇭', 'GBP': '🇬🇧', 'RSD': '🇷🇸',
      'TRY': '🇹🇷', 'AUD': '🇦🇺', 'CAD': '🇨🇦', 'ALL': '🇦🇱', 'BGN': '🇧🇬'
    };
    return flags[currency] || '🏳️';
  }

  getCurrencyNameLocal(currency: string): string {
    const translationKey = `CURRENCIES.${currency}`;
    const translated = this.translate.instant(translationKey);
    return translated !== translationKey ? translated : currency;
  }

  async fetchDatabaseFuelPrices() {
    try {
      const fuelData = await this.supabaseService.getLatestFuelPrices();
      this.rawDatabaseFuel = fuelData || [];

      if (this.rawDatabaseFuel.length === 0) return;
      this.updateFuelWidgetDisplay();
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

  getCalculatedRateDynamic(targetRate: number): string {
    if (!this.inputMkdAmount || this.inputMkdAmount <= 0) return '0.00';

    const mkdRecord = this.rawDatabaseRates.find((r: any) => r.target_currency === 'MKD');
    const mkdRate = mkdRecord ? mkdRecord.rate : 61.50;

    const eurValue = this.inputMkdAmount / mkdRate;
    const finalValue = eurValue * targetRate;

    return finalValue.toLocaleString('mk-MK', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
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
              value: `${metrics.aqi_value}`,
              unit: metrics.aqi_status_text
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

  Math = Math;

  getUvColor(uvValue: number): string {
    const uv = Math.round(uvValue || 0);
    if (uv <= 2) return '#2a9d8f';
    if (uv <= 5) return '#e9c46a';
    if (uv <= 7) return '#f4a261';
    if (uv <= 10) return '#e76f51';
    return '#d62828';
  }

  getUvStatusText(uvValue: number): string {
    const uv = Math.round(uvValue || 0);
    if (uv <= 2) return this.translate.instant('UV_MODAL.STATUS_LOW');
    if (uv <= 5) return this.translate.instant('UV_MODAL.STATUS_MODERATE');
    if (uv <= 7) return this.translate.instant('UV_MODAL.STATUS_HIGH');
    if (uv <= 10) return this.translate.instant('UV_MODAL.STATUS_VERY_HIGH');
    return this.translate.instant('UV_MODAL.STATUS_EXTREME');
  }

  getUvProtectionAdvice(uvValue: number): string {
    const uv = Math.round(uvValue || 0);
    if (uv <= 2) return this.translate.instant('UV_MODAL.ADVICE_LOW');
    if (uv <= 5) return this.translate.instant('UV_MODAL.ADVICE_MODERATE');
    if (uv <= 7) return this.translate.instant('UV_MODAL.ADVICE_HIGH');
    if (uv <= 10) return this.translate.instant('UV_MODAL.ADVICE_VERY_HIGH');
    return this.translate.instant('UV_MODAL.ADVICE_EXTREME');
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
    if (!this.currentUser) {
      this.visibleWidgets = this.allWidgets.filter(
        widget => widget.id !== 'activity' && widget.id !== 'loyalty' && !widget.isCustom
      );
    } else {
      this.visibleWidgets = [...this.allWidgets];
    }
  }

  getAqiColor(aqiValue: number): string {
    const val = Number(aqiValue);
    if (val <= 50) return '#2a9d8f';
    if (val <= 100) return '#e9c46a';
    if (val <= 150) return '#f4a261';
    if (val <= 200) return '#e76f51';
    return '#d62828';
  }

  changeLanguage(event: any) {
    const selectedLang = event.detail.value;
    this.currentLang = selectedLang;
    this.translate.use(selectedLang);
    this.filterWidgets();
  }

  setDetailModal(isOpen: boolean) {
    this.isDetailModalOpen = isOpen;
    if (!isOpen) {
      this.activeDetailWidgetId = null;
      this.closeLoyaltySubView();
    }
  }

  async fetchDatabaseCurrencyRates() {
    try {
      const ratesData = await this.supabaseService.getLatestCurrencyRates();
      if (!ratesData) return;

      this.rawDatabaseRates = ratesData;
      this.updateCurrencyWidgetDisplay();
    } catch (err) {
      console.error('Failed to resolve currency rates.', err);
    }
  }

  async onWidgetClick(widgetId: string) {
    if ((widgetId === 'activity' || widgetId === 'loyalty') && !this.currentUser) {
      return;
    }

    this.activeDetailWidgetId = widgetId;

    if (widgetId === 'loyalty') {
      this.loyaltyModalView = 'list';
    }

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
    const locale = this.currentLang === 'mk' ? 'mk-MK' : (this.currentLang === 'al' ? 'sq-AL' : 'en-US');
    return d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' });
  }

  ngOnDestroy() {
    if (this.weatherSub) this.weatherSub.unsubscribe();
    if (this.cryptoSub) this.cryptoSub.unsubscribe();
    if (this.tickerIntervalSub) clearInterval(this.tickerIntervalSub);
    this.cryptoService.disconnect();
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
        unit: 'WIDGETS.DAYS_UNIT',
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
        unit: 'WIDGETS.DAYS_UNIT',
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

  getActiveCustomWidget(): Widget | undefined {
    return this.allWidgets.find(w => w.id === this.activeDetailWidgetId && w.isCustom);
  }

  formatDisplayDate(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const locale = this.currentLang === 'mk' ? 'mk-MK' : (this.currentLang === 'al' ? 'sq-AL' : 'en-US');
    return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  async deleteCurrentCustomWidget(widgetId: string) {
    const alert = await this.alertCtrl.create({
      header: this.translate.instant('CUSTOM_WIDGET.DELETE_CONFIRM_TITLE'),
      message: this.translate.instant('CUSTOM_WIDGET.DELETE_CONFIRM_MSG'),
      buttons: [
        { text: this.translate.instant('HOME.CANCEL'), role: 'cancel' },
        {
          text: this.translate.instant('CUSTOM_WIDGET.DELETE_BTN'),
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

  setDefaultFuel(fuelType: string) {
    this.selectedDefaultFuel = fuelType;
    localStorage.setItem('default_fuel_type', fuelType);
    this.updateFuelWidgetDisplay();
  }

  setDefaultCurrency(currencyCode: string) {
    this.selectedDefaultCurrency = currencyCode;
    localStorage.setItem('default_currency', currencyCode);
    this.updateCurrencyWidgetDisplay();
  }

  updateFuelWidgetDisplay() {
    const match = this.rawDatabaseFuel.find(f => f.fuel_type === this.selectedDefaultFuel);
    const displayPrice = match ? match.price_mkd.toFixed(1) : '--.-';

    this.allWidgets = this.allWidgets.map(widget => {
      if (widget.id === 'fuel') {
        return {
          ...widget,
          translationKey: `FUEL_TYPES.${this.selectedDefaultFuel}`,
          value: `${displayPrice}`
        };
      }
      return widget;
    });
    this.filterWidgets();
  }

  updateCurrencyWidgetDisplay() {
    if (this.selectedDefaultCurrency === 'EUR') {
      const mkdRecord = this.rawDatabaseRates.find((r: any) => r.target_currency === 'MKD');
      const eurRate = mkdRecord ? mkdRecord.rate.toFixed(2) : '61.49';

      this.allWidgets = this.allWidgets.map(widget => {
        if (widget.id === 'currency') {
          return { ...widget, translationKey: 'EUR', value: `${eurRate}` };
        }
        return widget;
      });
    } else {
      const targetRecord = this.rawDatabaseRates.find((r: any) => r.target_currency === this.selectedDefaultCurrency);
      const mkdRecord = this.rawDatabaseRates.find((r: any) => r.target_currency === 'MKD');

      if (targetRecord && mkdRecord) {
        const rateToMkd = (mkdRecord.rate / targetRecord.rate).toFixed(2);
        this.allWidgets = this.allWidgets.map(widget => {
          if (widget.id === 'currency') {
            return { ...widget, translationKey: this.selectedDefaultCurrency, value: `${rateToMkd}` };
          }
          return widget;
        });
      }
    }
    this.filterWidgets();
  }

  formatHolidayDateDDMMYYYY(dateStr?: string): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  async fetchHolidays() {
    try {
      this.holidaysList = await this.supabaseService.getHolidays();
      
      if (this.holidaysList && this.holidaysList.length > 0) {
        this.updateHolidayWidgetDisplay();
        this.loadTickerData();

        this.highlightedHolidayDates = this.holidaysList.map(h => ({
          date: h.holiday_date,
          textColor: '#ffffff',
          backgroundColor: h.color_code || '#ef4444'
        }));
      }
    } catch (err) {
      console.error('Error fetching holidays:', err);
    }
  }

  onCalendarDateChange(event: any) {
    const selectedDateStr = event.detail.value.split('T')[0];
    this.selectedHolidayDetail = this.holidaysList.find(h => h.holiday_date === selectedDateStr) || null;
  }

  updateHolidayWidgetDisplay() {
    if (!this.holidaysList || this.holidaysList.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingHoliday = this.holidaysList.find(h => h.holiday_date >= todayStr);

    if (upcomingHoliday) {
      const [year, month, day] = upcomingHoliday.holiday_date.split('-');
      const formattedDate = `${day}.${month}`;

      this.allWidgets = this.allWidgets.map(widget => {
        if (widget.id === 'holidays') {
          return {
            ...widget,
            value: formattedDate
          };
        }
        return widget;
      });

      this.visibleWidgets = this.visibleWidgets.map(widget => {
        if (widget.id === 'holidays') {
          return {
            ...widget,
            value: formattedDate
          };
        }
        return widget;
      });
    }
  }

  startTickerRotation() {
    if (this.tickerIntervalSub) clearInterval(this.tickerIntervalSub);

    this.tickerIntervalSub = setInterval(() => {
      if (this.tickerItems.length > 0) {
        this.currentTickerIndex = (this.currentTickerIndex + 1) % this.tickerItems.length;
      }
    }, 5000);
  }

  async loadTickerData() {
    const combinedItems: TickerItem[] = [];

    const newsFromDb = await this.fetchLatestNewsFromDatabase();
    
    if (newsFromDb.length > 0) {
      combinedItems.push(...newsFromDb);
    } else {
      combinedItems.push({
        id: 'dummy-1',
        type: 'news',
        headerKey: 'TICKER.NEWS_HEADER',
        title: this.translate.instant('TICKER.NEWS_1')
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingHoliday = this.holidaysList.find(h => h.holiday_date >= todayStr);

    if (upcomingHoliday) {
      const holidayTitle = upcomingHoliday[`title_${this.currentLang}`] || upcomingHoliday.title_mk;
      const formattedDate = this.formatHolidayDateDDMMYYYY(upcomingHoliday.holiday_date);

      combinedItems.splice(1, 0, {
        id: `holiday-${upcomingHoliday.id}`,
        type: 'holiday',
        headerKey: 'TICKER.HOLIDAY_HEADER',
        title: `${holidayTitle} (${formattedDate})`
      });
    }

    this.tickerItems = combinedItems;
    this.startTickerRotation();
  }

  async fetchLatestNewsFromDatabase(): Promise<TickerItem[]> {
    try {
      return [];
    } catch (err) {
      return [];
    }
  }

  onTickerItemClick(item: TickerItem) {
    if (!item) return;

    if (item.type === 'holiday') {
      this.onWidgetClick('holidays');
    } else if (item.linkUrl) {
      window.open(item.linkUrl, '_blank');
    }
  }

  getUserInitial(): string {
    if (!this.currentUser) return 'U';
    
    const fullName = this.currentUser.user_metadata?.['full_name'];
    if (fullName && fullName.trim().length > 0) {
      return fullName.trim().charAt(0).toUpperCase();
    }
    
    if (this.currentUser.email && this.currentUser.email.length > 0) {
      return this.currentUser.email.charAt(0).toUpperCase();
    }

    return 'U';
  }

  getCryptoPriceInSelectedCurrency(priceInUsd: number): string {
  let finalPrice = priceInUsd;
  
  if (this.selectedCryptoCurrency === 'MKD') {
    // 1 USD ≈ 52.7 MKD (or dynamically use rawDatabaseRates if available)
    finalPrice = priceInUsd * 52.7;
    return `${Math.round(finalPrice).toLocaleString('mk-MK')} ден.`;
  }
  
  if (this.selectedCryptoCurrency === 'EUR') {
    // 1 USD ≈ 0.86 EUR
    finalPrice = priceInUsd * 0.86;
    return `€${finalPrice > 1000 ? Math.round(finalPrice).toLocaleString('en-US') : finalPrice.toFixed(2)}`;
  }

  return `$${priceInUsd > 1000 ? Math.round(priceInUsd).toLocaleString('en-US') : priceInUsd.toFixed(2)}`;
}

setCryptoDisplayCurrency(currency: 'USD' | 'MKD' | 'EUR') {
  this.selectedCryptoCurrency = currency;
  localStorage.setItem('crypto_display_currency', currency);
  this.updateCryptoWidgetDisplay();
}

formatCompactPrice(price: number, currency: string): string {
  if (!price || isNaN(price)) return '--';

  let converted = price;
  let symbolSuffix = '';
  let prefix = '';

  if (currency === 'MKD') {
    converted = price * 52.7; // 1 USD ≈ 52.7 MKD
    symbolSuffix = ' ден.';
  } else if (currency === 'EUR') {
    converted = price * 0.86; // 1 USD ≈ 0.86 EUR
    prefix = '€';
  } else {
    prefix = '$';
  }

  if (converted >= 1000000) {
    return `${prefix}${(converted / 1000000).toFixed(2)}M${symbolSuffix}`;
  }
  if (converted >= 10000) {
    return `${prefix}${(converted / 1000).toFixed(1)}K${symbolSuffix}`;
  }
  if (converted >= 1000) {
    return `${prefix}${Math.round(converted).toLocaleString('en-US')}${symbolSuffix}`;
  }
  
  return `${prefix}${converted.toFixed(2)}${symbolSuffix}`;
}
}
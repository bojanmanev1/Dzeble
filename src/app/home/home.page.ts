import { Component, inject, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, NgZone } from '@angular/core';
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
import { Capacitor } from '@capacitor/core';
import { StockService, StockTicker } from '../services/stock';
import { HealthData, HealthService } from '../services/health';
import { LoyaltyService, LoyaltyCard } from '../services/loyalty';
import { BarcodeRenderDirective } from '../directives/barcode-render';
import { MACEDONIAN_STORES, StorePreset } from '../config/loyalty-stores.config';
import { App } from '@capacitor/app';
import { PushNotificationService } from '../services/push-notification';

interface Widget {
  id: string;
  translationKey: string;
  value?: string;
  unit: string;
  icon: string;
  customColor?: string;
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
  private pushService = inject(PushNotificationService);
  private zone = inject(NgZone);
  private stockService = inject(StockService);

  private stockSub: Subscription | null = null;
  private weatherSub: Subscription | null = null;
  private cryptoSub: Subscription | null = null;
  private tickerIntervalSub: any = null;
  private widgetRotationIntervalSub: any = null;

  currentYear = new Date().getFullYear();
  minCalendarDate = `${this.currentYear}-01-01`;
  maxCalendarDate = `${this.currentYear + 1}-12-31`;

  selectedCalendarDate: string = new Date().toISOString().split('T')[0];
  selectedHolidayDetail: any = null;
  selectedDateEvents: any[] = [];
  userCalendarEvents: any[] = [];
  newEventTitle: string = '';
  isAddingEventInputOpen: boolean = false;
  showPastEvents: boolean = false;
  selectedStockCurrency: 'USD' | 'MKD' | 'EUR' = (localStorage.getItem('stock_display_currency') as any) || 'USD';
  parsedWeatherData: any = null;
  tickerItems: TickerItem[] = [];
  currentTickerIndex = 0;
  stockSearchQuery: string = '';
  isSearchingStock: boolean = false;
  stockSearchError: string = '';
  isDetailModalOpen = false;
  activeDetailWidgetId: string | null = null;
  inputEuroAmount: number = 1;
  rawDatabaseRates: any[] = [];
  currentUser: User | null = null;
  currentLang = 'mk';
  currentCityName = 'Скопје'; 
  rawDatabaseFuel: any[] = [];

  selectedDefaultFuel = localStorage.getItem('default_fuel_type') || 'Дизел';
  selectedDefaultCurrency = localStorage.getItem('default_currency') || 'EUR';

  // --- MULTI-FAVORITE CRYPTO STATE ---
  cryptoMap = new Map<string, CryptoTicker>();
  favoriteCryptoPairs: string[] = JSON.parse(localStorage.getItem('crypto_favorite_pairs') || '["BTCUSDT"]');
  currentCryptoIndex = 0;

  // --- MULTI-FAVORITE STOCK STATE ---
  stockMap = new Map<string, StockTicker>();
  favoriteStockSymbols: string[] = JSON.parse(localStorage.getItem('stock_favorite_symbols') || '["AAPL"]');
  currentStockIndex = 0;

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
    'tinex': '#D32F2F', 'ramstore': '#E65100', 'vero': '#1976D2', 'neptun': '#0D47A1',
    'sport reality': '#212121', 'sport vision': '#D50000', 'kam': '#FF6F00',
    'stokomak': '#C2185B', 'dm': '#3F51B5', 'cosmo': '#8E24AA'
  };

  private eventColorPalette = ['#8b5cf6', '#06b6d4', '#10b981', '#ec4899', '#6366f1', '#0284c7', '#a855f7'];

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

  stockModalView: 'list' | 'detail' = 'list';
  selectedStockDetail: StockTicker | null = null;
  cryptoSearchQuery: string = '';
  isSearchingCrypto: boolean = false;
  cryptoSearchError: string = '';

  allWidgets: Widget[] = [
    { id: 'aqi', translationKey: 'WIDGETS.AQI', value: '--', unit: 'AQI', icon: 'leaf' },
    { id: 'fuel', translationKey: 'WIDGETS.FUEL', value: '--.-', unit: 'МКД', icon: 'speedometer' },
    { id: 'currency', translationKey: 'WIDGETS.CURRENCY', value: '--.-', unit: 'EUR', icon: 'logo-euro' },
    { id: 'weather', translationKey: 'WIDGETS.WEATHER', value: '--°', unit: '...', icon: 'cloudy' },
    { id: 'crypto', translationKey: '--', value: 'BTC', unit: 'BTC', icon: 'stats-chart' },
    { id: 'stock', translationKey: 'WIDGETS.STOCK', value: 'AAPL', unit: 'AAPL', icon: 'trending-up' },
    { id: 'holidays', translationKey: 'WIDGETS.CALENDAR', value: '--.--', unit: 'Календар', icon: 'calendar-number' },
    { id: 'uv', translationKey: 'WIDGETS.UV', value: '-', unit: 'UV', icon: 'sunny' },
    // { id: 'activity', translationKey: 'WIDGETS.STEPS', value: '0', unit: '0 kcal', icon: 'footsteps' },
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

  async ngOnInit() {
    const localEvents = JSON.parse(localStorage.getItem('guest_user_events') || '[]');
    this.userCalendarEvents = localEvents;
    this.selectedDateEvents = this.userCalendarEvents.filter(e => e.event_date === this.selectedCalendarDate);

    this.supabaseService.currentUser$.subscribe(async (user) => {
      this.currentUser = user;

      if (user) {
        const token = await this.pushService.requestPushPermissionAndRegister();
        await this.supabaseService.syncDeviceRecord(user.id, user.email, token || undefined);
        await this.healthService.requestHealthPermissions();
        await this.syncHealthData(user.id);
        await this.loadLoyaltyCards(user.id);
        await this.loadUserEvents(user.id);
      } else {
        await this.supabaseService.syncDeviceRecord();
        this.combineHighlightedDates();
      }
    });

    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          const cachedToken = this.pushService.getCurrentToken();
          if (this.currentUser) {
            await this.supabaseService.syncDeviceRecord(this.currentUser.id, this.currentUser.email, cachedToken || undefined);
          } else {
            await this.supabaseService.syncDeviceRecord();
          }
        }
      });
    }

    this.fetchHolidays();
    this.fetchLiveMetrics();
    this.fetchDatabaseCurrencyRates();
    this.fetchDatabaseFuelPrices();
    this.initLiveCrypto();
    this.initLiveStock();
    this.startMultiFavoritesSlider();
  }

  // --- 5-SECOND MULTI-FAVORITE WIDGET ROTATOR ---
  startMultiFavoritesSlider() {
    if (this.widgetRotationIntervalSub) clearInterval(this.widgetRotationIntervalSub);

    this.widgetRotationIntervalSub = setInterval(() => {
      this.zone.run(() => {
        // Rotate crypto favorites if user has 2+ favorites
        if (this.favoriteCryptoPairs.length > 1) {
          this.currentCryptoIndex = (this.currentCryptoIndex + 1) % this.favoriteCryptoPairs.length;
          this.updateCryptoWidgetDisplay();
        }

        // Rotate stock favorites if user has 2+ favorites
        if (this.favoriteStockSymbols.length > 1) {
          this.currentStockIndex = (this.currentStockIndex + 1) % this.favoriteStockSymbols.length;
          this.updateStockWidgetDisplay();
        }
      });
    }, 5000);
  }

  // --- CRYPTO STREAMING & FAVORITES ---
  initLiveCrypto() {
    this.cryptoService.connect();
    this.cryptoSub = this.cryptoService.cryptoData$.subscribe((map) => {
      this.zone.run(() => {
        this.cryptoMap = map;
        this.updateCryptoWidgetDisplay();
      });
    });
  }

  isCryptoFavorite(pair: string): boolean {
    return this.favoriteCryptoPairs.includes(pair);
  }

  toggleFavoriteCrypto(pair: string) {
    if (this.isCryptoFavorite(pair)) {
      if (this.favoriteCryptoPairs.length > 1) {
        this.favoriteCryptoPairs = this.favoriteCryptoPairs.filter(p => p !== pair);
      }
    } else {
      this.favoriteCryptoPairs.push(pair);
    }

    localStorage.setItem('crypto_favorite_pairs', JSON.stringify(this.favoriteCryptoPairs));
    this.currentCryptoIndex = 0;
    this.updateCryptoWidgetDisplay();
    this.syncFavoritesToSupabase();
  }

  updateCryptoWidgetDisplay() {
    if (this.favoriteCryptoPairs.length === 0) return;
    const activePair = this.favoriteCryptoPairs[this.currentCryptoIndex % this.favoriteCryptoPairs.length];
    const ticker = this.cryptoMap.get(activePair);
    if (!ticker) return;

    const displayPrice = this.formatCompactPrice(ticker.price, this.selectedCryptoCurrency);

    this.allWidgets = this.allWidgets.map(w => {
      if (w.id === 'crypto') {
        return {
          ...w,
          value: ticker.symbol,
          translationKey: displayPrice
        };
      }
      return w;
    });
    this.filterWidgets();
  }

  getCryptoList(): CryptoTicker[] {
    return Array.from(this.cryptoMap.values());
  }

  // --- STOCK STREAMING & FAVORITES ---
  initLiveStock() {
    this.stockService.connect();
    this.stockSub = this.stockService.stockData$.subscribe((map) => {
      this.zone.run(() => {
        this.stockMap = map;
        this.updateStockWidgetDisplay();
      });
    });
  }

  isStockFavorite(symbol: string): boolean {
    return this.favoriteStockSymbols.includes(symbol);
  }

  toggleFavoriteStock(symbol: string) {
    if (this.isStockFavorite(symbol)) {
      if (this.favoriteStockSymbols.length > 1) {
        this.favoriteStockSymbols = this.favoriteStockSymbols.filter(s => s !== symbol);
      }
    } else {
      this.favoriteStockSymbols.push(symbol);
    }

    localStorage.setItem('stock_favorite_symbols', JSON.stringify(this.favoriteStockSymbols));
    this.currentStockIndex = 0;
    this.updateStockWidgetDisplay();
    this.syncFavoritesToSupabase();
  }

  updateStockWidgetDisplay() {
    if (this.favoriteStockSymbols.length === 0) return;
    const activeSymbol = this.favoriteStockSymbols[this.currentStockIndex % this.favoriteStockSymbols.length];
    const ticker = this.stockMap.get(activeSymbol);
    if (!ticker) return;

    const displayPrice = this.formatStockPrice(ticker.price);

    this.allWidgets = this.allWidgets.map(w => {
      if (w.id === 'stock') {
        return {
          ...w,
          value: ticker.symbol,
          translationKey: displayPrice
        };
      }
      return w;
    });
    this.filterWidgets();
  }

  getStockList(): StockTicker[] {
    return Array.from(this.stockMap.values());
  }

  // --- SYNC MULTIPLE FAVORITES TO SUPABASE USER_DEVICES ---
  async syncFavoritesToSupabase() {
    if (!this.currentUser) return;
    try {
      const deviceId = await this.supabaseService.getDeviceId();
      await this.supabaseService.supabase
        .from('user_devices')
        .update({
          crypto_alert_pairs: this.favoriteCryptoPairs,
          stock_alert_symbols: this.favoriteStockSymbols
        })
        .eq('device_id', deviceId);
      console.log('✅ Updated favorite alerts in DB:', this.favoriteCryptoPairs, this.favoriteStockSymbols);
    } catch (e) {
      console.error('Failed to sync favorites array:', e);
    }
  }

  openSettingsSheet() { this.isSettingsSheetOpen = true; }
  goToLogin() {
    this.isSettingsSheetOpen = false;
    setTimeout(() => this.router.navigate(['/login']), 150);
  }

  toggleDarkMode(event: any) {
    this.isDarkMode = event.detail.checked;
    localStorage.setItem('theme_mode', this.isDarkMode ? 'dark' : 'light');
    document.body.classList.toggle('dark', this.isDarkMode);
  }

async handleLogout() {
  this.isSettingsSheetOpen = false;
  await this.supabaseService.signOut();
  this.filterWidgets();
}

  async loadLoyaltyCards(userId: string) {
    this.loyaltyCards = await this.loyaltyService.getUserCards(userId);
    this.updateLoyaltyWidgetValue();
  }

  updateLoyaltyWidgetValue() {
    this.allWidgets = this.allWidgets.map(widget => {
      if (widget.id === 'loyalty') {
        return { ...widget, value: `${this.loyaltyCards.length}`, unit: 'CARD_UNIT' };
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

  async onAddCryptoSubmit() {
    if (!this.cryptoSearchQuery.trim()) return;
    this.isSearchingCrypto = true;
    this.cryptoSearchError = '';
    const added = await this.cryptoService.addCryptoPair(this.cryptoSearchQuery);
    this.isSearchingCrypto = false;
    if (added) {
      this.cryptoSearchQuery = '';
    } else {
      this.cryptoSearchError = this.translate.instant('CRYPTO_MODAL.SEARCH_ERROR');
    }
  }

  removeCrypto(pair: string, event: Event) {
    event.stopPropagation();
    this.cryptoService.removeCryptoPair(pair);
    this.favoriteCryptoPairs = this.favoriteCryptoPairs.filter(p => p !== pair);
    if (this.favoriteCryptoPairs.length === 0) {
      this.favoriteCryptoPairs = ['BTCUSDT'];
    }
    localStorage.setItem('crypto_favorite_pairs', JSON.stringify(this.favoriteCryptoPairs));
    this.updateCryptoWidgetDisplay();
    this.syncFavoritesToSupabase();
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

  combineHighlightedDates() {
    const holidayHighlights = (this.holidaysList || []).map(h => ({
      date: h.holiday_date,
      textColor: '#ffffff',
      backgroundColor: h.color_code || '#ef4444'
    }));

    const activeUserEvents = this.getActiveUserEvents();
    const userEventHighlights = activeUserEvents.map(e => ({
      date: e.event_date,
      textColor: '#ffffff',
      backgroundColor: e.color_code || '#8b5cf6'
    }));

    this.highlightedHolidayDates = [...holidayHighlights, ...userEventHighlights];
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
    const match = this.findFuelRecord(fuelName);
    if (!match || match.price_mkd === null || match.price_mkd === undefined) return '--.--';
    return Number(match.price_mkd).toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getFuelEffectiveDate(): string {
    if (!this.rawDatabaseFuel || this.rawDatabaseFuel.length === 0) return '--.--.----';
    const recordWithDate = this.rawDatabaseFuel.find(f => f.effective_from);
    return recordWithDate ? recordWithDate.effective_from : '--.--.----';
  }

  getFuelPriceDiff(fuelName: string): number {
    const match = this.findFuelRecord(fuelName);
    if (!match || match.previous_price_mkd === null || match.previous_price_mkd === undefined) return 0;
    const current = Number(match.price_mkd);
    const previous = Number(match.previous_price_mkd);
    return parseFloat((current - previous).toFixed(2));
  }

  getFuelPriceDiffText(fuelName: string): string {
    const diff = this.getFuelPriceDiff(fuelName);
    if (diff === 0) return '';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}`;
  }

  findFuelRecord(fuelName: string): any {
    if (!this.rawDatabaseFuel || this.rawDatabaseFuel.length === 0) return null;
    const target = fuelName.toLowerCase();
    return this.rawDatabaseFuel.find(f => {
      const dbName = (f.fuel_type || '').toLowerCase();
      if (target.includes('95') && dbName.includes('95')) return true;
      if (target.includes('98') && dbName.includes('98')) return true;
      if (target.includes('дизел') && dbName.includes('дизел')) return true;
      if (target.includes('лесно') && dbName.includes('лесно')) return true;
      if (target.includes('мазут') && dbName.includes('мазут')) return true;
      return dbName === target;
    });
  }

  getCalculatedRateDynamic(targetRate: number): string {
    if (!this.inputMkdAmount || this.inputMkdAmount <= 0) return '0.00';
    const mkdRecord = this.rawDatabaseRates.find((r: any) => r.target_currency === 'MKD');
    const mkdRate = mkdRecord ? mkdRecord.rate : 61.50;
    const eurValue = this.inputMkdAmount / mkdRate;
    const finalValue = eurValue * targetRate;
    return finalValue.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  fetchLiveMetrics() {
    this.weatherSub = this.weatherService.getDeviceCoordinates().subscribe({
      next: async (coords: { latitude: number; longitude: number }) => {
        const metrics = await this.supabaseService.getNearestCityMetrics(coords.latitude, coords.longitude);
        if (!metrics) return;

        this.currentCityName = metrics.city_name;
        this.parsedWeatherData = metrics;

        if (this.currentUser) {
          try {
            await this.supabaseService.syncUserWeather({
              userId: this.currentUser.id,
              lat: coords.latitude,
              lng: coords.longitude,
              temp: metrics.current_temp,
              code: metrics.weather_code,
              uv: metrics.uv_index
            });
          } catch (syncErr) {
            console.error('❌ Failed to sync weather coords:', syncErr);
          }
        }

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
            const aqiNum = Number(metrics.aqi_value) || 0;
            return { 
              ...widget, 
              value: `${metrics.aqi_value}`,
              unit: metrics.aqi_status_text,
              customColor: this.getAqiColor(aqiNum)
            };
          }
          return widget;
        });

        this.filterWidgets();
      },
      error: (err: any) => console.error('Device coords error:', err)
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

  getHourlyForecast() { return this.parsedWeatherData?.hourly_forecast || []; }
  getWeeklyForecast() { return this.parsedWeatherData?.weekly_forecast || []; }

filterWidgets() {
  if (!this.currentUser) {
    this.visibleWidgets = this.allWidgets.filter(
      widget => widget.id !== 'activity' && widget.id !== 'loyalty'
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
    if ((widgetId === 'activity' || widgetId === 'loyalty') && !this.currentUser) return;

    this.activeDetailWidgetId = widgetId;
    if (widgetId === 'loyalty') this.loyaltyModalView = 'list';
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

  getRandomEventColor(): string {
    return this.eventColorPalette[Math.floor(Math.random() * this.eventColorPalette.length)];
  }

  togglePastEventsView() { this.showPastEvents = !this.showPastEvents; }

  formatHistoryDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const locale = this.currentLang === 'mk' ? 'mk-MK' : (this.currentLang === 'al' ? 'sq-AL' : 'en-US');
    return d.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' });
  }

  openStockDetail(stock: StockTicker) {
    this.selectedStockDetail = stock;
    this.stockModalView = 'detail';
  }

  closeStockDetail() {
    this.stockModalView = 'list';
    this.selectedStockDetail = null;
  }

  ngOnDestroy() {
    if (this.weatherSub) this.weatherSub.unsubscribe();
    if (this.cryptoSub) this.cryptoSub.unsubscribe();
    if (this.stockSub) this.stockSub.unsubscribe();
    if (this.tickerIntervalSub) clearInterval(this.tickerIntervalSub);
    if (this.widgetRotationIntervalSub) clearInterval(this.widgetRotationIntervalSub);
    this.cryptoService.disconnect();
    this.stockService.disconnect();
  }

  async onAddStockSubmit() {
    if (!this.stockSearchQuery.trim()) return;
    this.isSearchingStock = true;
    this.stockSearchError = '';
    const added = await this.stockService.addStockSymbol(this.stockSearchQuery);
    this.isSearchingStock = false;
    if (added) {
      this.stockSearchQuery = '';
    } else {
      this.stockSearchError = this.translate.instant('STOCK_MODAL.SEARCH_ERROR');
    }
  }

  removeStock(symbol: string, event: Event) {
    event.stopPropagation();
    this.stockService.removeStockSymbol(symbol);
    this.favoriteStockSymbols = this.favoriteStockSymbols.filter(s => s !== symbol);
    if (this.favoriteStockSymbols.length === 0) {
      this.favoriteStockSymbols = ['AAPL'];
    }
    localStorage.setItem('stock_favorite_symbols', JSON.stringify(this.favoriteStockSymbols));
    this.updateStockWidgetDisplay();
    this.syncFavoritesToSupabase();
  }


  formatDisplayDate(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const locale = this.currentLang === 'mk' ? 'mk-MK' : (this.currentLang === 'al' ? 'sq-AL' : 'en-US');
    return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }


  setStockDisplayCurrency(currency: 'USD' | 'MKD' | 'EUR') {
    this.selectedStockCurrency = currency;
    localStorage.setItem('stock_display_currency', currency);
    this.updateStockWidgetDisplay();
  }

  formatStockPrice(priceInUsd: number): string {
    if (!priceInUsd || isNaN(priceInUsd)) return '--';
    let converted = priceInUsd;
    let suffix = '';
    let prefix = '';
    if (this.selectedStockCurrency === 'MKD') {
      converted = priceInUsd * 52.7;
      suffix = ' ден.';
    } else if (this.selectedStockCurrency === 'EUR') {
      converted = priceInUsd * 0.86;
      prefix = '€';
    } else {
      prefix = '$';
    }
    return `${prefix}${converted.toFixed(2)}${suffix}`;
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
    const match = this.findFuelRecord(this.selectedDefaultFuel);
    const displayPrice = match ? Number(match.price_mkd).toFixed(1) : '--.-';
    const diff = this.getFuelPriceDiff(this.selectedDefaultFuel);
    let arrow = '';
    if (diff > 0) arrow = ' 🔺';
    if (diff < 0) arrow = ' 🔻';

    this.allWidgets = this.allWidgets.map(widget => {
      if (widget.id === 'fuel') {
        return {
          ...widget,
          translationKey: `FUEL_TYPES.${this.selectedDefaultFuel}`,
          value: `${displayPrice}${arrow}`
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
        if (widget.id === 'currency') return { ...widget, translationKey: 'EUR', value: `${eurRate}` };
        return widget;
      });
    } else {
      const targetRecord = this.rawDatabaseRates.find((r: any) => r.target_currency === this.selectedDefaultCurrency);
      const mkdRecord = this.rawDatabaseRates.find((r: any) => r.target_currency === 'MKD');
      if (targetRecord && mkdRecord) {
        const rateToMkd = (mkdRecord.rate / targetRecord.rate).toFixed(2);
        this.allWidgets = this.allWidgets.map(widget => {
          if (widget.id === 'currency') return { ...widget, translationKey: this.selectedDefaultCurrency, value: `${rateToMkd}` };
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

  async onCalendarDateChange(event: any) {
    const selectedDateStr = event.detail.value.split('T')[0];
    this.selectedCalendarDate = selectedDateStr;
    this.selectedHolidayDetail = this.holidaysList.find(h => h.holiday_date === selectedDateStr) || null;
    this.selectedDateEvents = this.userCalendarEvents.filter(e => e.event_date === selectedDateStr);
  }

  async loadUserEvents(userId: string) {
    try {
      const rawEvents = await this.supabaseService.getUserWidgets(userId);
      this.userCalendarEvents = rawEvents.map((e: any, index: number) => ({
        ...e,
        color_code: e.icon || this.eventColorPalette[index % this.eventColorPalette.length]
      }));
      this.combineHighlightedDates();
      this.selectedDateEvents = this.userCalendarEvents.filter(e => e.event_date === this.selectedCalendarDate);
    } catch (err) {
      console.error('Failed to load user events:', err);
    }
  }

  async addEventForSelectedDate() {
    if (!this.newEventTitle.trim() || !this.currentUser) return;
    const randomColor = this.getRandomEventColor();
    try {
      await this.supabaseService.addUserWidget(
        this.currentUser.id,
        this.newEventTitle.trim(),
        this.selectedCalendarDate,
        randomColor
      );
      await this.loadUserEvents(this.currentUser.id);
      this.newEventTitle = '';
      this.isAddingEventInputOpen = false;
    } catch (err) {
      console.error('Failed to save event:', err);
    }
  }

  toggleAddEventForm() {
    if (!this.currentUser) return;
    this.isAddingEventInputOpen = !this.isAddingEventInputOpen;
  }

  async deleteUserEvent(eventId: string) {
    if (!this.currentUser) return;
    try {
      await this.supabaseService.deleteUserWidget(eventId);
      await this.loadUserEvents(this.currentUser.id);
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  }

  updateHolidayWidgetDisplay() {
    if (!this.holidaysList || this.holidaysList.length === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingHoliday = this.holidaysList.find(h => h.holiday_date >= todayStr);

    if (upcomingHoliday) {
      const [year, month, day] = upcomingHoliday.holiday_date.split('-');
      const formattedDate = `${day}.${month}`;

      this.allWidgets = this.allWidgets.map(widget => {
        if (widget.id === 'holidays') return { ...widget, value: formattedDate };
        return widget;
      });
      this.visibleWidgets = this.visibleWidgets.map(widget => {
        if (widget.id === 'holidays') return { ...widget, value: formattedDate };
        return widget;
      });
    }
  }

  isDateInPast(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    return targetDate < today;
  }

  getActiveUserEvents(): any[] { return this.userCalendarEvents.filter(e => !this.isDateInPast(e.event_date)); }
  getPastUserEvents(): any[] { return this.userCalendarEvents.filter(e => this.isDateInPast(e.event_date)); }

  async cleanupPastEvents() {
    if (!this.currentUser) return;
    const pastEvents = this.getPastUserEvents();
    for (const event of pastEvents) {
      try {
        await this.supabaseService.deleteUserWidget(event.id);
      } catch (err) {
        console.error(`Failed to delete past event ${event.id}:`, err);
      }
    }
    await this.loadUserEvents(this.currentUser.id);
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

  async fetchLatestNewsFromDatabase(): Promise<TickerItem[]> { return []; }

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
    if (fullName && fullName.trim().length > 0) return fullName.trim().charAt(0).toUpperCase();
    if (this.currentUser.email && this.currentUser.email.length > 0) return this.currentUser.email.charAt(0).toUpperCase();
    return 'U';
  }

  getCryptoPriceInSelectedCurrency(priceInUsd: number): string {
    let finalPrice = priceInUsd;
    if (this.selectedCryptoCurrency === 'MKD') {
      finalPrice = priceInUsd * 52.7;
      return `${Math.round(finalPrice).toLocaleString('mk-MK')} ден.`;
    }
    if (this.selectedCryptoCurrency === 'EUR') {
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
      converted = price * 52.7;
      symbolSuffix = ' ден.';
    } else if (currency === 'EUR') {
      converted = price * 0.86;
      prefix = '€';
    } else {
      prefix = '$';
    }

    if (converted >= 1000000) return `${prefix}${(converted / 1000000).toFixed(2)}M${symbolSuffix}`;
    if (converted >= 10000) return `${prefix}${(converted / 1000).toFixed(1)}K${symbolSuffix}`;
    if (converted >= 1000) return `${prefix}${Math.round(converted).toLocaleString('en-US')}${symbolSuffix}`;
    return `${prefix}${converted.toFixed(2)}${symbolSuffix}`;
  }

  // 1. Add notification state map
notificationPreferences: Record<string, boolean> = JSON.parse(
  localStorage.getItem('widget_notification_prefs') || 
  '{"weather":true,"fuel":true,"stock":true,"crypto":true,"holidays":true}'
);

// 2. Check if a widget supports notification toggles
supportsNotification(widgetId: string): boolean {
  return ['weather', 'fuel', 'stock', 'crypto', 'holidays'].includes(widgetId);
}

// 3. Toggle handler (stops click propagation so it doesn't open the detail modal)
toggleWidgetNotification(widgetId: string, event: Event) {
  event.stopPropagation();
  const currentVal = this.notificationPreferences[widgetId] ?? true;
  const newVal = !currentVal;
  
  this.notificationPreferences[widgetId] = newVal;
  localStorage.setItem('widget_notification_prefs', JSON.stringify(this.notificationPreferences));

  // Sync to backend DB
  this.supabaseService.updateNotificationPreference(widgetId, newVal);
}

isNotificationActive(widgetId: string): boolean {
  return this.notificationPreferences[widgetId] ?? true;
}
}
import { Component, inject, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, NgZone, ChangeDetectorRef, HostListener } from '@angular/core';
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
  logoUsd,
  cashOutline,
  speedometer, 
  sunny, 
  partlySunny,
  rainy,
  snow,
  thunderstorm,
  moon,
  cloudyNight,
  calendarNumber, 
  gift, 
  notifications, 
  notificationsOffOutline,
  checkmarkCircleOutline,
  footsteps,
  card,
  personOutline,
  statsChart,
  trendingUp,
  chevronDownOutline,
  chevronUpOutline,
  lockClosed,
  close,
  chevronBack,
  chevronForward,
  add,
  refreshOutline,
  checkmark
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
import { MACEDONIAN_STORES, StorePreset, CARD_GRADIENT_PALETTE } from '../config/loyalty-stores.config';
import { App } from '@capacitor/app';
import { PushNotificationService } from '../services/push-notification';

interface Widget {
  id: string;
  translationKey: string;
  value?: string;
  unit: string;
  icon: string;
  customColor?: string;
  weatherEmoji?: string;
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

import { ThemeService } from '../services/theme';

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
  public themeService = inject(ThemeService);
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
  private cdr = inject(ChangeDetectorRef);

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
  currentCityName: string = localStorage.getItem('user_current_city') || 'Скопје'; 
  isLocatingCity: boolean = false;
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
  isDarkMode = this.themeService.isDark();

  newWidgetTitle = '';
  newWidgetDate: string = new Date().toISOString();
  inputMkdAmount: number = 100;
  todayHealthData: HealthData = { 
    steps: parseInt(localStorage.getItem('dzeble_today_steps') || '0', 10), 
    calories: Math.round(parseInt(localStorage.getItem('dzeble_today_steps') || '0', 10) * 0.04), 
    distanceKm: parseFloat((parseInt(localStorage.getItem('dzeble_today_steps') || '0', 10) * 0.000762).toFixed(2)) 
  };
  last7DaysHealth: any[] = [];
  notified10k = false;
  notified15k = false;
  private healthSyncDebounceTimeout: any = null;
  isAuthPromptModalOpen = false;
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
  cardGradientPalette = CARD_GRADIENT_PALETTE;
  newCardStore: string = 'Tinex';
  newCustomStoreName: string = '';
  newBarcodeData: string = '';
  newBarcodeFormat: string = 'CODE128';
  newCardColor: string = 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)';
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
    { id: 'weather', translationKey: 'WIDGETS.WEATHER', value: '--°', unit: '...', icon: 'cloudy', weatherEmoji: '⛅' },
    { id: 'crypto', translationKey: '--', value: 'BTC', unit: 'BTC', icon: 'stats-chart' },
    { id: 'stock', translationKey: 'WIDGETS.STOCK', value: 'AAPL', unit: 'AAPL', icon: 'trending-up' },
    { id: 'holidays', translationKey: 'WIDGETS.CALENDAR', value: '--.--', unit: 'Календар', icon: 'calendar-number' },
    { id: 'uv', translationKey: 'WIDGETS.UV', value: '-', unit: 'UV', icon: 'sunny' },
    { 
      id: 'activity', 
      translationKey: 'WIDGETS.STEPS', 
      value: parseInt(localStorage.getItem('dzeble_today_steps') || '0', 10).toLocaleString('mk-MK'), 
      unit: `${Math.round(parseInt(localStorage.getItem('dzeble_today_steps') || '0', 10) * 0.04)} kcal`, 
      icon: 'footsteps' 
    },
    { id: 'loyalty', translationKey: 'WIDGETS.LOYALTY', value: '0', unit: 'CARD_UNIT', icon: 'card' }
  ];

  readonly DEFAULT_WIDGET_IDS: string[] = ['aqi', 'fuel', 'currency', 'weather', 'crypto', 'stock', 'holidays', 'uv', 'activity'];
  readonly STORAGE_WIDGET_ORDER_KEY = 'dzeble_user_widget_ids';

  activeWidgetIds: string[] = [];
  visibleWidgets: Widget[] = [];
  isHealthPermGranted: boolean = true;

  // Widget Edit & Drag-and-Drop State
  isWidgetEditMode: boolean = false;
  draggedWidgetId: string | null = null;
  dragStartX: number = 0;
  dragStartY: number = 0;
  dragCurrentX: number = 0;
  dragCurrentY: number = 0;
  isDragging: boolean = false;
  private lastSwapTime: number = 0;
  private activePointerId: number | null = null;
  private activePointerTarget: HTMLElement | null = null;

  // 1-Second Long Press Tracking
  private longPressTimer: any = null;
  longPressTriggered: boolean = false;
  private touchStartX: number = 0;
  private touchStartY: number = 0;

  constructor() {
    const savedLang = localStorage.getItem('app_language') || 'mk';
    this.currentLang = savedLang;
    this.translate.use(savedLang);

    addIcons({ 
      'leaf': leaf,
      'cloudy': cloudy,
      'logo-euro': logoEuro,
      'logo-usd': logoUsd,
      'cash-outline': cashOutline,
      'speedometer': speedometer,
      'sunny': sunny,
      'partly-sunny': partlySunny,
      'rainy': rainy,
      'snow': snow,
      'thunderstorm': thunderstorm,
      'moon': moon,
      'cloudy-night': cloudyNight,
      'calendar-number': calendarNumber,
      'gift': gift,
      'notifications': notifications,
      'notifications-off-outline': notificationsOffOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'footsteps': footsteps,
      'card': card,
      'person-outline': personOutline,
      'stats-chart': statsChart,
      'trending-up': trendingUp,
      'chevron-down-outline': chevronDownOutline,
      'chevron-up-outline': chevronUpOutline,
      'lock-closed': lockClosed,
      'close': close,
      'chevron-back': chevronBack,
      'chevron-forward': chevronForward,
      'add': add,
      'refresh-outline': refreshOutline,
      'checkmark': checkmark
    });

    this.loadSavedWidgetOrder();
    this.syncVisibleWidgets();
  }

  async ngOnInit() {
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    const localEvents = JSON.parse(localStorage.getItem('guest_user_events') || '[]');
    this.userCalendarEvents = localEvents;
    this.selectedDateEvents = this.userCalendarEvents.filter(e => e.event_date === this.selectedCalendarDate);
    this.updateCurrencyWidgetDisplay();

    // Hydrate cached weather metrics immediately so frame 1 has city and weather
    const cachedWeather = localStorage.getItem('cached_weather_metrics');
    if (cachedWeather) {
      try {
        const parsed = JSON.parse(cachedWeather);
        if (parsed) {
          this.parsedWeatherData = parsed;
          this.applyWeatherMetricsToWidgets(parsed);
        }
      } catch {}
    }

    await this.initHealthTracking();
    this.healthService.setLanguage(this.currentLang);

    this.supabaseService.currentUser$.subscribe(async (user) => {
      this.currentUser = user;
      this.healthService.setUserLoggedIn(!!user);

      if (user) {
        // 1. Immediately restore today's steps from Supabase if available (e.g. after fresh reinstall)
        try {
          const remoteToday = await this.supabaseService.getTodayHealthMetrics(user.id);
          if (remoteToday && remoteToday.step_count > 0) {
            const restored = await this.healthService.restoreStepsFromDatabase(remoteToday.step_count);
            this.todayHealthData = restored;
            this.updateActivityWidgetDisplay(restored);
            this.cdr.markForCheck();
          }
        } catch (e) {
          console.warn('Could not restore steps from cloud on login:', e);
        }

        const token = await this.pushService.requestPushPermissionAndRegister();
        await this.supabaseService.syncDeviceRecord(user.id, user.email, token || undefined);
        await this.syncHealthData(user.id);
        const remoteHistory = await this.supabaseService.getLast7DaysHealthMetrics(user.id);
        if (remoteHistory && remoteHistory.length > 0) {
          this.last7DaysHealth = remoteHistory;
          await this.healthService.syncHistoryFromRemote(remoteHistory);
        }
        await this.loadLoyaltyCards(user.id);
        await this.loadUserEvents(user.id);
      } else {
        await this.supabaseService.syncDeviceRecord();
        this.combineHighlightedDates();
      }
      this.filterWidgets();
      this.cdr.markForCheck();
    });

    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          this.zone.run(async () => {
            // Immediately fetch and display fresh steps on frame 1
            const freshSteps = await this.healthService.getTodayDeviceSteps();
            this.todayHealthData = freshSteps;
            this.updateActivityWidgetDisplay(freshSteps);
            this.cdr.markForCheck();

            const cachedToken = this.pushService.getCurrentToken();
            if (this.currentUser) {
              await this.supabaseService.syncDeviceRecord(this.currentUser.id, this.currentUser.email, cachedToken || undefined);
              await this.syncHealthData(this.currentUser.id);
            } else {
              await this.supabaseService.syncDeviceRecord();
            }
          });
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
    const isDark = event.detail.checked;
    this.isDarkMode = isDark;
    this.themeService.toggleTheme(isDark);
  }

async handleLogout() {
  this.isSettingsSheetOpen = false;
  this.healthService.setUserLoggedIn(false);
  await this.supabaseService.signOut();
  this.filterWidgets();
  this.cdr.markForCheck();
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

  getCardGradient(card: LoyaltyCard | null | undefined): string {
    if (!card) return 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';

    const cleanName = (card.store_name || '').trim().toLowerCase();

    // 1. Match against known presets (e.g. Zhito, Forever friends, Alfi, Tinex, Vero, DM...)
    const match = MACEDONIAN_STORES.find(s => 
      cleanName.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(cleanName)
    );
    if (match) {
      return match.gradient;
    }

    // 2. If card_color is explicitly saved as a gradient
    if (card.card_color && card.card_color.startsWith('linear-gradient')) {
      return card.card_color;
    }

    // 3. If card_color is custom hex, create high-end gradient
    if (card.card_color && card.card_color.startsWith('#') && card.card_color !== '#1e293b') {
      return `linear-gradient(135deg, ${card.card_color} 0%, rgba(15, 23, 42, 0.85) 100%)`;
    }

    // 4. Deterministic luxury palette gradient by hashing store name
    let hash = 0;
    for (let i = 0; i < cleanName.length; i++) {
      hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % CARD_GRADIENT_PALETTE.length;
    return CARD_GRADIENT_PALETTE[idx].gradient;
  }

  getCardEmoji(card: LoyaltyCard | null | undefined): string {
    if (!card) return '💳';
    const cleanName = (card.store_name || '').trim().toLowerCase();
    const match = MACEDONIAN_STORES.find(s => 
      cleanName.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(cleanName)
    );
    return match ? match.emoji : '💳';
  }

  onStoreNameInput() {
    const cleanName = this.newCustomStoreName.trim().toLowerCase();
    const match = MACEDONIAN_STORES.find(s => 
      cleanName.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(cleanName)
    );
    if (match) {
      this.newCardColor = match.gradient;
    } else {
      let hash = 0;
      for (let i = 0; i < cleanName.length; i++) {
        hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
      }
      const idx = Math.abs(hash) % CARD_GRADIENT_PALETTE.length;
      this.newCardColor = CARD_GRADIENT_PALETTE[idx].gradient;
    }
  }

  selectStorePreset(store: StorePreset) {
    this.newCustomStoreName = store.name;
    this.newCardColor = store.gradient;
  }

  selectColorPreset(gradient: string) {
    this.newCardColor = gradient;
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

  async initHealthTracking() {
    this.healthService.currentHealth$.subscribe(data => {
      this.todayHealthData = data;
      this.updateActivityWidgetDisplay(data);

      if (this.currentUser) {
        if (this.healthSyncDebounceTimeout) {
          clearTimeout(this.healthSyncDebounceTimeout);
        }
        this.healthSyncDebounceTimeout = setTimeout(() => {
          if (this.currentUser) {
            this.syncHealthData(this.currentUser.id);
          }
        }, 15000);
      }
    });

    const localHistory = await this.healthService.getLocal7DaysHistory();
    this.last7DaysHealth = localHistory;

    const initialSteps = await this.healthService.getTodayDeviceSteps();
    this.todayHealthData = initialSteps;
    this.updateActivityWidgetDisplay(initialSteps);

    if (Capacitor.isNativePlatform()) {
      const permCheck = await this.healthService.checkHealthPermissions();
      this.isHealthPermGranted = permCheck.granted;

      // After sequential permissions complete in AppComponent, refresh status and steps
      setTimeout(async () => {
        const recheck = await this.healthService.checkHealthPermissions();
        this.isHealthPermGranted = recheck.granted;
        if (recheck.granted) {
          const fresh = await this.healthService.getTodayDeviceSteps();
          this.todayHealthData = fresh;
          this.updateActivityWidgetDisplay(fresh);
        }
      }, 800);
    }
  }

  async promptHealthPermission() {
    const granted = await this.healthService.requestHealthPermissions();
    this.isHealthPermGranted = granted;
    if (granted) {
      await this.healthService.startContinuousPedometer();
      const refreshed = await this.healthService.getTodayDeviceSteps();
      this.todayHealthData = refreshed;
      this.updateActivityWidgetDisplay(refreshed);
    }
  }

  updateActivityWidgetDisplay(data: HealthData) {
    this.zone.run(() => {
      this.allWidgets = this.allWidgets.map(widget => {
        if (widget.id === 'activity') {
          return {
            ...widget,
            value: (data.steps || 0).toLocaleString('mk-MK'),
            unit: `${data.calories || 0} kcal`
          };
        }
        return widget;
      });
      this.filterWidgets();
      this.cdr.markForCheck();
    });
  }

  getStepsProgressPercent(): number {
    const steps = this.todayHealthData?.steps || 0;
    return Math.min(100, Math.round((steps / 10000) * 100));
  }

  getMilestonesStatus() {
    return this.healthService.getMilestonesStatus();
  }

  async syncHealthData(userId: string) {
    const data = await this.healthService.getTodayDeviceSteps();
    this.todayHealthData = data;
    this.updateActivityWidgetDisplay(data);

    const milestones = this.healthService.getMilestonesStatus();
    const synced = await this.supabaseService.syncTodayHealthMetrics(userId, {
      steps: data.steps,
      calories: data.calories,
      distanceKm: data.distanceKm,
      notified5k: milestones.reached5k,
      notified10k: milestones.reached10k,
      notified15k: milestones.reached15k
    });

    if (synced && synced.step_count > data.steps) {
      // Remote had higher steps (e.g. reinstall or other device), restore locally
      const restored = await this.healthService.restoreStepsFromDatabase(synced.step_count);
      this.todayHealthData = restored;
      this.updateActivityWidgetDisplay(restored);
      this.cdr.markForCheck();
    }

    const localHistory = await this.healthService.getLocal7DaysHistory();
    if (localHistory && localHistory.length > 0) {
      await this.supabaseService.syncHealthHistory(userId, localHistory);
    }
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
      'EUR': '🇪🇺', 'MKD': '🇲🇰', 'USD': '🇺🇸', 'CHF': '🇨🇭', 'GBP': '🇬🇧', 'RSD': '🇷🇸',
      'TRY': '🇹🇷', 'AUD': '🇦🇺', 'CAD': '🇨🇦', 'ALL': '🇦🇱', 'BGN': '🇧🇬'
    };
    return flags[currency] || currency;
  }

  getCurrencyIonicIcon(currency: string): string {
    switch ((currency || '').toUpperCase()) {
      case 'USD': return 'logo-usd';
      case 'EUR': return 'logo-euro';
      default: return 'cash-outline';
    }
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
    this.isLocatingCity = true;
    this.weatherSub = this.weatherService.getDeviceCoordinates().subscribe({
      next: async (coords: { latitude: number; longitude: number }) => {
        // 1. Instantly determine nearest city locally in memory (0ms)
        const resolvedCity = this.weatherService.resolveCityName(coords.latitude, coords.longitude);
        if (resolvedCity) {
          this.currentCityName = resolvedCity;
          localStorage.setItem('user_current_city', resolvedCity);
        }

        // 2. Fetch fresh cached metrics from Supabase for this city
        let metrics = await this.supabaseService.getCachedMetricsForCity(resolvedCity);
        if (!metrics) {
          metrics = await this.supabaseService.getNearestCityMetrics(coords.latitude, coords.longitude);
        }

        this.isLocatingCity = false;
        if (!metrics) return;

        this.currentCityName = metrics.city_name;
        this.parsedWeatherData = metrics;
        localStorage.setItem('user_current_city', metrics.city_name);
        try {
          localStorage.setItem('cached_weather_metrics', JSON.stringify(metrics));
        } catch {}

        this.supabaseService.updateDeviceCityPreference(metrics.city_name);

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

        this.applyWeatherMetricsToWidgets(metrics);
      },
      error: (err: any) => {
        this.isLocatingCity = false;
        console.error('Device coords error:', err);
      }
    });
  }

  applyWeatherMetricsToWidgets(metrics: any) {
    if (!metrics) return;

    const weatherIcon = this.weatherService.getWeatherIonicIcon(metrics.weather_code, metrics.is_day);
    const weatherColor = this.weatherService.getWeatherIonicColor(metrics.weather_code, metrics.is_day);
    const weatherEmoji = this.weatherService.getWeatherIcon(metrics.weather_code, metrics.is_day);

    this.allWidgets = this.allWidgets.map(widget => {
      if (widget.id === 'weather') {
        return { 
          ...widget, 
          value: `${Math.round(metrics.current_temp)}°`, 
          unit: this.weatherService.getWeatherDesc(metrics.weather_code),
          icon: weatherIcon,
          customColor: weatherColor,
          weatherEmoji: weatherEmoji
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

    this.visibleWidgets = this.visibleWidgets.map(widget => {
      if (widget.id === 'weather') {
        return {
          ...widget,
          value: `${Math.round(metrics.current_temp)}°`,
          unit: this.weatherService.getWeatherDesc(metrics.weather_code),
          icon: weatherIcon,
          customColor: weatherColor,
          weatherEmoji: weatherEmoji
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
    const list = this.parsedWeatherData?.hourly_forecast;
    if (!Array.isArray(list) || list.length === 0) return [];

    const nowHour = new Date().getHours();

    const curIndex = list.findIndex(item => {
      if (item.rawTime) {
        const itemHour = parseInt(item.rawTime.split('T')[1]?.substring(0, 2), 10);
        return itemHour === nowHour;
      }
      if (item.hour !== undefined) {
        return item.hour === nowHour;
      }
      if (item.time && item.time !== 'Сега') {
        const itemHour = parseInt(item.time.split(':')[0], 10);
        return itemHour === nowHour;
      }
      return false;
    });

    if (curIndex > 0) {
      const sliced = list.slice(curIndex).map((item, idx) => ({
        ...item,
        time: idx === 0 ? 'Сега' : (item.time === 'Сега' ? (item.rawTime ? item.rawTime.split('T')[1]?.substring(0, 5) : `${item.hour ?? ''}:00`) : item.time)
      }));
      return sliced.slice(0, 12);
    }

    return list.slice(0, 12);
  }
  getWeeklyForecast() { return this.parsedWeatherData?.weekly_forecast || []; }

  getTodayWeatherHigh(): number | null {
    const today = (this.parsedWeatherData?.weekly_forecast || []).find((d: any) => d.day === 'Денес' || d.isToday) || this.parsedWeatherData?.weekly_forecast?.[0];
    if (today?.max != null) return today.max;
    if (typeof today?.temps === 'string') {
      const match = today.temps.match(/([0-9.-]+)°/);
      if (match) return Math.round(parseFloat(match[1]));
    }
    return this.parsedWeatherData ? Math.round(this.parsedWeatherData.current_temp) : null;
  }

  getTodayWeatherLow(): number | null {
    const today = (this.parsedWeatherData?.weekly_forecast || []).find((d: any) => d.day === 'Денес' || d.isToday) || this.parsedWeatherData?.weekly_forecast?.[0];
    if (today?.min != null) return today.min;
    if (typeof today?.temps === 'string') {
      const parts = today.temps.split('/');
      if (parts[1]) {
        const match = parts[1].match(/([0-9.-]+)°/);
        if (match) return Math.round(parseFloat(match[1]));
      }
    }
    return null;
  }

  getWeatherFeelsLike(): number | null {
    const hourly = this.parsedWeatherData?.hourly_forecast;
    if (Array.isArray(hourly)) {
      for (const h of hourly) {
        if (h?.apparent_temp != null && !isNaN(h.apparent_temp)) return Math.round(h.apparent_temp);
      }
    }
    return this.parsedWeatherData ? Math.round(this.parsedWeatherData.current_temp) : null;
  }

  getWeatherHumidity(): number | null {
    const hourly = this.parsedWeatherData?.hourly_forecast;
    if (Array.isArray(hourly)) {
      for (const h of hourly) {
        if (h?.humidity != null && !isNaN(h.humidity)) return Math.round(h.humidity);
      }
    }
    return null;
  }

  getWeatherWindSpeed(): number | null {
    const hourly = this.parsedWeatherData?.hourly_forecast;
    if (Array.isArray(hourly)) {
      for (const h of hourly) {
        if (h?.wind != null && !isNaN(h.wind)) return Math.round(h.wind);
      }
    }
    return null;
  }

  getWeatherCurrentIcon(): string {
    if (!this.parsedWeatherData) return '⛅';
    return this.weatherService.getWeatherIcon(this.parsedWeatherData.weather_code, this.parsedWeatherData.is_day);
  }

  getWeatherCurrentIonicIcon(): string {
    if (!this.parsedWeatherData) return 'cloudy';
    return this.weatherService.getWeatherIonicIcon(this.parsedWeatherData.weather_code, this.parsedWeatherData.is_day);
  }

  getWeatherCurrentIonicColor(): string {
    if (!this.parsedWeatherData) return '#64748b';
    return this.weatherService.getWeatherIonicColor(this.parsedWeatherData.weather_code, this.parsedWeatherData.is_day);
  }

  getWeatherConditionText(): string {
    if (!this.parsedWeatherData) return '';
    return this.weatherService.getWeatherDesc(this.parsedWeatherData.weather_code);
  }


  loadSavedWidgetOrder() {
    try {
      const saved = localStorage.getItem(this.STORAGE_WIDGET_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validIds = parsed.filter(id => this.allWidgets.some(w => w.id === id));
          const uniqueIds = Array.from(new Set(validIds)).slice(0, 9);
          if (uniqueIds.length > 0) {
            this.activeWidgetIds = uniqueIds;
            return;
          }
        }
      }
    } catch (e) {}

    // Default 9 widgets layout
    this.activeWidgetIds = [...this.DEFAULT_WIDGET_IDS];
  }

  saveWidgetOrder() {
    try {
      localStorage.setItem(this.STORAGE_WIDGET_ORDER_KEY, JSON.stringify(this.activeWidgetIds.slice(0, 9)));
    } catch (e) {}
  }

  syncVisibleWidgets() {
    if (!this.activeWidgetIds || this.activeWidgetIds.length === 0) {
      this.loadSavedWidgetOrder();
    }
    this.visibleWidgets = this.activeWidgetIds
      .slice(0, 9)
      .map(id => this.allWidgets.find(w => w.id === id)!)
      .filter(Boolean);
  }

  filterWidgets() {
    this.syncVisibleWidgets();
  }

  getAvailableWidgets(): Widget[] {
    return this.allWidgets.filter(w => !this.activeWidgetIds.includes(w.id));
  }

  getEmptySlotsCount(): number[] {
    const emptyCount = Math.max(0, 9 - this.visibleWidgets.length);
    return Array(emptyCount).fill(0);
  }

  enterWidgetEditMode() {
    this.isWidgetEditMode = true;
    this.triggerHaptic(50);
    this.cdr.markForCheck();
  }

  exitWidgetEditMode() {
    this.isWidgetEditMode = false;
    this.draggedWidgetId = null;
    this.isDragging = false;
    this.cancelLongPress();
    this.triggerHaptic(30);
    this.cdr.markForCheck();
  }

  toggleWidgetEditMode() {
    if (this.isWidgetEditMode) {
      this.exitWidgetEditMode();
    } else {
      this.enterWidgetEditMode();
    }
  }

  removeWidget(widgetId: string, event?: Event) {
    if (event) event.stopPropagation();
    this.activeWidgetIds = this.activeWidgetIds.filter(id => id !== widgetId);
    this.saveWidgetOrder();
    this.syncVisibleWidgets();
    this.triggerHaptic(35);
    this.cdr.markForCheck();
  }

  openAddWidgetModal() {
    if (this.activeWidgetIds.length >= 9) return;
    this.isAddWidgetModalOpen = true;
    this.cdr.markForCheck();
  }

  closeAddWidgetModal() {
    this.isAddWidgetModalOpen = false;
    this.cdr.markForCheck();
  }

  addWidget(widgetId: string) {
    if (this.activeWidgetIds.length >= 9) return;
    if (!this.activeWidgetIds.includes(widgetId)) {
      this.activeWidgetIds.push(widgetId);
      this.saveWidgetOrder();
      this.syncVisibleWidgets();
      this.triggerHaptic(30);
    }
    if (this.getAvailableWidgets().length === 0 || this.activeWidgetIds.length >= 9) {
      this.isAddWidgetModalOpen = false;
    }
    this.cdr.markForCheck();
  }

  resetWidgetsToDefault() {
    this.activeWidgetIds = [...this.DEFAULT_WIDGET_IDS];
    this.saveWidgetOrder();
    this.syncVisibleWidgets();
    this.triggerHaptic(40);
    this.cdr.markForCheck();
  }

  // Pointer-Driven Drag and Drop (Unified Touch, Pen & Mouse)
  onWidgetPointerDown(event: PointerEvent, widgetId: string, index: number) {
    if (event.button !== 0) return;

    this.activePointerId = event.pointerId;

    if (!this.isWidgetEditMode) {
      // 1-second hold to enter edit mode
      this.touchStartX = event.clientX;
      this.touchStartY = event.clientY;
      this.cancelLongPress();
      this.longPressTriggered = false;

      this.longPressTimer = setTimeout(() => {
        this.longPressTriggered = true;
        this.enterWidgetEditMode();
        // Immediately start dragging in the same gesture!
        this.draggedWidgetId = widgetId;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
        this.dragCurrentX = 0;
        this.dragCurrentY = 0;
        this.isDragging = true;
        this.triggerHaptic(50);
        this.cdr.detectChanges();
      }, 1000);
      return;
    }

    // Already in edit mode: prepare drag
    this.draggedWidgetId = widgetId;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragCurrentX = 0;
    this.dragCurrentY = 0;
    this.isDragging = false;
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent) {
    if (!this.draggedWidgetId && !this.longPressTimer) return;

    if (!this.isWidgetEditMode) {
      if (Math.hypot(event.clientX - this.touchStartX, event.clientY - this.touchStartY) > 12) {
        this.cancelLongPress();
      }
      return;
    }

    if (!this.draggedWidgetId) return;

    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;

    if (!this.isDragging && Math.hypot(dx, dy) > 4) {
      this.isDragging = true;
      this.triggerHaptic(20);
    }

    if (this.isDragging) {
      this.dragCurrentX = dx;
      this.dragCurrentY = dy;
      this.checkDropTarget(event.clientX, event.clientY);
      this.cdr.detectChanges();
    }
  }

  private checkDropTarget(clientX: number, clientY: number) {
    if (!this.draggedWidgetId) return;

    const now = Date.now();
    if (now - this.lastSwapTime < 160) return;

    const elem = document.elementFromPoint(clientX, clientY);
    if (!elem) return;

    const targetWrapper = elem.closest('.widget-card-wrapper') as HTMLElement;
    if (!targetWrapper || targetWrapper.classList.contains('empty-slot-card')) return;

    const targetWidgetId = targetWrapper.getAttribute('data-widget-id');
    if (!targetWidgetId || targetWidgetId === this.draggedWidgetId) return;

    const fromIndex = this.activeWidgetIds.indexOf(this.draggedWidgetId);
    const toIndex = this.activeWidgetIds.indexOf(targetWidgetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const draggedElem = document.querySelector(`[data-widget-id="${this.draggedWidgetId}"]`) as HTMLElement;
      const fromRect = draggedElem ? draggedElem.getBoundingClientRect() : null;
      const toRect = targetWrapper.getBoundingClientRect();

      if (fromRect && toRect) {
        const deltaX = toRect.left - fromRect.left;
        const deltaY = toRect.top - fromRect.top;
        this.dragStartX += deltaX;
        this.dragStartY += deltaY;
        this.dragCurrentX -= deltaX;
        this.dragCurrentY -= deltaY;
      }

      const moved = this.activeWidgetIds.splice(fromIndex, 1)[0];
      this.activeWidgetIds.splice(toIndex, 0, moved);

      this.lastSwapTime = now;
      this.syncVisibleWidgets();
      this.triggerHaptic(25);
      this.cdr.detectChanges();
    }
  }

  @HostListener('window:pointerup', ['$event'])
  @HostListener('window:pointercancel', ['$event'])
  onWindowPointerUp(event: PointerEvent) {
    this.cancelLongPress();

    if (this.isDragging && this.draggedWidgetId) {
      this.saveWidgetOrder();
      this.triggerHaptic(30);
    }

    this.draggedWidgetId = null;
    this.isDragging = false;
    this.dragCurrentX = 0;
    this.dragCurrentY = 0;
    this.activePointerId = null;
    this.cdr.detectChanges();
  }

  onWidgetContextMenu(event: MouseEvent) {
    if (this.longPressTriggered || this.isWidgetEditMode) {
      event.preventDefault();
    }
  }

  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private triggerHaptic(durationMs: number = 30) {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(durationMs);
      }
    } catch (e) {}
  }

  getAqiColor(aqiValue: number): string {
    const val = Number(aqiValue);
    if (val <= 50) return '#2a9d8f';
    if (val <= 100) return '#e9c46a';
    if (val <= 150) return '#f4a261';
    if (val <= 200) return '#e76f51';
    return '#d62828';
  }

  isSkopjeMunicipalitiesExpanded = true;

  toggleSkopjeMunicipalities() {
    this.isSkopjeMunicipalitiesExpanded = !this.isSkopjeMunicipalitiesExpanded;
  }

  isSkopjeCity(): boolean {
    const city = (this.currentCityName || this.parsedWeatherData?.city_name || '').toLowerCase();
    return city.includes('скопје') || city.includes('skopje') || city.includes('shkup');
  }

  getSkopjeMunicipalities(): any[] {
    if (!this.parsedWeatherData?.skopje_municipalities) return [];
    return this.parsedWeatherData.skopje_municipalities;
  }

  getMunicipalityName(muni: any): string {
    if (!muni) return '';
    if (this.currentLang === 'en' && muni.nameEn) return muni.nameEn;
    if (this.currentLang === 'al' && muni.nameAl) return muni.nameAl;
    return muni.name || '';
  }

  getLocalizedAqiStatus(val: number): string {
    const num = Number(val);
    if (this.currentLang === 'en') {
      if (num <= 50) return 'Good';
      if (num <= 100) return 'Moderate';
      if (num <= 150) return 'Sensitive';
      if (num <= 200) return 'Unhealthy';
      return 'Hazardous';
    } else if (this.currentLang === 'al') {
      if (num <= 50) return 'Mirë';
      if (num <= 100) return 'Mesatar';
      if (num <= 150) return 'E dëmshme';
      if (num <= 200) return 'Shumë e dëmshme';
      return 'E rrezikshme';
    }
    if (num <= 50) return 'Одличен';
    if (num <= 100) return 'Умерен';
    if (num <= 150) return 'Чувствителен';
    if (num <= 200) return 'Загаден';
    return 'Опасно';
  }

  async changeLanguage(event: any) {
    const selectedLang = event.detail.value;
    this.currentLang = selectedLang;
    this.translate.use(selectedLang);
    localStorage.setItem('app_language', selectedLang);
    await this.healthService.setLanguage(selectedLang);
    await this.supabaseService.updateDeviceLanguage(selectedLang);
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

  promptGuestLogin() {
    this.isAuthPromptModalOpen = true;
    this.cdr.markForCheck();
  }

  onAuthPromptLogin() {
    this.isAuthPromptModalOpen = false;
    this.goToLogin();
  }

  async onWidgetClick(widgetId: string, index?: number) {
    if (this.longPressTriggered) {
      this.longPressTriggered = false;
      return;
    }
    if (this.isWidgetEditMode || this.isDragging) {
      return;
    }

    if (!this.currentUser) {
      await this.promptGuestLogin();
      return;
    }

    this.activeDetailWidgetId = widgetId;
    if (widgetId === 'loyalty') this.loyaltyModalView = 'list';
    if (widgetId === 'activity') {
      if (Capacitor.isNativePlatform()) {
        const permCheck = await this.healthService.checkHealthPermissions();
        this.isHealthPermGranted = permCheck.granted;
      }
      const refreshed = await this.healthService.getTodayDeviceSteps();
      this.todayHealthData = refreshed;
      this.updateActivityWidgetDisplay(refreshed);

      if (this.currentUser) {
        await this.syncHealthData(this.currentUser.id);
        const remoteMetrics = await this.supabaseService.getLast7DaysHealthMetrics(this.currentUser.id);
        if (remoteMetrics && remoteMetrics.length > 0) {
          this.last7DaysHealth = remoteMetrics;
        } else {
          this.last7DaysHealth = await this.healthService.getLocal7DaysHistory();
        }
      } else {
        this.last7DaysHealth = await this.healthService.getLocal7DaysHistory();
      }
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
    const activeCurrency = this.selectedDefaultCurrency || 'EUR';
    const activeIcon = this.getCurrencyIonicIcon(activeCurrency);

    if (activeCurrency === 'EUR') {
      const mkdRecord = this.rawDatabaseRates.find((r: any) => r.target_currency === 'MKD');
      const eurRate = mkdRecord ? mkdRecord.rate.toFixed(2) : '61.49';
      this.allWidgets = this.allWidgets.map(widget => {
        if (widget.id === 'currency') {
          return { 
            ...widget, 
            translationKey: 'EUR', 
            unit: 'EUR', 
            icon: activeIcon, 
            value: `${eurRate}` 
          };
        }
        return widget;
      });
    } else {
      const targetRecord = this.rawDatabaseRates.find((r: any) => r.target_currency === activeCurrency);
      const mkdRecord = this.rawDatabaseRates.find((r: any) => r.target_currency === 'MKD');
      if (targetRecord && mkdRecord) {
        const rateToMkd = (mkdRecord.rate / targetRecord.rate).toFixed(2);
        this.allWidgets = this.allWidgets.map(widget => {
          if (widget.id === 'currency') {
            return { 
              ...widget, 
              translationKey: activeCurrency, 
              unit: activeCurrency, 
              icon: activeIcon, 
              value: `${rateToMkd}` 
            };
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
  '{"weather":true,"fuel":true,"stock":true,"crypto":true,"holidays":true,"activity":true,"aqi":true}'
);

// 2. Check if a widget supports notification toggles
supportsNotification(widgetId: string): boolean {
  return ['weather', 'fuel', 'stock', 'crypto', 'holidays', 'activity', 'aqi'].includes(widgetId);
}

// 3. Toggle handler (stops click propagation so it doesn't open the detail modal)
toggleWidgetNotification(widgetId: string, event: Event) {
  event.stopPropagation();
  if (!this.currentUser) {
    this.promptGuestLogin();
    return;
  }
  const currentVal = this.notificationPreferences[widgetId] ?? true;
  const newVal = !currentVal;
  
  this.notificationPreferences[widgetId] = newVal;
  localStorage.setItem('widget_notification_prefs', JSON.stringify(this.notificationPreferences));

  // Sync to backend DB if logged in
  if (this.currentUser) {
    this.supabaseService.updateNotificationPreference(widgetId, newVal);
  }

  // If activity, inform HealthService & native StepTracker
  if (widgetId === 'activity') {
    this.healthService.setNotificationEnabled(newVal);
  }
}

isNotificationActive(widgetId: string): boolean {
  if (!this.currentUser) return false;
  return this.notificationPreferences[widgetId] ?? true;
}
}
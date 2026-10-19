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
  checkmarkCircle,
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
  checkmark,
  medkit,
  map,
  list,
  call,
  navigate,
  search,
  location,
  timeOutline,
  calculator,
  carOutline,
  car,
  pulse,
  waterOutline,
  warning,
  flash,
  water
} from 'ionicons/icons';

import { 
  IonContent, 
  IonSelect, 
  IonSelectOption,
  IonModal, 
  IonIcon,
  IonDatetime,
  IonToggle,
  AlertController,
  ActionSheetController
} from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { StockService, StockTicker } from '../services/stock';
import { LoyaltyService, LoyaltyCard } from '../services/loyalty';
import { PharmacyService, DutyPharmacy } from '../services/pharmacy';
import { GasStationService, GasStation } from '../services/gas-station';
import { UtilityAlertService, UtilityAlert } from '../services/utility-alert';
import { BarcodeRenderDirective } from '../directives/barcode-render';
import { MACEDONIAN_STORES, StorePreset, CARD_GRADIENT_PALETTE } from '../config/loyalty-stores.config';
import { App } from '@capacitor/app';
import { PushNotificationService } from '../services/push-notification';
import { AnalyticsService } from '../services/analytics';
import * as L from 'leaflet';

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
  private loyaltyService = inject(LoyaltyService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  public networkService = inject(NetworkService);
  private pushService = inject(PushNotificationService);
  public analyticsService = inject(AnalyticsService);
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

  readonly FUEL_ITEMS = [
    { id: 'Бензин 95', shortName: 'БС-95', titleKey: 'FUEL_MODAL.PETROL_95', unitKey: 'FUEL_MODAL.PER_LITER', isKg: false },
    { id: 'Бензин 98+', shortName: 'БС-98', titleKey: 'FUEL_MODAL.PETROL_98', unitKey: 'FUEL_MODAL.PER_LITER', isKg: false },
    { id: 'Дизел', shortName: 'Дизел', titleKey: 'FUEL_MODAL.DIESEL', unitKey: 'FUEL_MODAL.PER_LITER', isKg: false },
    { id: 'Екстра Лесно', shortName: 'ЕЛ-1', titleKey: 'FUEL_MODAL.LIGHT_OIL', unitKey: 'FUEL_MODAL.PER_LITER', isKg: false },
    { id: 'Мазут', shortName: 'Мазут', titleKey: 'FUEL_MODAL.HEATING_OIL', unitKey: 'FUEL_MODAL.PER_KG', isKg: true },
  ];

  fuelModalView: 'prices' | 'calc' = 'prices';
  fuelCalcMode: 'amount' | 'liters' | 'trip' = 'amount';
  fuelCalcSelectedFuel: string = 'Дизел';
  fuelCalcMkdAmount: number = 1000;
  fuelCalcLiters: number = 40;
  fuelCalcDistanceKm: number = 100;
  fuelCalcConsumptionL100: number = 6.5;

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

  // Pharmacy State
  private pharmacyService = inject(PharmacyService);
  private actionSheetCtrl = inject(ActionSheetController);
  pharmaciesList: DutyPharmacy[] = [];
  filteredPharmacies: DutyPharmacy[] = [];
  nearestPharmacy: DutyPharmacy | null = null;
  pharmacyModalView: 'list' | 'map' = 'list';
  pharmacySearchQuery: string = '';
  selectedPharmacyCity: string = '';
  pharmacyCities: string[] = [
    'Скопје', 'Битола', 'Куманово', 'Прилеп', 'Тетово', 'Охрид', 'Велес', 'Штип',
    'Струмица', 'Кавадарци', 'Кочани', 'Гостивар', 'Гевгелија', 'Кичево', 'Неготино',
    'Ресен', 'Струга', 'Крушево', 'Дебар', 'Берово', 'Валандово', 'Виница',
    'Делчево', 'Крива Паланка', 'Кратово', 'Пробиштип', 'Свети Николе', 'Демир Хисар',
    'Македонски Брод', 'Македонска Каменица'
  ];
  private leafletMap: L.Map | null = null;
  private leafletMarkers: L.Marker[] = [];
  private leafletTileLayer: L.TileLayer | null = null;

  // Gas Stations State
  private gasStationService = inject(GasStationService);
  gasStationsList: GasStation[] = [];
  filteredGasStations: GasStation[] = [];
  nearestGasStation: GasStation | null = null;
  gasModalView: 'list' | 'map' = 'list';
  gasSearchQuery: string = '';
  selectedGasCity: string = '';
  selectedGasBrand: string = 'all';
  selectedGasService: string = 'all';
  gasCities: string[] = [];
  readonly gasBrands = [
    { id: 'all', labelKey: 'GAS_MODAL.ALL_BRANDS' },
    { id: 'Макпетрол', label: 'Макпетрол' },
    { id: 'Лукоил', label: 'Лукоил' },
    { id: 'ОКТА', label: 'ОКТА' },
    { id: 'Детоил', label: 'Детоил' },
    { id: 'Гулф', label: 'Гулф' },
    { id: 'Шел', label: 'Шел' },
    { id: 'other', label: 'Останати' }
  ];
  private gasLeafletMap: L.Map | null = null;
  private gasLeafletMarkers: L.Marker[] = [];
  private gasLeafletTileLayer: L.TileLayer | null = null;

  // Utility Alerts State
  public utilityAlertService = inject(UtilityAlertService);
  alertsList: UtilityAlert[] = [];
  filteredAlerts: UtilityAlert[] = [];
  selectedAlertType: 'all' | 'power' | 'water' | 'other' = 'all';
  selectedAlertCity: string = '';
  alertSearchQuery: string = '';
  alertCities: string[] = [];

  allWidgets: Widget[] = [
    { id: 'aqi', translationKey: 'WIDGETS.AQI', value: '--', unit: 'AQI', icon: 'leaf' },
    { id: 'fuel', translationKey: 'WIDGETS.FUEL', value: '--.-', unit: 'МКД', icon: 'speedometer' },
    { id: 'currency', translationKey: 'WIDGETS.CURRENCY', value: '--.-', unit: 'EUR', icon: 'logo-euro' },
    { id: 'weather', translationKey: 'WIDGETS.WEATHER', value: '--°', unit: '...', icon: 'cloudy', weatherEmoji: '⛅' },
    { id: 'crypto', translationKey: '--', value: 'BTC', unit: 'BTC', icon: 'stats-chart' },
    { id: 'stock', translationKey: 'WIDGETS.STOCK', value: 'AAPL', unit: 'AAPL', icon: 'trending-up' },
    { id: 'holidays', translationKey: 'WIDGETS.CALENDAR', value: '--.--', unit: 'Календар', icon: 'calendar-number' },
    { id: 'uv', translationKey: 'WIDGETS.UV', value: '-', unit: 'UV', icon: 'sunny' },
    { id: 'loyalty', translationKey: 'WIDGETS.LOYALTY', value: '0', unit: 'CARD_UNIT', icon: 'card' },
    { id: 'pharmacy', translationKey: 'WIDGETS.PHARMACY', value: '24/7', unit: 'Отворено', icon: 'medkit' },
    { id: 'gas_stations', translationKey: 'WIDGETS.GAS_STATIONS', value: '⛽', unit: 'Пумпа', icon: 'speedometer' },
    { id: 'alerts', translationKey: 'WIDGETS.ALERTS', value: '0', unit: 'Прекини', icon: 'warning' }
  ];

  readonly DEFAULT_WIDGET_IDS: string[] = ['aqi', 'fuel', 'currency', 'weather', 'crypto', 'stock', 'holidays', 'pharmacy', 'gas_stations'];
  readonly MAX_WIDGET_COUNT = 9;
  readonly STORAGE_WIDGET_ORDER_KEY = 'dzeble_user_widget_ids';

  currentUserCoords: { latitude: number; longitude: number } | null = null;
  activeWidgetIds: string[] = [];
  visibleWidgets: Widget[] = [];

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
      'checkmark-circle': checkmarkCircle,
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
      'checkmark': checkmark,
      'medkit': medkit,
      'map': map,
      'list': list,
      'call': call,
      'navigate': navigate,
      'search': search,
      'location': location,
      'time-outline': timeOutline,
      'calculator': calculator,
      'car-outline': carOutline,
      'water-outline': waterOutline,
      'warning': warning,
      'flash': flash,
      'water': water,
      'car': car,
      'pulse': pulse
    });

    this.loadSavedWidgetOrder();
    this.syncVisibleWidgets();
  }

  async ngOnInit() {
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
      if (this.leafletMap && this.pharmacyModalView === 'map') {
        this.applyLeafletTileLayer();
        this.renderLeafletMarkers();
      }
      if (this.gasLeafletMap && this.gasModalView === 'map') {
        this.applyGasLeafletTileLayer();
        this.renderGasLeafletMarkers();
      }
      this.cdr.markForCheck();
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

    this.supabaseService.currentUser$.subscribe(async (user) => {
      this.currentUser = user;

      if (user) {
        const token = await this.pushService.requestPushPermissionAndRegister();
        await this.supabaseService.syncDeviceRecord(user.id, user.email, token || undefined);
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
            const cachedToken = this.pushService.getCurrentToken();
            if (this.currentUser) {
              await this.supabaseService.syncDeviceRecord(this.currentUser.id, this.currentUser.email, cachedToken || undefined);
            } else {
              await this.supabaseService.syncDeviceRecord();
            }
          });
        }
      });
    }

    this.pushService.notificationAction$.subscribe(action => {
      if (action?.widgetId) {
        this.zone.run(() => {
          this.onWidgetClick(action.widgetId);
        });
      }
    });

    this.fetchHolidays();
    this.fetchLiveMetrics();
    this.fetchDatabaseCurrencyRates();
    this.fetchDatabaseFuelPrices();
    this.initLiveCrypto();
    this.initLiveStock();
    this.startMultiFavoritesSlider();
    this.loadDutyPharmacies();
    this.loadGasStations();
    this.loadUtilityAlerts();
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
    if (this.leafletMap && this.pharmacyModalView === 'map') {
      this.applyLeafletTileLayer();
      this.renderLeafletMarkers();
    }
    if (this.gasLeafletMap && this.gasModalView === 'map') {
      this.applyGasLeafletTileLayer();
      this.renderGasLeafletMarkers();
    }
  }

async handleLogout() {
  this.isSettingsSheetOpen = false;
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
    this.analyticsService.track('loyalty', 'card_scanned', card.store_name);
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
    this.analyticsService.track('crypto', 'coin_detail_viewed', coin.pair || coin.symbol, { price: coin.price, change24h: coin.change24h });
  }

  closeCoinDetail() {
    this.cryptoModalView = 'list';
    this.selectedCoinDetail = null;
  }

  async onAddCryptoSubmit() {
    if (!this.cryptoSearchQuery.trim()) return;
    this.isSearchingCrypto = true;
    this.cryptoSearchError = '';
    const query = this.cryptoSearchQuery.trim();
    const added = await this.cryptoService.addCryptoPair(query);
    this.isSearchingCrypto = false;
    if (added) {
      this.analyticsService.track('crypto', 'coin_added', query);
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
    const storeName = this.newCustomStoreName.trim();
    const saved = await this.loyaltyService.addCard({
      user_id: this.currentUser.id,
      store_name: storeName,
      barcode_data: this.newBarcodeData.trim(),
      barcode_format: this.newBarcodeFormat,
      card_color: this.newCardColor
    });
    if (saved) {
      this.analyticsService.track('loyalty', 'card_added', storeName);
      await this.loadLoyaltyCards(this.currentUser.id);
      this.closeLoyaltySubView();
    }
  }

  async deleteLoyaltyCard(cardId?: string) {
    if (!cardId || !this.currentUser) return;
    const targetCard = this.loyaltyCards.find(c => c.id === cardId);
    const success = await this.loyaltyService.deleteCard(cardId);
    if (success) {
      this.analyticsService.track('loyalty', 'card_deleted', targetCard?.store_name);
      await this.loadLoyaltyCards(this.currentUser.id);
      this.closeLoyaltySubView();
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

  getFuelPriceRaw(fuelName: string): number {
    const match = this.findFuelRecord(fuelName);
    if (!match || match.price_mkd === null || match.price_mkd === undefined) {
      if (fuelName.includes('95')) return 98.50;
      if (fuelName.includes('98')) return 100.50;
      if (fuelName.includes('дизел')) return 97.00;
      if (fuelName.includes('лесно')) return 108.50;
      if (fuelName.includes('мазут')) return 51.74;
      return 97.00;
    }
    return Number(match.price_mkd);
  }

  get fuelCalcLitersResult(): string {
    const price = this.getFuelPriceRaw(this.fuelCalcSelectedFuel);
    if (!price || price <= 0 || !this.fuelCalcMkdAmount || this.fuelCalcMkdAmount <= 0) return '0.00';
    const liters = this.fuelCalcMkdAmount / price;
    return liters.toFixed(2);
  }

  get fuelCalcCostResult(): string {
    const price = this.getFuelPriceRaw(this.fuelCalcSelectedFuel);
    if (!price || price <= 0 || !this.fuelCalcLiters || this.fuelCalcLiters <= 0) return '0.00';
    const cost = this.fuelCalcLiters * price;
    return cost.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get fuelCalcTripLitersResult(): string {
    if (!this.fuelCalcDistanceKm || !this.fuelCalcConsumptionL100) return '0.00';
    const liters = (this.fuelCalcDistanceKm * this.fuelCalcConsumptionL100) / 100;
    return liters.toFixed(2);
  }

  get fuelCalcTripCostResult(): string {
    const price = this.getFuelPriceRaw(this.fuelCalcSelectedFuel);
    if (!price || price <= 0 || !this.fuelCalcDistanceKm || !this.fuelCalcConsumptionL100) return '0';
    const liters = (this.fuelCalcDistanceKm * this.fuelCalcConsumptionL100) / 100;
    const cost = liters * price;
    return Math.round(cost).toLocaleString('mk-MK');
  }

  setFuelCalcAmountPreset(amount: number) {
    this.fuelCalcMkdAmount = amount;
  }

  setFuelCalcLitersPreset(liters: number) {
    this.fuelCalcLiters = liters;
  }

  setFuelCalcDistancePreset(distance: number) {
    this.fuelCalcDistanceKm = distance;
  }

  setFuelCalcConsumptionPreset(consumption: number) {
    this.fuelCalcConsumptionL100 = consumption;
  }

  switchFuelModalView(view: 'prices' | 'calc') {
    this.fuelModalView = view;
    if (view === 'calc') {
      if (!this.fuelCalcSelectedFuel) {
        this.fuelCalcSelectedFuel = this.selectedDefaultFuel || 'Дизел';
      }
      this.analyticsService.track('fuel', 'calculator_opened', this.fuelCalcSelectedFuel);
    }
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
        this.currentUserCoords = coords;
        localStorage.setItem('user_current_lat', coords.latitude.toString());
        localStorage.setItem('user_current_lng', coords.longitude.toString());
        this.updateNearestPharmacy();
        this.updateFilteredPharmacies();
        this.updatePharmacyWidgetDisplay();
        this.updateNearestGasStation();
        this.updateFilteredGasStations();
        this.updateGasWidgetDisplay();
        this.updateFilteredAlerts();
        this.updateAlertsWidgetDisplay();

        // 1. Instantly determine nearest city locally in memory (0ms)
        const resolvedCity = this.weatherService.resolveCityName(coords.latitude, coords.longitude);
        if (resolvedCity) {
          this.currentCityName = resolvedCity;
          localStorage.setItem('user_current_city', resolvedCity);
          const resolvedMuni = this.weatherService.resolveMunicipalityName(coords.latitude, coords.longitude);
          if (resolvedMuni) {
            localStorage.setItem('user_current_municipality', resolvedMuni);
          }
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

        this.supabaseService.updateDeviceLocation(coords.latitude, coords.longitude, metrics.city_name);

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
          unit: this.getLocalizedAqiStatus(aqiNum, metrics.aqi_status_text),
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
          unit: this.getLocalizedAqiStatus(aqiNum, metrics.aqi_status_text),
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
    const isToday = (d: any) => d.day === 'Денес' || d.day === 'Today' || d.day === 'Sot' || d.isToday;
    const today = (this.parsedWeatherData?.weekly_forecast || []).find(isToday) || this.parsedWeatherData?.weekly_forecast?.[0];
    if (today?.max != null) return today.max;
    if (typeof today?.temps === 'string') {
      const match = today.temps.match(/([0-9.-]+)°/);
      if (match) return Math.round(parseFloat(match[1]));
    }
    return this.parsedWeatherData ? Math.round(this.parsedWeatherData.current_temp) : null;
  }

  getTodayWeatherLow(): number | null {
    const isToday = (d: any) => d.day === 'Денес' || d.day === 'Today' || d.day === 'Sot' || d.isToday;
    const today = (this.parsedWeatherData?.weekly_forecast || []).find(isToday) || this.parsedWeatherData?.weekly_forecast?.[0];
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
          let uniqueIds = Array.from(new Set(validIds));
          // Migrate: extract 'loyalty' and replace with 'gas_stations' or add 'gas_stations'
          const loyaltyIdx = uniqueIds.indexOf('loyalty');
          if (loyaltyIdx !== -1) {
            if (!uniqueIds.includes('gas_stations')) {
              uniqueIds[loyaltyIdx] = 'gas_stations';
            } else {
              uniqueIds.splice(loyaltyIdx, 1);
            }
          }
          const uvIdx = uniqueIds.indexOf('uv');
          if (uvIdx !== -1 && !uniqueIds.includes('pharmacy')) {
            uniqueIds[uvIdx] = 'pharmacy';
          }
          if (!uniqueIds.includes('gas_stations')) {
            uniqueIds.push('gas_stations');
          }
          for (const defaultId of this.DEFAULT_WIDGET_IDS) {
            if (uniqueIds.length >= this.MAX_WIDGET_COUNT) break;
            if (!uniqueIds.includes(defaultId) && this.allWidgets.some(w => w.id === defaultId)) {
              uniqueIds.push(defaultId);
            }
          }
          uniqueIds = uniqueIds.slice(0, this.MAX_WIDGET_COUNT);
          if (uniqueIds.length > 0) {
            this.activeWidgetIds = uniqueIds;
            this.saveWidgetOrder();
            return;
          }
        }
      }
    } catch (e) {}

    // Default widgets layout
    this.activeWidgetIds = [...this.DEFAULT_WIDGET_IDS];
    this.saveWidgetOrder();
  }

  saveWidgetOrder() {
    try {
      localStorage.setItem(this.STORAGE_WIDGET_ORDER_KEY, JSON.stringify(this.activeWidgetIds.slice(0, this.MAX_WIDGET_COUNT)));
    } catch (e) {}
  }

  syncVisibleWidgets() {
    if (!this.activeWidgetIds || this.activeWidgetIds.length === 0) {
      this.loadSavedWidgetOrder();
    }
    this.visibleWidgets = this.activeWidgetIds
      .slice(0, this.MAX_WIDGET_COUNT)
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
    const emptyCount = Math.max(0, this.MAX_WIDGET_COUNT - this.visibleWidgets.length);
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
    if (this.activeWidgetIds.length >= this.MAX_WIDGET_COUNT) return;
    this.isAddWidgetModalOpen = true;
    this.cdr.markForCheck();
  }

  closeAddWidgetModal() {
    this.isAddWidgetModalOpen = false;
    this.cdr.markForCheck();
  }

  addWidget(widgetId: string) {
    if (this.activeWidgetIds.length >= this.MAX_WIDGET_COUNT) return;
    if (!this.activeWidgetIds.includes(widgetId)) {
      this.activeWidgetIds.push(widgetId);
      this.saveWidgetOrder();
      this.syncVisibleWidgets();
      this.triggerHaptic(30);
    }
    if (this.getAvailableWidgets().length === 0 || this.activeWidgetIds.length >= this.MAX_WIDGET_COUNT) {
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

  getLocalizedAqiStatus(val?: number | string | null, fallbackText?: string): string {
    let num = val != null ? Number(val) : NaN;

    if (isNaN(num) && fallbackText) {
      const fb = fallbackText.toLowerCase().trim();
      if (fb.includes('одличен') || fb.includes('good') || fb.includes('shkëlqyeshëm') || fb.includes('shkelqyeshem') || fb.includes('mirë') || fb.includes('mire')) num = 25;
      else if (fb.includes('умерен') || fb.includes('moderate') || fb.includes('moderuar') || fb.includes('mesatar')) num = 75;
      else if (fb.includes('чувствител') || fb.includes('sensitive') || fb.includes('pazakont') || fb.includes('ndjesh')) num = 125;
      else if (fb.includes('многу') || fb.includes('very') || fb.includes('shumë') || fb.includes('shume')) num = 250;
      else if (fb.includes('загаден') || fb.includes('unhealthy') || fb.includes('ndotur')) num = 175;
      else if (fb.includes('опасн') || fb.includes('hazard') || fb.includes('rrezik') || fb.includes('dëmsh') || fb.includes('demsh') || fb.includes('штетен')) num = 350;
    }

    if (isNaN(num)) {
      return fallbackText || this.translate.instant('AQI_MODAL.STATUS_MODERATE');
    }

    if (num <= 50) return this.translate.instant('AQI_MODAL.STATUS_GOOD');
    if (num <= 100) return this.translate.instant('AQI_MODAL.STATUS_MODERATE');
    if (num <= 150) return this.translate.instant('AQI_MODAL.STATUS_SENSITIVE');
    if (num <= 200) return this.translate.instant('AQI_MODAL.STATUS_UNHEALTHY');
    if (num <= 300) return this.translate.instant('AQI_MODAL.STATUS_VERY_UNHEALTHY');
    return this.translate.instant('AQI_MODAL.STATUS_HAZARDOUS');
  }

  formatHourlyTime(time?: string): string {
    if (!time) return '';
    const trimmed = time.trim().toLowerCase();
    if (trimmed === 'сега' || trimmed === 'now' || trimmed === 'tani') {
      return this.translate.instant('WEATHER_MODAL.NOW');
    }
    return time;
  }

  formatForecastDay(day?: string): string {
    if (!day) return '';
    const trimmed = day.trim().toLowerCase();

    // Today
    if (trimmed === 'денес' || trimmed === 'today' || trimmed === 'sot') {
      return this.translate.instant('WEATHER_MODAL.TODAY');
    }
    // Tomorrow
    if (trimmed === 'утре' || trimmed === 'tomorrow' || trimmed === 'nesër' || trimmed === 'neser') {
      return this.translate.instant('WEATHER_MODAL.TOMORROW');
    }
    // Day after tomorrow
    if (trimmed === 'задутре' || trimmed.includes('after tomorrow') || trimmed === 'pasnesër' || trimmed === 'pasneser') {
      return this.translate.instant('WEATHER_MODAL.DAY_AFTER_TOMORROW');
    }
    // Sunday
    if (trimmed === 'недела' || trimmed === 'sunday' || trimmed === 'e diel') {
      return this.translate.instant('WEATHER_MODAL.SUNDAY');
    }
    // Monday
    if (trimmed === 'понеделник' || trimmed === 'monday' || trimmed === 'e hënë' || trimmed === 'e hene') {
      return this.translate.instant('WEATHER_MODAL.MONDAY');
    }
    // Tuesday
    if (trimmed === 'вторник' || trimmed === 'tuesday' || trimmed === 'e martë' || trimmed === 'e marte') {
      return this.translate.instant('WEATHER_MODAL.TUESDAY');
    }
    // Wednesday
    if (trimmed === 'среда' || trimmed === 'wednesday' || trimmed === 'e mërkurë' || trimmed === 'e merkure') {
      return this.translate.instant('WEATHER_MODAL.WEDNESDAY');
    }
    // Thursday
    if (trimmed === 'четврток' || trimmed === 'thursday' || trimmed === 'e enjte') {
      return this.translate.instant('WEATHER_MODAL.THURSDAY');
    }
    // Friday
    if (trimmed === 'петок' || trimmed === 'friday' || trimmed === 'e premte') {
      return this.translate.instant('WEATHER_MODAL.FRIDAY');
    }
    // Saturday
    if (trimmed === 'сабота' || trimmed === 'saturday' || trimmed === 'e shtunë' || trimmed === 'e shtune') {
      return this.translate.instant('WEATHER_MODAL.SATURDAY');
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(day.trim())) {
      const d = new Date(day.trim());
      const dayIndex = d.getDay();
      const keys = [
        'WEATHER_MODAL.SUNDAY',
        'WEATHER_MODAL.MONDAY',
        'WEATHER_MODAL.TUESDAY',
        'WEATHER_MODAL.WEDNESDAY',
        'WEATHER_MODAL.THURSDAY',
        'WEATHER_MODAL.FRIDAY',
        'WEATHER_MODAL.SATURDAY'
      ];
      return this.translate.instant(keys[dayIndex]);
    }

    return day;
  }

  getLocalizedCityName(city?: string): string {
    if (!city) return '';
    const norm = city.trim().toLowerCase();

    const cityMap: Record<string, { mk: string; en: string; al: string }> = {
      'скопје': { mk: 'Скопје', en: 'Skopje', al: 'Shkup' },
      'skopje': { mk: 'Скопје', en: 'Skopje', al: 'Shkup' },
      'shkup': { mk: 'Скопје', en: 'Skopje', al: 'Shkup' },
      'битола': { mk: 'Битола', en: 'Bitola', al: 'Manastir' },
      'bitola': { mk: 'Битола', en: 'Bitola', al: 'Manastir' },
      'manastir': { mk: 'Битола', en: 'Bitola', al: 'Manastir' },
      'охрид': { mk: 'Охрид', en: 'Ohrid', al: 'Ohër' },
      'ohrid': { mk: 'Охрид', en: 'Ohrid', al: 'Ohër' },
      'ohër': { mk: 'Охрид', en: 'Ohrid', al: 'Ohër' },
      'oher': { mk: 'Охрид', en: 'Ohrid', al: 'Ohër' },
      'тетово': { mk: 'Тетово', en: 'Tetovo', al: 'Tetovë' },
      'tetovo': { mk: 'Тетово', en: 'Tetovo', al: 'Tetovë' },
      'tetovë': { mk: 'Тетово', en: 'Tetovo', al: 'Tetovë' },
      'tetove': { mk: 'Тетово', en: 'Tetovo', al: 'Tetovë' },
      'куманово': { mk: 'Куманово', en: 'Kumanovo', al: 'Kumanovë' },
      'kumanovo': { mk: 'Куманово', en: 'Kumanovo', al: 'Kumanovë' },
      'kumanovë': { mk: 'Куманово', en: 'Kumanovo', al: 'Kumanovë' },
      'гостивар': { mk: 'Гостивар', en: 'Gostivar', al: 'Gostivar' },
      'gostivar': { mk: 'Гостивар', en: 'Gostivar', al: 'Gostivar' },
      'струга': { mk: 'Струга', en: 'Struga', al: 'Strugë' },
      'struga': { mk: 'Струга', en: 'Struga', al: 'Strugë' },
      'strugë': { mk: 'Струга', en: 'Struga', al: 'Strugë' },
      'дебар': { mk: 'Дебар', en: 'Debar', al: 'Dibër' },
      'debar': { mk: 'Дебар', en: 'Debar', al: 'Dibër' },
      'dibër': { mk: 'Дебар', en: 'Debar', al: 'Dibër' },
      'кичево': { mk: 'Кичево', en: 'Kichevo', al: 'Kërçovë' },
      'kichevo': { mk: 'Кичево', en: 'Kichevo', al: 'Kërçovë' },
      'kërçovë': { mk: 'Кичево', en: 'Kichevo', al: 'Kërçovë' },
      'велес': { mk: 'Велес', en: 'Veles', al: 'Veles' },
      'veles': { mk: 'Велес', en: 'Veles', al: 'Veles' },
      'прилеп': { mk: 'Прилеп', en: 'Prilep', al: 'Përlep' },
      'prilep': { mk: 'Прилеп', en: 'Prilep', al: 'Përlep' },
      'струмица': { mk: 'Струмица', en: 'Strumica', al: 'Strumicë' },
      'strumica': { mk: 'Струмица', en: 'Strumica', al: 'Strumicë' },
      'штип': { mk: 'Штип', en: 'Shtip', al: 'Shtip' },
      'stip': { mk: 'Штип', en: 'Shtip', al: 'Shtip' },
      'shtip': { mk: 'Штип', en: 'Shtip', al: 'Shtip' },
      'кавадарци': { mk: 'Кавадарци', en: 'Kavadarci', al: 'Kavadar' },
      'kavadarci': { mk: 'Кавадарци', en: 'Kavadarci', al: 'Kavadar' },
      'кочани': { mk: 'Кочани', en: 'Kochani', al: 'Koçan' },
      'kochani': { mk: 'Кочани', en: 'Kochani', al: 'Koçan' },
      'гевгелија': { mk: 'Гевгелија', en: 'Gevgelija', al: 'Gjevgjeli' },
      'gevgelija': { mk: 'Гевгелија', en: 'Gevgelija', al: 'Gjevgjeli' },
      'ресен': { mk: 'Ресен', en: 'Resen', al: 'Resnjë' },
      'resen': { mk: 'Ресен', en: 'Resen', al: 'Resnjë' },
      'радовиш': { mk: 'Радовиш', en: 'Radovish', al: 'Radovisht' },
      'radovish': { mk: 'Радовиш', en: 'Radovish', al: 'Radovisht' },
      'крива паланка': { mk: 'Крива Паланка', en: 'Kriva Palanka', al: 'Kriva Pallankë' },
      'kriva palanka': { mk: 'Крива Паланка', en: 'Kriva Palanka', al: 'Kriva Pallankë' },
      'берово': { mk: 'Берово', en: 'Berovo', al: 'Berovë' },
      'berovo': { mk: 'Берово', en: 'Berovo', al: 'Berovë' },
      'делчево': { mk: 'Делчево', en: 'Delchevo', al: 'Dellçevë' },
      'delchevo': { mk: 'Делчево', en: 'Delchevo', al: 'Dellçevë' },
      'виница': { mk: 'Виница', en: 'Vinica', al: 'Vinicë' },
      'vinica': { mk: 'Виница', en: 'Vinica', al: 'Vinicë' },
      'крушево': { mk: 'Крушево', en: 'Krushevo', al: 'Krushevë' },
      'krushevo': { mk: 'Крушево', en: 'Krushevo', al: 'Krushevë' },
      'неготино': { mk: 'Неготино', en: 'Negotino', al: 'Negotinë' },
      'negotino': { mk: 'Неготино', en: 'Negotino', al: 'Negotinë' },
      'свети николе': { mk: 'Свети Николе', en: 'Sveti Nikole', al: 'Sveti Nikollë' },
      'sveti nikole': { mk: 'Свети Николе', en: 'Sveti Nikole', al: 'Sveti Nikollë' },
      'пробиштип': { mk: 'Пробиштип', en: 'Probishtip', al: 'Probishtip' },
      'probishtip': { mk: 'Пробиштип', en: 'Probishtip', al: 'Probishtip' },
      'валандово': { mk: 'Валандово', en: 'Valandovo', al: 'Vallandovë' },
      'valandovo': { mk: 'Валандово', en: 'Valandovo', al: 'Vallandovë' },
      'богданци': { mk: 'Богданци', en: 'Bogdanci', al: 'Bogdancë' },
      'bogdanci': { mk: 'Богданци', en: 'Bogdanci', al: 'Bogdancë' },
      'кратово': { mk: 'Кратово', en: 'Kratovo', al: 'Kratovë' },
      'kratovo': { mk: 'Кратово', en: 'Kratovo', al: 'Kratovë' },
      'демир капија': { mk: 'Демир Капија', en: 'Demir Kapija', al: 'Demir Kapi' },
      'demir kapija': { mk: 'Демир Капија', en: 'Demir Kapija', al: 'Demir Kapi' },
      'демир хисар': { mk: 'Демир Хисар', en: 'Demir Hisar', al: 'Demir Hisar' },
      'demir hisar': { mk: 'Демир Хисар', en: 'Demir Hisar', al: 'Demir Hisar' },
      'македонски брод': { mk: 'Македонски Брод', en: 'Makedonski Brod', al: 'Makedonski Brod' },
      'makedonski brod': { mk: 'Македонски Брод', en: 'Makedonski Brod', al: 'Makedonski Brod' },
      'македонска каменица': { mk: 'Македонска Каменица', en: 'Makedonska Kamenica', al: 'Makedonska Kamenicë' },
      'makedonska kamenica': { mk: 'Македонска Каменица', en: 'Makedonska Kamenica', al: 'Makedonska Kamenicë' },
      'пехчево': { mk: 'Пехчево', en: 'Pehchevo', al: 'Pehçevë' },
      'pehchevo': { mk: 'Пехчево', en: 'Pehchevo', al: 'Pehçevë' }
    };

    const entry = cityMap[norm];
    if (!entry) return city;
    const lang = (this.currentLang || 'mk') as 'mk' | 'en' | 'al';
    return entry[lang] || entry.mk || city;
  }

  async changeLanguage(event: any) {
    const selectedLang = event.detail.value;
    this.currentLang = selectedLang;
    this.translate.use(selectedLang);
    localStorage.setItem('app_language', selectedLang);
    await this.supabaseService.updateDeviceLanguage(selectedLang);
    if (this.parsedWeatherData) {
      this.applyWeatherMetricsToWidgets(this.parsedWeatherData);
    }
    this.filterWidgets();
    this.cdr.markForCheck();
  }

  setDetailModal(isOpen: boolean) {
    this.isDetailModalOpen = isOpen;
    if (!isOpen) {
      this.activeDetailWidgetId = null;
      this.closeLoyaltySubView();
      this.destroyLeafletMap();
      this.destroyGasLeafletMap();
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
    this.analyticsService.track(widgetId, 'widget_open', this.currentCityName);
    if (widgetId === 'loyalty') this.loyaltyModalView = 'list';
    if (widgetId === 'currency') {
      try { this.rawDatabaseRates = await this.supabaseService.getLatestCurrencyRates(); } catch (e) {}
    }
    if (widgetId === 'fuel') {
      this.fuelModalView = 'prices';
      this.fuelCalcSelectedFuel = this.selectedDefaultFuel || 'Дизел';
      try { await this.fetchDatabaseFuelPrices(); } catch (e) {}
    }
    if (widgetId === 'pharmacy') {
      this.pharmacyModalView = 'list';
      if (!this.currentUserCoords) {
        this.weatherService.getDeviceCoordinates().subscribe(coords => {
          this.currentUserCoords = coords;
          this.updateNearestPharmacy();
          this.updateFilteredPharmacies();
          this.updatePharmacyWidgetDisplay();
          if (this.leafletMap && this.pharmacyModalView === 'map') {
            this.centerLeafletMap();
          }
          this.cdr.markForCheck();
        });
      }
      this.loadDutyPharmacies();
    }
    if (widgetId === 'gas_stations') {
      this.gasModalView = 'list';
      if (!this.currentUserCoords) {
        this.weatherService.getDeviceCoordinates().subscribe(coords => {
          this.currentUserCoords = coords;
          this.updateNearestGasStation();
          this.updateFilteredGasStations();
          this.updateGasWidgetDisplay();
          if (this.gasLeafletMap && this.gasModalView === 'map') {
            this.centerGasLeafletMap();
          }
          this.cdr.markForCheck();
        });
      }
      this.loadGasStations();
    }
    if (widgetId === 'alerts') {
      if (!this.selectedAlertCity && this.currentCityName) {
        const norm = this.currentCityName.toLowerCase();
        const match = this.alertCities.find(c => c.toLowerCase().includes(norm));
        if (match) this.selectedAlertCity = match;
      }
      if (!this.currentUserCoords) {
        this.weatherService.getDeviceCoordinates().subscribe(coords => {
          this.currentUserCoords = coords;
          this.updateFilteredAlerts();
          this.cdr.markForCheck();
        });
      }
      this.loadUtilityAlerts();
    }
    this.isDetailModalOpen = true;
  }

  getRandomEventColor(): string {
    return this.eventColorPalette[Math.floor(Math.random() * this.eventColorPalette.length)];
  }

  togglePastEventsView() { this.showPastEvents = !this.showPastEvents; }

  openStockDetail(stock: StockTicker) {
    this.selectedStockDetail = stock;
    this.stockModalView = 'detail';
    this.analyticsService.track('stock', 'stock_detail_viewed', stock.symbol, { price: stock.price, change24h: stock.change24h });
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
    this.destroyLeafletMap();
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
    this.fuelCalcSelectedFuel = fuelType;
    localStorage.setItem('default_fuel_type', fuelType);
    this.analyticsService.track('fuel', 'default_fuel_selected', fuelType);
    this.updateFuelWidgetDisplay();
  }

  setDefaultCurrency(currencyCode: string) {
    this.selectedDefaultCurrency = currencyCode;
    localStorage.setItem('default_currency', currencyCode);
    this.analyticsService.track('currency', 'default_currency_selected', currencyCode);
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
    if (this.selectedHolidayDetail) {
      this.analyticsService.track('holidays', 'holiday_viewed', this.selectedHolidayDetail.name, { date: selectedDateStr });
    }
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
  '{"weather":true,"fuel":true,"stock":true,"crypto":true,"holidays":true,"aqi":true}'
);

// 2. Check if a widget supports notification toggles
supportsNotification(widgetId: string): boolean {
  return ['weather', 'fuel', 'stock', 'crypto', 'holidays', 'aqi', 'alerts'].includes(widgetId);
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
}

isNotificationActive(widgetId: string): boolean {
  if (!this.currentUser) return false;
  return this.notificationPreferences[widgetId] ?? true;
}

  // --- PHARMACY (24/7 ДЕЖУРНИ АПТЕКИ) METHODS ---

  async loadDutyPharmacies() {
    try {
      const data = await this.pharmacyService.fetchPharmacies();
      this.pharmaciesList = data || [];
      this.updateNearestPharmacy();
      this.updateFilteredPharmacies();
      this.updatePharmacyWidgetDisplay();
      this.cdr.markForCheck();
    } catch (err) {
      console.warn('Error loading pharmacies in home page:', err);
    }
  }

  updateNearestPharmacy() {
    if (!this.pharmaciesList || this.pharmaciesList.length === 0) return;

    if (this.currentUserCoords) {
      for (const p of this.pharmaciesList) {
        if (p.latitude && p.longitude) {
          p.distanceKm = this.pharmacyService.calculateDistanceKm(
            this.currentUserCoords.latitude,
            this.currentUserCoords.longitude,
            p.latitude,
            p.longitude
          );
        }
      }

      const sorted = [...this.pharmaciesList]
        .filter(p => p.distanceKm != null)
        .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

      this.nearestPharmacy = sorted.length > 0 ? sorted[0] : null;
    } else if (this.currentCityName) {
      const userCity = this.currentCityName.toLowerCase();
      const cityMatch = this.pharmaciesList.find(p => p.city.toLowerCase().includes(userCity));
      this.nearestPharmacy = cityMatch || this.pharmaciesList[0] || null;
    } else {
      this.nearestPharmacy = this.pharmaciesList[0] || null;
    }
  }

  isPharmacyOpenNow(p?: DutyPharmacy | null): boolean {
    if (!p) return false;
    if (p.is_24_7) return true;
    if (!p.working_hours) return true;

    const lower = p.working_hours.toLowerCase();
    if (lower.includes('24/7') || lower.includes('00:00 - 24:00')) return true;

    const match = p.working_hours.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (!match) return true;

    const startH = parseInt(match[1], 10);
    const startM = parseInt(match[2], 10);
    const endH = parseInt(match[3], 10);
    const endM = parseInt(match[4], 10);

    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    if (endH === 24 || (endH === 0 && endM === 0 && startMinutes > 0)) {
      endMinutes = 24 * 60;
    }

    if (endMinutes < startMinutes) {
      return curMinutes >= startMinutes || curMinutes < endMinutes;
    }
    return curMinutes >= startMinutes && curMinutes < endMinutes;
  }

  updatePharmacyWidgetDisplay() {
    const w = this.allWidgets.find(item => item.id === 'pharmacy');
    if (w) {
      if (this.nearestPharmacy && this.nearestPharmacy.distanceKm != null) {
        w.value = this.pharmacyService.formatDistance(this.nearestPharmacy.distanceKm);
        if (this.nearestPharmacy.is_24_7) {
          w.unit = '24/7';
        } else {
          const isOpen = this.isPharmacyOpenNow(this.nearestPharmacy);
          w.unit = isOpen 
            ? (this.translate.instant('PHARMACY_MODAL.OPEN') || 'Отворено') 
            : (this.translate.instant('PHARMACY_MODAL.CLOSED') || 'Затворено');
        }
      } else {
        w.value = '24/7';
        w.unit = this.translate.instant('PHARMACY_MODAL.OPEN_NOW') || 'Дежурна';
      }
      w.customColor = undefined;
    }
    this.filterWidgets();
  }

  updateFilteredPharmacies() {
    let list = [...this.pharmaciesList];

    if (this.selectedPharmacyCity) {
      const cityFilter = this.selectedPharmacyCity.toLowerCase().trim();
      list = list.filter(p => 
        p.city.toLowerCase().includes(cityFilter) || 
        (p.city_slug && p.city_slug.toLowerCase() === cityFilter)
      );
    }

    if (this.pharmacySearchQuery && this.pharmacySearchQuery.trim()) {
      const q = this.pharmacySearchQuery.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        (p.municipality && p.municipality.toLowerCase().includes(q)) ||
        p.city.toLowerCase().includes(q)
      );
    }

    if (this.currentUserCoords) {
      list.sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
    } else if (this.currentCityName) {
      const userCity = this.currentCityName.toLowerCase();
      list.sort((a, b) => {
        const aMatch = a.city.toLowerCase().includes(userCity) ? 0 : 1;
        const bMatch = b.city.toLowerCase().includes(userCity) ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    this.filteredPharmacies = list;

    if (this.pharmacyModalView === 'map' && this.leafletMap) {
      this.renderLeafletMarkers();
    }
  }

  selectPharmacyCity(city: string) {
    if (this.selectedPharmacyCity === city) {
      this.selectedPharmacyCity = '';
    } else {
      this.selectedPharmacyCity = city;
    }
    this.updateFilteredPharmacies();
    if (this.pharmacyModalView === 'map' && this.leafletMap) {
      this.centerLeafletMap();
    }
    this.cdr.markForCheck();
  }

  onPharmacySearchChange() {
    this.updateFilteredPharmacies();
    this.cdr.markForCheck();
  }

  setPharmacyModalView(view: 'list' | 'map') {
    this.pharmacyModalView = view;
    if (view === 'map') {
      setTimeout(() => {
        this.initLeafletMap();
      }, 100);
    }
    this.cdr.markForCheck();
  }

  private applyLeafletTileLayer() {
    if (!this.leafletMap) return;
    if (this.leafletTileLayer) {
      this.leafletMap.removeLayer(this.leafletTileLayer);
      this.leafletTileLayer = null;
    }

    this.leafletTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.leafletMap);
  }

  initLeafletMap() {
    const container = document.getElementById('pharmacy-leaflet-map');
    if (!container) return;

    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
      this.leafletMarkers = [];
      this.leafletTileLayer = null;
    }

    const initialLat = this.currentUserCoords?.latitude ?? 41.9981;
    const initialLng = this.currentUserCoords?.longitude ?? 21.4254;

    this.leafletMap = L.map('pharmacy-leaflet-map', {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false
    });

    this.applyLeafletTileLayer();

    if (this.currentUserCoords) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="background: #2563eb; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px rgba(37,99,235,0.85);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker([this.currentUserCoords.latitude, this.currentUserCoords.longitude], { icon: userIcon })
        .addTo(this.leafletMap)
        .bindPopup(`<b>${this.translate.instant('AQI_MODAL.YOUR_LOCATION') || 'Ваша локација'}</b>`);
    }

    this.renderLeafletMarkers();

    setTimeout(() => {
      if (this.leafletMap) {
        this.leafletMap.invalidateSize();
        this.centerLeafletMap();
      }
    }, 250);
  }

  renderLeafletMarkers() {
    if (!this.leafletMap) return;

    for (const marker of this.leafletMarkers) {
      this.leafletMap.removeLayer(marker);
    }
    this.leafletMarkers = [];

    const pinBorderColor = '#ffffff';
    const pharmacyIcon = L.divIcon({
      className: 'pharmacy-leaflet-pin',
      html: `<div style="background: #10b981; width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid ${pinBorderColor}; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 16px;">✚</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });

    for (const p of this.filteredPharmacies) {
      if (!p.latitude || !p.longitude) continue;

      const marker = L.marker([p.latitude, p.longitude], { icon: pharmacyIcon });
      
      const phoneHtml = p.phone ? `<a href="tel:${p.phone}" class="map-popup-phone">📞 ${p.phone}</a>` : '';
      const distHtml = p.distanceKm != null ? `<div class="map-popup-dist">📍 ${this.pharmacyService.formatDistance(p.distanceKm)}</div>` : '';
      const directionsUrl = p.google_maps_url || `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`;
      
      const isOpen = this.isPharmacyOpenNow(p);
      const openLabel = this.translate.instant('PHARMACY_MODAL.OPEN') || 'Отворено';
      const closedLabel = this.translate.instant('PHARMACY_MODAL.CLOSED') || 'Затворено';
      const directionsLabel = this.translate.instant('PHARMACY_MODAL.DIRECTIONS') || 'Насоки';

      const badgeHtml = p.is_24_7
        ? `<div class="map-popup-badge-open">24/7 ${openLabel}</div>`
        : (isOpen
            ? `<div class="map-popup-badge-open">🟢 ${openLabel}</div>`
            : `<div class="map-popup-badge-closed">🔴 ${closedLabel}</div>`
          );

      const hoursHtml = p.working_hours 
        ? `<div class="map-popup-hours">🕒 ${p.working_hours}</div>` 
        : '';

      const popupContent = `
        <div class="pharmacy-leaflet-popup">
          <div class="map-popup-title">${p.name}</div>
          <div class="map-popup-subtitle">${p.address}, ${p.city}</div>
          ${hoursHtml}
          ${badgeHtml}
          ${distHtml}
          ${phoneHtml}
          <div style="margin-top: 10px;">
            <a href="${directionsUrl}" target="_blank" class="map-popup-directions-btn">${directionsLabel} 🧭</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(this.leafletMap);
      this.leafletMarkers.push(marker);
    }
  }

  centerLeafletMap() {
    if (!this.leafletMap) return;
    if (this.filteredPharmacies.length === 0) return;

    if (this.selectedPharmacyCity) {
      const firstInCity = this.filteredPharmacies.find(p => p.latitude && p.longitude);
      if (firstInCity) {
        this.leafletMap.setView([firstInCity.latitude, firstInCity.longitude], 13);
        return;
      }
    }

    if (this.currentUserCoords) {
      this.leafletMap.setView([this.currentUserCoords.latitude, this.currentUserCoords.longitude], 14);
    } else {
      const first = this.filteredPharmacies.find(p => p.latitude && p.longitude);
      if (first) {
        this.leafletMap.setView([first.latitude, first.longitude], 12);
      }
    }
  }

  destroyLeafletMap() {
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
      this.leafletMarkers = [];
    }
  }

  openDirections(pharmacy: DutyPharmacy) {
    const muni = pharmacy.municipality || 
      (pharmacy.city === 'Скопје' && pharmacy.latitude && pharmacy.longitude 
        ? this.weatherService.resolveMunicipalityName(pharmacy.latitude, pharmacy.longitude) || undefined 
        : undefined);

    this.analyticsService.track(
      'pharmacy', 
      'route_clicked', 
      pharmacy.name, 
      { address: pharmacy.address }, 
      muni
    );
    const url = pharmacy.google_maps_url || `https://www.google.com/maps/dir/?api=1&destination=${pharmacy.latitude},${pharmacy.longitude}`;
    window.open(url, '_blank');
  }

  getPharmacyPhoneList(phoneStr?: string | null): string[] {
    if (!phoneStr) return [];
    const candidates = phoneStr.split(/[,;\n]|\s+или\s+|\s+or\s+/i);
    const result: string[] = [];
    for (const c of candidates) {
      const trimmed = c.trim().replace(/^[,;.\s]+|[,;.\s]+$/g, '');
      const digitsCount = (trimmed.match(/\d/g) || []).length;
      if (digitsCount >= 5) {
        // Extract the pure phone sequence if pharmacist name was prefixed
        const match = trimmed.match(/(?:[+0-9][0-9\s\/\-]{4,}[0-9])/);
        if (match) {
          result.push(match[0].trim());
        } else {
          result.push(trimmed);
        }
      }
    }
    return result;
  }

  getFormattedWorkingHoursLines(hours?: string | null): string[] {
    if (!hours) return [];
    if (hours.includes('\n')) {
      return hours.split('\n').map(l => l.trim()).filter(Boolean);
    }
    const parts = hours.split(/,\s*(?=(?:сабота|недела|нед\.|саб\.|sabota|nedela|saturday|sunday)\b)/i);
    return parts.map(p => p.trim()).filter(Boolean);
  }

  dialPharmacy(phone?: string) {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone) return;
    window.location.href = `tel:${cleanPhone}`;
  }

  async onCallPharmacyClick(pharmacy: DutyPharmacy) {
    const muni = pharmacy.municipality || 
      (pharmacy.city === 'Скопје' && pharmacy.latitude && pharmacy.longitude 
        ? this.weatherService.resolveMunicipalityName(pharmacy.latitude, pharmacy.longitude) || undefined 
        : undefined);

    this.analyticsService.track(
      'pharmacy', 
      'call_clicked', 
      pharmacy.name, 
      { phone: pharmacy.phone }, 
      muni
    );
    const phones = this.getPharmacyPhoneList(pharmacy.phone);
    if (phones.length === 0) return;
    if (phones.length === 1) {
      this.dialPharmacy(phones[0]);
      return;
    }

    const cancelText = this.currentLang === 'en' ? 'Cancel' : (this.currentLang === 'al' ? 'Anulo' : 'Откажи');
    const headerTitle = this.currentLang === 'en' 
      ? 'Choose number to call' 
      : (this.currentLang === 'al' ? 'Zgjidhni numrin për të thirrur' : 'Изберете број за повикување');

    const buttons: any[] = phones.map(num => ({
      text: num,
      icon: 'call',
      handler: () => {
        this.dialPharmacy(num);
      }
    }));

    buttons.push({
      text: cancelText,
      role: 'cancel',
      icon: 'close'
    });

    const actionSheet = await this.actionSheetCtrl.create({
      header: pharmacy.name,
      subHeader: headerTitle,
      buttons
    });

    await actionSheet.present();
  }

  formatPharmacyDistance(distanceKm?: number): string {
    return this.pharmacyService.formatDistance(distanceKm);
  }

  // --- GAS STATIONS (БЕНЗИНСКИ ПУМПИ) METHODS ---

  async loadGasStations() {
    try {
      const data = await this.gasStationService.fetchGasStations();
      const rawStations = data || [];
      const cityMap: Record<string, string> = {
        'skopje': 'Скопје',
        'bitola': 'Битола',
        'ohrid': 'Охрид',
        'prilep': 'Прилеп',
        'tetovo': 'Тетово',
        'gostivar': 'Гостивар',
        'strumica': 'Струмица',
        'veles': 'Велес',
        'stip': 'Штип',
        'kumanovo': 'Куманово',
        'kavadarci': 'Кавадарци',
        'gevgelija': 'Гевгелија',
        'berovo': 'Берово'
      };
      this.gasStationsList = rawStations.map(s => {
        const clean = (s.city || '').trim();
        const norm = clean.toLowerCase();
        return {
          ...s,
          city: cityMap[norm] || clean
        };
      });
      this.gasCities = Array.from(new Set(this.gasStationsList.map(s => s.city).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      this.updateNearestGasStation();
      this.updateFilteredGasStations();
      this.updateGasWidgetDisplay();
      this.cdr.markForCheck();
    } catch (err) {
      console.warn('Error loading gas stations in home page:', err);
    }
  }

  updateNearestGasStation() {
    if (!this.gasStationsList || this.gasStationsList.length === 0) return;

    if (this.currentUserCoords) {
      for (const s of this.gasStationsList) {
        if (s.latitude && s.longitude) {
          s.distanceKm = this.gasStationService.calculateDistanceKm(
            this.currentUserCoords.latitude,
            this.currentUserCoords.longitude,
            s.latitude,
            s.longitude
          );
        }
      }

      const sorted = [...this.gasStationsList]
        .filter(s => s.distanceKm != null)
        .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

      this.nearestGasStation = sorted.length > 0 ? sorted[0] : null;
    } else if (this.currentCityName) {
      const userCity = this.currentCityName.toLowerCase();
      const cityMatch = this.gasStationsList.find(s => s.city.toLowerCase().includes(userCity));
      this.nearestGasStation = cityMatch || this.gasStationsList[0] || null;
    } else {
      this.nearestGasStation = this.gasStationsList[0] || null;
    }
  }

  updateGasWidgetDisplay() {
    const w = this.allWidgets.find(item => item.id === 'gas_stations');
    if (w) {
      if (this.nearestGasStation && this.nearestGasStation.distanceKm != null) {
        w.value = this.gasStationService.formatDistance(this.nearestGasStation.distanceKm);
        w.unit = this.nearestGasStation.brand || 'Пумпа';
      } else {
        w.value = '⛽';
        w.unit = 'Пумпи';
      }
      w.customColor = undefined;
    }
    this.filterWidgets();
  }

  updateFilteredGasStations() {
    let list = [...this.gasStationsList];

    // City Filter
    if (this.selectedGasCity) {
      const cityFilter = this.selectedGasCity.toLowerCase().trim();
      list = list.filter(s => s.city.toLowerCase().includes(cityFilter));
    }

    // Brand Filter
    if (this.selectedGasBrand && this.selectedGasBrand !== 'all') {
      if (this.selectedGasBrand === 'other') {
        const topBrands = ['макпетрол', 'лукоил', 'окта', 'детоил', 'гулф', 'шел'];
        list = list.filter(s => !topBrands.some(tb => s.brand.toLowerCase().includes(tb)));
      } else {
        const b = this.selectedGasBrand.toLowerCase();
        list = list.filter(s => s.brand.toLowerCase().includes(b));
      }
    }

    // Service Filter
    if (this.selectedGasService && this.selectedGasService !== 'all') {
      if (this.selectedGasService === '24_7') {
        list = list.filter(s => s.is_24_7);
      } else if (this.selectedGasService === 'lpg') {
        list = list.filter(s => s.has_lpg);
      } else if (this.selectedGasService === 'ev') {
        list = list.filter(s => s.has_ev);
      } else if (this.selectedGasService === 'car_wash') {
        list = list.filter(s => s.has_car_wash);
      } else if (this.selectedGasService === 'shop') {
        list = list.filter(s => s.has_shop);
      }
    }

    // Search Query
    if (this.gasSearchQuery && this.gasSearchQuery.trim()) {
      const q = this.gasSearchQuery.toLowerCase().trim();
      list = list.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.brand.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q)
      );
    }

    // Sort by proximity
    if (this.currentUserCoords) {
      list.sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
    } else if (this.currentCityName) {
      const userCity = this.currentCityName.toLowerCase();
      list.sort((a, b) => {
        const aMatch = a.city.toLowerCase().includes(userCity) ? 0 : 1;
        const bMatch = b.city.toLowerCase().includes(userCity) ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    this.filteredGasStations = list;

    if (this.gasModalView === 'map' && this.gasLeafletMap) {
      this.renderGasLeafletMarkers();
    }
  }

  selectGasCity(city: string) {
    this.selectedGasCity = this.selectedGasCity === city ? '' : city;
    this.updateFilteredGasStations();
    if (this.gasModalView === 'map' && this.gasLeafletMap) {
      this.centerGasLeafletMap();
    }
    this.cdr.markForCheck();
  }

  selectGasBrand(brandId: string) {
    this.selectedGasBrand = brandId;
    if (brandId && brandId !== 'all') {
      this.analyticsService.track('gas_stations', 'brand_filtered', brandId);
    }
    this.updateFilteredGasStations();
    if (this.gasModalView === 'map' && this.gasLeafletMap) {
      this.centerGasLeafletMap();
    }
    setTimeout(() => {
      const modalBodies = document.querySelectorAll('.modal-body');
      modalBodies.forEach(mb => { mb.scrollLeft = 0; });
      if (brandId === 'all') {
        const brandScroll = document.querySelector('.gas-chip-scroll');
        if (brandScroll) brandScroll.scrollLeft = 0;
      }
    }, 40);
    this.cdr.markForCheck();
  }

  selectGasService(serviceId: string) {
    this.selectedGasService = serviceId;
    this.updateFilteredGasStations();
    if (this.gasModalView === 'map' && this.gasLeafletMap) {
      this.centerGasLeafletMap();
    }
    this.cdr.markForCheck();
  }

  onGasSearchChange() {
    this.updateFilteredGasStations();
    this.cdr.markForCheck();
  }

  setGasModalView(view: 'list' | 'map') {
    this.gasModalView = view;
    if (view === 'map') {
      setTimeout(() => {
        this.initGasLeafletMap();
      }, 100);
    }
    this.cdr.markForCheck();
  }

  private applyGasLeafletTileLayer() {
    if (!this.gasLeafletMap) return;
    if (this.gasLeafletTileLayer) {
      this.gasLeafletMap.removeLayer(this.gasLeafletTileLayer);
      this.gasLeafletTileLayer = null;
    }

    this.gasLeafletTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.gasLeafletMap);
  }

  initGasLeafletMap() {
    const container = document.getElementById('gas-leaflet-map');
    if (!container) return;

    if (this.gasLeafletMap) {
      this.gasLeafletMap.remove();
      this.gasLeafletMap = null;
      this.gasLeafletMarkers = [];
      this.gasLeafletTileLayer = null;
    }

    const initialLat = this.currentUserCoords?.latitude ?? 41.9981;
    const initialLng = this.currentUserCoords?.longitude ?? 21.4254;

    this.gasLeafletMap = L.map('gas-leaflet-map', {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false
    });

    this.applyGasLeafletTileLayer();

    if (this.currentUserCoords) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="background: #2563eb; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px rgba(37,99,235,0.85);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker([this.currentUserCoords.latitude, this.currentUserCoords.longitude], { icon: userIcon })
        .addTo(this.gasLeafletMap)
        .bindPopup(`<b>${this.translate.instant('GAS_MODAL.YOUR_LOCATION') || 'Ваша локација'}</b>`);
    }

    this.renderGasLeafletMarkers();

    setTimeout(() => {
      if (this.gasLeafletMap) {
        this.gasLeafletMap.invalidateSize();
        this.centerGasLeafletMap();
      }
    }, 250);
  }

  renderGasLeafletMarkers() {
    if (!this.gasLeafletMap) return;

    this.gasLeafletMarkers.forEach(m => m.remove());
    this.gasLeafletMarkers = [];

    const directionsLabel = this.translate.instant('GAS_MODAL.DIRECTIONS') || 'Насоки';

    for (const s of this.filteredGasStations) {
      if (!s.latitude || !s.longitude) continue;

      const style = this.gasStationService.getBrandBadgeStyle(s.chain);
      const icon = L.divIcon({
        className: 'gas-leaflet-pin',
        html: `
          <div style="background: #0f172a; border: 2.5px solid ${style.color}; width: 28px; height: 28px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1;">
            ⛽
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

      const distHtml = s.distanceKm != null ? `<div class="map-popup-dist" style="font-weight: 700; margin: 4px 0;">📍 ${this.gasStationService.formatDistance(s.distanceKm)}</div>` : '';
      const encodedName = encodeURIComponent(s.name);
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&destination_place_id=${encodedName}`;

      const popupHtml = `
        <div class="gas-leaflet-popup">
          <div class="map-popup-card" style="font-family: inherit; font-size: 13px; line-height: 1.4;">
            <div class="map-popup-title" style="font-weight: 800; font-size: 14px; margin-bottom: 2px;">${s.name}</div>
            <div class="map-popup-subtitle" style="font-size: 12px; margin-bottom: 3px;">${s.address} (${s.city})</div>
            ${distHtml}
            <div style="margin: 4px 0; font-size: 11px;">
              <span style="background: rgba(16,185,129,0.15); color: #047857; padding: 2px 6px; border-radius: 6px; font-weight: 700;">${s.is_24_7 ? '24/7' : s.working_hours}</span>
              ${s.has_lpg ? '<span style="background: rgba(59,130,246,0.15); color: #1d4ed8; padding: 2px 6px; border-radius: 6px; margin-left: 4px; font-weight: 700;">LPG</span>' : ''}
              ${s.has_ev ? '<span style="background: rgba(245,158,11,0.15); color: #b45309; padding: 2px 6px; border-radius: 6px; margin-left: 4px; font-weight: 700;">EV</span>' : ''}
            </div>
            <a href="${mapsUrl}" target="_blank" class="gas-popup-directions-btn" style="display: block; margin-top: 8px; text-align: center; color: white; padding: 6px 12px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 12px;">
              🚗 ${directionsLabel}
            </a>
          </div>
        </div>
      `;

      const marker = L.marker([s.latitude, s.longitude], { icon })
        .addTo(this.gasLeafletMap)
        .bindPopup(popupHtml, { maxWidth: 260 });

      this.gasLeafletMarkers.push(marker);
    }
  }

  centerGasLeafletMap() {
    if (!this.gasLeafletMap) return;

    // 1. If filtered by specific city, zoom in to that city
    if (this.selectedGasCity) {
      const firstInCity = this.filteredGasStations.find(s => s.latitude && s.longitude);
      if (firstInCity) {
        this.gasLeafletMap.setView([firstInCity.latitude, firstInCity.longitude], 13);
        return;
      }
    }

    // 2. Center and zoom towards user's GPS location (neighborhood street level)
    if (this.currentUserCoords) {
      this.gasLeafletMap.setView([this.currentUserCoords.latitude, this.currentUserCoords.longitude], 14);
      return;
    }

    // 3. Fallback to nearest gas station if available
    if (this.nearestGasStation && this.nearestGasStation.latitude && this.nearestGasStation.longitude) {
      this.gasLeafletMap.setView([this.nearestGasStation.latitude, this.nearestGasStation.longitude], 14);
      return;
    }

    // 4. Default fallback: first station or center of city
    const first = this.filteredGasStations.find(s => s.latitude && s.longitude);
    if (first) {
      this.gasLeafletMap.setView([first.latitude, first.longitude], 13);
    } else {
      this.gasLeafletMap.setView([41.9981, 21.4254], 13);
    }
  }

  destroyGasLeafletMap() {
    if (this.gasLeafletMap) {
      this.gasLeafletMap.remove();
      this.gasLeafletMap = null;
      this.gasLeafletMarkers = [];
      this.gasLeafletTileLayer = null;
    }
  }

  openGasDirections(station: GasStation) {
    const stationMuni = (station.city === 'Скопје' && station.latitude && station.longitude)
      ? (this.weatherService.resolveMunicipalityName(station.latitude, station.longitude) || undefined)
      : undefined;

    this.analyticsService.track(
      'gas_stations', 
      'route_clicked', 
      station.brand || station.name, 
      { name: station.name, address: station.address }, 
      stationMuni
    );
    this.gasStationService.openDirections(station.latitude, station.longitude, station.name);
  }

  dialGasPhone(phone?: string | null) {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone) return;
    window.location.href = `tel:${cleanPhone}`;
  }

  formatGasDistance(km?: number): string {
    return this.gasStationService.formatDistance(km);
  }

  getGasBrandBadgeStyle(chain: string) {
    return this.gasStationService.getBrandBadgeStyle(chain);
  }

  // --- UTILITY ALERTS (ПРЕКИНИ ЗА СТРУЈА & ВОДА) METHODS ---

  async loadUtilityAlerts() {
    try {
      const data = await this.utilityAlertService.fetchAlerts();
      const nonMacedonian = ['албанија', 'грција', 'србија', 'косово', 'бугарија'];
      this.alertsList = (data || []).filter(a => {
        const c = (a.city || '').toLowerCase();
        const m = (a.municipality || '').toLowerCase();
        return !nonMacedonian.some(nm => c.includes(nm) || m.includes(nm));
      });
      this.alertCities = Array.from(new Set(this.alertsList.map(a => a.city).filter(c => {
        if (!c) return false;
        const norm = c.toLowerCase().trim();
        return !nonMacedonian.some(nm => norm.includes(nm));
      }))).sort((a, b) => a.localeCompare(b));
      this.updateFilteredAlerts();
      this.updateAlertsWidgetDisplay();
      this.cdr.markForCheck();
    } catch (err) {
      console.warn('Error loading utility alerts in home page:', err);
    }
  }

  updateAlertsWidgetDisplay() {
    const w = this.allWidgets.find(item => item.id === 'alerts');
    if (w) {
      const city = this.currentCityName || 'Скопје';
      const count = this.utilityAlertService.getActiveAlertsCount(city, this.alertsList);
      w.value = count > 0 ? `${count}` : '0';
      w.unit = count === 1 ? 'Прекин' : 'Прекини';
      w.customColor = count > 0 ? '#f59e0b' : '#10b981';
    }
    this.filterWidgets();
  }

  updateFilteredAlerts() {
    let list = [...this.alertsList];

    // 1. Type Filter ('all', 'power', 'water', 'other')
    if (this.selectedAlertType && this.selectedAlertType !== 'all') {
      if (this.selectedAlertType === 'other') {
        list = list.filter(a => a.type === 'other' || a.type === 'earthquake' || a.type === 'road');
      } else {
        list = list.filter(a => a.type === this.selectedAlertType);
      }
    }

    // 2. City Filter
    if (this.selectedAlertCity) {
      const cityFilter = this.selectedAlertCity.toLowerCase().trim();
      list = list.filter(a => 
        a.city.toLowerCase().includes(cityFilter) || 
        (a.municipality && a.municipality.toLowerCase().includes(cityFilter))
      );
    }

    // 3. Search Query Filter
    if (this.alertSearchQuery) {
      const q = this.alertSearchQuery.toLowerCase().trim();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.address && a.address.toLowerCase().includes(q)) ||
        (a.municipality && a.municipality.toLowerCase().includes(q)) ||
        a.city.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q))
      );
    }

    // 4. Annotate distances from user coordinates if available
    if (this.currentUserCoords) {
      list = this.utilityAlertService.annotateDistances(list, this.currentUserCoords);
    }

    // 5. Sort: active first, then upcoming, then resolved; and by start_time
    const statusWeight: Record<string, number> = {
      'active': 1,
      'upcoming': 2,
      'resolved': 3
    };

    list.sort((a, b) => {
      const wA = statusWeight[a.status] || 99;
      const wB = statusWeight[b.status] || 99;
      if (wA !== wB) return wA - wB;
      const tA = new Date(a.start_time).getTime();
      const tB = new Date(b.start_time).getTime();
      return tB - tA;
    });

    this.filteredAlerts = list;
    this.cdr.markForCheck();
  }

  shouldShowDescription(alert: UtilityAlert): boolean {
    if (!alert.description) return false;
    if (!alert.address) return true;
    const cleanA = this.utilityAlertService.cleanAlertText(alert.address).toLowerCase().trim();
    const cleanD = this.utilityAlertService.cleanAlertText(alert.description).toLowerCase().trim();
    if (cleanA === cleanD) return false;
    if (cleanD.includes(cleanA) || cleanA.includes(cleanD)) return false;
    return alert.description !== alert.address && alert.description !== alert.title;
  }

  selectAlertType(type: 'all' | 'power' | 'water' | 'other') {
    this.selectedAlertType = type;
    this.analyticsService.track('alerts', 'category_filtered', type);
    this.updateFilteredAlerts();
    this.triggerHaptic(20);
  }

  selectAlertCity(city: string) {
    this.selectedAlertCity = city;
    this.analyticsService.track('alerts', 'city_filtered', city);
    this.updateFilteredAlerts();
    this.triggerHaptic(20);
  }

  onAlertSearchChange() {
    this.updateFilteredAlerts();
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'power': return 'flash';
      case 'water': return 'water';
      case 'earthquake': return 'pulse';
      case 'road': return 'car';
      default: return 'warning';
    }
  }

  getAlertSourceBadge(alert: UtilityAlert): string {
    switch (alert.type) {
      case 'power': return this.translate.instant('ALERTS_MODAL.SOURCE_EVN') || 'ЕВН Македонија';
      case 'water': return this.translate.instant('ALERTS_MODAL.SOURCE_VODOVOD') || 'ЈП Водовод';
      case 'earthquake': return this.translate.instant('ALERTS_MODAL.SOURCE_EMSC') || 'Сеизмолошки сервис · EMSC';
      case 'road': return this.translate.instant('ALERTS_MODAL.SOURCE_AMSM') || 'АМСМ · Сообраќај';
      default: return alert.source_title || this.translate.instant('ALERTS_MODAL.SOURCE_OTHER') || 'Соопштение';
    }
  }

  getAlertStatusLabel(alert: UtilityAlert): string {
    if (alert.type === 'earthquake' && alert.status === 'active') {
      return this.translate.instant('ALERTS_MODAL.STATUS_RECENT') || 'Неодамна';
    }
    if (alert.status === 'active') {
      return this.translate.instant('ALERTS_MODAL.STATUS_ACTIVE') || 'Во тек';
    }
    if (alert.status === 'upcoming') {
      return this.translate.instant('ALERTS_MODAL.STATUS_UPCOMING') || 'Најавено';
    }
    return this.translate.instant('ALERTS_MODAL.STATUS_RESOLVED') || 'Завршено';
  }
}
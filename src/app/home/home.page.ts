// src/app/home/home.page.ts
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase';
import { WeatherService } from '../services/weather';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { User } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';
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
    IonModal 
  ]
})
export class HomePage implements OnInit, OnDestroy {
  private supabaseService = inject(SupabaseService);
  private weatherService = inject(WeatherService); // <-- Inject the Weather service
  private translate = inject(TranslateService);
  private router = inject(Router);

  userTier: 'guest' | 'logged-in' | 'premium' = 'guest';
  currentUser: User | null = null;
  currentLang = 'mk';
  isPremiumModalOpen = false; 
  isUpgrading = false;
  
  // Dynamic header city text
  currentCityName = 'Скопје'; 

  private weatherSub: Subscription | null = null;

  allWidgets: Widget[] = [
    { id: 'aqi', translationKey: 'WIDGETS.AQI', value: '42', unit: 'Добро', icon: '💨', isPremium: false },
    // Weather and UV start as loading states or clean placeholders
    { id: 'weather', translationKey: 'WIDGETS.WEATHER', value: '--°', unit: 'Вчитување...', icon: '☁️', isPremium: false },
    { id: 'currency', translationKey: 'WIDGETS.CURRENCY', value: '61.49', unit: 'МКД', icon: '💶', isPremium: false },
    { id: 'fuel', translationKey: 'WIDGETS.FUEL', value: '82.5', unit: 'МКД', icon: '⛽', isPremium: false },
    { id: 'holiday', translationKey: 'WIDGETS.HOLIDAY', value: '12д', unit: 'Празник', icon: '📅', isPremium: true },
    { id: 'uv', translationKey: 'WIDGETS.UV', value: '-', unit: 'UV', icon: '☀️', isPremium: true }
  ];

  visibleWidgets: Widget[] = [];

  constructor() {
    this.translate.use('mk');
  }

  ngOnInit() {
    // 1. Manage existing tier subscriptions
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

    // 2. Load dynamic hardware GPS Weather & UV Index data
    this.fetchLiveMetrics();
  }

fetchLiveMetrics() {
  this.weatherSub = this.weatherService.getLocalWeatherData().subscribe({
    next: async (data) => {
      if (!data || !data.current) {
        console.warn('Weather data was empty or invalid.');
        return;
      }

      // 1. Parse real-time metrics out of the API payload
      const temp = Math.round(data.current.temperature_2m);
      const code = data.current.weather_code;
      const statusText = this.weatherService.getWeatherDesc(code);

      const currentHourStr = new Date().toISOString().substring(0, 14) + '00';
      const hourIndex = data.hourly.time.findIndex((t: string) => t.startsWith(currentHourStr));
      const uvValue = hourIndex !== -1 ? Math.round(data.hourly.uv_index[hourIndex]) : 0;

      // 2. Refresh the local view layout array
      this.allWidgets = this.allWidgets.map(widget => {
        if (widget.id === 'weather') return { ...widget, value: `${temp}°`, unit: statusText };
        if (widget.id === 'uv') return { ...widget, value: `${uvValue}` };
        return widget;
      });
      this.filterWidgets();

      // 3. BACKGROUND SYNC: Share this information with your Supabase server
      if (this.currentUser) {
        try {
          // Fall back to Skopje coordinates if GPS data arrays are not supplied
          const lat = data.latitude || 41.9965;
          const lng = data.longitude || 21.4314;

          await this.supabaseService.syncUserWeather({
            userId: this.currentUser.id,
            lat: lat,
            lng: lng,
            temp: temp,
            code: code,
            uv: uvValue
          });
          console.log('Successfully synced local metrics to Supabase backend table.');
        } catch (syncError) {
          // Fails silently for the user so their experience remains perfectly smooth
          console.error('Weather background pipeline failed:', syncError);
        }
      }
    },
    error: (err) => {
      console.error('Failed to load GPS metrics.', err);
    }
  });
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

  onWidgetClick(widgetId: string, isPremium: boolean) {
    if (isPremium && this.userTier !== 'premium') {
      this.setPremiumModal(true); 
    } else {
      console.log(`Open: ${widgetId}`);
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
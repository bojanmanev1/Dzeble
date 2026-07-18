// src/app/home/home.page.ts
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { User } from '@supabase/supabase-js';
import { 
  IonContent, 
  IonSelect, 
  IonSelectOption,
  IonModal // <-- Import IonModal
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
    IonModal // <-- Add to imports
  ]
})
export class HomePage implements OnInit {
  private supabaseService = inject(SupabaseService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  userTier: 'guest' | 'logged-in' | 'premium' = 'guest';
  currentUser: User | null = null;
  currentLang = 'mk';
  isPremiumModalOpen = false; // Controls premium modal visibility
  isUpgrading = false;

  allWidgets: Widget[] = [
    { id: 'aqi', translationKey: 'WIDGETS.AQI', value: '42', unit: 'Добро', icon: '💨', isPremium: false },
    { id: 'weather', translationKey: 'WIDGETS.WEATHER', value: '24°', unit: 'Облачно', icon: '☁️', isPremium: false },
    { id: 'currency', translationKey: 'WIDGETS.CURRENCY', value: '61.49', unit: 'МКД', icon: '💶', isPremium: false },
    { id: 'fuel', translationKey: 'WIDGETS.FUEL', value: '82.5', unit: 'МКД', icon: '⛽', isPremium: false },
    { id: 'holiday', translationKey: 'WIDGETS.HOLIDAY', value: '12д', unit: 'Празник', icon: '📅', isPremium: true },
    { id: 'uv', translationKey: 'WIDGETS.UV', value: '6', unit: 'UV', icon: '☀️', isPremium: true }
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

  // Opens/Closes the modal
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
      this.setPremiumModal(true); // Open modal instead of breaking
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
}
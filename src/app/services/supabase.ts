import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  
  // Expose user state as an observable so the UI reacts instantly when they log in
  public currentUser$ = new BehaviorSubject<User | null>(null);
  public isPremium$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

    // Listen to Auth changes automatically (e.g., when a guest logs in)
    this.supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      this.currentUser$.next(user);
      
      if (user) {
        this.checkPremiumStatus(user.id);
      } else {
        this.isPremium$.next(false);
      }
    });
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  // A quick method to check if their profile has premium active
  private async checkPremiumStatus(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .single();

    if (data && !error) {
      this.isPremium$.next(data.is_premium);
    }
  }
// 1. SIGN UP method
async signUp(email: string, password: string) {
    const cleanEmail = email.trim().replace(/^["']|["']$/g, '');
    
    const { data, error } = await this.supabase.auth.signUp({
      email: cleanEmail,
      password
    });
    if (error) throw error;
    return data;
  }

  // 2. SIGN IN method
async signIn(email: string, password: string) {
    const cleanEmail = email.trim().replace(/^["']|["']$/g, '');

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });
    if (error) throw error;
    return data;
  }
  // Sign out the current user
async signOut() {
    // 1. Remove our local device tracking session
    await Preferences.remove({ key: 'active_app_session_id' });
    
    // 2. Await the sign out call to resolve the promise, then get the error
    const { error } = await this.supabase.auth.signOut();
    
    // 3. Update local observables so the UI reacts instantly
    this.currentUser$.next(null);
    this.isPremium$.next(false);

    if (error) throw error;
  }

async upgradeToPremium(userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ is_premium: true })
      .eq('id', userId);

    if (error) {
      console.error('Error upgrading profile:', error);
      throw error;
    }

    // Push the updated state instantly to our app stream
    this.isPremium$.next(true);
    return true;
  }

  /**
 * Passive sync: Saves the current phone location and weather metrics to the database
 */
async syncUserWeather(metrics: {
    userId: string;
    lat: number;
    lng: number;
    temp: number;
    code: number;
    uv: number;
  }) {
    const { data, error } = await this.supabase
      .from('user_weather_status')
      .upsert({
        user_id: metrics.userId,
        latitude: metrics.lat,
        longitude: metrics.lng,
        current_temp: metrics.temp,
        weather_code: metrics.code,
        uv_index: metrics.uv,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error syncing weather to Supabase database:', error.message);
      throw error;
    }
    return data;
  }

async getLatestFuelPrices() {
    const { data, error } = await this.supabase
      .from('fuel_prices')
      .select('id, fuel_type, price_mkd, effective_from, updated_at')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching fuel data:', error.message);
      throw error;
    }
    
    return data;
  }

async getCachedMetricsForCity(city: string) {
    const { data, error } = await this.supabase
      .from('cached_weather_metrics')
      .select('*')
      .eq('city_name', city)
      .single();

    if (error) {
      console.error(`Error loading cached values for ${city}:`, error.message);
      return null;
    }
    return data;
  }


/**
   * 🌟 NEW: Calculates distance and returns cached weather metrics for the city 
   * closest to the device's current latitude and longitude.
   */
  async getNearestCityMetrics(userLat: number, userLon: number): Promise<any> {
    const { data: allCities, error } = await this.supabase
      .from('cached_weather_metrics')
      .select('*');

    if (error || !allCities || allCities.length === 0) {
      console.error('Error fetching cached weather metrics for nearest city:', error?.message);
      return null;
    }

    // Haversine formula calculation helper
    const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    let nearestCity = allCities[0];
    let minDistance = getDistanceKm(userLat, userLon, nearestCity.latitude, nearestCity.longitude);

    for (const city of allCities) {
      const dist = getDistanceKm(userLat, userLon, city.latitude, city.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestCity = city;
      }
    }

    return nearestCity;
  }

/**
 * Reads all active currency rates from the database cache table
 */
async getLatestCurrencyRates() {
    const { data, error } = await this.supabase
      .from('currency_rates')
      .select('target_currency, rate');

    if (error) {
      console.error('Error fetching currency values:', error.message);
      throw error;
    }
    return data;
  }

  // Add these methods to SupabaseService inside src/app/services/supabase.ts

async getUserWidgets(userId: string) {
  const { data, error } = await this.supabase
    .from('user_widgets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading custom widgets:', error.message);
    return [];
  }
  return data || [];
}

async addUserWidget(userId: string, title: string, eventDate: string) {
  const { data, error } = await this.supabase
    .from('user_widgets')
    .insert([
      {
        user_id: userId,
        title: title,
        event_date: eventDate,
        widget_type: 'calendar',
        icon: 'calendar-number'
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error inserting custom widget:', error.message);
    throw error;
  }
  return data;
}

async deleteUserWidget(widgetId: string) {
  const { error } = await this.supabase
    .from('user_widgets')
    .delete()
    .eq('id', widgetId);

  if (error) {
    console.error('Error deleting widget:', error.message);
    throw error;
  }
  return true;
}

/**
 * Saves or updates today's health metrics for the user
 */
async syncTodayHealthMetrics(userId: string, metrics: {
  steps: number;
  calories: number;
  distanceKm: number;
  notified10k: boolean;
  notified15k: boolean;
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  const { data, error } = await this.supabase
    .from('user_health_metrics')
    .upsert(
      {
        user_id: userId,
        step_count: metrics.steps,
        calories_burned: metrics.calories,
        distance_km: metrics.distanceKm,
        milestone_10k_notified: metrics.notified10k,
        milestone_15k_notified: metrics.notified15k,
        logged_date: todayStr,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,logged_date' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error syncing health metrics:', error.message);
  }
  return data;
}

/**
 * Retrieves the last 7 recorded days of health activity for the user
 */
async getLast7DaysHealthMetrics(userId: string) {
  const { data, error } = await this.supabase
    .from('user_health_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('logged_date', { ascending: false })
    .limit(7);

  if (error) {
    console.error('Error fetching 7-day health history:', error.message);
    return [];
  }
  return data || [];
}
}
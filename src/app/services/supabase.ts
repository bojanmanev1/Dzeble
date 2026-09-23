import { Injectable } from '@angular/core';
import { AuthChangeEvent, createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { Device } from '@capacitor/device';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  public supabase: SupabaseClient;
  
  public currentUser$ = new BehaviorSubject<User | null>(null);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

    // Global listener: Stream user ONLY if email is confirmed or authenticated via Google
    this.supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      const isEmailVerified = user?.email_confirmed_at != null || user?.app_metadata?.provider === 'google';

      if (user && isEmailVerified) {
        this.currentUser$.next(user);
      } else {
        this.currentUser$.next(null);
      }
    });
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  // --- SIGN UP ---
 async signUp(email: string, password: string, fullName: string) {
  const isNative = (window as any).Capacitor?.isNativePlatform();
  
  // Mobile app uses custom scheme, desktop/browser uses origin URL
  const redirectTo = isNative ? 'dzeble://auth/callback' : window.location.origin;

  const { data, error } = await this.supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: redirectTo
    }
  });
  if (error) throw error;
  return data;
}

  // --- SIGN IN WITH GOOGLE ---
async signInWithGoogle() {
  const isNative = (window as any).Capacitor?.isNativePlatform();
  const redirectTo = isNative ? 'dzeble://auth/callback' : `${window.location.origin}/login`;

  const { data, error } = await this.supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    }
  });

  if (error) throw error;
  return data;
}

  // --- SIGN IN WITH PASSWORD ---
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    
    if (data.user && data.user.email_confirmed_at) {
      await this.registerNewDeviceSession(data.user.id);
    }
    return data;
  }

  async getCurrentUser() {
    return await this.supabase.auth.getUser();
  }

  async resendConfirmationEmail(email: string) {
    const { data, error } = await this.supabase.auth.resend({
      type: 'signup',
      email: email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
    return data;
  }

async signOut() {
  try {
    const deviceId = await this.getDeviceId();

    // 1. Unbind the user and clear push token in database
    if (deviceId) {
      await this.supabase
        .from('user_devices')
        .update({ push_token: null, user_id: null, email: null })
        .eq('device_id', deviceId);
    }

    // 2. Clear listeners (DO NOT call unregister() - it breaks FCM re-registration)
    if (Capacitor.isNativePlatform()) {
      await PushNotifications.removeAllListeners();
    }
  } catch (err) {
    console.warn('Failed to clear push token during signout:', err);
  } finally {
    localStorage.removeItem('app_device_session_id');
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }
}

  async registerNewDeviceSession(userId: string) {
    const newSessionId = crypto.randomUUID();
    localStorage.setItem('app_device_session_id', newSessionId);

    const { error } = await this.supabase
      .from('profiles')
      .update({ active_session_id: newSessionId })
      .eq('id', userId);

    if (error) console.error('Failed to register device session:', error);
  }

async validateSession(user: User): Promise<boolean> {
  const localSessionId = localStorage.getItem('app_device_session_id');

  const { data, error } = await this.supabase
    .from('profiles')
    .select('active_session_id')
    .eq('id', user.id)
    .maybeSingle(); 

  if (error || !data) return true;

  if (data.active_session_id && data.active_session_id !== localSessionId) {
    await this.supabase.auth.signOut();
    localStorage.removeItem('app_device_session_id');
    return false;
  }

  return true;
}

  // --- APP METRICS & UTILITIES ---
  async syncUserWeather(metrics: { userId: string; lat: number; lng: number; temp: number; code: number; uv: number; }) {
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

    if (error) throw error;
    return data;
  }

 async getLatestFuelPrices() {
  const { data, error } = await this.supabase
    .from('fuel_prices')
    .select('id, fuel_type, price_mkd, previous_price_mkd, effective_from, updated_at')
    .order('id', { ascending: true });

  if (error) throw error;
  return data;
}

  async getCachedMetricsForCity(city: string) {
    const { data, error } = await this.supabase
      .from('cached_weather_metrics')
      .select('*')
      .eq('city_name', city)
      .single();

    if (error) return null;
    return data;
  }

  async getNearestCityMetrics(userLat: number, userLon: number): Promise<any> {
    const { data: allCities, error } = await this.supabase
      .from('cached_weather_metrics')
      .select('*');

    if (error || !allCities || allCities.length === 0) return null;

    const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

  async getLatestCurrencyRates() {
    const { data, error } = await this.supabase
      .from('currency_rates')
      .select('target_currency, rate');

    if (error) throw error;
    return data;
  }

  public async getDeviceId(): Promise<string> {
    try {
      const idInfo = await Device.getId();
      let deviceId = idInfo?.identifier;

      // Fallback UUID for web browser preview
      if (!deviceId) {
        deviceId = localStorage.getItem('guest_device_id') || crypto.randomUUID();
        localStorage.setItem('guest_device_id', deviceId);
      }

      return deviceId;
    } catch (e) {
      console.warn('Capacitor Device plugin unavailable, using web fallback:', e);
      let fallbackId = localStorage.getItem('guest_device_id');
      if (!fallbackId) {
        fallbackId = crypto.randomUUID();
        localStorage.setItem('guest_device_id', fallbackId);
      }
      return fallbackId;
    }
  }

  async getUserWidgets(userId: string) {
    const { data, error } = await this.supabase
      .from('user_widgets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return data || [];
  }

async syncDeviceRecord(userId?: string, userEmail?: string, pushToken?: string) {
  try {
    const deviceId = await this.getDeviceId();
    const savedSymbol = localStorage.getItem('stock_selected_symbol') || 'AAPL';
    const savedCrypto = localStorage.getItem('crypto_selected_pair') || 'BTCUSDT';

    const payload: any = {
      device_id: deviceId,
      stock_alert_symbol: savedSymbol,
      crypto_alert_pair: savedCrypto,
      last_active: new Date().toISOString()
    };

    if (userId) payload.user_id = userId;
    if (userEmail) payload.email = userEmail;
    if (pushToken) payload.push_token = pushToken;

    const { data, error } = await this.supabase
      .from('user_devices')
      .upsert(payload, { onConflict: 'device_id' })
      .select();

    if (error) {
      console.error('❌ Device sync DB error:', error.message);
    } else {
      console.log('✅ Device record synced cleanly:', data);
    }
  } catch (err) {
    console.error('❌ Device resolution failed:', err);
  }
}


  

// src/app/services/supabase.ts

async addUserWidget(userId: string, title: string, eventDate: string, icon: string = 'calendar-number') {
  const { data, error } = await this.supabase
    .from('user_widgets')
    .insert([
      {
        user_id: userId,
        title: title,
        event_date: eventDate,
        icon: icon
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding user widget:', error);
    throw error;
  }

  return data;
}

  async deleteUserWidget(widgetId: string) {
    const { error } = await this.supabase
      .from('user_widgets')
      .delete()
      .eq('id', widgetId);

    if (error) throw error;
    return true;
  }

  async syncTodayHealthMetrics(userId: string, metrics: { steps: number; calories: number; distanceKm: number; notified10k: boolean; notified15k: boolean; }) {
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

    return data;
  }

  async getLast7DaysHealthMetrics(userId: string) {
    const { data, error } = await this.supabase
      .from('user_health_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('logged_date', { ascending: false })
      .limit(7);

    if (error) return [];
    return data || [];
  }

  async getHolidays(): Promise<any[]> {
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear + 1}-12-31`;

    const { data, error } = await this.client
      .from('macedonian_holidays')
      .select('*')
      .gte('holiday_date', startDate)
      .lte('holiday_date', endDate)
      .order('holiday_date', { ascending: true });

    if (error) return [];
    return data || [];
  }

  async resetPasswordForEmail(email: string) {
  const isNative = (window as any).Capacitor?.isNativePlatform();
  const redirectTo = isNative 
    ? 'dzeble://reset-password' 
    : `${window.location.origin}/reset-password`;

  const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) throw error;
  return data;
}

async updateUserPassword(newPassword: string) {
  const { data, error } = await this.supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
  return data;
}
}
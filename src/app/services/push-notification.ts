import { Injectable } from '@angular/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  constructor(private supabaseService: SupabaseService) {}

public async initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications skipped: Platform is Web.');
    return;
  }

  // 1. Clear existing listeners to avoid duplicate trigger callbacks
  await PushNotifications.removeAllListeners();

  // 2. Token Registration Listener
  await PushNotifications.addListener('registration', async (token: Token) => {
    console.log('🔥 FCM Push Token:', token.value);
    await this.saveTokenToSupabase(token.value);
  });

  // 3. Registration Error Listener
  await PushNotifications.addListener('registrationError', (error: any) => {
    console.error('❌ Push Registration Error:', JSON.stringify(error));
  });

  // 4. Foreground Notification Received Listener
  await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('🔔 Push Received in Foreground:', notification);
  });

  // 5. Notification Tap Action Listener (Deep-linking)
  await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    console.log('👉 Notification Tapped:', action);
    const data = action.notification.data;

    if (data?.widgetId) {
      // Trigger modal or navigation based on target widget payload
      this.handleNotificationNavigation(data.widgetId, data.city);
    }
  });

  // 6. Create Default Android Channel
  await PushNotifications.createChannel({
    id: 'default',
    name: 'General Notifications',
    description: 'General app notifications',
    importance: 5,
    visibility: 1,
    vibration: true,
  });

  // 7. Request permissions & Register
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive === 'granted') {
    await PushNotifications.register();
  } else {
    console.warn('Push notification permission denied by user.');
  }
}

// Private helper to trigger deep link actions when tapped
private handleNotificationNavigation(widgetId: string, city?: string): void {
  console.log(`Opening widget: ${widgetId} for city: ${city}`);
  // Execute modal/router navigation logic here (e.g., emit an event or call service method)
}

private async saveTokenToSupabase(pushToken: string): Promise<void> {
  try {
    const deviceId = await this.supabaseService.getDeviceId();
    console.log('🔍 Attempting token save for deviceId:', deviceId);
    console.log('🔑 Token value:', pushToken);

    const { data, error, count } = await this.supabaseService.supabase
      .from('user_devices')
      .update({ push_token: pushToken })
      .eq('device_id', deviceId)
      .select();

    if (error) {
      console.error('❌ Supabase DB Error during token save:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      // console.warn('⚠️ No device row matched device_id:', deviceId, '— Attempting upsert fallback.');
      
      const { error: upsertErr } = await this.supabaseService.supabase
        .from('user_devices')
        .upsert({
          device_id: deviceId,
          push_token: pushToken,
          last_active: new Date().toISOString()
        }, { onConflict: 'device_id' });

      if (upsertErr) {
        console.error('❌ Upsert fallback failed:', upsertErr.message);
      } else {
        console.log('✅ Push token saved via upsert fallback!');
      }
    } else {
      // console.log('✅ Push token saved successfully to matching row:', data);
    }
  } catch (err) {
    console.error('❌ Exception in saveTokenToSupabase:', err);
  }
}
}
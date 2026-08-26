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

  // 1. Attach Listeners FIRST before registering or checking permissions
  PushNotifications.removeAllListeners();

  PushNotifications.addListener('registration', async (token: Token) => {
    await this.saveTokenToSupabase(token.value);
  });

  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('❌ Push Registration Error:', JSON.stringify(error));
  });

  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    // console.log('Push Received in Foreground:', notification);
  });

  // 2. Create Default Android Channel
  await PushNotifications.createChannel({
    id: 'default',
    name: 'General Notifications',
    description: 'General app notifications',
    importance: 5,
    visibility: 1,
    vibration: true,
  });

  // 3. Request permissions & Register
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
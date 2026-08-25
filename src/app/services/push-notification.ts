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
    console.log('🔥 FCM Push Registration Token:', token.value);
    await this.saveTokenToSupabase(token.value);
  });

  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('❌ Push Registration Error:', JSON.stringify(error));
  });

  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('Push Received in Foreground:', notification);
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
      await this.supabaseService.supabase
        .from('user_devices')
        .update({ push_token: pushToken })
        .eq('device_id', deviceId);
    } catch (err) {
      console.error('Failed to save push token to device row:', err);
    }
  }
}
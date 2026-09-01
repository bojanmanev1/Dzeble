import { Injectable } from '@angular/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  constructor(private supabaseService: SupabaseService) {}

  public async requestPushPermissionAndRegister(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications skipped: Platform is Web.');
      return false;
    }

    try {
      // 1. Clear existing listeners
      await PushNotifications.removeAllListeners();

      // 2. Set up registration listeners BEFORE registering
      PushNotifications.addListener('registration', async (token: Token) => {
        console.log('🔥 Fresh FCM Push Token Generated:', token.value);
        await this.saveTokenToSupabase(token.value);
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('❌ Push Registration Error:', JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('🔔 Push Received in Foreground:', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        const data = action.notification.data;
        if (data?.widgetId) {
          console.log(`Opening widget: ${data.widgetId}`);
        }
      });

      await PushNotifications.createChannel({
        id: 'default',
        name: 'General Notifications',
        description: 'General app notifications',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      // 3. Check and request permissions
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive === 'granted') {
        // 🚀 Force FCM to re-evaluate and emit a fresh registration token
        await PushNotifications.register();
        return true;
      } else {
        console.warn('Push notification permission denied.');
        return false;
      }
    } catch (err) {
      console.error('Error in requestPushPermissionAndRegister:', err);
      return false;
    }
  }

  private async saveTokenToSupabase(pushToken: string): Promise<void> {
    try {
      const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
      await this.supabaseService.syncDeviceRecord(
        user?.id,
        user?.email,
        pushToken
      );
      console.log('🔥 Push token updated in Supabase.');
    } catch (err) {
      console.error('❌ Failed to save token in Supabase:', err);
    }
  }
}
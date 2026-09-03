import { Injectable } from '@angular/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private currentToken: string | null = null;

  constructor(private supabaseService: SupabaseService) {}

  public async requestPushPermissionAndRegister(): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications skipped: Platform is Web.');
      return null;
    }

    return new Promise(async (resolve) => {
      try {
        await PushNotifications.removeAllListeners();

        // 1. Listen for successful registration
        await PushNotifications.addListener('registration', async (token: Token) => {
          console.log('🔥 Fresh FCM Push Token Generated:', token.value);
          this.currentToken = token.value;
          await this.saveTokenToSupabase(token.value);
          resolve(token.value);
        });

        // 2. Listen for errors
        await PushNotifications.addListener('registrationError', (error: any) => {
          console.error('❌ Push Registration Error:', JSON.stringify(error));
          resolve(null);
        });

        // 3. Foreground & Tap listeners
        await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('🔔 Push Received in Foreground:', notification);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
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

        // 4. Request permissions
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === 'granted') {
          // Unregister first to clear stale Firebase client instances, then register
          try {
            await PushNotifications.unregister();
          } catch (e) {
            // Ignore if already unregistered
          }
          await PushNotifications.register();
        } else {
          console.warn('Push notification permission denied.');
          resolve(null);
        }
      } catch (err) {
        console.error('Error in requestPushPermissionAndRegister:', err);
        resolve(null);
      }
    });
  }

  public async saveTokenToSupabase(pushToken: string): Promise<void> {
    try {
      const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
      await this.supabaseService.syncDeviceRecord(
        user?.id,
        user?.email,
        pushToken
      );
      console.log('🔥 Push token updated in Supabase user_devices.');
    } catch (err) {
      console.error('❌ Failed to save token in Supabase:', err);
    }
  }

  public getCurrentToken(): string | null {
    return this.currentToken;
  }
}
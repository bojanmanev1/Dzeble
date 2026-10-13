import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotificationService } from './push-notification';
import { HealthService } from './health';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private pushService = inject(PushNotificationService);
  private healthService = inject(HealthService);

  async requestAllPermissionsSequentially(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    console.log('🏁 Starting Sequential Permission Requests...');

    // Small delay so app rendering and splash dismissal completes
    await new Promise((res) => setTimeout(res, 800));

    // --- STEP 1: Push Notifications ---
    try {
      console.log('1️⃣ Requesting Push Notification Permission...');
      await this.pushService.requestPushPermissionAndRegister();
    } catch (e) {
      console.warn('Push permission step failed:', e);
    }

    // Small delay to allow OS dialog transition to finish smoothly
    await new Promise((res) => setTimeout(res, 800));

    // --- STEP 2: Location Permission ---
    try {
      console.log('2️⃣ Requesting Location Permission...');
      const locStatus = await Geolocation.checkPermissions();
      if (locStatus.location === 'prompt' || locStatus.coarseLocation === 'prompt') {
        await Geolocation.requestPermissions();
      }
    } catch (e) {
      console.warn('Location permission step failed:', e);
    }

    // Small delay to allow OS dialog transition to finish smoothly
    await new Promise((res) => setTimeout(res, 800));

    // --- STEP 3: Activity / Step Tracking Permission ---
    try {
      console.log('3️⃣ Requesting Physical Activity Permission...');
      const permCheck = await this.healthService.checkHealthPermissions();
      if (!permCheck.granted) {
        await this.healthService.requestHealthPermissions();
      }
    } catch (e) {
      console.warn('Activity permission step failed:', e);
    }

    console.log('✅ All permission requests processed in sequence.');
  }
}
import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Motion } from '@capacitor/motion';
import { PushNotificationService } from './push-notification';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private pushService = inject(PushNotificationService);

  async requestAllPermissionsSequentially(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    console.log('🏁 Starting Sequential Permission Requests...');

    // --- STEP 1: Push Notifications ---
    try {
      console.log('1️⃣ Requesting Push Notification Permission...');
      await this.pushService.requestPushPermissionAndRegister();
    } catch (e) {
      console.warn('Push permission step failed:', e);
    }

    // Small delay to allow OS dialog transition to finish smoothly
    await new Promise((res) => setTimeout(res, 600));

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

    // Small delay
    await new Promise((res) => setTimeout(res, 600));

    // --- STEP 3: Activity / Motion Tracking Permission ---
    try {
      console.log('3️⃣ Requesting Motion / Activity Permission...');
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        await (DeviceMotionEvent as any).requestPermission();
      } else {
        // Triggers initial listener check for Android Motion Sensors
        const handle = await Motion.addListener('accel', () => {});
        handle.remove();
      }
    } catch (e) {
      console.warn('Activity/Motion permission step failed:', e);
    }

    console.log('✅ All permission requests processed in sequence.');
  }
}
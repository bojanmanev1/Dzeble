import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
import { Preferences } from '@capacitor/preferences';

export interface HealthData {
  steps: number;
  calories: number;
  distanceKm: number;
}

const STORAGE_STEPS_KEY = 'dzeble_today_steps';
const STORAGE_DATE_KEY = 'dzeble_step_date';

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  private dailySteps = 0;
  private isListening = false;

  constructor() {
    this.loadSavedSteps();
  }

  /**
   * 1. Load saved steps from storage & handles midnight reset
   */
  async loadSavedSteps(): Promise<number> {
    try {
      const todayStr = new Date().toDateString(); // e.g. "Fri Aug 07 2026"
      const { value: savedDate } = await Preferences.get({ key: STORAGE_DATE_KEY });

      // Midnight Reset Logic
      if (savedDate !== todayStr) {
        console.log('🌙 New day detected! Resetting step counter to 0.');
        await Preferences.set({ key: STORAGE_DATE_KEY, value: todayStr });
        await Preferences.set({ key: STORAGE_STEPS_KEY, value: '0' });
        this.dailySteps = 0;
        return 0;
      }

      const { value: savedSteps } = await Preferences.get({ key: STORAGE_STEPS_KEY });
      this.dailySteps = savedSteps ? parseInt(savedSteps, 10) : 0;
      console.log('📦 Loaded persistent daily steps from storage:', this.dailySteps);
      return this.dailySteps;
    } catch (e) {
      console.error('Error loading stored steps:', e);
      return this.dailySteps;
    }
  }

  /**
   * 2. Save step increments to local device storage
   */
  private async saveSteps(newTotal: number) {
    this.dailySteps = newTotal;
    const todayStr = new Date().toDateString();
    await Preferences.set({ key: STORAGE_DATE_KEY, value: todayStr });
    await Preferences.set({ key: STORAGE_STEPS_KEY, value: newTotal.toString() });
  }

  /**
   * 3. Triggers permissions upon user login
   */
  async requestHealthPermissions(): Promise<boolean> {
    try {
      console.log('🔐 Requesting Activity Recognition & Notification permissions...');
      const activityPerm = await CapacitorPedometer.requestPermissions();
      const notifPerm = await LocalNotifications.requestPermissions();

      const granted = activityPerm.activityRecognition === 'granted';
      console.log('🔐 Activity permission granted:', granted);

      if (granted) {
        await this.startContinuousPedometer();
      }

      return granted;
    } catch (e) {
      console.error('Error requesting permissions:', e);
      return false;
    }
  }

  /**
   * 4. Start active, persistent hardware step listener
   */
  async startContinuousPedometer() {
    if (this.isListening) {
      console.log('⚡ Pedometer listener is already running.');
      return;
    }

    try {
      const availability = await CapacitorPedometer.isAvailable();
      if (!availability.stepCounting) {
        console.warn('⚠️ Step counter hardware unavailable on this device.');
        return;
      }

      await this.loadSavedSteps();

      let lastHardwareCount: number | null = null;

      // Register real-time hardware listener
      await CapacitorPedometer.addListener('measurement', async (data: { numberOfSteps?: number }) => {
        if (data.numberOfSteps !== undefined && data.numberOfSteps >= 0) {
          const currentHardwareCount = data.numberOfSteps;

          // Compute step difference since the last event
          if (lastHardwareCount !== null && currentHardwareCount > lastHardwareCount) {
            const stepDelta = currentHardwareCount - lastHardwareCount;
            const updatedTotal = this.dailySteps + stepDelta;
            
            await this.saveSteps(updatedTotal);

            // 🟢 REAL-TIME CONSOLE LOG: See your steps count live as you walk!
            console.log(`👟 [STEP COUNTED!] +${stepDelta} step(s) | Today Total: ${updatedTotal} steps`);
          }

          lastHardwareCount = currentHardwareCount;
        }
      });

      // Start hardware sensor stream
      await CapacitorPedometer.startMeasurementUpdates();
      this.isListening = true;
      console.log('🚀 Continuous hardware step counter started successfully!');
    } catch (e) {
      console.error('Failed to start continuous pedometer:', e);
    }
  }

  /**
   * 5. Get current daily step count for UI / Supabase sync
   */
  async getTodayDeviceSteps(): Promise<number> {
    if (!this.isListening) {
      await this.startContinuousPedometer();
    }
    return await this.loadSavedSteps();
  }

  calculateMetrics(steps: number): HealthData {
    const calories = Math.round(steps * 0.04);
    const distanceKm = parseFloat((steps * 0.000762).toFixed(2));
    return { steps, calories, distanceKm };
  }

  async checkAndNotifyMilestones(steps: number, notified10k: boolean, notified15k: boolean) {
    try {
      const checkPerms = await LocalNotifications.checkPermissions();
      if (checkPerms.display !== 'granted') return { update10k: notified10k, update15k: notified15k };

      let update10k = notified10k;
      let update15k = notified15k;

      if (steps >= 10 && !notified10k) {
        await LocalNotifications.schedule({
          notifications: [{
            title: '🎉 Тест Постигнат!',
            body: 'Супер! Достигна 10 чекори за тестирање!',
            id: 10010,
            schedule: { at: new Date(Date.now() + 1000) }
          }]
        });
        update10k = true;
      }

      if (steps >= 15000 && !notified15k) {
        await LocalNotifications.schedule({
          notifications: [{
            title: '🏆 Неверојатен Успех!',
            body: 'Супер постигнување! Собори 15,000 чекори денес!',
            id: 15000,
            schedule: { at: new Date(Date.now() + 1000) }
          }]
        });
        update15k = true;
      }

      return { update10k, update15k };
    } catch (e) {
      return { update10k: notified10k, update15k: notified15k };
    }
  }
}
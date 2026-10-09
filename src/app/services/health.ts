import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';
import { Preferences } from '@capacitor/preferences';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { BehaviorSubject } from 'rxjs';

export interface HealthData {
  steps: number;
  calories: number;
  distanceKm: number;
}

export interface DayHealthRecord {
  id?: string;
  logged_date: string;
  step_count: number;
  calories_burned: number;
  distance_km: number;
}

export interface StepTrackerPlugin {
  getTodaySteps(): Promise<{
    steps: number;
    calories: number;
    distanceKm: number;
    isAvailable: boolean;
  }>;
  startUpdates(): Promise<{ started: boolean }>;
  stopUpdates(): Promise<void>;
  requestTrackerPermissions(): Promise<{ activityRecognition: string }>;
  addListener(
    eventName: 'stepUpdate',
    listenerFunc: (data: { steps: number; calories: number; distanceKm: number }) => void
  ): Promise<any>;
}

const StepTracker = registerPlugin<StepTrackerPlugin>('StepTracker');

const STORAGE_STEPS_KEY = 'dzeble_today_steps';
const STORAGE_DATE_KEY = 'dzeble_step_date';
const STORAGE_HISTORY_KEY = 'dzeble_history_health';
const STORAGE_NOTIF_5K_KEY = 'dzeble_notif_5k';
const STORAGE_NOTIF_10K_KEY = 'dzeble_notif_10k';
const STORAGE_NOTIF_15K_KEY = 'dzeble_notif_15k';

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  private healthData$ = new BehaviorSubject<HealthData>({ steps: 0, calories: 0, distanceKm: 0 });
  public currentHealth$ = this.healthData$.asObservable();

  private dailySteps = 0;
  private isListening = false;
  private notified5k = false;
  private notified10k = false;
  private notified15k = false;

  constructor() {
    this.initPedometer();
  }

  private async initPedometer() {
    await this.loadSavedSteps();
    if (Capacitor.isNativePlatform()) {
      await this.startContinuousPedometer();
    }
  }

  /**
   * 1. Load saved steps from storage & handle midnight reset
   */
  async loadSavedSteps(): Promise<HealthData> {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { value: savedDate } = await Preferences.get({ key: STORAGE_DATE_KEY });

      // Midnight Reset Logic
      if (savedDate !== todayStr) {
        console.log('🌙 New day detected! Archiving yesterday and resetting today counter.');
        // Archive yesterday if steps existed
        const { value: prevSteps } = await Preferences.get({ key: STORAGE_STEPS_KEY });
        if (prevSteps && parseInt(prevSteps, 10) > 0 && savedDate) {
          await this.archiveDayHistory(savedDate, parseInt(prevSteps, 10));
        }

        await Preferences.set({ key: STORAGE_DATE_KEY, value: todayStr });
        await Preferences.set({ key: STORAGE_STEPS_KEY, value: '0' });
        await Preferences.remove({ key: STORAGE_NOTIF_5K_KEY });
        await Preferences.remove({ key: STORAGE_NOTIF_10K_KEY });
        await Preferences.remove({ key: STORAGE_NOTIF_15K_KEY });

        this.dailySteps = 0;
        this.notified5k = false;
        this.notified10k = false;
        this.notified15k = false;
      } else {
        const { value: savedSteps } = await Preferences.get({ key: STORAGE_STEPS_KEY });
        this.dailySteps = savedSteps ? parseInt(savedSteps, 10) : 0;

        const { value: n5k } = await Preferences.get({ key: STORAGE_NOTIF_5K_KEY });
        const { value: n10k } = await Preferences.get({ key: STORAGE_NOTIF_10K_KEY });
        const { value: n15k } = await Preferences.get({ key: STORAGE_NOTIF_15K_KEY });
        this.notified5k = n5k === 'true';
        this.notified10k = n10k === 'true';
        this.notified15k = n15k === 'true';
      }

      const metrics = this.calculateMetrics(this.dailySteps);
      this.healthData$.next(metrics);
      return metrics;
    } catch (e) {
      console.error('Error loading stored steps:', e);
      return this.calculateMetrics(this.dailySteps);
    }
  }

  /**
   * 2. Save step increments to local device storage & update reactive stream
   */
  public async saveSteps(newTotal: number): Promise<HealthData> {
    this.dailySteps = Math.max(this.dailySteps, newTotal);
    const todayStr = new Date().toISOString().split('T')[0];
    await Preferences.set({ key: STORAGE_DATE_KEY, value: todayStr });
    await Preferences.set({ key: STORAGE_STEPS_KEY, value: this.dailySteps.toString() });

    const metrics = this.calculateMetrics(this.dailySteps);
    this.healthData$.next(metrics);
    await this.checkAndNotifyMilestones(this.dailySteps);
    await this.updateTodayHistoryRecord(todayStr, this.dailySteps);
    return metrics;
  }

  /**
   * 3. Prompt permissions once on launch
   */
  async requestHealthPermissions(): Promise<boolean> {
    try {
      console.log('🔐 Requesting Activity Recognition & Notification permissions...');
      let granted = false;

      if (Capacitor.getPlatform() === 'android') {
        const res = await StepTracker.requestTrackerPermissions();
        granted = res.activityRecognition === 'granted';
      } else if (Capacitor.getPlatform() === 'ios') {
        const activityPerm = await CapacitorPedometer.requestPermissions();
        granted = activityPerm.activityRecognition === 'granted';
      } else {
        granted = true;
      }

      try {
        await LocalNotifications.requestPermissions();
      } catch (ne) {
        console.warn('Local notifications request error:', ne);
      }

      if (granted) {
        await this.startContinuousPedometer();
        await this.getTodayDeviceSteps();
      }

      return granted;
    } catch (e) {
      console.error('Error requesting health permissions:', e);
      return false;
    }
  }

  /**
   * 4. Start active hardware listener (Android native StepTracker or iOS CMPedometer)
   */
  async startContinuousPedometer() {
    if (this.isListening) return;

    try {
      const platform = Capacitor.getPlatform();

      if (platform === 'android') {
        await StepTracker.startUpdates();
        await StepTracker.addListener('stepUpdate', async (data: { steps: number; calories: number; distanceKm: number }) => {
          if (data && data.steps !== undefined) {
            console.log(`👟 [ANDROID STEP] Live hardware update: ${data.steps} steps`);
            await this.saveSteps(data.steps);
          }
        });
        this.isListening = true;
      } else if (platform === 'ios') {
        const avail = await CapacitorPedometer.isAvailable();
        if (avail.stepCounting) {
          await CapacitorPedometer.startMeasurementUpdates();
          await CapacitorPedometer.addListener('measurement', async (data: { numberOfSteps?: number }) => {
            if (data.numberOfSteps !== undefined) {
              await this.saveSteps(this.dailySteps + data.numberOfSteps);
            }
          });
          this.isListening = true;
        }
      }
    } catch (e) {
      console.warn('Failed to start continuous pedometer listener:', e);
    }
  }

  /**
   * 5. Get current daily step count across app restarts / closed app
   */
  async getTodayDeviceSteps(): Promise<HealthData> {
    try {
      const platform = Capacitor.getPlatform();

      if (platform === 'android') {
        const res = await StepTracker.getTodaySteps();
        if (res && res.steps !== undefined && res.steps > 0) {
          return await this.saveSteps(res.steps);
        }
      } else if (platform === 'ios') {
        const now = Date.now();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        try {
          const res = await CapacitorPedometer.getMeasurement({
            start: startOfDay.getTime(),
            end: now
          });
          if (res && res.numberOfSteps !== undefined && res.numberOfSteps > 0) {
            return await this.saveSteps(res.numberOfSteps);
          }
        } catch (queryErr) {
          console.warn('iOS pedometer query error:', queryErr);
        }
      }

      return await this.loadSavedSteps();
    } catch (e) {
      console.error('Error fetching today device steps:', e);
      return await this.loadSavedSteps();
    }
  }

  calculateMetrics(steps: number): HealthData {
    const calories = Math.round(steps * 0.04);
    const distanceKm = parseFloat((steps * 0.000762).toFixed(2));
    return { steps, calories, distanceKm };
  }

  /**
   * 6. Check and notify milestone thresholds (5,000, 10,000, 15,000 steps)
   */
  async checkAndNotifyMilestones(steps: number) {
    try {
      const checkPerms = await LocalNotifications.checkPermissions();
      if (checkPerms.display !== 'granted') return;

      // Milestone 1: 5,000 Steps
      if (steps >= 5000 && !this.notified5k) {
        await LocalNotifications.schedule({
          notifications: [{
            title: '🎉 5,000 Чекори!',
            body: 'Одличен напредок! Достигнавте 5,000 чекори денес!',
            id: 5000,
            schedule: { at: new Date(Date.now() + 500) }
          }]
        });
        this.notified5k = true;
        await Preferences.set({ key: STORAGE_NOTIF_5K_KEY, value: 'true' });
      }

      // Milestone 2: 10,000 Steps
      if (steps >= 10000 && !this.notified10k) {
        await LocalNotifications.schedule({
          notifications: [{
            title: '🔥 10,000 Чекори!',
            body: 'Честитки! Ја остваривте вашата дневна цел од 10,000 чекори!',
            id: 10000,
            schedule: { at: new Date(Date.now() + 500) }
          }]
        });
        this.notified10k = true;
        await Preferences.set({ key: STORAGE_NOTIF_10K_KEY, value: 'true' });
      }

      // Milestone 3: 15,000 Steps
      if (steps >= 15000 && !this.notified15k) {
        await LocalNotifications.schedule({
          notifications: [{
            title: '🏆 15,000 Чекори!',
            body: 'Неверојатен успех! Соборивте 15,000 чекори денес - вистински шампион!',
            id: 15000,
            schedule: { at: new Date(Date.now() + 500) }
          }]
        });
        this.notified15k = true;
        await Preferences.set({ key: STORAGE_NOTIF_15K_KEY, value: 'true' });
      }
    } catch (e) {
      console.warn('Milestone notification scheduling error:', e);
    }
  }

  getMilestonesStatus(): { reached5k: boolean; reached10k: boolean; reached15k: boolean } {
    return {
      reached5k: this.dailySteps >= 5000,
      reached10k: this.dailySteps >= 10000,
      reached15k: this.dailySteps >= 15000
    };
  }

  /**
   * 7. Local 7-Day History persistence (works for guests & offline)
   */
  async getLocal7DaysHistory(): Promise<DayHealthRecord[]> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_HISTORY_KEY });
      if (!value) return [];
      const history: DayHealthRecord[] = JSON.parse(value);
      return Array.isArray(history) ? history.slice(0, 7) : [];
    } catch (e) {
      return [];
    }
  }

  private async updateTodayHistoryRecord(todayDateStr: string, steps: number) {
    try {
      const history = await this.getLocal7DaysHistory();
      const existingIdx = history.findIndex(h => h.logged_date === todayDateStr);
      const metrics = this.calculateMetrics(steps);

      const record: DayHealthRecord = {
        logged_date: todayDateStr,
        step_count: steps,
        calories_burned: metrics.calories,
        distance_km: metrics.distanceKm
      };

      if (existingIdx >= 0) {
        history[existingIdx] = record;
      } else {
        history.unshift(record);
      }

      await Preferences.set({
        key: STORAGE_HISTORY_KEY,
        value: JSON.stringify(history.slice(0, 14))
      });
    } catch (e) {
      console.error('Failed to update local history record:', e);
    }
  }

  private async archiveDayHistory(dateStr: string, steps: number) {
    await this.updateTodayHistoryRecord(dateStr, steps);
  }
}
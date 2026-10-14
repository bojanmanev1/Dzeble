import { Injectable, NgZone } from '@angular/core';
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
  setTodaySteps(options: { steps: number }): Promise<void>;
  startUpdates(): Promise<{ started: boolean }>;
  stopUpdates(): Promise<void>;
  setNotificationsEnabled(options: { enabled: boolean }): Promise<void>;
  setLanguage(options: { language: string }): Promise<void>;
  checkTrackerPermissions(): Promise<{ activityRecognition: string }>;
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
  private isUserLoggedIn = false;

  setUserLoggedIn(loggedIn: boolean) {
    this.isUserLoggedIn = loggedIn;
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        StepTracker.setNotificationsEnabled({ enabled: loggedIn });
      } catch (e) {}
    }
  }

  constructor(private zone: NgZone) {
    this.initPedometer();
  }

  private async initPedometer() {
    await this.loadSavedSteps();
    if (Capacitor.isNativePlatform()) {
      const perm = await this.checkHealthPermissions();
      if (perm.granted) {
        await this.startContinuousPedometer();
        await this.getTodayDeviceSteps();
      }
    }
  }

  /**
   * 1. Load saved steps from storage & handle midnight reset
   */
  async loadSavedSteps(): Promise<HealthData> {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Instant synchronous recovery from localStorage (0 ms)
      const cachedDate = localStorage.getItem(STORAGE_DATE_KEY);
      const cachedSteps = localStorage.getItem(STORAGE_STEPS_KEY);
      if (cachedDate === todayStr && cachedSteps) {
        this.dailySteps = parseInt(cachedSteps, 10);
        const fastMetrics = this.calculateMetrics(this.dailySteps);
        this.zone.run(() => this.healthData$.next(fastMetrics));
      }

      const { value: savedDate } = await Preferences.get({ key: STORAGE_DATE_KEY });

      // Midnight Reset Logic
      if (savedDate !== todayStr) {
        console.log('🌙 New day detected! Archiving yesterday and resetting today counter.');
        // Archive yesterday if steps existed
        const { value: prevSteps } = await Preferences.get({ key: STORAGE_STEPS_KEY });
        if (prevSteps && parseInt(prevSteps, 10) > 0 && savedDate) {
          await this.archiveDayHistory(savedDate, parseInt(prevSteps, 10));
        }

        localStorage.setItem(STORAGE_DATE_KEY, todayStr);
        localStorage.setItem(STORAGE_STEPS_KEY, '0');
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
        this.dailySteps = savedSteps ? parseInt(savedSteps, 10) : this.dailySteps;

        const { value: n5k } = await Preferences.get({ key: STORAGE_NOTIF_5K_KEY });
        const { value: n10k } = await Preferences.get({ key: STORAGE_NOTIF_10K_KEY });
        const { value: n15k } = await Preferences.get({ key: STORAGE_NOTIF_15K_KEY });
        this.notified5k = n5k === 'true';
        this.notified10k = n10k === 'true';
        this.notified15k = n15k === 'true';
      }

      const metrics = this.calculateMetrics(this.dailySteps);
      this.zone.run(() => this.healthData$.next(metrics));
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

    // Synchronous immediate memory and localStorage write
    localStorage.setItem(STORAGE_DATE_KEY, todayStr);
    localStorage.setItem(STORAGE_STEPS_KEY, this.dailySteps.toString());

    // 1. Instantly emit to reactive stream inside NgZone so Angular repaints in 0ms
    const metrics = this.calculateMetrics(this.dailySteps);
    this.zone.run(() => {
      this.healthData$.next(metrics);
    });

    // 2. Background async storage & milestones without blocking UI
    Preferences.set({ key: STORAGE_DATE_KEY, value: todayStr }).catch(() => {});
    Preferences.set({ key: STORAGE_STEPS_KEY, value: this.dailySteps.toString() }).catch(() => {});
    this.checkAndNotifyMilestones(this.dailySteps).catch(() => {});
    this.updateTodayHistoryRecord(todayStr, this.dailySteps).catch(() => {});

    return metrics;
  }

  /**
   * 3. Check current hardware permission status
   */
  async checkHealthPermissions(): Promise<{ granted: boolean; state: string }> {
    try {
      if (Capacitor.isNativePlatform()) {
        const platform = Capacitor.getPlatform();
        if (platform === 'android') {
          try {
            const trackerStatus = await StepTracker.checkTrackerPermissions();
            const isGranted = trackerStatus?.activityRecognition === 'granted';
            return { granted: isGranted, state: trackerStatus?.activityRecognition || 'prompt' };
          } catch (te) {
            console.warn('StepTracker.checkTrackerPermissions error:', te);
            return { granted: false, state: 'prompt' };
          }
        } else if (platform === 'ios') {
          const status = await CapacitorPedometer.checkPermissions();
          return {
            granted: status.activityRecognition === 'granted',
            state: status.activityRecognition || 'prompt'
          };
        }
      }
      return { granted: true, state: 'granted' };
    } catch (e) {
      console.warn('Error checking health permissions:', e);
      return { granted: false, state: 'error' };
    }
  }

  /**
   * 4. Prompt permissions on launch or user request
   */
  async requestHealthPermissions(): Promise<boolean> {
    try {
      console.log('🔐 Requesting Activity Recognition & Notification permissions...');
      let granted = false;
      const platform = Capacitor.getPlatform();

      if (platform === 'android') {
        try {
          const trackerRes = await StepTracker.requestTrackerPermissions();
          if (trackerRes && trackerRes.activityRecognition === 'granted') {
            granted = true;
          }
        } catch (te) {
          console.warn('StepTracker.requestTrackerPermissions error:', te);
        }
      } else if (platform === 'ios') {
        try {
          const activityPerm = await CapacitorPedometer.requestPermissions();
          granted = activityPerm.activityRecognition === 'granted';
        } catch (ie) {
          console.warn('iOS requestPermissions error:', ie);
        }
      } else {
        granted = true;
      }

      try {
        await LocalNotifications.requestPermissions();
      } catch (ne) {
        console.warn('Local notifications request error:', ne);
      }

      if (granted || platform === 'web') {
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
        await StepTracker.addListener('stepUpdate', (data: { steps: number; calories: number; distanceKm: number }) => {
          if (data && data.steps !== undefined) {
            console.log(`👟 [ANDROID STEP] Live hardware update: ${data.steps} steps`);
            this.zone.run(() => {
              this.saveSteps(data.steps);
            });
          }
        });
        this.isListening = true;
      } else if (platform === 'ios') {
        const avail = await CapacitorPedometer.isAvailable();
        if (avail.stepCounting) {
          await CapacitorPedometer.startMeasurementUpdates();
          await CapacitorPedometer.addListener('measurement', (data: { numberOfSteps?: number }) => {
            const iosSteps = data.numberOfSteps;
            if (iosSteps !== undefined) {
              this.zone.run(() => {
                this.saveSteps(this.dailySteps + iosSteps);
              });
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
        if (res && res.steps !== undefined) {
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

  public async setNotificationEnabled(enabled: boolean) {
    await Preferences.set({ key: 'dzeble_activity_notif_enabled', value: enabled ? 'true' : 'false' });
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        await StepTracker.setNotificationsEnabled({ enabled });
      } catch (e) {}
    }
  }

  public async isNotificationEnabled(): Promise<boolean> {
    const { value } = await Preferences.get({ key: 'dzeble_activity_notif_enabled' });
    return value !== 'false';
  }

  public async setLanguage(lang: string) {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        await StepTracker.setLanguage({ language: lang });
      } catch (e) {}
    }
  }

  /**
   * 6. Check and notify milestone thresholds (5,000, 10,000, 15,000 steps)
   */
  async checkAndNotifyMilestones(steps: number) {
    try {
      if (!this.isUserLoggedIn) return;
      const isEnabled = await this.isNotificationEnabled();
      if (!isEnabled) return;

      const checkPerms = await LocalNotifications.checkPermissions();
      if (checkPerms.display !== 'granted') return;

      const lang = localStorage.getItem('app_language') || 'mk';
      let title5k = '🎉 5,000 Чекори!';
      let body5k = 'Одличен напредок! Достигнавте 5,000 чекори денес!';
      let title10k = '🔥 10,000 Чекори!';
      let body10k = 'Честитки! Ја остваривте вашата дневна цел од 10,000 чекори!';
      let title15k = '🏆 15,000 Чекори!';
      let body15k = 'Неверојатен успех! Соборивте 15,000 чекори денес - вистински шампион!';

      if (lang === 'en') {
        title5k = '🎉 5,000 Steps!';
        body5k = 'Great progress! You reached 5,000 steps today!';
        title10k = '🔥 10,000 Steps!';
        body10k = 'Congratulations! You achieved your daily goal of 10,000 steps!';
        title15k = '🏆 15,000 Steps!';
        body15k = 'Incredible achievement! You exceeded 15,000 steps today - champion!';
      } else if (lang === 'al') {
        title5k = '🎉 5,000 Hapa!';
        body5k = 'Përparim i shkëlqyer! Keni arritur 5,000 hapa sot!';
        title10k = '🔥 10,000 Hapa!';
        body10k = 'Urime! Keni arritur synimin ditor prej 10,000 hapash!';
        title15k = '🏆 15,000 Hapa!';
        body15k = 'Sukses i jashtëzakonshëm! Kaluat 15,000 hapa sot - kampion i vërtetë!';
      }

      // Milestone 1: 5,000 Steps
      if (steps >= 5000 && !this.notified5k) {
        await LocalNotifications.schedule({
          notifications: [{
            title: title5k,
            body: body5k,
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
            title: title10k,
            body: body10k,
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
            title: title15k,
            body: body15k,
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

  /**
   * Restores steps from Supabase database (e.g. after fresh app install or login on new device)
   */
  async restoreStepsFromDatabase(remoteSteps: number): Promise<HealthData> {
    if (!remoteSteps || remoteSteps <= this.dailySteps) {
      return this.calculateMetrics(this.dailySteps);
    }

    console.log(`📥 [HEALTH] Restoring ${remoteSteps} steps from cloud database...`);
    this.dailySteps = remoteSteps;
    const todayStr = new Date().toISOString().split('T')[0];

    localStorage.setItem(STORAGE_DATE_KEY, todayStr);
    localStorage.setItem(STORAGE_STEPS_KEY, this.dailySteps.toString());

    await Preferences.set({ key: STORAGE_DATE_KEY, value: todayStr });
    await Preferences.set({ key: STORAGE_STEPS_KEY, value: this.dailySteps.toString() });

    if (remoteSteps >= 5000) {
      this.notified5k = true;
      await Preferences.set({ key: STORAGE_NOTIF_5K_KEY, value: 'true' });
    }
    if (remoteSteps >= 10000) {
      this.notified10k = true;
      await Preferences.set({ key: STORAGE_NOTIF_10K_KEY, value: 'true' });
    }
    if (remoteSteps >= 15000) {
      this.notified15k = true;
      await Preferences.set({ key: STORAGE_NOTIF_15K_KEY, value: 'true' });
    }

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        await StepTracker.setTodaySteps({ steps: remoteSteps });
      } catch (e) {
        console.warn('Could not set today steps in native StepTracker:', e);
      }
    }

    const metrics = this.calculateMetrics(this.dailySteps);
    this.zone.run(() => {
      this.healthData$.next(metrics);
    });

    await this.updateTodayHistoryRecord(todayStr, this.dailySteps);
    return metrics;
  }

  /**
   * Syncs historical metrics from remote to local cache if local cache is empty
   */
  async syncHistoryFromRemote(remoteHistory: DayHealthRecord[]) {
    if (!remoteHistory || remoteHistory.length === 0) return;
    try {
      const localHistory = await this.getLocal7DaysHistory();
      if (localHistory.length === 0) {
        await Preferences.set({
          key: STORAGE_HISTORY_KEY,
          value: JSON.stringify(remoteHistory.slice(0, 14))
        });
      }
    } catch (e) {}
  }
}
import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CapacitorPedometer } from '@capgo/capacitor-pedometer';

export interface HealthData {
  steps: number;
  calories: number;
  distanceKm: number;
}

@Injectable({
  providedIn: 'root'
})
export class HealthService {

  async getTodayDeviceSteps(): Promise<number> {
    try {
      // 1. Check availability
      const availability = await CapacitorPedometer.isAvailable();
      if (!availability.stepCounting) {
        console.warn('Step counting hardware is not available on this device.');
        return 0;
      }

      // 2. Request permission (checks activityRecognition property)
      const permResult = await CapacitorPedometer.requestPermissions();
      
      if (permResult.activityRecognition === 'granted') {
        // 3. Query steps using getMeasurement()
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const result = await CapacitorPedometer.getMeasurement({
          start: startOfDay.getTime(),
          end: Date.now()
        });

        console.log('Native Hardware Step Count Result:', result);
        return result.numberOfSteps || 0;
      } else {
        console.warn('Activity Recognition permission was denied by user.');
      }
    } catch (e) {
      console.warn('Native Pedometer plugin error:', e);
    }
    return 0;
  }

  calculateMetrics(steps: number): HealthData {
    const calories = Math.round(steps * 0.04);
    const distanceKm = parseFloat((steps * 0.000762).toFixed(2));
    return { steps, calories, distanceKm };
  }

  async checkAndNotifyMilestones(steps: number, notified10k: boolean, notified15k: boolean) {
    try {
      const checkPerms = await LocalNotifications.checkPermissions();
      if (checkPerms.display !== 'granted') {
        const reqPerms = await LocalNotifications.requestPermissions();
        if (reqPerms.display !== 'granted') return { update10k: notified10k, update15k: notified15k };
      }

      let update10k = notified10k;
      let update15k = notified15k;

      // 🧪 Test Milestone: 10 steps
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
      console.warn('Error scheduling local notification:', e);
      return { update10k: notified10k, update15k: notified15k };
    }
  }
}
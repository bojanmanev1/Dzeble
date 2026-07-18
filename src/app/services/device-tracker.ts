import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class DeviceTrackerService {
  private supabaseService = inject(SupabaseService);

  constructor() {}

  /**
   * Initializes device tracking. Call this when the app boots up.
   */
  async trackDevice() {
    // 1. Try to read an existing device ID from native storage
    const { value } = await Preferences.get({ key: 'device_id' });
    
    let deviceId = value;

    if (!deviceId) {
      // 2. First time opening! Generate a unique random ID
      deviceId = crypto.randomUUID();
      
      // Save it locally so we remember this device next time
      await Preferences.set({ key: 'device_id', value: deviceId });

      // Register the new device footprint in your Supabase database
      await this.registerNewDeviceInSupabase(deviceId);
    } else {
      // 3. Returning user! Update their "last active" timestamp in the background
      await this.updateDeviceHeartbeat(deviceId);
    }
  }

  private async registerNewDeviceInSupabase(id: string) {
    const platform = (window as any).Capacitor?.getPlatform() || 'web';
    
    await this.supabaseService.client
      .from('devices')
      .insert([{ id: id, platform: platform }]);
  }

  private async updateDeviceHeartbeat(id: string) {
    await this.supabaseService.client
      .from('devices')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('id', id);
  }
}
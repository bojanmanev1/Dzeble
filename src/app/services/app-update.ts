import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SupabaseService } from './supabase';

export interface AppVersionConfig {
  id: string;
  platform: string;
  latest_version_code: number;
  latest_version_name: string;
  min_supported_version_code: number;
  force_update: boolean;
  title: string;
  message: string;
  release_notes?: string;
  store_url: string;
  is_active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AppUpdateService {
  private supabaseService = inject(SupabaseService);
  private alertCtrl = inject(AlertController);

  private hasDismissedOptionalThisSession = false;
  private isChecking = false;
  private isAlertOpen = false;
  private isListening = false;

  /**
   * Initializes update listener on app resume and performs initial check
   */
  async init() {
    if (!this.isListening) {
      this.isListening = true;
      try {
        App.addListener('appStateChange', (state) => {
          if (state.isActive) {
            // When user returns to the app from background/Play Store
            this.checkForUpdate();
          }
        });
      } catch (err) {
        console.warn('[AppUpdateService] Failed to attach appStateChange listener:', err);
      }
    }

    // Initial check on app startup
    await this.checkForUpdate();
  }

  /**
   * Checks Supabase remote version config against currently installed build
   */
  async checkForUpdate(forcePrompt = false) {
    if (this.isChecking) return;
    if (this.hasDismissedOptionalThisSession && !forcePrompt) return;

    // Do NOT check or show Play Store update dialogs when running on the web browser
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'web') {
      return;
    }

    try {
      this.isChecking = true;

      // 1. Current app version info
      let currentVersionCode = 1;
      let currentVersionName = '1.0';

      if (Capacitor.isNativePlatform()) {
        try {
          const info = await App.getInfo();
          currentVersionCode = parseInt(info.build, 10) || 1;
          currentVersionName = info.version || '1.0';
        } catch (e) {
          console.warn('[AppUpdateService] Could not read App.getInfo():', e);
        }
      }

      // 2. Identify platform
      const rawPlatform = Capacitor.getPlatform();
      const platform = rawPlatform === 'ios' ? 'ios' : 'android';

      // 3. Query Supabase
      const { data, error } = await this.supabaseService.supabase
        .from('app_versions')
        .select('*')
        .eq('platform', platform)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn('[AppUpdateService] Supabase error:', error);
        return;
      }

      if (!data) return;

      const config = data as AppVersionConfig;

      // 4. Compare version codes
      const isNewerAvailable = config.latest_version_code > currentVersionCode;
      const isForce = config.force_update || currentVersionCode < config.min_supported_version_code;

      if (isNewerAvailable) {
        await this.showUpdateAlert(config, isForce, currentVersionName);
      }
    } catch (err) {
      console.warn('[AppUpdateService] Check update unexpected error:', err);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Displays the update dialog
   */
  private async showUpdateAlert(config: AppVersionConfig, isForce: boolean, currentVersion: string) {
    if (this.isAlertOpen) return;
    this.isAlertOpen = true;

    // Properly parse any escaped newlines (\n) from remote database text
    const cleanNotes = config.release_notes ? `\n\n${config.release_notes.replace(/\\n/g, '\n')}` : '';
    const cleanMessage = (config.message || '').replace(/\\n/g, '\n');
    const versionDiff = `\n\nМоментална верзија: v${currentVersion} ➔ Нова: v${config.latest_version_name}`;
    const fullMessage = `${cleanMessage}${cleanNotes}${versionDiff}`;

    const alert = await this.alertCtrl.create({
      header: config.title || 'Достапна е нова верзија! 🚀',
      message: fullMessage,
      backdropDismiss: !isForce,
      cssClass: 'app-update-alert',
      buttons: [
        ...(isForce
          ? []
          : [
              {
                text: 'Подоцна',
                role: 'cancel',
                cssClass: 'app-update-cancel-btn',
                handler: () => {
                  this.hasDismissedOptionalThisSession = true;
                  this.isAlertOpen = false;
                }
              }
            ]),
        {
          text: 'Ажурирај сега',
          cssClass: 'app-update-confirm-btn',
          handler: () => {
            this.openStore(config.store_url);
            if (isForce) {
              // Return false to prevent closing modal when update is strictly mandatory
              return false;
            }
            this.isAlertOpen = false;
            return true;
          }
        }
      ]
    });

    alert.onDidDismiss().then(() => {
      this.isAlertOpen = false;
    });

    await alert.present();
  }

  /**
   * Opens Google Play Store / App Store
   */
  private openStore(storeUrl: string) {
    const playStoreId = 'com.dzeble.app';
    const fallbackUrl = storeUrl || `https://play.google.com/store/apps/details?id=${playStoreId}`;

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        // Attempt native market:// intent first (directly launches Play Store app)
        window.open(`market://details?id=${playStoreId}`, '_system');
      } catch {
        window.open(fallbackUrl, '_system');
      }
    } else {
      window.open(fallbackUrl, '_system');
    }
  }
}

import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { 
  IonApp, 
  IonRouterOutlet, 
  AlertController, 
  ModalController, 
  ActionSheetController, 
  PopoverController, 
  MenuController,
  Platform
} from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { DeviceTrackerService } from './services/device-tracker';
import { SessionTrackerService } from './services/session-tracker';
import { SupabaseService } from './services/supabase';
import { PushNotificationService } from './services/push-notification';
import { PermissionService } from './services/permission';
import { AppUpdateService } from './services/app-update';

import { ThemeService } from './services/theme';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private themeService = inject(ThemeService);
  private deviceTracker = inject(DeviceTrackerService);
  private sessionTracker = inject(SessionTrackerService);
  private supabaseService = inject(SupabaseService);
  private pushService = inject(PushNotificationService);
  private permissionService = inject(PermissionService);
  private appUpdateService = inject(AppUpdateService);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private translate = inject(TranslateService);
  private zone = inject(NgZone);
  private alertCtrl = inject(AlertController);
  private modalCtrl = inject(ModalController);
  private actionSheetCtrl = inject(ActionSheetController);
  private popoverCtrl = inject(PopoverController);
  private menuCtrl = inject(MenuController);
  private platform = inject(Platform);

  private isResetPasswordFlow = false;
  private isExitAlertOpen = false;

  async ngOnInit() {
    this.themeService.initializeTheme();
    await this.setupDeepLinks();
    this.setupHardwareBackButton();

    // 1. Background analytics & session tracking
    this.deviceTracker.trackDevice().catch(err => console.error('Tracking error:', err));
    this.sessionTracker.init().catch(err => console.error('SessionTracker error:', err));

    // 2. Request Push, Location, and Activity permissions ONE BY ONE sequentially
    await this.permissionService.requestAllPermissionsSequentially();

    // 3. Re-sync token automatically when user signs in or restores session
    this.supabaseService.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || this.isResetPasswordFlow || this.supabaseService.isPasswordResetFlow) {
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        await this.pushService.requestPushPermissionAndRegister();
        await this.sessionTracker.setSessionUser(session.user);
      }
    });

    // 4. Check for remote app updates (Pop-up if new version on Play Store exists)
    this.appUpdateService.init().catch(err => console.warn('AppUpdate init error:', err));

    // 5. Ensure user stays logged in continuously until they manually choose to log out

    // 6. Signal that Angular application is ready to transition out the splash screen
    if (typeof (window as any).signalAppReady === 'function') {
      (window as any).signalAppReady();
    }
  }

  private async setupDeepLinks() {
    // 1. Listen for deep links when app is already open in background (warm start)
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(async () => {
        await this.handleDeepLink(event.url);
      });
    });

    // 2. Check if the app was launched by clicking a deep link (cold start)
    try {
      const launchUrl = await App.getLaunchUrl();
      if (launchUrl?.url) {
        await this.zone.run(async () => {
          await this.handleDeepLink(launchUrl.url);
        });
      }
    } catch (err) {
      console.warn('Error reading launch URL:', err);
    }
  }

  private async handleDeepLink(rawUrl: string) {
    if (!rawUrl || !rawUrl.includes('dzeble://')) return;

    try {
      const urlObj = new URL(rawUrl.replace('dzeble://', 'https://dummy/'));
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      const queryParams = new URLSearchParams(urlObj.search);

      const code = queryParams.get('code') || hashParams.get('code');
      const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

      const isResetUrl = rawUrl.includes('reset-password');
      if (isResetUrl) {
        this.isResetPasswordFlow = true;
        this.supabaseService.isPasswordResetFlow = true;
      }

      if (code) {
        await this.supabaseService.supabase.auth.exchangeCodeForSession(code);
      } else if (accessToken && refreshToken) {
        await this.supabaseService.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }

      if (isResetUrl) {
        this.navCtrl.navigateRoot('/reset-password');
        return;
      }

      const { data } = await this.supabaseService.getCurrentUser();
      const user = data?.user;
      const isVerified = this.supabaseService.isUserVerified(user);

      if (user && isVerified) {
        await this.supabaseService.registerNewDeviceSession(user.id);
        await this.pushService.requestPushPermissionAndRegister();
        this.navCtrl.navigateRoot('/dashboard');
      } else {
        await this.supabaseService.signOut();
        this.navCtrl.navigateRoot('/login');
      }
    } catch (err) {
      console.error('Deep link handling error:', err);
    }
  }

  private async checkSingleDeviceSession() {
    return;
  }

  private setupHardwareBackButton() {
    this.platform.backButton.subscribeWithPriority(10, async () => {
      // 1. If exit alert is already open, do not re-trigger
      if (this.isExitAlertOpen) return;

      // 2. Dismiss topmost controller modal if open
      const topModal = await this.modalCtrl.getTop();
      if (topModal) {
        await topModal.dismiss();
        return;
      }

      // 3. Fallback: check DOM for any presented inline ion-modal
      const domModal = document.querySelector('ion-modal.show-modal') as any;
      if (domModal && typeof domModal.dismiss === 'function') {
        await domModal.dismiss();
        return;
      }

      // 4. If user is on a sub-route (e.g. login or reset-password), navigate back to dashboard
      const currentUrl = this.router.url;
      if (currentUrl.includes('/login') || currentUrl.includes('/reset-password')) {
        this.navCtrl.navigateRoot('/dashboard');
        return;
      }

      // 5. On root dashboard with no overlays open -> present exit confirmation alert
      await this.showExitConfirmAlert();
    });
  }

  private async showExitConfirmAlert() {
    if (this.isExitAlertOpen) return;

    const title = this.translate.instant('HOME.CONFIRM_EXIT_TITLE') || 'Излез';
    const message = this.translate.instant('HOME.CONFIRM_EXIT_MSG') || 'Дали сакате да излезете од апликацијата?';
    const cancelText = this.translate.instant('COMMON.CANCEL') || 'Откажи';
    const exitText = this.translate.instant('HOME.EXIT') || 'Излези';

    this.isExitAlertOpen = true;

    const alert = await this.alertCtrl.create({
      header: title,
      message: message,
      cssClass: 'app-exit-alert',
      backdropDismiss: true,
      buttons: [
        {
          text: cancelText,
          role: 'cancel',
          cssClass: 'app-exit-cancel-btn',
          handler: () => {
            this.isExitAlertOpen = false;
          }
        },
        {
          text: exitText,
          role: 'destructive',
          cssClass: 'app-exit-confirm-btn',
          handler: () => {
            this.isExitAlertOpen = false;
            App.exitApp();
          }
        }
      ]
    });

    alert.onDidDismiss().then(() => {
      this.isExitAlertOpen = false;
    });

    await alert.present();
  }
}
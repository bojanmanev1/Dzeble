import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { DeviceTrackerService } from './services/device-tracker';
import { SessionTrackerService } from './services/session-tracker';
import { SupabaseService } from './services/supabase';
import { PushNotificationService } from './services/push-notification';
import { PermissionService } from './services/permission';

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
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private translate = inject(TranslateService);
  private zone = inject(NgZone);

  private isResetPasswordFlow = false;

  async ngOnInit() {
    this.themeService.initializeTheme();
    await this.setupDeepLinks();

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

    // 4. Single-Device Session Enforcer
    if (!this.isResetPasswordFlow) {
      await this.checkSingleDeviceSession();
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
    try {
      if (this.isResetPasswordFlow || (typeof window !== 'undefined' && window.location.pathname.includes('reset-password'))) {
        return;
      }

      const { data } = await this.supabaseService.getCurrentUser();

      if (data?.user) {
        const isValid = await this.supabaseService.validateSession(data.user);

        if (!isValid) {
          const alertMessage = this.translate.instant('AUTH.LOGGED_OUT_OTHER_DEVICE');
          alert(alertMessage);
          this.navCtrl.navigateRoot('/login');
        }
      }
    } catch (err) {
      console.error('Session validation error:', err);
    }
  }
}
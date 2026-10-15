import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { DeviceTrackerService } from './services/device-tracker';
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
  private supabaseService = inject(SupabaseService);
  private pushService = inject(PushNotificationService);
  private permissionService = inject(PermissionService);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private translate = inject(TranslateService);
  private zone = inject(NgZone);

  async ngOnInit() {
    this.themeService.initializeTheme();
    this.setupDeepLinks();

    // 1. Background analytics tracking
    this.deviceTracker.trackDevice().catch(err => console.error('Tracking error:', err));

    // 2. Request Push, Location, and Activity permissions ONE BY ONE sequentially
    await this.permissionService.requestAllPermissionsSequentially();

    // 3. Re-sync token automatically when user signs in or restores session
    this.supabaseService.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        await this.pushService.requestPushPermissionAndRegister();
      }
    });

    // 4. Single-Device Session Enforcer
    await this.checkSingleDeviceSession();
  }

  private setupDeepLinks() {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(async () => {
        if (event.url.includes('dzeble://')) {
          const urlObj = new URL(event.url.replace('dzeble://', 'https://dummy/'));
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          const queryParams = new URLSearchParams(urlObj.search);

          const code = queryParams.get('code') || hashParams.get('code');
          const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

          if (code) {
            await this.supabaseService.supabase.auth.exchangeCodeForSession(code);
          } else if (accessToken && refreshToken) {
            await this.supabaseService.supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }

          if (event.url.includes('reset-password')) {
            this.navCtrl.navigateForward('/reset-password');
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
        }
      });
    });
  }

  private async checkSingleDeviceSession() {
    try {
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
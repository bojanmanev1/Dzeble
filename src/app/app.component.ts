import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { DeviceTrackerService } from './services/device-tracker';
import { SupabaseService } from './services/supabase';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private deviceTracker = inject(DeviceTrackerService);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private zone = inject(NgZone);

  async ngOnInit() {
    // 1. Setup Deep Link Listener for Mobile Auth Confirmations (dzeble://)
    this.setupDeepLinks();

    // 2. Background analytics tracking
    this.deviceTracker.trackDevice().catch(err => console.error('Tracking error:', err));

    // 3. Single-Device Session Enforcer
    await this.checkSingleDeviceSession();
  }

  private setupDeepLinks() {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(async () => {
        // Intercept all native custom scheme redirects
        if (event.url.includes('dzeble://')) {
          
          // 1. Extract hash fragment or query params from the deep link URL
          const urlObj = new URL(event.url.replace('dzeble://', 'https://dummy/'));
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          const queryParams = new URLSearchParams(urlObj.search);

          const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

          // 2. If OAuth/MagicLink/Reset Link returned session tokens, set them into Supabase SDK
          if (accessToken && refreshToken) {
            await this.supabaseService.supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }

          // 3. Check if the link target is the Password Reset route
          if (event.url.includes('reset-password')) {
            this.router.navigate(['/reset-password']);
            return;
          }

          // 4. Standard Login / Sign-up confirmation handling
          const { data } = await this.supabaseService.getCurrentUser();
          const user = data?.user;
          const isVerified = user?.email_confirmed_at != null || user?.app_metadata?.provider === 'google';

          if (user && isVerified) {
            await this.supabaseService.registerNewDeviceSession(user.id);
            this.router.navigate(['/']);
          } else {
            await this.supabaseService.signOut();
            this.router.navigate(['/login']);
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
          this.router.navigate(['/login']);
        }
      }
    } catch (err) {
      console.error('Session validation error:', err);
    }
  }
}
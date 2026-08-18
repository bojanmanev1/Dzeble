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
    // 1. Setup Deep Link Listener for Mobile Email Confirmations (dzeble://)
    this.setupDeepLinks();

    // 2. Background analytics tracking
    this.deviceTracker.trackDevice().catch(err => console.error('Tracking error:', err));

    // 3. Single-Device Session Enforcer
    await this.checkSingleDeviceSession();
  }

  private setupDeepLinks() {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(async () => {
        // Example event.url: dzeble://auth/callback#access_token=...
        if (event.url.includes('dzeble://')) {
          // Allow Supabase to process the URL fragment tokens
          const { data } = await this.supabaseService.getCurrentUser();

          if (data?.user?.email_confirmed_at) {
            await this.supabaseService.registerNewDeviceSession(data.user.id);
            this.router.navigate(['/']);
          } else {
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
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
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

  async ngOnInit() {
    // 1. Background analytics tracking
    this.deviceTracker.trackDevice().catch(err => console.error('Tracking error:', err));

    // 2. Single-Device Session Enforcer
    await this.checkSingleDeviceSession();
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
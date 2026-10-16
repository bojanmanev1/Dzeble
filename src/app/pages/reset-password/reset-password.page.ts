import { Component, inject, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../../services/supabase';
import { IonContent, IonSpinner, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, 
  lockClosedOutline, 
  eyeOutline, 
  eyeOffOutline, 
  checkmarkCircleOutline 
} from 'ionicons/icons';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, IonContent, IonSpinner, IonIcon],
})
export class ResetPasswordPage implements OnInit {
  private supabaseService = inject(SupabaseService);
  private navCtrl = inject(NavController);
  private translate = inject(TranslateService);

  newPassword = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor() {
    addIcons({
      'arrow-back-outline': arrowBackOutline,
      'lock-closed-outline': lockClosedOutline,
      'eye-outline': eyeOutline,
      'eye-off-outline': eyeOffOutline,
      'checkmark-circle-outline': checkmarkCircleOutline
    });
  }

  async ngOnInit() {
    this.supabaseService.isPasswordResetFlow = true;

    // If opened in a web browser with hash fragment or search params, parse and set recovery session
    if (typeof window !== 'undefined') {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);

      const code = queryParams.get('code') || hashParams.get('code');
      const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

      if (code) {
        try {
          await this.supabaseService.supabase.auth.exchangeCodeForSession(code);
        } catch (e) {
          console.warn('Could not exchange code for session:', e);
        }
      } else if (accessToken && refreshToken) {
        try {
          await this.supabaseService.supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } catch (e) {
          console.warn('Could not set session from URL hash:', e);
        }
      }
    }
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }

  toggleShowConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async goBack() {
    try {
      await this.supabaseService.signOut();
    } catch {}
    this.supabaseService.isPasswordResetFlow = false;
    this.navCtrl.navigateRoot('/login');
  }

  async onUpdatePassword() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.newPassword || this.newPassword.length < 6) {
      this.errorMessage = this.translate.instant('RESET_PASSWORD.ERR_MIN_LENGTH');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = this.translate.instant('RESET_PASSWORD.ERR_MISMATCH');
      return;
    }

    this.isLoading = true;

    try {
      await this.supabaseService.updateUserPassword(this.newPassword);

      // Force sign-out so user is NOT logged in in the background and must authenticate with their new password
      try {
        await this.supabaseService.signOut();
      } catch (signoutErr) {
        console.warn('Post-password-reset signout warning:', signoutErr);
      }
      this.supabaseService.isPasswordResetFlow = false;

      this.successMessage = this.translate.instant('RESET_PASSWORD.SUCCESS_MSG');
      setTimeout(() => {
        this.navCtrl.navigateRoot('/login');
      }, 2000);
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('auth session missing') || msg.includes('session')) {
        this.errorMessage = this.translate.instant('RESET_PASSWORD.ERR_SESSION_EXPIRED');
      } else if (msg.includes('different from the old password') || msg.includes('same password')) {
        this.errorMessage = this.translate.instant('RESET_PASSWORD.ERR_SAME_PASSWORD');
      } else if (msg.includes('for security purposes') || msg.includes('rate limit')) {
        const match = (err?.message || '').match(/(\d+)\s*second/i);
        this.errorMessage = match 
          ? this.translate.instant('AUTH.RATE_LIMIT_SECONDS', { seconds: match[1] })
          : this.translate.instant('AUTH.RATE_LIMIT_GENERIC');
      } else {
        this.errorMessage = this.translate.instant('RESET_PASSWORD.ERR_GENERIC');
      }
    } finally {
      this.isLoading = false;
    }
  }
}
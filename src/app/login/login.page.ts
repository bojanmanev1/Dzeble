import { Component, inject, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../services/supabase';
import { IonContent, IonSpinner, IonIcon } from '@ionic/angular/standalone';
import { NetworkService } from '../services/network';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, 
  mailOutline, 
  mailUnreadOutline, 
  checkmarkCircleOutline, 
  closeOutline, 
  refreshOutline,
  timerOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    IonContent,
    IonSpinner,
    IonIcon
  ]
})
export class LoginPage implements OnInit, OnDestroy {
  constructor() {
    addIcons({ 
      'arrow-back-outline': arrowBackOutline,
      'mail-outline': mailOutline,
      'mail-unread-outline': mailUnreadOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-outline': closeOutline,
      'refresh-outline': refreshOutline,
      'timer-outline': timerOutline
    });
  }
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private zone = inject(NgZone);
  private translate = inject(TranslateService);
  public networkService = inject(NetworkService);

  fullName = '';
  email = '';
  password = '';

  isSignUpMode = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // In-app Modern Feedback / Success Popup state
  isSuccessModalOpen = false;
  popupTitle = '';
  popupSubtitle = '';
  popupNote = '';
  popupEmail = '';
  isVerificationModal = true;
  isResending = false;
  resendFeedbackMessage = '';
  resendCountdown = 0;
  private resendTimer: any = null;

  ngOnInit() {
    // 1. Immediately check if user is already authenticated (returning from Google OAuth or deep link)
    this.checkExistingSession();

    // 2. Auth state listener: catch returning Google OAuth or deep link sessions
    this.supabaseService.onAuthStateChange(async (event, session) => {
      const user = session?.user;
      if (!user) return;

      const isVerified = this.supabaseService.isUserVerified(user);

      if (isVerified && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION')) {
        await this.supabaseService.registerNewDeviceSession(user.id);
        this.zone.run(() => {
          this.navCtrl.navigateRoot('/dashboard');
        });
      }
    });
  }

  ngOnDestroy() {
    this.clearResendTimer();
  }

  async checkExistingSession() {
    try {
      const { data } = await this.supabaseService.getCurrentUser();
      const user = data?.user;
      if (user && this.supabaseService.isUserVerified(user)) {
        await this.supabaseService.registerNewDeviceSession(user.id);
        this.zone.run(() => {
          this.navCtrl.navigateRoot('/dashboard');
        });
      }
    } catch (e) {
      console.warn('Check existing session error:', e);
    }
  }

  toggleMode() {
    this.isSignUpMode = !this.isSignUpMode;
    this.errorMessage = '';
    this.successMessage = '';
  }

  openSignupSuccessPopup(email: string) {
    this.popupTitle = this.translate.instant('AUTH.SIGNUP_SUCCESS_TITLE');
    this.popupSubtitle = this.translate.instant('AUTH.SIGNUP_SUCCESS_SUBTITLE');
    this.popupNote = this.translate.instant('AUTH.SIGNUP_SUCCESS_NOTE');
    this.popupEmail = email;
    this.isVerificationModal = true;
    this.resendFeedbackMessage = '';
    this.clearResendTimer();
    this.isSuccessModalOpen = true;
  }

  closeSuccessModal() {
    this.isSuccessModalOpen = false;
    this.resendFeedbackMessage = '';
    this.clearResendTimer();
  }

  onPopupPrimaryAction() {
    this.closeSuccessModal();
    this.isSignUpMode = false; // Switch UI to login tab
  }

  async onPopupResendEmail() {
    if (!this.popupEmail || this.isResending || this.resendCountdown > 0) return;
    this.isResending = true;
    this.resendFeedbackMessage = '';

    try {
      await this.supabaseService.resendConfirmationEmail(this.popupEmail);
      this.resendFeedbackMessage = this.translate.instant('AUTH.EMAIL_RESENT_SUCCESS');
      this.startResendCountdown(60);
    } catch (err: any) {
      this.handleResendRateLimitOrError(err);
    } finally {
      this.isResending = false;
    }
  }

  private handleResendRateLimitOrError(err: any) {
    const rawMsg = (err?.message || '').toLowerCase();
    const code = (err?.code || '').toLowerCase();

    if (
      rawMsg.includes('for security purposes') || 
      rawMsg.includes('only request this after') || 
      code === 'over_email_send_rate_limit' || 
      rawMsg.includes('rate limit')
    ) {
      const match = (err?.message || '').match(/(\d+)\s*second/i);
      const seconds = match ? parseInt(match[1], 10) : 60;
      this.startResendCountdown(seconds);
    } else {
      this.resendFeedbackMessage = this.getTranslatedAuthError(err);
    }
  }

  private startResendCountdown(seconds: number) {
    this.clearResendTimer();
    this.resendCountdown = seconds;
    this.updateResendFeedback();

    this.resendTimer = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        this.clearResendTimer();
        this.resendFeedbackMessage = '';
      } else {
        this.updateResendFeedback();
      }
    }, 1000);
  }

  private updateResendFeedback() {
    this.resendFeedbackMessage = this.translate.instant('AUTH.RATE_LIMIT_SECONDS', { seconds: this.resendCountdown });
  }

  private clearResendTimer() {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }

  async onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = this.translate.instant('AUTH.FILL_REQUIRED_FIELDS');
      return;
    }

    this.isLoading = true;

    try {
      if (this.isSignUpMode) {
        // --- SIGN UP FLOW ---
        const { user } = await this.supabaseService.signUp(this.email.trim(), this.password, this.fullName);

        // Always log out immediately so unverified accounts cannot navigate around
        await this.supabaseService.signOut();

        const isConfirmed = user?.email_confirmed_at != null || user?.confirmed_at != null;
        if (!isConfirmed) {
          this.openSignupSuccessPopup(this.email.trim());
        } else {
          this.zone.run(() => {
            this.navCtrl.navigateRoot('/dashboard');
          });
        }
      } else {
        // --- SIGN IN FLOW ---
        const data = await this.supabaseService.signIn(this.email.trim(), this.password);
        const user = data?.user;

        if (user) {
          this.zone.run(() => {
            this.navCtrl.navigateRoot('/dashboard');
          });
        }
      }
    } catch (err: any) {
      console.error('Auth Error:', err);

      const rawMsg = (err?.message || '').toLowerCase();
      const code = (err?.code || '').toLowerCase();

      // 1. Invalid credentials
      if (code === 'invalid_credentials' || rawMsg.includes('invalid login credentials') || rawMsg.includes('invalid_credentials')) {
        this.errorMessage = this.translate.instant('AUTH.ERRORS.invalid_credentials');
      } 
      // 2. Email already registered
      else if (rawMsg.includes('already registered') || rawMsg.includes('user already exists') || code === 'user_already_exists') {
        this.popupTitle = this.translate.instant('AUTH.ERRORS.user_already_exists');
        this.popupSubtitle = this.translate.instant('AUTH.EMAIL_ALREADY_REGISTERED_CONFIRM');
        this.popupNote = this.translate.instant('AUTH.SIGNUP_SUCCESS_NOTE');
        this.popupEmail = this.email.trim();
        this.isVerificationModal = true;
        this.resendFeedbackMessage = '';
        this.clearResendTimer();
        this.isSuccessModalOpen = true;
      } 
      // 3. Email not confirmed
      else if (rawMsg.includes('email not confirmed') || code === 'email_not_confirmed') {
        this.errorMessage = this.translate.instant('AUTH.EMAIL_NOT_CONFIRMED');
      } 
      // 4. Rate limit or fallback translated error
      else {
        this.errorMessage = this.getTranslatedAuthError(err);
      }
    } finally {
      this.isLoading = false;
    }
  }

  async signInWithGoogle() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      await this.supabaseService.signInWithGoogle();
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      this.errorMessage = this.translate.instant('AUTH.GOOGLE_ERROR');
    } finally {
      this.isLoading = false;
    }
  }

  goBack() {
    this.zone.run(() => {
      this.navCtrl.navigateBack('/dashboard');
    });
  }

  async onForgotPassword() {
    if (!this.email) {
      this.errorMessage = this.translate.instant('AUTH.FORGOT_PASSWORD_EMAIL_REQUIRED');
      return;
    }

    try {
      this.isLoading = true;
      await this.supabaseService.resetPasswordForEmail(this.email.trim());
      this.popupTitle = this.translate.instant('AUTH.PASSWORD_RESET_SENT');
      this.popupSubtitle = this.translate.instant('AUTH.SIGNUP_SUCCESS_SUBTITLE');
      this.popupNote = this.translate.instant('AUTH.PASSWORD_RESET_SENT');
      this.popupEmail = this.email.trim();
      this.isVerificationModal = false;
      this.resendFeedbackMessage = '';
      this.clearResendTimer();
      this.isSuccessModalOpen = true;
    } catch (err: any) {
      this.errorMessage = this.getTranslatedAuthError(err);
    } finally {
      this.isLoading = false;
    }
  }

  public getTranslatedAuthError(err: any): string {
    if (!err) return this.translate.instant('AUTH.GENERIC_ERROR');
    const rawMsg = (err?.message || '').toLowerCase();
    const code = (err?.code || '').toLowerCase();

    if (
      rawMsg.includes('for security purposes') || 
      rawMsg.includes('only request this after') || 
      code === 'over_email_send_rate_limit' || 
      rawMsg.includes('rate limit')
    ) {
      const match = (err?.message || '').match(/(\d+)\s*second/i);
      if (match) {
        return this.translate.instant('AUTH.RATE_LIMIT_SECONDS', { seconds: match[1] });
      }
      return this.translate.instant('AUTH.RATE_LIMIT_GENERIC');
    }

    if (code === 'invalid_credentials' || rawMsg.includes('invalid login credentials') || rawMsg.includes('invalid_credentials')) {
      return this.translate.instant('AUTH.ERRORS.invalid_credentials');
    }

    if (rawMsg.includes('already registered') || rawMsg.includes('user already exists') || code === 'user_already_exists') {
      return this.translate.instant('AUTH.ERRORS.user_already_exists');
    }

    if (rawMsg.includes('email not confirmed') || code === 'email_not_confirmed') {
      return this.translate.instant('AUTH.EMAIL_NOT_CONFIRMED');
    }

    if (rawMsg.includes('network') || rawMsg.includes('fetch')) {
      return this.translate.instant('AUTH.NETWORK_ERROR');
    }

    return this.translate.instant('AUTH.GENERIC_ERROR');
  }
}
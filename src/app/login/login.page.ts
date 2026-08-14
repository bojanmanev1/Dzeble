import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../services/supabase';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';

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
    IonSpinner
  ]
})
export class LoginPage implements OnInit {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  fullName = '';
  email = '';
  password = '';

  isSignUpMode = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

ngOnInit() {
  // Catch returning Google OAuth users or confirmed sessions
  this.supabaseService.onAuthStateChange(async (event, session) => {
    const user = session?.user;
    const isEmailConfirmed = user?.email_confirmed_at != null || user?.app_metadata?.provider === 'google';

    // DO NOT redirect if this is just a SIGNED_UP event with an unconfirmed email
    if (user && isEmailConfirmed && event !== 'INITIAL_SESSION') {
      await this.supabaseService.registerNewDeviceSession(user.id);
      this.router.navigate(['/']);
    }
  });
}

  toggleMode() {
    this.isSignUpMode = !this.isSignUpMode;
    this.errorMessage = '';
    this.successMessage = '';
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
        await this.supabaseService.signUp(this.email, this.password, this.fullName);
        this.successMessage = this.translate.instant('AUTH.CONFIRM_EMAIL_SENT');
        alert(this.successMessage);
      } else {
        // --- SIGN IN FLOW ---
        await this.supabaseService.signIn(this.email, this.password);
        this.router.navigate(['/']);
      }
    } catch (err: any) {
      console.error('Auth Error:', err);

      if (err.message?.includes('already registered')) {
        // Offer to resend confirmation email if account exists but isn't confirmed
        const resendMsg = this.translate.instant('AUTH.RESEND_PROMPT') || 
          'Оваа е-пошта е веќе регистрирана, но сè уште не е потврдена. Дали сакате повторно да добиете е-пошта за потврда?';
        
        const shouldResend = confirm(resendMsg);
        
        if (shouldResend) {
          try {
            await this.supabaseService.resendConfirmationEmail(this.email);
            this.successMessage = this.translate.instant('AUTH.CONFIRM_EMAIL_SENT');
            alert(this.successMessage);
          } catch (resendErr: any) {
            this.errorMessage = resendErr.message;
          }
        }
      } else {
        this.errorMessage = err.message || this.translate.instant('AUTH.GENERIC_ERROR');
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
      this.errorMessage = err.message || this.translate.instant('AUTH.GOOGLE_ERROR');
      this.isLoading = false;
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
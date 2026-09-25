import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SupabaseService } from '../services/supabase';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { NetworkService } from '../services/network';

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
  public networkService = inject(NetworkService);

  fullName = '';
  email = '';
  password = '';

  isSignUpMode = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit() {
    // Auth state listener: ONLY redirect if user is authenticated and email is verified
    this.supabaseService.onAuthStateChange(async (event, session) => {
      const user = session?.user;
      const isEmailVerified = user?.email_confirmed_at != null || user?.app_metadata?.provider === 'google';

      if (user && isEmailVerified && event !== 'INITIAL_SESSION') {
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
        const { user } = await this.supabaseService.signUp(this.email, this.password, this.fullName);

        // Always log out immediately so unverified accounts cannot navigate around
        await this.supabaseService.signOut();

        if (!user?.email_confirmed_at) {
          this.successMessage = this.translate.instant('AUTH.SIGNUP_SUCCESS');
          alert(this.successMessage);
          this.isSignUpMode = false; // Switch UI to login tab
        } else {
          this.router.navigate(['/']);
        }
      } else {
        // --- SIGN IN FLOW ---
        const { user } = await this.supabaseService.signIn(this.email, this.password);

        // Reject login if email is not verified
        if (user && !user.email_confirmed_at) {
          await this.supabaseService.signOut();
          this.errorMessage = this.translate.instant('AUTH.EMAIL_NOT_CONFIRMED');
          return;
        }

        this.router.navigate(['/']);
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
        const resendMsg = this.translate.instant('AUTH.EMAIL_ALREADY_REGISTERED_CONFIRM');
        
        if (confirm(resendMsg)) {
          try {
            await this.supabaseService.resendConfirmationEmail(this.email);
            alert(this.translate.instant('AUTH.CONFIRMATION_RESENT'));
          } catch (resendErr: any) {
            this.errorMessage = resendErr?.message || this.translate.instant('AUTH.GENERIC_ERROR');
          }
        }
      } 
      // 3. Email not confirmed
      else if (rawMsg.includes('email not confirmed') || code === 'email_not_confirmed') {
        this.errorMessage = this.translate.instant('AUTH.EMAIL_NOT_CONFIRMED');
      } 
      // 4. Fallback generic error
      else {
        this.errorMessage = this.translate.instant('AUTH.GENERIC_ERROR');
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

  async onForgotPassword() {
  if (!this.email) {
    this.errorMessage = 'Ве молиме внесете ја вашата е-пошта за ресетирање.';
    return;
  }

  try {
    this.isLoading = true;
    await this.supabaseService.resetPasswordForEmail(this.email);
    alert('Испратена е порака за ресетирање на вашата е-пошта!');
  } catch (err: any) {
    this.errorMessage = err.message;
  } finally {
    this.isLoading = false;
  }
}
}
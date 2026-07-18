// src/app/login/login.page.ts
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SupabaseService } from '../services/supabase';
import { 
  IonContent, 
  IonSpinner
} from '@ionic/angular/standalone';

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
export class LoginPage {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  email = '';
  password = '';
  
  isSignUpMode = false; // Toggles between Login and Register views
  isLoading = false;
  errorMessage = '';

  toggleMode() {
    this.isSignUpMode = !this.isSignUpMode;
    this.errorMessage = '';
  }

  async onSubmit() {
    if (!this.email || !this.password) return;
    
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.isSignUpMode) {
        // Sign Up
        await this.supabaseService.signUp(this.email, this.password);
        alert('Успешна регистрација! Проверете ја вашата е-пошта за потврда.');
        this.isSignUpMode = false; // Switch them to login view
      } else {
        // Sign In
        await this.supabaseService.signIn(this.email, this.password);
        this.router.navigate(['/dashboard']); // Go straight back to home dashboard!
      }
    } catch (err: any) {
      console.error('Auth Error:', err);
      this.errorMessage = err.message || 'AUTH.ERROR';
    } finally {
      this.isLoading = false;
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
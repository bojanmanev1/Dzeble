import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner],
})
export class ResetPasswordPage {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  newPassword = '';
  confirmPassword = '';
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  async onUpdatePassword() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.newPassword || this.newPassword.length < 6) {
      this.errorMessage = 'Лозинката мора да биде најмалку 6 карактери.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Лозинките не се совпаѓаат.';
      return;
    }

    this.isLoading = true;

    try {
      await this.supabaseService.updateUserPassword(this.newPassword);
      this.successMessage = 'Лозинката е успешно променета!';
      setTimeout(() => this.router.navigate(['/']), 2000);
    } catch (err: any) {
      this.errorMessage = err.message || 'Грешка при менување на лозинката.';
    } finally {
      this.isLoading = false;
    }
  }
}
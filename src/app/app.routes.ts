// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then( m => m.LoginPage)
  },  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password.page').then( m => m.ResetPasswordPage)
  },

  // {
  //   path: 'login',
  //   loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  // },
  // {
  //   path: 'premium-signup',
  //   loadComponent: () => import('./premium/premium.page').then((m) => m.PremiumPage),
  // },
];
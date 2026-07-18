// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { importProvidersFrom, inject, provideAppInitializer } from '@angular/core';

// Modern Standalone Translations
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(), // Necessary for loading json translation files
    
    // Modern ngx-translate configuration
    provideTranslateService({
      lang: 'mk',
      fallbackLang: 'mk',
      // We pass the HTTP loader configuration inside the service's loader property:
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/', // Make sure this path points correctly to your assets
        suffix: '.json',
      })
    }),
  ],
});
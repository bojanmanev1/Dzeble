import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'theme_mode';
  private darkModeSubject = new BehaviorSubject<boolean>(false);
  public isDarkMode$ = this.darkModeSubject.asObservable();

  constructor() {
    this.initializeTheme();
  }

  /**
   * Initializes theme on app boot:
   * 1. Checks localStorage for an explicit user preference ('dark' | 'light').
   * 2. If no saved preference exists, falls back to the phone/device preset (prefers-color-scheme).
   * 3. Listens for system changes if user hasn't explicitly set a preference.
   */
  public initializeTheme(): void {
    const savedTheme = localStorage.getItem(this.STORAGE_KEY);

    if (savedTheme !== null) {
      const isDark = savedTheme === 'dark';
      this.applyTheme(isDark);
    } else {
      // Preset based on phone/device system setting
      const devicePrefersDark = typeof window !== 'undefined' && 
        window.matchMedia && 
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      this.applyTheme(devicePrefersDark);
    }

    // Listen to real-time phone preset changes if user hasn't overridden
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (localStorage.getItem(this.STORAGE_KEY) === null) {
          this.applyTheme(e.matches);
        }
      });
    }
  }

  /**
   * Toggles or sets the dark theme and saves preference to localStorage.
   */
  public toggleTheme(isDark?: boolean): void {
    const nextState = isDark !== undefined ? isDark : !this.darkModeSubject.value;
    localStorage.setItem(this.STORAGE_KEY, nextState ? 'dark' : 'light');
    this.applyTheme(nextState);
  }

  /**
   * Returns current dark mode status synchronously.
   */
  public isDark(): boolean {
    return this.darkModeSubject.value;
  }

  private applyTheme(isDark: boolean): void {
    this.darkModeSubject.next(isDark);

    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark', isDark);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.classList.toggle('ion-palette-dark', isDark);

      // Smooth status bar / browser tab theme matching
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#121514' : '#fcfcfc');
      }
    }
  }
}

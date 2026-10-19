import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export interface AnalyticsEvent {
  widget_id: string;
  event_name: string;
  entity_name?: string;
  city?: string;
  municipality?: string;
  metadata?: Record<string, any>;
  platform?: string;
  hour_of_day?: number;
  day_of_week?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private supabaseService = inject(SupabaseService);
  private queue: AnalyticsEvent[] = [];
  private flushTimer: any = null;
  private readonly BATCH_SIZE = 8;
  private readonly FLUSH_INTERVAL_MS = 25000; // Flush every 25 seconds

  constructor() {
    this.startPeriodicFlush();
    this.setupLifecycleListener();
  }

  /**
   * Track an anonymized consumer action without any personally identifiable data.
   */
  public track(
    widgetId: string,
    eventName: string,
    entityName?: string,
    metadata?: Record<string, any>,
    municipality?: string
  ): void {
    const now = new Date();
    const city = localStorage.getItem('user_current_city') || 'Скопје';
    const fallbackMuni = localStorage.getItem('user_current_municipality') || (city === 'Скопје' ? 'Центар' : city);

    const event: AnalyticsEvent = {
      widget_id: widgetId,
      event_name: eventName,
      entity_name: entityName,
      city: city,
      municipality: municipality || fallbackMuni,
      metadata: metadata || {},
      platform: Capacitor.getPlatform() || 'web',
      hour_of_day: now.getHours(),
      day_of_week: now.getDay()
    };

    this.queue.push(event);

    // If queue reaches batch size, flush immediately
    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Flush queued events to Supabase in a single batch insert.
   */
  public async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    try {
      const { error } = await this.supabaseService.supabase
        .from('anonymous_analytics_events')
        .insert(batch);

      if (error) {
        // If error, don't crash, retain up to 30 events in queue to retry
        console.warn('Analytics batch insert skipped:', error.message);
        if (this.queue.length < 30) {
          this.queue.unshift(...batch.slice(0, 10));
        }
      }
    } catch (err) {
      console.warn('Analytics connection notice:', err);
    }
  }

  private startPeriodicFlush(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  private setupLifecycleListener(): void {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          // App going to background, flush queue immediately
          this.flush();
        }
      });
    }
  }
}

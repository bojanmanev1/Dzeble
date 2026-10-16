import { Injectable, inject, NgZone } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class SessionTrackerService {
  private supabaseService = inject(SupabaseService);
  private zone = inject(NgZone);

  private currentSessionId: string | null = null;
  private sessionStartTime: number = 0;
  private lastPausedTime: number = 0;
  private heartbeatInterval: any = null;
  private isInitialized = false;

  // If user is in background for more than 5 minutes, next open is treated as a new session
  private readonly SESSION_TIMEOUT_MS = 5 * 60 * 1000;

  /**
   * Initializes session tracking for native and web.
   */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    await this.startNewSession();
    this.setupLifecycleListeners();
  }

  /**
   * Starts a brand new session and inserts the initial record in Supabase user_sessions.
   */
  private async startNewSession() {
    try {
      this.currentSessionId = crypto.randomUUID();
      this.sessionStartTime = Date.now();

      const deviceId = await this.supabaseService.getDeviceId();
      const platform = Capacitor.getPlatform() || 'web';
      const currentUser = (await this.supabaseService.supabase.auth.getUser()).data?.user;

      const startedAtIso = new Date(this.sessionStartTime).toISOString();

      await this.supabaseService.supabase
        .from('user_sessions')
        .insert({
          id: this.currentSessionId,
          device_id: deviceId,
          user_id: currentUser?.id || null,
          email: currentUser?.email || null,
          platform: platform,
          started_at: startedAtIso,
          ended_at: startedAtIso,
          duration_seconds: 0
        });

      this.startHeartbeat();
    } catch (err) {
      console.warn('SessionTracker: Error starting new session:', err);
    }
  }

  /**
   * Updates duration and ended_at of current session in Supabase.
   */
  private async updateSessionDuration(isClosing = false) {
    if (!this.currentSessionId || !this.sessionStartTime) return;

    try {
      const durationSeconds = Math.max(1, Math.round((Date.now() - this.sessionStartTime) / 1000));
      const endedAtIso = new Date().toISOString();

      await this.supabaseService.supabase
        .from('user_sessions')
        .update({
          ended_at: endedAtIso,
          duration_seconds: durationSeconds
        })
        .eq('id', this.currentSessionId);

      if (isClosing) {
        this.stopHeartbeat();
      }
    } catch (err) {
      console.warn('SessionTracker: Error updating session duration:', err);
    }
  }

  /**
   * Heartbeat running every 30 seconds to flush session duration to Supabase.
   * Ensures minimal data loss if app terminates unexpectedly.
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.zone.run(() => {
        this.updateSessionDuration(false);
      });
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Updates user_id and email if user logs in during an active session.
   */
  async setSessionUser(user: { id: string; email?: string } | null) {
    if (!this.currentSessionId || !user) return;
    try {
      await this.supabaseService.supabase
        .from('user_sessions')
        .update({
          user_id: user.id,
          email: user.email || null
        })
        .eq('id', this.currentSessionId);
    } catch (err) {
      console.warn('SessionTracker: Error updating session user:', err);
    }
  }

  /**
   * Hooks into app lifecycle events (Native + Web).
   */
  private setupLifecycleListeners() {
    // 1. Native lifecycle via Capacitor App plugin
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', async ({ isActive }) => {
        this.zone.run(async () => {
          if (!isActive) {
            // App sent to background
            this.lastPausedTime = Date.now();
            await this.updateSessionDuration(true);
          } else {
            // App brought to foreground
            const elapsed = Date.now() - this.lastPausedTime;
            if (elapsed > this.SESSION_TIMEOUT_MS || !this.currentSessionId) {
              await this.startNewSession();
            } else {
              this.startHeartbeat();
              await this.updateSessionDuration(false);
            }
          }
        });
      });
    }

    // 2. Web browser lifecycle (preview & browser users)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.zone.run(async () => {
          if (document.hidden) {
            this.lastPausedTime = Date.now();
            await this.updateSessionDuration(true);
          } else {
            const elapsed = Date.now() - this.lastPausedTime;
            if (elapsed > this.SESSION_TIMEOUT_MS || !this.currentSessionId) {
              await this.startNewSession();
            } else {
              this.startHeartbeat();
              await this.updateSessionDuration(false);
            }
          }
        });
      });

      window.addEventListener('beforeunload', () => {
        this.updateSessionDuration(true);
      });
    }
  }
}

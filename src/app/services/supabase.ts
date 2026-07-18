import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  
  // Expose user state as an observable so the UI reacts instantly when they log in
  public currentUser$ = new BehaviorSubject<User | null>(null);
  public isPremium$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

    // Listen to Auth changes automatically (e.g., when a guest logs in)
    this.supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      this.currentUser$.next(user);
      
      if (user) {
        this.checkPremiumStatus(user.id);
      } else {
        this.isPremium$.next(false);
      }
    });
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  // A quick method to check if their profile has premium active
  private async checkPremiumStatus(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .single();

    if (data && !error) {
      this.isPremium$.next(data.is_premium);
    }
  }
// 1. SIGN UP method
  async signUp(email: string, password: string) {
    const cleanEmail = email.trim().replace(/^["']|["']$/g, '');
    
    const { data, error } = await this.supabase.auth.signUp({
      email: cleanEmail,
      password
    });
    if (error) throw error;
    return data;
  }

  // 2. SIGN IN method
  async signIn(email: string, password: string) {
    const cleanEmail = email.trim().replace(/^["']|["']$/g, '');

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });
    if (error) throw error;
    return data;
  }
  // Sign out the current user
async signOut() {
    // 1. Remove our local device tracking session
    await Preferences.remove({ key: 'active_app_session_id' });
    
    // 2. Await the sign out call to resolve the promise, then get the error
    const { error } = await this.supabase.auth.signOut();
    
    // 3. Update local observables so the UI reacts instantly
    this.currentUser$.next(null);
    this.isPremium$.next(false);

    if (error) throw error;
  }

  async upgradeToPremium(userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ is_premium: true })
      .eq('id', userId);

    if (error) {
      console.error('Error upgrading profile:', error);
      throw error;
    }

    // Push the updated state instantly to our app stream
    this.isPremium$.next(true);
    return true;
  }

}
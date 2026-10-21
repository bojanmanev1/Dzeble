import { Injectable } from '@angular/core';
import { SupabaseService } from '../services/supabase';
import { ScreenBrightness } from '@capacitor-community/screen-brightness';

export interface LoyaltyCard {
  id?: string;
  user_id?: string;
  store_name: string;
  barcode_data: string;
  barcode_format?: string;
  card_color?: string;
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoyaltyService {

  constructor(private supabaseService: SupabaseService) {}

  private getCacheKey(userId: string): string {
    return `dzeble_loyalty_cards_${userId}`;
  }

  public getCachedCards(userId: string): LoyaltyCard[] {
    try {
      const raw = localStorage.getItem(this.getCacheKey(userId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private setCachedCards(userId: string, cards: LoyaltyCard[]): void {
    try {
      localStorage.setItem(this.getCacheKey(userId), JSON.stringify(cards));
    } catch {}
  }

  /**
   * Fetch all loyalty cards for the current user with cache fallback and 1 retry on 502/network hiccup
   */
  async getUserCards(userId: string): Promise<LoyaltyCard[]> {
    const cached = this.getCachedCards(userId);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { data, error } = await this.supabaseService.client
          .from('user_loyalty_cards')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          this.setCachedCards(userId, data);
          return data;
        }

        if (error) {
          console.warn(`LoyaltyService: attempt ${attempt} warning:`, error.message || error);
          if (attempt === 1) {
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      } catch (err) {
        console.warn(`LoyaltyService: network attempt ${attempt} error:`, err);
        if (attempt === 1) {
          await new Promise(r => setTimeout(r, 1200));
        }
      }
    }

    // Fallback to locally cached cards if Supabase experienced 502 / network interruption
    return cached;
  }

  /**
   * Save a new loyalty card to Supabase
   */
  async addCard(card: LoyaltyCard): Promise<LoyaltyCard | null> {
    const { data, error } = await this.supabaseService.client
      .from('user_loyalty_cards')
      .insert([card])
      .select()
      .single();

    if (error) {
      console.error('Error adding loyalty card:', error);
      return null;
    }

    if (data && card.user_id) {
      const current = this.getCachedCards(card.user_id);
      this.setCachedCards(card.user_id, [data, ...current]);
    }

    return data;
  }

  /**
   * Delete a loyalty card by ID
   */
  async deleteCard(cardId: string): Promise<boolean> {
    const { error } = await this.supabaseService.client
      .from('user_loyalty_cards')
      .delete()
      .eq('id', cardId);

    if (error) {
      console.error('Error deleting loyalty card:', error);
      return false;
    }
    return true;
  }

  /**
   * Sets screen brightness to 100% for physical checkout barcode scanners
   */
  async setMaxBrightness() {
    try {
      await ScreenBrightness.setBrightness({ brightness: 1.0 });
    } catch (e) {
      console.warn('Screen brightness control unavailable:', e);
    }
  }

  /**
   * Restores original system brightness
   */
  async resetBrightness() {
    try {
      await ScreenBrightness.setBrightness({ brightness: -1 });
    } catch (e) {
      console.warn('Screen brightness reset failed:', e);
    }
  }
}
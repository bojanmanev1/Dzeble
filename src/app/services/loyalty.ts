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

  /**
   * Fetch all loyalty cards for the current user
   */
  async getUserCards(userId: string): Promise<LoyaltyCard[]> {
    const { data, error } = await this.supabaseService.client
      .from('user_loyalty_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching loyalty cards:', error);
      return [];
    }
    return data || [];
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
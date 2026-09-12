import { supabase } from '../../lib/supabase';
import type { LoyaltyAccount } from '../../types';

export const loyaltyService = {
  async getAccount(userId: string): Promise<LoyaltyAccount | null> {
    const { data, error } = await supabase
      .from('loyalty_accounts')
      .select('*, loyalty_transactions(*)')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return {
      ...(data as any),
      balance: data?.balance || 0,
      history: (data as any)?.loyalty_transactions || []
    } as LoyaltyAccount;
  }
};

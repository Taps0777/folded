import { supabase } from '../../lib/supabase';

export interface AlterationService {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  active: boolean;
}

export const alterationService = {
  async getAllAlterations(): Promise<AlterationService[]> {
    const { data, error } = await supabase
      .from('alteration_services')
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true });

    if (error) throw error;
    return (data || []) as AlterationService[];
  }
};
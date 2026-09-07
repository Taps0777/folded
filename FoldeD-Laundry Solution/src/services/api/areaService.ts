import { supabase } from '../../lib/supabase';

export const areaService = {
  async getAllAreas(): Promise<any[]> {
    const { data, error } = await supabase
      .from('service_areas')
      .select('*')
      .order('pincode', { ascending: true });

    if (error) throw error;
    return data;
  },

  async toggleServiceArea(pincode: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('service_areas')
      .update({ is_active: isActive })
      .eq('pincode', pincode);

    if (error) throw error;
  },

  async checkServiceability(pincode: string): Promise<{ serviceable: boolean; area?: any }> {
    const { data, error } = await supabase
      .from('service_areas')
      .select('*')
      .eq('pincode', pincode)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return { serviceable: false };
      throw error;
    }
    return { serviceable: true, area: data };
  }
};

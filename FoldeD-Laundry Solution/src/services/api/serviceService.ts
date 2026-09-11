import { supabase } from '../../lib/supabase';
import type { Service } from '../../types';

export const serviceService = {
  async getAllServices(): Promise<Service[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true);
    
    if (error) throw error;
    
    // Map DB fields to frontend format
    return (data || []).map((row) => {
      const r = row as any;
      // pricing_type comes back from Postgres as an enum ('PER_KG'/'PER_ITEM')
      // and may be null on legacy rows; normalise without throwing.
      const pricingType = String(r.pricing_type || '').toLowerCase();
      return {
      id: r.id,
      name: r.name,
      description: r.description || '',
      category: r.category || 'wash_fold',
      minimum_quantity: r.minimum_quantity || 1,
      maximum_quantity: r.maximum_quantity || 20,
      pricing_type: (pricingType === 'per_item' ? 'per_item' : 'per_kg') as 'per_kg' | 'per_item',
      base_price: Number(r.base_price) || 0,
      express_surcharge: Number(r.express_surcharge) || 100,
      turnaround_hours: r.turnaround_hours || r.estimated_processing_hours || 24,
    }});
  },

  async updatePrice(serviceId: string, newPrice: number): Promise<void> {
    const { error } = await supabase
      .from('services')
      .update({ base_price: newPrice })
      .eq('id', serviceId);

    if (error) throw error;
  }
};

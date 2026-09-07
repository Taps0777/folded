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
      return {
      id: r.id,
      name: r.name,
      description: r.description || '',
      category: r.category || 'wash_fold',
      minimum_quantity: r.minimum_quantity || 1,
      pricing_type: r.pricing_type.toLowerCase() as 'per_kg' | 'per_item',
      base_price: Number(r.base_price),
      turnaround_hours: r.turnaround_hours || r.estimated_processing_hours || 24,
      express_surcharge: 100, // Hardcoded for demo if not in DB
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

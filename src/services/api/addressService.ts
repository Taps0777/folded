import { supabase } from '../../lib/supabase';
import type { Address } from '../../types';

export const addressService = {
  async getAddressesByUser(userId: string): Promise<Address[]> {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });

    if (error) throw error;

    return (data || []).map((d: any) => ({
      id: d.id,
      user_id: d.user_id,
      name: d.label || 'Address',
      phone: d.phone || '',
      address_line: d.address_line_1,
      landmark: d.landmark,
      city: d.city,
      state: d.state,
      postal_code: d.pincode,
      address_type: 'home',
      is_default: d.is_default,
    }));
  },

  async addAddress(userId: string, address: Partial<Address>) {
    const { error } = await supabase
      .from('addresses')
      .insert({
        user_id: userId,
        label: address.name,
        phone: address.phone,
        address_line_1: address.address_line,
        city: address.city,
        state: address.state || 'Karnataka',
        pincode: address.postal_code,
        is_default: address.is_default || false
      } as any);
    if (error) throw error;
  },

  async deleteAddress(addressId: string) {
    const { error } = await supabase.from('addresses').delete().eq('id', addressId);
    if (error) throw error;
  },

  async setDefaultAddress(userId: string, addressId: string) {
    // Set the new default FIRST, then clear the others. The previous order
    // (unset everything, then set) left the user with zero default addresses if
    // the second update failed — and neither error was checked.
    const { error: setError } = await supabase
      .from('addresses')
      .update({ is_default: true } as any)
      .eq('id', addressId)
      .eq('user_id', userId);
    if (setError) throw setError;

    const { error: unsetError } = await supabase
      .from('addresses')
      .update({ is_default: false } as any)
      .eq('user_id', userId)
      .neq('id', addressId);
    if (unsetError) throw unsetError;
  }
};

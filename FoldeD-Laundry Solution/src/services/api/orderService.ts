import { supabase } from '../../lib/supabase';
import type { Order, OrderStatus, OrderStatusHistoryItem } from '../../types';

export const orderService = {
  async getAllOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        address:addresses!orders_pickup_address_id_fkey(*),
        history:order_status_history(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbOrderToFrontendOrder);
  },

  async createOrder(orderData: any): Promise<{ id: string, delivery_pin: string }> {
    const { data, error } = await supabase.rpc('create_order_secure', {
      p_customer_id: orderData.user_id,
      p_address_id: orderData.address.id,
      p_service_id: orderData.items[0].service_id,
      p_weight_kg: orderData.items[0].weight,
      p_is_express: orderData.express_surcharge > 0,
      p_coupon_code: orderData.coupon_code || null,
      p_special_instructions: orderData.notes || null,
      p_pickup_date: orderData.pickup_slot_date,
      p_pickup_slot: orderData.pickup_slot_time
    } as any);

    if (error) throw error;
    
    const responseData = data as any;
    return { id: responseData.id, delivery_pin: responseData.delivery_pin };
  },

  async getOrdersByUser(userId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        address:addresses!orders_pickup_address_id_fkey(*),
        history:order_status_history(*)
      `)
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    // Map data to match the frontend Order type
    return (data || []).map(mapDbOrderToFrontendOrder);
  },

  async getOrderById(orderId: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        address:addresses!orders_pickup_address_id_fkey(*),
        history:order_status_history(*)
      `)
      .eq('id', orderId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return mapDbOrderToFrontendOrder(data);
  },


  async updateOrderPickup(orderId: string, bagTagId: string, measuredWeight: number): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({
        bag_id: bagTagId,
        measured_weight_kg: measuredWeight
      } as any)
      .eq('id', orderId);
    if (error) throw error;
  },

  async advanceLaundryStage(orderId: string, stage: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({
        laundry_stage: stage
      } as any)
      .eq('id', orderId);
    if (error) throw error;
  },

  async submitQualityCheck(orderId: string, checkData: any): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({
        quality_check: checkData
      } as any)
      .eq('id', orderId);
    if (error) throw error;
  },

  async verifyDeliveryPin(orderId: string, pin: string): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase
      .from('orders')
      .select('delivery_pin')
      .eq('id', orderId)
      .single();
      
    if (error) return { success: false, message: 'Order not found' };
    
    const orderData = data as any;
    if (orderData.delivery_pin !== pin) {
      return { success: false, message: 'Invalid 4-digit PIN' };
    }
    
    await this.updateOrderStatus(orderId, 'DELIVERED', 'Delivery verified with PIN', 'Delivery Agent');
    return { success: true, message: 'PIN Verified' };
  },

  async updateOrderStatus(orderId: string, newStatus: OrderStatus, reason?: string, actorId?: string) {
    const { data, error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_reason: reason || null,
      p_quality_check: null
    } as any);

    if (error) throw error;
  }
};

// Helper to map DB snake_case columns to camelCase frontend types if needed
function mapDbOrderToFrontendOrder(dbData: any): Order {
  return {
    id: dbData.id,
    user_id: dbData.customer_id,
    customer_name: dbData.customer_name || 'Customer',
    customer_phone: dbData.customer_phone || '',
    address: {
      id: dbData.address?.id || '',
      user_id: dbData.address?.user_id || '',
      name: dbData.address?.label || 'Home',
      phone: dbData.address?.phone || '',
      address_line: dbData.address?.address_line_1 || '',
      city: dbData.address?.city || '',
      state: dbData.address?.state || '',
      postal_code: dbData.address?.pincode || '',
      address_type: 'home',
      is_default: dbData.address?.is_default || false,
    },
    status: dbData.status,
    items: (dbData.items || []).map((i: any) => ({
      id: i.id,
      service_id: i.item_id || 'dummy',
      service_name: i.service_name || 'Laundry Service', // Ideally fetch from items
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: i.total_price
    })),
    subtotal: dbData.subtotal,
    discount_amount: dbData.discount,
    delivery_charge: dbData.delivery_fee,
    express_surcharge: dbData.express_fee,
    total_amount: dbData.total,
    payment_status: dbData.payment_status,
    payment_method: 'razorpay',
    loyalty_points_used: 0,
    loyalty_points_earned: 0,
    pickup_slot_date: dbData.pickup_date || '',
    pickup_slot_time: dbData.pickup_time_slot || '',
    estimated_delivery: dbData.estimated_delivery_at || '',
    delivery_pin: '1234', // Generate this
    created_at: dbData.created_at,
    updated_at: dbData.updated_at,
    history: (dbData.history || []).map((h: any) => ({
      id: h.id,
      status: h.new_status,
      timestamp: h.timestamp,
      note: h.reason,
      actor: h.changed_by
    }))
  };
}

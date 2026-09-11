import { supabase } from '../../lib/supabase';
import type { Json } from '../../types/database.types';
import type {
  Order,
  OrderStatus,
  CreateOrderResult,
  VerifyPinResult,
  PaymentStatusResult,
} from '../../types';

export interface CreateOrderInput {
  customer_id: string;
  address_id: string;
  service_id: string;
  weight_kg?: number;
  is_express: boolean;
  coupon_code?: string | null;
  special_instructions?: string | null;
  pickup_date: string;
  pickup_slot: string;
  loyalty_points?: number;
}

export const orderService = {
  async getAllOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `*,
        items:order_items(*),
        address:addresses!orders_pickup_address_id_fkey(*),
        customer:profiles!orders_customer_id_fkey(full_name, phone),
        service:services!orders_service_id_fkey(name),
        history:order_status_history(*)`
      )
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbOrderToFrontendOrder);
  },

  async createOrder(orderData: CreateOrderInput): Promise<CreateOrderResult> {
    const { data, error } = await supabase.rpc('create_order_secure', {
      p_customer_id: orderData.customer_id,
      p_address_id: orderData.address_id,
      p_service_id: orderData.service_id,
      p_weight_kg: orderData.weight_kg ?? undefined,
      p_is_express: orderData.is_express,
      p_coupon_code: orderData.coupon_code || undefined,
      p_special_instructions: orderData.special_instructions || undefined,
      p_pickup_date: orderData.pickup_date,
      p_pickup_slot: orderData.pickup_slot,
      p_loyalty_points: orderData.loyalty_points ?? 0,
    });

    if (error) throw error;
    return data as unknown as CreateOrderResult;
  },

  async getOrdersByUser(userId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `*,
        items:order_items(*),
        address:addresses!orders_pickup_address_id_fkey(*),
        customer:profiles!orders_customer_id_fkey(full_name, phone),
        service:services!orders_service_id_fkey(name),
        history:order_status_history(*)`
      )
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbOrderToFrontendOrder);
  },

  async getOrderById(orderId: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `*,
        items:order_items(*),
        address:addresses!orders_pickup_address_id_fkey(*),
        customer:profiles!orders_customer_id_fkey(full_name, phone),
        service:services!orders_service_id_fkey(name),
        history:order_status_history(*)`
      )
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapDbOrderToFrontendOrder(data);
  },

  // Delivery PIN is returned ONLY to the order's customer (or admin) via a
  // secure RPC. The stored PIN is never fetched into the browser otherwise.
  async getDeliveryPin(orderId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_delivery_pin', { p_order_id: orderId });
    if (error) throw error;
    const result = data as unknown as { ok?: boolean; pin?: string; message?: string } | null;
    if (!result?.ok || !result.pin) return null;
    return result.pin;
  },

  async recordPickup(orderId: string, bagTagId: string, measuredWeight: number): Promise<void> {
    const { error } = await supabase.rpc('record_pickup', {
      p_order_id: orderId,
      p_bag_id: bagTagId,
      p_measured_weight_kg: measuredWeight,
    });
    if (error) throw error;
  },

  async advanceLaundryStage(orderId: string, stage: string): Promise<void> {
    const { error } = await supabase.rpc('advance_laundry_stage', {
      p_order_id: orderId,
      p_stage: stage,
    });
    if (error) throw error;
  },

  async submitQualityCheck(
    orderId: string,
    checkData: Record<string, unknown>,
    passed: boolean
  ): Promise<void> {
    const { error } = await supabase.rpc('submit_quality_check', {
      p_order_id: orderId,
      p_quality_check: checkData as unknown as Json,
      p_passed: passed,
    });
    if (error) throw error;
  },

  async verifyDeliveryPin(orderId: string, pin: string): Promise<VerifyPinResult> {
    const { data, error } = await supabase.rpc('verify_delivery_pin', {
      p_order_id: orderId,
      p_pin: pin,
    });
    if (error) throw error;
    const result = data as unknown as VerifyPinResult;
    return result ?? { ok: false, message: 'Unable to verify PIN' };
  },

  // Used by admins for in-lifecycle moves and by staff/customer through the
  // dedicated RPCs. Customers should call cancelOrder instead.
  async updateOrderStatus(orderId: string, newStatus: OrderStatus, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_reason: reason || undefined,
      p_quality_check: undefined,
    });
    if (error) throw error;
  },

  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_order', {
      p_order_id: orderId,
      p_reason: reason || undefined,
    });
    if (error) throw error;
  },

  async requestRefund(orderId: string, reason?: string) {
    const { data, error } = await supabase.rpc('request_refund', {
      p_order_id: orderId,
      p_reason: reason || undefined,
    });
    if (error) throw error;
    return data as unknown as { ok: boolean; refund_id?: string; razorpay_payment_id?: string; amount?: number; message?: string };
  },

  async adminOverrideStatus(orderId: string, newStatus: OrderStatus, reason: string): Promise<void> {
    const { error } = await supabase.rpc('admin_override_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_reason: reason,
    });
    if (error) throw error;
  },

  async assignPickupAgent(orderId: string, agentId: string): Promise<void> {
    const { error } = await supabase.rpc('assign_pickup_agent', {
      p_order_id: orderId,
      p_agent_id: agentId,
    });
    if (error) throw error;
  },

  async assignDeliveryAgent(orderId: string, agentId: string): Promise<void> {
    const { error } = await supabase.rpc('assign_delivery_agent', {
      p_order_id: orderId,
      p_agent_id: agentId,
    });
    if (error) throw error;
  },

  async getPaymentStatus(orderId: string): Promise<PaymentStatusResult> {
    const { data, error } = await supabase.rpc('get_order_payment_status', {
      p_order_id: orderId,
    });
    if (error) throw error;
    return (data as unknown as PaymentStatusResult) ?? { ok: false, message: 'Unable to load payment status' };
  },
};

// Map DB snake_case rows to frontend Order shape. delivery_pin is intentionally
// NOT mapped — it is only ever obtained through getDeliveryPin.
function mapDbOrderToFrontendOrder(dbData: Record<string, any>): Order {
  const items = (dbData.items || []).map((i: Record<string, any>) => ({
    id: i.id,
    service_id: i.service_id || dbData.service?.id || '',
    service_name: dbData.service?.name || i.service_name || 'Laundry Service',
    quantity: i.quantity,
    weight: i.weight ?? undefined,
    unit_price: Number(i.unit_price) || 0,
    total_price: Number(i.total_price) || 0,
  }));

  return {
    id: dbData.id,
    order_number: dbData.order_number,
    user_id: dbData.customer_id,
    customer_name: dbData.customer?.full_name || 'Customer',
    customer_phone: dbData.customer?.phone || '',
    address: {
      id: dbData.address?.id || '',
      user_id: dbData.address?.user_id || '',
      name: dbData.address?.label || 'Home',
      phone: dbData.address?.phone || '',
      address_line: dbData.address?.address_line_1 || '',
      landmark: dbData.address?.landmark || undefined,
      city: dbData.address?.city || '',
      state: dbData.address?.state || '',
      postal_code: dbData.address?.pincode || '',
      address_type: 'home',
      is_default: dbData.address?.is_default || false,
    },
    status: dbData.status,
    items,
    subtotal: Number(dbData.subtotal) || 0,
    discount_amount: Number(dbData.discount) || 0,
    delivery_charge: Number(dbData.delivery_fee) || 0,
    express_surcharge: Number(dbData.express_fee) || 0,
    total_amount: Number(dbData.total) || 0,
    payment_status: dbData.payment_status,
    payment_method: 'razorpay',
    loyalty_points_used: 0,
    loyalty_points_earned: 0,
    pickup_slot_date: dbData.pickup_date || '',
    pickup_slot_time: dbData.pickup_time_slot || '',
    estimated_delivery: dbData.estimated_delivery_at || '',
    created_at: dbData.created_at,
    updated_at: dbData.updated_at,
    history: (dbData.history || []).map((h: Record<string, any>) => ({
      id: h.id,
      status: h.new_status,
      timestamp: h.timestamp,
      note: h.reason,
      actor: h.changed_by,
    })),
    bag_id: dbData.bag_id || undefined,
    measured_weight_kg: dbData.measured_weight_kg ?? undefined,
    laundry_stage: dbData.laundry_stage ?? undefined,
    quality_check: dbData.quality_check ?? undefined,
    alterations: dbData.alterations ?? undefined,
  };
}
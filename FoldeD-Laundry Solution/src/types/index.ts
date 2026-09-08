export type UserRole = 'customer' | 'pickup_staff' | 'laundry_staff' | 'delivery_staff' | 'admin';

export type OrderStatus =
  | 'ORDER_PLACED'
  | 'CONFIRMED'
  | 'PENDING_PAYMENT'
  | 'PICKUP_ASSIGNED'
  | 'PICKUP_SCHEDULED'
  | 'PICKUP_STARTED'
  | 'PICKED_UP'
  | 'RECEIVED_AT_FACILITY'
  | 'PROCESSING'
  | 'SORTING'
  | 'WASHING'
  | 'DRYING'
  | 'IRONING'
  | 'FOLDING'
  | 'IRONING_FOLDING'
  | 'QUALITY_CHECK'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERY_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED_PICKUP'
  | 'DELIVERY_FAILED'
  | 'ON_HOLD'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export type LaundryStage =
  | 'RECEIVED'
  | 'SORTING'
  | 'WASHING'
  | 'DRYING'
  | 'IRONING_FOLDING'
  | 'QUALITY_CHECK'
  | 'READY';

export type ServiceCategory =
  | 'wash_fold'
  | 'wash_iron'
  | 'iron_only'
  | 'dry_clean'
  | 'premium_care'
  | 'spa';

export type PricingType = 'per_kg' | 'per_item';
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'razorpay' | 'upi' | 'card' | 'cod' | 'wallet';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  avatar_url?: string;
}

export interface Address {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address_line: string;
  landmark?: string;
  city: string;
  state: string;
  postal_code: string;
  address_type: 'home' | 'work' | 'other';
  is_default: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  pricing_type: PricingType;
  base_price: number;
  minimum_quantity: number;
  express_surcharge: number;
  turnaround_hours: number;
  popular?: boolean;
  tag?: string;
}

export interface OrderItem {
  id: string;
  service_id: string;
  service_name: string;
  quantity: number;
  weight?: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string;
}

export interface OrderStatusHistoryItem {
  id: string;
  status: OrderStatus;
  timestamp: string;
  note?: string;
  actor?: string;
}

export interface Order {
  id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  address: Address;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount_amount: number;
  delivery_charge: number;
  express_surcharge: number;
  total_amount: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  coupon_code?: string;
  loyalty_points_used: number;
  loyalty_points_earned: number;
  pickup_slot_date: string;
  pickup_slot_time: string;
  estimated_delivery: string;
  delivery_pin: string;
  notes?: string;
  bag_id?: string;
  measured_weight_kg?: number;
  pickup_photo_url?: string;
  pickup_staff_id?: string;
  pickup_staff_name?: string;
  delivery_staff_id?: string;
  delivery_staff_name?: string;
  laundry_stage?: LaundryStage;
  quality_check?: QualityCheck;
  alterations?: AlterationItem[];
  created_at: string;
  updated_at: string;
  history: OrderStatusHistoryItem[];
}

export interface AlterationItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface QualityCheck {
  stain_removal: boolean;
  collar_cuff: boolean;
  fabric_softness: boolean;
  fragrance: boolean;
  folding_neatness: boolean;
  eco_packaging: boolean;
  damage_detected: boolean;
  damage_notes?: string;
  inspector_name: string;
  inspected_at: string;
  passed: boolean;
}

export interface Coupon {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order: number;
  max_discount?: number;
  description: string;
  expires_at?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  period: 'month' | 'quarter';
  max_kg: number;
  free_pickups: number;
  features: string[];
  recommended?: boolean;
}

export interface LoyaltyAccount {
  user_id: string;
  balance: number;
  history: {
    id: string;
    type: 'earned' | 'redeemed';
    points: number;
    description: string;
    date: string;
  }[];
}

export interface SupportTicket {
  id: string;
  user_id: string;
  order_id?: string;
  subject: string;
  category: 'missing_item' | 'damaged_item' | 'late_delivery' | 'billing' | 'general';
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  resolution?: string;
}

export interface ServiceArea {
  postal_code: string;
  city: string;
  area_name: string;
  is_active: boolean;
  delivery_sla_hours: number;
}

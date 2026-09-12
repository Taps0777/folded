import type { Coupon, Service } from '../types';

// Client-side price ESTIMATE only. The authoritative final total is always
// computed server-side (create_order_secure). These helpers keep the estimate
// consistent with the server rules but are never trusted for payment.

export interface PriceEstimateInput {
  service?: Pick<
    Service,
    'pricing_type' | 'base_price' | 'express_surcharge' | 'minimum_quantity' | 'maximum_quantity'
  > | null;
  weightKg?: number;
  items?: Array<{ unitPrice: number; quantity: number }>;
  isExpress?: boolean;
  coupon?: Pick<Coupon, 'discount_type' | 'discount_value' | 'min_order' | 'max_discount'> | null;
  loyaltyPoints?: number;
}

export interface PriceEstimate {
  subtotal: number;
  discount: number;
  loyaltyDiscount: number;
  deliveryFee: number;
  expressFee: number;
  total: number;
}

export const DELIVERY_FEE_THRESHOLD = 199;
export const DELIVERY_FEE = 40;
export const LOYALTY_RUPEE_VALUE = 0.1; // ₹0.10 per point

export function calculateSubtotal(input: PriceEstimateInput): number {
  const service = input.service;
  // Callers often resolve the service with a `.find()` that can miss (e.g. a
  // preselected id that no longer exists). Return 0 rather than throwing.
  if (!service) return 0;
  if (service.pricing_type === 'per_kg') {
    return Math.round((service.base_price ?? 0) * (input.weightKg ?? 0) * 100) / 100;
  }
  if (service.pricing_type === 'per_item') {
    return (input.items ?? []).reduce(
      (sum, it) => sum + Math.round(it.unitPrice * it.quantity * 100) / 100,
      0
    );
  }
  return Math.round((service.base_price ?? 0) * 100) / 100;
}

export function calculateCouponDiscount(subtotal: number, coupon?: PriceEstimateInput['coupon']): number {
  if (!coupon) return 0;
  if (subtotal < coupon.min_order) return 0;
  let discount =
    coupon.discount_type === 'percentage'
      ? (subtotal * coupon.discount_value) / 100
      : coupon.discount_value;
  if (coupon.max_discount != null) discount = Math.min(discount, coupon.max_discount);
  return Math.min(discount, subtotal);
}

export function calculateLoyaltyDiscount(points: number): number {
  if (!points || points <= 0) return 0;
  return points * LOYALTY_RUPEE_VALUE;
}

export function estimatePrice(input: PriceEstimateInput): PriceEstimate {
  if (!input.service) {
    return { subtotal: 0, discount: 0, loyaltyDiscount: 0, deliveryFee: 0, expressFee: 0, total: 0 };
  }
  const subtotal = calculateSubtotal(input);
  const discount = calculateCouponDiscount(subtotal, input.coupon);
  const deliveryFee = subtotal < DELIVERY_FEE_THRESHOLD ? DELIVERY_FEE : 0;
  // Mirrors COALESCE(v_service.express_surcharge, 100) in create_order_secure:
  // a service row with no surcharge is charged the ₹100 default server-side, so
  // the estimate must not show ₹0 for it.
  const expressFee = input.isExpress ? input.service.express_surcharge ?? 100 : 0;
  const baseForLoyalty = subtotal + deliveryFee + expressFee - discount;
  const loyaltyDiscount = Math.min(calculateLoyaltyDiscount(input.loyaltyPoints ?? 0), baseForLoyalty);
  const total = Math.max(0, Math.round((baseForLoyalty - loyaltyDiscount) * 100) / 100);

  return { subtotal, discount, loyaltyDiscount, deliveryFee, expressFee, total };
}
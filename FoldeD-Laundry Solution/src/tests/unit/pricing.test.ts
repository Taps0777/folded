import { describe, it, expect } from 'vitest';
import {
  calculateCouponDiscount,
  calculateLoyaltyDiscount,
  calculateSubtotal,
  estimatePrice,
  DELIVERY_FEE,
  DELIVERY_FEE_THRESHOLD,
  LOYALTY_RUPEE_VALUE,
} from '../../lib/pricing';
import type { PriceEstimateInput } from '../../lib/pricing';

const service = (
  overrides: Partial<NonNullable<PriceEstimateInput['service']>> = {},
): NonNullable<PriceEstimateInput['service']> => ({
  pricing_type: 'per_kg',
  base_price: 50,
  express_surcharge: 100,
  minimum_quantity: 1,
  maximum_quantity: 20,
  ...overrides,
});

describe('pricing.calculateSubtotal', () => {
  it('multiplies base price by weight for per_kg services', () => {
    expect(calculateSubtotal({ service: service(), weightKg: 4 })).toBe(200);
  });

  it('rounds per_kg subtotals to two decimals', () => {
    expect(calculateSubtotal({ service: service({ base_price: 33.333 }), weightKg: 3 })).toBe(100);
  });

  it('sums unit price x quantity for per_item services', () => {
    expect(
      calculateSubtotal({
        service: service({ pricing_type: 'per_item' }),
        items: [
          { unitPrice: 40, quantity: 3 },
          { unitPrice: 120, quantity: 2 },
        ],
      }),
    ).toBe(360);
  });

  it('returns 0 — not a crash — when the service could not be resolved', () => {
    // Regression: an unresolved preselected service id used to dereference
    // undefined and white-screen the booking page.
    expect(calculateSubtotal({ service: null, weightKg: 4 })).toBe(0);
    expect(calculateSubtotal({ weightKg: 4 })).toBe(0);
  });

  it('treats missing weight/items as zero rather than NaN', () => {
    expect(calculateSubtotal({ service: service() })).toBe(0);
    expect(calculateSubtotal({ service: service({ pricing_type: 'per_item' }) })).toBe(0);
  });
});

describe('pricing.calculateCouponDiscount', () => {
  it('applies a percentage discount', () => {
    expect(
      calculateCouponDiscount(200, {
        discount_type: 'percentage',
        discount_value: 10,
        min_order: 0,
      }),
    ).toBe(20);
  });

  it('caps a percentage discount at max_discount', () => {
    expect(
      calculateCouponDiscount(1000, {
        discount_type: 'percentage',
        discount_value: 50,
        min_order: 0,
        max_discount: 150,
      }),
    ).toBe(150);
  });

  it('applies a fixed discount', () => {
    expect(
      calculateCouponDiscount(200, { discount_type: 'fixed', discount_value: 75, min_order: 0 }),
    ).toBe(75);
  });

  it('ignores a coupon whose minimum order is not met', () => {
    expect(
      calculateCouponDiscount(150, { discount_type: 'fixed', discount_value: 50, min_order: 199 }),
    ).toBe(0);
  });

  it('never discounts below zero even for an oversized fixed coupon', () => {
    expect(
      calculateCouponDiscount(80, { discount_type: 'fixed', discount_value: 500, min_order: 0 }),
    ).toBe(80);
  });

  it('returns 0 when there is no coupon', () => {
    expect(calculateCouponDiscount(200, null)).toBe(0);
    expect(calculateCouponDiscount(200, undefined)).toBe(0);
  });
});

describe('pricing.calculateLoyaltyDiscount', () => {
  it('converts points at the documented rupee value', () => {
    expect(calculateLoyaltyDiscount(250)).toBe(250 * LOYALTY_RUPEE_VALUE);
  });

  it('returns 0 for zero/negative/absent points', () => {
    expect(calculateLoyaltyDiscount(0)).toBe(0);
    expect(calculateLoyaltyDiscount(-5)).toBe(0);
    expect(calculateLoyaltyDiscount(undefined as unknown as number)).toBe(0);
  });
});

describe('pricing.estimatePrice', () => {
  it('returns an all-zero estimate for an unresolved service', () => {
    expect(estimatePrice({ service: null, weightKg: 4 })).toEqual({
      subtotal: 0,
      discount: 0,
      loyaltyDiscount: 0,
      deliveryFee: 0,
      expressFee: 0,
      total: 0,
    });
  });

  it('charges the delivery fee only below the free-delivery threshold', () => {
    // 3 kg x ₹50 = ₹150 -> below 199
    const below = estimatePrice({ service: service(), weightKg: 3 });
    expect(below.subtotal).toBe(150);
    expect(below.deliveryFee).toBe(DELIVERY_FEE);
    expect(below.total).toBe(150 + DELIVERY_FEE);

    // Exactly at the threshold is already free (server uses `subtotal < 199`).
    const at = estimatePrice({
      service: service({ base_price: DELIVERY_FEE_THRESHOLD }),
      weightKg: 1,
    });
    expect(at.subtotal).toBe(DELIVERY_FEE_THRESHOLD);
    expect(at.deliveryFee).toBe(0);

    const above = estimatePrice({ service: service(), weightKg: 4 });
    expect(above.deliveryFee).toBe(0);
    expect(above.total).toBe(200);
  });

  it('charges a flat express surcharge, not a percentage', () => {
    const estimate = estimatePrice({
      service: service({ base_price: 100, express_surcharge: 100 }),
      weightKg: 3, // subtotal 300 -> no delivery fee
      isExpress: true,
    });
    expect(estimate.expressFee).toBe(100);
    expect(estimate.total).toBe(400);
  });

  it('defaults the express surcharge to the server default when absent', () => {
    const estimate = estimatePrice({
      service: service({ express_surcharge: undefined as unknown as number }),
      weightKg: 4,
      isExpress: true,
    });
    expect(estimate.expressFee).toBe(100);
  });

  it('does not charge express when not selected', () => {
    expect(estimatePrice({ service: service(), weightKg: 4, isExpress: false }).expressFee).toBe(0);
  });

  it('stacks coupon and loyalty on top of the pre-discount base', () => {
    const estimate = estimatePrice({
      service: service({ base_price: 100 }),
      weightKg: 3, // subtotal 300
      coupon: { discount_type: 'fixed', discount_value: 50, min_order: 0 },
      loyaltyPoints: 1000, // ₹100
    });
    expect(estimate.subtotal).toBe(300);
    expect(estimate.discount).toBe(50);
    expect(estimate.loyaltyDiscount).toBe(100);
    expect(estimate.total).toBe(150);
  });

  it('caps loyalty redemption so the total never goes negative', () => {
    const estimate = estimatePrice({
      service: service({ base_price: 50 }),
      weightKg: 1, // subtotal 50, delivery 40 -> base 90
      loyaltyPoints: 100_000,
    });
    expect(estimate.loyaltyDiscount).toBe(90);
    expect(estimate.total).toBe(0);
  });
});

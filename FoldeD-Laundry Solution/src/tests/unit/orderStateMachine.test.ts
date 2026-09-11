import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  getNextAllowedStatuses,
} from '../../lib/orderStateMachine';
import type { OrderStatus, UserRole } from '../../types';

// These tests pin the client-side mirror of the PostgreSQL transition matrix
// (update_order_status / 0014_secure_rpcs.sql). If either side drifts, the UI
// will offer actions the server rejects — or hide actions the server allows.
describe('orderStateMachine.canTransition', () => {
  it('rejects a no-op transition to the same status', () => {
    expect(canTransition('CONFIRMED', 'CONFIRMED', 'admin')).toBe(false);
    expect(canTransition('PENDING_PAYMENT', 'PENDING_PAYMENT', 'customer')).toBe(false);
  });

  it('allows an admin to follow any listed transition', () => {
    expect(canTransition('PENDING_PAYMENT', 'CONFIRMED', 'admin')).toBe(true);
    expect(canTransition('CONFIRMED', 'PICKUP_ASSIGNED', 'admin')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'DELIVERED', 'admin')).toBe(true);
  });

  it('rejects transitions that are not in the matrix even for an admin', () => {
    // PICKUP_ASSIGNED -> DELIVERED is not an allowed edge.
    expect(canTransition('PICKUP_ASSIGNED', 'DELIVERED', 'admin')).toBe(false);
    expect(canTransition('DELIVERED', 'CONFIRMED', 'admin')).toBe(false);
  });

  it('lets a customer cancel only from the pre-fulfilment states', () => {
    expect(canTransition('PENDING_PAYMENT', 'CANCELLED', 'customer')).toBe(true);
    expect(canTransition('CONFIRMED', 'CANCELLED', 'customer')).toBe(true);
    expect(canTransition('ON_HOLD', 'CANCELLED', 'customer')).toBe(true);
  });

  it('does not let a customer advance the order or cancel once delivered', () => {
    expect(canTransition('PENDING_PAYMENT', 'CONFIRMED', 'customer')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED', 'customer')).toBe(false);
    expect(canTransition('OUT_FOR_DELIVERY', 'CANCELLED', 'customer')).toBe(false);
  });

  it('scopes each staff role to its own destinations', () => {
    // Pickup staff drive pickup edges only.
    expect(canTransition('CONFIRMED', 'PICKED_UP', 'pickup_staff')).toBe(true);
    expect(canTransition('CONFIRMED', 'DELIVERED', 'pickup_staff')).toBe(false);

    // Laundry staff drive facility edges only, one stage at a time.
    expect(canTransition('RECEIVED_AT_FACILITY', 'SORTING', 'laundry_staff')).toBe(true);
    expect(canTransition('SORTING', 'WASHING', 'laundry_staff')).toBe(true);
    expect(canTransition('WASHING', 'DRYING', 'laundry_staff')).toBe(true);
    expect(canTransition('READY_FOR_DELIVERY', 'DELIVERY_ASSIGNED', 'laundry_staff')).toBe(false);

    // Strict sequencing: the facility pipeline may not skip a stage.
    expect(canTransition('RECEIVED_AT_FACILITY', 'WASHING', 'laundry_staff')).toBe(false);
    expect(canTransition('SORTING', 'DRYING', 'laundry_staff')).toBe(false);
    expect(canTransition('DRYING', 'QUALITY_CHECK', 'laundry_staff')).toBe(false);

    // Delivery staff drive delivery edges only.
    expect(canTransition('READY_FOR_DELIVERY', 'DELIVERY_ASSIGNED', 'delivery_staff')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'DELIVERED', 'delivery_staff')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'WASHING', 'delivery_staff')).toBe(false);
  });

  it('does not throw for an unknown/forged role claim', () => {
    // `role` can arrive from an unvalidated JWT claim or DB row. It must fail
    // closed rather than read a missing key off ROLE_DESTINATIONS.
    expect(() => canTransition('CONFIRMED', 'PICKUP_ASSIGNED', 'root' as UserRole)).not.toThrow();
    expect(canTransition('CONFIRMED', 'PICKUP_ASSIGNED', 'root' as UserRole)).toBe(false);
    expect(canTransition('CONFIRMED', 'CANCELLED', '' as UserRole)).toBe(false);
  });
});

describe('orderStateMachine.getNextAllowedStatuses', () => {
  it('returns only the destinations the role may actually reach', () => {
    expect(getNextAllowedStatuses('PENDING_PAYMENT', 'customer')).toEqual(['CANCELLED']);
    expect(getNextAllowedStatuses('OUT_FOR_DELIVERY', 'customer')).toEqual([]);
  });

  it('returns the full matrix row for an admin', () => {
    expect(getNextAllowedStatuses('DELIVERED', 'admin')).toEqual(
      ALLOWED_TRANSITIONS.DELIVERED,
    );
  });

  it('never returns an illegal destination for a staff role', () => {
    (Object.keys(ALLOWED_TRANSITIONS) as OrderStatus[]).forEach((from) => {
      getNextAllowedStatuses(from, 'laundry_staff').forEach((to) => {
        expect(canTransition(from, to, 'laundry_staff')).toBe(true);
      });
    });
  });
});

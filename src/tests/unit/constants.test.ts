import { describe, it, expect } from 'vitest';
import {
  LAUNDRY_STAGES_ORDER,
  LAUNDRY_STAGE_NAMES,
  ORDER_STATUS_DETAILS,
  getOrderProgressPercent,
} from '../../lib/constants';
import type { LaundryStage, OrderStatus } from '../../types';

// Regression guard for the staff-portal "advance stage" bug: the handler used
// LAUNDRY_STAGES_ORDER.indexOf(stage), and a stage absent from the array
// resolved to -1, passed the `-1 < length - 1` bound check, and silently sent
// the order back to index 0 (RECEIVED). Every stage a staff member can hold
// must therefore appear in the ordered list.
describe('laundry stage ordering', () => {
  it('contains every LaundryStage exactly once', () => {
    const stages: LaundryStage[] = [
      'RECEIVED',
      'SORTING',
      'WASHING',
      'DRYING',
      'IRONING_FOLDING',
      'QUALITY_CHECK',
      'READY',
    ];
    stages.forEach((stage) => {
      expect(LAUNDRY_STAGES_ORDER.indexOf(stage)).toBeGreaterThanOrEqual(0);
    });
    expect(new Set(LAUNDRY_STAGES_ORDER).size).toBe(LAUNDRY_STAGES_ORDER.length);
  });

  it('resolves an index for every stage so indexOf never returns -1', () => {
    LAUNDRY_STAGES_ORDER.forEach((stage) => {
      expect(LAUNDRY_STAGES_ORDER.indexOf(stage)).not.toBe(-1);
    });
  });

  it('ends at READY so the pipeline has a terminal stage', () => {
    expect(LAUNDRY_STAGES_ORDER[LAUNDRY_STAGES_ORDER.length - 1]).toBe('READY');
  });

  it('has a display name for every ordered stage', () => {
    LAUNDRY_STAGES_ORDER.forEach((stage) => {
      expect(LAUNDRY_STAGE_NAMES[stage]).toBeDefined();
      expect(LAUNDRY_STAGE_NAMES[stage].title.length).toBeGreaterThan(0);
    });
  });
});

describe('getOrderProgressPercent', () => {
  it('is monotonic along the happy path', () => {
    const happyPath: OrderStatus[] = [
      'ORDER_PLACED',
      'PICKUP_ASSIGNED',
      'PICKUP_STARTED',
      'PICKED_UP',
      'RECEIVED_AT_FACILITY',
      'SORTING',
      'WASHING',
      'DRYING',
      'IRONING_FOLDING',
      'QUALITY_CHECK',
      'READY_FOR_DELIVERY',
      'DELIVERY_ASSIGNED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    const percents = happyPath.map(getOrderProgressPercent);
    percents.forEach((value, i) => {
      if (i > 0) expect(value).toBeGreaterThan(percents[i - 1]);
    });
    expect(percents[percents.length - 1]).toBe(100);
  });

  it('returns 0 for statuses with no defined progress', () => {
    expect(getOrderProgressPercent('CANCELLED')).toBe(0);
    expect(getOrderProgressPercent('ON_HOLD')).toBe(0);
  });
});

describe('order status details', () => {
  it('describes every status used by the state machine and UI', () => {
    const statuses: OrderStatus[] = [
      'PENDING_PAYMENT',
      'CONFIRMED',
      'PICKUP_ASSIGNED',
      'PICKED_UP',
      'RECEIVED_AT_FACILITY',
      'WASHING',
      'READY_FOR_DELIVERY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
    ];
    statuses.forEach((status) => {
      expect(ORDER_STATUS_DETAILS[status]).toBeDefined();
      expect(ORDER_STATUS_DETAILS[status].label.length).toBeGreaterThan(0);
    });
  });
});

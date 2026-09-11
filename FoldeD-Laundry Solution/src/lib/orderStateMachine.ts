import type { OrderStatus, UserRole } from '../types';

// Canonical server-side order state machine (mirrors the PostgreSQL
// transition matrix enforced by update_order_status). The frontend uses this
// ONLY to render valid actions; the database remains the security boundary.
export const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  ORDER_PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PICKUP_ASSIGNED', 'PICKUP_STARTED', 'PICKED_UP', 'ON_HOLD', 'CANCELLED'],
  PICKUP_ASSIGNED: ['PICKUP_STARTED', 'PICKED_UP', 'FAILED_PICKUP', 'CANCELLED'],
  PICKUP_SCHEDULED: ['PICKUP_STARTED', 'PICKED_UP', 'FAILED_PICKUP', 'CANCELLED'],
  PICKUP_STARTED: ['PICKED_UP', 'FAILED_PICKUP'],
  PICKED_UP: ['RECEIVED_AT_FACILITY'],
  RECEIVED_AT_FACILITY: ['PROCESSING', 'SORTING', 'ON_HOLD'],
  PROCESSING: ['SORTING', 'WASHING', 'ON_HOLD'],
  SORTING: ['WASHING', 'ON_HOLD'],
  WASHING: ['DRYING', 'ON_HOLD'],
  DRYING: ['IRONING', 'FOLDING', 'IRONING_FOLDING', 'ON_HOLD'],
  IRONING: ['FOLDING', 'IRONING_FOLDING', 'ON_HOLD'],
  FOLDING: ['IRONING_FOLDING', 'QUALITY_CHECK', 'ON_HOLD'],
  IRONING_FOLDING: ['QUALITY_CHECK', 'ON_HOLD'],
  QUALITY_CHECK: ['READY_FOR_DELIVERY', 'ON_HOLD'],
  ON_HOLD: [
    'SORTING',
    'WASHING',
    'DRYING',
    'IRONING_FOLDING',
    'QUALITY_CHECK',
    'READY_FOR_DELIVERY',
    'CANCELLED',
  ],
  READY_FOR_DELIVERY: ['DELIVERY_ASSIGNED', 'ON_HOLD', 'CANCELLED'],
  DELIVERY_ASSIGNED: ['OUT_FOR_DELIVERY', 'DELIVERY_FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERY_FAILED: ['OUT_FOR_DELIVERY', 'ON_HOLD'],
  DELIVERED: ['COMPLETED', 'REFUND_PENDING'],
  COMPLETED: ['REFUND_PENDING'],
  CANCELLED: ['REFUND_PENDING'],
  FAILED_PICKUP: ['CONFIRMED', 'PICKUP_ASSIGNED', 'CANCELLED'],
  REFUND_PENDING: ['REFUNDED'],
  REFUNDED: [],
};

// Which destinations each role may set through update_order_status.
const ROLE_DESTINATIONS: Readonly<Record<UserRole, readonly OrderStatus[]>> = {
  customer: ['CANCELLED'],
  pickup_staff: [
    'PICKUP_ASSIGNED',
    'PICKUP_SCHEDULED',
    'PICKUP_STARTED',
    'PICKED_UP',
    'RECEIVED_AT_FACILITY',
    'FAILED_PICKUP',
  ],
  laundry_staff: [
    'RECEIVED_AT_FACILITY',
    'PROCESSING',
    'SORTING',
    'WASHING',
    'DRYING',
    'IRONING',
    'FOLDING',
    'IRONING_FOLDING',
    'QUALITY_CHECK',
    'READY_FOR_DELIVERY',
    'ON_HOLD',
  ],
  delivery_staff: ['DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED'],
  admin: Object.keys(ALLOWED_TRANSITIONS) as OrderStatus[],
};

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: UserRole
): boolean {
  if (from === to) return false;
  // `role` can come from an unvalidated source (JWT claim / DB row), so guard
  // the lookup rather than assuming it is a known key.
  if (role !== 'admin' && !(ROLE_DESTINATIONS[role]?.includes(to) ?? false)) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextAllowedStatuses(from: OrderStatus, role: UserRole): OrderStatus[] {
  return (ALLOWED_TRANSITIONS[from] ?? []).filter((to) => canTransition(from, to, role));
}
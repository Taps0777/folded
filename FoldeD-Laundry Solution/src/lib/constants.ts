import type { OrderStatus, LaundryStage, UserRole } from '../types';

export const ORDER_STATUS_DETAILS: Record<
  OrderStatus,
  { label: string; description: string; stepIndex: number; color: string; badgeVariant: 'mint' | 'coral' | 'amber' | 'blue' | 'slate' }
> = {
  ORDER_PLACED: {
    label: 'Order Placed',
    description: 'Booking received and verified',
    stepIndex: 0,
    color: 'text-slate-600',
    badgeVariant: 'slate',
  },
  PICKUP_ASSIGNED: {
    label: 'Pickup Assigned',
    description: 'Field agent assigned for scheduled pickup',
    stepIndex: 1,
    color: 'text-blue-600',
    badgeVariant: 'blue',
  },
  PICKUP_STARTED: {
    label: 'Pickup In Progress',
    description: 'Agent is en route to your address',
    stepIndex: 2,
    color: 'text-blue-600',
    badgeVariant: 'blue',
  },
  PICKED_UP: {
    label: 'Bags Picked Up',
    description: 'Garments secured in tamper-proof bags',
    stepIndex: 3,
    color: 'text-mint-dark',
    badgeVariant: 'mint',
  },
  RECEIVED_AT_FACILITY: {
    label: 'Received at Facility',
    description: 'Weighed & checked in at central hub',
    stepIndex: 4,
    color: 'text-purple-600',
    badgeVariant: 'blue',
  },
  SORTING: {
    label: 'Fabric Sorting',
    description: 'Segregating by fabric, color, and wash cycles',
    stepIndex: 5,
    color: 'text-purple-600',
    badgeVariant: 'blue',
  },
  WASHING: {
    label: 'Washing Cycle',
    description: 'Eco-detergent deep clean in progress',
    stepIndex: 6,
    color: 'text-blue-600',
    badgeVariant: 'blue',
  },
  DRYING: {
    label: 'Controlled Drying',
    description: 'Low-heat lint-free moisture extraction',
    stepIndex: 7,
    color: 'text-amber-600',
    badgeVariant: 'amber',
  },
  IRONING_FOLDING: {
    label: 'Steam Press & Fold',
    description: 'Crisp steam finish & precision folding',
    stepIndex: 8,
    color: 'text-amber-600',
    badgeVariant: 'amber',
  },
  QUALITY_CHECK: {
    label: '7-Point Inspection',
    description: 'Stain, collar, and button inspection',
    stepIndex: 9,
    color: 'text-mint-dark',
    badgeVariant: 'mint',
  },
  READY_FOR_DELIVERY: {
    label: 'Packed & Ready',
    description: 'Sealed in breathable garment wraps',
    stepIndex: 10,
    color: 'text-mint-dark',
    badgeVariant: 'mint',
  },
  DELIVERY_ASSIGNED: {
    label: 'Delivery Assigned',
    description: 'Allocated to doorstep rider',
    stepIndex: 11,
    color: 'text-blue-600',
    badgeVariant: 'blue',
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    description: 'Rider is on the way with your order',
    stepIndex: 12,
    color: 'text-coral',
    badgeVariant: 'coral',
  },
  DELIVERED: {
    label: 'Delivered',
    description: 'Freshness handed over successfully',
    stepIndex: 13,
    color: 'text-mint-dark',
    badgeVariant: 'mint',
  },
  CANCELLED: {
    label: 'Cancelled',
    description: 'Order was cancelled',
    stepIndex: -1,
    color: 'text-red-600',
    badgeVariant: 'coral',
  },
  FAILED_PICKUP: {
    label: 'Pickup Missed',
    description: 'Customer unavailable during slot',
    stepIndex: -1,
    color: 'text-amber-600',
    badgeVariant: 'amber',
  },
  ON_HOLD: {
    label: 'On Hold',
    description: 'Garment inquiry awaiting customer feedback',
    stepIndex: -1,
    color: 'text-amber-600',
    badgeVariant: 'amber',
  },
  REFUNDED: {
    label: 'Refunded',
    description: 'Refund credited to original payment mode',
    stepIndex: -1,
    color: 'text-slate-600',
    badgeVariant: 'slate',
  },
};

export const LAUNDRY_STAGES_ORDER: LaundryStage[] = [
  'RECEIVED',
  'SORTING',
  'WASHING',
  'DRYING',
  'IRONING_FOLDING',
  'QUALITY_CHECK',
  'READY',
];

export const LAUNDRY_STAGE_NAMES: Record<LaundryStage, { title: string; iconName: string }> = {
  RECEIVED: { title: 'Intake & Bag Scan', iconName: 'Inbox' },
  SORTING: { title: 'Fabric Segregation', iconName: 'Layers' },
  WASHING: { title: 'Eco Wash Cycle', iconName: 'Waves' },
  DRYING: { title: 'Tumble Dry', iconName: 'Wind' },
  IRONING_FOLDING: { title: 'Steam Pressing', iconName: 'Sparkles' },
  QUALITY_CHECK: { title: '7-Point QC', iconName: 'ShieldCheck' },
  READY: { title: 'Packaging Complete', iconName: 'PackageCheck' },
};

export const MILESTONE_STEPS = [
  { id: 'placed', label: 'Order Placed', statuses: ['ORDER_PLACED'] },
  { id: 'pickup', label: 'Pickup', statuses: ['PICKUP_ASSIGNED', 'PICKUP_STARTED', 'PICKED_UP'] },
  { id: 'processing', label: 'In-Facility Care', statuses: ['RECEIVED_AT_FACILITY', 'SORTING', 'WASHING', 'DRYING', 'IRONING_FOLDING', 'QUALITY_CHECK', 'READY_FOR_DELIVERY'] },
  { id: 'delivery', label: 'Out for Delivery', statuses: ['DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY'] },
  { id: 'delivered', label: 'Delivered', statuses: ['DELIVERED'] },
];

export function getOrderProgressPercent(status: OrderStatus): number {
  switch (status) {
    case 'ORDER_PLACED': return 10;
    case 'PICKUP_ASSIGNED': return 20;
    case 'PICKUP_STARTED': return 30;
    case 'PICKED_UP': return 40;
    case 'RECEIVED_AT_FACILITY': return 50;
    case 'SORTING': return 55;
    case 'WASHING': return 65;
    case 'DRYING': return 75;
    case 'IRONING_FOLDING': return 82;
    case 'QUALITY_CHECK': return 88;
    case 'READY_FOR_DELIVERY': return 92;
    case 'DELIVERY_ASSIGNED': return 94;
    case 'OUT_FOR_DELIVERY': return 97;
    case 'DELIVERED': return 100;
    default: return 0;
  }
}

export const ROLE_LABELS: Record<UserRole, { title: string; badge: string; color: string }> = {
  customer: { title: 'Customer Experience', badge: 'Customer', color: 'bg-mint-soft text-mint-dark border-mint/20' },
  pickup_staff: { title: 'Field Agent (Pickup)', badge: 'Pickup Agent', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  laundry_staff: { title: 'Facility Processing Lead', badge: 'Laundry Hub', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  delivery_staff: { title: 'Doorstep Courier (Delivery)', badge: 'Delivery Agent', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  admin: { title: 'Operations Control Tower', badge: 'Ops Admin', color: 'bg-ink text-white border-ink' },
};

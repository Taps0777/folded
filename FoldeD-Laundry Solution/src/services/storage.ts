import type {
  Order,
  OrderStatus,
  LaundryStage,
  Address,
  Service,
  Coupon,
  SubscriptionPlan,
  LoyaltyAccount,
  QualityCheck,
  SupportTicket,
  ServiceArea,
} from '../types';
import {
  INITIAL_ORDERS,
  INITIAL_SERVICES,
  INITIAL_ADDRESSES,
  INITIAL_COUPONS,
  INITIAL_SUBSCRIPTION_PLANS,
  INITIAL_LOYALTY,
  INITIAL_TICKETS,
  INITIAL_SERVICE_AREAS,
} from './mockData';
import { generateOrderId, generateDeliveryPin } from '../utils/formatters';

const STORAGE_KEYS = {
  ORDERS: 'ff_orders_v1',
  SERVICES: 'ff_services_v1',
  ADDRESSES: 'ff_addresses_v1',
  COUPONS: 'ff_coupons_v1',
  SUBSCRIPTIONS: 'ff_subscriptions_v1',
  LOYALTY: 'ff_loyalty_v1',
  TICKETS: 'ff_tickets_v1',
  SERVICE_AREAS: 'ff_areas_v1',
};

// Helper to safely read from localStorage
function readStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

// Helper to safely write to localStorage
function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('ff_storage_update'));
  } catch (e) {
    console.error('Failed to write to localStorage', e);
  }
}

export const StorageService = {
  // Orders
  getOrders(): Order[] {
    return readStorage<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
  },

  getOrderById(id: string): Order | undefined {
    return this.getOrders().find((o) => o.id === id);
  },

  createOrder(orderParams: Omit<Order, 'id' | 'delivery_pin' | 'created_at' | 'updated_at' | 'history'>): Order {
    const orders = this.getOrders();
    const newId = generateOrderId();
    const newPin = generateDeliveryPin();
    const now = new Date().toISOString();

    const newOrder: Order = {
      ...orderParams,
      id: newId,
      delivery_pin: newPin,
      created_at: now,
      updated_at: now,
      history: [
        {
          id: `h_${Date.now()}`,
          status: orderParams.status || 'ORDER_PLACED',
          timestamp: now,
          note: 'Booking placed successfully',
          actor: orderParams.customer_name,
        },
      ],
    };

    orders.unshift(newOrder);
    writeStorage(STORAGE_KEYS.ORDERS, orders);

    // Update loyalty points
    this.addLoyaltyPoints(newOrder.loyalty_points_earned, `Earned from Order ${newOrder.id}`);

    return newOrder;
  },

  updateOrderStatus(orderId: string, newStatus: OrderStatus, note?: string, actor?: string): Order | null {
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return null;

    const currentOrder = orders[idx];
    const now = new Date().toISOString();

    currentOrder.status = newStatus;
    currentOrder.updated_at = now;

    // Handle automated laundry stage mapping
    if (newStatus === 'RECEIVED_AT_FACILITY') {
      currentOrder.laundry_stage = 'RECEIVED';
    } else if (newStatus === 'SORTING') {
      currentOrder.laundry_stage = 'SORTING';
    } else if (newStatus === 'WASHING') {
      currentOrder.laundry_stage = 'WASHING';
    } else if (newStatus === 'DRYING') {
      currentOrder.laundry_stage = 'DRYING';
    } else if (newStatus === 'IRONING_FOLDING') {
      currentOrder.laundry_stage = 'IRONING_FOLDING';
    } else if (newStatus === 'QUALITY_CHECK') {
      currentOrder.laundry_stage = 'QUALITY_CHECK';
    } else if (newStatus === 'READY_FOR_DELIVERY') {
      currentOrder.laundry_stage = 'READY';
    }

    currentOrder.history.push({
      id: `h_${Date.now()}`,
      status: newStatus,
      timestamp: now,
      note: note || `Status updated to ${newStatus}`,
      actor: actor || 'System',
    });

    orders[idx] = currentOrder;
    writeStorage(STORAGE_KEYS.ORDERS, orders);
    return currentOrder;
  },

  updateOrderPickup(orderId: string, bagId: string, measuredWeightKg: number): Order | null {
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return null;

    orders[idx].bag_id = bagId;
    orders[idx].measured_weight_kg = measuredWeightKg;
    orders[idx].status = 'PICKED_UP';
    orders[idx].updated_at = new Date().toISOString();
    orders[idx].history.push({
      id: `h_${Date.now()}`,
      status: 'PICKED_UP',
      timestamp: new Date().toISOString(),
      note: `Weighed at pickup: ${measuredWeightKg} kg. Bag Tag: ${bagId}`,
      actor: 'Pickup Staff',
    });

    writeStorage(STORAGE_KEYS.ORDERS, orders);
    return orders[idx];
  },

  advanceLaundryStage(orderId: string, nextStage: LaundryStage): Order | null {
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return null;

    orders[idx].laundry_stage = nextStage;
    orders[idx].updated_at = new Date().toISOString();

    // Sync order status if relevant
    if (nextStage === 'SORTING') orders[idx].status = 'SORTING';
    if (nextStage === 'WASHING') orders[idx].status = 'WASHING';
    if (nextStage === 'DRYING') orders[idx].status = 'DRYING';
    if (nextStage === 'IRONING_FOLDING') orders[idx].status = 'IRONING_FOLDING';
    if (nextStage === 'QUALITY_CHECK') orders[idx].status = 'QUALITY_CHECK';
    if (nextStage === 'READY') orders[idx].status = 'READY_FOR_DELIVERY';

    orders[idx].history.push({
      id: `h_${Date.now()}`,
      status: orders[idx].status,
      timestamp: new Date().toISOString(),
      note: `Garment processing advanced to ${nextStage}`,
      actor: 'Facility Staff',
    });

    writeStorage(STORAGE_KEYS.ORDERS, orders);
    return orders[idx];
  },

  submitQualityCheck(orderId: string, qc: QualityCheck): Order | null {
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return null;

    orders[idx].quality_check = qc;
    if (qc.passed) {
      orders[idx].status = 'READY_FOR_DELIVERY';
      orders[idx].laundry_stage = 'READY';
    }
    orders[idx].updated_at = new Date().toISOString();
    orders[idx].history.push({
      id: `h_${Date.now()}`,
      status: orders[idx].status,
      timestamp: new Date().toISOString(),
      note: qc.passed ? '7-Point Quality Check Passed. Packed for dispatch.' : 'Quality Check flagged damages: ' + (qc.damage_notes || 'None'),
      actor: qc.inspector_name,
    });

    writeStorage(STORAGE_KEYS.ORDERS, orders);
    return orders[idx];
  },

  verifyDeliveryPin(orderId: string, enteredPin: string): { success: boolean; message: string; order?: Order } {
    const orders = this.getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return { success: false, message: 'Order not found' };

    const targetOrder = orders[idx];
    if (targetOrder.delivery_pin.trim() !== enteredPin.trim()) {
      return { success: false, message: 'Invalid 4-digit Delivery PIN. Please ask customer to check their dashboard.' };
    }

    targetOrder.status = 'DELIVERED';
    targetOrder.updated_at = new Date().toISOString();
    targetOrder.history.push({
      id: `h_${Date.now()}`,
      status: 'DELIVERED',
      timestamp: new Date().toISOString(),
      note: 'Verified with doorstep 4-digit PIN. Delivered in pristine condition.',
      actor: 'Delivery Courier',
    });

    orders[idx] = targetOrder;
    writeStorage(STORAGE_KEYS.ORDERS, orders);
    return { success: true, message: 'Delivery verified and marked completed!', order: targetOrder };
  },

  // Services
  getServices(): Service[] {
    return readStorage<Service[]>(STORAGE_KEYS.SERVICES, INITIAL_SERVICES);
  },

  updateServicePrice(id: string, basePrice: number): void {
    const services = this.getServices();
    const s = services.find((srv) => srv.id === id);
    if (s) {
      s.base_price = basePrice;
      writeStorage(STORAGE_KEYS.SERVICES, services);
    }
  },

  // Addresses
  getAddresses(): Address[] {
    return readStorage<Address[]>(STORAGE_KEYS.ADDRESSES, INITIAL_ADDRESSES);
  },

  addAddress(address: Omit<Address, 'id'>): Address {
    const addresses = this.getAddresses();
    const newAddr: Address = {
      ...address,
      id: `addr_${Date.now()}`,
    };
    if (newAddr.is_default) {
      addresses.forEach((a) => (a.is_default = false));
    }
    addresses.push(newAddr);
    writeStorage(STORAGE_KEYS.ADDRESSES, addresses);
    return newAddr;
  },

  deleteAddress(id: string): void {
    const addresses = this.getAddresses().filter((a) => a.id !== id);
    writeStorage(STORAGE_KEYS.ADDRESSES, addresses);
  },

  setDefaultAddress(id: string): void {
    const addresses = this.getAddresses();
    addresses.forEach((a) => {
      a.is_default = a.id === id;
    });
    writeStorage(STORAGE_KEYS.ADDRESSES, addresses);
  },

  // Service Areas
  getServiceAreas(): ServiceArea[] {
    return readStorage<ServiceArea[]>(STORAGE_KEYS.SERVICE_AREAS, INITIAL_SERVICE_AREAS);
  },

  checkServiceability(postalCode: string): { serviceable: boolean; area?: ServiceArea } {
    const areas = this.getServiceAreas();
    const found = areas.find((a) => a.postal_code === postalCode.trim() && a.is_active);
    if (found) {
      return { serviceable: true, area: found };
    }
    return { serviceable: false };
  },

  toggleServiceArea(postalCode: string): void {
    const areas = this.getServiceAreas();
    const a = areas.find((item) => item.postal_code === postalCode);
    if (a) {
      a.is_active = !a.is_active;
      writeStorage(STORAGE_KEYS.SERVICE_AREAS, areas);
    }
  },

  // Coupons
  getCoupons(): Coupon[] {
    return readStorage<Coupon[]>(STORAGE_KEYS.COUPONS, INITIAL_COUPONS);
  },

  validateCoupon(code: string, subtotal: number): { valid: boolean; discount: number; message: string } {
    const coupons = this.getCoupons();
    const coupon = coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());

    if (!coupon) {
      return { valid: false, discount: 0, message: 'Invalid promo code' };
    }

    if (subtotal < coupon.min_order) {
      return {
        valid: false,
        discount: 0,
        message: `Order must be at least ₹${coupon.min_order} to apply code ${coupon.code}`,
      };
    }

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = Math.round((subtotal * coupon.discount_value) / 100);
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = coupon.max_discount;
      }
    } else {
      discount = coupon.discount_value;
    }

    return { valid: true, discount, message: `Promo applied: Saved ₹${discount}!` };
  },

  // Subscriptions
  getSubscriptions(): SubscriptionPlan[] {
    return readStorage<SubscriptionPlan[]>(STORAGE_KEYS.SUBSCRIPTIONS, INITIAL_SUBSCRIPTION_PLANS);
  },

  // Loyalty
  getLoyaltyAccount(): LoyaltyAccount {
    return readStorage<LoyaltyAccount>(STORAGE_KEYS.LOYALTY, INITIAL_LOYALTY);
  },

  addLoyaltyPoints(points: number, desc: string): void {
    const acc = this.getLoyaltyAccount();
    acc.balance += points;
    acc.history.unshift({
      id: `lp_${Date.now()}`,
      type: 'earned',
      points,
      description: desc,
      date: 'Just now',
    });
    writeStorage(STORAGE_KEYS.LOYALTY, acc);
  },

  redeemLoyalty(points: number): boolean {
    const acc = this.getLoyaltyAccount();
    if (acc.balance < points) return false;
    acc.balance -= points;
    acc.history.unshift({
      id: `lp_${Date.now()}`,
      type: 'redeemed',
      points,
      description: `Redeemed for order discount`,
      date: 'Just now',
    });
    writeStorage(STORAGE_KEYS.LOYALTY, acc);
    return true;
  },

  // Support Tickets
  getTickets(): SupportTicket[] {
    return readStorage<SupportTicket[]>(STORAGE_KEYS.TICKETS, INITIAL_TICKETS);
  },

  createTicket(ticket: Omit<SupportTicket, 'id' | 'created_at' | 'status'>): SupportTicket {
    const tickets = this.getTickets();
    const newT: SupportTicket = {
      ...ticket,
      id: `TCK-${Math.floor(100 + Math.random() * 900)}`,
      status: 'open',
      created_at: new Date().toISOString(),
    };
    tickets.unshift(newT);
    writeStorage(STORAGE_KEYS.TICKETS, tickets);
    return newT;
  },

  resolveTicket(ticketId: string, resolution: string): void {
    const tickets = this.getTickets();
    const t = tickets.find((item) => item.id === ticketId);
    if (t) {
      t.status = 'resolved';
      t.resolution = resolution;
      writeStorage(STORAGE_KEYS.TICKETS, tickets);
    }
  },

  // Reset to seed
  resetAll(): void {
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.SERVICES);
    localStorage.removeItem(STORAGE_KEYS.ADDRESSES);
    localStorage.removeItem(STORAGE_KEYS.COUPONS);
    localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTIONS);
    localStorage.removeItem(STORAGE_KEYS.LOYALTY);
    localStorage.removeItem(STORAGE_KEYS.TICKETS);
    localStorage.removeItem(STORAGE_KEYS.SERVICE_AREAS);
    window.dispatchEvent(new Event('ff_storage_update'));
  },
};

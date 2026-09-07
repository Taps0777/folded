import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { StorageService } from '../../services/storage';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import type { Order, SupportTicket } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import {
  Package,
  MapPin,
  Clock,
  ArrowRight,
  Receipt,
  Coins,
  Plus,
  Trash2,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

export const CustomerDashboardPage: React.FC = () => {
  const { currentUser, orders, refreshOrders, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'subscription' | 'loyalty' | 'support'>('orders');
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  // Modal States
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({
    subject: '',
    category: 'general' as SupportTicket['category'],
    message: '',
    order_id: '',
  });

  const addresses = StorageService.getAddresses();
  const loyalty = StorageService.getLoyaltyAccount();
  const tickets = StorageService.getTickets();

  // Find topmost active order
  const activeOrder = orders.find(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REFUNDED'
  );

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'active') {
      return o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REFUNDED';
    }
    if (orderFilter === 'completed') return o.status === 'DELIVERED';
    if (orderFilter === 'cancelled') return o.status === 'CANCELLED' || o.status === 'REFUNDED';
    return true;
  });

  // Handle Cancel Order
  const handleCancelOrder = (orderId: string) => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      StorageService.updateOrderStatus(orderId, 'CANCELLED', 'Cancelled by customer', currentUser.full_name);
      refreshOrders();
      showToast('Order has been cancelled', 'info');
    }
  };

  // Handle Create Ticket
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketForm.subject || !newTicketForm.message) {
      showToast('Please provide subject and message', 'error');
      return;
    }
    StorageService.createTicket({
      user_id: currentUser.id,
      order_id: newTicketForm.order_id || undefined,
      subject: newTicketForm.subject,
      category: newTicketForm.category,
      message: newTicketForm.message,
      priority: 'medium',
    });
    setTicketModalOpen(false);
    setNewTicketForm({ subject: '', category: 'general', message: '', order_id: '' });
    showToast('Support ticket filed! Our team is on it.', 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Top Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-ink to-navy text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">
              Hello, {currentUser.full_name}
            </h1>
            <Badge variant="mint" size="sm">Gold Member</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            {currentUser.email} • {currentUser.phone}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-3">
            <Coins className="w-5 h-5 text-mint" />
            <div>
              <div className="text-[11px] text-slate-300 uppercase font-semibold">FreshPoints</div>
              <div className="text-lg font-bold font-display text-white">{loyalty.balance} pts</div>
            </div>
          </div>
          <Link to="/booking">
            <Button variant="coral" size="md" className="shadow-lg shadow-coral/30 text-xs sm:text-sm">
              Book New Pickup
            </Button>
          </Link>
        </div>
      </div>

      {/* Active Order Spotlight Banner */}
      {activeOrder && (
        <Card className="p-6 sm:p-8 border-2 border-mint/40 bg-white shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-ink/5">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Badge variant="mint" dot>Active Order in Progress</Badge>
                <span className="font-mono font-bold text-sm text-ink">{activeOrder.id}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-ink">
                {activeOrder.items[0]?.service_name} • {activeOrder.items[0]?.weight || 4} kg
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-mint" /> Estimated Handover: <strong>{activeOrder.estimated_delivery}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-mint" /> {activeOrder.address.city}
                </span>
              </div>
            </div>

            {/* Doorstep 4-Digit Security PIN Callout */}
            <div className="p-4 rounded-2xl bg-coral-soft border border-coral/30 flex items-center gap-4">
              <div>
                <div className="text-[11px] font-bold text-coral uppercase tracking-wider">
                  Doorstep Delivery PIN
                </div>
                <div className="text-3xl font-bold font-mono text-ink tracking-widest">
                  {activeOrder.delivery_pin}
                </div>
                <div className="text-[10px] text-slate-500">Share with rider only upon delivery</div>
              </div>
            </div>
          </div>

          {/* Progress Tracker Bar */}
          <div className="py-6 border-b border-ink/5">
            <ProgressBar status={activeOrder.status} />
          </div>

          {/* Assigned Staff & Action */}
          <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                {activeOrder.pickup_staff_name ? activeOrder.pickup_staff_name[0] : 'R'}
              </div>
              <div>
                <div className="font-semibold text-ink">
                  {activeOrder.status.includes('DELIVERY')
                    ? activeOrder.delivery_staff_name || 'Amit Kumar (Courier)'
                    : activeOrder.pickup_staff_name || 'Vikram Singh (Rider)'}
                </div>
                <div className="text-slate-400">Assigned Logistics Partner ★ 4.9</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Link to={`/track/${activeOrder.id}`}>
                <Button variant="mint" size="sm" className="gap-1.5 text-xs font-semibold">
                  Live Visual Route
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
              {activeOrder.status === 'ORDER_PLACED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancelOrder(activeOrder.id)}
                  className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                >
                  Cancel Order
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-ink/10 overflow-x-auto pb-1 text-sm font-medium">
        {[
          { id: 'orders', label: 'All Orders', count: orders.length },
          { id: 'addresses', label: 'Saved Addresses', count: addresses.length },
          { id: 'subscription', label: 'Laundry Pass' },
          { id: 'loyalty', label: 'FreshLoyalty' },
          { id: 'support', label: 'Support Tickets', count: tickets.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-full whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-ink text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-ink hover:bg-white'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: ALL ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Filter sub-tabs */}
          <div className="flex items-center gap-2 text-xs">
            {(['all', 'active', 'completed', 'cancelled'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setOrderFilter(filter)}
                className={`px-3 py-1.5 rounded-xl capitalize font-medium transition-all ${
                  orderFilter === filter
                    ? 'bg-mint-soft text-mint-dark font-bold border border-mint/20'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-ink/5 p-8 space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold font-display text-ink">No orders found</h3>
              <p className="text-xs text-slate-500">You don't have any orders under this filter.</p>
              <Link to="/booking">
                <Button variant="coral" size="sm" className="mt-2">
                  Schedule a Pickup
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="p-6 border-ink/5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-ink">{order.id}</span>
                        <span className="text-[11px] text-slate-400">• {formatDate(order.created_at)}</span>
                      </div>
                      <Badge
                        variant={
                          order.status === 'DELIVERED'
                            ? 'mint'
                            : order.status === 'CANCELLED'
                            ? 'coral'
                            : 'blue'
                        }
                      >
                        {order.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-bold text-base font-display text-ink">
                        {order.items[0]?.service_name || 'Wash & Fold'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {order.address.address_line}, {order.address.city}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-ink/5">
                      <span className="text-slate-500">
                        Paid via {order.payment_method?.toUpperCase()}
                      </span>
                      <span className="font-bold text-base font-display text-ink">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-ink/5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setReceiptOrder(order)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-ink font-semibold"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      View Invoice
                    </button>

                    <Link to={`/track/${order.id}`}>
                      <Button variant="outline" size="sm" className="text-xs">
                        Timeline Details
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADDRESSES */}
      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold font-display text-ink">Saved Locations</h3>
              <p className="text-xs text-slate-500">Manage doorstep pickup and delivery addresses.</p>
            </div>
            <Link to="/booking">
              <Button variant="coral" size="sm" className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add from Booking
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {addresses.map((addr) => (
              <Card key={addr.id} className="p-6 border-ink/5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">{addr.name}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {addr.address_type}
                    </span>
                    {addr.is_default && <Badge variant="mint" size="sm">Default</Badge>}
                  </div>
                  <button
                    onClick={() => {
                      StorageService.deleteAddress(addr.id);
                      refreshOrders();
                      showToast('Address removed', 'info');
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {addr.address_line}, {addr.landmark ? `${addr.landmark}, ` : ''}{addr.city} — {addr.postal_code}
                </p>

                <div className="text-xs text-slate-400">Phone: {addr.phone}</div>

                {!addr.is_default && (
                  <button
                    onClick={() => {
                      StorageService.setDefaultAddress(addr.id);
                      refreshOrders();
                      showToast('Set as default address', 'success');
                    }}
                    className="text-xs font-semibold text-mint hover:underline"
                  >
                    Set as Default
                  </button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTION PASS */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <Card className="p-8 border-2 border-mint/30 bg-white space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <Badge variant="mint">Active Plan</Badge>
                <h3 className="text-2xl font-bold font-display text-ink mt-2">
                  Family Fresh Pass
                </h3>
                <p className="text-xs text-slate-500">Renews automatically on Oct 1, 2026</p>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold font-display text-ink">₹2,199 / mo</div>
                <div className="text-xs text-emerald-600 font-semibold">Active & Healthy</div>
              </div>
            </div>

            {/* Quota Gauge */}
            <div className="p-6 rounded-2xl bg-cream border border-ink/5 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-ink">Monthly Quota Consumption</span>
                <span className="font-bold text-mint-dark">28.5 kg / 40 kg used</span>
              </div>
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-mint rounded-full w-[71%]" />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>11.5 kg remaining this billing cycle</span>
                <span>2 Free scheduled pickups left</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <Link to="/booking">
                <Button variant="coral" size="sm">Schedule Pass Pickup</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => showToast('Plan settings updated', 'info')}>
                Change / Pause Plan
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: LOYALTY */}
      {activeTab === 'loyalty' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Card className="p-6 border-ink/5 bg-gradient-to-tr from-mint to-mint-dark text-white space-y-2">
              <div className="text-xs font-semibold uppercase text-mint-soft">Points Balance</div>
              <div className="text-4xl font-bold font-display">{loyalty.balance}</div>
              <div className="text-xs text-mint-soft/80">Equivalent to {formatCurrency(Math.floor(loyalty.balance / 100))} off your next wash</div>
            </Card>
            <Card className="p-6 border-ink/5 bg-white space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-400">Lifetime Earned</div>
              <div className="text-4xl font-bold font-display text-ink">1,420</div>
              <div className="text-xs text-slate-500">10 points per ₹100 spent</div>
            </Card>
            <Card className="p-6 border-ink/5 bg-white space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-400">Current Tier</div>
              <div className="text-4xl font-bold font-display text-coral">Gold</div>
              <div className="text-xs text-slate-500">Enjoy 2x points on Dry Cleaning</div>
            </Card>
          </div>

          <Card className="p-6 border-ink/5 space-y-4">
            <h4 className="font-bold text-base font-display text-ink">Points Activity History</h4>
            <div className="divide-y divide-slate-100 text-xs">
              {loyalty.history.map((h) => (
                <div key={h.id} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-ink">{h.description}</div>
                    <div className="text-[11px] text-slate-400">{h.date}</div>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      h.type === 'earned' ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {h.type === 'earned' ? `+${h.points}` : `-${h.points}`} pts
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: SUPPORT TICKETS */}
      {activeTab === 'support' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold font-display text-ink">Customer Support</h3>
              <p className="text-xs text-slate-500">Need help with an item or delivery? Submit a ticket below.</p>
            </div>
            <Button
              variant="coral"
              size="sm"
              onClick={() => setTicketModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <HelpCircle className="w-4 h-4" /> Open New Ticket
            </Button>
          </div>

          <div className="space-y-4">
            {tickets.map((t) => (
              <Card key={t.id} className="p-6 border-ink/5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-400">{t.id}</span>
                      {t.order_id && <Badge variant="slate" size="sm">Order {t.order_id}</Badge>}
                      <Badge variant={t.status === 'resolved' ? 'mint' : 'amber'} size="sm">
                        {t.status}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-base font-display text-ink mt-1.5">{t.subject}</h4>
                  </div>
                  <span className="text-[11px] text-slate-400">{formatDate(t.created_at)}</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">
                  {t.message}
                </p>

                {t.resolution && (
                  <div className="p-3 bg-mint-soft rounded-xl text-xs text-mint-dark border border-mint/20 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Resolution Note:</strong> {t.resolution}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* INVOICE / RECEIPT MODAL */}
      <Modal
        isOpen={Boolean(receiptOrder)}
        onClose={() => setReceiptOrder(null)}
        title="Official FreshFold Invoice"
        description={`Tax Invoice #${receiptOrder?.id}`}
      >
        {receiptOrder && (
          <div className="space-y-6 text-xs text-ink">
            <div className="flex justify-between items-start pb-4 border-b border-slate-200">
              <div>
                <div className="text-base font-bold font-display text-ink">FreshFold Garment Care</div>
                <div className="text-slate-500">GSTIN: 29AAAAA0000A1Z5</div>
                <div className="text-slate-500">Bengaluru Facility Hub #1</div>
              </div>
              <div className="text-right">
                <Badge variant="mint">PAID</Badge>
                <div className="text-slate-500 mt-1">{formatDateTime(receiptOrder.created_at)}</div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <div><strong>Billed To:</strong> {receiptOrder.customer_name}</div>
              <div><strong>Phone:</strong> {receiptOrder.customer_phone}</div>
              <div><strong>Address:</strong> {receiptOrder.address.address_line}, {receiptOrder.address.city}</div>
            </div>

            {/* Line Items Table */}
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                  <th className="py-2">Item Description</th>
                  <th className="py-2 text-right">Qty/Weight</th>
                  <th className="py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receiptOrder.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2.5 font-medium">{it.service_name}</td>
                    <td className="py-2.5 text-right font-mono">{it.weight ? `${it.weight} kg` : it.quantity}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(it.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Financial Summary */}
            <div className="pt-3 border-t border-slate-200 space-y-1.5 text-right">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(receiptOrder.subtotal)}</span>
              </div>
              {receiptOrder.express_surcharge > 0 && (
                <div className="flex justify-between">
                  <span>Express Delivery Surcharge:</span>
                  <span>+{formatCurrency(receiptOrder.express_surcharge)}</span>
                </div>
              )}
              {receiptOrder.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Total Discounts Applied:</span>
                  <span>-{formatCurrency(receiptOrder.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200">
                <span>Total Amount Paid:</span>
                <span className="text-mint-dark">{formatCurrency(receiptOrder.total_amount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  window.print();
                }}
              >
                Print Receipt
              </Button>
              <Button variant="coral" size="sm" onClick={() => setReceiptOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* NEW SUPPORT TICKET MODAL */}
      <Modal
        isOpen={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Open Support Ticket"
        description="Our operations support desk will respond within 30 minutes."
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <Input
            label="Subject"
            placeholder="Brief summary of your query"
            value={newTicketForm.subject}
            onChange={(e) => setNewTicketForm({ ...newTicketForm, subject: e.target.value })}
            required
          />

          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink/70">
              Category
            </label>
            <select
              value={newTicketForm.category}
              onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value as any })}
              className="w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-mint"
            >
              <option value="general">General Inquiry</option>
              <option value="missing_item">Missing Item</option>
              <option value="damaged_item">Garment Damage Concern</option>
              <option value="late_delivery">Delivery Delay</option>
              <option value="billing">Billing / Payment Issue</option>
            </select>
          </div>

          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink/70">
              Related Order (Optional)
            </label>
            <select
              value={newTicketForm.order_id}
              onChange={(e) => setNewTicketForm({ ...newTicketForm, order_id: e.target.value })}
              className="w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-mint font-mono"
            >
              <option value="">Select an order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id} - {o.items[0]?.service_name} ({formatDate(o.created_at)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink/70">
              Describe the issue
            </label>
            <textarea
              rows={4}
              value={newTicketForm.message}
              onChange={(e) => setNewTicketForm({ ...newTicketForm, message: e.target.value })}
              placeholder="Provide details such as garment color, special instructions, or courier notes..."
              required
              className="w-full rounded-xl border border-ink/15 p-3 text-sm outline-none focus:border-mint"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setTicketModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="coral" size="sm">
              Submit Ticket
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

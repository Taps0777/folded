import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { orderService } from '../../services/api/orderService';
import { addressService } from '../../services/api/addressService';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import type { Order, Address, SupportTicket, LoyaltyAccount } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import {
  Package, MapPin, Clock, ArrowRight, Receipt, Coins, Plus, Trash2, CheckCircle, HelpCircle, Loader2
} from 'lucide-react';

export const CustomerDashboardPage: React.FC = () => {
  const { currentUser, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'subscription' | 'loyalty' | 'support'>('orders');
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyAccount>({ user_id: '', balance: 0, history: [] });
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({
    subject: '',
    category: 'general' as SupportTicket['category'],
    message: '',
    order_id: '',
  });

  const loadData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      // In a real scenario, use Promise.all to fetch all these from services
      const fetchedOrders = await orderService.getOrdersByUser(currentUser.id);
      const fetchedAddresses = await addressService.getAddressesByUser(currentUser.id);
      
      const { loyaltyService } = await import('../../services/api/loyaltyService');
      const { ticketService } = await import('../../services/api/ticketService');
      
      setOrders(fetchedOrders);
      setAddresses(fetchedAddresses);
      const loyaltyData = await loyaltyService.getAccount(currentUser.id);
      if (loyaltyData) setLoyalty(loyaltyData);
      setTickets(await ticketService.getTicketsByUser(currentUser.id));
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <Package className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Sign in to view your orders</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
          Access your real-time laundry progress, order receipts, saved addresses, and loyalty rewards.
        </p>
        <Link to="/login">
          <Button variant="mint">Sign In to Account</Button>
        </Link>
      </div>
    );
  }
  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-mint" /></div>;

  const activeOrder = orders.find(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REFUNDED'
  );

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'active') {
      return o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REFUNDED';
    }
    if (orderFilter === 'completed') return o.status === 'DELIVERED';
    if (orderFilter === 'cancelled') return o.status === 'CANCELLED' || o.status === 'REFUNDED';
    return true;
  });

  const handleCancelOrder = async (orderId: string) => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      try {
        await orderService.updateOrderStatus(orderId, 'CANCELLED', 'Cancelled by customer', currentUser.id);
        await loadData();
        showToast('Order has been cancelled', 'info');
      } catch (e) {
        showToast('Failed to cancel order', 'error');
      }
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketForm.subject || !newTicketForm.message) {
      showToast('Please provide subject and message', 'error');
      return;
    }
    try {
      const { ticketService } = await import('../../services/api/ticketService');
      await ticketService.createTicket({
        user_id: currentUser.id,
        subject: newTicketForm.subject,
        message: newTicketForm.message,
        category: newTicketForm.category,
        order_id: newTicketForm.order_id || undefined
      });
      await loadData();
      setTicketModalOpen(false);
      setNewTicketForm({ subject: '', category: 'general', message: '', order_id: '' });
      showToast('Support ticket filed! Our team is on it.', 'success');
    } catch (e) {
      showToast('Failed to submit ticket', 'error');
    }
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
              <div className="text-lg font-bold font-display text-white">{loyalty?.balance || 0} pts</div>
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
                <span className="font-mono font-bold text-sm text-ink">{activeOrder.id.substring(0, 8)}...</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-ink">
                {activeOrder.items[0]?.service_name || 'Laundry Service'}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-mint" /> Estimated Handover: <strong>{activeOrder.estimated_delivery ? new Date(activeOrder.estimated_delivery).toLocaleDateString() : 'TBD'}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-mint" /> {activeOrder.address?.city || 'N/A'}
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

          <div className="py-6 border-b border-ink/5">
            <ProgressBar status={activeOrder.status} />
          </div>

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
                        <span className="font-mono font-bold text-sm text-ink">{order.id.substring(0,8)}...</span>
                        <span className="text-[11px] text-slate-400">• {new Date(order.created_at).toLocaleDateString()}</span>
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
                        {order.address?.address_line || ''}, {order.address?.city || ''}
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
                    onClick={async () => {
                      await addressService.deleteAddress(addr.id);
                      await loadData();
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
                    onClick={async () => {
                      await addressService.setDefaultAddress(currentUser.id, addr.id);
                      await loadData();
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

      {/* TAB 3: SUBSCRIPTIONS */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <Card className="p-8 border-ink/5 bg-gradient-to-br from-white to-slate-50 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="mint">No Active Pass</Badge>
                <h3 className="text-xl font-bold font-display text-ink mt-2">Monthly Laundry Pass</h3>
                <p className="text-sm text-slate-500 mt-1">Subscribe to save up to 35% on every wash.</p>
              </div>
            </div>
            <div className="pt-4">
              <Link to="/#subscriptions">
                <Button variant="coral" size="md">View Pass Options</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: LOYALTY */}
      {activeTab === 'loyalty' && (
        <div className="space-y-6">
          <Card className="p-8 border-ink/5 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold font-display text-ink">FreshPoints Balance</h3>
                <p className="text-sm text-slate-500">Earn 1 point for every ₹100 spent.</p>
              </div>
              <div className="text-4xl font-bold font-mono text-mint-dark">{loyalty?.balance || 0}</div>
            </div>
            
            <div className="pt-6 border-t border-ink/5">
              <h4 className="text-sm font-bold text-ink mb-4">Transaction History</h4>
              {(!loyalty?.history || loyalty.history.length === 0) ? (
                <div className="text-xs text-slate-400">No point history available yet.</div>
              ) : (
                <div className="space-y-3">
                  {loyalty.history.map((tx: any) => (
                    <div key={tx.id} className="flex justify-between items-center text-sm border-b border-ink/5 pb-2">
                      <span className="text-slate-600">{tx.description}</span>
                      <span className={`font-bold ${tx.points > 0 ? 'text-mint-dark' : 'text-coral'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: SUPPORT TICKETS */}
      {activeTab === 'support' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold font-display text-ink">Support Tickets</h3>
              <p className="text-xs text-slate-500">Need help? We usually reply within 2 hours.</p>
            </div>
            <Button variant="mint" size="sm" onClick={() => setTicketModalOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Ticket
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {tickets.length === 0 ? (
              <Card className="p-10 text-center text-slate-400 space-y-2">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm">No support tickets found</div>
              </Card>
            ) : (
              tickets.map((t) => (
                <Card key={t.id} className="p-5 border-ink/5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-400">#{t.id.substring(0,8)}</span>
                        <Badge variant={t.status === 'resolved' ? 'mint' : 'amber'} size="sm">{t.status}</Badge>
                      </div>
                      <h4 className="font-bold text-sm text-ink mt-1">{t.subject}</h4>
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">{t.message}</p>
                  {t.resolution && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                      <strong>Resolution:</strong> {t.resolution}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* TICKET MODAL */}
      <Modal isOpen={ticketModalOpen} onClose={() => setTicketModalOpen(false)} title="Submit Support Ticket">
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <Input 
            label="Subject" 
            value={newTicketForm.subject} 
            onChange={(e) => setNewTicketForm({...newTicketForm, subject: e.target.value})} 
            required 
          />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</label>
            <select 
              value={newTicketForm.category} 
              onChange={(e) => setNewTicketForm({...newTicketForm, category: e.target.value as any})}
              className="w-full rounded-xl border-ink/15 text-sm p-3 border outline-none"
            >
              <option value="general">General Inquiry</option>
              <option value="order_issue">Order Issue</option>
              <option value="billing">Billing</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Message</label>
            <textarea 
              rows={4}
              value={newTicketForm.message}
              onChange={(e) => setNewTicketForm({...newTicketForm, message: e.target.value})}
              className="w-full rounded-xl border-ink/15 text-sm p-3 border outline-none"
              required
            />
          </div>
          <Button type="submit" variant="mint" className="w-full">Submit Ticket</Button>
        </form>
      </Modal>
    </div>
  );
};

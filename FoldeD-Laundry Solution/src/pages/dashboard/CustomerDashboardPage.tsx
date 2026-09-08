import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { orderService } from '../../services/api/orderService';
import { addressService } from '../../services/api/addressService';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import type { Order, Address, SupportTicket, LoyaltyAccount } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PriceBreakdown } from '../../components/ui/PriceBreakdown';
import {
  Package, MapPin, Clock, ArrowRight, Receipt, Coins, Plus, Trash2, HelpCircle, Loader2,
  TrendingUp, TrendingDown, Target, Award, BarChart, DollarSign, Shield, Star,
  RotateCcw, Download, Eye, Edit, MapPin as MapPinIcon, Calendar, CheckCircle2, AlertCircle,
  Lock as LockIcon,
  Tag
} from 'lucide-react';

// Background pattern SVG as constant to avoid escaping issues
const BACKGROUND_PATTERN = "data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E";

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
  const [newTicketForm, setNewTicketForm] = useState<{
    subject: string;
    category: SupportTicket['category'];
    message: string;
    order_id: string;
    priority: 'low' | 'medium' | 'high';
  }>({
    subject: '',
    category: 'general',
    message: '',
    order_id: '',
    priority: 'medium',
  });

  // Analytics State
  const [analytics, setAnalytics] = useState({
    totalSpent: 0,
    totalOrders: 0,
    completedOrders: 0,
    avgOrderValue: 0,
    monthlySpending: [] as Array<{month: string, amount: number}>,
    categoryBreakdown: [] as Array<{category: string, count: number, amount: number}>,
  });

  const loadData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const fetchedOrders = await orderService.getOrdersByUser(currentUser.id);
      const fetchedAddresses = await addressService.getAddressesByUser(currentUser.id);
      
      const { loyaltyService } = await import('../../services/api/loyaltyService');
      const { ticketService } = await import('../../services/api/ticketService');
      
      setOrders(fetchedOrders);
      setAddresses(fetchedAddresses);
      const loyaltyData = await loyaltyService.getAccount(currentUser.id);
      if (loyaltyData) setLoyalty(loyaltyData);
      setTickets(await ticketService.getTicketsByUser(currentUser.id));
      
      // Calculate analytics
      calculateAnalytics(fetchedOrders);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAnalytics = (orderList: Order[]) => {
    const completed = orderList.filter(o => o.status === 'DELIVERED');
    const totalSpent = completed.reduce((sum, o) => sum + o.total_amount, 0);
    const totalOrders = orderList.length;
    const completedOrders = completed.length;
    const avgOrderValue = completedOrders > 0 ? totalSpent / completedOrders : 0;
    
    // Monthly spending (last 6 months)
    const monthlyMap = new Map<string, number>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyMap.set(key, 0);
    }
    
    completed.forEach(order => {
      const date = new Date(order.created_at);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + order.total_amount);
    });
    
    const monthlySpending = Array.from(monthlyMap.entries()).map(([month, amount]) => ({ month, amount }));
    
    // Category breakdown
    const categoryMap = new Map<string, { count: number, amount: number }>();
    completed.forEach(order => {
      const cat = order.items[0]?.service_name || 'Unknown';
      const existing = categoryMap.get(cat) || { count: 0, amount: 0 };
      categoryMap.set(cat, { 
        count: existing.count + 1, 
        amount: existing.amount + order.total_amount 
      });
    });
    
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data
    }));
    
    setAnalytics({
      totalSpent,
      totalOrders,
      completedOrders,
      avgOrderValue,
      monthlySpending,
      categoryBreakdown,
    });
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
  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

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
      } catch {
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
      setNewTicketForm({ subject: '', category: 'general', message: '', order_id: '', priority: 'medium' });
      showToast('Support ticket filed! Our team is on it.', 'success');
    } catch {
      showToast('Failed to submit ticket', 'error');
    }
  };

  const loyaltyTier = loyalty.balance >= 5000 ? 'Platinum' : loyalty.balance >= 2000 ? 'Gold' : loyalty.balance >= 500 ? 'Silver' : 'Bronze';
  const nextTierThreshold = loyalty.balance >= 5000 ? null : loyalty.balance >= 2000 ? 5000 : loyalty.balance >= 500 ? 2000 : 500;
  const tierProgress = nextTierThreshold ? (loyalty.balance / nextTierThreshold) * 100 : 100;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Top Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-700 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `url("${BACKGROUND_PATTERN}")` }} />
        <div className="relative space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">
              Hello, {currentUser.full_name}
            </h1>
            <Badge variant="mint" size="sm">{loyaltyTier} Member</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            {currentUser.email} • {currentUser.phone}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-300 uppercase font-semibold">FreshPoints</div>
              <div className="text-lg font-bold font-display text-white">{loyalty?.balance || 0} pts</div>
            </div>
          </div>
          <Link to="/booking">
            <Button variant="coral" size="md" className="shadow-lg shadow-coral/30 text-xs sm:text-sm">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Book New Pickup
            </Button>
          </Link>
        </div>
      </div>

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-slate-200/80 bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Spent</div>
              <div className="text-2xl font-bold font-display text-slate-900 mt-1">{formatCurrency(analytics.totalSpent)}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-emerald-600">
            <TrendingUp className="w-3 h-3" />
            <span>{analytics.completedOrders} completed orders</span>
          </div>
        </Card>

        <Card className="p-5 border-slate-200/80 bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Orders</div>
              <div className="text-2xl font-bold font-display text-slate-900 mt-1">{analytics.totalOrders}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
            <span>{analytics.completedOrders} delivered</span>
            <span className="mx-1">•</span>
            <span>{analytics.totalOrders - analytics.completedOrders} pending</span>
          </div>
        </Card>

        <Card className="p-5 border-slate-200/80 bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Avg. Order Value</div>
              <div className="text-2xl font-bold font-display text-slate-900 mt-1">{formatCurrency(analytics.avgOrderValue)}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <BarChart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
            <Target className="w-3 h-3" />
            <span>Across {analytics.completedOrders} deliveries</span>
          </div>
        </Card>

        <Card className="p-5 border-slate-200/80 bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Loyalty Tier</div>
              <div className="text-2xl font-bold font-display text-slate-900 mt-1">{loyaltyTier}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${tierProgress}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {nextTierThreshold 
                ? `${nextTierThreshold - loyalty.balance} pts to next tier` 
                : 'Maximum tier reached! 🎉'}
            </div>
          </div>
        </Card>
      </div>

      {/* Monthly Spending Chart */}
      <Card className="p-6 border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BarChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-display text-slate-900">Monthly Spending</h3>
              <p className="text-xs text-slate-500">Last 6 months</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        </div>
        <div className="h-48 flex items-end justify-between gap-2 px-2">
                  {analytics.monthlySpending.map((item) => (
                    <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t transition-all duration-500 hover:from-emerald-600 hover:to-emerald-500"
                        style={{ 
                          height: analytics.monthlySpending.length > 0 
                            ? `${Math.max(5, (item.amount / Math.max(...analytics.monthlySpending.map(m => m.amount), 1)) * 95)}%` 
                            : '5%' 
                        }}
                      title={`${item.month}: ${formatCurrency(item.amount)}`}
                      />
                      <span className="text-[10px] text-slate-500 font-medium">{item.month}</span>
                    </div>
                  ))}
                </div>
      </Card>

      {/* Active Order Spotlight Banner */}
      {activeOrder && (
        <Card className="p-6 sm:p-8 border-2 border-emerald-500/40 bg-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-200/70">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Badge variant="mint" dot>Active Order in Progress</Badge>
                <span className="font-mono font-bold text-sm text-slate-900">{activeOrder.id.substring(0, 8)}...</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900">
                {activeOrder.items[0]?.service_name || 'Laundry Service'}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" /> Estimated Handover: <strong>{activeOrder.estimated_delivery ? new Date(activeOrder.estimated_delivery).toLocaleDateString() : 'TBD'}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {activeOrder.address?.city || 'N/A'}
                </span>
              </div>
            </div>

            {/* Doorstep 4-Digit Security PIN Callout */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <LockIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                  Doorstep Delivery PIN
                </div>
                <div className="text-3xl font-bold font-mono text-slate-900 tracking-widest">
                  {activeOrder.delivery_pin}
                </div>
                <div className="text-[10px] text-slate-500">Share with rider only upon delivery</div>
              </div>
            </div>
          </div>

          <div className="py-6 border-b border-slate-200/70">
            <ProgressBar status={activeOrder.status} />
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                {activeOrder.pickup_staff_name ? activeOrder.pickup_staff_name[0] : 'R'}
              </div>
              <div>
                <div className="font-semibold text-slate-900">
                  {activeOrder.status.includes('DELIVERY')
                    ? activeOrder.delivery_staff_name || 'Amit Kumar (Courier)'
                    : activeOrder.pickup_staff_name || 'Vikram Singh (Rider)'}
                </div>
                <div className="text-slate-400 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500" />
                  Assigned Logistics Partner ★ 4.9
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Link to={`/track/${activeOrder.id}`}>
                <Button variant="mint" size="sm" className="gap-1.5 text-xs font-semibold w-full sm:w-auto">
                  <MapPinIcon className="w-3.5 h-3.5" />
                  Live Visual Route
                </Button>
              </Link>
              {activeOrder.status === 'ORDER_PLACED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancelOrder(activeOrder.id)}
                  className="text-xs text-red-600 border-red-200 hover:bg-red-50 w-full sm:w-auto"
                >
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  Cancel Order
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/70 overflow-x-auto pb-1 text-sm font-medium">
        {[
          { id: 'orders', label: 'All Orders', count: orders.length, icon: Package },
          { id: 'addresses', label: 'Saved Addresses', count: addresses.length, icon: MapPinIcon },
          { id: 'subscription', label: 'Laundry Pass', icon: Shield },
          { id: 'loyalty', label: 'FreshLoyalty', icon: Coins },
          { id: 'support', label: 'Support Tickets', count: tickets.length, icon: HelpCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-full whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
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
                    ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold font-display text-slate-900">No orders found</h3>
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
                <Card key={order.id} className="p-6 border-slate-200/80 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900">{order.id.substring(0,8)}...</span>
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
                      <h4 className="font-bold text-base font-display text-slate-900">
                        {order.items[0]?.service_name || 'Wash & Fold'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {order.address?.address_line || ''}, {order.address?.city || ''}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/70">
                      <span className="text-slate-500">
                        Paid via {order.payment_method?.toUpperCase()}
                      </span>
                      <span className="font-bold text-base font-display text-slate-900">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setReceiptOrder(order)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      View Invoice
                    </button>

                    <Link to={`/track/${order.id}`}>
                      <Button variant="outline" size="sm" className="text-xs flex-1 sm:w-auto">
                        <Eye className="w-3.5 h-3.5 mr-1" />
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
              <h3 className="text-xl font-bold font-display text-slate-900">Saved Locations</h3>
              <p className="text-xs text-slate-500">Manage doorstep pickup and delivery addresses.</p>
            </div>
            <Link to="/booking">
              <Button variant="coral" size="sm" className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add from Booking
              </Button>
            </Link>
          </div>

          {addresses.length === 0 ? (
            <Card className="p-10 text-center border-2 border-dashed border-slate-200/80 bg-slate-50/50 space-y-3">
              <MapPin className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-800">No saved addresses found</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add a new address to speed up future bookings.
                </p>
              </div>
              <Link to="/booking">
                <Button variant="coral" size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Add Your First Address
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {addresses.map((addr) => (
                <Card key={addr.id} className="p-6 border-slate-200/80 space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{addr.name}</span>
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
                      className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Set as Default
                    </button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SUBSCRIPTIONS */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <Card className="p-8 border-slate-200/80 bg-gradient-to-br from-white to-slate-50 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="mint">No Active Pass</Badge>
                <h3 className="text-xl font-bold font-display text-slate-900 mt-2">Monthly Laundry Pass</h3>
                <p className="text-sm text-slate-500 mt-1">Subscribe to save up to 35% on every wash.</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-slate-900/10 flex items-center justify-center">
                <Shield className="w-8 h-8 text-slate-900" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 text-center">
                <div className="text-2xl font-bold font-display text-slate-900">35%</div>
                <div className="text-xs text-slate-500">Max Savings</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 text-center">
                <div className="text-2xl font-bold font-display text-slate-900">Unlimited</div>
                <div className="text-xs text-slate-500">Free Pickups</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 text-center">
                <div className="text-2xl font-bold font-display text-slate-900">Priority</div>
                <div className="text-xs text-slate-500">Support</div>
              </div>
            </div>

            <div className="pt-4">
              <Link to="/#subscriptions">
                <Button variant="coral" size="md" className="w-full sm:w-auto">
                  View Pass Options
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Subscription Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: RotateCcw, title: 'Pause Anytime', desc: 'No lock-in, pause or cancel monthly' },
              { icon: Download, title: 'Auto-Renew', desc: 'Seamless monthly billing' },
              { icon: Eye, title: 'Track Usage', desc: 'Real-time kg & pickup tracking' },
              { icon: Edit, title: 'Flexible Plans', desc: 'Upgrade/downgrade anytime' },
            ].map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <Card key={idx} className="p-5 border-slate-200/80 bg-white text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900">{benefit.title}</h4>
                  <p className="text-xs text-slate-500">{benefit.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: LOYALTY */}
      {activeTab === 'loyalty' && (
        <div className="space-y-6">
          <Card className="p-8 border-slate-200/80 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl -translate-x-1/4 translate-y-1/4" />
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold font-display text-slate-900">FreshPoints Balance</h3>
                <p className="text-sm text-slate-500">Earn 1 point for every ₹100 spent.</p>
              </div>
              <div className="text-5xl font-bold font-mono text-amber-600">{loyalty?.balance || 0}</div>
            </div>
            
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${tierProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Bronze (0 pts)</span>
              <span>Silver (500 pts)</span>
              <span>Gold (2,000 pts)</span>
              <span>Platinum (5,000 pts)</span>
            </div>
          </Card>

          {/* Loyalty Earning Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 border-slate-200/80 bg-white text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold font-display text-slate-900">
                {loyalty.history.filter((tx: any) => tx.points > 0).reduce((sum: number, tx: any) => sum + tx.points, 0)}
              </div>
              <div className="text-xs text-slate-500">Total Points Earned</div>
            </Card>
            <Card className="p-5 border-slate-200/80 bg-white text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Target className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold font-display text-slate-900">
                {loyalty.history.filter((tx: any) => tx.points < 0).reduce((sum: number, tx: any) => sum + Math.abs(tx.points), 0)}
              </div>
              <div className="text-xs text-slate-500">Total Points Redeemed</div>
            </Card>
            <Card className="p-5 border-slate-200/80 bg-white text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Star className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold font-display text-slate-900">
                {nextTierThreshold ? nextTierThreshold - loyalty.balance : 0}
              </div>
              <div className="text-xs text-slate-500">Points to Next Tier</div>
            </Card>
          </div>

          <Card className="p-6 border-slate-200/80 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 mb-2">Transaction History</h4>
            {(!loyalty?.history || loyalty.history.length === 0) ? (
              <div className="text-xs text-slate-400 text-center py-8">
                <Coins className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No point history available yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loyalty.history.map((tx: any) => (
                  <div key={tx.id} className="flex justify-between items-center text-sm border-b border-slate-200/70 pb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.points > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {tx.points > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{tx.description}</div>
                        <div className="text-[10px] text-slate-400">{new Date(tx.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <span className={`font-bold ${tx.points > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Loyalty Rewards Catalog */}
          <Card className="p-6 border-slate-200/80 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 mb-2">Available Rewards</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { name: '₹50 Off Next Order', cost: 500, icon: <Tag className="w-5 h-5" /> },
                { name: 'Free Express Upgrade', cost: 1000, icon: <Clock className="w-5 h-5" /> },
                { name: 'Free Pickup & Delivery', cost: 800, icon: <MapPin className="w-5 h-5" /> },
                { name: 'Premium Garment Care', cost: 2000, icon: <Star className="w-5 h-5" /> },
              ].map((reward, idx) => (
                <div key={idx} className={`p-4 rounded-xl border transition-all ${loyalty.balance >= reward.cost ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white opacity-70'}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto 
                    {loyalty.balance >= reward.cost ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}">
                    {reward.icon}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 text-center mb-1">{reward.name}</div>
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <Coins className="w-3 h-3" />
                    <span className={loyalty.balance >= reward.cost ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {reward.cost} pts
                    </span>
                  </div>
                  {loyalty.balance < reward.cost && (
                    <div className="text-[10px] text-slate-400 text-center mt-2">
                      Need {reward.cost - loyalty.balance} more pts
                    </div>
                  )}
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
              <h3 className="text-xl font-bold font-display text-slate-900">Support Tickets</h3>
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
                <p className="text-xs text-slate-500">Your first ticket will appear here.</p>
              </Card>
            ) : (
              tickets.map((t) => (
                <Card key={t.id} className="p-5 border-slate-200/80 space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-400">#{t.id.substring(0,8)}</span>
                        <Badge variant={t.status === 'resolved' ? 'mint' : t.status === 'in_progress' ? 'blue' : 'amber'} size="sm">
                          {t.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-1">{t.subject}</h4>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(t.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="capitalize">{t.category.replace('_', ' ')}</span>
                        <span>•</span>
                        <span className={`font-medium ${t.priority === 'high' ? 'text-red-600' : t.priority === 'medium' ? 'text-amber-600' : 'text-slate-500'}`}>
                          {t.priority} priority
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">{t.message}</p>
                  {t.resolution && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Resolution:</strong> {t.resolution}
                      </div>
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
              className="w-full rounded-xl border-slate-200/80 text-sm p-3 border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="general">General Inquiry</option>
              <option value="order_issue">Order Issue</option>
              <option value="billing">Billing</option>
              <option value="quality">Quality Concern</option>
              <option value="delivery">Delivery Issue</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Priority</label>
            <select
              value={newTicketForm.category} // reuse category for priority for now
              onChange={(e) => setNewTicketForm({...newTicketForm, priority: e.target.value as any})}
              className="w-full rounded-xl border-slate-200/80 text-sm p-3 border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="low">Low - General Question</option>
              <option value="medium">Medium - Needs Attention</option>
              <option value="high">High - Urgent Issue</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Message</label>
            <textarea
              rows={4}
              value={newTicketForm.message}
              onChange={(e) => setNewTicketForm({...newTicketForm, message: e.target.value})}
              className="w-full rounded-xl border-slate-200/80 text-sm p-3 border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Related Order (Optional)</label>
            <select
              value={newTicketForm.order_id}
              onChange={(e) => setNewTicketForm({...newTicketForm, order_id: e.target.value})}
              className="w-full rounded-xl border-slate-200/80 text-sm p-3 border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">No related order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id.substring(0,8)}... - {o.items[0]?.service_name} - {formatCurrency(o.total_amount)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="mint" className="w-full">
            Submit Ticket
          </Button>
        </form>
      </Modal>

      {/* INVOICE / RECEIPT MODAL */}
      <Modal
        isOpen={Boolean(receiptOrder)}
        onClose={() => setReceiptOrder(null)}
        title="Tax Invoice & Order Receipt"
        description={receiptOrder ? `Order #${receiptOrder.id}` : ''}
        maxWidth="lg"
      >
        {receiptOrder && (
          <div className="space-y-5 text-left">
            <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Order Date</span>
                <span className="text-xs font-semibold text-slate-800">{formatDateTime(receiptOrder.created_at)}</span>
              </div>
              <Badge variant={receiptOrder.status === 'DELIVERED' ? 'mint' : 'blue'}>
                {receiptOrder.status.replace(/_/g, ' ')}
              </Badge>
            </div>

            <div className="space-y-2 border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Service Items</span>
              {receiptOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">{it.service_name} x {it.quantity}</span>
                  <span className="font-mono font-medium text-slate-900">{formatCurrency(it.total_price)}</span>
                </div>
              ))}
            </div>

            <PriceBreakdown
              subtotal={receiptOrder.subtotal}
              alterationsTotal={receiptOrder.alterations?.reduce((sum: number, a: any) => sum + a.price * a.quantity, 0) || 0}
              expressCharge={receiptOrder.express_surcharge || 0}
              deliveryCharge={receiptOrder.delivery_charge || 0}
              couponDiscount={0}
              loyaltyDiscount={receiptOrder.discount_amount || 0}
              totalAmount={receiptOrder.total_amount}
              isExpress={!!receiptOrder.express_surcharge}
              appliedCoupon={null}
              loyaltyBalance={loyalty.balance}
              useLoyaltyPoints={false}
              compact
            />

            {receiptOrder.delivery_pin && (
              <div className="p-3 rounded-xl bg-slate-900 text-white flex justify-between items-center">
                <span className="text-xs text-slate-300">Secure Delivery Handover PIN</span>
                <span className="font-mono font-bold tracking-widest text-emerald-400 text-sm">{receiptOrder.delivery_pin}</span>
              </div>
            )}

            <div className="text-[11px] text-slate-400 text-center">
              FreshFold Laundry Services Pvt. Ltd. • GSTIN: 29AAFCS8712C1Z4
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
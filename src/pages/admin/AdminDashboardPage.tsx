import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { Order, OrderStatus, Service, SupportTicket } from '../../types';
import { ALLOWED_TRANSITIONS } from '../../lib/orderStateMachine';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Package,
  Truck,
  Search,
  Filter,
  DollarSign,
  Clock,
} from 'lucide-react';

// Static sample series for the analytics charts. NOT computed from the orders
// table — the UI labels these charts "Sample data". Replace with a real
// aggregation query before treating them as operational metrics.
const REVENUE_TREND_DATA = [
  { day: 'Mon', revenue: 14200, orders: 34 },
  { day: 'Tue', revenue: 18400, orders: 42 },
  { day: 'Wed', revenue: 16100, orders: 38 },
  { day: 'Thu', revenue: 22800, orders: 55 },
  { day: 'Fri', revenue: 26400, orders: 68 },
  { day: 'Sat', revenue: 38900, orders: 94 },
  { day: 'Sun', revenue: 31200, orders: 78 },
];

const CATEGORY_DISTRIBUTION = [
  { name: 'Wash & Fold', value: 45, color: '#00BFA6' },
  { name: 'Wash & Iron', value: 30, color: '#FF6B5B' },
  { name: 'Steam Press', value: 12, color: '#38BDF8' },
  { name: 'Dry Clean', value: 13, color: '#A855F7' },
];

export const AdminDashboardPage: React.FC = () => {
  const { showToast } = useApp();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceAreas, setServiceAreas] = useState<any[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [activeAdminTab, setActiveAdminTab] = useState<'dispatch' | 'analytics' | 'pricing' | 'tickets'>('dispatch');

  // Resolution modal
  const [resolvingTicket, setResolvingTicket] = useState<SupportTicket | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  // Service price edit state
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Lazy load the service so it works with updated deps
      const { orderService } = await import('../../services/api/orderService');
      const { serviceService } = await import('../../services/api/serviceService');
      const { areaService } = await import('../../services/api/areaService');
      const { ticketService } = await import('../../services/api/ticketService');
      
      const allOrders = await orderService.getAllOrders();
      setOrders(allOrders);
      setServices(await serviceService.getAllServices());
      setServiceAreas(await areaService.getAllAreas());
      setTickets(await ticketService.getAllTickets());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  // Compute live KPIs
  const totalRevenue = orders.reduce((sum, o) => sum + (o.status !== 'CANCELLED' ? o.total_amount : 0), 0);
  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REFUNDED'
  ).length;
  const inFacilityCount = orders.filter((o) =>
    ['RECEIVED_AT_FACILITY', 'SORTING', 'WASHING', 'DRYING', 'IRONING_FOLDING', 'QUALITY_CHECK'].includes(o.status)
  ).length;
  const deliveredCount = orders.filter(
    (o) => o.status === 'DELIVERED' || o.status === 'COMPLETED'
  ).length;

  // Filtered orders list
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_phone.includes(searchQuery);

    const matchesStatus =
      selectedStatusFilter === 'ALL' ? true : order.status === selectedStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleQuickStatusChange = async (order: Order, newStatus: OrderStatus) => {
    // Settling payment is a hard prerequisite for delivery on the normal path.
    // admin_override_status skips that check, so guard it here.
    if (newStatus === 'DELIVERED' && order.payment_status !== 'SUCCESS') {
      showToast('Cannot mark delivered: payment has not been settled for this order.', 'error');
      return;
    }

    // Several of these buttons intentionally jump the pipeline
    // (PICKUP_ASSIGNED -> RECEIVED_AT_FACILITY skips PICKED_UP, WASHING ->
    // READY_FOR_DELIVERY skips drying/pressing/QC). Surface the override instead
    // of silently advancing past stages the staff never worked.
    const isNormalTransition = ALLOWED_TRANSITIONS[order.status]?.includes(newStatus) ?? false;
    if (!isNormalTransition) {
      const confirmed = confirm(
        `Override pipeline?\n\n${order.status} → ${newStatus} is not a normal transition and will skip intermediate stages. This is recorded against your admin account.`
      );
      if (!confirmed) return;
    }

    try {
      const { orderService } = await import('../../services/api/orderService');
      await orderService.adminOverrideStatus(
        order.id,
        newStatus,
        `Dispatch tower override: ${order.status} → ${newStatus}`
      );
      await loadData();
      showToast(`Order ${order.id} status set to ${newStatus}`, 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Cancel this order? A refund will be processed for paid orders.')) return;
    try {
      const { orderService } = await import('../../services/api/orderService');
      await orderService.cancelOrder(orderId, 'Cancelled by admin');
      await loadData();
      showToast('Order cancelled', 'info');
    } catch {
      showToast('Failed to cancel order', 'error');
    }
  };

  const handleResolveTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingTicket) return;
    try {
      const { ticketService } = await import('../../services/api/ticketService');
      await ticketService.resolveTicket(resolvingTicket.id, resolutionNote);
      await loadData();
      setResolvingTicket(null);
      setResolutionNote('');
      showToast(`Ticket ${resolvingTicket.id} marked resolved`, 'success');
    } catch {
      showToast('Failed to resolve ticket', 'error');
    }
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    try {
      const { serviceService } = await import('../../services/api/serviceService');
      await serviceService.updatePrice(editingService.id, newPrice);
      await loadData();
      setEditingService(null);
      showToast(`Updated price for ${editingService.name}`, 'success');
    } catch {
      showToast('Failed to update price', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-ink dark:border-cream border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Admin Operations Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-ink text-cream shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-mint animate-pulse" />
            <Badge variant="mint" size="sm">Central Control Tower</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-cream mt-1">
            FoldeD Operations Command
          </h1>
          <p className="text-xs sm:text-sm text-cream/60">
            Real-time logistics monitoring, live fleet status, pricing controls, and support escalation.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-xs">
          <button
            onClick={() => setActiveAdminTab('dispatch')}
            className={`px-3 py-2 rounded-xl font-bold transition-all ${
              activeAdminTab === 'dispatch' ? 'bg-mint text-ink shadow-sm' : 'text-cream/70 hover:text-cream'
            }`}
          >
            Dispatch Tower
          </button>
          <button
            onClick={() => setActiveAdminTab('analytics')}
            className={`px-3 py-2 rounded-xl font-bold transition-all ${
              activeAdminTab === 'analytics' ? 'bg-mint text-ink shadow-sm' : 'text-cream/70 hover:text-cream'
            }`}
          >
            Metrics &amp; Recharts
          </button>
          <button
            onClick={() => setActiveAdminTab('pricing')}
            className={`px-3 py-2 rounded-xl font-bold transition-all ${
              activeAdminTab === 'pricing' ? 'bg-mint text-ink shadow-sm' : 'text-cream/70 hover:text-cream'
            }`}
          >
            Pricing &amp; Areas
          </button>
          <button
            onClick={() => setActiveAdminTab('tickets')}
            className={`px-3 py-2 rounded-xl font-bold transition-all ${
              activeAdminTab === 'tickets' ? 'bg-mint text-ink shadow-sm' : 'text-cream/70 hover:text-cream'
            }`}
          >
            Tickets ({tickets.filter((t) => t.status === 'open').length})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="p-6 border-slate-200/70 bg-surface space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Platform Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold font-display text-foreground">{formatCurrency(totalRevenue)}</div>
          <div className="text-[11px] text-slate-500 font-medium">
            All non-cancelled orders
          </div>
        </Card>

        <Card className="p-6 border-slate-200/70 bg-surface space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Pipeline</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold font-display text-blue-600">{activeOrdersCount}</div>
          <div className="text-[11px] text-slate-500">Live across pickup &amp; delivery</div>
        </Card>

        <Card className="p-6 border-slate-200/70 bg-surface space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">In-Facility Load</span>
            <Truck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold font-display text-purple-600">{inFacilityCount} batches</div>
          <div className="text-[11px] text-slate-500 font-medium">Currently in processing</div>
        </Card>

        <Card className="p-6 border-slate-200/70 bg-surface space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed Deliveries</span>
            <Clock className="w-4 h-4 text-mint" />
          </div>
          <div className="text-3xl font-bold font-display text-mint-dark">{deliveredCount}</div>
          <div className="text-[11px] text-slate-500">Handed over successfully</div>
        </Card>
      </div>

      {/* TAB 1: DISPATCH & ORDER MANAGEMENT TABLE */}
      {activeAdminTab === 'dispatch' && (
        <div className="space-y-6">
          <Card className="p-6 border-slate-200/70 bg-surface shadow-card space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Order ID, Customer Name or Phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-300/80 text-xs outline-none focus:border-mint"
                />
              </div>

              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-slate-300/80 text-xs outline-none bg-surface focus:border-mint"
                >
                  <option value="ALL">All Statuses ({orders.length})</option>
                  <option value="ORDER_PLACED">ORDER_PLACED</option>
                  <option value="PICKUP_ASSIGNED">PICKUP_ASSIGNED</option>
                  <option value="WASHING">WASHING</option>
                  <option value="READY_FOR_DELIVERY">READY_FOR_DELIVERY</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-2">Order ID</th>
                    <th className="py-3 px-2">Customer</th>
                    <th className="py-3 px-2">Service &amp; Weight</th>
                    <th className="py-3 px-2">Amount</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-right">Admin Action Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        No orders match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-2 font-mono font-bold text-foreground">
                          {order.id}
                          <div className="text-[10px] text-slate-400 font-normal">
                            {formatDate(order.created_at)}
                          </div>
                        </td>

                        <td className="py-3 px-2 font-medium text-foreground">
                          {order.customer_name}
                          <div className="text-[10px] text-slate-400">{order.customer_phone}</div>
                        </td>

                        <td className="py-3 px-2">
                          <div className="font-medium text-foreground">{order.items[0]?.service_name}</div>
                          <div className="text-[10px] text-slate-500">
                            {order.measured_weight_kg ? `${order.measured_weight_kg} kg (Scale)` : `${order.items[0]?.weight ?? '—'} kg (Est)`}
                          </div>
                        </td>

                        <td className="py-3 px-2 font-bold font-mono text-foreground">
                          {formatCurrency(order.total_amount)}
                          <div className="text-[10px] uppercase font-semibold text-mint-dark">
                            {order.payment_method}
                          </div>
                        </td>

                        <td className="py-3 px-2">
                          <Badge
                            variant={
                              order.status === 'DELIVERED'
                                ? 'mint'
                                : order.status === 'CANCELLED'
                                ? 'coral'
                                : 'blue'
                            }
                            size="sm"
                          >
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>

                        <td className="py-3 px-2 text-right space-x-1.5">
                          {['ORDER_PLACED', 'CONFIRMED'].includes(order.status) && (
                            <Button
                              variant="mint"
                              size="sm"
                              onClick={() => handleQuickStatusChange(order, 'PICKUP_ASSIGNED')}
                              className="text-[11px] h-7 px-2.5"
                            >
                              Dispatch Pickup
                            </Button>
                          )}

                          {order.status === 'PICKUP_ASSIGNED' && (
                            <Button
                              variant="mint"
                              size="sm"
                              onClick={() => handleQuickStatusChange(order, 'RECEIVED_AT_FACILITY')}
                              className="text-[11px] h-7 px-2.5"
                            >
                              Intake Hub
                            </Button>
                          )}

                          {order.status === 'RECEIVED_AT_FACILITY' && (
                            <Button
                              variant="mint"
                              size="sm"
                              onClick={() => handleQuickStatusChange(order, 'WASHING')}
                              className="text-[11px] h-7 px-2.5"
                            >
                              Start Wash
                            </Button>
                          )}

                          {order.status === 'WASHING' && (
                            <Button
                              variant="mint"
                              size="sm"
                              onClick={() => handleQuickStatusChange(order, 'READY_FOR_DELIVERY')}
                              className="text-[11px] h-7 px-2.5"
                            >
                              Mark Ready
                            </Button>
                          )}

                          {order.status === 'READY_FOR_DELIVERY' && (
                            <Button
                              variant="coral"
                              size="sm"
                              onClick={() => handleQuickStatusChange(order, 'OUT_FOR_DELIVERY')}
                              className="text-[11px] h-7 px-2.5"
                            >
                              Dispatch Rider
                            </Button>
                          )}

                          {order.status === 'OUT_FOR_DELIVERY' && (
                            <Button
                              variant="mint"
                              size="sm"
                              onClick={() => handleQuickStatusChange(order, 'DELIVERED')}
                              className="text-[11px] h-7 px-2.5"
                            >
                              Mark Delivered
                            </Button>
                          )}

                          {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="text-[11px] text-red-600 hover:underline px-1.5"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: ANALYTICS & RECHARTS */}
      {activeAdminTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Revenue Trend Line Chart */}
            <Card className="lg:col-span-8 p-6 border-slate-200/70 bg-surface space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base font-display text-foreground">7-Day Revenue &amp; Volume Trajectory</h3>
                  <p className="text-xs text-slate-400">Daily gross booking value in INR</p>
                </div>
                {/* Charts below render static sample series — no historical
                    aggregation query exists yet. Label them so admins don't read
                    the numbers as live. */}
                <Badge variant="amber">Sample data</Badge>
              </div>

              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={REVENUE_TREND_DATA}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00BFA6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00BFA6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), 'Revenue']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#00BFA6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Service Category Pie Chart */}
            <Card className="lg:col-span-4 p-6 border-slate-200/70 bg-surface space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base font-display text-foreground">Service Category Share</h3>
                  <p className="text-xs text-slate-400">Volume proportion by wash cycle</p>
                </div>
                <Badge variant="amber">Sample data</Badge>
              </div>

              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={CATEGORY_DISTRIBUTION}
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {CATEGORY_DISTRIBUTION.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                {CATEGORY_DISTRIBUTION.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span>{cat.name} ({cat.value}%)</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: PRICING & SERVICE AREAS */}
      {activeAdminTab === 'pricing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Service Price Configuration */}
          <div className="lg:col-span-7 bg-surface p-6 sm:p-8 rounded-3xl border border-slate-200/70 shadow-card space-y-6">
            <div>
              <h3 className="text-lg font-bold font-display text-foreground">Service Catalog &amp; Base Price Tiers</h3>
              <p className="text-xs text-slate-500">Update rates in real-time without redeploying code.</p>
            </div>

            <div className="space-y-3">
              {services.map((srv) => (
                <div
                  key={srv.id}
                  className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm text-foreground">{srv.name}</div>
                    <div className="text-xs text-slate-400">
                      SLA: {srv.turnaround_hours}h • Express Fee: {formatCurrency(srv.express_surcharge)}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-mint-dark">
                        {formatCurrency(srv.base_price)}
                      </span>
                      <span className="text-[11px] text-slate-400">/{srv.pricing_type === 'per_kg' ? 'kg' : 'item'}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingService(srv);
                        setNewPrice(srv.base_price);
                      }}
                      className="text-xs"
                    >
                      Edit Rate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Service Areas Toggle */}
          <div className="lg:col-span-5 bg-surface p-6 sm:p-8 rounded-3xl border border-slate-200/70 shadow-card space-y-6">
            <div>
              <h3 className="text-lg font-bold font-display text-foreground">Active Postal Code Zones</h3>
              <p className="text-xs text-slate-500">Toggle serviceable pin codes on the fly.</p>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {serviceAreas.map((area) => (
                <div key={area.pincode} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold font-mono text-sm text-foreground">{area.pincode}</div>
                    <div className="text-slate-500">{area.area_name}, {area.city}</div>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        const { areaService } = await import('../../services/api/areaService');
                        await areaService.toggleServiceArea(area.pincode, !area.is_active);
                        await loadData();
                        showToast(`Service zone ${area.pincode} updated`, 'info');
                      } catch {
                        showToast('Failed to update service zone', 'error');
                      }
                    }}
                    className={`px-3 py-1 rounded-full font-semibold transition-all ${
                      area.is_active
                        ? 'bg-mint-soft text-mint-dark border border-mint/20'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {area.is_active ? 'Active' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SUPPORT TICKETS RESOLUTION */}
      {activeAdminTab === 'tickets' && (
        <div className="space-y-6">
          <Card className="p-6 border-slate-200/70 bg-surface shadow-card space-y-4">
            <h3 className="text-lg font-bold font-display text-foreground">Customer Escalation Queue</h3>

            <div className="space-y-3">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-400">{t.id}</span>
                      <Badge variant={t.status === 'resolved' ? 'mint' : 'amber'} size="sm">
                        {t.status}
                      </Badge>
                      {t.order_id && <Badge variant="slate" size="sm">Order #{t.order_id}</Badge>}
                    </div>
                    <h4 className="font-bold text-sm text-foreground">{t.subject}</h4>
                    <p className="text-xs text-slate-500">{t.message}</p>
                    {t.resolution && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg mt-1">
                        <strong>Resolution:</strong> {t.resolution}
                      </div>
                    )}
                  </div>

                  {t.status !== 'resolved' && (
                    <Button
                      variant="mint"
                      size="sm"
                      onClick={() => setResolvingTicket(t)}
                      className="text-xs font-semibold whitespace-nowrap"
                    >
                      Resolve &amp; Reply
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: EDIT SERVICE PRICE */}
      <Modal
        isOpen={Boolean(editingService)}
        onClose={() => setEditingService(null)}
        title="Update Base Rate"
        description={editingService?.name}
      >
        {editingService && (
          <form onSubmit={handleSavePrice} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Base Price in INR ({editingService.pricing_type === 'per_kg' ? 'per kg' : 'per item'})
              </label>
              <input
                type="number"
                min={1}
                value={newPrice}
                onChange={(e) => setNewPrice(parseInt(e.target.value) || 0)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300/80 text-lg font-mono font-bold outline-none focus:border-mint"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingService(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="coral" size="sm">
                Save Price
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: RESOLVE TICKET */}
      <Modal
        isOpen={Boolean(resolvingTicket)}
        onClose={() => setResolvingTicket(null)}
        title="Resolve Support Ticket"
        description={`Ticket #${resolvingTicket?.id}: ${resolvingTicket?.subject}`}
      >
        {resolvingTicket && (
          <form onSubmit={handleResolveTicketSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
              <strong>Customer Query:</strong> {resolvingTicket.message}
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Resolution Explanation (Sent to customer)
              </label>
              <textarea
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="e.g. Garment was checked by Facility Lead and delicate bath initiated with citrus detergent..."
                className="w-full rounded-xl border border-slate-300/80 p-3 text-xs outline-none focus:border-mint"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setResolvingTicket(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="mint" size="sm">
                Mark Resolved
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

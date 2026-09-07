import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { StorageService } from '../../services/storage';
import { useApp } from '../../hooks/useApp';
import { formatCurrency, formatDateTime, formatTime } from '../../utils/formatters';
import { ORDER_STATUS_DETAILS } from '../../lib/constants';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Modal } from '../../components/ui/Modal';
import {
  ArrowLeft,
  ShieldCheck,
  Package,
  Navigation,
  Lock,
  Phone,
  Share2,
  Gauge,
  BatteryCharging,
  Scissors,
  Play,
  RotateCcw,
} from 'lucide-react';

export const OrderTrackingPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { showToast } = useApp();
  const [order, setOrder] = useState<any>(() => (orderId ? StorageService.getOrderById(orderId) : null));
  const [isLoading, setIsLoading] = useState(!order);

  React.useEffect(() => {
    if (!orderId) {
      setIsLoading(false);
      return;
    }
    import('../../services/api/orderService').then(({ orderService }) => {
      orderService.getOrderById(orderId)
        .then((fetched) => {
          if (fetched) {
            setOrder(fetched);
          }
        })
        .catch((err) => {
          console.error('Error loading order tracking:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    });
  }, [orderId]);

  // Interactive GPS Radar Simulation State
  const [riderProgress, setRiderProgress] = useState(0.45); // 0 (Hub) to 1 (Doorstep)
  const [callRiderModalOpen, setCallRiderModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-slate-900 border-t-transparent animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Connecting to GPS telemetry & tracking...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <Package className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-2xl font-bold font-display text-slate-900">Order Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested tracking reference '{orderId}' does not exist or has not synced yet.
        </p>
        <Link to="/dashboard">
          <Button variant="coral" size="sm">
            Go to My Orders
          </Button>
        </Link>
      </div>
    );
  }

  const statusInfo = (ORDER_STATUS_DETAILS as any)[order.status] || {
    label: order.status,
    description: '',
    color: 'text-mint',
  };

  // Compute dynamic telemetry based on simulated progress
  const totalDistanceKm = 4.2;
  const remainingDist = Math.max(0.2, Math.round((totalDistanceKm * (1 - riderProgress)) * 10) / 10);
  const remainingMinutes = Math.max(1, Math.round(remainingDist * 3.5));
  const currentSpeed = riderProgress >= 1 ? 0 : Math.round(24 + Math.sin(riderProgress * 10) * 8);

  const waypoints = [
    { label: 'Central Hub North #2', progress: 0 },
    { label: 'Intermediate Ring Rd Junction', progress: 0.3 },
    { label: 'Residency Rd Commercial Flyover', progress: 0.65 },
    { label: 'Prestige Lakeside Security Gate', progress: 0.95 },
    { label: 'Customer Doorstep (Flat 1202)', progress: 1 },
  ];

  const currentWaypoint = waypoints.reduce((prev, curr) =>
    riderProgress >= curr.progress ? curr : prev
  );

  const handleSimulateStep = () => {
    if (riderProgress >= 1) {
      setRiderProgress(0.15);
      showToast('GPS Radar Reset to Hub departure', 'info');
    } else {
      const nextP = Math.min(1, Math.round((riderProgress + 0.25) * 100) / 100);
      setRiderProgress(nextP);
      if (nextP >= 1) {
        showToast('Rider has arrived at customer doorstep!', 'success');
      } else {
        showToast(`Rider progressed closer (${remainingDist} km away)`, 'info');
      }
    }
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast('Live tracking link copied to clipboard!', 'success');
  };

  // Path coordinates for SVG curve: Hub (40, 160) -> (180, 50) -> (360, 170) -> Destination (520, 70)
  const pathD = "M 50 150 C 180 40, 360 220, 520 80";
  // Parametric approximate position along curve for rider marker
  const t = riderProgress;
  // Cubic Bezier interpolation
  const p0 = { x: 50, y: 150 };
  const p1 = { x: 180, y: 40 };
  const p2 = { x: 360, y: 220 };
  const p3 = { x: 520, y: 80 };
  const riderX = Math.pow(1 - t, 3) * p0.x + 3 * Math.pow(1 - t, 2) * t * p1.x + 3 * (1 - t) * Math.pow(t, 2) * p2.x + Math.pow(t, 3) * p3.x;
  const riderY = Math.pow(1 - t, 3) * p0.y + 3 * Math.pow(1 - t, 2) * t * p1.y + 3 * (1 - t) * Math.pow(t, 2) * p2.y + Math.pow(t, 3) * p3.y;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink/5">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-2 rounded-full hover:bg-white text-slate-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg text-ink">{order.id}</span>
              <Badge variant="mint" size="sm">{statusInfo.label}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Booked on {formatDateTime(order.created_at)}
            </p>
          </div>
        </div>

        {/* 4-digit PIN Highlight */}
        <div className="flex items-center gap-3 bg-coral-soft px-4 py-2.5 rounded-2xl border border-coral/30">
          <Lock className="w-4 h-4 text-coral" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-coral block">
              Doorstep Handover PIN
            </span>
            <span className="text-xl font-bold font-mono text-ink tracking-widest leading-none">
              {order.delivery_pin}
            </span>
          </div>
        </div>
      </div>

      {/* Hero Tracking Card */}
      <Card className="p-6 sm:p-8 border-ink/10 bg-white shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink/5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Order Status</span>
            <h2 className="text-2xl font-bold font-display text-ink mt-0.5">{statusInfo.label}</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">{statusInfo.description}</p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400">Estimated Handover</span>
            <div className="text-lg font-bold font-display text-mint-dark">{order.estimated_delivery}</div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <ProgressBar status={order.status} showDetails={false} />

        {/* INTERACTIVE ANIMATED GPS ROUTE RADAR */}
        <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-2xl relative overflow-hidden space-y-5">
          {/* Radar Top Info */}
          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-mint animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-mint flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" /> Live Radar GPS Telemetry
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSimulateStep}
                className="text-[11px] h-8 bg-white/10 text-white border-white/20 hover:bg-white/20 gap-1.5"
              >
                {riderProgress >= 1 ? <RotateCcw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {riderProgress >= 1 ? 'Restart GPS Loop' : 'Simulate Movement'}
              </Button>
              <button
                onClick={handleShareLink}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                title="Share Tracking Link"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SVG Animated Radar Canvas */}
          <div className="relative w-full h-56 bg-slate-950/60 rounded-2xl border border-white/10 p-2 overflow-hidden flex items-center justify-center">
            {/* Background Grid Pattern */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: 'radial-gradient(#00BFA6 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            <svg viewBox="0 0 580 220" className="w-full h-full max-h-52">
              {/* Route Background Shadow Path */}
              <path
                d={pathD}
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="8"
                strokeLinecap="round"
              />

              {/* Active Traveled Route Glow */}
              <path
                d={pathD}
                fill="none"
                stroke="#00BFA6"
                strokeWidth="4"
                strokeDasharray="6 4"
                className="animate-pulse"
                strokeLinecap="round"
              />

              {/* Start Hub Node */}
              <g transform="translate(50, 150)">
                <circle r="12" fill="#1E293B" stroke="#64748B" strokeWidth="2" />
                <circle r="5" fill="#38BDF8" />
                <text x="0" y="24" textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="bold">
                  Hub #02
                </text>
              </g>

              {/* Intermediate Waypoints */}
              <g transform="translate(240, 100)">
                <circle r="3" fill="#64748B" />
              </g>
              <g transform="translate(380, 160)">
                <circle r="3" fill="#64748B" />
              </g>

              {/* End Customer Destination Node */}
              <g transform="translate(520, 80)">
                <circle r="14" fill="#FF6B5B" fillOpacity="0.2" className="animate-ping" />
                <circle r="10" fill="#FF6B5B" stroke="#FFFFFF" strokeWidth="2" />
                <text x="0" y="24" textAnchor="middle" fill="#FF6B5B" fontSize="10" fontWeight="bold">
                  Doorstep
                </text>
              </g>

              {/* Animated Rider Marker */}
              <g transform={`translate(${riderX}, ${riderY})`}>
                <circle r="16" fill="#00BFA6" fillOpacity="0.25" className="animate-ping" />
                <circle r="9" fill="#00BFA6" stroke="#FFFFFF" strokeWidth="2" />
                <text x="0" y="-14" textAnchor="middle" fill="#00BFA6" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  Rider
                </text>
              </g>
            </svg>

            {/* Current Landmark Overlay HUD */}
            <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[11px] flex items-center gap-2">
              <Navigation className="w-3 h-3 text-mint" />
              <span>Current Sector: <strong>{currentWaypoint.label}</strong></span>
            </div>
          </div>

          {/* Telemetry Metrics HUD Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Distance Away</span>
              <div className="text-base font-bold font-mono text-mint">
                {riderProgress >= 1 ? 'At Doorstep' : `${remainingDist} km`}
              </div>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Live ETA</span>
              <div className="text-base font-bold font-mono text-white">
                {riderProgress >= 1 ? 'Arrived!' : `~${remainingMinutes} mins`}
              </div>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Gauge className="w-3 h-3 text-blue-400" /> Speed
              </span>
              <div className="text-base font-bold font-mono text-white">
                {currentSpeed} km/h
              </div>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <BatteryCharging className="w-3 h-3 text-emerald-400" /> Vehicle Status
              </span>
              <div className="text-base font-bold font-mono text-emerald-400">
                EV-Bike • 84%
              </div>
            </div>
          </div>

          {/* Driver Contact Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-mint text-ink font-bold flex items-center justify-center">
                {order.status.includes('DELIVERY') ? 'A' : 'V'}
              </div>
              <div>
                <div className="font-bold text-white">
                  {order.status.includes('DELIVERY')
                    ? order.delivery_staff_name || 'Amit Kumar (Courier #08)'
                    : order.pickup_staff_name || 'Vikram Singh (Rider #14)'}
                </div>
                <div className="text-slate-400 text-[11px]">Vaccinated • Calibrated Digital Scale on board</div>
              </div>
            </div>

            <Button
              variant="coral"
              size="sm"
              onClick={() => setCallRiderModalOpen(true)}
              className="gap-1.5 text-xs w-full sm:w-auto"
            >
              <Phone className="w-3.5 h-3.5" />
              Call Courier
            </Button>
          </div>
        </div>
      </Card>

      {/* Grid: Audit Timeline & Order Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Timeline Log */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-ink/5 shadow-card space-y-6">
          <h3 className="text-lg font-bold font-display text-ink pb-3 border-b border-ink/5">
            Audit Activity Timeline
          </h3>

          <div className="space-y-6 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {(order.history || []).map((hist: any, idx: number) => {
              const isLatest = idx === (order.history?.length || 0) - 1;
              return (
                <div key={hist.id} className="relative flex items-start gap-4 pl-8">
                  <div
                    className={`absolute left-1.5 top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                      isLatest ? 'border-mint bg-mint ring-4 ring-mint/20' : 'border-slate-300'
                    }`}
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink">{hist.status.replace(/_/g, ' ')}</span>
                      <span className="text-slate-400">{formatTime(hist.timestamp)}</span>
                    </div>
                    {hist.note && <p className="text-xs text-slate-600">{hist.note}</p>}
                    {hist.actor && (
                      <span className="text-[10px] text-slate-400 block">Logged by: {hist.actor}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Details & Summary */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-6 border-ink/10 bg-white shadow-card space-y-4">
            <h4 className="text-base font-bold font-display text-ink pb-3 border-b border-ink/5">
              Garment Package Details
            </h4>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Service Category:</span>
                <strong className="text-ink">{order.items[0]?.service_name}</strong>
              </div>
              <div className="flex justify-between">
                <span>Digital Bag Tag:</span>
                <strong className="font-mono text-ink">{order.bag_id || 'Sealed at pickup'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Measured Scale Weight:</span>
                <strong className="text-ink">
                  {order.measured_weight_kg ? `${order.measured_weight_kg} kg` : `${order.items[0]?.weight} kg (Est.)`}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="uppercase font-bold text-mint-dark">{order.payment_method}</span>
              </div>
            </div>

            {/* Custom Alterations if present */}
            {order.alterations && order.alterations.length > 0 && (
              <div className="pt-3 border-t border-ink/5 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-coral" />
                  Tailoring &amp; Alterations Included:
                </div>
                {(order.alterations || []).map((alt: any) => (
                  <div key={alt.id} className="flex justify-between items-center text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                    <span>{alt.name} (x{alt.quantity})</span>
                    <strong className="font-mono text-ink">{formatCurrency(alt.price * alt.quantity)}</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-ink/5 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discounts:</span>
                  <span>-{formatCurrency(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-ink pt-2 border-t border-slate-100">
                <span>Total Bill:</span>
                <span className="text-mint-dark">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-ink/5 bg-slate-50 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-ink">
              <ShieldCheck className="w-4 h-4 text-mint" /> 7-Point Quality Guarantee
            </div>
            <p className="text-slate-500 leading-relaxed">
              Every item has passed our stain pre-treatment, fabric segregation, and low-heat lint-free drying inspection before release.
            </p>
          </Card>
        </div>
      </div>

      {/* CALL RIDER MODAL SIMULATOR */}
      <Modal
        isOpen={callRiderModalOpen}
        onClose={() => setCallRiderModalOpen(false)}
        title="Direct Courier Hotline"
        description="Encrypted connection to your doorstep courier"
      >
        <div className="text-center py-4 space-y-4 text-xs">
          <div className="w-16 h-16 rounded-full bg-mint-soft text-mint flex items-center justify-center mx-auto text-2xl font-bold animate-pulse">
            <Phone className="w-8 h-8" />
          </div>
          <div>
            <div className="text-base font-bold font-display text-ink">
              {order.status.includes('DELIVERY')
                ? order.delivery_staff_name || 'Amit Kumar'
                : order.pickup_staff_name || 'Vikram Singh'}
            </div>
            <div className="text-slate-400 mt-0.5">Assigned Logistics Partner (EV-Fleet)</div>
            <div className="font-mono font-bold text-lg text-ink mt-2">+91 98765 43210</div>
          </div>
          <p className="text-slate-500 text-[11px] max-w-xs mx-auto">
            Doorstep note: Courier is carrying the electronic weigh scale and pre-printed garment tags.
          </p>
          <div className="pt-3">
            <Button
              variant="coral"
              size="md"
              onClick={() => {
                showToast('Connecting masked voice call to courier...', 'info');
                setCallRiderModalOpen(false);
              }}
              className="w-full"
            >
              Simulate Voice Call
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

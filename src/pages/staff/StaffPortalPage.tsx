import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { formatCurrency, generateBagId } from '../../utils/formatters';
import type { Order, LaundryStage, QualityCheck } from '../../types';
import { LAUNDRY_STAGES_ORDER, LAUNDRY_STAGE_NAMES } from '../../lib/constants';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  Truck,
  Sparkles,
  ShieldCheck,
  Scale,
  QrCode,
  CheckCircle,
  MapPin,
  Phone,
  ArrowRight,
  KeyRound,
} from 'lucide-react';

type StaffTab = 'pickup' | 'facility' | 'delivery';

// Maps each staff role to the tabs it is permitted to view/work.
const ROLE_TABS: Record<'pickup_staff' | 'laundry_staff' | 'delivery_staff', StaffTab[]> = {
  pickup_staff: ['pickup'],
  laundry_staff: ['facility'],
  delivery_staff: ['delivery'],
};

export const StaffPortalPage: React.FC = () => {
  const { showToast, currentRole, currentUser } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Determine which tabs this staff role is allowed to see.
  const staffRole = currentUser?.role ?? currentRole;
  const allowedTabs: StaffTab[] =
    staffRole === 'pickup_staff' || staffRole === 'laundry_staff' || staffRole === 'delivery_staff'
      ? ROLE_TABS[staffRole]
      : [];

  const [activeStaffTab, setActiveStaffTab] = useState<StaffTab>(allowedTabs[0] ?? 'pickup');

  // Pickup Handover Modal State
  const [pickupModalOrder, setPickupModalOrder] = useState<Order | null>(null);
  const [bagTagId, setBagTagId] = useState('');
  const [scaleWeight, setScaleWeight] = useState(4.5);

  // Quality Check Modal State
  const [qcModalOrder, setQcModalOrder] = useState<Order | null>(null);
  const [qcForm, setQcForm] = useState<QualityCheck>({
    stain_removal: true,
    collar_cuff: true,
    fabric_softness: true,
    fragrance: true,
    folding_neatness: true,
    eco_packaging: true,
    damage_detected: false,
    damage_notes: '',
    inspector_name: 'Sunita Patel (Lead)',
    inspected_at: new Date().toISOString(),
    passed: true,
  });

  // Delivery Verification Modal State
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<Order | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { orderService } = await import('../../services/api/orderService');
      const allOrders = await orderService.getAllOrders();
      setOrders(allOrders);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  // If the effective role changes (e.g. demo persona switch), reset the active
  // tab to the first tab this role is allowed to view.
  React.useEffect(() => {
    if (!allowedTabs.includes(activeStaffTab)) {
      setActiveStaffTab(allowedTabs[0] ?? 'pickup');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffRole]);

  // Orders filtered by staff department
  const pickupQueue = orders.filter((o) =>
    ['ORDER_PLACED', 'CONFIRMED', 'PICKUP_ASSIGNED', 'PICKUP_SCHEDULED', 'PICKUP_STARTED'].includes(o.status)
  );

  const facilityOrders = orders.filter((o) =>
    [
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
      'PICKED_UP',
    ].includes(o.status)
  );

  const deliveryQueue = orders.filter((o) =>
    ['READY_FOR_DELIVERY', 'DELIVERY_ASSIGNED', 'OUT_FOR_DELIVERY'].includes(o.status)
  );

  // Open Pickup Modal
  const handleOpenPickupModal = (order: Order) => {
    setPickupModalOrder(order);
    setBagTagId(generateBagId());
    setScaleWeight(order.items[0]?.weight || 4.5);
  };

  // Complete Pickup Handover
  const handleConfirmPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupModalOrder) return;

    try {
      const { orderService } = await import('../../services/api/orderService');
      await orderService.recordPickup(pickupModalOrder.id, bagTagId, scaleWeight);
      // Auto-advance to facility intake for smooth testing
      await orderService.updateOrderStatus(
        pickupModalOrder.id,
        'RECEIVED_AT_FACILITY',
        `Transferred to central facility hub in sealed bag ${bagTagId}`
      );

      await loadData();
      setPickupModalOrder(null);
      showToast(`Order ${pickupModalOrder.id} picked up & checked in at facility!`, 'success');
    } catch {
      showToast('Failed to confirm pickup', 'error');
    }
  };

  // Advance Facility Stage
  const handleAdvanceStage = async (orderId: string, currentStage?: LaundryStage) => {
    // Orders can carry a stage value that isn't part of the canonical
    // progression (e.g. a DB row holding 'IRONING'/'FOLDING'/'PROCESSING').
    // indexOf() returns -1 for those and `-1 < length - 1` is true, so the old
    // code sent LAUNDRY_STAGES_ORDER[0] and silently rewound the order to
    // RECEIVED. Bail out instead of corrupting state.
    const resolvedStage = currentStage ?? 'RECEIVED';
    const currentIndex = LAUNDRY_STAGES_ORDER.indexOf(resolvedStage);
    if (currentIndex === -1) {
      showToast(`Cannot advance order: unrecognised stage "${currentStage}"`, 'error');
      return;
    }
    if (currentIndex >= LAUNDRY_STAGES_ORDER.length - 1) {
      showToast('Order is already at the final facility stage', 'info');
      return;
    }

    const nextStage = LAUNDRY_STAGES_ORDER[currentIndex + 1];
    try {
      const { orderService } = await import('../../services/api/orderService');
      await orderService.advanceLaundryStage(orderId, nextStage);
      await loadData();
      showToast(`Order advanced to stage: ${nextStage}`, 'success');
    } catch {
      showToast('Failed to advance stage', 'error');
    }
  };

  // Submit QC
  const handleSubmitQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcModalOrder) return;

    try {
      const { orderService } = await import('../../services/api/orderService');
      await orderService.submitQualityCheck(qcModalOrder.id, {
        ...qcForm,
        passed: !qcForm.damage_detected,
        inspected_at: new Date().toISOString(),
      } as unknown as Record<string, unknown>, !qcForm.damage_detected);

      await loadData();
      setQcModalOrder(null);
      showToast(`Quality inspection certified for Order ${qcModalOrder.id}!`, 'success');
    } catch {
      showToast('Failed to submit quality check', 'error');
    }
  };

  // Handle Delivery Verification PIN
  const handleVerifyDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalOrder) return;

    try {
      const { orderService } = await import('../../services/api/orderService');
      const res = await orderService.verifyDeliveryPin(deliveryModalOrder.id, enteredPin);
      if (res.ok) {
        await loadData();
        setDeliveryModalOrder(null);
        setEnteredPin('');
        setPinError('');
        showToast(`Handover Verified! Order ${deliveryModalOrder.id} marked DELIVERED.`, 'success');
      } else {
        setPinError(res.message || 'Invalid PIN');
      }
    } catch {
      setPinError('Failed to verify PIN');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-ink dark:border-cream border-t-transparent animate-spin" />
      </div>
    );
  }

  if (allowedTabs.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full p-8 text-center space-y-3">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900">Staff access required</h2>
          <p className="text-sm text-slate-500">
            This portal is limited to pickup, facility, and delivery staff accounts.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-ink text-cream shadow-xl">
        <div className="space-y-1">
          <Badge variant="blue" size="sm">Operational Staff Tower</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-cream mt-1">
            Staff Fulfillment & Processing Hub
          </h1>
          <p className="text-xs sm:text-sm text-cream/60">
            Field agent pickup verification, 7-stage facility processing, and doorstep PIN handover.
          </p>
        </div>

        {/* Quick Department Switcher */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-xs">
          {allowedTabs.includes('pickup') && (
            <button
              onClick={() => setActiveStaffTab('pickup')}
              className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                activeStaffTab === 'pickup' ? 'bg-mint text-ink shadow-sm' : 'text-cream/70 hover:text-cream'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Pickup ({pickupQueue.length})</span>
            </button>
          )}
          {allowedTabs.includes('facility') && (
            <button
              onClick={() => setActiveStaffTab('facility')}
              className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                activeStaffTab === 'facility' ? 'bg-mint text-ink shadow-sm' : 'text-cream/70 hover:text-cream'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Facility ({facilityOrders.length})</span>
            </button>
          )}
          {allowedTabs.includes('delivery') && (
            <button
              onClick={() => setActiveStaffTab('delivery')}
              className={`px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                activeStaffTab === 'delivery' ? 'bg-mint text-ink shadow-sm' : 'text-cream/70 hover:text-cream'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Delivery ({deliveryQueue.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* DEPARTMENT 1: FIELD PICKUP QUEUE */}
      {activeStaffTab === 'pickup' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold font-display text-foreground">Scheduled Pickup Assignments</h3>
              <p className="text-xs text-slate-500">Arrive with calibrated scale and digital tamper-proof bag tags.</p>
            </div>
            <Badge variant="blue">{pickupQueue.length} Pending Pickups</Badge>
          </div>

          {pickupQueue.length === 0 ? (
            <Card className="p-12 text-center text-slate-400 space-y-2">
              <CheckCircle className="w-10 h-10 text-mint mx-auto" />
              <div className="font-bold text-foreground">All pickups completed!</div>
              <p className="text-xs text-slate-500">No scheduled pickups waiting in the field queue.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pickupQueue.map((order) => (
                <Card key={order.id} className="p-6 border-slate-200/70 space-y-4 hover:shadow-card-hover">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">{order.id}</span>
                        <Badge variant="blue" size="sm">{order.status.replace(/_/g, ' ')}</Badge>
                      </div>
                      <h4 className="font-bold text-base font-display text-foreground mt-1">
                        {order.customer_name}
                      </h4>
                    </div>
                    <span className="text-xs font-semibold text-mint-dark bg-mint-soft px-3 py-1 rounded-full">
                      Slot: {order.pickup_slot_time}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>{order.address.address_line}, {order.address.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>{order.customer_phone}</span>
                    </div>
                    {order.notes && (
                      <div className="text-amber-800 font-medium">
                        <strong>Note:</strong> {order.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs pt-2">
                    <span className="text-slate-500">Service: {order.items[0]?.service_name}</span>
                    <span className="font-mono font-bold text-foreground">{order.items[0]?.weight ?? '—'} kg (Est.)</span>
                  </div>

                  <Button
                    onClick={() => handleOpenPickupModal(order)}
                    variant="coral"
                    size="sm"
                    className="w-full gap-2 text-xs font-bold"
                  >
                    <Scale className="w-4 h-4" />
                    Record Weight & Confirm Pickup
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DEPARTMENT 2: IN-FACILITY PROCESSING KANBAN */}
      {activeStaffTab === 'facility' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold font-display text-foreground">7-Stage Laundry Pipeline</h3>
              <p className="text-xs text-slate-500">Track and advance garment batches through each specialized care cycle.</p>
            </div>
            <Badge variant="mint">Central Hub North #2</Badge>
          </div>

          {/* Kanban Board Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {LAUNDRY_STAGES_ORDER.map((stage) => {
              const stageInfo = LAUNDRY_STAGE_NAMES[stage];
              const stageOrders = facilityOrders.filter(
                (o) => (o.laundry_stage || 'RECEIVED') === stage
              );

              return (
                <div key={stage} className="bg-slate-100/70 p-4 rounded-3xl space-y-3 border border-slate-200/70">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold font-display text-foreground uppercase tracking-wide">
                        {stageInfo.title}
                      </span>
                    </div>
                    <span className="w-5 h-5 rounded-full bg-surface text-foreground text-[11px] font-bold flex items-center justify-center shadow-xs">
                      {stageOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3 min-h-[140px]">
                    {stageOrders.length === 0 ? (
                      <div className="text-center py-8 text-[11px] text-slate-400 font-medium">
                        No batches in this stage
                      </div>
                    ) : (
                      stageOrders.map((order) => (
                        <div
                          key={order.id}
                          className="p-4 bg-surface rounded-2xl border border-slate-200/70 shadow-xs space-y-2.5"
                        >
                          <div className="flex justify-between items-start text-xs">
                            <span className="font-mono font-bold text-foreground">{order.id}</span>
                            <span className="text-[10px] font-mono text-slate-400">{order.bag_id || 'BAG-SEALED'}</span>
                          </div>

                          <div className="text-xs text-slate-700 font-medium">
                            {order.items[0]?.service_name}
                          </div>

                          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>Weight: <strong>{order.measured_weight_kg ?? order.items[0]?.weight ?? '—'} kg</strong></span>
                            <span>{order.customer_name}</span>
                          </div>

                          {/* Stage Action */}
                          {stage === 'QUALITY_CHECK' ? (
                            <Button
                              onClick={() => {
                                setQcModalOrder(order);
                              }}
                              variant="mint"
                              size="sm"
                              className="w-full text-xs font-semibold py-1 h-8 mt-1 gap-1"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Inspect 7-Points
                            </Button>
                          ) : stage !== 'READY' ? (
                            <Button
                              onClick={() => handleAdvanceStage(order.id, order.laundry_stage)}
                              variant="secondary"
                              size="sm"
                              className="w-full text-xs font-semibold py-1 h-8 mt-1 gap-1 hover:border-mint"
                            >
                              Advance Stage
                              <ArrowRight className="w-3.5 h-3.5 text-mint" />
                            </Button>
                          ) : (
                            <div className="text-[11px] font-bold text-emerald-600 text-center py-1 bg-emerald-50 rounded-xl border border-emerald-200">
                              Packed &amp; Ready for Delivery
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DEPARTMENT 3: DOORSTEP DELIVERY & PIN VERIFICATION */}
      {activeStaffTab === 'delivery' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold font-display text-foreground">Doorstep Delivery Handover</h3>
              <p className="text-xs text-slate-500">
                Confirm delivery by asking the customer for their unique 4-digit PIN displayed on their app.
              </p>
            </div>
            <Badge variant="coral">{deliveryQueue.length} Deliveries Pending</Badge>
          </div>

          {deliveryQueue.length === 0 ? (
            <Card className="p-12 text-center text-slate-400 space-y-2">
              <CheckCircle className="w-10 h-10 text-mint mx-auto" />
              <div className="font-bold text-foreground">Delivery queue is all clear!</div>
              <p className="text-xs text-slate-500">All outbound laundry packages have been handed over.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {deliveryQueue.map((order) => (
                <Card key={order.id} className="p-6 border-slate-200/70 space-y-4 hover:shadow-card-hover">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">{order.id}</span>
                        <Badge variant="coral" size="sm">{order.status.replace(/_/g, ' ')}</Badge>
                      </div>
                      <h4 className="font-bold text-base font-display text-foreground mt-1">
                        {order.customer_name}
                      </h4>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Total Bill</div>
                      <div className="text-sm font-bold font-display text-mint-dark">{formatCurrency(order.total_amount)}</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>{order.address.address_line}, {order.address.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>{order.customer_phone}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200/50">
                      <span>Bag Identifier: <strong className="font-mono text-foreground">{order.bag_id || 'BAG-8824'}</strong></span>
                      <span>Mode: <strong className="uppercase">{order.payment_method}</strong></span>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setDeliveryModalOrder(order);
                      setEnteredPin('');
                      setPinError('');
                    }}
                    variant="coral"
                    size="sm"
                    className="w-full gap-2 text-xs font-bold"
                  >
                    <KeyRound className="w-4 h-4" />
                    Verify Customer 4-Digit PIN Handover
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: PICKUP WEIGH-SCALE HANDOVER */}
      <Modal
        isOpen={Boolean(pickupModalOrder)}
        onClose={() => setPickupModalOrder(null)}
        title="Field Pickup Verification"
        description="Weigh garments on digital scale and seal in tamper-proof bag."
      >
        {pickupModalOrder && (
          <form onSubmit={handleConfirmPickup} className="space-y-5">
            <div className="p-4 bg-slate-50 rounded-2xl text-xs space-y-2">
              <div className="flex justify-between">
                <span>Customer:</span>
                <strong>{pickupModalOrder.customer_name}</strong>
              </div>
              <div className="flex justify-between">
                <span>Address:</span>
                <span className="truncate max-w-[200px]">{pickupModalOrder.address.address_line}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Digital Bag Tag Identifier
              </label>
              <div className="relative">
                <QrCode className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={bagTagId}
                  onChange={(e) => setBagTagId(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300/80 font-mono text-sm uppercase tracking-wider outline-none focus:border-mint"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Measured Calibrated Weight (kg)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="30"
                  value={scaleWeight}
                  onChange={(e) => setScaleWeight(parseFloat(e.target.value) || 0)}
                  className="flex-1 h-11 px-4 rounded-xl border border-slate-300/80 text-lg font-bold font-mono outline-none focus:border-mint"
                  required
                />
                <span className="font-bold text-sm text-slate-500">kg</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Customer will be billed transparently according to this measured scale weight.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPickupModalOrder(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="coral" size="sm">
                Confirm Handover &amp; Check In
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 2: 7-POINT QUALITY CHECK INSPECTION */}
      <Modal
        isOpen={Boolean(qcModalOrder)}
        onClose={() => setQcModalOrder(null)}
        title="7-Point Quality Assurance Inspection"
        description="Inspect batch before releasing for final packaging and dispatch."
      >
        {qcModalOrder && (
          <form onSubmit={handleSubmitQc} className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Inspection Checklist:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                { key: 'stain_removal', label: '1. Stain Pre-treatment & Removal' },
                { key: 'collar_cuff', label: '2. Collar & Cuff Crispness' },
                { key: 'fabric_softness', label: '3. Fabric Softness Guarantee' },
                { key: 'fragrance', label: '4. Hypoallergenic Fresh Fragrance' },
                { key: 'folding_neatness', label: '5. Laser-Precise Folding' },
                { key: 'eco_packaging', label: '6. Anti-Dust Sealed Garment Wrap' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-surface hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={(qcForm as any)[item.key]}
                    onChange={(e) =>
                      setQcForm({
                        ...qcForm,
                        [item.key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-mint rounded"
                  />
                  <span className="font-medium text-foreground">{item.label}</span>
                </label>
              ))}
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs space-y-2">
              <label className="flex items-center gap-2 text-amber-900 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={qcForm.damage_detected}
                  onChange={(e) => setQcForm({ ...qcForm, damage_detected: e.target.checked })}
                  className="w-4 h-4 accent-amber-600 rounded"
                />
                Flag Pre-existing Fabric Tear or Missing Button
              </label>

              {qcForm.damage_detected && (
                <textarea
                  rows={2}
                  placeholder="Describe damage found on garment to alert customer..."
                  value={qcForm.damage_notes}
                  onChange={(e) => setQcForm({ ...qcForm, damage_notes: e.target.value })}
                  className="w-full p-2 bg-surface rounded-lg border border-amber-300 text-xs outline-none"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setQcModalOrder(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="mint" size="sm">
                Pass &amp; Release for Delivery
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: DOORSTEP 4-DIGIT PIN VERIFICATION */}
      <Modal
        isOpen={Boolean(deliveryModalOrder)}
        onClose={() => setDeliveryModalOrder(null)}
        title="Doorstep PIN Verification"
        description={`Order #${deliveryModalOrder?.id} — Handover Verification`}
      >
        {deliveryModalOrder && (
          <form onSubmit={handleVerifyDelivery} className="space-y-5 text-center">
            <div className="p-4 bg-cream rounded-2xl border border-ink/5 space-y-1">
              <div className="text-xs text-slate-500">Recipient</div>
              <div className="text-base font-bold text-foreground">{deliveryModalOrder.customer_name}</div>
              <div className="text-xs text-slate-400">{deliveryModalOrder.address.address_line}</div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Enter 4-Digit Customer PIN
              </label>
              <input
                type="text"
                maxLength={4}
                autoFocus
                placeholder="• • • •"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                className="w-48 h-14 mx-auto text-center text-3xl font-bold font-mono tracking-widest rounded-2xl border-2 border-slate-300 focus:border-mint focus:ring-4 focus:ring-mint/15 outline-none text-foreground"
                required
              />
              <p className="text-[11px] text-slate-400">
                The customer sees this PIN on their dashboard. Only verify when the customer shares it.
              </p>
            </div>

            {pinError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-semibold">
                {pinError}
              </div>
            )}

            <div className="flex justify-center gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDeliveryModalOrder(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="coral" size="md">
                Verify PIN &amp; Complete Handover
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

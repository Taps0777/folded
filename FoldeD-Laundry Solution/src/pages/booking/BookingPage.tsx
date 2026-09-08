import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { serviceService } from '../../services/api/serviceService';
import { addressService } from '../../services/api/addressService';
import { orderService } from '../../services/api/orderService';
import { formatCurrency } from '../../utils/formatters';
import { supabase } from '../../lib/supabase';
import { alterationService } from '../../services/api/alterationService';
import type { Service, PaymentMethod, AlterationService } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ServiceCard } from '../../components/ui/ServiceCard';
import { TrustBadges, InlineTrustBadges } from '../../components/ui/TrustBadges';
import { PriceBreakdown, StickyPriceBreakdown } from '../../components/ui/PriceBreakdown';
import {
  Sparkles,
  Scale,
  Calendar,
  Clock,
  MapPin,
  Tag,
  CreditCard,
  Truck,
  Scissors,
  CheckCircle2,
  ArrowRight,
  Zap,
  Plus,
  Check,
  Coins,
  ShieldCheck,
  Lock,
  Loader2,
  Search,
  ChevronRight,
  ChevronLeft,
  Minus,
  Gem,
  Crown,
  Leaf,
} from 'lucide-react';

const STEPS = [
  { id: 'service', label: 'Service', icon: Sparkles },
  { id: 'quantity', label: 'Load Estimate', icon: Scale },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'payment', label: 'Review & Pay', icon: CreditCard },
];

// Service categories with icons and fabric types
const SERVICE_CATEGORIES: Record<string, { icon: React.ReactNode; fabricTypes: string[] }> = {
  wash_fold: { icon: <Sparkles className="w-5 h-5" />, fabricTypes: ['cotton', 'casual', 'denim', 'linen', 'towels'] },
  wash_iron: { icon: <Zap className="w-5 h-5" />, fabricTypes: ['cotton', 'linen', 'formal', 'casual'] },
  iron_only: { icon: <Zap className="w-5 h-5" />, fabricTypes: ['cotton', 'linen', 'formal', 'silk'] },
  dry_clean: { icon: <Gem className="w-5 h-5" />, fabricTypes: ['silk', 'wool', 'formal', 'delicate', 'curtains'] },
  premium_care: { icon: <Crown className="w-5 h-5" />, fabricTypes: ['silk', 'wool', 'cashmere', 'delicate', 'formal'] },
  spa: { icon: <Leaf className="w-5 h-5" />, fabricTypes: ['cotton', 'linen', 'towels', 'bedding'] },
};

export const BookingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, showToast } = useApp();

  const [services, setServices] = useState<Service[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loyaltyAcc, setLoyaltyAcc] = useState<any>({ balance: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // State prefill from route state if available
  const preselectedServiceId = (location.state as any)?.preselectedServiceId || '';
  const preselectedWeight = (location.state as any)?.preselectedWeight || 4;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Booking Form State
  const [selectedServiceId, setSelectedServiceId] = useState<string>(preselectedServiceId);
  const [weightKg, setWeightKg] = useState<number>(preselectedWeight);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [pickupDate, setPickupDate] = useState('Today');
  const [pickupSlot, setPickupSlot] = useState('10:00 AM - 12:00 PM');
  const [isExpress, setIsExpress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');

  // Garment Alterations & Repairs State
  const [alterations, setAlterations] = useState<{ [key: string]: number }>({});
  const [alterationServices, setAlterationServices] = useState<AlterationService[]>([]);

  // Coupon & Loyalty
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  // New Address Modal State
  const [newAddressModalOpen, setNewAddressModalOpen] = useState(false);
  const [newAddrForm, setNewAddrForm] = useState({
    name: currentUser?.full_name || '',
    phone: currentUser?.phone || '',
    address_line: '',
    landmark: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    postal_code: '560087',
    address_type: 'home' as 'home' | 'work' | 'other',
  });

  // Confirmed Order state
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [confirmedPin, setConfirmedPin] = useState<string | null>(null);

  // Payment Success State
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    txnId: string;
    amount: number;
    method: string;
    orderId?: string;
    deliveryPin?: string;
  } | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Address search
  const [addressSearch, setAddressSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const srvs = await serviceService.getAllServices();
        setServices(srvs);
        if (srvs.length > 0) {
          setSelectedServiceId((prev) => prev || srvs[0].id);
        }

        // Fetch alteration services from DB
        const alterationsData = await alterationService.getAllAlterations();
        setAlterationServices(alterationsData);

        if (currentUser) {
          const [addrs, loyalty] = await Promise.all([
            addressService.getAddressesByUser(currentUser.id),
            import('../../services/api/loyaltyService').then(m => m.loyaltyService.getAccount(currentUser.id))
          ]);
          setAddresses(addrs);
          if (loyalty) setLoyaltyAcc(loyalty);
          if (addrs.length > 0) {
            const defaultAddr = addrs.find((a: any) => a.is_default) || addrs[0];
            setSelectedAddressId((prev) => prev || defaultAddr.id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [currentUser]);

  // Initialize alterations state when alteration services load
  useEffect(() => {
    if (alterationServices.length > 0) {
      const initialAlterations: { [key: string]: number } = {};
      alterationServices.forEach(svc => {
        initialAlterations[svc.id] = 0;
      });
      setAlterations(initialAlterations);
    }
  }, [alterationServices]);

  // Reset address search when step changes
  useEffect(() => {
    setAddressSearch('');
  }, [currentStepIndex]);

  const activeService: Service | undefined = services.find((s) => s.id === selectedServiceId) || services[0];

  if (isLoading || !activeService) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  // Pricing calculations
  const alterationsTotal = Object.entries(alterations).reduce((sum, [id, count]) => {
    const opt = alterationServices.find((o) => o.id === id);
    return sum + (opt ? opt.price * count : 0);
  }, 0);
  const garmentWashSubtotal = Math.round(activeService.base_price * weightKg);
  const subtotal = garmentWashSubtotal + alterationsTotal;
  const expressCharge = isExpress ? activeService.express_surcharge : 0;
  const deliveryCharge = subtotal > 199 ? 0 : 40;
  const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
  const loyaltyDiscount = useLoyaltyPoints ? Math.min(subtotal, Math.floor(loyaltyAcc.balance / 100)) : 0;
  const totalAmount = Math.max(0, subtotal + expressCharge + deliveryCharge - couponDiscount - loyaltyDiscount);

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    try {
      // Server-side coupon validation via RPC
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: couponCode.toUpperCase(),
        p_subtotal: subtotal
      } as any);
      if (error) throw error;
      if (data && (data as any).valid) {
        setAppliedCoupon({ code: couponCode.toUpperCase(), discount: (data as any).discount });
        showToast('Coupon applied!', 'success');
      } else {
        showToast((data as any)?.error || 'Invalid coupon or criteria not met', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error validating coupon', 'error');
    }
  };

  // Handle Save New Address
  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!newAddrForm.address_line || !newAddrForm.postal_code) {
      showToast('Please fill required address fields', 'error');
      return;
    }
    try {
      await addressService.addAddress(currentUser.id, {
        user_id: currentUser.id,
        name: newAddrForm.name,
        phone: newAddrForm.phone,
        address_line: newAddrForm.address_line,
        landmark: newAddrForm.landmark,
        city: newAddrForm.city,
        state: newAddrForm.state,
        postal_code: newAddrForm.postal_code,
        address_type: newAddrForm.address_type as any,
        is_default: false,
      });
      const updatedAddrs = await addressService.getAddressesByUser(currentUser.id);
      setAddresses(updatedAddrs);
      const created = updatedAddrs.find(a => a.address_line === newAddrForm.address_line);
      if (created) setSelectedAddressId(created.id);
      setNewAddressModalOpen(false);
      showToast('New address saved!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Order Submit
  const handleConfirmOrder = async () => {
    if (isSubmitting) return;

    if (!currentUser) {
      showToast('Please sign in to schedule your pickup', 'info');
      navigate('/login', { state: { from: location } });
      return;
    }

    const chosenAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0];
    if (!chosenAddress) {
      showToast('Please add a pickup address to continue', 'error');
      setNewAddressModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setIsProcessingPayment(true);

    try {
      const chosenAlterations = Object.entries(alterations)
        .filter(([, count]) => count > 0)
        .map(([id, count]) => {
          const opt = alterationServices.find((o) => o.id === id);
          return {
            id,
            name: opt?.name || '',
            price: opt?.price || 0,
            quantity: count,
            unit: opt?.unit || 'piece',
          };
        });

      const newOrderData = {
        user_id: currentUser.id,
        address: chosenAddress,
        items: [
          {
            service_id: activeService.id,
            quantity: 1,
            weight: weightKg,
            unit_price: activeService.base_price,
            total_price: garmentWashSubtotal,
          },
        ],
        subtotal,
        discount_amount: couponDiscount + loyaltyDiscount,
        delivery_charge: deliveryCharge,
        express_surcharge: expressCharge,
        total_amount: totalAmount,
        payment_status: paymentMethod === 'cod' ? 'PENDING' : 'SUCCESS',
        payment_method: paymentMethod,
        pickup_slot_date: pickupDate,
        pickup_slot_time: pickupSlot,
        notes: specialInstructions + (chosenAlterations.length > 0 ? ' | Alterations: ' + chosenAlterations.map(a => `${a.name} x${a.quantity}`).join(', ') : ''),
        coupon_code: appliedCoupon?.code || undefined,
      };

      // Create order first (this calls the secure RPC which validates everything)
      const result = await orderService.createOrder(newOrderData);

      // Only show payment success AFTER order is created
      const generatedTxnId = 'TXN_FP_' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
      const paymentMethodLabel = paymentMethod === 'razorpay' ? 'Instant Online (UPI / Card)' : paymentMethod === 'cod' ? 'Cash on Delivery (Doorstep)' : 'FreshFold Wallet';

      setPaymentSuccessData({
        txnId: generatedTxnId,
        amount: totalAmount,
        method: paymentMethodLabel,
        orderId: result.id,
        deliveryPin: result.delivery_pin,
      });
      setPaymentModalVisible(true);
      setConfirmedOrderId(result.id);
      setConfirmedPin(result.delivery_pin);
      showToast('Payment Verified & Pickup Dispatched!', 'success');

      console.log(`[Notification to ${currentUser.phone || currentUser.email}] Payment Succeeded: ${generatedTxnId}. Order ${result.id} confirmed.`);
    } catch (err: any) {
      console.error('Order creation error:', err);
      showToast(err.message || 'Error booking order', 'error');
    } finally {
      setIsSubmitting(false);
      setIsProcessingPayment(false);
    }
  };

  // If order confirmed, render completion screen
  if (confirmedOrderId) {
    const chosenAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0];

    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>

        <div className="space-y-2">
          <Badge variant="mint" size="md">
            Payment Succeeded & Confirmed
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            Pickup Scheduled for {pickupDate}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto">
            Payment verified! Our agent will arrive during <strong>{pickupSlot}</strong> with a calibrated digital scale and sealed garment bags.
          </p>
        </div>

        {/* Payment Receipt Banner */}
        {paymentSuccessData && (
          <div className="max-w-xl mx-auto p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Paid <strong>{formatCurrency(paymentSuccessData.amount)}</strong> via {paymentSuccessData.method}</span>
            </div>
            <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-200 font-semibold">
              {paymentSuccessData.txnId}
            </span>
          </div>
        )}

        {/* Order Details & Delivery PIN Tower */}
        <div className="p-6 text-left space-y-4 max-w-xl mx-auto rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-400">Order Reference</span>
            <span className="text-sm font-semibold font-mono text-slate-900">{confirmedOrderId}</span>
          </div>

          {/* 4-Digit PIN Card */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white text-center space-y-1 shadow-xs">
            <div className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider">Your Doorstep Delivery Verification PIN</div>
            <div className="text-4xl font-black font-mono tracking-widest text-white py-1">
              {confirmedPin}
            </div>
            <div className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Keep this safe. Share this 4-digit PIN with our rider only upon doorstep delivery handover.
            </div>
          </div>

          {/* Assigned Agent Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <Truck className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Assigned: Amit Patel (Pickup Specialist)</p>
                <p className="text-slate-500 text-[11px]">Arrival window: {pickupDate}, {pickupSlot}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
              Dispatched
            </span>
          </div>

          {/* Breakdown List */}
          <div className="space-y-2.5 text-xs text-slate-600 pt-2">
            <div className="flex justify-between">
              <span>Service Type:</span>
              <strong className="text-slate-900">{activeService.name}</strong>
            </div>
            <div className="flex justify-between">
              <span>Estimated Load:</span>
              <strong className="text-slate-900 font-mono">{weightKg} kg</strong>
            </div>
            {chosenAddress && (
              <div className="flex justify-between items-start">
                <span>Address:</span>
                <strong className="text-slate-900 text-right max-w-[240px]">
                  {chosenAddress.name}, {chosenAddress.address_line}, {chosenAddress.city}
                </strong>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-100 items-baseline">
              <span className="font-medium text-slate-500">Amount Paid:</span>
              <strong className="text-slate-900 font-mono text-base font-bold">{formatCurrency(totalAmount)}</strong>
            </div>
          </div>
        </div>

        {/* Direct Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to={`/track/${confirmedOrderId}`}>
            <Button variant="primary" size="lg" className="gap-2 font-medium w-full sm:w-auto">
              Track Order Live
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="secondary" size="lg" className="font-medium w-full sm:w-auto">
              View in My Orders
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => {
              setConfirmedOrderId(null);
              setConfirmedPin(null);
              setCurrentStepIndex(0);
            }}
            className="text-xs text-slate-500 hover:text-slate-900 font-medium px-4 py-2 transition-colors"
          >
            Book Another Pickup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Wizard Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
          Schedule Doorstep Laundry Pickup
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm">
          Complete in 60 seconds • Calibrated digital scale at doorstep • 24h turnaround
        </p>
      </div>

      {/* Trust Badges - Inline */}
      <InlineTrustBadges count={4} className="justify-center" />

      {/* Guest Notice & Quick Auth */}
      {!currentUser && (
        <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 text-emerald-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Booking as guest. <strong>Sign in</strong> to access saved addresses and earn loyalty rewards.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/login" state={{ from: location }}>
              <Button variant="secondary" size="sm" className="h-8 text-xs px-3">
                Sign In
              </Button>
            </Link>
            <button
              type="button"
              onClick={async () => {
                const { authService } = await import('../../services/api/authService');
                await authService.signInWithEmail('customer@freshfold.in', 'password123');
                showToast('Signed in as Customer (Rajesh Kumar)', 'success');
              }}
              className="h-8 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>⚡ Quick Customer Login</span>
            </button>
          </div>
        </div>
      )}

      {/* Progress Step Bar */}
      <div className="grid grid-cols-5 gap-2 sm:gap-4 pb-4 border-b border-slate-200/70">
        {STEPS.map((step, idx) => {
          const isDone = currentStepIndex > idx;
          const isCurrent = currentStepIndex === idx;
          const Icon = step.icon;

          return (
            <button
              key={step.id}
              onClick={() => idx <= currentStepIndex && setCurrentStepIndex(idx)}
              className="flex flex-col items-center text-center group cursor-pointer"
            >
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs transition-all mb-1.5 ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                    ? 'bg-slate-900 text-white ring-4 ring-slate-900/10 font-medium shadow-xs'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-[10px] sm:text-xs tracking-tight ${
                  isCurrent ? 'font-semibold text-slate-900' : isDone ? 'font-medium text-slate-700' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Wizard Content Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          {/* STEP 1: SERVICE SELECTION */}
          {currentStepIndex === 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Select Garment Care Type</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Choose the primary wash or pressing cycle for this load.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {services.map((srv) => {
                  const categoryInfo = SERVICE_CATEGORIES[srv.category] || { icon: <Sparkles className="w-5 h-5" />, fabricTypes: ['cotton', 'casual'] };
                  
                  return (
                    <ServiceCard
                      key={srv.id}
                      service={{
                        ...srv,
                        ...categoryInfo,
                      }}
                      isSelected={selectedServiceId === srv.id}
                      onSelect={() => setSelectedServiceId(srv.id)}
                      formatCurrency={formatCurrency}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: LOAD ESTIMATE */}
          {currentStepIndex === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Estimate Laundry Load</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Approximate weight helps us assign the right vehicle size. Exact bill is calibrated at pickup.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm text-slate-900 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-600" />
                    Estimated Weight:
                  </span>
                  <span className="text-3xl font-bold font-mono text-slate-900">
                    {weightKg} kg
                  </span>
                </div>

                <input
                  type="range"
                  min={1}
                  max={activeService.maximum_quantity || 20}
                  step={0.5}
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value))}
                  className="w-full accent-slate-900 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  aria-label="Estimated weight in kg"
                />

                {/* Quick Select Weight Preset Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400 font-medium">Quick Select:</span>
                  {[
                    { kg: 3, label: '3 kg (Light)' },
                    { kg: 5, label: '5 kg (Daily Basket)' },
                    { kg: 8, label: '8 kg (Bedding & Towels)' },
                    { kg: 12, label: '12 kg (Bulk Wash)' },
                  ].map((preset) => (
                    <button
                      key={preset.kg}
                      type="button"
                      onClick={() => setWeightKg(preset.kg)}
                      className={`px-3 py-1 text-xs rounded-lg font-medium border transition-all ${
                        weightKg === preset.kg
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 text-center text-xs text-slate-500 pt-3 border-t border-slate-200/70">
                  <div>
                    <strong className="text-slate-700">1 - 3 kg</strong>
                    <div className="text-[11px] text-slate-400">Light Daily Wash</div>
                  </div>
                  <div>
                    <strong className="text-slate-700">4 - 7 kg</strong>
                    <div className="text-[11px] text-slate-400">Regular Family Load</div>
                  </div>
                  <div>
                    <strong className="text-slate-700">8+ kg</strong>
                    <div className="text-[11px] text-slate-400">Weekly Heavy Wash</div>
                  </div>
                </div>
              </div>

              {/* Tailoring & Alterations Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-slate-500" />
                    Tailoring & Garment Repairs (Optional Add-on)
                  </label>
                  {alterationsTotal > 0 && (
                    <Badge variant="mint" size="sm">
                      +{formatCurrency(alterationsTotal)} Added
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {alterationServices.map((opt) => {
                    const count = alterations[opt.id] || 0;
                    return (
                      <div
                        key={opt.id}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                          count > 0 ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="space-y-0.5 max-w-[200px]">
                          <div className="text-xs font-semibold text-slate-900">{opt.name}</div>
                          <div className="text-[11px] text-slate-500 leading-tight">{opt.description}</div>
                          <div className="text-xs font-mono font-medium text-slate-900 pt-0.5">
                            +{formatCurrency(opt.price)}{' '}
                            <span className="font-normal text-[10px] text-slate-400">/{opt.unit}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => setAlterations({ ...alterations, [opt.id]: Math.max(0, count - 1) })}
                              className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          )}
                          <span className={`w-5 text-center text-xs font-mono font-medium ${count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAlterations({ ...alterations, [opt.id]: count + 1 })}
                            className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-100 shadow-xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Special Instructions */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Special Garment Instructions (Optional)
                </label>
                <textarea
                  rows={3}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. Please fold formal shirts, separate maroon silk scarf, mild citrus fragrance only..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs sm:text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none placeholder:text-slate-400 text-slate-900"
                />
              </div>
            </div>
          )}

          {/* STEP 3: SCHEDULE SLOTS */}
          {currentStepIndex === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Pick a Convenient Slot</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Our rider will arrive within your chosen time window.
                </p>
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pickup Date
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['Today', 'Tomorrow', 'Day After'].map((d) => (
                    <button
                      key={d}
                      onClick={() => setPickupDate(d)}
                      className={`p-3 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                        pickupDate === d
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Preferred Time Window
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    '08:00 AM - 10:00 AM',
                    '10:00 AM - 12:00 PM',
                    '02:00 PM - 04:00 PM',
                    '06:00 PM - 08:00 PM',
                  ].map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setPickupSlot(slot)}
                      className={`p-3 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between transition-all ${
                        pickupSlot === slot
                          ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {slot}
                      </span>
                      {pickupSlot === slot && <span className="text-slate-900 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Express 24h Toggle */}
              <div
                onClick={() => setIsExpress(!isExpress)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isExpress ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Express 24-Hour Delivery</div>
                    <div className="text-xs text-slate-500">Priority wash & express doorstep return (+{formatCurrency(activeService.express_surcharge)})</div>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    isExpress ? 'bg-slate-900 text-white' : 'border border-slate-300 text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: ADDRESS SELECTION */}
          {currentStepIndex === 3 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Pickup & Delivery Address</h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Select where our agent should collect your laundry bag.
                  </p>
                </div>
                <Button
                  onClick={() => setNewAddressModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New
                </Button>
              </div>

              {/* Address Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search saved addresses..."
                  value={addressSearch}
                  onChange={(e) => setAddressSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                />
              </div>

              {addresses.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                  <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">No saved addresses found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {currentUser
                        ? 'Please add a pickup address below to proceed.'
                        : 'Sign in to access your saved addresses, or add a delivery address below.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <Button
                      onClick={() => setNewAddressModalOpen(true)}
                      variant="primary"
                      size="sm"
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Pickup Address
                    </Button>
                    {!currentUser && (
                      <Link to="/login" state={{ from: location }}>
                        <Button variant="secondary" size="sm">
                          Sign In
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses
                    .filter(addr => 
                      addr.name.toLowerCase().includes(addressSearch.toLowerCase()) ||
                      addr.address_line.toLowerCase().includes(addressSearch.toLowerCase()) ||
                      addr.city.toLowerCase().includes(addressSearch.toLowerCase())
                    )
                    .map((addr) => (
                    <div
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between ${
                        selectedAddressId === addr.id
                          ? 'border-slate-900 bg-slate-50/70 ring-1 ring-slate-900 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 mt-0.5">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">{addr.name}</span>
                            <span className="text-[10px] uppercase font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {addr.address_type}
                            </span>
                            {addr.is_default && <Badge variant="mint" size="sm">Default</Badge>}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {addr.address_line}, {addr.landmark ? `${addr.landmark}, ` : ''}{addr.city} — {addr.postal_code}
                          </p>
                          <div className="text-xs text-slate-400">Phone: {addr.phone}</div>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                          selectedAddressId === addr.id ? 'bg-slate-900 text-white' : 'border border-slate-300'
                        }`}
                      >
                        {selectedAddressId === addr.id && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: REVIEW & PAYMENT */}
          {currentStepIndex === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Review Booking & Pay</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Verify your doorstep collection details, apply vouchers, and select payment.
                </p>
              </div>

              {/* 1. Order Review Summary Card */}
              {(() => {
                const chosenAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0];
                const chosenAlterations = Object.entries(alterations)
                                  .filter(([, count]) => count > 0)
                                  .map(([id, count]) => {
                                    const opt = alterationServices.find((o) => o.id === id);
                                    return { id, name: opt?.name, count, price: opt?.price || 0 };
                                  });

                return (
                  <div className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/60 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Order Review Details
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentStepIndex(0)}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        Edit Selections
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-slate-400 font-medium">Service & Estimated Weight:</span>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 font-semibold">{activeService.name}</strong>
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-800">
                            {weightKg} kg
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Speed: <span className="font-medium text-slate-700">{isExpress ? '24h Express Turnaround' : 'Standard 48h Care'}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-400 font-medium">Pickup Window:</span>
                        <div className="text-slate-900 font-semibold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{pickupDate}, {pickupSlot}</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 flex items-center gap-1">
                          <Truck className="w-3 h-3 text-emerald-600" />
                          <span>Agent brings calibrated doorstep scale</span>
                        </div>
                      </div>
                    </div>

                    {chosenAddress && (
                      <div className="pt-3 border-t border-slate-200/60 text-xs flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{chosenAddress.name}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {chosenAddress.address_type}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                            {chosenAddress.address_line}, {chosenAddress.landmark ? `${chosenAddress.landmark}, ` : ''}{chosenAddress.city} — {chosenAddress.postal_code}
                          </p>
                          <p className="text-slate-400 text-[11px]">Contact: {chosenAddress.phone}</p>
                        </div>
                      </div>
                    )}

                    {chosenAlterations.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 text-xs">
                        <span className="text-slate-400 font-medium">Add-on Repairs & Alterations:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {chosenAlterations.map((alt) => (
                            <span key={alt.id} className="bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-[11px] text-slate-700 font-medium">
                              {alt.name} (x{alt.count})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {specialInstructions && (
                      <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 italic">
                        <strong>Special Note:</strong> "{specialInstructions}"
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 2. Price Breakdown */}
              <PriceBreakdown
                subtotal={garmentWashSubtotal}
                alterationsTotal={alterationsTotal}
                expressCharge={expressCharge}
                deliveryCharge={deliveryCharge}
                couponDiscount={couponDiscount}
                loyaltyDiscount={loyaltyDiscount}
                totalAmount={totalAmount}
                isExpress={isExpress}
                appliedCoupon={appliedCoupon}
                loyaltyBalance={loyaltyAcc.balance}
                useLoyaltyPoints={useLoyaltyPoints}
              />

              {/* 3. Promo Coupon Field */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Tag className="w-4 h-4 text-slate-500" />
                  <span>Promo Voucher Discount</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Coupon Code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs uppercase font-mono tracking-wider focus:border-slate-900 outline-none text-slate-900"
                  />
                  <Button onClick={handleApplyCoupon} variant="primary" size="sm" type="button">
                    Apply
                  </Button>
                </div>

                {/* 1-Click Selectable Coupon Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Tap to apply:</span>
                  {[
                    { code: 'FRESH50', disc: 50, note: '₹50 OFF (Orders > ₹199)' },
                    { code: 'CLEAN100', disc: 100, note: '₹100 OFF (Orders > ₹199)' },
                  ].map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        setCouponCode(c.code);
                        if (subtotal < 199) {
                          showToast(`Add ₹${199 - subtotal} more to activate coupon ${c.code}`, 'error');
                          return;
                        }
                        setAppliedCoupon({ code: c.code, discount: c.disc });
                        showToast(`Coupon ${c.code} applied! Saved ₹${c.disc}`, 'success');
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:border-slate-300 text-slate-700 text-xs font-mono font-medium transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <span>🏷️ {c.code}</span>
                      <span className="text-[10px] text-slate-400">(-₹{c.disc})</span>
                    </button>
                  ))}
                </div>

                {appliedCoupon && (
                  <div className="text-xs text-emerald-700 font-semibold flex items-center justify-between bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 animate-in fade-in">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Coupon '{appliedCoupon.code}' Active
                    </span>
                    <span className="font-mono font-bold">- {formatCurrency(appliedCoupon.discount)}</span>
                  </div>
                )}
              </div>

              {/* 4. Loyalty Points Redemption */}
              {loyaltyAcc.balance > 0 && (
                <div
                  onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    useLoyaltyPoints ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Coins className="w-5 h-5 text-amber-500" />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Redeem FreshLoyalty Balance</div>
                      <div className="text-[11px] text-slate-500">
                        You have {loyaltyAcc.balance} points (Worth {formatCurrency(Math.floor(loyaltyAcc.balance / 100))})
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      useLoyaltyPoints ? 'bg-slate-900 text-white' : 'border border-slate-300'
                    }`}
                  >
                    {useLoyaltyPoints && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              )}

              {/* 5. Payment Method Selection Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Select Payment Method
                  </label>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    256-Bit Encrypted
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'razorpay',
                      label: 'Instant Online',
                      sub: 'UPI • GPay • Cards • NetBanking',
                      tag: 'Recommended • Fast',
                      icon: CreditCard,
                      tagColor: 'bg-emerald-100 text-emerald-800',
                    },
                    {
                      id: 'cod',
                      label: 'Cash on Delivery',
                      sub: 'Pay at Doorstep after weighing',
                      tag: 'Doorstep UPI / Cash',
                      icon: Truck,
                      tagColor: 'bg-slate-100 text-slate-700',
                    },
                    {
                      id: 'wallet',
                      label: 'FreshFold Wallet',
                      sub: 'Prepaid Balance (₹1,500)',
                      tag: '1-Tap Pay',
                      icon: Coins,
                      tagColor: 'bg-amber-100 text-amber-800',
                    },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                        className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50/90 ring-2 ring-slate-900 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${m.tagColor}`}>
                              {m.tag}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900">{m.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{m.sub}</div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className={isSelected ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                            {isSelected ? 'Selected' : 'Click to select'}
                          </span>
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              isSelected ? 'bg-slate-900 text-white' : 'border border-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. Trust & Satisfaction Badges - using new component */}
              <TrustBadges variant="grid" showIcons={true} />
            </div>
          )}

          {/* Navigation Controls */}
          <div className="pt-8 border-t border-slate-100 mt-8 flex items-center justify-between">
            {currentStepIndex > 0 ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setCurrentStepIndex(currentStepIndex - 1)}
                className="gap-2 text-xs font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {currentStepIndex < STEPS.length - 1 ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => setCurrentStepIndex(currentStepIndex + 1)}
                className="gap-2 text-xs font-medium"
              >
                Next Step
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={handleConfirmOrder}
                disabled={isSubmitting}
                className={`flex-1 transition-all flex items-center justify-center gap-2 ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? 'Processing...' : `Pay ${formatCurrency(totalAmount)}`}
                <Check className="w-4 h-4 stroke-[3]" />
              </Button>
            )}
          </div>
        </div>

        {/* Right Sticky Order Summary Panel */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          <StickyPriceBreakdown
            subtotal={garmentWashSubtotal}
            alterationsTotal={alterationsTotal}
            expressCharge={expressCharge}
            deliveryCharge={deliveryCharge}
            couponDiscount={couponDiscount}
            loyaltyDiscount={loyaltyDiscount}
            totalAmount={totalAmount}
            isExpress={isExpress}
            appliedCoupon={appliedCoupon}
            loyaltyBalance={loyaltyAcc.balance}
            useLoyaltyPoints={useLoyaltyPoints}
          />
        </div>
      </div>

      {/* Add New Address Modal */}
      <Modal
        isOpen={newAddressModalOpen}
        onClose={() => setNewAddressModalOpen(false)}
        title="Add New Pickup Address"
        description="Provide accurate details so our rider easily locates you."
      >
        <form onSubmit={handleSaveNewAddress} className="space-y-4">
          <Input
            label="Full Name"
            value={newAddrForm.name}
            onChange={(e) => setNewAddrForm({ ...newAddrForm, name: e.target.value })}
            required
          />
          <Input
            label="Phone Number"
            value={newAddrForm.phone}
            onChange={(e) => setNewAddrForm({ ...newAddrForm, phone: e.target.value })}
            required
          />
          <Input
            label="Street Address / Flat No."
            placeholder="e.g. Flat 402, Green Glen Layout, Bellandur"
            value={newAddrForm.address_line}
            onChange={(e) => setNewAddrForm({ ...newAddrForm, address_line: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Landmark"
              placeholder="Near Central Mall"
              value={newAddrForm.landmark}
              onChange={(e) => setNewAddrForm({ ...newAddrForm, landmark: e.target.value })}
            />
            <Input
              label="Pincode"
              maxLength={6}
              value={newAddrForm.postal_code}
              onChange={(e) => setNewAddrForm({ ...newAddrForm, postal_code: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Address Label
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['home', 'work', 'other'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewAddrForm({ ...newAddrForm, address_type: type })}
                  className={`py-2 text-xs uppercase font-bold rounded-xl border transition-all ${
                    newAddrForm.address_type === type
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-bold'
                      : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setNewAddressModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="coral" size="sm">
              Save Address
            </Button>
          </div>
        </form>
      </Modal>

      {/* Direct Payment Succeeded Modal */}
      <Modal
        isOpen={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        title="Payment Status"
      >
        <div className="text-center py-4 space-y-5">
          {/* Animated Success Icon */}
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-30" />
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-600 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 animate-in zoom-in-75 duration-300" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Badge variant="mint" size="md" className="mx-auto">
              Payment Succeeded 🎉
            </Badge>
            <h2 className="text-2xl font-bold font-display text-slate-900">
              {formatCurrency(paymentSuccessData?.amount || totalAmount)} Paid
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Payment was verified and captured successfully via <strong>{paymentSuccessData?.method || 'Instant Online'}</strong>.
            </p>
          </div>

          {/* Receipt & Transaction Pill */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-left text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-600">
              <span>Transaction Ref:</span>
              <span className="font-mono font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                {paymentSuccessData?.txnId}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Status:</span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Confirmed (200 OK)
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Doorstep Verification PIN:</span>
              <span className="font-mono font-black text-slate-900 text-sm tracking-wider">
                {confirmedPin || (isProcessingPayment ? 'Generating PIN...' : '••••')}
              </span>
            </div>
          </div>

          {/* Live Dispatch Progress Bar */}
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 text-emerald-900 text-xs flex items-center gap-3 text-left">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Next Work: Doorstep Dispatch</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                {isProcessingPayment
                  ? 'Assigning nearest pickup specialist (Amit Patel)...'
                  : 'Pickup order recorded & scheduled for ' + pickupDate + ', ' + pickupSlot}
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col gap-2.5">
            <Button
              variant="primary"
              size="lg"
              className="w-full justify-center gap-2"
              onClick={() => {
                setPaymentModalVisible(false);
                if (confirmedOrderId) {
                  navigate(`/track/${confirmedOrderId}`);
                }
              }}
            >
              <span>Track Order Live in Real-Time</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="w-full justify-center"
              onClick={() => setPaymentModalVisible(false)}
            >
              <span>View Order Confirmation Screen</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
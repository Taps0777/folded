import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { StorageService } from '../../services/storage';
import { formatCurrency } from '../../utils/formatters';
import type { Service, PaymentMethod } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
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
  ArrowLeft,
  Zap,
  Plus,
  Check,
  Coins,
  ShieldCheck,
} from 'lucide-react';

const STEPS = [
  { id: 'service', label: 'Service', icon: Sparkles },
  { id: 'quantity', label: 'Load Estimate', icon: Scale },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'payment', label: 'Review & Pay', icon: CreditCard },
];

const ALTERATION_OPTIONS = [
  { id: 'button', name: 'Button Replacement / Stitching', price: 30, unit: 'piece', desc: 'Secure loose or missing buttons' },
  { id: 'hemming', name: 'Pant / Trouser Length Hemming', price: 99, unit: 'pair', desc: 'Shorten or re-stitch pants length' },
  { id: 'zipper', name: 'Zipper Repair & Slider Replacement', price: 120, unit: 'garment', desc: 'Fix stuck or split zippers' },
  { id: 'debobble', name: 'Fabric De-Bobble & Lint Shave', price: 80, unit: 'piece', desc: 'Restore woolens & knits' },
  { id: 'seam', name: 'Seam Reinforce & Spot Mending', price: 60, unit: 'spot', desc: 'Mend pocket tears & split seams' },
];

export const BookingPage: React.FC = () => {
  const location = useLocation();
  const { currentUser, showToast } = useApp();

  const services = StorageService.getServices();
  const addresses = StorageService.getAddresses();
  const loyaltyAcc = StorageService.getLoyaltyAccount();

  // State prefill from route state if available
  const preselectedServiceId = (location.state as any)?.preselectedServiceId || services[0]?.id;
  const preselectedWeight = (location.state as any)?.preselectedWeight || 4;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Booking Form State
  const [selectedServiceId, setSelectedServiceId] = useState<string>(preselectedServiceId);
  const [weightKg, setWeightKg] = useState<number>(preselectedWeight);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [pickupDate, setPickupDate] = useState('Today');
  const [pickupSlot, setPickupSlot] = useState('10:00 AM - 12:00 PM');
  const [isExpress, setIsExpress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(addresses[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');

  // Garment Alterations & Repairs State
  const [alterations, setAlterations] = useState<{ [key: string]: number }>({
    button: 0,
    hemming: 0,
    zipper: 0,
    debobble: 0,
    seam: 0,
  });

  // Coupon & Loyalty
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  // New Address Modal State
  const [newAddressModalOpen, setNewAddressModalOpen] = useState(false);
  const [newAddrForm, setNewAddrForm] = useState({
    name: currentUser.full_name,
    phone: currentUser.phone,
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

  const activeService: Service = services.find((s) => s.id === selectedServiceId) || services[0];

  // Pricing calculations
  const alterationsTotal = Object.entries(alterations).reduce((sum, [id, count]) => {
    const opt = ALTERATION_OPTIONS.find((o) => o.id === id);
    return sum + (opt ? opt.price * count : 0);
  }, 0);
  const garmentWashSubtotal = Math.round(activeService.base_price * weightKg);
  const subtotal = garmentWashSubtotal + alterationsTotal;
  const expressCharge = isExpress ? activeService.express_surcharge : 0;
  const deliveryCharge = subtotal > 199 ? 0 : 40;
  const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
  const loyaltyDiscount = useLoyaltyPoints ? Math.min(subtotal, Math.floor(loyaltyAcc.balance / 100)) : 0;
  const totalAmount = Math.max(0, subtotal + expressCharge + deliveryCharge - couponDiscount - loyaltyDiscount);

  // Handle Coupon Apply
  const handleApplyCoupon = () => {
    if (!couponCode) return;
    const res = StorageService.validateCoupon(couponCode, subtotal);
    if (res.valid) {
      setAppliedCoupon({ code: couponCode.toUpperCase(), discount: res.discount });
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Handle Save New Address
  const handleSaveNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrForm.address_line || !newAddrForm.postal_code) {
      showToast('Please fill required address fields', 'error');
      return;
    }
    const created = StorageService.addAddress({
      user_id: currentUser.id,
      ...newAddrForm,
      is_default: false,
    });
    setSelectedAddressId(created.id);
    setNewAddressModalOpen(false);
    showToast('New address saved!', 'success');
  };

  // Handle Order Submit
  const handleConfirmOrder = () => {
    const chosenAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0];
    if (!chosenAddress) {
      showToast('Please choose or add a delivery address', 'error');
      return;
    }

    if (useLoyaltyPoints && loyaltyDiscount > 0) {
      StorageService.redeemLoyalty(loyaltyDiscount * 100);
    }

    const chosenAlterations = Object.entries(alterations)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => {
        const opt = ALTERATION_OPTIONS.find((o) => o.id === id)!;
        return {
          id,
          name: opt.name,
          price: opt.price,
          quantity: count,
          unit: opt.unit,
        };
      });

    const newOrder = StorageService.createOrder({
      user_id: currentUser.id,
      customer_name: chosenAddress.name || currentUser.full_name,
      customer_phone: chosenAddress.phone || currentUser.phone,
      address: chosenAddress,
      status: 'ORDER_PLACED',
      items: [
        {
          id: `item_1`,
          service_id: activeService.id,
          service_name: activeService.name,
          quantity: 1,
          weight: weightKg,
          unit_price: activeService.base_price,
          total_price: garmentWashSubtotal,
          special_instructions: specialInstructions || undefined,
        },
      ],
      alterations: chosenAlterations.length > 0 ? chosenAlterations : undefined,
      subtotal,
      discount_amount: couponDiscount + loyaltyDiscount,
      delivery_charge: deliveryCharge,
      express_surcharge: expressCharge,
      total_amount: totalAmount,
      payment_status: paymentMethod === 'cod' ? 'PENDING' : 'PAID',
      payment_method: paymentMethod,
      coupon_code: appliedCoupon?.code,
      loyalty_points_used: loyaltyDiscount * 100,
      loyalty_points_earned: Math.round(totalAmount * 0.1),
      pickup_slot_date: pickupDate,
      pickup_slot_time: pickupSlot,
      estimated_delivery: isExpress ? 'Tomorrow (Within 24h)' : 'In 48 Hours',
      notes: specialInstructions,
    });

    setConfirmedOrderId(newOrder.id);
    setConfirmedPin(newOrder.delivery_pin);
    showToast('Pickup Scheduled Successfully!', 'success');
  };

  // If order confirmed, render completion screen
  if (confirmedOrderId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <Badge variant="mint" size="md">
            Order Confirmed
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            Pickup Scheduled for {pickupDate}
          </h1>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Our agent will arrive during <strong>{pickupSlot}</strong> with a calibrated digital scale and sealed garment bags.
          </p>
        </div>

        <div className="p-6 text-left space-y-4 max-w-md mx-auto rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-400">Order Reference</span>
            <span className="text-sm font-semibold font-mono text-slate-900">{confirmedOrderId}</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
            <div className="text-xs text-slate-400 uppercase font-medium">Your 4-Digit Delivery PIN</div>
            <div className="text-3xl font-bold font-mono tracking-widest text-slate-900">
              {confirmedPin}
            </div>
            <div className="text-[11px] text-slate-500">
              Keep this safe. Share with the rider only when receiving your garments at doorstep.
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Service:</span>
              <strong className="text-slate-900">{activeService.name}</strong>
            </div>
            <div className="flex justify-between">
              <span>Estimated Weight:</span>
              <strong className="text-slate-900 font-mono">{weightKg} kg</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Amount:</span>
              <strong className="text-slate-900 font-mono text-sm">{formatCurrency(totalAmount)}</strong>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link to={`/track/${confirmedOrderId}`}>
            <Button variant="primary" size="lg" className="gap-2 font-medium">
              Track Order Live
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="secondary" size="lg" className="font-medium">
              View All Orders
            </Button>
          </Link>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedServiceId(srv.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      selectedServiceId === srv.id
                        ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                              selectedServiceId === srv.id
                                ? 'bg-slate-900 border-slate-900 text-white font-bold'
                                : 'border-slate-300'
                            }`}
                          >
                            {selectedServiceId === srv.id && '✓'}
                          </span>
                          <span className="font-semibold text-sm text-slate-900">{srv.name}</span>
                        </div>
                        {srv.tag && <Badge variant="slate" size="sm">{srv.tag}</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed pl-6">{srv.description}</p>
                    </div>

                    <div className="pt-4 flex justify-between items-center text-xs font-medium pl-6">
                      <span className="text-slate-900 font-mono font-semibold">
                        {formatCurrency(srv.base_price)} / {srv.pricing_type === 'per_kg' ? 'kg' : 'item'}
                      </span>
                      <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                        {srv.turnaround_hours}h Turnaround
                      </span>
                    </div>
                  </div>
                ))}
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
                  max={20}
                  step={0.5}
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value))}
                  className="w-full accent-slate-900 h-2 bg-slate-200 rounded-lg cursor-pointer"
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
                    Tailoring &amp; Garment Repairs (Optional Add-on)
                  </label>
                  {alterationsTotal > 0 && (
                    <Badge variant="mint" size="sm">
                      +{formatCurrency(alterationsTotal)} Added
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ALTERATION_OPTIONS.map((opt) => {
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
                          <div className="text-[11px] text-slate-500 leading-tight">{opt.desc}</div>
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
                              -
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
                            +
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
                  ✓
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

              <div className="space-y-3">
                {addresses.map((addr) => (
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
                      {selectedAddressId === addr.id && '✓'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & PAYMENT */}
          {currentStepIndex === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Payment & Final Confirmation</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Choose your payment method and apply discounts.
                </p>
              </div>

              {/* Promo Coupon Field */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <Tag className="w-4 h-4 text-slate-500" />
                  <span>Have a Promo Voucher?</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Coupon Code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs uppercase font-mono tracking-wider focus:border-slate-900 outline-none text-slate-900"
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

              {/* Loyalty Points Redemption */}
              {loyaltyAcc.balance > 0 && (
                <div
                  onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
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
                    {useLoyaltyPoints && '✓'}
                  </div>
                </div>
              )}

              {/* Payment Method Radio */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Select Payment Option
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'razorpay', label: 'Razorpay / UPI / Card', desc: 'Instant Online', icon: CreditCard },
                    { id: 'cod', label: 'Cash on Delivery', desc: 'Pay at Doorstep', icon: Truck },
                    { id: 'wallet', label: 'FreshFold Wallet', desc: 'Prepaid Balance', icon: Coins },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                        className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          paymentMethod === m.id
                            ? 'border-slate-900 bg-slate-50/80 ring-1 ring-slate-900 font-medium shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Icon className="w-5 h-5 text-slate-500 mb-2" />
                        <div>
                          <div className="text-xs font-semibold text-slate-900">{m.label}</div>
                          <div className="text-[10px] text-slate-400">{m.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
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
                <ArrowLeft className="w-3.5 h-3.5" />
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
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={handleConfirmOrder}
                className="gap-2 text-sm font-medium"
              >
                Confirm & Schedule Pickup
                <Check className="w-4 h-4 stroke-[3]" />
              </Button>
            )}
          </div>
        </div>

        {/* Right Sticky Order Summary Panel */}
        <div className="lg:col-span-4 sticky top-24 space-y-4">
          <div className="p-6 rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
            <h4 className="font-semibold text-sm text-slate-900 pb-3 border-b border-slate-100">
              Pickup Summary
            </h4>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex justify-between items-center">
                <span>Service:</span>
                <span className="font-semibold text-slate-900">{activeService.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Estimated Load:</span>
                <span className="font-semibold text-slate-900 font-mono">{weightKg} kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Pickup Slot:</span>
                <span className="font-medium text-slate-900">{pickupDate}, {pickupSlot}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Speed:</span>
                <span className={isExpress ? 'font-medium text-slate-900' : 'text-slate-600'}>
                  {isExpress ? '24h Express Delivery' : 'Standard 48h Turnaround'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Wash &amp; Care:</span>
                <span className="font-mono">{formatCurrency(garmentWashSubtotal)}</span>
              </div>
              {alterationsTotal > 0 && (
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>Alterations &amp; Repairs:</span>
                  <span className="font-mono">+{formatCurrency(alterationsTotal)}</span>
                </div>
              )}
              {isExpress && (
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>Express Surcharge:</span>
                  <span className="font-mono">+{formatCurrency(expressCharge)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Pickup & Delivery:</span>
                <span className={deliveryCharge === 0 ? 'text-emerald-600 font-semibold' : 'font-mono'}>
                  {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                </span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Promo Discount:</span>
                  <span className="font-mono">-{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-amber-600 font-semibold">
                  <span>Loyalty Points:</span>
                  <span className="font-mono">-{formatCurrency(loyaltyDiscount)}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
              <span className="font-medium text-xs text-slate-500">Estimated Total:</span>
              <span className="text-2xl font-bold font-mono text-slate-900">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>Calibrated scale check at doorstep. Only pay for the actual measured weight.</span>
            </div>
          </div>
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
            <label className="text-xs font-semibold uppercase tracking-wider text-ink/70">
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
                      ? 'border-mint bg-mint-soft text-ink font-bold'
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
    </div>
  );
};

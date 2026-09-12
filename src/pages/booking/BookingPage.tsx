import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { supabase } from '../../lib/supabase';
import { serviceService } from '../../services/api/serviceService';
import { addressService } from '../../services/api/addressService';
import { orderService } from '../../services/api/orderService';
import { paymentService } from '../../services/api/paymentService';
import { estimatePrice } from '../../lib/pricing';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ServiceCard } from '../../components/ui/ServiceCard';
import { Modal } from '../../components/ui/Modal';
import { Sparkles, Clock, ArrowRight, Home, History, User, ArrowLeft, Plus, Loader2, MapPin } from 'lucide-react';

const STEPS = [
  { id: 'service', label: 'Service', icon: Sparkles },
  { id: 'quantity', label: 'Quantity', icon: Sparkles },
  { id: 'schedule', label: 'Schedule', icon: Clock },
  { id: 'address', label: 'Address', icon: Sparkles },
  { id: 'review', label: 'Review', icon: Sparkles },
];

export const BookingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, showToast } = useApp();

  const [services, setServices] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loyaltyAcc, setLoyaltyAcc] = useState<{ balance: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const preselectedServiceId = (location.state as any)?.preselectedServiceId || '';
  const preselectedWeight = (location.state as any)?.preselectedWeight || 5;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpress, setIsExpress] = useState(false);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(preselectedServiceId);
  const [weightKg, setWeightKg] = useState<number>(preselectedWeight);
  const [pickupDate, setPickupDate] = useState<'Today' | 'Tomorrow' | 'In 3 Days'>('Today');
  const [pickupSlot, setPickupSlot] = useState('10:00-12:00');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [addAddressModalOpen, setAddAddressModalOpen] = useState(false);
  const [newAddress, setNewAddress] = useState({
    name: '',
    phone: '',
    address_line: '',
    landmark: '',
    city: '',
    state: 'Karnataka' as 'home' | 'work' | 'other' | undefined,
    postal_code: '',
    address_type: 'home',
    is_default: false
  });

  // Function to load addresses
  const loadAddresses = async () => {
    try {
      if (currentUser) {
        const all = await addressService.getAddressesByUser(currentUser.id);
        setAddresses(all);
      }
    } catch (e) {
      console.error(e);
      setLoadError('Unable to load your addresses. Please try again later.');
    }
  };

  useEffect(() => {
    const loadServices = async () => {
      try {
        const dbServices = await serviceService.getAllServices();
        setServices(dbServices);
        if (dbServices.length === 0) setLoadError('No services available right now.');
      } catch (e) {
        console.error(e);
        setLoadError('Unable to load services. Please try again later.');
      }
    };

    const loadLoyalty = async () => {
      if (!currentUser) return;
      try {
        const { data } = await supabase
          .from('loyalty_accounts')
          .select('balance')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        setLoyaltyAcc({ balance: Number(data?.balance) || 0 });
      } catch (e) {
        console.error('Loyalty load error', e);
        setLoyaltyAcc({ balance: 0 });
      }
    };

    loadServices();
    loadAddresses();
    loadLoyalty();
  }, [currentUser]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId]
  );

  const loyaltyPointsToUse = useLoyaltyPoints ? loyaltyAcc?.balance ?? 0 : 0;

  // Single source of truth for every price shown on this page. Mirrors the
  // server rules in create_order_secure (delivery fee under the threshold,
  // flat per-service express surcharge, coupon, loyalty at ₹0.10/pt) so the
  // review screen can't disagree with what the customer is actually charged.
  const priceEstimate = useMemo(() => {
    if (!selectedService) {
      return { subtotal: 0, discount: 0, loyaltyDiscount: 0, deliveryFee: 0, expressFee: 0, total: 0 };
    }
    return estimatePrice({
      service: selectedService,
      weightKg,
      isExpress,
      // validate_coupon returns an absolute amount, so feed it back as a fixed
      // discount rather than re-deriving percentage rules we don't have here.
      coupon: appliedCoupon
        ? { discount_type: 'fixed', discount_value: appliedCoupon.discount, min_order: 0 }
        : null,
      loyaltyPoints: loyaltyPointsToUse,
    });
  }, [selectedService, weightKg, isExpress, appliedCoupon, loyaltyPointsToUse]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      showToast('Enter a coupon code', 'error');
      return;
    }
    if (!selectedService) {
      showToast('Select a service first', 'error');
      return;
    }
    const estimate = estimatePrice({
      service: selectedService,
      weightKg,
      isExpress,
    });
    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: couponCode.trim(),
        p_subtotal: estimate.subtotal,
      });
      if (error) throw error;
      const result = data as unknown as { valid?: boolean; discount?: number; coupon_code?: string; error?: string };
      if (result.valid && result.discount != null) {
        setAppliedCoupon({ code: result.coupon_code || couponCode.toUpperCase(), discount: result.discount });
        showToast('Coupon applied!', 'success');
      } else {
        showToast(result.error || 'Invalid coupon code', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Could not validate coupon', 'error');
    }
  };

  const handleBookAndPay = async () => {
    if (!currentUser) {
      showToast('Please sign in to book', 'error');
      navigate('/login');
      return;
    }
    if (!selectedServiceId) {
      showToast('Please select a service', 'error');
      setCurrentStepIndex(0);
      return;
    }
    if (!selectedAddressId) {
      showToast('Please select a pickup address', 'error');
      setCurrentStepIndex(3);
      return;
    }
    const pickupDateValue =
      pickupDate === 'Today'
        ? new Date().toISOString().slice(0, 10)
        : pickupDate === 'Tomorrow'
          ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
          : new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

    setIsSubmitting(true);

    // Phase 1: create the order. Only failures here mean "order not placed".
    let created;
    try {
      created = await orderService.createOrder({
        customer_id: currentUser.id,
        address_id: selectedAddressId,
        service_id: selectedServiceId,
        weight_kg: weightKg,
        is_express: isExpress,
        coupon_code: appliedCoupon?.code || null,
        special_instructions: null,
        pickup_date: pickupDateValue,
        pickup_slot: pickupSlot,
        loyalty_points: loyaltyPointsToUse,
      });
    } catch (err: unknown) {
      console.error('Order creation error:', err);
      showToast(err instanceof Error ? err.message : 'Failed to place order', 'error');
      setIsSubmitting(false);
      return;
    }

    if (created.delivery_pin) {
      showToast(
        `Order ${created.order_number || created.id} placed! Share PIN ${created.delivery_pin} at delivery.`,
        'success'
      );
    }

    // Phase 2: payment. The order now EXISTS in the database, so a checkout or
    // polling failure must not be reported as "order failed" — that would push
    // the customer to rebook and pay twice.
    try {
      // Only the internal order id is sent to the backend; the amount is always
      // server-derived.
      const attempt = await paymentService.processRazorpayPayment(created.id, {
        name: currentUser.full_name || 'Customer',
        email: currentUser.email,
        phone: currentUser.phone,
      });

      if (attempt.attempt === 'completed') {
        // Payment attempt completed; the webhook confirms the payment in the
        // database. Poll for the authoritative state.
        showToast('Payment processing. Confirming...', 'info');
        const confirmed = await paymentService.pollPaymentStatus(created.id);
        if (confirmed.payment_status === 'SUCCESS') {
          showToast('Payment confirmed! Order is being scheduled.', 'success');
        } else if (confirmed.payment_status === 'FAILED') {
          showToast('Payment failed. You can retry from your orders.', 'error');
        } else {
          showToast('Payment is being confirmed. Check your orders shortly.', 'info');
        }
      } else if (attempt.attempt === 'failed') {
        showToast(attempt.message || 'Payment could not be completed', 'error');
      }
    } catch (err: unknown) {
      console.error('Payment confirmation error:', err);
      showToast('Order placed, but we could not confirm payment yet. Check your orders shortly.', 'info');
    } finally {
      setIsSubmitting(false);
    }

    navigate(`/track/${created.id}`, { replace: true });
  };

  const goNext = () => {
    if (currentStepIndex < 4) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleBookAndPay();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Fixed Bottom Navigation - Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-slate-200 shadow-lg lg:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <Link to="/">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-medium hover:bg-slate-100 transition-all w-full">
              <Home className="w-5 h-5" /> Home
            </button>
          </Link>
          <Link to="/dashboard">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-medium hover:bg-slate-100 transition-all w-full">
              <History className="w-5 h-5" /> Orders
            </button>
          </Link>
          <Link to="/booking">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-ink text-cream dark:bg-cream dark:text-ink font-medium hover:bg-ink/90 dark:hover:bg-cream/90 transition-all w-full">
              <Plus className="w-5 h-5" /> Book
            </button>
          </Link>
          <Link to="/dashboard">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-medium hover:bg-slate-100 transition-all w-full">
              <User className="w-5 h-5" /> Profile
            </button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 pb-40 lg:pt-24 lg:pb-16 min-h-screen">
        {loadError && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 mb-6">
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {loadError}
            </div>
          </div>
        )}
        {/* Top Progress Indicator */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-8 lg:mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              {STEPS[currentStepIndex].label}
            </h2>
            <Badge variant="slate">{currentStepIndex + 1} of {STEPS.length}</Badge>
          </div>

          {/* Simple progress bar */}
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${(currentStepIndex + 1) / STEPS.length * 100}%` }} />
          </div>

          <div className="flex justify-between text-xs text-slate-500 mt-1">
            {STEPS.map((step, i) => (
              <span key={step.id} className="flex-1 text-center">
                {i <= currentStepIndex ? step.label : ''}
              </span>
            ))}
          </div>
        </section>

        {/* Step Content */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6">
          {renderStep()}
        </section>

        {/* Bottom Navigation Buttons */}
        <div className="fixed bottom-20 left-0 right-0 p-4 sm:px-6 lg:px-8 lg:relative lg:bottom-auto lg:mt-8 lg:fixed lg:left-auto lg:right-auto lg:max-w-4xl lg:mx-auto lg:w-full lg:px-6 lg:z-40 lg:bg-surface">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-start gap-3">
            {currentStepIndex > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStepIndex(currentStepIndex - 1)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-all w-full sm:w-auto"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            )}

            <Button
              size="lg"
              disabled={isSubmitting}
              onClick={goNext}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-ink text-cream dark:bg-cream dark:text-ink font-medium shadow-lg transition-all active:scale-95 w-full sm:w-auto"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : currentStepIndex < 4 ? (
                <>Next <ArrowRight className="w-4 h-4" /></>
              ) : (
                'Book & Pay'
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );

  function renderStep() {
    switch (currentStepIndex) {
      case 0: return <ServiceSelectionStep />;
      case 1: return <QuantitySelectionStep />;
      case 2: return <ScheduleStep />;
      case 3: return <AddressSelectionStep />;
      case 4: return <ReviewStep />;
      default: return null;
    }
  }

  function ServiceSelectionStep() {
    return (
      <div className="space-y-8 py-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="slate">Step 1 of 5</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-2">Choose Service</h2>
          <p className="text-slate-500 text-sm sm:text-base mb-6">Select the type of service you need</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((srv: any) => (
            <ServiceCard
              key={srv.id}
              service={{
                id: srv.id,
                name: srv.name,
                description: srv.description || 'Everyday clothes',
                category: srv.category || 'wash_fold',
                pricing_type: 'per_kg',
                base_price: srv.base_price || srv.startingPrice || 120,
                turnaround_hours: srv.turnaround_hours || 24,
                popular: srv.id === 'wash_fold',
                fabric_types: srv.fabric_types || (srv.category === 'dry_clean' ? ['silk', 'wool', 'formal'] :
                  srv.category === 'wash_fold' ? ['cotton', 'casual', 'denim'] : ['cotton', 'linen']),
              }}
              isSelected={selectedServiceId === srv.id}
              onSelect={() => {
                setSelectedServiceId(srv.id);
                setCurrentStepIndex(1);
              }}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>

        <div className="text-center mt-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            View all services
          </Button>
        </div>
      </div>
    );
  }

  function QuantitySelectionStep() {
    return (
      <div className="space-y-8 py-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="slate">Step 2 of 5</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-2">How Much?</h2>
          <p className="text-slate-500 text-sm sm:text-base mb-6">Tell us the amount of laundry</p>
          <p className="text-slate-500 text-xs sm:text-base">Don't know the exact weight? No problem. We'll weigh it when we collect it.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
          <div className="rounded-2xl bg-surface border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Current</span>
              <span className="font-mono font-bold text-slate-900">{weightKg} kg</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-ink dark:bg-cream rounded-full w-[40%]" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Quick Select:</span>
              <div className="flex gap-2">
                {[3, 5, 7, 10].map((kg) => (
                  <Button
                    key={kg}
                    variant={weightKg === kg ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setWeightKg(kg)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all"
                  >
                    {kg} kg
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Or enter custom weight (kg)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={weightKg}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0.5 && value <= 30) {
                      setWeightKg(value);
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded border border-slate-300 focus:border-ink focus:ring-1 focus:ring-ink/20 text-sm"
                  placeholder="e.g., 2.5"
                />
                <span className="text-xs text-slate-500">kg</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">We'll weigh your laundry when we collect it.</p>
      </div>
    );
  }

  function ScheduleStep() {
    return (
      <div className="space-y-8 py-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="slate">Step 3 of 5</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-2">Pickup Schedule</h2>
          <p className="text-slate-500 text-sm sm:text-base">Choose when we should pick up your laundry</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {['Today', 'Tomorrow', 'In 3 Days'].map((date) => (
            <Button
              key={date}
              variant={pickupDate === date ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setPickupDate(date as any)}
              className="flex-1 py-2 rounded-full text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-all"
            >
              {date}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {['10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'].map((slot) => (
            <Button
              key={slot}
              variant={pickupSlot === slot ? 'primary' : 'outline'}
              size="lg"
              onClick={() => setPickupSlot(slot)}
              className="h-20 w-full rounded-xl border border-slate-300 flex flex-col items-center justify-center text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all"
            >
              {slot}
            </Button>
          ))}
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          <strong>Regular:</strong> Tomorrow delivery
        </p>
      </div>
    );
  }

  function AddressSelectionStep() {
    return (
      <div className="space-y-8 py-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="slate">Step 4 of 5</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-2">Delivery Address</h2>
          <p className="text-slate-500 text-sm sm:text-base">Choose where we should pick up</p>
        </div>

        <div className="grid grid-cols-1 gap-3 mb-6">
          {addresses.map((addr: any) => (
            <Button
              key={addr.id}
              variant={selectedAddressId === addr.id ? 'primary' : 'outline'}
              size="lg"
              className="h-16 rounded-xl border-2 py-2 flex items-center justify-between px-4 text-sm font-medium text-slate-700"
              onClick={() => setSelectedAddressId(addr.id)}
            >
              <div>
                <div className="font-medium">{addr.label || addr.name}</div>
                <div className="text-xs text-slate-500">{addr.street || addr.address_line}, {addr.city}</div>
              </div>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                selectedAddressId === addr.id ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
              }`}>
                {selectedAddressId === addr.id ? '✓' : ''}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Reset form when opening modal
              setNewAddress({
                name: '',
                phone: '',
                address_line: '',
                landmark: '',
                city: '',
                state: 'Karnataka' as 'home' | 'work' | 'other' | undefined,
                postal_code: '',
                address_type: 'home',
                is_default: false
              });
              setAddAddressModalOpen(true);
            }}
            className="w-full py-2.5 rounded-full bg-surface border border-slate-300 text-slate-600 font-medium text-xs hover:bg-slate-50 transition-all"
          >
            + Add new address
          </Button>
        </div>

        {/* Address Modal */}
        {addAddressModalOpen && <AddressModal />}
      </div>
    );
  }

  function ReviewStep() {
    const { subtotal: bp, discount: d, loyaltyDiscount: ld, deliveryFee: df, expressFee: es, total: t } = priceEstimate;

    const selectedAddr = addresses.find(a => a.id === selectedAddressId);

    return (
      <div className="space-y-8 py-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="slate">Step 5 of 5</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-2">Review Order</h2>
          <p className="text-slate-500 text-sm sm:text-base">Confirm everything is correct before paying</p>
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl bg-surface border border-slate-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Service</span>
              <p className="font-medium text-slate-900 mt-1">{services.find(s => s.id === selectedServiceId)?.name || 'Wash & Fold'}</p>
              <p className="text-xs text-slate-500 mt-1">{services.find(s => s.id === selectedServiceId)?.description || 'Everyday clothes'}</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Quantity</span>
              <p className="font-medium text-slate-900 mt-1">{weightKg} kg</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Pickup Date</span>
              <p className="font-medium text-slate-900 mt-1">{pickupDate}</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Delivery</span>
              <p className="font-medium text-slate-900 mt-1">{isExpress ? 'Express: Tonight' : 'Regular: Tomorrow'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Address</span>
              <p className="font-medium text-slate-900 mt-1">{selectedAddr?.label || selectedAddr?.name || 'Home'}</p>
              <p className="text-xs text-slate-500 mt-1">{selectedAddr?.street || selectedAddr?.address_line || '123 Main Street'}</p>
              <p className="text-xs text-slate-500 mt-1>{selectedAddr?.city || 'Jaipur'}</p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Express</span>
              <div className="mt-1">
                <Button
                  variant={isExpress ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setIsExpress(!isExpress)}
                  className="text-xs font-medium"
                >
                  {isExpress ? `Express ON (+${formatCurrency(es)})` : 'Add Express'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing — mirrors create_order_secure so the shown total matches the
            server-computed charge. */}
        <div className="mt-8 pt-8 border-t border-slate-200 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Laundry</span>
            <span className="font-medium text-slate-900">{formatCurrency(bp)}</span>
          </div>
          {es > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Express surcharge</span>
              <span className="font-medium text-slate-900">{formatCurrency(es)}</span>
            </div>
          )}
          {df > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Delivery fee</span>
              <span className="font-medium text-slate-900">{formatCurrency(df)}</span>
            </div>
          )}
          {d > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Coupon discount</span>
              <span className="text-amber-600 font-medium">-{formatCurrency(d)}</span>
            </div>
          )}
          {ld > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Loyalty points</span>
              <span className="text-amber-600 font-medium">-{formatCurrency(ld)}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Total</span>
            <span className="font-bold text-2xl text-slate-900">{formatCurrency(t)}</span>
          </div>
        </div>

        {/* Coupon & Loyalty - compact */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex gap-2">
            <Input
              placeholder="COUPON50"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="h-8 w-40 rounded-full bg-slate-50 border border-slate-200 px-3 text-sm"
            />
            <Button variant="ghost" size="sm" onClick={handleApplyCoupon}>
              Apply
            </Button>
          </div>
          {appliedCoupon && (
            <div className="flex-1">
              <p className="text-emerald-600 font-medium text-sm">✓ {appliedCoupon.code} applied — Save ₹{appliedCoupon.discount}</p>
            </div>
          )}
        </div>

        {/* Loyalty points */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-slate-600">
            You have {loyaltyAcc?.balance ?? 0} FoldeD Points
            {(loyaltyAcc?.balance ?? 0) > 0 && (
              <span className="text-slate-400"> (worth {formatCurrency((loyaltyAcc?.balance ?? 0) * 0.1)})</span>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={(loyaltyAcc?.balance ?? 0) <= 0}
            onClick={() => setUseLoyaltyPoints(!useLoyaltyPoints)}
          >
            {useLoyaltyPoints ? 'Remove points' : 'Use points'}
          </Button>
        </div>
      </div>

      {/* Payment CTA */}
      <div className="mt-8 pt-8 border-t border-slate-200">
        <Button
          size="lg"
          disabled={isSubmitting}
          onClick={handleBookAndPay}
          className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-ink text-cream dark:bg-cream dark:text-ink font-medium shadow-lg transition-all active:scale-95 w-full"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
          ) : (
            <>Pay ₹{formatCurrency(t)} & Book Pickup <ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    );
  }

  // Address Modal Component
  function AddressModal() {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      // Basic validation
      if (!newAddress.name.trim() || !newAddress.phone.trim() || !newAddress.address_line.trim() || !newAddress.city.trim() || !newAddress.postal_code.trim()) {
        showToast('Please fill in all required fields', 'error');
        return;
      }

      try {
        if (!currentUser) {
          showToast('Please sign in to save an address', 'error');
          return;
        }

        await addressService.addAddress(currentUser.id, {
          name: newAddress.name,
          phone: newAddress.phone,
          address_line: newAddress.address_line,
          landmark: newAddress.landmark,
          city: newAddress.city,
          state: newAddress.state,
          postal_code: newAddress.postal_code,
          address_type: newAddress.address_type,
          is_default: newAddress.is_default
        });

        // Refresh addresses
        await loadAddresses();
        setAddAddressModalOpen(false);
        showToast('Address saved successfully!', 'success');
      } catch (error) {
        console.error('Error saving address:', error);
        showToast('Failed to save address. Please try again.', 'error');
      }
    };

    return (
      <Modal
        isOpen={addAddressModalOpen}
        onClose={() => setAddAddressModalOpen(false)}
        title="Add New Address"
        description="Save this address for faster future bookings"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address Name (e.g., Home, Office)</label>
              <Input
                value={newAddress.name}
                onChange={(e) => setNewAddress({...newAddress, name: e.target.value})}
                placeholder="e.g., My Home"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <Input
                type="tel"
                value={newAddress.phone}
                onChange={(e) => setNewAddress({...newAddress, phone: e.target.value})}
                placeholder="+91 98765 43210"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address Line</label>
            <Input
              value={newAddress.address_line}
              onChange={(e) => setNewAddress({...newAddress, address_line: e.target.value})}
              placeholder="123 Main Street, Apt 4B"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Landmark (Optional)</label>
              <Input
                value={newAddress.landmark}
                onChange={(e) => setNewAddress({...newAddress, landmark: e.target.value})}
                placeholder="Near ABC Mall"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <Input
                value={newAddress.city}
                onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                placeholder="Bengaluru"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <Input
                value={newAddress.state}
                onChange={(e) => setNewAddress({...newAddress, state: e.target.value})}
                placeholder="Karnataka"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Postal Code</label>
              <Input
                type="text"
                maxLength={6}
                value={newAddress.postal_code}
                onChange={(e) => setNewAddress({...newAddress, postal_code: e.target.value})}
                placeholder="560001"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={newAddress.is_default}
                onChange={(e) => setNewAddress({...newAddress, is_default: e.target.checked})}
                className="h-4 w-4 text-emerald-600 border-slate-300 rounded"
              />
            </div>
            <span className="text-sm font-medium text-slate-700">
              Set as default address
            </span>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setAddAddressModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="mint" size="md" className="gap-2 font-bold">
              <MapPin className="w-4 h-4" />
              Save Address
            </Button>
          </div>
        </form>
      </Modal>
    );
  }
};
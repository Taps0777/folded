import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { StorageService } from '../../services/storage';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import {
  Sparkles,
  Truck,
  Scale,
  ShieldCheck,
  Clock,
  MapPin,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Shirt,
  Check,
  Building2,
  Briefcase,
  FileText,
  Percent,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, showToast } = useApp();
  
  const [services, setServices] = useState<any[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const { serviceService } = await import('../../services/api/serviceService');
        // Fetch real services from DB
        const dbServices = await serviceService.getAllServices();
        setServices(dbServices.length > 0 ? dbServices : StorageService.getServices());
        
        // Use StorageService for subscriptions as fallback since we didn't build subscriptionService yet
        setSubscriptionPlans(StorageService.getSubscriptions());
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // B2B Bulk Calculator State
  const [b2bSector, setB2bSector] = useState<'hospitality' | 'gyms' | 'salons' | 'corporate'>('hospitality');
  const [b2bMonthlyKg, setB2bMonthlyKg] = useState<number>(450);
  const [b2bModalOpen, setB2bModalOpen] = useState(false);
  const [b2bForm, setB2bForm] = useState({
    companyName: '',
    contactName: currentUser?.full_name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    city: 'Bengaluru',
  });

  // Pincode checker state
  const [pincode, setPincode] = useState('');
  const [pincodeResult, setPincodeResult] = useState<{ checked: boolean; serviceable: boolean; areaName?: string } | null>(null);

  // Interactive Calculator state
  const [calcServiceId, setCalcServiceId] = useState('srv_wash_fold');
  const [calcWeight, setCalcWeight] = useState(4); // 4 kg
  const [calcPieces, setCalcPieces] = useState<{ [key: string]: number }>({
    shirts: 4,
    trousers: 3,
    tshirts: 4,
    delicates: 1,
  });
  const [calcMode, setCalcMode] = useState<'kg' | 'pieces'>('kg');

  const selectedService = services.find((s) => s.id === calcServiceId) || services[0] || StorageService.getServices()[0];

  // Calculate estimated price
  let estimatedPrice = 0;
  if (calcMode === 'kg') {
    estimatedPrice = Math.round(selectedService.base_price * calcWeight);
  } else {
    const totalPieces = Object.values(calcPieces).reduce((a, b) => a + b, 0);
    // Estimated ~200g per piece
    const estimatedKg = Math.max(1, totalPieces * 0.25);
    estimatedPrice = selectedService.pricing_type === 'per_kg'
      ? Math.round(selectedService.base_price * estimatedKg)
      : selectedService.base_price * totalPieces;
  }

  const handleCheckPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincode || pincode.trim().length < 6) {
      showToast('Please enter a valid 6-digit postal code', 'error');
      return;
    }
    try {
      const { areaService } = await import('../../services/api/areaService');
      const res = await areaService.checkServiceability(pincode);
      if (res.serviceable && res.area) {
        setPincodeResult({ checked: true, serviceable: true, areaName: `${res.area.area_name}, ${res.area.city}` });
        showToast(`Great news! We service ${res.area.area_name}`, 'success');
      } else {
        setPincodeResult({ checked: true, serviceable: false });
      }
    } catch (e) {
      showToast('Error checking pincode', 'error');
    }
  };

  const handleProceedBooking = () => {
    navigate('/booking', {
      state: {
        preselectedServiceId: calcServiceId,
        preselectedWeight: calcMode === 'kg' ? calcWeight : undefined,
      },
    });
  };

  // B2B Bulk Sector Presets & Calculation Logic
  const sectorPresets = {
    hospitality: {
      name: 'Hotels & Airbnbs',
      baseRate: 65,
      description: 'Linen turnover, duvets, bedsheets, luxury towels',
      turnaround: '24-36 hrs guaranteed',
    },
    gyms: {
      name: 'Gyms & Fitness Centers',
      baseRate: 58,
      description: 'Sweat towels, microfiber cloths, staff sportswear',
      turnaround: 'Daily morning dispatch',
    },
    salons: {
      name: 'Salons & Spas',
      baseRate: 72,
      description: 'Bleach-safe towels, aprons, robes, sanitization',
      turnaround: '24 hrs turnaround',
    },
    corporate: {
      name: 'Corporate & Institutions',
      baseRate: 80,
      description: 'Executive blazers, workwear, laboratory scrubs',
      turnaround: 'Scheduled 48 hrs SLA',
    },
  };

  const b2bDiscountPct = b2bMonthlyKg >= 800 ? 35 : b2bMonthlyKg >= 300 ? 25 : 15;
  const currentSector = sectorPresets[b2bSector];
  const b2bCommercialRate = Math.round(currentSector.baseRate * (1 - b2bDiscountPct / 100));
  const b2bRetailEst = b2bMonthlyKg * 95;
  const b2bMonthlyTotal = b2bMonthlyKg * b2bCommercialRate;
  const b2bMonthlySavings = b2bRetailEst - b2bMonthlyTotal;

  const handleB2bSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!b2bForm.companyName.trim() || !b2bForm.email.trim()) {
      showToast('Please enter company name and work email', 'error');
      return;
    }
    try {
      const { ticketService } = await import('../../services/api/ticketService');
      await ticketService.createTicket({
        user_id: currentUser?.id || '00000000-0000-0000-0000-000000000000', // Anonymous or system user if logged out
        subject: `B2B Enterprise Inquiry: ${b2bForm.companyName}`,
        message: `Company: ${b2bForm.companyName}\nEmail: ${b2bForm.email}\nPhone: ${b2bForm.phone}\nSector: ${sectorPresets[b2bSector].name}\nEstimated Volume: ${b2bMonthlyKg} kg/month`,
        category: 'b2b_inquiry'
      });
      showToast(`Enterprise quote initiated for ${b2bForm.companyName}! Our commercial desk will contact ${b2bForm.email} within 2 business hours.`, 'success');
      setB2bModalOpen(false);
    } catch (err) {
      showToast('Failed to submit inquiry. Please try again.', 'error');
    }
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Clean, Sleek, and Elegant Hero Section */}
      <section className="relative overflow-hidden bg-white border-b border-slate-200/70 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Headline */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Doorstep Garment Care • 7-Stage Quality Wash</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold font-display tracking-tight text-slate-900 leading-[1.08]">
                Crisp, fresh clothes. <br />
                <span className="text-slate-400 font-normal">Delivered to your door.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
                Scheduled doorstep pickup, 7-stage eco-friendly wash pipeline, and calibrated delivery tracking. Zero guesswork, zero hassle.
              </p>

              {/* Instant Postal Code Check */}
              <div className="pt-2 max-w-md space-y-2">
                <form
                  onSubmit={handleCheckPincode}
                  className="flex gap-2 p-1.5 rounded-full bg-white border border-slate-200 shadow-sm focus-within:border-slate-900 transition-colors"
                >
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit Pincode (e.g. 560087)"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full h-9 pl-10 pr-3 rounded-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 transition-all shadow-xs active:scale-95"
                  >
                    Check
                  </button>
                </form>

                {/* Quick Sample Pincode Chips */}
                <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
                  <span>Try sample:</span>
                  {[
                    { pin: '560087', label: 'Whitefield' },
                    { pin: '560034', label: 'Koramangala' },
                    { pin: '560102', label: 'HSR Layout' },
                  ].map((item) => (
                    <button
                      key={item.pin}
                      type="button"
                      onClick={async () => {
                        setPincode(item.pin);
                        try {
                          const { areaService } = await import('../../services/api/areaService');
                          const res = await areaService.checkServiceability(item.pin);
                          if (res.serviceable && res.area) {
                            setPincodeResult({
                              checked: true,
                              serviceable: true,
                              areaName: `${res.area.area_name}, ${res.area.city}`,
                            });
                            showToast(`Great news! We service ${res.area.area_name}`, 'success');
                          } else {
                            setPincodeResult({ checked: true, serviceable: false });
                          }
                        } catch (e) {
                          showToast('Error checking pincode', 'error');
                        }
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200/70 hover:text-slate-900 text-slate-600 font-mono transition-colors"
                    >
                      {item.pin}
                    </button>
                  ))}
                </div>

                {pincodeResult?.checked && (
                  <div className="mt-2 text-xs font-medium animate-in fade-in">
                    {pincodeResult.serviceable ? (
                      <span className="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Available in {pincodeResult.areaName}! 24h turnaround.
                      </span>
                    ) : (
                      <span className="text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1.5">
                        Coming soon to your area! Try pin codes 560087, 560034, 560102.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="pt-3 flex flex-wrap items-center gap-3.5">
                <Link to="/booking">
                  <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 font-medium text-sm shadow-xs transition-all active:scale-95">
                    Book Pickup in 60s
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <a href="#calculator">
                  <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-all">
                    Estimate Price
                  </button>
                </a>
              </div>

              {/* Trust Badges */}
              <div className="pt-3 flex flex-wrap items-center gap-5 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> Zero Delivery Fees &gt; ₹199
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> 7-Point Quality Guarantee
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> Tamper-Proof Sealed Bags
                </span>
              </div>
            </div>

            {/* Right Hero Visual Card */}
            <div className="lg:col-span-5">
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-6 text-slate-900">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                        Live Tracking Telemetry
                      </div>
                      <div className="text-sm font-bold font-display text-slate-900">
                        Order FF-63914
                      </div>
                    </div>
                  </div>
                  <Badge variant="mint" dot>
                    Washing Cycle
                  </Badge>
                </div>

                {/* Stage Snapshot */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Batch #C4 — Central Facility</span>
                    <span className="text-emerald-600 font-mono font-bold">65% Completed</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[65%]" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Weighed: <strong className="text-slate-800">5.2 kg</strong></span>
                    <span>Delivery: <strong className="text-slate-800">Today, 8:00 PM</strong></span>
                  </div>
                </div>

                {/* Feature Highlights */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="text-[11px] text-slate-400">Doorstep Secret PIN</div>
                    <div className="text-base font-bold font-mono text-slate-900 tracking-wider">
                      PIN: 7392
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="text-[11px] text-slate-400">Assigned Driver</div>
                    <div className="text-sm font-bold text-slate-900">Vikram S. ★ 4.9</div>
                  </div>
                </div>

                <Link to="/track/FF-63914" className="block">
                  <button className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                    Open Full Route Radar Simulator
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Metrics Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/70 shadow-xs">
          <div className="space-y-1 border-r border-slate-100 pr-4">
            <div className="text-3xl sm:text-4xl font-bold font-display text-slate-900">48,000+</div>
            <div className="text-xs text-slate-500 font-medium">Kilograms Cleaned & Folded</div>
          </div>
          <div className="space-y-1 md:border-r border-slate-100 pr-4">
            <div className="text-3xl sm:text-4xl font-bold font-display text-slate-900">4.92 / 5</div>
            <div className="text-xs text-slate-500 font-medium">Customer Rating (6,200+ Reviews)</div>
          </div>
          <div className="space-y-1 border-r border-slate-100 pr-4">
            <div className="text-3xl sm:text-4xl font-bold font-display text-emerald-600">24 Hours</div>
            <div className="text-xs text-slate-500 font-medium">Average Standard Turnaround</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-bold font-display text-slate-900">100%</div>
            <div className="text-xs text-slate-500 font-medium">Hypoallergenic Fabric Care</div>
          </div>
        </div>
      </section>

      {/* Interactive Price Estimator */}
      <section id="calculator" className="max-w-7xl mx-auto px-4 sm:px-6 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
          <Badge variant="slate">Instant Cost Estimator</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            Transparent Pricing, Zero Hidden Surcharges.
          </h2>
          <p className="text-slate-500 text-sm sm:text-base">
            Estimate your laundry load right now. We weigh with digital scales in front of you at pickup.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-6">
            {/* Service Selection Pills */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                1. Select Garment Care Service
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {services.map((srv) => (
                  <button
                    key={srv.id}
                    onClick={() => setCalcServiceId(srv.id)}
                    className={`p-3 rounded-xl text-left border transition-all text-xs ${
                      calcServiceId === srv.id
                        ? 'border-slate-900 bg-slate-900 text-white font-medium shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white text-slate-700'
                    }`}
                  >
                    <div className="truncate font-semibold">{srv.name}</div>
                    <div className={`text-[11px] mt-0.5 ${calcServiceId === srv.id ? 'text-slate-300' : 'text-emerald-600'}`}>
                      {formatCurrency(srv.base_price)}/{srv.pricing_type === 'per_kg' ? 'kg' : 'item'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  2. Estimate Load
                </label>
                <div className="inline-flex p-1 rounded-lg bg-slate-100 text-xs">
                  <button
                    onClick={() => setCalcMode('kg')}
                    className={`px-3 py-1 rounded-md transition-all font-medium ${
                      calcMode === 'kg' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    By Weight (kg)
                  </button>
                  <button
                    onClick={() => setCalcMode('pieces')}
                    className={`px-3 py-1 rounded-md transition-all font-medium ${
                      calcMode === 'pieces' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    By Garment Count
                  </button>
                </div>
              </div>

              {calcMode === 'kg' ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900">Estimated Laundry Weight:</span>
                    <span className="text-2xl font-bold font-mono text-slate-900">{calcWeight} kg</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    step={0.5}
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(parseFloat(e.target.value))}
                    className="w-full accent-slate-900 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                    <span>1 kg (approx 4-5 t-shirts)</span>
                    <span>5 kg (family load)</span>
                    <span>15 kg (weekly bulk)</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'shirts', label: 'Shirts / Tops' },
                    { key: 'trousers', label: 'Trousers / Jeans' },
                    { key: 'tshirts', label: 'T-Shirts' },
                    { key: 'delicates', label: 'Suits / Sarees' },
                  ].map((item) => (
                    <div key={item.key} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center space-y-2">
                      <span className="text-xs font-medium text-slate-600 block truncate">{item.label}</span>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() =>
                            setCalcPieces((prev) => ({
                              ...prev,
                              [item.key]: Math.max(0, (prev[item.key] || 0) - 1),
                            }))
                          }
                          className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                        >
                          -
                        </button>
                        <span className="w-6 text-sm font-bold font-mono">{calcPieces[item.key] || 0}</span>
                        <button
                          onClick={() =>
                            setCalcPieces((prev) => ({
                              ...prev,
                              [item.key]: (prev[item.key] || 0) + 1,
                            }))
                          }
                          className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Output Card */}
          <div className="lg:col-span-5 bg-slate-900 p-6 sm:p-8 rounded-2xl text-white shadow-sm border border-slate-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Estimate Summary
              </span>
              <Badge variant="mint">Ready to Book</Badge>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm text-slate-300">
                <span>Selected Service:</span>
                <span className="font-semibold text-white">{selectedService.name}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-300">
                <span>Base Rate:</span>
                <span className="font-mono text-white">
                  {formatCurrency(selectedService.base_price)} / {selectedService.pricing_type === 'per_kg' ? 'kg' : 'item'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-300">
                <span>Estimated Turnaround:</span>
                <span className="font-semibold text-white">{selectedService.turnaround_hours} Hours</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-300">
                <span>Doorstep Pickup & Delivery:</span>
                <span className="text-emerald-400 font-semibold">FREE (Over ₹199)</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Estimated Total:</div>
              <div className="text-4xl font-bold font-display text-white">
                {formatCurrency(estimatedPrice)}
              </div>
              <div className="text-[11px] text-slate-400">
                *Final bill adjusted based on actual scale weight measured at doorstep pickup.
              </div>
            </div>

            <Button
              onClick={handleProceedBooking}
              variant="mint"
              size="lg"
              className="w-full gap-2 text-sm sm:text-base font-medium"
            >
              Book Pickup with this Estimate
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <Badge variant="slate">Simple 4-Step Process</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            How FreshFold Works
          </h2>
          <p className="text-slate-500 text-sm sm:text-base">
            From your laundry basket to crisp, organized closet shelves in 24 hours.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              step: 'Step 01',
              title: 'Schedule in 60s',
              desc: 'Select your preferred morning, afternoon, or evening pickup slot and add special garment notes.',
              icon: Clock,
            },
            {
              step: 'Step 02',
              title: 'Digital Weigh & Tag',
              desc: 'Our rider arrives with portable calibrated scale, records weight, and seals items in a tagged bag.',
              icon: Scale,
            },
            {
              step: 'Step 03',
              title: '7-Stage Facility Care',
              desc: 'Garments go through sorting, eco-wash, lint-free drying, steam press, and 7-point quality inspection.',
              icon: Sparkles,
            },
            {
              step: 'Step 04',
              title: 'PIN-Protected Delivery',
              desc: 'Rider delivers crisp garments at your doorstep. Handover completed only upon your 4-digit PIN verification.',
              icon: ShieldCheck,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="p-6 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
                      {item.step}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Services Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <Badge variant="slate">Comprehensive Menu</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            Crafted for Every Fabric in Your Life
          </h2>
          <p className="text-slate-500 text-sm sm:text-base">
            From daily cottons and activewear to bridal silks and bespoke blazers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((srv) => (
            <div
              key={srv.id}
              className="p-6 rounded-2xl bg-white border border-slate-200/80 flex flex-col justify-between hover:border-slate-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] group"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 flex items-center justify-center">
                    <Shirt className="w-5 h-5" />
                  </div>
                  {srv.tag && (
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {srv.tag}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{srv.name}</h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{srv.description}</p>
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100 mt-6 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Starting from</span>
                  <span className="text-xl font-semibold font-mono text-slate-900">
                    {formatCurrency(srv.base_price)}
                    <span className="text-xs font-normal text-slate-400">
                      /{srv.pricing_type === 'per_kg' ? 'kg' : 'item'}
                    </span>
                  </span>
                </div>
                <Link to="/booking" state={{ preselectedServiceId: srv.id }}>
                  <Button variant="secondary" size="sm" className="gap-1 text-xs">
                    Book This
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Subscription Passes */}
      <section id="subscriptions" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <Badge variant="slate">Monthly Laundry Pass</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            Never Think About Laundry Again
          </h2>
          <p className="text-slate-500 text-sm sm:text-base">
            Save up to 35% with flexible recurring monthly passes. Pause or cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subscriptionPlans.map((plan) => (
            <div
              key={plan.id}
              className={`p-7 rounded-2xl flex flex-col justify-between relative bg-white transition-all ${
                plan.recommended
                  ? 'border-2 border-slate-900 shadow-md'
                  : 'border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]'
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-semibold px-3 py-0.5 rounded-full uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold font-mono text-slate-900">{formatCurrency(plan.price)}</span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">
                    Includes {plan.max_kg} kg monthly allowance
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-600">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8">
                <Link to="/booking">
                  <Button
                    variant={plan.recommended ? 'primary' : 'secondary'}
                    size="md"
                    className="w-full"
                  >
                    Select {plan.name}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* B2B Commercial & Bulk Order Calculator */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <Badge variant="slate">FreshFold Commercial &amp; Enterprise</Badge>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            B2B Bulk Laundry &amp; Linen Calculator
          </h2>
          <p className="text-slate-500 text-sm sm:text-base">
            High-capacity commercial laundry solutions for hospitality, fitness centers, salons, and corporate offices with dedicated route vans and volume-tiered savings.
          </p>
        </div>

        {/* Sector Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {(
            [
              { key: 'hospitality', label: 'Hotels & Airbnbs', icon: Building2 },
              { key: 'gyms', label: 'Gyms & Fitness', icon: Sparkles },
              { key: 'salons', label: 'Salons & Spas', icon: Shirt },
              { key: 'corporate', label: 'Corporate & Uniforms', icon: Briefcase },
            ] as const
          ).map((sector) => {
            const Icon = sector.icon;
            const isSelected = b2bSector === sector.key;
            return (
              <button
                key={sector.key}
                type="button"
                onClick={() => setB2bSector(sector.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{sector.label}</span>
              </button>
            );
          })}
        </div>

        {/* Calculator Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Volume Slider & Tier Perks */}
          <div className="lg:col-span-7 p-6 sm:p-8 space-y-6 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Target Sector
                </span>
                <Badge variant="mint" size="sm">
                  {currentSector.turnaround}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{currentSector.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{currentSector.description}</p>
            </div>

            {/* Volume Control */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-baseline justify-between">
                <label className="text-xs sm:text-sm font-medium text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  Estimated Monthly Linen Volume
                </label>
                <div className="text-right">
                  <span className="text-2xl font-bold font-mono text-slate-900">
                    {b2bMonthlyKg}
                  </span>
                  <span className="text-slate-400 text-xs font-medium ml-1">kg / month</span>
                </div>
              </div>

              <input
                type="range"
                min={100}
                max={2500}
                step={25}
                value={b2bMonthlyKg}
                onChange={(e) => setB2bMonthlyKg(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
              />

              {/* Quick Jump Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-400 font-medium">Quick Select:</span>
                {[200, 450, 850, 1500].map((kg) => (
                  <button
                    key={kg}
                    type="button"
                    onClick={() => setB2bMonthlyKg(kg)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-mono border transition-all ${
                      b2bMonthlyKg === kg
                        ? 'bg-slate-900 text-white border-slate-900 font-medium'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {kg} kg
                  </button>
                ))}
              </div>

              {/* Volume Tier Progress Bar */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-emerald-600" />
                    Tier Discount Active
                  </span>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                    {b2bDiscountPct}% Corporate Off
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div
                    className={`py-1.5 px-2 rounded text-[11px] font-medium border ${
                      b2bDiscountPct === 15
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    100-299 kg (15%)
                  </div>
                  <div
                    className={`py-1.5 px-2 rounded text-[11px] font-medium border ${
                      b2bDiscountPct === 25
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    300-799 kg (25%)
                  </div>
                  <div
                    className={`py-1.5 px-2 rounded text-[11px] font-medium border ${
                      b2bDiscountPct === 35
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    800+ kg (35%)
                  </div>
                </div>
              </div>
            </div>

            {/* Enterprise Service Guarantees */}
            <div className="space-y-2.5 pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Included Enterprise Perks
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                {[
                  'Scheduled route pickup in sealed bins',
                  'RFID linen sorting & loss prevention',
                  'Thermal sanitization & pH-balanced rinse',
                  'GST credit invoices & 30-day net payment',
                ].map((perk, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Cost Estimation & Quote CTA */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="h-full p-6 sm:p-8 rounded-2xl bg-slate-900 text-white flex flex-col justify-between relative border border-slate-800 shadow-sm">
              <div className="space-y-6 relative z-10">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-mono tracking-wider text-slate-400 uppercase">
                      Commercial Rate
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-3xl font-bold font-mono text-white">
                        ₹{b2bCommercialRate}
                      </span>
                      <span className="text-xs text-slate-400 font-normal">/ kg</span>
                      <span className="text-xs text-slate-500 line-through">₹95/kg retail</span>
                    </div>
                  </div>
                  <Badge variant="mint" size="sm">
                    Save {b2bDiscountPct}%
                  </Badge>
                </div>

                {/* Breakdown Summary */}
                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Monthly Volume:</span>
                    <span className="font-mono font-medium text-white">{b2bMonthlyKg} kg</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Standard Retail Value:</span>
                    <span className="font-mono line-through text-slate-500">
                      {formatCurrency(b2bRetailEst)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-400 font-medium">
                    <span>Estimated Monthly Savings:</span>
                    <span className="font-mono font-semibold">-{formatCurrency(b2bMonthlySavings)}</span>
                  </div>
                  <div className="border-t border-slate-800 pt-3 flex justify-between items-baseline">
                    <div>
                      <span className="text-sm font-semibold text-white block">Net Monthly Contract</span>
                      <span className="text-[11px] text-slate-400">Exclusive of 18% GST</span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-bold font-mono text-white">
                      {formatCurrency(b2bMonthlyTotal)}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-white">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Guaranteed SLA: {currentSector.turnaround}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Dedicated account manager & complimentary initial test batch (50 kg).
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 relative z-10 space-y-3">
                <Button
                  variant="mint"
                  size="lg"
                  className="w-full gap-2 font-medium"
                  onClick={() => setB2bModalOpen(true)}
                >
                  <FileText className="w-4 h-4" />
                  Request Corporate Proposal
                </Button>
                <p className="text-center text-[11px] text-slate-400">
                  No commitment required. Custom service agreements available.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7-Point Quality Guarantee Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="p-8 sm:p-12 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative overflow-hidden">
          <div className="max-w-3xl space-y-5">
            <Badge variant="slate">The FreshFold 7-Point Guarantee</Badge>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
              Every Garment Inspected Before It Leaves Our Facility.
            </h2>
            <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
              If an item is damaged or missing during our care, we offer a no-questions-asked garment replacement guarantee up to 10x the service charge.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                'Enzyme stain pre-spot treatment',
                'Color bleed prevention baths',
                'Button & zipper integrity check',
                'Hypoallergenic fragrance infusion',
                'Laser precision fold & wrap',
                'Anti-dust sealed packaging',
                '4-digit encrypted OTP delivery',
              ].map((point, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700">
                  <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                  <span>{point}</span>
                </div>
              ))}
            </div>

            <div className="pt-3">
              <Link to="/booking">
                <Button variant="primary" size="lg" className="gap-2 font-medium">
                  Experience Freshness Now
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* B2B Proposal Request Modal */}
      <Modal
        isOpen={b2bModalOpen}
        onClose={() => setB2bModalOpen(false)}
        title="Request Corporate Proposal"
        description="Receive customized pricing, route schedules, and SLA guarantee for your business within 2 hours."
        maxWidth="lg"
      >
        <form onSubmit={handleB2bSubmit} className="space-y-4 pt-2">
          <div className="p-3 bg-mint-soft rounded-xl flex items-center justify-between text-xs">
            <span className="font-semibold text-mint-dark">Selected Tier: {currentSector.name}</span>
            <span className="font-mono font-bold text-ink">
              {b2bMonthlyKg} kg/mo @ ₹{b2bCommercialRate}/kg
            </span>
          </div>

          <Input
            label="Company / Enterprise Name"
            placeholder="e.g. The Oberoi Grand / Gold's Gym"
            value={b2bForm.companyName}
            onChange={(e) => setB2bForm({ ...b2bForm, companyName: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Person"
              placeholder="Full Name"
              value={b2bForm.contactName}
              onChange={(e) => setB2bForm({ ...b2bForm, contactName: e.target.value })}
              required
            />
            <Input
              label="Work Email"
              type="email"
              placeholder="procurement@company.com"
              value={b2bForm.email}
              onChange={(e) => setB2bForm({ ...b2bForm, email: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              placeholder="+91 98765 43210"
              value={b2bForm.phone}
              onChange={(e) => setB2bForm({ ...b2bForm, phone: e.target.value })}
              required
            />
            <Input
              label="Operating City"
              placeholder="e.g. Bengaluru, Mumbai"
              value={b2bForm.city}
              onChange={(e) => setB2bForm({ ...b2bForm, city: e.target.value })}
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setB2bModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="mint" size="md" className="gap-2 font-bold">
              <FileText className="w-4 h-4" />
              Submit Proposal Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

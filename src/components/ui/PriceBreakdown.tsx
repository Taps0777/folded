import React from 'react';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/formatters';
import { 
  Tag, 
  Truck, 
  Zap, 
  Coins, 
  ShieldCheck, 
  Plus,
  Scale,
  Gift,
  Receipt
} from 'lucide-react';

interface PriceBreakdownProps {
  subtotal: number;
  alterationsTotal: number;
  expressCharge: number;
  deliveryCharge: number;
  couponDiscount: number;
  loyaltyDiscount: number;
  totalAmount: number;
  isExpress: boolean;
  appliedCoupon?: { code: string; discount: number } | null;
  loyaltyBalance?: number;
  useLoyaltyPoints?: boolean;
  className?: string;
  compact?: boolean;
  animated?: boolean;
}

interface LineItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  amount: number;
  show: boolean;
  color: string;
  emphasis: boolean;
  prefix?: string;
  customValue?: string;
}

const baseLineItems = [
  { key: 'wash', label: 'Wash & Care', icon: <ShieldCheck className="w-4 h-4" /> },
  { key: 'alterations', label: 'Alterations & Repairs', icon: <Scale className="w-4 h-4" /> },
  { key: 'express', label: 'Express Surcharge', icon: <Zap className="w-4 h-4" /> },
  { key: 'delivery', label: 'Pickup & Delivery', icon: <Truck className="w-4 h-4" /> },
  { key: 'coupon', label: 'Promo Discount', icon: <Tag className="w-4 h-4" /> },
  { key: 'loyalty', label: 'Loyalty Points', icon: <Coins className="w-4 h-4" /> },
] as const;

export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
  subtotal,
  alterationsTotal,
  expressCharge,
  deliveryCharge,
  couponDiscount,
  loyaltyDiscount,
  totalAmount,
  isExpress,
  appliedCoupon,
  loyaltyBalance,
  useLoyaltyPoints,
  className,
  compact = false,
  animated = true,
}) => {
  const items: LineItem[] = [
    { 
      ...baseLineItems[0], 
      amount: subtotal, 
      show: true, 
      color: 'text-slate-600',
      emphasis: false 
    },
    { 
      ...baseLineItems[1], 
      amount: alterationsTotal, 
      show: alterationsTotal > 0, 
      color: 'text-slate-700 font-medium',
      emphasis: true,
      prefix: '+'
    },
    { 
      ...baseLineItems[2], 
      amount: expressCharge, 
      show: isExpress, 
      color: 'text-slate-700 font-medium',
      emphasis: true,
      prefix: '+'
    },
    { 
      ...baseLineItems[3], 
      amount: deliveryCharge, 
      show: true, 
      color: deliveryCharge === 0 ? 'text-emerald-600 font-semibold' : 'text-slate-600',
      emphasis: deliveryCharge === 0,
      customValue: deliveryCharge === 0 ? 'FREE' : undefined
    },
    { 
      ...baseLineItems[4], 
      amount: couponDiscount, 
      show: couponDiscount > 0, 
      color: 'text-emerald-600 font-semibold',
      emphasis: true,
      prefix: '-'
    },
    { 
      ...baseLineItems[5], 
      amount: loyaltyDiscount, 
      show: loyaltyDiscount > 0, 
      color: 'text-amber-600 font-semibold',
      emphasis: true,
      prefix: '-'
    },
  ].filter(item => item.show);

  if (compact) {
    return (
      <div className={cn('space-y-2 border-t border-slate-100 pt-3', className)}>
        {items.map((item, index) => (
          <div 
            key={item.key} 
            className={cn(
              'flex justify-between items-center text-xs transition-all duration-300',
              animated && 'animate-fade-in',
              item.emphasis && 'font-medium'
            )}
            style={{ transitionDelay: animated ? `${index * 50}ms` : '0ms' }}
          >
            <div className="flex items-center gap-2 text-slate-600">
              <span className={cn('w-4 h-4 flex-shrink-0', item.color?.replace('font-semibold', '').replace('font-medium', '').trim())}>
                {item.icon}
              </span>
              <span className={cn('text-slate-600', item.prefix && 'font-medium')}>
                {item.prefix || ''}{item.label}
              </span>
            </div>
            <span className={cn('font-mono text-slate-900', item.color)}>
              {item.customValue || `${item.prefix || ''}{formatCurrency(item.amount)}`}
            </span>
          </div>
        ))}
        <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 text-sm font-bold">
          <span className="text-slate-500">Total</span>
          <span className="text-slate-900 font-mono text-lg">{formatCurrency(totalAmount)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(
          'p-4 rounded-2xl border transition-all',
          animated && 'animate-scale-in'
        )}>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Subtotal</span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {formatCurrency(subtotal + alterationsTotal)}
          </div>
        </div>
        <div className={cn(
          'p-4 rounded-2xl border transition-all',
          animated && 'animate-scale-in'
        )}>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Tag className="w-3.5 h-3.5 text-emerald-600" />
            <span>Savings</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">
            -{formatCurrency(couponDiscount + loyaltyDiscount)}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className={cn('rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-3', animated && 'animate-fade-in')}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            Price Details
          </span>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div 
              key={item.key} 
              className={cn(
                'flex justify-between items-center text-xs transition-all duration-300',
                animated && 'animate-fade-in',
                item.emphasis && 'font-medium'
              )}
              style={{ transitionDelay: animated ? `${index * 80}ms` : '0ms' }}
            >
              <div className="flex items-center gap-2.5">
                <span className={cn('w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0', 
                  item.color.includes('emerald') ? 'bg-emerald-100 text-emerald-600' :
                  item.color.includes('amber') ? 'bg-amber-100 text-amber-600' :
                  item.color.includes('sky') ? 'bg-sky-100 text-sky-600' :
                  'bg-slate-100 text-slate-600'
                )}>
                  {item.icon}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600">{item.label}</span>
                  {item.key === 'coupon' && appliedCoupon && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-700">
                      {appliedCoupon.code}
                    </span>
                  )}
                </div>
              </div>
              <span className={cn('font-mono', item.color)}>
                {item.customValue 
                  ? item.customValue 
                  : `${item.prefix || ''}${formatCurrency(item.amount)}`}
              </span>
            </div>
          ))}
        </div>

        {/* Total Row */}
        <div className="pt-3 border-t border-slate-200/60 flex justify-between items-baseline">
          <span className="font-medium text-sm text-slate-500">Estimated Total</span>
          <span className="text-3xl font-bold font-mono text-slate-900">
            {formatCurrency(totalAmount)}
          </span>
        </div>

        {/* Trust Note */}
        <div className="pt-2 flex items-start gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>Calibrated scale check at doorstep. Only pay for the actual measured weight.</span>
        </div>
      </div>

      {/* Savings Badge */}
      {(couponDiscount > 0 || loyaltyDiscount > 0) && (
        <div className={cn(
          'p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 flex items-center justify-between text-xs',
          animated && 'animate-fade-in'
        )}>
          <div className="flex items-center gap-2 text-emerald-700 font-semibold">
            <Gift className="w-4 h-4" />
            <span>You saved {formatCurrency(couponDiscount + loyaltyDiscount)} on this order!</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-600">
            <Coins className="w-3.5 h-3.5" />
            <span>{loyaltyBalance || 0} pts remaining</span>
          </div>
        </div>
      )}

      {/* Loyalty Hint */}
      {loyaltyBalance && loyaltyBalance > 0 && !useLoyaltyPoints && loyaltyDiscount === 0 && (
        <div className={cn(
          'p-3 rounded-2xl bg-amber-50/80 border border-amber-200/70 flex items-center justify-between text-xs cursor-pointer hover:bg-amber-50 transition-colors',
          animated && 'animate-fade-in'
        )}>
          <div className="flex items-center gap-2 text-amber-700">
            <Coins className="w-4 h-4" />
            <span>Use {loyaltyBalance} points (worth {formatCurrency(Math.floor(loyaltyBalance / 100))}) for extra savings?</span>
          </div>
          <Plus className="w-4 h-4 text-amber-600" />
        </div>
      )}
    </div>
  );
};

// Sticky sidebar version for booking page
export const StickyPriceBreakdown: React.FC<PriceBreakdownProps> = (props) => {
  return (
    <div className="sticky top-24 z-10">
      <PriceBreakdown {...props} compact />
    </div>
  );
};
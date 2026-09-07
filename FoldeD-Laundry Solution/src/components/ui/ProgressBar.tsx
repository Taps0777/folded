import React from 'react';
import type { OrderStatus } from '../../types';
import { ORDER_STATUS_DETAILS, getOrderProgressPercent } from '../../lib/constants';
import { Check, Clock, Truck, Shirt, PackageCheck, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ProgressBarProps {
  status: OrderStatus;
  className?: string;
  showDetails?: boolean;
}

const MILESTONES = [
  { id: 'placed', label: 'Order Placed', icon: Clock, threshold: 10 },
  { id: 'pickup', label: 'Picked Up', icon: Truck, threshold: 40 },
  { id: 'processing', label: 'Garment Care', icon: Shirt, threshold: 75 },
  { id: 'delivery', label: 'Out for Delivery', icon: Truck, threshold: 95 },
  { id: 'delivered', label: 'Delivered', icon: PackageCheck, threshold: 100 },
];

export const ProgressBar: React.FC<ProgressBarProps> = ({ status, className, showDetails = true }) => {
  const percent = getOrderProgressPercent(status);
  const statusInfo = ORDER_STATUS_DETAILS[status] || {
    label: status,
    description: '',
    badgeVariant: 'slate',
  };

  const isCancelled = status === 'CANCELLED';
  const isHold = status === 'ON_HOLD' || status === 'FAILED_PICKUP';

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Current Status Pill */}
      {showDetails && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'w-3 h-3 rounded-full animate-ping',
                isCancelled ? 'bg-red-500' : isHold ? 'bg-amber-500' : 'bg-mint'
              )}
            />
            <span className="font-display font-bold text-base text-ink">{statusInfo.label}</span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {isCancelled ? 'Cancelled' : isHold ? 'Action Required' : `${percent}% Completed`}
          </span>
        </div>
      )}

      {/* Progress Track Bar */}
      <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-700 ease-out rounded-full',
            isCancelled
              ? 'bg-red-500'
              : isHold
              ? 'bg-amber-500'
              : 'bg-gradient-to-r from-mint to-mint-dark'
          )}
          style={{ width: `${isCancelled ? 100 : percent}%` }}
        />
      </div>

      {/* Visual Milestones */}
      {!isCancelled && !isHold && (
        <div className="grid grid-cols-5 gap-1 pt-1 text-center">
          {MILESTONES.map((step) => {
            const isDone = percent >= step.threshold;
            const isCurrent = percent < step.threshold && percent >= step.threshold - 25;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors mb-1.5',
                    isDone
                      ? 'bg-mint text-white'
                      : isCurrent
                      ? 'bg-mint-soft text-mint-dark ring-2 ring-mint ring-offset-2 font-bold animate-pulse'
                      : 'bg-slate-100 text-slate-400'
                  )}
                >
                  {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <span
                  className={cn(
                    'text-[10px] sm:text-xs leading-tight',
                    isDone || isCurrent ? 'font-semibold text-ink' : 'text-slate-400'
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {isCancelled && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          This order was cancelled. Any pre-authorized charges have been reversed to your account.
        </div>
      )}

      {isHold && (
        <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          {statusInfo.description || 'Our support team is reviewing your pickup slot details.'}
        </div>
      )}
    </div>
  );
};

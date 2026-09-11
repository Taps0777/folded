import React from 'react';
import { cn } from '../../utils/cn';
import { Badge } from './Badge';
import { 
  Sparkles, 
  Zap, 
  Leaf, 
  Clock, 
  Star, 
  Crown,
  Gem
} from 'lucide-react';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    description: string;
    pricing_type: 'per_kg' | 'per_item';
    base_price: number;
    turnaround_hours: number;
    popular?: boolean;
    tag?: string;
    category: string;
    fabric_types?: string[];
  };
  isSelected: boolean;
  onSelect: () => void;
  formatCurrency: (amount: number) => string;
}

const FabricIcons: Record<string, React.ReactNode> = {
  cotton: <span className="text-[10px]">👕</span>,
  silk: <span className="text-[10px]">👘</span>,
  wool: <span className="text-[10px]">🧶</span>,
  linen: <span className="text-[10px]">👚</span>,
  denim: <span className="text-[10px]">👖</span>,
  synthetic: <span className="text-[10px]">🧥</span>,
  delicate: <span className="text-[10px]">🩱</span>,
  formal: <span className="text-[10px]">🤵</span>,
  casual: <span className="text-[10px]">👕</span>,
  bedding: <span className="text-[10px]">🛏️</span>,
  towels: <span className="text-[10px]">🧺</span>,
  curtains: <span className="text-[10px]">🪟</span>,
};

const CategoryIconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  wash_fold: Sparkles,
  wash_iron: Zap,
  iron_only: Zap,
  dry_clean: Gem,
  premium_care: Crown,
  spa: Leaf,
};

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  isSelected,
  onSelect,
  formatCurrency,
}) => {
  const CategoryIcon = CategoryIconComponents[service.category] || Sparkles;
  const fabricTypes = service.fabric_types || 
    (service.category === 'dry_clean' ? ['silk', 'wool', 'formal'] : 
     service.category === 'wash_fold' ? ['cotton', 'casual', 'denim'] : ['cotton', 'linen']);

  return (
    <button
      onClick={onSelect}
      type="button"
      className={cn(
        'relative group p-5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden',
        isSelected
          ? 'border-ink dark:border-cream bg-slate-50/70 shadow-lg ring-2 ring-slate-900/10 scale-[1.02]'
          : 'border-slate-200 bg-surface hover:border-slate-300 hover:bg-slate-50 hover:shadow-md hover:-translate-y-1'
      )}
      style={{ minHeight: '280px' }}
      aria-pressed={isSelected}
      aria-label={isSelected ? `${service.name} selected` : `Select ${service.name}`}
    >
      {/* Selection indicator background */}
      <div 
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          isSelected ? 'opacity-100 bg-gradient-to-br from-slate-900/5 via-transparent to-transparent' : 'opacity-0'
        )}
      />

      {/* Popular/Tag badges */}
      <div className="relative flex items-start justify-between z-10">
        <div className="flex items-center gap-1.5">
          {service.popular && (
            <Badge variant="amber" size="sm" className="animate-pulse">
              <Star className="w-3 h-3" />
              Most Popular
            </Badge>
          )}
          {service.tag && (
            <Badge variant="mint" size="sm">
              {service.tag}
            </Badge>
          )}
        </div>
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-all',
          isSelected ? 'bg-ink text-cream dark:bg-cream dark:text-ink' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
        )}>
          <CategoryIcon className={cn(
            'transition-transform duration-300 group-hover:scale-110',
            isSelected ? 'text-emerald-400' : 'text-slate-600'
          )} />
        </div>
      </div>

      {/* Service Info */}
      <div className="relative z-10 space-y-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-slate-200 transition-colors flex items-center justify-center flex-shrink-0">
              <CategoryIcon className={cn(
                isSelected ? 'text-slate-900' : 'text-slate-600',
                'transition-colors duration-300'
              )} />
            </div>
            <div className="min-w-0">
              <h3 className={cn(
                'font-bold text-lg text-slate-900 truncate transition-colors',
                isSelected ? 'text-slate-900' : 'text-slate-900'
              )}>
                {service.name}
              </h3>
              <p className={cn(
                'text-xs text-slate-500 mt-1 line-clamp-2 transition-colors',
                isSelected ? 'text-slate-600' : 'text-slate-500'
              )}>
                {service.description}
              </p>
            </div>
          </div>
        </div>

        {/* Fabric Types */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100/60">
          <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">Suitable for:</span>
          {fabricTypes.slice(0, 5).map((fabric, idx) => (
            <span 
              key={`${fabric}-${idx}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 text-xs transition-all group-hover:bg-slate-100"
            >
              {FabricIcons[fabric] || <span className="text-[10px]">🏷️</span>}
              <span className="capitalize">{fabric}</span>
            </span>
          ))}
          {fabricTypes.length > 5 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-xs">
              +{fabricTypes.length - 5} more
            </span>
          )}
        </div>

        {/* Pricing & Turnaround */}
        <div className="pt-4 border-t border-slate-100/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Price</span>
              <span className={cn(
                'font-mono font-bold text-xl transition-colors',
                isSelected ? 'text-slate-900' : 'text-emerald-600'
              )}>
                {formatCurrency(service.base_price)}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                /{service.pricing_type === 'per_kg' ? 'kg' : 'item'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium text-slate-700">{service.turnaround_hours}h</span>
              <span className="text-slate-400">turnaround</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selection ring animation */}
      {isSelected && (
        <div className="absolute inset-0 border-2 border-ink dark:border-cream rounded-2xl pointer-events-none animate-pulse" />
      )}

      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute bottom-3 right-3 z-20">
          <div className="w-7 h-7 rounded-full bg-ink text-cream dark:bg-cream dark:text-ink flex items-center justify-center shadow-lg animate-scale-in">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
};
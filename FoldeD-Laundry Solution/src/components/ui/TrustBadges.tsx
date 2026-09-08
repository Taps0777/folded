import React from 'react';
import { cn } from '../../utils/cn';
import { 
  Shield, 
  Scale, 
  Leaf, 
  Truck, 
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface TrustBadgeItem {
  icon: React.ReactNode;
  title: string;
  description: string;
  color?: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
}

const trustBadges: TrustBadgeItem[] = [
  {
    icon: <Shield className="w-5 h-5" />,
    title: '100% Garment Safe',
    description: 'Color & fabric guarantee on every item',
    color: 'emerald',
  },
  {
    icon: <Scale className="w-5 h-5" />,
    title: 'Doorstep Weighing',
    description: 'Calibrated digital scale at pickup',
    color: 'blue',
  },
  {
    icon: <Leaf className="w-5 h-5" />,
    title: 'Eco-Friendly Wash',
    description: 'Biodegradable detergents & cold cycles',
    color: 'emerald',
  },
  {
    icon: <Truck className="w-5 h-5" />,
    title: 'Express 24h Delivery',
    description: 'Priority service available city-wide',
    color: 'amber',
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: '7-Stage Care Process',
    description: 'Sort → Wash → Rinse → Dry → Iron → Fold → QC',
    color: 'purple',
  },
  {
    icon: <RotateCcw className="w-5 h-5" />,
    title: 'Free Re-Wash',
    description: 'Not satisfied? We\'ll redo it free',
    color: 'rose',
  },
];

const colorClasses = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 icon-emerald-600',
  blue: 'bg-sky-50 text-sky-700 border-sky-200/80 icon-sky-600',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/80 icon-amber-600',
  purple: 'bg-purple-50 text-purple-700 border-purple-200/80 icon-purple-600',
  rose: 'bg-rose-50 text-rose-700 border-rose-200/80 icon-rose-600',
};

const iconColorClasses = {
  emerald: 'text-emerald-600',
  blue: 'text-sky-600',
  amber: 'text-amber-600',
  purple: 'text-purple-600',
  rose: 'text-rose-600',
};

export const TrustBadges: React.FC<{
  className?: string;
  variant?: 'grid' | 'carousel' | 'stack';
  showIcons?: boolean;
}> = ({ className, variant = 'grid', showIcons = true }) => {
  if (variant === 'carousel') {
    return (
      <div className={cn('overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory flex gap-4', className)}>
        {trustBadges.map((badge, index) => (
          <div 
            key={index}
            className={cn(
              'flex-shrink-0 w-64 sm:w-72 snap-center p-4 rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
              colorClasses[badge.color || 'emerald']
            )}
          >
            {showIcons && (
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', iconColorClasses[badge.color || 'emerald'])}>
                {badge.icon}
              </div>
            )}
            <h4 className="font-semibold text-sm mb-1">{badge.title}</h4>
            <p className="text-xs leading-relaxed opacity-90">{badge.description}</p>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'stack') {
    return (
      <div className={cn('space-y-3', className)}>
        {trustBadges.map((badge, index) => (
          <div 
            key={index}
            className={cn(
              'flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 hover:shadow-md hover:bg-white/80',
              colorClasses[badge.color || 'emerald']
            )}
          >
            {showIcons && (
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', iconColorClasses[badge.color || 'emerald'])}>
                {badge.icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">{badge.title}</h4>
              <p className="text-xs leading-relaxed opacity-90 truncate">{badge.description}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {trustBadges.map((badge, index) => (
        <div 
          key={index}
          className={cn(
            'p-5 rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group',
            colorClasses[badge.color || 'emerald']
          )}
        >
          {showIcons && (
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300',
              iconColorClasses[badge.color || 'emerald']
            )}>
              {badge.icon}
            </div>
          )}
          <h4 className="font-semibold text-sm mb-2">{badge.title}</h4>
          <p className="text-xs leading-relaxed opacity-90">{badge.description}</p>
        </div>
      ))}
    </div>
  );
};

// Compact inline version for headers/footers
export const InlineTrustBadges: React.FC<{
  count?: number;
  className?: string;
}> = ({ count = 4, className }) => {
  const items = trustBadges.slice(0, count);
  
  return (
    <div className={cn('flex flex-wrap items-center gap-3 sm:gap-4', className)}>
      {items.map((badge, index) => (
        <div 
          key={index}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all',
            colorClasses[badge.color || 'emerald']
          )}
        >
          <span className={cn('w-4 h-4 flex-shrink-0', iconColorClasses[badge.color || 'emerald'])}>
            {badge.icon}
          </span>
          <span className="hidden sm:inline">{badge.title}</span>
        </div>
      ))}
    </div>
  );
};
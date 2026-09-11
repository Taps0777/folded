import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, Clock, Scale, Lock, Phone, Mail, MapPin } from 'lucide-react';

// Brand chrome: the footer is always ink (both modes), so it uses fixed brand
// tokens — cream text on ink — rather than the flipping slate/neutral ramp.
const TRUST_POINTS = [
  {
    icon: Scale,
    title: 'Digital Scale Weighing',
    body: 'Weighed right in front of you at pickup with digital bag sealing.',
  },
  {
    icon: ShieldCheck,
    title: '7-Point Inspection',
    body: 'Every garment checked for stains, loose buttons, and fabric softness.',
  },
  {
    icon: Clock,
    title: '24h Express Delivery',
    body: 'Need it urgent? Get crisp, folded laundry delivered in under 24 hours.',
  },
  {
    icon: Lock,
    title: 'Doorstep PIN Handover',
    body: 'Orders delivered strictly after your unique 4-digit PIN verification.',
  },
];

const LINK_GROUPS = [
  {
    heading: 'Garment Care',
    links: ['Wash & Fold', 'Wash & Iron', 'Dry Cleaning', 'Premium Care', 'Household Items'],
  },
  {
    heading: 'Platform',
    links: ['Book a Pickup', 'Track Live Orders', 'My Orders', 'Rewards & Points', 'Help Center'],
  },
];

const linkClass = 'text-cream/65 hover:text-mint transition-colors';
const columnHeading = 'text-xs font-semibold uppercase tracking-wider text-cream/50 mb-4';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-ink text-cream pt-16 pb-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Trust guarantees */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-12 border-b border-cream/10">
          {TRUST_POINTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-cream/5 border border-cream/10 text-mint flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-cream">{title}</h4>
                <p className="text-xs text-cream/60 mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Links */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 py-12 border-b border-cream/10">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-cream/5 border border-cream/10 flex items-center justify-center text-mint">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-display font-semibold text-lg tracking-tight text-cream">FoldeD</span>
              <span className="w-1.5 h-1.5 rounded-full bg-mint" />
            </div>
            <p className="text-sm text-cream/60 leading-relaxed max-w-sm">
              Freshness delivered to your doorstep. Transforming everyday laundry into a seamless,
              premium experience with real-time tracking and eco-friendly care.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-cream/55">
              <MapPin className="w-3.5 h-3.5" /> Bengaluru • Mumbai • Delhi NCR
            </div>
          </div>

          {LINK_GROUPS.map((group) => (
            <div key={group.heading}>
              <h5 className={columnHeading}>{group.heading}</h5>
              <ul className="space-y-2.5 text-sm">
                {group.links.map((label) => (
                  <li key={label}>
                    <Link to="/booking" className={linkClass}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h5 className={columnHeading}>Customer Care</h5>
            <ul className="space-y-2.5 text-sm text-cream/65">
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-cream/45" />
                <span>+91 80 4040 5000</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-cream/45" />
                <span>support@folded.in</span>
              </li>
              <li className="pt-2 text-xs text-cream/45">
                Operating Hours: 8:00 AM – 9:00 PM (Every day)
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-cream/45">
          <div>© {new Date().getFullYear()} FoldeD Technologies Pvt. Ltd. All rights reserved.</div>
          <div>Crafted for clean, crisp living.</div>
        </div>
      </div>
    </footer>
  );
};

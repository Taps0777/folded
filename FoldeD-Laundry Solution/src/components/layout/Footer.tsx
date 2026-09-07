import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, Clock, Scale, Lock, Phone, Mail, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Trust Guarantees Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-12 border-b border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-white">Digital Scale Weighing</h4>
              <p className="text-xs text-slate-400 mt-0.5">Weighed right in front of you at pickup with digital bag sealing.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-white">7-Point Inspection</h4>
              <p className="text-xs text-slate-400 mt-0.5">Every garment checked for stains, loose buttons, and fabric softness.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-white">24h Express Delivery</h4>
              <p className="text-xs text-slate-400 mt-0.5">Need it urgent? Get crisp, folded laundry delivered in under 24 hours.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-white">Doorstep PIN Handover</h4>
              <p className="text-xs text-slate-400 mt-0.5">Orders delivered strictly after your unique 4-digit PIN verification.</p>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 py-12 border-b border-slate-800">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-semibold text-lg tracking-tight text-white">
                Fresh<span className="text-slate-400 font-normal">Fold</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Freshness delivered to your doorstep. Transforming everyday laundry into a seamless, industrial-grade luxury experience with real-time tracking and eco-friendly care.
            </p>
            <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Bengaluru • Mumbai • Delhi NCR
              </span>
            </div>
          </div>

          {/* Services */}
          <div>
            <h5 className="font-medium text-xs uppercase tracking-wider text-slate-300 mb-4">Garment Care</h5>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li><Link to="/booking" className="hover:text-white transition-colors">Wash & Eco-Fold</Link></li>
              <li><Link to="/booking" className="hover:text-white transition-colors">Wash & Steam Iron</Link></li>
              <li><Link to="/booking" className="hover:text-white transition-colors">Steam Press Only</Link></li>
              <li><Link to="/booking" className="hover:text-white transition-colors">Artisan Dry Clean</Link></li>
              <li><Link to="/booking" className="hover:text-white transition-colors">Silk & Delicate Spa</Link></li>
              <li><Link to="/booking" className="hover:text-white transition-colors">Sneaker Revival</Link></li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h5 className="font-medium text-xs uppercase tracking-wider text-slate-300 mb-4">Platform</h5>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li><Link to="/booking" className="hover:text-white transition-colors">Book a Pickup</Link></li>
              <li><Link to="/dashboard" className="hover:text-white transition-colors">Track Live Orders</Link></li>
              <li><Link to="/staff" className="hover:text-white transition-colors">Staff Operations Hub</Link></li>
              <li><Link to="/admin" className="hover:text-white transition-colors">Operations Control Tower</Link></li>
              <li><a href="#calculator" className="hover:text-white transition-colors">Instant Price Calculator</a></li>
              <li><a href="#subscriptions" className="hover:text-white transition-colors">Monthly Bag Passes</a></li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div>
            <h5 className="font-medium text-xs uppercase tracking-wider text-slate-300 mb-4">Customer Care</h5>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>+91 80 4040 5000</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>support@freshfold.in</span>
              </li>
              <li className="pt-2 text-[11px] text-slate-500">
                Operating Hours: 8:00 AM – 9:00 PM (Every day)
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} FreshFold Technologies Pvt. Ltd. All rights reserved.
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            Crafted for clean, crisp living.
          </div>
        </div>
      </div>
    </footer>
  );
};

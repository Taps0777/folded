import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { authService } from '../../services/api/authService';
import type { UserRole } from '../../types';
import { ROLE_LABELS } from '../../lib/constants';
import {
  Sparkles,
  ShoppingBag,
  Shield,
  Truck,
  Menu,
  X,
  ChevronDown,
  User,
  LogIn,
  LogOut,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentRole, setCurrentRole, currentUser } = useApp();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  React.useEffect(() => {
    if (currentUser) {
      import('../../services/api/orderService').then(({ orderService }) => {
        orderService.getOrdersByUser(currentUser.id).then(orders => {
          setActiveOrdersCount(orders.filter(
            (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REFUNDED'
          ).length);
        });
      });
    }
  }, [currentUser]);

  const rolesList: UserRole[] = ['customer', 'admin', 'pickup_staff', 'laundry_staff', 'delivery_staff'];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full bg-white/85 backdrop-blur-md border-b border-slate-200/70 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display font-semibold text-lg tracking-tight text-slate-900">
              FreshFold
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-600">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-full transition-colors ${
              isActive('/')
                ? 'text-slate-900 font-semibold bg-slate-100'
                : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Home
          </Link>
          <a
            href="/#calculator"
            className="px-3 py-1.5 rounded-full hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            Services & Pricing
          </a>
          <Link
            to="/booking"
            className={`px-3 py-1.5 rounded-full transition-colors ${
              isActive('/booking')
                ? 'text-slate-900 font-semibold bg-slate-100'
                : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Book Pickup
          </Link>
          <Link
            to="/dashboard"
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
              isActive('/dashboard')
                ? 'text-slate-900 font-semibold bg-slate-100'
                : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>My Orders</span>
            {activeOrdersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeOrdersCount}
              </span>
            )}
          </Link>
          <Link
            to="/staff"
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
              isActive('/staff')
                ? 'text-slate-900 font-semibold bg-slate-100'
                : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-slate-400" />
            <span>Staff Portal</span>
          </Link>
          <Link
            to="/admin"
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
              isActive('/admin')
                ? 'text-slate-900 font-semibold bg-slate-100'
                : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Admin</span>
          </Link>
        </nav>

        {/* Right Action Controls */}
        <div className="hidden sm:flex items-center gap-2.5">
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/70 text-slate-800 text-xs font-medium transition-colors border border-slate-200/60"
                title="Account menu"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="max-w-[110px] truncate">{currentUser.full_name || currentUser.email}</span>
                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                  {currentUser.role}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {roleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{currentUser.full_name || 'Active User'}</p>
                    <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                  </div>
                  
                  <div className="py-1">
                    <Link
                      to={currentUser.role === 'admin' ? '/admin' : currentUser.role === 'customer' ? '/dashboard' : '/staff'}
                      onClick={() => setRoleDropdownOpen(false)}
                      className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors text-slate-700"
                    >
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Go to Dashboard</span>
                    </Link>
                    <Link
                      to="/login"
                      onClick={() => setRoleDropdownOpen(false)}
                      className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors text-slate-700"
                    >
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      <span>Switch Account / Demo Logins</span>
                    </Link>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 px-3.5 py-1.5 flex justify-between items-center text-[11px]">
                    <button
                      onClick={async () => {
                        setRoleDropdownOpen(false);
                        await authService.signOut();
                      }}
                      className="text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <LogOut className="w-3 h-3" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium transition-colors border border-transparent hover:border-slate-200"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign In</span>
              </Link>

              {/* Discreet Persona Switcher Pill */}
              <div className="relative">
                <button
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-medium transition-colors border border-slate-200/60"
                  title="Switch demo persona for testing"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{ROLE_LABELS[currentRole]?.title}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {roleDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200/80 py-1.5 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Switch Demo Persona
                    </div>
                    {rolesList.map((role) => (
                      <button
                        key={role}
                        onClick={() => {
                          setCurrentRole(role);
                          setRoleDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                          currentRole === role ? 'font-semibold text-emerald-700 bg-emerald-50/60' : 'text-slate-700'
                        }`}
                      >
                        <span>{ROLE_LABELS[role]?.title}</span>
                        {currentRole === role && <span className="text-emerald-600 font-bold">✓</span>}
                      </button>
                    ))}
                    <div className="pt-1 border-t border-slate-100 px-3 py-1.5 flex justify-between items-center text-[11px] text-slate-400">
                      <Link
                        to="/login"
                        onClick={() => setRoleDropdownOpen(false)}
                        className="hover:text-emerald-600 flex items-center gap-1 transition-colors"
                      >
                        <Shield className="w-3 h-3" />
                        Live DB Logins
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Primary CTA: Obsidian Black */}
          <Link to="/booking">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium shadow-xs transition-all active:scale-95">
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Book Pickup</span>
            </button>
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200/80 bg-white px-4 pt-3 pb-6 space-y-2">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Home
          </Link>
          <Link
            to="/booking"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Book Pickup
          </Link>
          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            My Orders ({activeOrdersCount} Active)
          </Link>
          <Link
            to="/staff"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Staff Operations
          </Link>
          <Link
            to="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Admin Operations Tower
          </Link>

          {/* Mobile Auth */}
          <div className="pt-2 border-t border-slate-100">
            {currentUser ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div>
                  <p className="text-xs font-semibold text-slate-800 truncate">{currentUser.full_name || currentUser.email}</p>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase">{currentUser.role}</p>
                </div>
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await authService.signOut();
                  }}
                  className="text-xs text-rose-600 font-medium px-2 py-1 rounded-lg hover:bg-rose-50"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In to Account
              </Link>
            )}
          </div>

          {/* Mobile Persona Switcher */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Viewing as
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {rolesList.map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    setCurrentRole(role);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                    currentRole === role ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {ROLE_LABELS[role]?.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

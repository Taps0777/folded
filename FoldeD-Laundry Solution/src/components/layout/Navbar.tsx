import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { authService } from '../../services/api/authService';
import { useTheme } from '../../context/ThemeContext';
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
  Sun,
  Moon,
} from 'lucide-react';

// Styling lives in the token layer: slate/mint/ink adapt to dark mode via CSS
// variables, so only the intentional light↔dark swaps (cream header, ink pills)
// carry explicit dark: variants.
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const navPill = (active: boolean) =>
  `px-3 py-1.5 rounded-full transition-colors ${focusRing} ${
    active
      ? 'bg-ink text-cream font-semibold dark:bg-cream dark:text-ink'
      : 'text-slate-600 hover:bg-slate-100 hover:text-foreground dark:text-slate-300 dark:hover:bg-slate-800/60'
  }`;

const menuItem =
  'w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-slate-800/60';

const mobileItem =
  'block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-slate-800/60';

export const Navbar: React.FC = () => {
  const { currentRole, setCurrentRole, currentUser } = useApp();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  React.useEffect(() => {
    if (!currentUser) {
      setActiveOrdersCount(0);
      return;
    }

    // Guard against setting state after unmount / after the user changed, and
    // swallow failures — a badge count is never worth an unhandled rejection.
    let active = true;
    (async () => {
      try {
        const { orderService } = await import('../../services/api/orderService');
        const orders = await orderService.getOrdersByUser(currentUser.id);
        if (!active) return;
        setActiveOrdersCount(
          orders.filter(
            (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'REFUNDED'
          ).length
        );
      } catch (err) {
        console.error('Failed to load active order count', err);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser]);

  const rolesList: UserRole[] = ['customer', 'admin', 'pickup_staff', 'laundry_staff', 'delivery_staff'];

  const isActive = (path: string) => location.pathname === path;
  const dashboardPath =
    currentUser?.role === 'admin' ? '/admin' : currentUser?.role === 'customer' ? '/dashboard' : '/staff';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 bg-cream/80 backdrop-blur-xl transition-colors dark:border-slate-800/70 dark:bg-ink/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <img src="/screen.png" alt="FoldeD Logo" className="w-9 h-9 rounded-2xl group-hover:scale-105 transition-transform" />
          <div className="flex items-baseline gap-1">
            <span className="font-display font-semibold text-lg tracking-tight text-foreground">
              FoldeD
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-mint" />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
          <Link to="/" className={navPill(isActive('/'))}>
            Home
          </Link>
          <a href="/#calculator" className={navPill(false)}>
            Services &amp; Pricing
          </a>
          <Link to="/booking" className={navPill(isActive('/booking'))}>
            Book Pickup
          </Link>
          {currentUser?.role === 'customer' && (
            <Link to="/dashboard" className={`${navPill(isActive('/dashboard'))} flex items-center gap-1.5`}>
              <span>My Orders</span>
              {activeOrdersCount > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-mint text-ink text-[10px] font-bold flex items-center justify-center">
                  {activeOrdersCount}
                </span>
              )}
            </Link>
          )}
          {currentUser && ['pickup_staff', 'laundry_staff', 'delivery_staff'].includes(currentUser.role) && (
            <Link to="/staff" className={`${navPill(isActive('/staff'))} flex items-center gap-1.5`}>
              <Truck className="w-3.5 h-3.5" />
              <span>Staff Portal</span>
            </Link>
          )}
          {currentUser?.role === 'admin' && (
            <Link to="/admin" className={`${navPill(isActive('/admin'))} flex items-center gap-1.5`}>
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        {/* Right controls (desktop) */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={`inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-full border border-slate-200/80 bg-surface text-slate-800 text-xs font-medium hover:bg-slate-100 transition-colors dark:border-slate-700/70 dark:text-slate-200 dark:hover:bg-slate-800/60 ${focusRing}`}
                title="Account menu"
              >
                <span className="w-2 h-2 rounded-full bg-mint" />
                <span className="max-w-[110px] truncate">{currentUser.full_name || currentUser.email}</span>
                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                  {currentUser.role}
                </span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 bg-surface text-foreground rounded-2xl shadow-elevated border border-slate-200/80 py-2 z-50 animate-scale-in"
                >
                  <div className="px-3.5 py-2 border-b border-slate-200/70">
                    <p className="text-xs font-bold text-foreground truncate">{currentUser.full_name || 'Active User'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                  </div>
                  <div className="py-1">
                    <Link to={dashboardPath} onClick={() => setMenuOpen(false)} className={menuItem}>
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Go to Dashboard</span>
                    </Link>
                    <Link to="/login" onClick={() => setMenuOpen(false)} className={menuItem}>
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      <span>Switch Account / Demo Logins</span>
                    </Link>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200/70 px-3.5 py-1.5">
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        await authService.signOut();
                      }}
                      className="text-rose-600 hover:text-rose-700 font-medium text-[11px] flex items-center gap-1.5 transition-colors"
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors dark:text-slate-300 dark:hover:bg-slate-800/60 ${focusRing}`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>

              {/* Discreet Persona Switcher Pill — dev builds only. It flips the
                  client-side role without auth, so it must not ship to prod. */}
              {import.meta.env.DEV && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-200/80 bg-surface text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors dark:border-slate-700/70 dark:text-slate-200 dark:hover:bg-slate-800/60 ${focusRing}`}
                    title="Switch demo persona for testing"
                  >
                    <span className="w-2 h-2 rounded-full bg-mint" />
                    <span>{ROLE_LABELS[currentRole]?.title}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-60 bg-surface text-foreground rounded-2xl shadow-elevated border border-slate-200/80 py-1.5 z-50 animate-scale-in">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/70">
                        Switch Demo Persona
                      </div>
                      {rolesList.map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            setCurrentRole(role);
                            setMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-100 transition-colors ${
                            currentRole === role ? 'font-semibold text-emerald-700 bg-emerald-50/60' : 'text-slate-700'
                          }`}
                        >
                          <span>{ROLE_LABELS[role]?.title}</span>
                          {currentRole === role && <span className="text-mint font-bold">✓</span>}
                        </button>
                      ))}
                      <div className="pt-1 border-t border-slate-200/70 px-3 py-1.5 text-[11px]">
                        <Link
                          to="/login"
                          onClick={() => setMenuOpen(false)}
                          className="text-slate-500 hover:text-mint flex items-center gap-1 transition-colors"
                        >
                          <Shield className="w-3 h-3" />
                          Live DB Logins
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors dark:text-slate-300 dark:hover:bg-slate-800/60 ${focusRing}`}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          <Link
            to="/booking"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ink text-cream dark:bg-cream dark:text-ink hover:bg-ink/90 dark:hover:bg-cream/90 text-xs font-medium shadow-sm transition-all active:scale-95 ${focusRing}`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-mint" />
            <span>Book Pickup</span>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <div className="flex sm:hidden items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 ${focusRing}`}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className={`p-2 rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60 ${focusRing}`}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200/70 bg-surface px-4 pt-3 pb-6 space-y-1.5">
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className={mobileItem}>
            Home
          </Link>
          <a href="/#calculator" onClick={() => setMobileMenuOpen(false)} className={mobileItem}>
            Services &amp; Pricing
          </a>
          <Link to="/booking" onClick={() => setMobileMenuOpen(false)} className={mobileItem}>
            Book Pickup
          </Link>
          {currentUser?.role === 'customer' && (
            <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className={mobileItem}>
              My Orders {activeOrdersCount > 0 && `(${activeOrdersCount} active)`}
            </Link>
          )}
          {currentUser && ['pickup_staff', 'laundry_staff', 'delivery_staff'].includes(currentUser.role) && (
            <Link to="/staff" onClick={() => setMobileMenuOpen(false)} className={mobileItem}>
              Staff Operations
            </Link>
          )}
          {currentUser?.role === 'admin' && (
            <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className={mobileItem}>
              Admin Operations Tower
            </Link>
          )}

          {/* Mobile auth */}
          <div className="pt-3 border-t border-slate-200/70">
            {currentUser ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {currentUser.full_name || currentUser.email}
                  </p>
                  <p className="text-[10px] text-emerald-700 font-bold uppercase">{currentUser.role}</p>
                </div>
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await authService.signOut();
                  }}
                  className="text-xs text-rose-600 font-medium px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-ink text-cream dark:bg-cream dark:text-ink text-xs font-semibold"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In to Account
              </Link>
            )}
          </div>

          {/* Mobile Persona Switcher — dev builds only (see desktop pill) */}
          {import.meta.env.DEV && (
            <div className="pt-3 border-t border-slate-200/70">
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
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      currentRole === role
                        ? 'bg-ink text-cream dark:bg-cream dark:text-ink'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
                    }`}
                  >
                    {ROLE_LABELS[role]?.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

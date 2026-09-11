import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { authService } from '../../services/api/authService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  Sparkles,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Truck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Phone,
  Eye,
  EyeOff,
  Zap,
  RefreshCw
} from 'lucide-react';
import type { UserRole } from '../../types';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, showToast } = useApp();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAccountSwitchForm, setShowAccountSwitchForm] = useState(false);

  // Demo accounts configured in Supabase
  const DEMO_ACCOUNTS: { label: string; email: string; role: UserRole; roleBadge: string; icon: any }[] = [
    { label: 'Admin (Priya Sharma)', email: 'admin@freshfold.in', role: 'admin', roleBadge: 'Admin Ops', icon: ShieldCheck },
    { label: 'Customer (Rajesh Kumar)', email: 'customer@freshfold.in', role: 'customer', roleBadge: 'Customer', icon: UserCheck },
    { label: 'Pickup Specialist (Amit Patel)', email: 'pickup@freshfold.in', role: 'pickup_staff', roleBadge: 'Field Agent', icon: Truck },
    { label: 'Laundry Lead (Sunita Rao)', email: 'laundry@freshfold.in', role: 'laundry_staff', roleBadge: 'Facility Lead', icon: Sparkles },
    { label: 'Delivery Runner (Vikram Singh)', email: 'delivery@freshfold.in', role: 'delivery_staff', roleBadge: 'Dispatch', icon: Truck }
  ];

  const redirectByRole = (role: string) => {
    const from = (location.state as any)?.from?.pathname;
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    if (role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (role === 'pickup_staff' || role === 'laundry_staff' || role === 'delivery_staff') {
      navigate('/staff', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (isSignUp) {
        if (!cleanEmail || !password || !fullName || !phone) {
          setErrorMsg('Please fill in all fields');
          setLoading(false);
          return;
        }
        await authService.signUp(cleanEmail, password, fullName, phone);
        showToast('Account registered and signed in!', 'success');
        const profile = await authService.getCurrentProfile();
        redirectByRole(profile?.role || 'customer');
      } else {
        if (!cleanEmail || !password) {
          setErrorMsg('Please enter both email and password');
          setLoading(false);
          return;
        }
        await authService.signInWithEmail(cleanEmail, password);
        showToast('Signed in successfully!', 'success');
        const profile = await authService.getCurrentProfile();
        redirectByRole(profile?.role || 'customer');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const rawMsg = err.message || '';
      if (rawMsg.toLowerCase().includes('invalid login credentials')) {
        setErrorMsg('Invalid email or password. If testing demo accounts, please use password: password123, or click any role in the 1-Click Demo Logins panel.');
      } else if (rawMsg.toLowerCase().includes('email not confirmed')) {
        setErrorMsg('Email verification required by your server settings. You can use the verified demo accounts on the right.');
      } else {
        setErrorMsg(rawMsg || 'Authentication failed. Please check your credentials.');
      }
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (targetEmail: string, role: string) => {
    setErrorMsg('');
    setLoading(true);
    try {
      await authService.signInWithEmail(targetEmail, 'password123');
      showToast(`Logged in as ${targetEmail}`, 'success');
      redirectByRole(role);
    } catch (err: any) {
      console.error('Quick login error:', err);
      setErrorMsg(err.message || 'Failed to sign in with demo credentials.');
      showToast('Quick login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      showToast('Signed out successfully', 'info');
      setShowAccountSwitchForm(true);
    } catch (err: any) {
      showToast(err.message || 'Error signing out', 'error');
    }
  };

  const autofillDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setIsSignUp(false);
    setErrorMsg('');
  };

  return (
    <div className="min-h-[85vh] py-12 px-4 sm:px-6 flex items-center justify-center bg-[#FBFBFD]">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sign In / Sign Up Form */}
        <div className="md:col-span-7 bg-surface rounded-3xl p-8 sm:p-10 shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-ink flex items-center justify-center text-cream shadow-xs">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                {currentUser && !showAccountSwitchForm ? 'Session Active' : isSignUp ? 'Create your Account' : 'Welcome to FoldeD'}
              </h1>
              <p className="text-xs text-slate-500">
                {currentUser && !showAccountSwitchForm
                  ? `Signed in as ${currentUser.email} (${currentUser.role})`
                  : isSignUp
                  ? 'Sign up to track laundry bookings and schedule pickups'
                  : 'Log in to manage pickups, track orders, or access operations'}
              </p>
            </div>
          </div>

          {/* Active Session Card */}
          {currentUser && !showAccountSwitchForm ? (
            <div className="space-y-6 pt-2">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">You are already signed in!</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Logged in as <strong>{currentUser.full_name || currentUser.email}</strong> with role{' '}
                    <span className="capitalize font-semibold uppercase tracking-wider text-[11px] bg-emerald-200/60 px-2 py-0.5 rounded-md">
                      {currentUser.role}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button variant="primary" className="flex-1 justify-center" onClick={() => redirectByRole(currentUser.role)}>
                  <span>Go to My Portal</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" className="flex-1 justify-center border-slate-300 text-slate-700 hover:bg-slate-100" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>

              <div className="pt-4 border-t border-slate-100 text-center">
                <button type="button" onClick={() => setShowAccountSwitchForm(true)} className="text-xs text-slate-500 hover:text-slate-900 font-medium flex items-center justify-center gap-1.5 mx-auto transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Log in with another account</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {currentUser && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                  <span className="text-slate-500">Active session: <strong>{currentUser.email}</strong></span>
                  <button onClick={() => setShowAccountSwitchForm(false)} className="text-emerald-700 hover:underline font-medium">
                    Keep session
                  </button>
                </div>
              )}

              {/* Quick Autofill Suggestion Bar */}
              {!isSignUp && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Quick Fill Demo Credentials</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DEMO_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => autofillDemoAccount(acc.email)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all font-medium ${
                          email === acc.email
                            ? 'bg-ink text-cream dark:bg-cream dark:text-ink border-ink dark:border-cream shadow-xs'
                            : 'bg-surface text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'
                        }`}
                      >
                        {acc.roleBadge}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-4">
                {errorMsg && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-start gap-2.5 animate-fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">Authentication Notice</p>
                      <p className="leading-relaxed">{errorMsg}</p>
                    </div>
                  </div>
                )}

                {isSignUp && (
                  <>
                    <Input
                      label="Full Name"
                      placeholder="e.g. Rahul Verma"
                      icon={<User className="w-4 h-4" />}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                    <Input
                      label="Phone Number"
                      placeholder="+91 98765 43210"
                      icon={<Phone className="w-4 h-4" />}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </>
                )}

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@example.com"
                  icon={<Mail className="w-4 h-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-surface px-4 py-2.5 pl-10 pr-10 text-sm transition-all focus:border-ink dark:focus:border-cream focus:ring-2 focus:ring-slate-900/10 outline-none text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!isSignUp && (
                    <p className="text-[11px] text-slate-400">Default password for demo accounts: <code className="font-mono text-slate-600 font-semibold">password123</code></p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center h-11 text-sm mt-2"
                  isLoading={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </span>
                  ) : isSignUp ? (
                    'Create Account & Sign In'
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setErrorMsg('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-900 transition-colors underline-offset-4 hover:underline"
                  >
                    {isSignUp
                      ? 'Already have an account? Sign in'
                      : "Don't have an account? Create one"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: 1-Click Demo Accounts */}
        <div className="md:col-span-5 bg-ink text-cream rounded-3xl p-6 sm:p-8 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-cream/90">
                1-Click Demo Logins
              </h2>
            </div>
            <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Live DB Accounts
            </span>
          </div>

          <p className="text-xs text-cream/60 mb-5 leading-relaxed">
            Click any role below to authenticate directly without typing credentials and test role-based views:
          </p>

          <div className="space-y-2.5">
            {DEMO_ACCOUNTS.map((acc) => {
              const IconComp = acc.icon;
              return (
                <button
                  key={acc.email}
                  disabled={loading}
                  onClick={() => handleQuickLogin(acc.email, acc.role)}
                  className="w-full text-left p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-emerald-500/40 transition-all flex items-center justify-between group disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                        {acc.label}
                      </div>
                      <div className="text-[11px] text-cream/60 font-mono">
                        {acc.email}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-cream/70 group-hover:bg-emerald-500 group-hover:text-ink transition-colors">
                    {acc.roleBadge}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 text-[11px] text-cream/60">
            <p>
              Default demo password for all accounts:{' '}
              <code className="text-emerald-300 bg-white/10 px-1.5 py-0.5 rounded font-mono">
                password123
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
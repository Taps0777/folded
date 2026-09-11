import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import type { UserRole, Profile } from '../types';
import { authService } from '../services/api/authService';

interface AppContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: Profile | null;
  toastMessage: { text: string; type: 'success' | 'info' | 'error' } | null;
  showToast: (text: string, type?: 'success' | 'info' | 'error') => void;
  isLoadingAuth: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('customer');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const profile = await authService.getCurrentProfile();
        if (mounted && profile) {
          setCurrentUser(profile);
          setCurrentRole(profile.role);
        }
      } catch (err) {
        console.error("Auth init error", err);
      } finally {
        if (mounted) setIsLoadingAuth(false);
      }
    }

    loadSession();

    const { data: { subscription } } = authService.onAuthStateChange(async (event, _session) => {
      // This callback runs outside React's render/commit stack, so a rejection
      // here surfaces as an unhandled promise rejection and leaves the session
      // stale. Guard it and respect the mounted flag set above.
      try {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          const profile = await authService.getCurrentProfile();
          if (!mounted) return;
          setCurrentUser(profile);
          if (profile) setCurrentRole(profile.role);
        } else if (event === 'SIGNED_OUT') {
          if (!mounted) return;
          setCurrentUser(null);
          setCurrentRole('customer');
        }
      } catch (err) {
        console.error('Auth state change error', err);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    // Reset the window on every toast so a second toast isn't dismissed by the
    // first toast's timer.
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        currentUser,
        toastMessage,
        showToast,
        isLoadingAuth
      }}
    >
      {children}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border ${
              toastMessage.type === 'success'
                ? 'bg-ink text-cream border-mint/40 shadow-mint/10'
                : toastMessage.type === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-surface text-foreground border-slate-200'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                toastMessage.type === 'success' ? 'bg-mint' : toastMessage.type === 'error' ? 'bg-white' : 'bg-blue-500'
              }`}
            />
            {toastMessage.text}
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export { AppContext };

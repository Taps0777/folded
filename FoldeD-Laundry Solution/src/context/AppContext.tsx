import React, { createContext, useState, useEffect } from 'react';
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

    const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const profile = await authService.getCurrentProfile();
        setCurrentUser(profile);
        if (profile) setCurrentRole(profile.role);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCurrentRole('customer');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

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
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
          <div
            className={`px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border ${
              toastMessage.type === 'success'
                ? 'bg-ink text-white border-mint/40 shadow-mint/10'
                : toastMessage.type === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-white text-ink border-slate-200'
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

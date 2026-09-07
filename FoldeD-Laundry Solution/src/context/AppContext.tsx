import React, { createContext, useState, useEffect } from 'react';
import type { UserRole, Profile, Order } from '../types';
import { INITIAL_PROFILES } from '../services/mockData';
import { StorageService } from '../services/storage';

interface AppContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: Profile;
  orders: Order[];
  refreshOrders: () => void;
  toastMessage: { text: string; type: 'success' | 'info' | 'error' } | null;
  showToast: (text: string, type?: 'success' | 'info' | 'error') => void;
  resetData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    return (localStorage.getItem('ff_active_role') as UserRole) || 'customer';
  });

  const [orders, setOrders] = useState<Order[]>(() => StorageService.getOrders());
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const refreshOrders = () => {
    setOrders(StorageService.getOrders());
  };

  useEffect(() => {
    localStorage.setItem('ff_active_role', currentRole);
  }, [currentRole]);

  useEffect(() => {
    const handleStorageUpdate = () => {
      refreshOrders();
    };
    window.addEventListener('ff_storage_update', handleStorageUpdate);
    return () => window.removeEventListener('ff_storage_update', handleStorageUpdate);
  }, []);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const resetData = () => {
    StorageService.resetAll();
    refreshOrders();
    showToast('Demo data reset to fresh defaults', 'info');
  };

  const currentUser = INITIAL_PROFILES[currentRole] || INITIAL_PROFILES.customer;

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        currentUser,
        orders,
        refreshOrders,
        toastMessage,
        showToast,
        resetData,
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

'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getStoredUser, getToken, clearSession } from './api';
import { LABELS, SUBTITLES, DEFAULT_STORE } from './labels';

const AppContext = createContext(null);

// Order also decides which page a role lands on after signing in.
export const SCREEN_ORDER = ['dash', 'pos', 'inv', 'pur', 'cust', 'rep', 'price', 'sec'];

export const SCREEN_PATH = {
  dash: '/dashboard', pos: '/pos', inv: '/inventory', pur: '/purchasing', cust: '/customers',
  rep: '/reports', price: '/pricing', sec: '/security'
};

export const screenKeyFor = (pathname) => Object.keys(SCREEN_PATH).find((k) => SCREEN_PATH[k] === pathname);

// Where signing in lands. One account type reaching every screen means this is
// always the dashboard.
export const firstScreen = () => SCREEN_PATH[SCREEN_ORDER[0]];

const DEFAULT_SETTINGS = {
  currency: 'AFN', vatRate: 0, lowStockThreshold: 10, expiryWarnDays: 60,
  wholesaleMinQty: 50, autoBackup: true, ...DEFAULT_STORE
};

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined);        // undefined = still loading, null = signed out
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // Count of products needing attention — drives the sidebar badge on موجودی.
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const u = getToken() ? getStoredUser() : null;
    setUser(u);
    if (u) api('/settings').then((s) => setSettings({ ...DEFAULT_SETTINGS, ...s })).catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    clearSession();
    window.location.href = '/';
  }, []);

  const refreshSettings = useCallback(
    () => api('/settings').then((s) => setSettings({ ...DEFAULT_SETTINGS, ...s })).catch(() => {}),
    []
  );

  return (
    <AppContext.Provider value={{
      user, setUser, settings, setSettings, refreshSettings,
      alertCount, setAlertCount, L: LABELS, SUB: SUBTITLES, signOut
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

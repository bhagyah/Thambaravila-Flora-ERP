'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  customBg: string | null;
  setCustomBg: (bg: string | null, targetRole?: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState<Theme>('dark');
  const [customBg, setCustomBgState] = useState<string | null>(null);

  const roleName = session?.user?.role?.name || '';
  const userId = session?.user?.id || '';

  // 1. Theme init & clean up legacy unscoped keys
  useEffect(() => {
    const savedTheme = localStorage.getItem('flora_theme') as Theme | null;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme('dark');
    }

    // Clean up legacy unscoped key so it never bleeds across different roles
    localStorage.removeItem('flora_custom_bg');
  }, []);

  // 2. Role-specific background loading & switching
  useEffect(() => {
    if (status === 'authenticated' && roleName) {
      const roleStorageKey = `flora_custom_bg_role_${roleName}`;
      const savedRoleBg = localStorage.getItem(roleStorageKey);

      if (savedRoleBg !== null) {
        setCustomBgState(savedRoleBg || null);
      } else {
        setCustomBgState(null);
      }

      // Fetch fresh role background from server profile API
      fetch('/api/profile')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.profile) {
            const serverBg = data.profile.bgImageUrl || data.profile.roleBgImageUrl || null;
            setCustomBgState(serverBg);
            if (serverBg) {
              localStorage.setItem(roleStorageKey, serverBg);
            } else {
              localStorage.removeItem(roleStorageKey);
            }
          }
        })
        .catch(() => {});
    } else if (status === 'unauthenticated') {
      setCustomBgState(null);
    }
  }, [status, roleName, userId]);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    const body = document.body;
    root.style.colorScheme = newTheme;
    if (newTheme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      body.classList.add('light');
      body.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      body.classList.add('dark');
      body.classList.remove('light');
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('flora_theme', nextTheme);
    applyTheme(nextTheme);
  };

  const setCustomBg = useCallback((bg: string | null, targetRole?: string) => {
    const currentRole = targetRole || session?.user?.role?.name || '';
    setCustomBgState(bg);
    if (currentRole) {
      const roleStorageKey = `flora_custom_bg_role_${currentRole}`;
      if (bg) {
        localStorage.setItem(roleStorageKey, bg);
      } else {
        localStorage.removeItem(roleStorageKey);
      }
    }
  }, [session]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, customBg, setCustomBg }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      theme: 'dark' as Theme,
      toggleTheme: () => {},
      customBg: null as string | null,
      setCustomBg: () => {},
    };
  }
  return context;
}

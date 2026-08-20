'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  customBg: string | null;
  setCustomBg: (bg: string | null, targetRole?: string) => void;
  bgContrast: number;
  setBgContrast: (contrast: number, targetRole?: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState<Theme>('dark');
  const [customBg, setCustomBgState] = useState<string | null>(null);
  const [bgContrast, setBgContrastState] = useState<number>(65);

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

  // 2. Role-specific background and contrast loading & switching
  useEffect(() => {
    if (status === 'authenticated' && roleName) {
      const roleStorageKey = `flora_custom_bg_role_${roleName}`;
      const contrastStorageKey = `flora_bg_contrast_role_${roleName}`;
      
      const savedRoleBg = localStorage.getItem(roleStorageKey);
      const savedContrast = localStorage.getItem(contrastStorageKey);

      if (savedRoleBg !== null) {
        setCustomBgState(savedRoleBg || null);
      } else {
        setCustomBgState(null);
      }

      if (savedContrast !== null) {
        const parsed = parseInt(savedContrast, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          setBgContrastState(parsed);
        }
      }

      // Fetch fresh role background & contrast from server profile API
      fetch('/api/profile')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.profile) {
            const serverBg = data.profile.bgImageUrl || data.profile.roleBgImageUrl || null;
            const serverContrast = data.profile.bgContrast ?? 65;
            
            setCustomBgState(serverBg);
            setBgContrastState(serverContrast);

            if (serverBg) {
              localStorage.setItem(roleStorageKey, serverBg);
            } else {
              localStorage.removeItem(roleStorageKey);
            }
            localStorage.setItem(contrastStorageKey, String(serverContrast));
          }
        })
        .catch(() => {});
    } else if (status === 'unauthenticated') {
      setCustomBgState(null);
      setBgContrastState(65);
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

  const setBgContrast = useCallback((contrast: number, targetRole?: string) => {
    const clamped = Math.max(0, Math.min(100, Math.round(contrast)));
    const currentRole = targetRole || session?.user?.role?.name || '';
    setBgContrastState(clamped);
    if (currentRole) {
      const contrastStorageKey = `flora_bg_contrast_role_${currentRole}`;
      localStorage.setItem(contrastStorageKey, String(clamped));
    }
  }, [session]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, customBg, setCustomBg, bgContrast, setBgContrast }}>
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
      bgContrast: 65,
      setBgContrast: () => {},
    };
  }
  return context;
}

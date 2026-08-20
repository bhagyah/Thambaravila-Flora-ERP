'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  customBg: string | null;
  setCustomBg: (bg: string | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [customBg, setCustomBgState] = useState<string | null>(null);

  useEffect(() => {
    // 1. Theme init
    const savedTheme = localStorage.getItem('flora_theme') as Theme | null;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme('dark');
    }

    // 2. Custom Background init from localStorage for instantaneous rendering
    const savedBg = localStorage.getItem('flora_custom_bg');
    if (savedBg) {
      setCustomBgState(savedBg);
    }

    // 3. Sync from backend user profile
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile?.bgImageUrl !== undefined) {
          const bg = data.profile.bgImageUrl || null;
          setCustomBgState(bg);
          if (bg) {
            localStorage.setItem('flora_custom_bg', bg);
          } else {
            localStorage.removeItem('flora_custom_bg');
          }
        }
      })
      .catch(() => {});
  }, []);

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

  const setCustomBg = useCallback((bg: string | null) => {
    setCustomBgState(bg);
    if (bg) {
      localStorage.setItem('flora_custom_bg', bg);
    } else {
      localStorage.removeItem('flora_custom_bg');
    }
  }, []);

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

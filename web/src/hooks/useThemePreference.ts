'use client';

import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'hp-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>('system');

  // Load initial theme from storage
  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  // Apply theme to document root and persist
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.dataset.theme = resolved;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme };
}

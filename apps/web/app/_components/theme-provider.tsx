'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  appearanceCookieAssignment,
  appearanceFromCookie,
  isAppearance,
  type Appearance,
} from '@/lib/appearance';

/**
 * Theme Provider — Appearance = Light · Dark, the person's choice (dark mode PR 3, 2026-10-13).
 *
 * WHY THIS CHANGED. The app was LIGHT-LOCKED from 2026-06-04 (owner: "just always keep it light
 * theme"): `mode` was frozen at 'light', `setMode` did nothing and `.dark` was stripped on mount.
 * The owner lifted it — "dark mode should work" (2026-10-11) — and approved how it is turned on
 * (DECISION_LOG 2026-10-13, "approve all"): one setting, Light · Dark, no "follow the phone",
 * per person, the same everywhere; dark appears area by area through a READY-LIST of routes; the
 * couple's guest pages and signed-out visitors stay Light.
 *
 * WHAT IT HOLDS. `mode` = what the person chose (from the `sn-theme` cookie). `resolvedTheme` =
 * what THIS screen paints, which is `dark` only where `lib/appearance.ts` `darkApplies` says so —
 * with the ready-list empty, that is nowhere, so the app is still light everywhere.
 *
 * ONE RULE, TWO TIMES. The inline <head> script (`theme-bootstrap-script.ts`) paints the class
 * before the first frame and leaves its rule on `window.__snTheme`. This provider asks that SAME
 * function again after a client navigation and after the person changes their choice, so the
 * route list is not shipped twice and the two cannot disagree.
 *
 * PRINT IS ALWAYS LIGHT (owner call 9): `.dark` comes off for `beforeprint` and goes back after.
 *
 * `useTheme()` keeps its shape (`mode`, `resolvedTheme`, `setMode`). `setMode` records the choice in
 * the cookie and repaints at once — no server round trip; the Appearance control saves the column
 * (`updateThemePreference`) as the cross-device record.
 */

export type ThemeMode = Appearance;

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark'];

export function isThemeMode(value: unknown): value is ThemeMode {
  return isAppearance(value);
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

type SnTheme = { decide: (pathname: string, cookie?: string) => boolean; paint: (dark: boolean) => void };

function snTheme(): SnTheme | null {
  if (typeof window === 'undefined') return null;
  const t = (window as unknown as { __snTheme?: SnTheme }).__snTheme;
  return t && typeof t.decide === 'function' && typeof t.paint === 'function' ? t : null;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
  /** Retained for call-site compatibility. The choice is read from the cookie the <head> script reads. */
  initialMode?: ThemeMode;
}) {
  const pathname = usePathname() ?? '/';
  // Light on the server and on the first client render (the markup never depends on the choice);
  // the cookie is read after mount.
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [resolvedTheme, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setModeState(appearanceFromCookie(document.cookie));
  }, []);

  // Re-apply the head script's rule whenever the screen or the choice changes.
  useEffect(() => {
    const t = snTheme();
    const dark = t ? t.decide(pathname) : false;
    if (t) t.paint(dark);
    else document.documentElement.classList.remove('dark');
    setResolved(dark ? 'dark' : 'light');
  }, [pathname, mode]);

  // Paper is always light.
  useEffect(() => {
    const before = () => document.documentElement.classList.remove('dark');
    const after = () => {
      const t = snTheme();
      if (t) t.paint(t.decide(window.location.pathname));
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    if (!isThemeMode(next)) return;
    document.cookie = appearanceCookieAssignment(next, window.location.protocol === 'https:');
    setModeState(next);
  }, []);

  const value = useMemo(() => ({ mode, resolvedTheme, setMode }), [mode, resolvedTheme, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider />');
  }
  return ctx;
}

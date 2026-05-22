'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Theme Provider — Light / Dark / Auto.
 *
 * WHY: Brand pivot 2026-05-22 (CLAUDE.md decision-log). Owner directive:
 * "make our default color be like facebook white and blue. and remove the
 * personalization of colors. It will be light, dark, auto. just like ios".
 *
 * Replaces the 5-theme system (Setnayan Default · Victorian · Classy · iOS ·
 * Forest Theme) locked 2026-05-15 row 5. The Setnayan brand now flips to
 * Facebook white + blue in light mode and Facebook dark + brighter blue in
 * dark mode; mode selection is the only personalization remaining.
 *
 * MODES
 *   - 'light' — force Facebook white + blue, ignore system preference
 *   - 'dark'  — force Facebook dark + blue, ignore system preference
 *   - 'auto'  — read `prefers-color-scheme` at runtime (DEFAULT)
 *
 * STORAGE
 *   - `localStorage.theme` — fast read on every page load (FOUC defense)
 *   - `users.theme_preference` — durable Supabase value, synced via the
 *     `updateThemePreference` server action in profile/actions.ts
 *
 * FOUC DEFENSE
 *   - An inline script in `<head>` (rendered by app/layout.tsx) reads
 *     localStorage and applies the `dark` class to <html> BEFORE first paint
 *     so light/dark toggles never flash the wrong palette.
 *   - This client component then takes over after hydration, reacting to
 *     system preference changes when mode === 'auto'.
 *
 * COUPLE-LANDING PAGE OUT OF SCOPE: The wedding landing page chrome at
 * `app/[slug]/page.tsx` is driven by the couple's mood-board palette per
 * iteration 0010 + 0002. This provider does NOT touch that surface — the
 * `dark` class on <html> is ignored by the couple-landing render path.
 */

export type ThemeMode = 'light' | 'dark' | 'auto';

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'auto'];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

const STORAGE_KEY = 'theme';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyHtmlClass(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({
  children,
  initialMode = 'auto',
}: {
  children: React.ReactNode;
  /** SSR-resolved initial mode from `users.theme_preference`. Defaults to 'auto'. */
  initialMode?: ThemeMode;
}) {
  // Start from SSR-passed mode so server + first client render agree. The
  // hydration-time effect below reconciles with localStorage if the user
  // has changed mode in another tab.
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // On mount: reconcile with localStorage (cross-tab updates + anonymous
  // visitors who picked a mode before signing up).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isThemeMode(stored) && stored !== mode) {
        setModeState(stored);
      }
    } catch {
      // localStorage may be disabled (Safari private mode + iframe sandboxes).
      // Fall through to the SSR-passed initialMode silently.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply mode → class + listen for system preference changes when 'auto'.
  useEffect(() => {
    const apply = () => {
      const resolved = mode === 'auto' ? resolveSystemTheme() : mode;
      setResolvedTheme(resolved);
      applyHtmlClass(resolved);
    };
    apply();

    if (mode !== 'auto') return;

    // Listen for system preference changes in auto mode. matchMedia change
    // events fire whenever the user flips dark mode in their OS settings.
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply();
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } else {
      // Safari <14 fallback
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Swallow — see useEffect note above.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedTheme, setMode }),
    [mode, resolvedTheme, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider />');
  }
  return ctx;
}

/**
 * FOUC-safe inline script for `<head>` injection in app/layout.tsx.
 *
 * Runs synchronously before first paint, reads localStorage, computes resolved
 * theme, applies the `dark` class to <html>. Wrapped in try/catch so a corrupt
 * localStorage or disabled storage doesn't blank the page.
 *
 * Why this lives as a string export instead of a React component: the script
 * MUST run before React hydration to avoid a light→dark flash. <Script> with
 * strategy="beforeInteractive" works but adds Next.js machinery; an inline
 * <script dangerouslySetInnerHTML> is faster + survives without next/script.
 */
export const themeBootstrapScript = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var mode = (stored === 'light' || stored === 'dark' || stored === 'auto') ? stored : 'auto';
    var resolved;
    if (mode === 'auto') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      resolved = mode;
    }
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (_e) {
    // localStorage disabled or matchMedia missing — leave default (light).
  }
})();
`;

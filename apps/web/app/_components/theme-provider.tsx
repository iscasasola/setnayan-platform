'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';

/**
 * Theme Provider — LIGHT-LOCKED.
 *
 * WHY: Owner directive 2026-06-04 — "the app used to adjust automatic to light
 * and dark theme. disable this and just always keep it light theme." This
 * reverts the 2026-05-22 brand-pivot Light / Dark / Auto trio (CLAUDE.md
 * decision-log). Setnayan now renders in the light Clean-Editorial palette on
 * every dashboard / marketing surface, ignoring the OS `prefers-color-scheme`
 * AND any previously-stored `users.theme_preference` / `localStorage.theme`.
 *
 * WHY KEEP THE PROVIDER: ~7 components call `useTheme()` (site-editor, dashboard
 * layout, onboarding shell, a few vendor rows). Rather than refactor every
 * call-site, the provider + `useTheme()` API are KEPT but hard-locked: `mode`
 * and `resolvedTheme` are always `'light'`, and `setMode` is a no-op. The
 * `.dark` class is never applied (and is actively stripped on mount in case a
 * stale cached HTML shell shipped with it). Re-enabling Dark/Auto later is a
 * small revert of this file + the bootstrap script.
 *
 * HOW IT STAYS LIGHT BY CONSTRUCTION: `darkMode: 'class'` in tailwind.config.ts
 * means every `dark:` variant + every `html.dark` token override in globals.css
 * keys off the `.dark` class on <html>. globals.css carries NO
 * `@media (prefers-color-scheme: dark)` rule, so with `.dark` never present,
 * all dark styling stays inert → light, regardless of the device setting.
 *
 * DORMANT: the `users.theme_preference` column + its `updateThemePreference`
 * server action are left in place (unread) so the revert is trivial.
 *
 * COUPLE-LANDING PAGE OUT OF SCOPE: the wedding landing page chrome at
 * `app/[slug]/page.tsx` is driven by the couple's mood-board palette per
 * iteration 0010 + 0002 — never touched by this provider.
 */

export type ThemeMode = 'light' | 'dark' | 'auto';

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'auto'];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

// Frozen light-locked context value. `setMode` is intentionally a no-op — the
// app no longer exposes a way to switch modes (owner 2026-06-04).
const LIGHT_LOCKED: ThemeContextValue = {
  mode: 'light',
  resolvedTheme: 'light',
  setMode: () => {},
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
  /**
   * Retained for call-site compatibility (app/providers.tsx still passes the
   * SSR-resolved mode). Ignored — the app is light-locked.
   */
  initialMode?: ThemeMode;
}) {
  // Defend against a stale `.dark` class from a previously-cached HTML shell
  // (old service-worker response, bfcache restore, etc.). The bootstrap script
  // in <head> already strips it before first paint; this is the post-hydration
  // belt-and-suspenders pass.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const value = useMemo(() => LIGHT_LOCKED, []);

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
 * The app is light-locked (owner 2026-06-04), so this simply guarantees the
 * `.dark` class is absent before first paint — defending against a stale cached
 * shell that shipped with `.dark` already on <html>. Kept as a string export so
 * layout.tsx's reference stays valid. Runs synchronously, wrapped in try/catch
 * so a missing API never blanks the page.
 */
export const themeBootstrapScript = `
(function() {
  try {
    document.documentElement.classList.remove('dark');
  } catch (_e) {}
})();
`;

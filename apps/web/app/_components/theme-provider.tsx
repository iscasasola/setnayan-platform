'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { appliedTheme, paintTheme, themeCookieString, themeFromCookie, themeToAdopt, type AppliedTheme } from './theme-bootstrap-script';

/**
 * Theme Provider — Light · Dark, and LIGHT UNLESS CHOSEN.
 *
 * Owner 2026-10-11: "dark mode should work." This file was LIGHT-LOCKED from 2026-06-04
 * ("just always keep it light theme") until then: `setMode` was a no-op and an effect stripped
 * `.dark`. It is real again. What decides the theme, and why nobody gets dark by accident, is
 * written once in `./theme-bootstrap-script.ts` — read that first.
 *
 * WHAT THIS HOLDS: the theme the page is drawn in, and `setMode`, which draws the other one at
 * once (the `.dark` class on <html>, the browser bar's tint) and remembers it on this device (the
 * `sn-theme` cookie). `color-scheme` follows the class in globals.css.
 *
 * HOW DARK IS DRAWN: `darkMode: 'class'` in tailwind.config.ts — every `dark:` variant and every
 * `html.dark` token in globals.css keys off the `.dark` class on <html>. globals.css carries NO
 * `@media (prefers-color-scheme: dark)` rule, so the device's own setting changes nothing.
 *
 * THE FIRST PAINT is the inline script's, not this component's: it has already set the class from
 * the same cookie before React runs. The effect below only reads what it did (and repaints the
 * browser bar, whose tag the script may have run ahead of).
 *
 * THE GUEST'S EVENT HUB IS OUT OF SCOPE: `app/[slug]` wears the couple's Look whatever the
 * viewer's theme — pinned in globals.css ("THE GUEST'S EVENT HUB TAKES NO THEME").
 */

export type ThemeMode = 'light' | 'dark' | 'auto';

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'auto'];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

interface ThemeContextValue {
  /** What is drawn. Never 'auto': a stored 'auto' is light. */
  mode: AppliedTheme;
  resolvedTheme: AppliedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  /**
   * A mode the SERVER already knows (app/providers.tsx passes it through). The root layout does
   * not: it must not read cookies (that would make every marketing page dynamic), so there the
   * first paint is the inline script's and this starts light, then reads the cookie on mount.
   */
  initialMode?: ThemeMode;
}) {
  const [theme, setTheme] = useState<AppliedTheme>(() => appliedTheme(initialMode));

  useEffect(() => {
    const drawn = themeFromCookie(document.cookie);
    paintTheme(drawn, document);
    setTheme(drawn);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    const chosen = appliedTheme(next);
    paintTheme(chosen, document);
    document.cookie = themeCookieString(chosen, window.location.protocol === 'https:');
    setTheme(chosen);
  }, []);

  const value = useMemo(() => ({ mode: theme, resolvedTheme: theme, setMode }), [theme, setMode]);

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
 * THE ACCOUNT'S CHOICE REACHES A NEW DEVICE. Mounted by the signed-in layouts with
 * `users.theme_preference` read on the server. When this device's cookie disagrees with the
 * account (a phone that has never seen the choice; a choice changed on another device), the
 * account wins and the cookie is rewritten — so every later load is right from the first paint.
 * `stored` undefined (the read failed) changes nothing: a failed read is not a choice of Light.
 */
export function ThemeFromAccount({ stored }: { stored: string | null | undefined }) {
  const { setMode } = useTheme();
  useEffect(() => {
    const adopt = themeToAdopt(stored, document.cookie);
    if (adopt) setMode(adopt);
  }, [stored, setMode]);
  return null;
}

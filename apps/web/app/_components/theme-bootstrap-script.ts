/*
  NOT A 'use client' MODULE, ON PURPOSE. A server component that imports a plain value from a
  'use client' file gets a CLIENT REFERENCE, not the value: React sends a pointer that the browser
  resolves only after downloading that file. In <head> that made React pause, replay the head and
  read the page against the head's tags — hydration error #418 on ~1 in 6 loads (Story step 8,
  2026-09-11). Values a server file needs live in plain modules like this one; the guard is
  lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts.
*/

/**
 * THE THEME, IN ONE PLACE — what makes a page dark, and the only thing that does.
 *
 * Owner 2026-10-11: "dark mode should work." (Supersedes 2026-06-04 "just always keep it light
 * theme"; the control is the "Appearance = Light · Dark" approved 2026-10-07, in account settings.)
 *
 * 🔑 THE DEFAULT IS LIGHT FOR EVERYONE. A page is dark only while this device holds the cookie
 * `sn-theme=dark`, and that cookie is written by exactly two things: the person choosing Dark in
 * Appearance, or a signed-in page finding Dark stored on their account (`ThemeFromAccount`).
 *   · A stored 'auto' — the column's default, so nearly every account — means LIGHT.
 *   · The device's own setting (`prefers-color-scheme`) is NOT consulted, anywhere.
 * WHY: most of the app is not yet drawn for dark. A phone set to dark must not be handed a
 * half-dark app; the person who chooses Dark has asked for it. `lib/no-surface-ships-dark-by-accident.test.ts`
 * holds both halves.
 *
 * WHY A COOKIE AND NOT localStorage OR A SERVER READ IN THE ROOT LAYOUT: the root layout must not
 * read cookies — that would make every marketing page dynamic (it is static / edge-cached today,
 * see the DemoModeBanner note in app/layout.tsx). So the first paint is settled in the browser, by
 * the inline script below, which runs first in <head> before anything is painted: no flash. A
 * cookie rather than localStorage because the server CAN read it wherever a page is already
 * dynamic, and the server action that saves the choice sets it with a real Set-Cookie header,
 * which Safari does not cap at seven days the way it caps a script-written one.
 *
 * The cookie exists only while Dark is chosen; choosing Light removes it.
 */
export const THEME_COOKIE = 'sn-theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type AppliedTheme = 'light' | 'dark';

/** The browser bar's tint in each theme — the light one is `viewport.themeColor` in app/layout.tsx. */
export const THEME_COLOR: Record<AppliedTheme, string> = { light: '#FBFBFA', dark: '#17160F' };

/** A stored or chosen value → what is drawn. Only the word 'dark' is dark; 'auto', null, anything else is light. */
export function appliedTheme(stored: unknown): AppliedTheme {
  return stored === 'dark' ? 'dark' : 'light';
}

/** What a Cookie header (or `document.cookie`) says this device was told to draw. */
export function themeFromCookie(cookies: string | null | undefined): AppliedTheme {
  const m = /(?:^|;\s*)sn-theme=([^;]*)/.exec(cookies ?? '');
  return appliedTheme(m?.[1]);
}

/**
 * What a signed-in page should switch this device to: the ACCOUNT's theme when this device's cookie
 * disagrees with it, or null to leave the page alone. `stored` null / undefined is a read that did
 * not answer — not a choice of Light — so it changes nothing.
 */
export function themeToAdopt(stored: unknown, cookies: string | null | undefined): AppliedTheme | null {
  if (stored == null) return null;
  const account = appliedTheme(stored);
  return account === themeFromCookie(cookies) ? null : account;
}

/** The `document.cookie` assignment for a theme: Dark is remembered for a year, Light removes the cookie. */
export function themeCookieString(theme: AppliedTheme, secure: boolean): string {
  const life = theme === 'dark' ? `${THEME_COOKIE}=dark; path=/; max-age=${THEME_COOKIE_MAX_AGE}` : `${THEME_COOKIE}=; path=/; max-age=0`;
  return `${life}; samesite=lax${secure ? '; secure' : ''}`;
}

/** The little of `document` the theme touches — so a test can hand in a stand-in. */
export type ThemeDocument = {
  cookie: string;
  documentElement: { classList: { toggle(name: string, force?: boolean): boolean } };
  querySelector(selector: string): { setAttribute(name: string, value: string): void } | null;
};

/** Draw a theme on this page: the `.dark` class every dark token and `dark:` class keys off, and the browser bar. */
export function paintTheme(theme: AppliedTheme, doc: ThemeDocument): void {
  doc.documentElement.classList.toggle('dark', theme === 'dark');
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

/**
 * FOUC-safe inline script for `<head>` injection in app/layout.tsx — runs synchronously, first in
 * <head>, so the class is right before the first paint. With no `sn-theme=dark` cookie it REMOVES
 * `.dark` (a stale cached shell, a bfcache restore); it adds it for nothing else. Kept as a string
 * export; wrapped in try/catch so a missing API never blanks the page.
 */
export const themeBootstrapScript = `
(function() {
  try {
    var d = document;
    var dark = /(?:^|;\\s*)${THEME_COOKIE}=dark(?:;|$)/.test(d.cookie);
    d.documentElement.classList.toggle('dark', dark);
    if (dark) {
      var m = d.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', '${THEME_COLOR.dark}');
    }
  } catch (_e) {}
})();
`;

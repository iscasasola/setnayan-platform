/**
 * APPEARANCE — Light · Dark, chosen by the person (dark mode PR 3, 2026-10-13).
 *
 * The owner's ruling (DECISION_LOG 2026-10-13, "approve all"): one setting, Appearance = Light · Dark,
 * in account settings › Preferences, the same everywhere, per person and never per event. No
 * "Automatic / follow the phone" (call 1). Signed-out visitors always see Light (call 4). The
 * couple's guest pages keep the couple's design — dark never changes them (call 5). Dark appears
 * AREA BY AREA, only on screens already swept (call 3).
 *
 * This file is the ONE place those rules are written. The inline <head> script that paints the class
 * before the first frame (`app/_components/theme-bootstrap-script.ts`) and the provider that keeps it
 * right across client navigations (`app/_components/theme-provider.tsx`) both follow `darkApplies`;
 * `lib/appearance.test.ts` runs the inline script against the same table of cases, so the two can
 * never disagree.
 *
 * NOT A 'use client' MODULE, ON PURPOSE — the root layout (a server file) reads its values.
 *
 * ⚠ NO IMPORTS, ON PURPOSE. The provider that reads this is in EVERY page's shared bundle (budget
 * 206,848 B). The app's route list (`ROUTE_RESERVED_SLUGS`) is therefore passed in by the caller —
 * the server-built <head> script embeds it, and exposes its decision as `window.__snTheme` so the
 * provider asks the script instead of shipping the list a second time.
 */

export type Appearance = 'light' | 'dark';
export const APPEARANCES: readonly Appearance[] = ['light', 'dark'];

export function isAppearance(value: unknown): value is Appearance {
  return value === 'light' || value === 'dark';
}

/**
 * The cookie the <head> script reads before paint. Written by the browser itself when the person
 * picks (so the page changes at once and nothing is re-rendered on the server); the column
 * `users.theme_preference` is the cross-device record.
 */
export const APPEARANCE_COOKIE = 'sn-theme';
export const APPEARANCE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

/** The browser-bar colour of each look. Light is the layout's own `viewport.themeColor`, unchanged. */
export const THEME_COLOR: Record<Appearance, string> = {
  light: '#FBFBFA',
  dark: '#17160F', // the approved dark page (control_templates_round2_2026-10-12)
};

/**
 * 🚦 THE READY-LIST — route prefixes whose screens have been swept for dark.
 *
 * EMPTY ON PURPOSE (owner call 3, 2026-10-13): the switch ships before any screen is ready, so a
 * person who picks Dark today sees NOTHING change. Each area PR adds its prefix once every screen
 * under it has been walked in dark ("/dashboard", "/vendor-dashboard", "/admin" …); the last one
 * deletes the list. Nobody ever sees a half-dark screen. A prefix matches itself and everything
 * below it ("/dashboard" → "/dashboard/abc/guests"), never a sibling ("/dashboardx").
 *
 * Every entry's first segment must be an app route — `lib/appearance.test.ts` enforces it — so a
 * couple's slug can never be put on the list by mistake.
 */
export const DARK_READY: readonly string[] = [];


/** The person's choice from `document.cookie` — anything but an explicit `dark` is Light. */
export function appearanceFromCookie(cookie: string): Appearance {
  return /(?:^|;\s*)sn-theme=dark(?:;|$)/.test(cookie) ? 'dark' : 'light';
}

/**
 * Signed in = a Supabase session cookie is present (`sb-<project>-auth-token`, chunked `.0` `.1` on a
 * long token). @supabase/ssr writes it readable by the page. No session → Light, always (call 4),
 * even when an `sn-theme=dark` is left over from someone who signed out on this device.
 */
export function signedInFromCookie(cookie: string): boolean {
  return /(?:^|;\s*)sb-[A-Za-z0-9]+-auth-token(?:\.\d+)?=/.test(cookie);
}

/** Is `pathname` under a ready-list prefix? */
export function isDarkReady(pathname: string, ready: readonly string[] = DARK_READY): boolean {
  return ready.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'));
}

/**
 * Is `pathname` one of the app's own screens? `appRoutes` = the first path segments of the app's
 * route folders (`ROUTE_RESERVED_SLUGS`, generated from disk). Every other first segment is a
 * couple's (or a shop's) public page under `app/[slug]`, which keeps its own design. "/" is the app.
 */
export function isAppRoute(pathname: string, appRoutes: ReadonlySet<string>): boolean {
  const first = pathname.split('/')[1] ?? '';
  return first === '' || appRoutes.has(first);
}

/** THE RULE: dark is painted only for a signed-in person who chose it, on a swept app screen. */
export function darkApplies(
  { pathname, cookie, appRoutes }: { pathname: string; cookie: string; appRoutes: ReadonlySet<string> },
  ready: readonly string[] = DARK_READY,
): boolean {
  return (
    appearanceFromCookie(cookie) === 'dark' &&
    signedInFromCookie(cookie) &&
    isAppRoute(pathname, appRoutes) &&
    isDarkReady(pathname, ready)
  );
}

/** The `document.cookie` assignment that records a choice (one year, whole site). */
export function appearanceCookieAssignment(appearance: Appearance, secure: boolean): string {
  return (
    `${APPEARANCE_COOKIE}=${appearance}; Path=/; Max-Age=${APPEARANCE_COOKIE_MAX_AGE_S}; SameSite=Lax` +
    (secure ? '; Secure' : '')
  );
}

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

/**
 * 🌗 AUTOMATIC (owner 2026-10-23, verbatim: "yes add automatic" … "set it to automatic") — supersedes call 1
 * of 2026-10-13 ("no follow the phone"). Three choices: Light · Dark · Automatic, where Automatic follows the
 * phone / OS (`prefers-color-scheme`, live). LIGHT is the DEFAULT (owner 2026-10-23: "make light the default first"
 * until dark covers every screen): no cookie, no choice → Light. Automatic is a choice a person makes.
 * It still only paints on a DARK_READY route, for a signed-in person; signed out is always Light (call 4) — except the
 * two sign-in pages, which follow the phone signed out too (owner 24 Nov 2026, `SIGNED_OUT_FOLLOWS_PHONE` below).
 */
export type Appearance = 'light' | 'dark' | 'auto';
export const APPEARANCES: readonly Appearance[] = ['light', 'dark', 'auto'];
export const DEFAULT_APPEARANCE: Appearance = 'light';

export function isAppearance(value: unknown): value is Appearance {
  return value === 'light' || value === 'dark' || value === 'auto';
}

/**
 * The cookie the <head> script reads before paint. Written by the browser itself when the person
 * picks (so the page changes at once and nothing is re-rendered on the server); the column
 * `users.theme_preference` is the cross-device record.
 */
export const APPEARANCE_COOKIE = 'sn-theme';
export const APPEARANCE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

/** The browser-bar colour of each look. Light is the layout's own `viewport.themeColor`, unchanged. */
/** Keyed by what a screen PAINTS (light | dark) — Automatic is a choice, not a paint. */
export const THEME_COLOR: Record<'light' | 'dark', string> = {
  light: '#FBFBFA',
  dark: '#121110', // the dark page — `--color-page` in globals.css (owner 18 Nov 2026, pick 2; was #17160F)
};

/**
 * 🚦 THE READY-LIST — route prefixes whose screens have been swept for dark.
 *
 * EMPTY UNTIL B2 (owner call 3, 2026-10-13). The switch itself is HIDDEN while the list is empty
 * (owner, 2026-10-16: "Hide the Light/Dark switch until the first area is ready for dark mode") —
 * `appearanceSwitchShown` below, so nobody can pick a Dark that changes nothing. Each area PR adds its prefix once every screen
 * under it has been walked in dark ("/dashboard", "/vendor-dashboard", "/admin" …); the last one
 * deletes the list. Nobody ever sees a half-dark screen. A prefix matches itself and everything
 * below it ("/dashboard" → "/dashboard/abc/guests"), never a sibling ("/dashboardx").
 *
 * Every entry's first segment must be an app route — `lib/appearance.test.ts` enforces it — so a
 * couple's slug can never be put on the list by mistake.
 */
export const DARK_READY: readonly string[] = [
  // B2 (2026-10-23, dark_mode_rollout_2026-10-22): the account spokes — the first area a person sees in dark is
  // the one holding the switch (/dashboard/profile). Every route below was walked signed in, at 375 px, light and
  // dark, before it was listed (2026-10-23).
  '/dashboard/people',
  '/dashboard/library',
  '/dashboard/life-flash',
  '/dashboard/profile',
  '/dashboard/notifications',
  '/dashboard/create-event',
  '/dashboard/samahan',
  // B3, FIRST SLICE (18 Nov 2026 — owner: "dark mode. YES :D" · pick 5 "the couple's /dashboard goes dark first").
  // ONLY THE FOUR EVENT SCREENS THAT WERE RENDERED IN DARK: the event Home, Budget, Guests and Schedule — each one
  // EXACTLY (`$`), never the routes below it. The rest of the event tree (Suppliers, the Hub door, the Maker, the
  // Studio, the website editor, seating …) still paints colours of its own and STAYS LIGHT until it is swept and
  // walked: nobody may meet a half-dark screen (call 3, 2026-10-13; review of #7993, 19 Nov 2026). `*` is the event's
  // id — one segment that holds a digit (see `isDarkReady`).
  '/dashboard/*$',
  '/dashboard/*/budget$',
  '/dashboard/*/guests$',
  '/dashboard/*/schedule$',
  // 📸 MEMORIES (22 Nov 2026 — the drawing the owner approved 20 Nov, "memories approved", carries its dark tokens;
  // DECISION_LOG "EVENT › MEMORIES — PAPIC ON TOP + FIVE OPENED PAGES": dark defers to DARK_MODE_STANDARD). EXACTLY the
  // tab: the Papic block (the top block — the one glow), the keepsake row and its four sheets, the filter row, the grid,
  // the viewer, ⚙ and the Add more sheet were rendered dark at 375 px; every file the risen Papic settings draw was swept
  // for light-only colours. Its sub-pages (Thank-You Video, Download all) stay Light until they are walked.
  // 🔒 `app/dashboard/[eventId]/memories/memories-goes-dark.test.ts`.
  '/dashboard/*/memories$',
  // B4, FIRST SLICE (18 Nov 2026 — owner: "do supplier navy dark next"): the supplier dashboard's dark is its own navy
  // (`app/vendor-dashboard/_components/supplier-look.css`, tokens only; `the-navy-is-readable.test.ts`). ONLY the two
  // supplier screens that were rendered in the navy are listed, each exactly: Clients and the customers list. The
  // rest of the supplier tree stays Light until it is walked — the same rule as the event tree above.
  '/vendor-dashboard/clients$',
  '/vendor-dashboard/customers$',
  // …and the sign-in cards, whose dark rules were written 21–22 Oct. Signed-out is always Light (call 4), so
  // these paint dark only for a signed-in person who chose Dark and lands here (a re-auth, an add-account).
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

/**
 * 🚦 Is the Appearance row (Preferences › Light · Dark) shown? Only once an area is on the ready-list —
 * owner 2026-10-16: "Hide the Light/Dark switch until the first area is ready for dark mode." ONE
 * condition, read from the ready-list itself, so the first area PR that adds its prefix shows the switch
 * with no second edit. Held by `lib/appearance.test.ts` (the switch never shows with an empty list).
 */
export function appearanceSwitchShown(ready: readonly string[] = DARK_READY): boolean {
  return ready.length > 0;
}


/** The choice the cookie EXPLICITLY holds — `light` / `dark` / `auto` — or null when there is none (or an unknown value). */
export function explicitAppearance(cookie: string): Appearance | null {
  const m = /(?:^|;\s*)sn-theme=(light|dark|auto)(?:;|$)/.exec(cookie);
  return m ? (m[1] as Appearance) : null;
}

/** The person's choice from `document.cookie` — `light` / `dark` / `auto`; no (or an unknown) value is the default, Light. */
export function appearanceFromCookie(cookie: string): Appearance {
  return explicitAppearance(cookie) ?? DEFAULT_APPEARANCE;
}

/**
 * 🌗 THE SIGN-IN CARDS FOLLOW THE PHONE, SIGNED OUT TOO (owner 24 Nov 2026, DECISION_LOG "Sign in and Create account:
 * simple, dark, a forming logo": "Make it follow dark" — an exception to 13 Oct call 4 and to K2's "signed-out public
 * pages stay light", for these two cards only). On these routes a SIGNED-OUT visitor with no choice on this device is
 * treated as Automatic: a phone set to dark gets the dark card. An explicit choice still wins (`sn-theme=light` stays
 * Light). Exactly these two pages (`$`), never the routes below them. The pop-up card over any other page follows the
 * same rule on its own overlay (`sign-in-here-panel.tsx`, `.sn-dark-scope`) — the page behind it keeps its look.
 * Same matcher as the ready-list (`isDarkReady`); the inline <head> script mirrors it (`theme-bootstrap-script.ts`).
 */
export const SIGNED_OUT_FOLLOWS_PHONE: readonly string[] = ['/login$', '/signup$'];

/** The choice a signed-out visitor's sign-in card follows: what the cookie holds, else Automatic. */
export function signInCardChoice(cookie: string): Appearance {
  return explicitAppearance(cookie) ?? 'auto';
}

/** Does this choice mean dark, given what the phone / OS prefers right now? */
export function choiceIsDark(choice: Appearance, prefersDark: boolean): boolean {
  return choice === 'dark' || (choice === 'auto' && prefersDark);
}

/**
 * Signed in = a Supabase session cookie is present (`sb-<project>-auth-token`, chunked `.0` `.1` on a
 * long token). @supabase/ssr writes it readable by the page. No session → Light, always (call 4),
 * even when an `sn-theme=dark` is left over from someone who signed out on this device.
 */
export function signedInFromCookie(cookie: string): boolean {
  return /(?:^|;\s*)sb-[A-Za-z0-9]+-auth-token(?:\.\d+)?=/.test(cookie);
}

/**
 * The same shape, one cookie NAME at a time — for a server page holding the request's jar (`(await cookies()).getAll()`).
 * The PKCE code verifier (`…-auth-token-code-verifier`) is not a session and does not match.
 */
export function isSessionCookieName(name: string): boolean {
  return /^sb-[A-Za-z0-9]+-auth-token(?:\.\d+)?$/.test(name);
}

/**
 * Is `pathname` on the ready-list?
 *
 * An entry is a path PREFIX ("/dashboard/people" → itself and everything below it, never the sibling
 * "/dashboard/peoplex"). Two marks narrow it, because an event's screens sit under a dynamic segment a plain prefix
 * cannot name:
 *   · `*`  one path segment that is an ID — it must hold a digit. Every event id does (a UUID, `S89E-…`); no static
 *          folder under /dashboard does (`lib/appearance.test.ts` reads the folders and holds that), so
 *          "/dashboard/*" can never match "/dashboard/billing".
 *   · `$`  at the end: this route EXACTLY, not the routes below it.
 * The inline <head> script (`theme-bootstrap-script.ts`) applies the same rule; the test runs both on one table.
 */
export function isDarkReady(pathname: string, ready: readonly string[] = DARK_READY): boolean {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const have = path.split('/');
  return ready.some((entry) => {
    const exact = entry.endsWith('$');
    const body = exact ? entry.slice(0, -1) : entry;
    const want = (body.length > 1 && body.endsWith('/') ? body.slice(0, -1) : body).split('/');
    if (exact ? have.length !== want.length : have.length < want.length) return false;
    return want.every((seg, i) => (seg === '*' ? /\d/.test(have[i] ?? '') : seg === have[i]));
  });
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

/**
 * THE RULE: dark is painted only for a signed-in person whose choice means dark (Dark, or Automatic on a phone
 * that prefers dark), on a swept app screen — and, on the two sign-in pages (`SIGNED_OUT_FOLLOWS_PHONE`), for a
 * signed-out visitor too, whose missing choice there means Automatic.
 */
export function darkApplies(
  {
    pathname,
    cookie,
    appRoutes,
    prefersDark = false,
  }: { pathname: string; cookie: string; appRoutes: ReadonlySet<string>; prefersDark?: boolean },
  ready: readonly string[] = DARK_READY,
  followsPhone: readonly string[] = SIGNED_OUT_FOLLOWS_PHONE,
): boolean {
  const signedIn = signedInFromCookie(cookie);
  const signedOutCard = !signedIn && isDarkReady(pathname, followsPhone);
  const choice = signedOutCard ? signInCardChoice(cookie) : appearanceFromCookie(cookie);
  return (
    choiceIsDark(choice, prefersDark) &&
    (signedIn || signedOutCard) &&
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

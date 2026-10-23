/**
 * APPEARANCE — Light · Dark · Automatic, and dark only on the swept ready-list (dark mode PR 3).
 *
 * The owner's rules (DECISION_LOG 2026-10-13, "approve all", and 2026-10-23): Light · Dark · Automatic,
 * chosen by the person, AUTOMATIC (follow the phone) the default — 2026-10-23 supersedes call 1; a
 * dropdown in Preferences now that it is three choices (call 2 was for two); dark opens area by area
 * through a ready-list (3); signed-out visitors always Light (4); the couple's guest pages keep the
 * couple's design (5).
 *
 * What this pins:
 *   (a) the rule `darkApplies` on a table of people × paths;
 *   (b) the REAL inline <head> script, run against a fake document, decides and paints EXACTLY as the
 *       rule does — the before-paint copy can never drift from the TypeScript one;
 *   (c) with the shipped ready-list (empty) the script never adds `.dark` and never touches the
 *       browser-bar colour, for ANY person on ANY path — the "nothing changes yet" proof;
 *   (d) a ready-list entry can only ever be an app route, never a couple's slug;
 *   (e) the pieces around it: no frozen light lock left, the save makes no server re-render, the
 *       control is the shared PillSelector, and the migration puts everyone on Light.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { DARK_READY, DEFAULT_APPEARANCE, THEME_COLOR, appearanceSwitchShown, appearanceCookieAssignment, appearanceFromCookie, darkApplies, signedInFromCookie } from './appearance';
import { ROUTE_RESERVED_SLUGS } from './reserved-slugs';
import { buildThemeBootstrapScript, themeBootstrapScript } from '../app/_components/theme-bootstrap-script';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

const SESSION = 'sb-abcdefghij-auth-token=base64-xyz';
const SESSION_CHUNKED = 'sb-abcdefghij-auth-token.0=base64-a; sb-abcdefghij-auth-token.1=b';
const COOKIES = {
  'nothing': '',
  'chose dark, signed out': 'sn-theme=dark',
  'chose light, signed in': `sn-theme=light; ${SESSION}`,
  'chose dark, signed in': `foo=1; sn-theme=dark; ${SESSION}`,
  'chose dark, signed in (chunked)': `${SESSION_CHUNKED}; sn-theme=dark`,
  'signed in, never chose': SESSION,
  'chose automatic, signed in': `sn-theme=auto; ${SESSION}`,
  'chose automatic, signed out': 'sn-theme=auto',
  'look-alike cookie name': `xsn-theme=dark; ${SESSION}`,
  'look-alike value': `sn-theme=darker; ${SESSION}`,
} as const;
type Who = keyof typeof COOKIES;
const PATHS = [
  '/',
  '/dashboard',
  '/dashboard/abc/guests',
  '/dashboardx',
  '/vendor-dashboard/clients',
  '/admin',
  '/login',
  '/marco-marga', // a couple's Event Hub
  '/marco-marga/rsvp',
  '/papic/abc',
];
const SAMPLE_READY = ['/dashboard', '/papic'];

/** Run an inline head script against a fake page; return what it painted. */
function runScript(script: string, pathname: string, cookie: string, prefersDark = false) {
  const classes = new Set<string>(['dark']); // a stale class, as a cached shell might carry
  const attrs = new Map<string, string>([['content', THEME_COLOR.light]]);
  const meta = {
    getAttribute: (k: string) => attrs.get(k) ?? null,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    hasAttribute: (k: string) => attrs.has(k),
  };
  const document = {
    cookie,
    documentElement: { classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } },
    querySelector: (sel: string) => (sel === 'meta[name="theme-color"]' ? meta : null),
  };
  const window: Record<string, unknown> = {
    matchMedia: (q: string) => ({ matches: q === '(prefers-color-scheme: dark)' ? prefersDark : false }),
  };
  new Function('document', 'location', 'window', script)(document, { pathname }, window);
  return { dark: classes.has('dark'), bar: attrs.get('content'), api: window.__snTheme as { decide: (p: string, c?: string) => boolean } };
}

test('(a) the rule: dark only for a signed-in person whose choice means dark, on a ready app screen', () => {
  const appRoutes = ROUTE_RESERVED_SLUGS;
  const d = (path: string, who: Who, ready = SAMPLE_READY, prefersDark = false) =>
    darkApplies({ pathname: path, cookie: COOKIES[who], appRoutes, prefersDark }, ready);
  assert.equal(d('/dashboard/abc/guests', 'chose dark, signed in'), true);
  assert.equal(d('/dashboard', 'chose dark, signed in (chunked)'), true);
  assert.equal(d('/dashboard', 'chose dark, signed out'), false, 'signed out is always Light (call 4)');
  assert.equal(d('/dashboard', 'chose light, signed in'), false);
  // 🌗 Automatic — the default since 2026-10-23: no choice, or `auto`, follows the phone.
  assert.equal(d('/dashboard', 'signed in, never chose', SAMPLE_READY, false), false, 'no choice on a light phone = Light');
  assert.equal(d('/dashboard', 'signed in, never chose', SAMPLE_READY, true), true, 'no choice on a dark phone = Dark (Automatic is the default)');
  assert.equal(d('/dashboard', 'chose automatic, signed in', SAMPLE_READY, true), true);
  assert.equal(d('/dashboard', 'chose automatic, signed in', SAMPLE_READY, false), false);
  assert.equal(d('/dashboard', 'chose light, signed in', SAMPLE_READY, true), false, 'an explicit Light ignores a dark phone');
  assert.equal(d('/dashboard', 'chose dark, signed in', SAMPLE_READY, false), true, 'an explicit Dark ignores a light phone');
  assert.equal(d('/dashboard', 'chose automatic, signed out', SAMPLE_READY, true), false, 'signed out is always Light, even on a dark phone');
  assert.equal(d('/admin', 'signed in, never chose', SAMPLE_READY, true), false, 'Automatic never paints off the ready-list');
  assert.equal(d('/marco-marga', 'signed in, never chose', ['/'], true), false, 'Automatic never reaches the Event Hub');
  assert.equal(d('/dashboard', 'look-alike cookie name'), false);
  assert.equal(d('/dashboard', 'look-alike value'), false, 'an unknown value is the default (Automatic) — on a light phone, Light');
  assert.equal(d('/dashboardx', 'chose dark, signed in'), false, 'a prefix is not a sibling');
  assert.equal(d('/admin', 'chose dark, signed in'), false, 'not on the ready-list');
  // A couple's guest pages stay in the couple's design even if the list somehow covered everything.
  assert.equal(d('/marco-marga', 'chose dark, signed in', ['/']), false, 'the Event Hub is never dark (call 5)');
  assert.equal(d('/marco-marga/rsvp', 'chose dark, signed in', ['/']), false);
  assert.equal(d('/', 'chose dark, signed in', ['/']), true, '"/" is the app');
  assert.equal(signedInFromCookie('sb-x-auth-token-code-verifier=1'), false, 'the PKCE verifier is not a session');
  assert.equal(appearanceFromCookie(appearanceCookieAssignment('dark', true).split(';')[0] ?? ''), 'dark');
});

test('(b) the real <head> script decides and paints exactly as the rule, for every person, path and phone', () => {
  const script = buildThemeBootstrapScript(SAMPLE_READY);
  let n = 0;
  for (const prefersDark of [false, true]) {
    for (const [who, cookie] of Object.entries(COOKIES)) {
      for (const path of PATHS) {
        const want = darkApplies({ pathname: path, cookie, appRoutes: ROUTE_RESERVED_SLUGS, prefersDark }, SAMPLE_READY);
        const got = runScript(script, path, cookie, prefersDark);
        const tag = `${who} on ${path} (${prefersDark ? 'dark' : 'light'} phone)`;
        assert.equal(got.dark, want, `${tag}: script painted ${got.dark ? 'dark' : 'light'}, the rule says ${want ? 'dark' : 'light'}`);
        assert.equal(got.bar, want ? THEME_COLOR.dark : THEME_COLOR.light, `${tag}: browser bar`);
        assert.equal(got.api.decide(path, cookie), want, `window.__snTheme.decide disagrees on ${tag}`);
        n++;
      }
    }
  }
  assert.ok(n >= 200, `only ${n} cases ran`);
});

test('(c) as shipped — dark reaches ONLY the swept account spokes + sign-in cards (B2), never the event tree', () => {
  // The event tree, the supplier tree, admin, the guest Hub and Papic stay Light for EVERYONE until their batch
  // lists them — one prefix rule, no exception list (controller 2026-10-22). "/dashboard" exactly is the Events
  // board, which opens with the event tree (B3); a B2 prefix must never be a sibling-match of it.
  const SHIPPED_LIGHT = ['/', '/dashboard', '/dashboard/abc/guests', '/dashboard/peoplex', '/vendor-dashboard/clients', '/admin', '/marco-marga', '/papic/abc'];
  const SHIPPED_DARK = ['/dashboard/people', '/dashboard/profile', '/dashboard/library/photos', '/dashboard/samahan/c1', '/login', '/signup/you'];
  for (const prefersDark of [false, true]) {
    for (const [who, cookie] of Object.entries(COOKIES)) {
      const chose = darkApplies({ pathname: '/dashboard/profile', cookie, appRoutes: ROUTE_RESERVED_SLUGS, prefersDark });
      for (const path of SHIPPED_LIGHT) {
        const got = runScript(themeBootstrapScript, path, cookie, prefersDark);
        assert.equal(got.dark, false, `${who} on ${path} would see dark before its batch`);
        assert.equal(got.bar, THEME_COLOR.light, `${who} on ${path}: the light browser bar was touched`);
      }
      for (const path of SHIPPED_DARK) {
        const got = runScript(themeBootstrapScript, path, cookie, prefersDark);
        assert.equal(got.dark, chose, `${who} on ${path}: dark only for a signed-in person whose choice means dark`);
      }
    }
  }
  assert.ok(!DARK_READY.includes('/dashboard'), '"/dashboard" opens with the whole event tree (B3), not before');
});

test('(d) a ready-list entry is always an app route, never a couple’s slug', () => {
  for (const p of DARK_READY) {
    assert.match(p, /^\/[a-z0-9-]+(\/|$)/, `"${p}" must be an absolute path prefix`);
    const first = p.split('/')[1] ?? '';
    assert.ok(ROUTE_RESERVED_SLUGS.has(first), `"${p}" starts with "${first}", which is not an app route — it could be a couple's page`);
  }
});

test('(e) the lock is gone, the save re-renders nothing, the control is the dropdown, and Automatic is the default', () => {
  const provider = stripComments(read('app/_components/theme-provider.tsx'));
  assert.doesNotMatch(provider, /LIGHT_LOCKED/, 'the frozen light-locked value is back');
  assert.match(provider, /__snTheme/, 'the provider must ask the head script’s rule, not keep its own');
  assert.match(provider, /beforeprint/, 'print must stay light (owner call 9)');
  // 🌗 Automatic follows the phone LIVE: the provider listens to the media query and re-asks the head script.
  assert.match(provider, /matchMedia\('\(prefers-color-scheme: dark\)'\)/, 'Automatic must follow the phone while the app is open');
  assert.match(provider, /addEventListener\?\.\('change'/, 'the provider must listen for the phone flipping light ↔ dark');

  const actions = stripComments(read('app/dashboard/(account)/profile/actions.ts'));
  const start = actions.indexOf('export async function updateThemePreference');
  const body = actions.slice(start, actions.indexOf('\nexport ', start + 10));
  assert.ok(start > -1, 'updateThemePreference is gone');
  assert.doesNotMatch(body, /revalidatePath|cookies\(\)/, 'the Appearance save must not re-render on the server (least requests)');
  assert.match(body, /isAppearance\(raw\)/, 'the save must refuse anything but light / dark / auto');

  const control = stripComments(read('app/dashboard/(account)/profile/_components/appearance-choice.tsx'));
  assert.match(control, /<PickMenu\b/, 'three choices are ONE PickMenu dropdown (house rule 2026-09-28; call 2 was for two)');
  for (const key of ['light', 'dark', 'auto']) assert.match(control, new RegExp(`key: '${key}'`), `the dropdown must offer '${key}'`);
  const page = stripComments(read('app/dashboard/(account)/profile/page.tsx'));
  const pane = page.slice(page.indexOf('const preferencesPane'));
  // Planner mode left Preferences on 2026-10-23 (owner); Appearance stays the first row.
  assert.ok(pane.indexOf('<AppearanceChoice') > -1 && pane.indexOf('<AppearanceChoice') < pane.indexOf('label="Display language"'),
    'Appearance is the first row of Preferences, above Display language');
  // 🚦 HIDDEN WHILE THE READY-LIST IS EMPTY (owner 2026-10-16): every mount sits behind the ONE condition.
  const mounts = [...page.matchAll(/<AppearanceChoice\b/g)].length;
  const gated = [...page.matchAll(/\{appearanceSwitchShown\(\) \? <AppearanceChoice\b[^}]*\} \/> : null\}/g)].length;
  assert.equal(mounts, 1, 'one Appearance row');
  assert.equal(gated, mounts, 'the Appearance row renders only when appearanceSwitchShown() — never with an empty ready-list');

  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  // 2026-10-23: Automatic is the default; the old auto → light rows that nobody picked follow the phone.
  const auto = readdirSync(dir).filter((f) => /users_theme_preference_automatic_by_default\.sql$/.test(f));
  assert.equal(auto.length, 1, 'the Automatic-by-default migration is missing');
  const autoSql = stripComments(readFileSync(join(dir, auto[0] ?? ''), 'utf8'));
  assert.match(autoSql, /SET theme_preference = 'auto'\s+WHERE theme_preference = 'light'\s+AND updated_at < /, 'only a Light nobody picked moves to Automatic');
  assert.doesNotMatch(autoSql, /WHERE theme_preference = 'dark'/, 'a picked Dark is never moved');
  assert.match(autoSql, /ALTER COLUMN theme_preference SET DEFAULT 'auto'/);
  assert.equal(DEFAULT_APPEARANCE, 'auto');
  assert.equal(appearanceFromCookie(''), 'auto', 'no cookie = Automatic');
  const mig = readdirSync(dir).filter((f) => /users_theme_preference_light_by_default\.sql$/.test(f));
  assert.equal(mig.length, 1, 'the auto → light migration is missing');
  const sql = readFileSync(join(dir, mig[0] ?? ''), 'utf8');
  assert.match(sql, /SET theme_preference = 'light'\s+WHERE theme_preference = 'auto'/);
  assert.match(sql, /ALTER COLUMN theme_preference SET DEFAULT 'light'/);
});

test('🚦 the Light/Dark switch never shows with an empty ready-list (owner 2026-10-16)', () => {
  assert.equal(appearanceSwitchShown([]), false, 'empty list → no switch');
  assert.equal(appearanceSwitchShown(['/dashboard']), true, 'the first area on the list → the switch shows');
  assert.equal(appearanceSwitchShown(), DARK_READY.length > 0, 'the default reads the ready-list itself');
  if (DARK_READY.length === 0) assert.equal(appearanceSwitchShown(), false, 'today: hidden');
});

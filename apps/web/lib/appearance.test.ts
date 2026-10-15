/**
 * APPEARANCE — the switch is on, and with the ready-list empty NOBODY SEES DARK (dark mode PR 3).
 *
 * The owner's rules (DECISION_LOG 2026-10-13, "approve all"): Light · Dark, chosen by the person, no
 * "follow the phone" (1); a pill selector in Preferences (2); dark opens area by area through a
 * ready-list, so nobody ever sees a half-dark screen (3); signed-out visitors always Light (4); the
 * couple's guest pages keep the couple's design (5).
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
import { DARK_READY, THEME_COLOR, appearanceSwitchShown, appearanceCookieAssignment, appearanceFromCookie, darkApplies, signedInFromCookie } from './appearance';
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
function runScript(script: string, pathname: string, cookie: string) {
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
  const window: Record<string, unknown> = {};
  new Function('document', 'location', 'window', script)(document, { pathname }, window);
  return { dark: classes.has('dark'), bar: attrs.get('content'), api: window.__snTheme as { decide: (p: string, c?: string) => boolean } };
}

test('(a) the rule: dark only for a signed-in person who chose it, on a ready app screen', () => {
  const appRoutes = ROUTE_RESERVED_SLUGS;
  const d = (path: string, who: Who, ready = SAMPLE_READY) => darkApplies({ pathname: path, cookie: COOKIES[who], appRoutes }, ready);
  assert.equal(d('/dashboard/abc/guests', 'chose dark, signed in'), true);
  assert.equal(d('/dashboard', 'chose dark, signed in (chunked)'), true);
  assert.equal(d('/dashboard', 'chose dark, signed out'), false, 'signed out is always Light (call 4)');
  assert.equal(d('/dashboard', 'chose light, signed in'), false);
  assert.equal(d('/dashboard', 'signed in, never chose'), false, 'no choice = Light (call 1: Light is the default)');
  assert.equal(d('/dashboard', 'look-alike cookie name'), false);
  assert.equal(d('/dashboard', 'look-alike value'), false);
  assert.equal(d('/dashboardx', 'chose dark, signed in'), false, 'a prefix is not a sibling');
  assert.equal(d('/admin', 'chose dark, signed in'), false, 'not on the ready-list');
  // A couple's guest pages stay in the couple's design even if the list somehow covered everything.
  assert.equal(d('/marco-marga', 'chose dark, signed in', ['/']), false, 'the Event Hub is never dark (call 5)');
  assert.equal(d('/marco-marga/rsvp', 'chose dark, signed in', ['/']), false);
  assert.equal(d('/', 'chose dark, signed in', ['/']), true, '"/" is the app');
  assert.equal(signedInFromCookie('sb-x-auth-token-code-verifier=1'), false, 'the PKCE verifier is not a session');
  assert.equal(appearanceFromCookie(appearanceCookieAssignment('dark', true).split(';')[0] ?? ''), 'dark');
});

test('(b) the real <head> script decides and paints exactly as the rule, for every person and path', () => {
  const script = buildThemeBootstrapScript(SAMPLE_READY);
  let n = 0;
  for (const [who, cookie] of Object.entries(COOKIES)) {
    for (const path of PATHS) {
      const want = darkApplies({ pathname: path, cookie, appRoutes: ROUTE_RESERVED_SLUGS }, SAMPLE_READY);
      const got = runScript(script, path, cookie);
      assert.equal(got.dark, want, `${who} on ${path}: script painted ${got.dark ? 'dark' : 'light'}, the rule says ${want ? 'dark' : 'light'}`);
      assert.equal(got.bar, want ? THEME_COLOR.dark : THEME_COLOR.light, `${who} on ${path}: browser bar`);
      assert.equal(got.api.decide(path, cookie), want, `window.__snTheme.decide disagrees on ${who} · ${path}`);
      n++;
    }
  }
  assert.ok(n >= 80, `only ${n} cases ran`);
});

test('(c) as shipped — the ready-list is EMPTY, so nobody sees dark anywhere yet', () => {
  assert.deepEqual([...DARK_READY], [], 'an area PR adds its prefix only once every screen under it is swept in dark');
  for (const [who, cookie] of Object.entries(COOKIES)) {
    for (const path of PATHS) {
      const got = runScript(themeBootstrapScript, path, cookie);
      assert.equal(got.dark, false, `${who} on ${path} would see dark`);
      assert.equal(got.bar, THEME_COLOR.light, `${who} on ${path}: the light browser bar was touched`);
    }
  }
});

test('(d) a ready-list entry is always an app route, never a couple’s slug', () => {
  for (const p of DARK_READY) {
    assert.match(p, /^\/[a-z0-9-]+(\/|$)/, `"${p}" must be an absolute path prefix`);
    const first = p.split('/')[1] ?? '';
    assert.ok(ROUTE_RESERVED_SLUGS.has(first), `"${p}" starts with "${first}", which is not an app route — it could be a couple's page`);
  }
});

test('(e) the lock is gone, the save re-renders nothing, the control is the pill, and everyone starts on Light', () => {
  const provider = stripComments(read('app/_components/theme-provider.tsx'));
  assert.doesNotMatch(provider, /LIGHT_LOCKED/, 'the frozen light-locked value is back');
  assert.match(provider, /__snTheme/, 'the provider must ask the head script’s rule, not keep its own');
  assert.match(provider, /beforeprint/, 'print must stay light (owner call 9)');

  const actions = stripComments(read('app/dashboard/(account)/profile/actions.ts'));
  const start = actions.indexOf('export async function updateThemePreference');
  const body = actions.slice(start, actions.indexOf('\nexport ', start + 10));
  assert.ok(start > -1, 'updateThemePreference is gone');
  assert.doesNotMatch(body, /revalidatePath|cookies\(\)/, 'the Appearance save must not re-render on the server (least requests)');
  assert.match(body, /isAppearance\(raw\)/, "the save must refuse 'auto' and anything else");

  const control = stripComments(read('app/dashboard/(account)/profile/_components/appearance-choice.tsx'));
  assert.match(control, /<PillSelector\b/, 'a two-way choice is the shared PillSelector (call 2)');
  const page = stripComments(read('app/dashboard/(account)/profile/page.tsx'));
  const pane = page.slice(page.indexOf('const preferencesPane'));
  assert.ok(pane.indexOf('<AppearanceChoice') > -1 && pane.indexOf('<AppearanceChoice') < pane.indexOf('label="Planner mode"'),
    'Appearance is the first row of Preferences, above Planner mode');
  // 🚦 HIDDEN WHILE THE READY-LIST IS EMPTY (owner 2026-10-16): every mount sits behind the ONE condition.
  const mounts = [...page.matchAll(/<AppearanceChoice\b/g)].length;
  const gated = [...page.matchAll(/\{appearanceSwitchShown\(\) \? <AppearanceChoice\b[^}]*\} \/> : null\}/g)].length;
  assert.equal(mounts, 1, 'one Appearance row');
  assert.equal(gated, mounts, 'the Appearance row renders only when appearanceSwitchShown() — never with an empty ready-list');

  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
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

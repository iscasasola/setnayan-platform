/**
 * Guard: OTHER ACCOUNTS ON THIS PHONE — a switch is a different `auth.uid()` end to end, no credential of one
 * account travels with another's requests, and "Sign out of all accounts" leaves no session behind.
 *
 * (Avatar sheet PR2, owner 2026-10-22: "Like in facebook how i can switch to different email addresses".) The jar
 * design is in lib/account-jars.ts; the switch's decision in lib/account-switch.ts.
 *
 * Run from apps/web: `node --import tsx --test lib/accounts-on-this-phone.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACCOUNTS_LIST_COOKIE,
  JAR_PATH,
  MAX_ACCOUNTS_PER_DEVICE,
  canAddAnother,
  decodeJar,
  decodeParkedList,
  encodeJar,
  encodeParkedList,
  jarCookieName,
  jarCookieOptions,
  listCookieOptions,
  otherAccounts,
  parkInList,
  accountCookiesOnSignOut,
  signOutAllAction,
  type ParkedAccount,
} from '@/lib/account-jars';
import { performSwitch, type SwitchDeps } from '@/lib/account-switch';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ICE = '11111111-1111-4111-8111-111111111111';
const CLAIRE = '22222222-2222-4222-8222-222222222222';
const MALLORY = '33333333-3333-4333-8333-333333333333';

/* A tiny model of Supabase: refresh tokens name a user; activating a session makes it the one every later request
   carries. `whoAmI()` is what an RLS check would see as auth.uid(). */
function world(sessions: Record<string, string>, signedIn: { uid: string; refresh: string } | null) {
  let active: string | null = signedIn?.uid ?? null;
  const deps: SwitchDeps = {
    refresh: async (t) => (sessions[t] ? { uid: sessions[t]!, access: `acc-${sessions[t]}`, refresh: `${t}-rotated` } : null),
    current: async () => (signedIn && active === signedIn.uid ? { uid: signedIn.uid, email: 'ice@example.com', name: 'Ice', refresh: signedIn.refresh } : null),
    activate: async (s) => {
      const uid = s.access.replace(/^acc-/, '');
      active = uid;
      return uid;
    },
  };
  return { deps, whoAmI: () => active };
}

/* ─── 1 · switching changes auth.uid for every later request ─────────────── */

test('a switch makes the target the uid every later request carries, and parks the one who left', async () => {
  const w = world({ 'claire-rt-000': CLAIRE }, { uid: ICE, refresh: 'ice-rt-0000' });
  const list: ParkedAccount[] = [{ uid: CLAIRE, email: 'claire@example.com', name: 'Claire' }];
  const r = await performSwitch(w.deps, { target: CLAIRE, jar: { uid: CLAIRE, refresh: 'claire-rt-000' }, list });
  assert.equal(r.ok, true);
  assert.equal(w.whoAmI(), CLAIRE, 'after the switch the requests are not Claire');
  assert.ok(r.ok && r.park && r.park.uid === ICE && r.park.refresh === 'ice-rt-0000', 'Ice was not parked');
  assert.deepEqual(r.ok && r.list.map((a) => a.uid), [ICE], 'the list still offers Claire, or lost Ice');
});

test('a jar that refreshes into SOMEBODY ELSE is refused, and nothing changes', async () => {
  // A swapped cookie: the jar says Claire, the token is Mallory's.
  const w = world({ 'mallory-rt-0': MALLORY }, { uid: ICE, refresh: 'ice-rt-0000' });
  const r = await performSwitch(w.deps, { target: CLAIRE, jar: { uid: CLAIRE, refresh: 'mallory-rt-0' }, list: [] });
  assert.equal(r.ok, false);
  assert.equal(w.whoAmI(), ICE, 'a refused switch changed who the requests are');
});

test('an expired jar is refused, the active account is untouched, and the dead row is dropped', async () => {
  const w = world({}, { uid: ICE, refresh: 'ice-rt-0000' });
  const list: ParkedAccount[] = [{ uid: CLAIRE, email: 'claire@example.com', name: 'Claire' }];
  const r = await performSwitch(w.deps, { target: CLAIRE, jar: { uid: CLAIRE, refresh: 'gone-rt-0000' }, list });
  assert.equal(r.ok, false);
  assert.equal(w.whoAmI(), ICE);
  assert.deepEqual(r.list, []);
});

test('no jar for the target → refused (a row cannot be switched to on its name alone)', async () => {
  const w = world({ 'claire-rt-000': CLAIRE }, { uid: ICE, refresh: 'ice-rt-0000' });
  const r = await performSwitch(w.deps, { target: CLAIRE, jar: null, list: [] });
  assert.equal(r.ok, false);
  assert.equal(w.whoAmI(), ICE);
});

test('the route writes the new session only on success, and only what activation wrote', () => {
  const src = code('app/auth/accounts/switch/route.ts');
  const refused = src.indexOf('if (!result.ok) return response;');
  const expire = src.indexOf('expireSessionCookies(request, response, secure);');
  const apply = src.indexOf('applyPending(request, response, activeFrom >= 0 ? pending.slice(activeFrom) : []);');
  assert.ok(refused > 0 && expire > refused && apply > expire, 'session cookies are written before the switch is known good');
  assert.match(src, /activeFrom = pending\.length;\s*const \{ data, error \} = await supabase\.auth\.setSession\(/);
});

/* ─── 2 · no credential of A travels with B's requests ───────────────────── */

test('a jar is httpOnly and sent ONLY to the account routes — never to a page, an API or an RLS read', () => {
  for (const secure of [true, false]) {
    const o = jarCookieOptions(secure);
    assert.equal(o.path, JAR_PATH);
    assert.equal(o.httpOnly, true);
    assert.equal(o.sameSite, 'lax');
  }
  assert.equal(JAR_PATH, '/auth/accounts');
  // Every place that writes a jar uses those options (no hand-rolled path: '/').
  let writes = 0;
  for (const rel of ['app/auth/accounts/switch/route.ts', 'app/auth/accounts/add/route.ts', 'app/auth/accounts/sign-out-all/route.ts']) {
    const src = code(rel);
    for (const m of src.matchAll(/response\.cookies\.set\((jarCookieName\([^)]*\)|n),[^;]*;/g)) {
      writes += 1;
      assert.match(m[0], /jarCookieOptions\(secure\)/, `${rel} writes a jar without the jar options: ${m[0]}`);
    }
  }
  assert.ok(writes >= 4, `expected the four jar writes (park on add, spend + park on switch, expire on sign-out-all), found ${writes}`);
});

test('the display list carries no credential, however it is fed', () => {
  const list = [{ uid: CLAIRE, email: 'claire@example.com', name: 'Claire', refresh: 'claire-rt-000', access: 'eyJ…' }];
  const raw = encodeParkedList(list as unknown as ParkedAccount[]);
  const txt = Buffer.from(raw, 'base64url').toString('utf8');
  assert.doesNotMatch(txt, /claire-rt-000|eyJ/, 'a token reached the list cookie');
  // And a tampered list cookie cannot smuggle one through to the page.
  const tampered = Buffer.from(JSON.stringify([{ u: CLAIRE, e: 'c@x', n: 'C', r: 'claire-rt-000' }])).toString('base64url');
  assert.deepEqual(Object.keys(decodeParkedList(tampered)[0]!).sort(), ['email', 'name', 'uid']);
  assert.equal(listCookieOptions(true).httpOnly, true);
});

test('the sheet never draws the signed-in account as an "other" one, and caps the device', () => {
  const list: ParkedAccount[] = [
    { uid: ICE, email: 'i@x', name: 'Ice' },
    { uid: CLAIRE, email: 'c@x', name: 'Claire' },
  ];
  assert.deepEqual(otherAccounts(list, ICE).map((a) => a.uid), [CLAIRE]);
  let l: ParkedAccount[] = [];
  for (let i = 0; i < MAX_ACCOUNTS_PER_DEVICE + 2; i++) {
    const uid = `4444444${i}-4444-4444-8444-444444444444`;
    const next = parkInList(l, { uid, email: `${i}@x`, name: null });
    if (next) l = next;
  }
  assert.equal(l.length, MAX_ACCOUNTS_PER_DEVICE - 1, 'the device holds more logins than the cap');
  assert.equal(canAddAnother(l), false);
});

test('a jar names its own account — a jar for one uid cannot be read as another', () => {
  const raw = encodeJar({ uid: CLAIRE, refresh: 'claire-rt-000' });
  assert.deepEqual(decodeJar(raw), { uid: CLAIRE, refresh: 'claire-rt-000' });
  assert.equal(decodeJar('not-a-jar'), null);
  assert.notEqual(jarCookieName(CLAIRE), jarCookieName(ICE));
  assert.throws(() => jarCookieName('../admin'));
});

/* ─── 3 · sign out of all accounts leaves no session ─────────────────────── */

test('"Sign out of all accounts" revokes and expires every jar, clears the list, then signs out the active one', () => {
  const src = code('app/auth/accounts/sign-out-all/route.ts');
  assert.match(src, /const names = jarNamesIn\(request\.cookies\.getAll\(\)\.map\(\(c\) => c\.name\)\);/);
  assert.match(src, /if \(jar\) await revokeParked\(jar\.refresh\);/, 'parked sessions are not revoked at Supabase');
  assert.match(src, /for \(const n of names\) response\.cookies\.set\(n, '', \{ \.\.\.jarCookieOptions\(secure\), maxAge: 0 \}\);/);
  assert.match(src, /response\.cookies\.set\(ACCOUNTS_LIST_COOKIE, '', \{ \.\.\.listCookieOptions\(secure\), maxAge: 0 \}\);/);
  assert.match(src, /new URL\('\/auth\/sign-out', request\.url\), \{ status: 307 \}/, 'the active account is not signed out after');
  // The sheet's quiet line goes there.
  // The sheet's quiet line goes there whenever another account is on the phone.
  assert.equal(signOutAllAction([{ uid: CLAIRE, email: 'c@x', name: null }]), '/auth/accounts/sign-out-all');
});

/* ─── 4 · ONE ACCOUNT ON THIS PHONE BEHAVES EXACTLY AS BEFORE ─────────────
   The App Store reviewer's demo account — and every login that never pressed "+ Add another account" — must not
   see a single changed byte in sign-in or sign-out. */

test('a single-account sign-out writes NO account cookie — the response is the old sign-out', () => {
  for (const list of [undefined, null, '']) {
    assert.deepEqual(accountCookiesOnSignOut(list, ICE, true), [], `sign-out with list=${String(list)} wrote account cookies`);
  }
  assert.deepEqual(accountCookiesOnSignOut(undefined, null, true), []);
  // …and the route applies nothing else of the account switch: its only account writes are that decision's.
  const route = code('app/auth/sign-out/route.ts');
  assert.match(route, /for \(const c of accountCookiesOnSignOut\(request\.cookies\.get\(ACCOUNTS_LIST_COOKIE\)\?\.value, leaving\?\.id,/);
  assert.doesNotMatch(route, /jarCookieName|encodeParkedList|unparkFromList|\/auth\/accounts/, 'the sign-out route writes account cookies outside the one decision');
  // The old sweep is still there, unchanged in shape: every sb-* session cookie expired, then home.
  assert.match(route, /if \(cookie\.name\.startsWith\('sb-'\)\)/);
  assert.match(route, /NextResponse\.redirect\(new URL\('\/', request\.url\), \{ status: 303 \}\)/);
});

test('with other accounts parked, sign-out removes the leaving one from the phone (row + jar)', () => {
  const list = encodeParkedList([
    { uid: ICE, email: 'i@x', name: 'Ice' },
    { uid: CLAIRE, email: 'c@x', name: 'Claire' },
  ]);
  const out = accountCookiesOnSignOut(list, ICE, true);
  assert.deepEqual(out.map((c) => c.name), [ACCOUNTS_LIST_COOKIE, jarCookieName(ICE)]);
  assert.deepEqual(decodeParkedList(out[0]!.value).map((a) => a.uid), [CLAIRE], 'the leaving account stayed on the phone');
  assert.equal(out[1]!.options.maxAge, 0);
  assert.equal(out[1]!.options.path, JAR_PATH);
});

test('with nobody else on the phone, both sign-outs on the sheet are the plain /auth/sign-out', () => {
  assert.equal(signOutAllAction([]), '/auth/sign-out');
  assert.equal(signOutAllAction(undefined), '/auth/sign-out');
  assert.equal(signOutAllAction([{ uid: CLAIRE, email: 'c@x', name: null }]), '/auth/accounts/sign-out-all');
  const sheet = code('app/_components/account-switcher/account-switcher.tsx');
  assert.match(sheet, /<form action="\/auth\/sign-out" method="post" className="flex flex-1 basis-0">/, 'the Sign out tile no longer posts straight to /auth/sign-out');
  assert.match(sheet, /<form action=\{signOutAllAction\(data\.otherAccounts\)\}/);
});

test('sign-in is untouched — no sign-in file knows the account switch exists', () => {
  const SIGN_IN = [
    'app/login/page.tsx',
    'app/login/actions.ts',
    'app/auth/oauth-actions.ts',
    'app/auth/native-marker-action.ts',
    'app/auth/callback/route.ts',
    'middleware.ts',
    'lib/supabase/middleware.ts',
    'lib/supabase/server.ts',
    'lib/supabase/client.ts',
    'lib/supabase/cookies.ts',
  ];
  let read = 0;
  for (const rel of SIGN_IN) {
    let src: string;
    try {
      src = code(rel);
    } catch {
      continue;
    }
    read += 1;
    assert.doesNotMatch(src, /account-jars|account-switch|sn_acct|sn_accts|\/auth\/accounts/, `${rel} reaches into the account switch`);
  }
  assert.ok(read >= 8, `expected to read the sign-in files, read ${read} — a path moved`);
});

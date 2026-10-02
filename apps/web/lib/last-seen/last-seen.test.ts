/**
 * 💾 LAST-SEEN DATA SHOWS INSTANTLY, THEN REFRESHES — FOR A HOST'S MAIN PAGES
 * (NEVER MONEY). Owner 2026-10-02, DECISION_LOG.
 *
 * Five properties, each sabotaged once when this file was written (the
 * sabotage is named on each test, so it can be re-run):
 *   1. A kept page is painted from the phone at once, and the fresh render
 *      then replaces it.
 *   2. Money is never kept — not on write, not on read, and the money parts of
 *      the five pages carry the marker the snapshot drops.
 *   3. Sign-out empties the store.
 *   4. One account never sees another's kept pages on a shared phone.
 *   5. A refresh that does not come says so — old data is never passed off as
 *      current.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React, { Suspense, use } from 'react';
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  LAST_SEEN_PREFIX,
  guardSnapshotHtml,
  lastSeenKey,
  readLastSeen,
  saveLastSeen,
  type LastSeenStorage,
} from './store';
import { LAST_SEEN_WIPE_SCRIPT, hasAuthCookie, wipeLastSeenIfSignedOut } from './wipe';
import { LastSeenView } from '@/app/_components/last-seen/last-seen-fallback';
import { REFRESH_TIMEOUT_MS, lastSeenPath, refreshPhase } from '@/app/_components/last-seen/last-seen-mark';

// The components are compiled with the classic JSX runtime under tsx.
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** An in-memory `localStorage`. */
function memoryStorage(seed: Record<string, string> = {}): LastSeenStorage & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(seed));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const ANA = 'user-ana';
const BEN = 'user-ben';
const EVENT = 'event-1';
const HOME = `/dashboard/${EVENT}`;
const GUESTS = `/dashboard/${EVENT}/guests`;
const ROSTER = '<section><h2>Guest list</h2><ul><li>Maria Santos</li><li>Jose Reyes</li></ul><p>2 on your list</p></section>';

/**
 * Streams `node` through Fizz. `shell()` resolves with what the browser has
 * received once the shell (Suspense fallbacks included) is out; `done()` with
 * the whole document after every boundary has resolved.
 */
function stream(node: React.ReactNode): { shell: Promise<string>; done: Promise<string> } {
  let full = '';
  let onShell!: (html: string) => void;
  let onDone!: (html: string) => void;
  let fail!: (e: unknown) => void;
  const shell = new Promise<string>((r, j) => ((onShell = r), (fail = j)));
  const done = new Promise<string>((r) => (onDone = r));
  const out = new PassThrough();
  out.on('data', (c: Buffer) => (full += c.toString()));
  out.on('end', () => onDone(full));
  const s = renderToPipeableStream(node, {
    onShellReady() {
      s.pipe(out);
      setTimeout(() => onShell(full), 100);
    },
    onShellError: (e) => fail(e),
    onError: (e) => fail(e),
  });
  return { shell, done };
}

// ── 1. Cached first, then fresh ─────────────────────────────────────────────
// Sabotage run: `readLastSeen` returning null always → the round trip fails;
// `LastSeenView` dropping `dangerouslySetInnerHTML` → the shell assertion fails.
test('1 · a kept page renders at once from the phone, then the fresh render replaces it', async () => {
  const storage = memoryStorage();
  assert.equal(saveLastSeen(storage, { userId: ANA, eventId: EVENT, page: 'guests', url: GUESTS, html: ROSTER }), true);
  const kept = readLastSeen(storage, { userId: ANA, eventId: EVENT, page: 'guests', url: GUESTS });
  assert.ok(kept, 'the kept page comes back for the same host, event and page');
  assert.match(kept.html, /Maria Santos/);

  // The real hand-off: loading.tsx is the Suspense fallback; the page streams in.
  let release!: (v: string) => void;
  const fresh = new Promise<string>((r) => (release = r));
  function FreshPage() {
    return React.createElement('p', null, use(fresh));
  }
  // The event layout around the page boundary, as in the app.
  const tree = React.createElement(
    'main',
    null,
    React.createElement('nav', null, 'Home · Guests · Suppliers'),
    React.createElement(
      Suspense,
      { fallback: React.createElement(LastSeenView, { html: kept.html, savedAt: kept.savedAt, phase: 'updating' }) },
      React.createElement(FreshPage),
    ),
  );
  const run = stream(tree);
  const shell = await run.shell;
  release('3 on your list — Ana Cruz replied');
  const full = await run.done;
  assert.match(shell, /Maria Santos/, 'the shell paints the kept roster at once');
  assert.match(shell, /Updating…/, 'under the "Updating…" mark');
  assert.doesNotMatch(shell, /Ana Cruz/, 'before the fresh data exists');
  assert.match(full, /3 on your list — Ana Cruz replied/, 'then the fresh render arrives and takes its place');
  assert.match(shell, /inert/, 'and the kept copy can never be tapped as if it were live');

  // Each page has ONE address, and the Maker's embedded Schedule is not it.
  assert.equal(lastSeenPath(EVENT, 'home'), HOME);
  assert.equal(lastSeenPath(EVENT, 'guests'), GUESTS);
  assert.equal(lastSeenPath(EVENT, 'suppliers'), `/dashboard/${EVENT}/vendors`);
  assert.notEqual(lastSeenPath(EVENT, 'schedule'), `/dashboard/${EVENT}/launch`);
  // The kept copy is only ever shown on the exact page it was taken from.
  assert.equal(readLastSeen(storage, { userId: ANA, eventId: EVENT, page: 'guests', url: HOME }), null);
  assert.equal(readLastSeen(storage, { userId: ANA, eventId: 'event-2', page: 'guests', url: GUESTS }), null);
});

// ── 2. Never money ──────────────────────────────────────────────────────────
// Sabotage run: `guardSnapshotHtml` returning its input unchanged → every
// assertion below fails.
test('2 · money is never kept — a peso figure or a data-money part never reaches the store', () => {
  const storage = memoryStorage();
  const withMoney =
    '<div><p>Budget ₱<!-- -->930,000</p><p>Paid ₱12,500.50 · ₱1.2M · PHP 499</p>' +
    '<p aria-label="Still owing ₱8,000">Maria Santos</p></div>';
  assert.equal(saveLastSeen(storage, { userId: ANA, eventId: EVENT, page: 'home', url: HOME, html: withMoney }), true);
  const stored = Object.values(storage.dump()).join('\n');
  assert.doesNotMatch(stored, /₱|PHP\s?\d|930|12,500|1\.2M|499|8,000/, 'no figure survives, split by React or not');
  assert.match(stored, /Maria Santos/, 'the rest of the page is kept');

  // A money PART (a payment chip, a budget tile) is refused outright.
  const fresh = memoryStorage();
  const part = '<div><p>Maria Santos</p><div data-money="">Deposit paid</div></div>';
  assert.equal(saveLastSeen(fresh, { userId: ANA, eventId: EVENT, page: 'home', url: HOME, html: part }), false);
  assert.equal(fresh.length, 0, 'nothing written');
  assert.equal(guardSnapshotHtml('<b data-money>x</b>'), null);

  // A tampered or old entry carrying money is never READ back either.
  const tampered = memoryStorage({
    [`${LAST_SEEN_PREFIX}v1:owner`]: ANA,
    [lastSeenKey(ANA, EVENT, 'home')]: JSON.stringify({ url: HOME, html: '<p>&#8369;5,000 owed</p>', savedAt: Date.now() }),
  });
  assert.equal(readLastSeen(tampered, { userId: ANA, eventId: EVENT, page: 'home', url: HOME }), null);

  // The money parts of the five pages carry the marker the snapshot drops.
  const marked: [string, RegExp][] = [
    ['app/dashboard/[eventId]/_components/home-first-screen.tsx', /data-home-money\s*\n[^>]*data-money=""/],
    ['app/dashboard/[eventId]/_components/event-dashboard.tsx', /key="budget"[\s\S]{0,200}?data-money=""/],
    ['app/dashboard/[eventId]/_components/event-dashboard.tsx', /data-money=\{group\.id === 'pay'/],
    ['app/dashboard/[eventId]/details/page.tsx', /data-money=\{k === 'budget' \|\| k === 'purchases'/],
    ['app/dashboard/[eventId]/vendors/_components/services-takeover.tsx', /data-money=\{tab === 'budget' \|\| tab === 'compare'/],
    ['app/dashboard/[eventId]/schedule/_components/preparation-agenda.tsx', /data-money=\{displaySourceFor\(item\) === 'payment'/],
  ];
  for (const [file, re] of marked) assert.match(read(file), re, `${file} marks its money part`);
  assert.match(read('lib/last-seen/snapshot-dom.ts'), /'\[data-money\]'/, 'and the snapshot drops what is marked');

  // Only the five pages keep anything — never budget, payments, orders or checkout.
  const allowed = new Set([
    'app/dashboard/[eventId]/page.tsx',
    'app/dashboard/[eventId]/guests/page.tsx',
    'app/dashboard/[eventId]/vendors/page.tsx',
    'app/dashboard/[eventId]/schedule/page.tsx',
    'app/dashboard/[eventId]/details/page.tsx',
  ]);
  const users: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && /<LastSeenCapture\b/.test(readFileSync(p, 'utf8'))) {
        users.push(relative(WEB, p));
      }
    }
  };
  walk(join(WEB, 'app'));
  assert.deepEqual(users.filter((u) => !u.startsWith('app/_components/last-seen/')).sort(), [...allowed].sort());
  // Suppliers keeps the team view only: the Budget part returns before the capture.
  const vendors = read('app/dashboard/[eventId]/vendors/page.tsx');
  assert.ok(
    vendors.indexOf('if (sp.part === YOUR_TEAM_BUDGET_PART)') < vendors.indexOf('<LastSeenCapture'),
    'the budget part is never inside the capture',
  );
});

// ── 3. Sign-out empties the store ───────────────────────────────────────────
// Sabotage run: `wipeLastSeen` returning before removing → the first assertion
// fails; dropping `<LastSeenSignedOutWipe />` from app/page.tsx → the mount
// assertion fails.
test('3 · signing out empties the whole store, and nothing else', () => {
  const storage = memoryStorage({ 'sn-theme': 'dark', 'monogram-draft': 'M&J' });
  saveLastSeen(storage, { userId: ANA, eventId: EVENT, page: 'guests', url: GUESTS, html: ROSTER });
  saveLastSeen(storage, { userId: ANA, eventId: EVENT, page: 'home', url: HOME, html: '<p>Home</p>' });
  assert.ok(storage.length > 2);

  // Still signed in → kept.
  const signedIn = 'sb-abcd-auth-token.0=base64-eyJ; other=1';
  assert.equal(hasAuthCookie(signedIn), true);
  assert.equal(wipeLastSeenIfSignedOut(signedIn, storage), 0);
  // Signed out → every last-seen key goes; the rest of the browser's storage stays.
  assert.ok(wipeLastSeenIfSignedOut('other=1', storage) >= 3);
  assert.deepEqual(storage.dump(), { 'sn-theme': 'dark', 'monogram-draft': 'M&J' });

  // The inline script the signed-out landing pages run does exactly the same.
  const run = (cookie: string, s: LastSeenStorage) =>
    new Function('document', 'localStorage', LAST_SEEN_WIPE_SCRIPT)({ cookie }, s);
  const again = memoryStorage({ 'sn-theme': 'dark' });
  saveLastSeen(again, { userId: ANA, eventId: EVENT, page: 'guests', url: GUESTS, html: ROSTER });
  run(signedIn, again);
  assert.ok(again.length > 1, 'a signed-in page load keeps it');
  run('', again);
  assert.deepEqual(again.dump(), { 'sn-theme': 'dark' }, 'a signed-out page load empties it');

  // …and it runs where sign-out lands.
  assert.match(read('app/auth/sign-out/route.ts'), /NextResponse\.redirect\(new URL\('\/', request\.url\)/);
  assert.match(read('app/page.tsx'), /<LastSeenSignedOutWipe \/>/);
  assert.match(read('app/login/page.tsx'), /<LastSeenSignedOutWipe \/>/);
});

// ── 4. One account at a time ────────────────────────────────────────────────
// Sabotage run: `readLastSeen` skipping the owner check → Ben reads Ana's
// roster and the first assertion fails.
test('4 · a different account on the same phone never sees the previous one’s pages', () => {
  const storage = memoryStorage();
  saveLastSeen(storage, { userId: ANA, eventId: EVENT, page: 'guests', url: GUESTS, html: ROSTER });

  // Ben co-hosts the SAME event and opens the SAME page on Ana's phone.
  assert.equal(readLastSeen(storage, { userId: BEN, eventId: EVENT, page: 'guests', url: GUESTS }), null);
  assert.equal(storage.length, 0, "and Ana's pages are gone from the phone, not merely hidden");

  saveLastSeen(storage, { userId: BEN, eventId: EVENT, page: 'guests', url: GUESTS, html: '<p>Ben’s view</p>' });
  assert.equal(readLastSeen(storage, { userId: ANA, eventId: EVENT, page: 'guests', url: GUESTS }), null);

  // A save by a new account clears the old one's first, too.
  const s2 = memoryStorage();
  saveLastSeen(s2, { userId: ANA, eventId: EVENT, page: 'home', url: HOME, html: '<p>Ana home</p>' });
  saveLastSeen(s2, { userId: BEN, eventId: 'event-9', page: 'home', url: '/dashboard/event-9', html: '<p>Ben home</p>' });
  assert.doesNotMatch(Object.values(s2.dump()).join(''), /Ana home/);

  // The scope that names the account comes from the server-rendered layout.
  assert.match(read('app/dashboard/[eventId]/layout.tsx'), /<LastSeenScope userId=\{user\.id\} eventId=\{eventId\}>/);
});

// ── 5. A failed refresh says so ─────────────────────────────────────────────
// Sabotage run: `refreshPhase` always 'updating' → the phase assertions fail;
// the 'failed' mark reading "Updating…" → the render assertion fails.
test('5 · a refresh that does not come says so — old data is never passed off as current', () => {
  assert.equal(refreshPhase({ online: true, waitedMs: 0 }), 'updating');
  assert.equal(refreshPhase({ online: false, waitedMs: 0 }), 'failed', 'offline: the refresh cannot come');
  assert.equal(refreshPhase({ online: true, waitedMs: REFRESH_TIMEOUT_MS }), 'failed', 'too long: it did not come');

  const failed = renderToStaticMarkup(
    React.createElement(LastSeenView, { html: ROSTER, savedAt: Date.UTC(2026, 9, 1, 7, 42), phase: 'failed' }),
  );
  assert.match(failed, /Couldn(’|&#x27;|')t refresh|Couldn&rsquo;t refresh/);
  assert.match(failed, /may be out of date/);
  assert.match(failed, /Try again/);
  assert.doesNotMatch(failed, /Updating…/);

  // A failed READ is never kept as last-seen: each page passes its honest-read flag.
  assert.match(read('app/dashboard/[eventId]/guests/page.tsx'), /<LastSeenCapture page="guests" fresh=\{guestsMeasured\}>/);
  assert.match(read('app/dashboard/[eventId]/page.tsx'), /<LastSeenCapture page="home" fresh=\{guestsMeasured\}>/);
  assert.match(read('app/dashboard/[eventId]/details/page.tsx'), /<LastSeenCapture page="details" fresh=\{lastSeenFresh\}>/);
});

/**
 * THE GUEST RE-ENTRY CODE WORKS ONCE, EXPIRES, AND IS HASHED AT REST
 * (owner 2026-10-04, guest-flow I9 + the in-app "Open in Safari" hop of I4).
 *
 * Driven through the REAL logic (lib/guest-reentry.ts) against an in-memory
 * table that applies the same filters PostgREST would — so "once" is the
 * conditional UPDATE's own filters (unused AND unexpired AND this event), not a
 * read-then-write the test could not see race. The schema half (RLS, no browser
 * grant, the hash CHECK) is pinned against the replayed migrations in
 * tests/db/a-guest-re-entry-code-is-single-use.db.test.ts.
 *
 *   1 · minted: the raw code is in no stored column — only its sha256;
 *       it is not the pass token and does not contain it;
 *   2 · spent ONCE: the second exchange is refused as `used`;
 *   3 · expires: past its window it is refused as `expired`, per purpose;
 *   4 · guest-scoped: another event's code, a removed guest, a malformed code
 *       and no database are each refused — never a throw;
 *   5 · the routes spend it only where it belongs, and write the guest's NORMAL
 *       pass — never an account session.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { REENTRY_TTL_SECONDS, reentryRedeemPath } from './guest-pass-hop';
import { buildEventManifest, eventShortcutMetadata } from './event-app-icon';
import {
  exchangeReentryCode,
  hashReentryCode,
  mintReentryCode,
  reentryCodeGuest,
  type ReentryDb,
} from './guest-reentry';

type Row = Record<string, unknown>;

/** A table that answers the exact call chains lib/guest-reentry.ts makes. */
function fakeDb(tables: Record<string, Row[]>) {
  const from = (name: string) => {
    const rows = (tables[name] ??= []);
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | 'update' | 'delete' = 'select';
    let patch: Row = {};
    const q = {
      select: () => q,
      update: (p: Row) => ((op = 'update'), (patch = p), q),
      delete: () => ((op = 'delete'), q),
      insert: async (row: Row) => {
        if (rows.some((r) => r.code_hash === row.code_hash)) return { error: { message: 'duplicate key' } };
        rows.push({ used_at: null, ...row });
        return { error: null };
      },
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), q),
      lt: (c: string, v: string) => (filters.push((r) => String(r[c]) < v), q),
      gt: (c: string, v: string) => (filters.push((r) => String(r[c]) > v), q),
      maybeSingle: async () => {
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        if (op === 'update') hit.forEach((r) => Object.assign(r, patch));
        return { data: hit[0] ?? null, error: null };
      },
      then: (resolve: (v: unknown) => void) => {
        if (op === 'delete') {
          for (let i = rows.length - 1; i >= 0; i -= 1) if (filters.every((f) => f(rows[i]!))) rows.splice(i, 1);
        }
        resolve({ error: null });
      },
    };
    return q;
  };
  return { from } as unknown as ReentryDb;
}

const EVENT = 'ev-maria-and-jose';
const GUEST = 'g-efren';
const QR = 'e2e3-not-a-real-token-0000aaaa';
const T0 = new Date('2026-10-04T10:00:00Z');
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);

function world() {
  const tables: { guests: Row[]; guest_reentry_codes: Row[] } & Record<string, Row[]> = {
    guests: [{ guest_id: GUEST, event_id: EVENT, qr_token: QR, deleted_at: null }],
    guest_reentry_codes: [],
  };
  return { tables, db: fakeDb(tables) };
}

test('1 · minted: only the sha256 is stored — the raw code, and the pass token, appear nowhere', async () => {
  const { tables, db } = world();
  const code = await mintReentryCode({ eventId: EVENT, guestId: GUEST, purpose: 'tile', now: T0 }, db);
  assert.ok(code && /^[A-Za-z0-9_-]{43}$/.test(code), 'a 32-byte base64url code');
  const stored = JSON.stringify(tables.guest_reentry_codes);
  assert.ok(!stored.includes(code!), 'the raw code is stored');
  assert.ok(!code!.includes(QR) && !stored.includes(QR), 'the code carries the pass token');
  const [row] = tables.guest_reentry_codes;
  assert.equal(row!.code_hash, createHash('sha256').update(`setnayan-guest-reentry:${code}`).digest('hex'));
  assert.equal(row!.code_hash, hashReentryCode(code!));
  assert.equal(row!.purpose, 'tile');
  assert.equal(row!.expires_at, at(REENTRY_TTL_SECONDS.tile).toISOString());
  const other = await mintReentryCode({ eventId: EVENT, guestId: GUEST, purpose: 'tile', now: T0 }, db);
  assert.notEqual(other, code, 'two mints gave the same code');
});

test('2 · spent ONCE: the first exchange returns the guest; the second is refused as used', async () => {
  const { db } = world();
  const code = await mintReentryCode({ eventId: EVENT, guestId: GUEST, purpose: 'landing', now: T0 }, db);
  const first = await exchangeReentryCode({ code, eventId: EVENT, now: at(60) }, db);
  assert.deepEqual(first, { ok: true, guestId: GUEST, eventId: EVENT, qrToken: QR, purpose: 'landing' });
  const second = await exchangeReentryCode({ code, eventId: EVENT, now: at(61) }, db);
  assert.deepEqual(second, { ok: false, reason: 'used', guestId: GUEST });
  // Whose it was is still known (the tile's later launches), spending nothing.
  assert.equal(await reentryCodeGuest({ code, eventId: EVENT }, db), GUEST);
});

test('3 · expires: a landing code lives minutes, a tile code a day — then it is refused', async () => {
  for (const purpose of ['landing', 'tile'] as const) {
    const { db } = world();
    const ttl = REENTRY_TTL_SECONDS[purpose];
    const live = await mintReentryCode({ eventId: EVENT, guestId: GUEST, purpose, now: T0 }, db);
    assert.equal((await exchangeReentryCode({ code: live, eventId: EVENT, now: at(ttl - 1) }, db)).ok, true, `${purpose} died early`);
    const late = await mintReentryCode({ eventId: EVENT, guestId: GUEST, purpose, now: T0 }, db);
    assert.deepEqual(
      await exchangeReentryCode({ code: late, eventId: EVENT, now: at(ttl + 1) }, db),
      { ok: false, reason: 'expired', guestId: GUEST },
      `${purpose} outlived its window`,
    );
  }
  assert.ok(REENTRY_TTL_SECONDS.landing <= 60 * 60, 'the landing code is not short-lived');
  assert.ok(REENTRY_TTL_SECONDS.tile <= 24 * 60 * 60, 'the tile code is not short-lived');
});

test('4 · guest-scoped and never a throw: another event, a removed guest, a malformed code, no database', async () => {
  const { tables, db } = world();
  const code = await mintReentryCode({ eventId: EVENT, guestId: GUEST, purpose: 'tile', now: T0 }, db);
  assert.deepEqual(await exchangeReentryCode({ code, eventId: 'ev-other', now: at(5) }, db), { ok: false, reason: 'wrong-event' });
  assert.deepEqual(await exchangeReentryCode({ code: 'x'.repeat(43), eventId: EVENT, now: at(5) }, db), { ok: false, reason: 'unknown' });
  assert.deepEqual(await exchangeReentryCode({ code: 'a/b?c', eventId: EVENT }, db), { ok: false, reason: 'malformed' });
  assert.deepEqual(await exchangeReentryCode({ code, eventId: EVENT }, null), { ok: false, reason: 'unreachable' });
  assert.equal(await mintReentryCode({ eventId: EVENT, guestId: GUEST, purpose: 'tile' }, null), null);
  tables.guests[0]!.deleted_at = '2026-10-04T10:00:01Z';
  assert.deepEqual(await exchangeReentryCode({ code, eventId: EVENT, now: at(5) }, db), { ok: false, reason: 'guest-gone' });
});

test('5 · a mint clears the guest\'s dead codes, so the table holds only what can still be used', async () => {
  const { tables, db } = world();
  await mintReentryCode({ eventId: EVENT, guestId: GUEST, purpose: 'landing', now: T0 }, db);
  await mintReentryCode({ eventId: EVENT, guestId: GUEST, purpose: 'landing', now: at(REENTRY_TTL_SECONDS.landing + 5) }, db);
  assert.equal(tables.guest_reentry_codes.length, 1, 'an expired code was kept');
});

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('6 · the redeem spends a code only when this phone holds no pass for that guest, and writes the NORMAL pass', () => {
  const route = read('app/[slug]/redeem/route.ts');
  const branch = route.slice(route.indexOf('if (!token && reentryCode) {'));
  assert.ok(branch.length > 0 && route.includes('if (!token && reentryCode) {'), 'the redeem lost its code branch');
  const end = branch.indexOf('// Read WITH removed rows') > -1 ? branch.indexOf('// Read WITH removed rows') : branch.indexOf('const { data: keyRow }');
  const body = branch.slice(0, end);
  const heldAt = body.indexOf('readGuestSession()');
  const spendAt = body.indexOf('exchangeReentryCode(');
  assert.ok(heldAt > -1 && spendAt > heldAt, 'the code is spent before asking what the phone holds');
  assert.match(body, /owner === null \|\| owner === held\.guest_id/, 'another guest\'s pass on this phone blocks the code');
  assert.match(body, /await setGuestSession\(\{ guest_id: spent\.guestId, event_id: spent\.eventId, qr_token: spent\.qrToken \}\)/);
  assert.doesNotMatch(body, /signIn|auth\.admin|createSession|setSession/, 'a re-entry code opened an account session');
});

test('7 · the tile: the thank-you names a manifest whose start spends the code once, inside the couple\'s scope', () => {
  const meta = eventShortcutMetadata('maria-and-jose', 'Maria & Jose', { reentryCode: 'k'.repeat(43) });
  assert.equal(meta.manifest, `/maria-and-jose/manifest.webmanifest?k=${'k'.repeat(43)}`);
  assert.equal(eventShortcutMetadata('maria-and-jose', 'Maria & Jose').manifest, '/maria-and-jose/manifest.webmanifest', 'a plain page carries a code');
  const start = reentryRedeemPath('maria-and-jose', 'k'.repeat(43), 'hub');
  const m = buildEventManifest({ slug: 'maria-and-jose', displayName: 'Maria & Jose', startUrl: start });
  assert.equal(m.start_url, start);
  assert.equal(m.scope, '/maria-and-jose', 'the tile leaves the couple\'s scope');
  assert.equal(m.id, '/maria-and-jose', 'a code changed the tile\'s identity');
  assert.equal(buildEventManifest({ slug: 'maria-and-jose', displayName: 'M', startUrl: '/other-event/redeem?k=x' }).start_url, '/maria-and-jose');
  const route = read('app/[slug]/manifest.webmanifest/route.ts');
  assert.match(route, /isUrlSecretShaped\(code\) \? reentryRedeemPath\(source\.slug, code, 'hub'\) : null/, 'the manifest route does not start the tile at the exchange');
  assert.match(route, /buildEventManifest\(\{[^}]*\bstartUrl,\s*\}\)/, 'the manifest is built without the tile\'s start');
  const enter = read('app/[slug]/invite/enter/page.tsx');
  const mint = enter.slice(enter.indexOf('async function tileReentryCodeFor('));
  assert.ok(
    mint.indexOf("!== 'yes') return null;") > -1 && mint.indexOf("!== 'yes') return null;") < mint.indexOf("purpose: 'tile'"),
    'a tile code is minted for a guest who has not said Yes (the shortcut line is offered only after a Yes)',
  );
});

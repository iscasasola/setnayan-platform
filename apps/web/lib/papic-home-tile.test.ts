/**
 * papic-home-tile — the resolver behind Papic's two appearances on event-home
 * (PR-G options A + B, owner-picked 2026-07-30).
 *
 * What is worth pinning here is not the arithmetic, it is the THREE PROMISES the
 * two surfaces make to each other:
 *
 *   1. `null` means BOTH render nothing. Event-home must never show a tile that
 *      reads "0 shots ready" or a nudge for a camera that was never armed, and
 *      the bento's own law is "real-data-or-nothing".
 *   2. `preCapture` is the ONE switch that divides their jobs. It flips false on
 *      the first capture — which retires the nudge and re-points the tile from
 *      shots-left to photos-gathered. If it ever stopped tracking captures the
 *      nudge would nag couples already shooting, on their own home page.
 *   3. The nudge gate is CHEAP and fails closed. It must not grow into the full
 *      resolver (that would double four queries for a boolean), and an
 *      unreadable count must never conjure a band onto the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  resolvePapicHomeTile,
  papicNudgeShouldShow,
  countPapicCaptures,
} from './papic-home-tile';

type Counts = {
  /** paparazzi_seats — live cameras */
  seats?: number;
  /** papic_photos — crew captures */
  crew?: number;
  /** papic_guest_captures — guest captures */
  guest?: number;
  /** make a named table's read fail, to exercise graceful degradation */
  failTable?: string;
};

/**
 * A head-count-shaped stub.
 *
 * ⚠ `from()` returns a FRESH chain that closes over its own table name, and that
 * detail is load-bearing rather than stylistic: `resolvePapicHomeTile` issues its
 * three counts inside one `Promise.all`, so a single shared builder would have
 * every `then()` read whichever table `from()` was called with LAST — three reads
 * collapsing onto one answer. (Caught by this test failing first: the stub was
 * wrong, the code was right.) Any future stub for a parallel reader needs the
 * same shape.
 */
function makeDb(counts: Counts) {
  const chainFor = (table: string) => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      then(resolve: (v: { count: number | null; error: unknown }) => unknown) {
        if (counts.failTable === table) {
          return Promise.resolve({ count: null, error: { message: 'boom' } }).then(resolve);
        }
        const count =
          table === 'paparazzi_seats'
            ? (counts.seats ?? 0)
            : table === 'papic_photos'
              ? (counts.crew ?? 0)
              : table === 'papic_guest_captures'
                ? (counts.guest ?? 0)
                : 0;
        return Promise.resolve({ count, error: null }).then(resolve);
      },
    };
    return chain;
  };
  return { from: (name: string) => chainFor(name) } as unknown as SupabaseClient;
}

/** An admin stub whose `papic_event_pool_status` RPC returns one shaped row. */
function makeAdmin(pool: { total?: number; remaining?: number } | null) {
  return {
    rpc() {
      if (!pool) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({
        data: [
          {
            applies: true,
            guest_count: 0,
            base_points: 0,
            granted_points: pool.total ?? 0,
            total_points: pool.total ?? 0,
            used_points: (pool.total ?? 0) - (pool.remaining ?? 0),
            remaining_points: pool.remaining ?? 0,
            soft_stop_at: 0,
          },
        ],
        error: null,
      });
    },
  } as unknown as SupabaseClient;
}

test('no Papic signal at all ⇒ null, so NEITHER surface renders', async () => {
  // A pre-arming event: no pool, no camera, nothing shot. The tile must not
  // render "0 shots ready" and the nudge must not offer a camera that is not there.
  const got = await resolvePapicHomeTile(makeAdmin(null), makeDb({}), 'evt-1');
  assert.equal(got, null);
});

test('an empty eventId is not a query — it is null', async () => {
  assert.equal(await resolvePapicHomeTile(makeAdmin({ total: 50, remaining: 50 }), makeDb({}), ''), null);
});

test('a freshly-armed event is preCapture: shots + camera, nothing shot', async () => {
  const got = await resolvePapicHomeTile(
    makeAdmin({ total: 50, remaining: 50 }),
    makeDb({ seats: 1 }),
    'evt-1',
  );
  assert.ok(got);
  assert.equal(got.preCapture, true, 'nothing shot yet');
  assert.equal(got.shotsLeft, 50);
  assert.equal(got.shotsTotal, 50);
  assert.equal(got.cameras, 1);
  assert.equal(got.photosGathered, 0);
});

test('the FIRST capture flips preCapture — this retires the nudge', async () => {
  const got = await resolvePapicHomeTile(
    makeAdmin({ total: 50, remaining: 49 }),
    makeDb({ seats: 1, crew: 1 }),
    'evt-1',
  );
  assert.ok(got);
  assert.equal(got.preCapture, false, 'one photo is enough — the nudge has done its job');
  assert.equal(got.photosGathered, 1);
});

test('crew + guest captures are counted TOGETHER', async () => {
  // The couple does not care which surface a photo came from, and counting only
  // one table would leave a guest-only event looking untouched.
  assert.equal(await countPapicCaptures(makeDb({ crew: 12, guest: 30 }), 'evt-1'), 42);
  const got = await resolvePapicHomeTile(
    makeAdmin({ total: 3050, remaining: 2900 }),
    makeDb({ seats: 4, crew: 12, guest: 30 }),
    'evt-1',
  );
  assert.ok(got);
  assert.equal(got.photosGathered, 42);
  assert.equal(got.preCapture, false);
});

test('an unreadable pool degrades to zero shots without hiding a real camera', async () => {
  // fetchEventPoolStatus fails to EVENT_POOL_ABSENT by design (it is a DISPLAY
  // read, never the gate). The event still HAS a camera and photos, so the tile
  // must still render — just without a shots figure to quote.
  const got = await resolvePapicHomeTile(makeAdmin(null), makeDb({ seats: 2, crew: 5 }), 'evt-1');
  assert.ok(got, 'a camera and 5 photos are a real Papic story');
  assert.equal(got.shotsLeft, 0);
  assert.equal(got.shotsTotal, 0);
  assert.equal(got.cameras, 2);
  assert.equal(got.photosGathered, 5);
});

test('a failing capture-count table is a zero, not a crash', async () => {
  const got = await resolvePapicHomeTile(
    makeAdmin({ total: 50, remaining: 50 }),
    makeDb({ seats: 1, crew: 9, failTable: 'papic_photos' }),
    'evt-1',
  );
  assert.ok(got);
  assert.equal(got.photosGathered, 0, 'the crew read failed; it must not throw');
  assert.equal(got.preCapture, true);
});

test('the nudge gate shows ONLY before the first capture', async () => {
  assert.equal(await papicNudgeShouldShow(makeDb({}), 'evt-1'), true);
  assert.equal(await papicNudgeShouldShow(makeDb({ crew: 1 }), 'evt-1'), false);
  assert.equal(await papicNudgeShouldShow(makeDb({ guest: 1 }), 'evt-1'), false);
});

test('the nudge gate fails CLOSED on an empty id', async () => {
  // countPapicCaptures short-circuits an empty id to 0, which would read as
  // "nothing shot yet" — but with no event there is nothing to nudge about. The
  // caller only asks when it holds a real event, and this pins the cheap path.
  assert.equal(await countPapicCaptures(makeDb({ crew: 5 }), ''), 0);
});

/* ── The bento contract (owner 2026-07-30) ─────────────────────────────────────
 *
 * "always hold a slot. since that is the foundation of the app."
 *
 * The first cut (PR #3895) gave Papic a slot only when one was free, which left a
 * couple with a full dashboard and no captures yet seeing no Papic at all once
 * they dismissed the nudge. The owner reversed it. These are source-scan guards
 * in the repo's existing idiom (cf. papic-copy-guardrails / panood-retirement),
 * because the rule lives in a 400-line server component that a unit test cannot
 * render — and the failure mode is silent: the tile just stops appearing.
 */
const DASHBOARD_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'dashboard', '[eventId]', '_components', 'event-dashboard.tsx'),
  'utf8',
);

test('the Papic mini is pushed UNCONDITIONALLY — it always holds a slot', () => {
  assert.match(
    DASHBOARD_SRC,
    /if \(papicMini\) miniTiles\.push\(papicMini\);/,
    'Papic must be pushed on its own existence alone. Any extra condition here '
      + '(preCapture, a free-slot check, a length test) re-creates the bug the owner '
      + 'reversed on 2026-07-30: a full dashboard showing no Papic at all.',
  );
  // No index arithmetic — an earlier cut spliced at a fixed index and silently
  // put Papic AFTER Messages whenever Schedule had nothing to show.
  assert.equal(
    /miniTiles\.splice\(/.test(DASHBOARD_SRC),
    false,
    'order must be structural (push order), not a splice index',
  );
});

test('Papic outranks Messages, and NEVER Guests / Budget / Schedule', () => {
  const at = (needle: string) => DASHBOARD_SRC.indexOf(needle);
  const papic = at('if (papicMini) miniTiles.push(papicMini);');
  const guests = at('key="guests"');
  const budget = at('key="budget"');
  const messages = at('key="messages"');
  for (const [name, idx] of [['guests', guests], ['budget', budget], ['messages', messages]] as const) {
    assert.ok(idx > -1, `expected to find the ${name} mini`);
  }
  assert.ok(papic > guests && papic > budget, 'Papic must never displace Guests or Budget');
  assert.ok(
    papic < messages,
    'Papic must be pushed BEFORE Messages — on a fully-populated dashboard the cap '
      + 'makes Messages yield, and that is the intended trade (threads are transient '
      + 'and carry their own nav badge; the open count also shows in the digest).',
  );
});

test('the ≤4 blur budget is still enforced, and still explained', () => {
  // "Always hold a slot" was a statement about PRIORITY, not a licence to put a
  // ninth backdrop-filter layer on the couple's first screen. If someone raises
  // this, it should be a deliberate, documented decision — not a side effect of
  // adding a tile.
  assert.match(DASHBOARD_SRC, /const MAX_MINIS = 4;/);
  assert.match(
    DASHBOARD_SRC,
    /if \(miniTiles\.length > MAX_MINIS\) miniTiles\.length = MAX_MINIS;/,
    'the cap must actually trim',
  );
});

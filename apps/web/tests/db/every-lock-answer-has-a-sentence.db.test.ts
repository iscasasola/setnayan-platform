/**
 * EVERY WAY THE DATABASE CAN REFUSE A BOOKING ANSWER HAS A SENTENCE.
 *
 * 🔴 THE DEFECT. `vendorAgreeToLock` / `vendorDeclineLock` end with
 * `redirect('/vendor-dashboard?lock_agree=<status>')`, and a grep of the whole
 * app for `lock_agree` returned exactly ONE hit — that redirect. NOTHING read
 * it. So a supplier who pressed Agree and was refused saw the same page, the
 * same request card, and no message at all. Success is self-evident (the card
 * disappears); every refusal was indistinguishable from a dead button.
 *
 * 🔑 WHY THIS IS A DB TEST AND NOT A LIST IN TYPESCRIPT. The authority on which
 * statuses exist is the FUNCTION BODY, and it has been replaced repeatedly (the
 * survey that found this defect named eight refusals; the live body has nine).
 * A hand-kept list drifts the moment somebody adds a rung in SQL — and it
 * drifts SILENTLY, because an unlisted status just falls through to "nothing to
 * see here". So the list is EXTRACTED from the replayed body and compared with
 * `lib/lock-answer-notice.ts`. Add a status in SQL and this fails.
 *
 * ⚠ The replay applies every migration in filename order, so these bodies are
 * the same objects production holds — verified against prod by
 * `pg_get_functiondef` when this was written.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import {
  LOCK_AGREE_STATUSES,
  LOCK_DECLINE_STATUSES,
  lockAgreeNotice,
  lockDeclineNotice,
} from '../../lib/lock-answer-notice';

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function functionBody(name: string): Promise<string> {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1`,
    [name],
  );
  assert.equal(r.rows.length, 1, `${name} is not a single function in the replayed schema`);
  return r.rows[0]!.def;
}

/**
 * Every `'status', '<literal>'` this function can answer with. It matches the
 * `jsonb_build_object('status', 'x'` shape the RPCs use throughout — the ONLY
 * way either function reports an outcome.
 */
function statusesIn(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/'status',\s*'([a-z_]+)'/g)) out.add(m[1]!);
  return [...out].sort();
}

test('the AGREE RPC cannot answer with anything the supplier is not told about', async () => {
  const body = await functionBody('vendor_agree_to_lock');
  const fromSql = statusesIn(body);
  // Anti-vacuity: a regex that stops matching would pass this file for free.
  assert.ok(
    fromSql.length >= 9,
    `only ${fromSql.length} statuses extracted from vendor_agree_to_lock — the scan broke`,
  );
  const unspoken = fromSql.filter((s) => !LOCK_AGREE_STATUSES.includes(s));
  assert.deepEqual(
    unspoken,
    [],
    `vendor_agree_to_lock can answer with ${unspoken.join(', ')} and lib/lock-answer-notice.ts has no sentence for it — the supplier would press Agree, be refused, and be told nothing`,
  );
  // And each of them must actually produce words.
  for (const s of fromSql) {
    const n = lockAgreeNotice(s);
    assert.ok(n && n.text.trim().length > 20, `${s} produces no usable sentence`);
  }
});

test('the DECLINE RPC cannot answer with anything the supplier is not told about', async () => {
  const body = await functionBody('vendor_decline_lock');
  const fromSql = statusesIn(body);
  assert.ok(
    fromSql.length >= 5,
    `only ${fromSql.length} statuses extracted from vendor_decline_lock — the scan broke`,
  );
  const unspoken = fromSql.filter((s) => !LOCK_DECLINE_STATUSES.includes(s));
  assert.deepEqual(unspoken, [], `vendor_decline_lock answers ${unspoken.join(', ')} in silence`);
  for (const s of fromSql) {
    const n = lockDeclineNotice(s);
    assert.ok(n && n.text.trim().length > 20, `${s} produces no usable sentence`);
  }
});

test('the refusals the supplier can actually act on are worded for them', async () => {
  const fromSql = statusesIn(await functionBody('vendor_agree_to_lock'));
  // Three the shop owner can DO something about — pinned by name because
  // wording them as a shrug is the failure mode a completeness check misses.
  for (const s of ['not_verified', 'resolve_others_first', 'fully_booked']) {
    assert.ok(fromSql.includes(s), `${s} is gone from the RPC — re-read this test`);
    assert.equal(lockAgreeNotice(s)!.tone, 'refused');
  }
  assert.match(lockAgreeNotice('not_verified')!.text, /approved your shop/i);
});

/**
 * THE UNREDACTED TWIN, AND THE VOID THAT ONLY REACHED HALF THE PAGE.
 *
 * Two facts about the vendor shop page, both fixed in migration 20271132024116.
 *
 * ── 1 · `vendor_full_completed_events_stats` WAS GRANTED TO anon ────────────
 * It exists as the deliberately-UNREDACTED twin of
 * `vendor_public_completed_events_stats`. The public one filters out team,
 * internal, self-comp and fraud-voided bookings; the full one filters nothing.
 * lib/vendor-profile.ts says so in its own docblock:
 *
 *     "`full_completed_count` is the unfiltered sibling. Only the vendor's
 *      own backend card reads this when their toggle is ON."
 *
 * Both were readable by `anon`. A signed-out stranger could fetch the two
 * numbers and subtract — publishing Setnayan's own integrity findings about
 * that vendor (how many of their bookings we had judged self-dealt or
 * fraudulent). A matview cannot carry RLS, so THE GRANT IS THE WHOLE CONTROL.
 *
 * ── 2 · A FRAUD VOID DID NOT REACH THE DATED LIST ───────────────────────────
 * executeFraudWipeBan() in app/admin/fraud/actions.ts states the invariant:
 *
 *     "Soft-delete via voided_by_fraud so the evidence trail survives"
 *     "(the vetted views already exclude voided rows)"
 *
 * `vendor_public_completed_events_stats` honoured it. `vendor_completed_events`
 * — the dated list rendered on the SAME page, right beside that count — did
 * not. So the count said N and the list beneath it showed N+1 entries.
 *
 * ── THE SHAPE TO REMEMBER ───────────────────────────────────────────────────
 * When a redacted object and an unredacted object are built from the same rows,
 * they are two decisions, not one. The redaction lives in whichever one you
 * edited last. These tests assert the PAIR agrees, because agreeing is the
 * actual product requirement — a count and the list under it must not disagree.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const FULL = 'public.vendor_full_completed_events_stats';
const PUBLIC_COUNT = 'public.vendor_public_completed_events_stats';
const LIST = 'public.vendor_completed_events';

async function hasSelect(role: string, rel: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(`SELECT has_table_privilege($1, $2, 'SELECT') AS ok`, [
    role,
    rel,
  ]);
  return r.rows[0]!.ok;
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
}

/** A verified, UNCLAIMED vendor (user_id NULL) — no self-dealing exclusion can fire. */
async function newVendor(name: string): Promise<string> {
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES (NULL, $1, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [name],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newDeliveredBooking(vendorProfileId: string, label: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [label],
  );
  const eventId = e.rows[0]!.event_id;
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, linked_vendor_profile_id)
     VALUES ($1, 'photographer', $2, 'delivered', $3)
     RETURNING vendor_id`,
    [eventId, label, vendorProfileId],
  );
  return r.rows[0]!.vendor_id;
}

async function refreshCounts(): Promise<void> {
  await db.exec(`REFRESH MATERIALIZED VIEW ${PUBLIC_COUNT}`);
  await db.exec(`REFRESH MATERIALIZED VIEW ${FULL}`);
}

async function listRows(vendorProfileId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${LIST} WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return r.rows[0]!.n;
}

async function publicCount(vendorProfileId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT COALESCE(public_completed_count, 0)::int AS n FROM ${PUBLIC_COUNT} WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return r.rows[0]?.n ?? 0;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: all three objects exist and are the kinds this test assumes', async () => {
  // Without this, every "cannot read it" below would also pass for an object
  // that had been renamed, dropped, or never replayed.
  const r = await db.query<{ relname: string; relkind: string }>(
    `SELECT c.relname, c.relkind::text AS relkind
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relname IN ('vendor_full_completed_events_stats',
                          'vendor_public_completed_events_stats',
                          'vendor_completed_events')`,
  );
  const kinds = new Map(r.rows.map((x) => [x.relname, x.relkind]));
  assert.equal(kinds.get('vendor_full_completed_events_stats'), 'm', 'full stats is not a matview');
  assert.equal(kinds.get('vendor_public_completed_events_stats'), 'm', 'public stats is not a matview');
  assert.equal(kinds.get('vendor_completed_events'), 'v', 'the dated list is not a view');
});

test('META: event_vendors still carries voided_by_fraud — the flag the fix depends on', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema='public' AND table_name='event_vendors' AND column_name='voided_by_fraud'`,
  );
  assert.equal(
    r.rows[0]!.n,
    1,
    'voided_by_fraud is gone from event_vendors. The fraud wipe soft-deletes through this flag; ' +
      'if it was renamed, re-point both vetted views rather than deleting this test.',
  );
});

test('META: service_role keeps SELECT on the full stats — a narrowing, not a demolition', async () => {
  assert.equal(await hasSelect('service_role', FULL), true, 'service_role lost SELECT on the full stats');
});

/* ── 1 · THE GRANT CLOSURE ────────────────────────────────────────────────── */

test('anon may NOT read the unredacted completed-event count', async () => {
  assert.equal(
    await hasSelect('anon', FULL),
    false,
    `anon can read ${FULL}. It is the unfiltered twin of the public count — a matview, so it ` +
      `cannot carry RLS and the GRANT is the entire control. Subtracting the public count from ` +
      `it reveals how many of that vendor's bookings Setnayan filtered out as self-dealt or fraudulent.`,
  );
});

test('authenticated KEEPS it — the documented reader is the vendor\'s own backend card', async () => {
  assert.equal(
    await hasSelect('authenticated', FULL),
    true,
    'authenticated lost SELECT on the full stats. lib/vendor-profile.ts documents the vendor\'s own ' +
      'backend card as the reader; revoking it there breaks that card instead of protecting anything.',
  );
});

test('the PUBLIC count stays public — the shop page needs it', async () => {
  assert.equal(await hasSelect('anon', PUBLIC_COUNT), true, 'anon lost the public count');
  assert.equal(await hasSelect('anon', LIST), true, 'anon lost the public dated list');
});

test('BEHAVIOURAL: an anon session is actually refused, not merely un-granted', async () => {
  // The catalog and real behaviour have disagreed before. Become the role.
  await db.exec(`SET ROLE anon`);
  let refused = false;
  let message = '';
  try {
    await db.query(`SELECT full_completed_count FROM ${FULL}`);
  } catch (err) {
    refused = true;
    message = err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
  assert.ok(refused, 'an anon session read the unredacted count despite holding no grant');
  assert.match(message, /permission denied/i, `expected a permission failure, got: ${message}`);
});

test('NEUTRALISATION: re-granting SELECT re-opens it — the GRANT is the control', async () => {
  await db.exec(`BEGIN`);
  try {
    await db.exec(`GRANT SELECT ON ${FULL} TO anon`);
    await db.exec(`SET ROLE anon`);
    const r = await db.query(`SELECT * FROM ${FULL}`);
    assert.ok(Array.isArray(r.rows), 'the re-grant did not restore the read — closure not attributable to the ACL');
  } finally {
    await reset();
    await db.exec(`ROLLBACK`);
  }
});

test('no write privilege survives for anon or authenticated on the public vendor views', async () => {
  // These views are not auto-updatable today, so the inherited ALL-PRIVILEGES
  // grants were inert — but the day one of them becomes a simple single-table
  // view, Postgres makes it writable and those bits go live.
  const rels = [LIST, PUBLIC_COUNT, 'public.vendor_market_stats', 'public.vendor_review_stats'];
  const open: string[] = [];
  for (const rel of rels) {
    for (const role of ['anon', 'authenticated']) {
      for (const priv of ['INSERT', 'UPDATE', 'DELETE']) {
        const r = await db.query<{ ok: boolean }>(
          `SELECT has_table_privilege($1, $2, $3) AS ok`,
          [role, rel, priv],
        );
        if (r.rows[0]!.ok) open.push(`${role} ${priv} ${rel}`);
      }
    }
  }
  assert.deepEqual(open, [], `write privileges still held: ${open.join(', ')}`);
});

/* ── 2 · THE VOID MUST REACH BOTH HALVES OF THE PAGE ──────────────────────── */

test('a fraud-voided booking leaves the dated list AND the public count together', async () => {
  const vendor = await newVendor('Void Parity Studio');
  const bookingId = await newDeliveredBooking(vendor, 'Void Parity Wedding');
  await refreshCounts();

  // Anti-vacuity: it must be VISIBLE first, or "it disappeared" proves nothing.
  assert.equal(await listRows(vendor), 1, 'the delivered booking never appeared in the dated list');
  assert.equal(await publicCount(vendor), 1, 'the delivered booking never appeared in the public count');

  await db.query(`UPDATE public.event_vendors SET voided_by_fraud = true WHERE vendor_id = $1`, [
    bookingId,
  ]);
  await refreshCounts();

  const listAfter = await listRows(vendor);
  const countAfter = await publicCount(vendor);

  assert.equal(
    countAfter,
    0,
    'the public COUNT still counts a fraud-voided booking — that half was already correct, so ' +
      'something regressed in vendor_public_completed_events_stats',
  );
  assert.equal(
    listAfter,
    0,
    'the dated LIST still shows a fraud-voided booking. executeFraudWipeBan() asserts "the vetted ' +
      'views already exclude voided rows"; this is the view where that was not true.',
  );
  assert.equal(
    listAfter,
    countAfter,
    `the list (${listAfter}) and the count (${countAfter}) disagree. They are rendered side by side ` +
      `on the vendor shop page; any exclusion added to one must be added to the other.`,
  );
});

test('NEUTRALISATION: dropping the fraud filter makes the voided booking reappear', async () => {
  // Proves the previous test is carried by the WHERE clause and not by some
  // unrelated exclusion that happens to also hide the row.
  const vendor = await newVendor('Neutralisation Studio');
  const bookingId = await newDeliveredBooking(vendor, 'Neutralisation Wedding');
  await db.query(`UPDATE public.event_vendors SET voided_by_fraud = true WHERE vendor_id = $1`, [
    bookingId,
  ]);
  assert.equal(await listRows(vendor), 0, 'baseline: the voided booking should be hidden');

  await db.exec(`BEGIN`);
  try {
    // Re-create the view WITHOUT the fraud filter — the pre-fix definition.
    await db.exec(`
      CREATE OR REPLACE VIEW ${LIST} AS
      SELECT vp.vendor_profile_id, ev.vendor_id, ev.event_id, e.event_type, e.event_date,
             COALESCE(ev.updated_at, e.event_date::timestamp with time zone) AS completed_at
        FROM vendor_profiles vp
        JOIN event_vendors ev
          ON ev.linked_vendor_profile_id = vp.vendor_profile_id
         AND (ev.status = ANY (ARRAY['delivered'::vendor_status, 'complete'::vendor_status]))
        JOIN events e ON e.event_id = ev.event_id AND e.archived = false
       WHERE NOT (EXISTS (SELECT 1 FROM event_members em
                           WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type
                             AND em.user_id = vp.user_id))`);
    assert.equal(
      await listRows(vendor),
      1,
      'removing the fraud filter did NOT bring the row back — the earlier pass is not attributable ' +
        'to that clause, so this test is not guarding what it claims to guard',
    );
  } finally {
    await db.exec(`ROLLBACK`);
  }
});

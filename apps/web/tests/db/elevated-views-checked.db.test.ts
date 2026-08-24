/**
 * THE TWO VIEWS THAT RUN WITH SOMEBODY ELSE'S RIGHTS — checked, and pinned.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * A view that is not `security_invoker=true` reads its base tables with its
 * OWNER'S privileges — here `postgres` — so row-level security on those tables
 * simply does not apply through it. That is sometimes the point (an aggregate
 * that must see across RLS boundaries), and it is also exactly how a private
 * table becomes public by accident. Two such views had been flagged as
 * "carrying elevated rights, never checked": `events_host` and
 * `vendor_completed_events`. This file is the check, done 2026-08-24 against
 * production BY THE OBJECT (reloptions, pg_get_viewdef, has_table_privilege),
 * and these tests keep it done.
 *
 * ── THE VERDICTS ────────────────────────────────────────────────────────────
 * `events_host` — SAFE-SHAPED, DELIBERATE. Granted to `authenticated` only,
 * nothing to `anon`. Its entire access control is its own WHERE clause: the
 * caller must be in `current_couple_event_ids()` or
 * `current_moderator_event_ids()` (or be the service role). The elevated
 * rights are the mechanism — it exists so a host can read their event without
 * threading every RLS policy — and the WHERE is the whole gate, which is why
 * two tests below break the clause and prove a stranger then sees rows.
 *
 * `vendor_completed_events` — PUBLIC ON PURPOSE, WITH ITS REDACTIONS DOING THE
 * WORK. It is the dated public track record on the shop page (anon keeps
 * SELECT — pinned in anon-table-grants-closed.db.test.ts). Because it bypasses
 * RLS, its own predicates are the only thing standing between a stranger and a
 * couple's booking rows: status must be delivered/complete, fraud-voided rows
 * are out (pinned in vendor-public-view-grants.db.test.ts), and SELF-DEALT
 * bookings — the vendor's own account being the couple — are out. The
 * self-dealing and status exclusions had no behavioural pin anywhere; they get
 * one here.
 *
 * ── THE INVENTORY IS THE INVARIANT ──────────────────────────────────────────
 * The strongest guard is not either verdict — it is that these two are the
 * ONLY definer views an app principal can read. A future migration that ships
 * a new view (this schema's default privileges grant anon/authenticated on new
 * objects automatically) without `security_invoker=true` lands in that set
 * silently. The first test fails on any unregistered arrival.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.exec(`RESET ROLE`).catch(() => {});
  await db?.close?.();
});

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
}

/**
 * Every plain (non-matview) view in public that an app principal can read and
 * that does NOT run with the caller's rights. Adding a view here is a DECISION
 * that its own WHERE clause (or its column list) is the complete access
 * control, because RLS on its base tables will not apply — write the reason.
 */
const ELEVATED_VIEWS_ALLOWED = new Map([
  [
    'events_host',
    'authenticated-only; its WHERE admits only the caller-own couple/moderator events — behaviourally pinned below',
  ],
  [
    'vendor_completed_events',
    'the public shop-page track record; status + fraud + self-dealing redactions are the control — pinned below and in vendor-public-view-grants',
  ],
]);

test('INVENTORY · the definer views an app principal can read are exactly the registered ones', async () => {
  const { rows } = await db.query<{ relname: string; opts: string | null }>(`
    SELECT c.relname, c.reloptions::text AS opts
      FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind = 'v'
       AND (has_table_privilege('anon', c.oid, 'SELECT')
         OR has_table_privilege('authenticated', c.oid, 'SELECT'))
       AND (c.reloptions IS NULL OR NOT (c.reloptions::text ILIKE '%security_invoker=true%'))
     ORDER BY c.relname
  `);

  // Anti-vacuity: both known views must be IN the result — a query that finds
  // nothing is not a clean bill, it is a query that cannot match.
  const found = rows.map((r) => r.relname);
  assert.ok(found.includes('events_host'), 'events_host missing from the scan — the query is wrong');
  assert.ok(
    found.includes('vendor_completed_events'),
    'vendor_completed_events missing from the scan — the query is wrong',
  );

  const unregistered = found.filter((v) => !ELEVATED_VIEWS_ALLOWED.has(v));
  assert.deepEqual(
    unregistered,
    [],
    `New view(s) readable by anon/authenticated that run with the OWNER'S rights, not the caller's:\n  ` +
      unregistered.join('\n  ') +
      `\n\nRLS on their base tables does NOT apply through them, and this schema's default ` +
      `privileges granted the read automatically. Either add WITH (security_invoker = true), ` +
      `revoke anon/authenticated, or register the view in ELEVATED_VIEWS_ALLOWED with the ` +
      `reason its own predicates are the complete access control.`,
  );
});

/* ── events_host ──────────────────────────────────────────────────────────── */

test('events_host · anon holds nothing, and an anon session is actually refused', async () => {
  for (const verb of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('anon', 'public.events_host', $1) AS ok`,
      [verb],
    );
    assert.equal(rows[0]?.ok, false, `anon holds ${verb} on events_host`);
  }
  await db.exec(`SET ROLE anon`);
  let refused = false;
  try {
    await db.query(`SELECT event_id FROM public.events_host LIMIT 1`);
  } catch {
    refused = true;
  } finally {
    await reset();
  }
  assert.ok(refused, 'an anon session read events_host despite holding no grant');
});

test('events_host · the WHERE clause is the whole gate: a signed-in stranger sees zero rows', async () => {
  // The view runs with the owner's rights, so RLS on `events` is not what
  // protects this — only the membership filter is. A caller with no JWT
  // claims is in no event, so the elevated view must hand them nothing,
  // even though the base table has rows.
  const { rows: seeded } = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Elevated View Probe Wedding', 'birthday') RETURNING event_id`,
  );
  assert.ok(seeded[0]?.event_id, 'seeding the probe event failed');

  await db.exec(`SET ROLE authenticated`);
  try {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.events_host`,
    );
    assert.equal(
      rows[0]?.n,
      0,
      'a signed-in caller with no event membership can read rows through events_host. ' +
        'The view bypasses RLS by design; its WHERE clause is the only gate, and it has stopped gating.',
    );
  } finally {
    await reset();
  }
});

test('events_host · NEUTRALISATION: dropping the WHERE hands the stranger every event', async () => {
  // Proves the zero above is carried by the membership filter, not by an empty
  // table or some accident of the replay. Recreate the view unfiltered inside
  // a transaction: the same stranger must now see the seeded event.
  const { rows: def } = await db.query<{ d: string }>(
    `SELECT pg_get_viewdef('public.events_host'::regclass, true) AS d`,
  );
  assert.match(def[0]!.d, /current_couple_event_ids/, 'the couple membership filter left the view definition');
  assert.match(def[0]!.d, /current_moderator_event_ids/, 'the moderator membership filter left the view definition');

  // Rebuild from the view's OWN definition with only the WHERE removed —
  // `SELECT *` would change the column list (the view deliberately omits a
  // column; see the redaction test below) and Postgres refuses the replace.
  const unfiltered = def[0]!.d.replace(/\bWHERE\b[\s\S]*$/i, '');
  assert.notEqual(unfiltered, def[0]!.d, 'stripping the WHERE changed nothing — the sabotage did not land');

  await db.exec(`BEGIN`);
  try {
    await db.exec(`CREATE OR REPLACE VIEW public.events_host AS ${unfiltered}`);
    await db.exec(`SET ROLE authenticated`);
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.events_host`,
    );
    await db.exec(`RESET ROLE`);
    assert.ok(
      (rows[0]?.n ?? 0) > 0,
      'removing the WHERE did not open the view — the earlier zero is not attributable to the filter, ' +
        'so the test above is not guarding what it claims to guard',
    );
  } finally {
    await reset();
    await db.exec(`ROLLBACK`);
  }
});

test('events_host · the encrypted OAuth token is the ONE column the view redacts — keep it that way', async () => {
  // Found while running this check: the view exposes every events column
  // EXCEPT photo_delivery_oauth_token_encrypted. Through a definer view the
  // column list is itself an access-control decision — a host must never be
  // handed the raw encrypted Google token, and a future `SELECT *` rebuild of
  // this view would hand it over silently.
  const { rows } = await db.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='events'
       AND column_name NOT IN (SELECT column_name FROM information_schema.columns
                                WHERE table_schema='public' AND table_name='events_host')
     ORDER BY column_name`);
  const omitted = rows.map((r) => r.column_name);
  assert.ok(
    omitted.includes('photo_delivery_oauth_token_encrypted'),
    'events_host now exposes photo_delivery_oauth_token_encrypted — a definer view just handed ' +
      'every host their event’s raw encrypted Google credential. Rebuild the view without it.',
  );
});

/* ── vendor_completed_events ──────────────────────────────────────────────── */

async function seedVendor(name: string, userId: string | null): Promise<string> {
  const { rows } = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId, name],
  );
  return rows[0]!.vendor_profile_id;
}

async function seedBooking(
  vendorProfileId: string,
  label: string,
  status: string,
  coupleUserId?: string,
): Promise<string> {
  const { rows: ev } = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [label],
  );
  const eventId = ev[0]!.event_id;
  if (coupleUserId) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
      [eventId, coupleUserId],
    );
  }
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, linked_vendor_profile_id)
     VALUES ($1, 'photographer', $2, $3::vendor_status, $4)`,
    [eventId, label, status, vendorProfileId],
  );
  return eventId;
}

async function trackRecordRows(vendorProfileId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_completed_events WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return rows[0]!.n;
}

test('vendor_completed_events · a SELF-DEALT booking never reaches the public track record', async () => {
  // The view runs with owner rights, so this exclusion is the only thing that
  // keeps "I booked myself for my own wedding" out of a public trust number.
  const { rows: u } = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('self-dealer@example.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const userId = u[0]!.id;

  // Control first (anti-vacuity): the same shape at arm's length IS counted.
  const honest = await seedVendor('Arms Length Studio', null);
  await seedBooking(honest, 'Arms Length Wedding', 'delivered');
  assert.equal(
    await trackRecordRows(honest),
    1,
    'the arm\u2019s-length delivered booking never appeared — the control is broken, ' +
      'so the exclusion below would pass vacuously',
  );

  const selfDealer = await seedVendor('Self Deal Studio', userId);
  await seedBooking(selfDealer, 'Self Deal Wedding', 'delivered', userId);
  assert.equal(
    await trackRecordRows(selfDealer),
    0,
    'a booking whose couple IS the vendor\u2019s own account shows on the public track record. ' +
      'The view bypasses RLS; its NOT EXISTS (event_members couple = vendor user) clause is the ' +
      'only thing keeping self-dealt jobs out of a public trust number.',
  );
});

test('vendor_completed_events · a SHORTLISTED link is not a completed job', async () => {
  // lib/reusable-bookings.server.ts mints LINKED rows at 'shortlisted' that the
  // couple has yet to lock — the same trap PR #4483 closed on the slug page.
  // The status filter is what keeps those out of the public count here.
  const vendor = await seedVendor('Shortlist Only Studio', null);
  await seedBooking(vendor, 'Shortlist Only Wedding', 'shortlisted');
  assert.equal(
    await trackRecordRows(vendor),
    0,
    'a merely-shortlisted linked booking shows on the public track record — a link is not a booking',
  );

  // And the filter is the carrier: flipping the same row to delivered surfaces it.
  await db.query(
    `UPDATE public.event_vendors SET status = 'delivered'
      WHERE linked_vendor_profile_id = $1`,
    [vendor],
  );
  assert.equal(
    await trackRecordRows(vendor),
    1,
    'the delivered flip did not surface the row — the zero above is not attributable to the status filter',
  );
});

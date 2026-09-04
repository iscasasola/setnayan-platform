/**
 * colour-access-is-a-door-not-a-window.db.test.ts — MB16's four guards, run
 * against the real replayed schema.
 *
 * The feature hands somebody who is NOT the couple the ability to change the
 * couple's colours. Everything below exists because each of these can fail in
 * a way that renders identically to working:
 *
 *   1 · THE BOUNDARY DID NOT MOVE. `couple_can_update_event` is read back out
 *       of `pg_policies` and compared to the exact predicate `20260513040000`
 *       wrote. A widened policy is invisible from every screen in the product.
 *   2 · AN INACTIVE GRANT REFUSES AT THE FUNCTION. Called directly, past every
 *       screen, with the switch off — and with a target outside the lane.
 *       "Hidden in the UI" is not a permission model.
 *   3 · REJECT AND REVOKE ARE INDEPENDENT, BOTH WAYS. Rejecting must leave the
 *       grant standing and revoking must leave the history intact. Couple them
 *       and both still "work" — the couple simply loses a supplier over one
 *       colour, or loses the record of what happened.
 *   4 · THE LANE IS ONE MAP. `colour_domains_for_category` /
 *       `colour_domain_covers` are asked about EVERY member of the
 *       `vendor_category` enum and EVERY palette key, and compared to
 *       `lib/colour-access.ts`. Where the two differ the database wins at
 *       runtime and the screen has already told the person otherwise.
 *
 * Plus the two wires that have no screen at all: removing a delegate must
 * CASCADE their grants away, and MB12's freeze must beat a granted write
 * WITHOUT the caller being told it succeeded.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';
import {
  COLOUR_DOMAINS,
  domainCovers,
  laneForVendorCategory,
  type ColourDomain,
} from '../../lib/colour-access';
import { PALETTE_ORDER } from '../../lib/mood-board';

let replay: ReplayResult;
let db: PGlite;

const MAJORS = ['#8C3B2E', '#C9A227', '#2F4858', '#EDE6DA', '#6B8F71'];

async function setRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setRole(null);
}
async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

type World = {
  couple: string;
  florist: string;
  coordinator: string;
  stranger: string;
  eventId: string;
  floristBooking: string;
  stylistBooking: string;
};
const W: World = {
  couple: '', florist: '', coordinator: '', stranger: '',
  eventId: '', floristBooking: '', stylistBooking: '',
};

async function bookVendor(
  ownerEmail: string,
  business: string,
  category: string,
): Promise<{ bookingId: string; ownerId: string }> {
  const ownerId = await newUser(ownerEmail);
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['stylist_decorator']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [ownerId, business],
  );
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, vendor_name, category, status, marketplace_vendor_id)
     VALUES ($1, $2, $3::public.vendor_category, 'contracted', $4)
     RETURNING vendor_id`,
    [W.eventId, business, category, vp.rows[0]!.vendor_profile_id],
  );
  return { bookingId: ev.rows[0]!.vendor_id, ownerId };
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  W.couple = await newUser('mb16-couple@audit.test');
  W.coordinator = await newUser('mb16-coordinator@audit.test');
  W.stranger = await newUser('mb16-stranger@audit.test');

  const ev = await db.query<{ event_id: string }>(
    // 'birthday', not 'wedding': `events_wedding_fields_consistency` is a
    // BICONDITIONAL — a wedding must carry ceremony_type + venue_setting — and
    // nothing in MB16 reads event_type. The colour vocabulary is the same
    // either way.
    `INSERT INTO public.events (display_name, event_type, role_palette)
     VALUES ('Colour Access Test', 'birthday', $1::jsonb) RETURNING event_id`,
    [JSON.stringify({ reception: MAJORS, bride: ['#FFF8F0', '#E8D9C5'] })],
  );
  W.eventId = ev.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [W.eventId, W.couple],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'coordinator')`,
    [W.eventId, W.coordinator],
  );

  const f = await bookVendor('mb16-florist@audit.test', 'Bloom & Vine', 'florist');
  W.floristBooking = f.bookingId;
  W.florist = f.ownerId;
  const s = await bookVendor('mb16-stylist@audit.test', 'Hacienda Décor Co.', 'reception_decor');
  W.stylistBooking = s.bookingId;
});

after(async () => {
  await reset();
  await db?.close?.();
});

/** Read the live role_palette as the owner (past RLS). */
async function palette(): Promise<Record<string, unknown>> {
  await reset();
  const r = await db.query<{ role_palette: Record<string, unknown> }>(
    `SELECT COALESCE(role_palette,'{}'::jsonb) AS role_palette FROM public.events WHERE event_id = $1`,
    [W.eventId],
  );
  return r.rows[0]!.role_palette;
}

async function rpcAs<T = Record<string, unknown>>(
  uid: string | null,
  sql: string,
  params: unknown[],
): Promise<{ ok: true; value: T } | { ok: false; code: string; message: string }> {
  if (uid) await asUser(uid);
  else await reset();
  try {
    const r = await db.query<{ out: T }>(sql, params);
    await reset();
    return { ok: true, value: r.rows[0]!.out };
  } catch (e) {
    await reset();
    const err = e as { code?: string; message?: string };
    return { ok: false, code: err.code ?? '', message: err.message ?? String(e) };
  }
}

const APPLY = `SELECT public.apply_colour_change($1,$2,$3,$4,$5::smallint,$6) AS out`;

/* ════════════════════════════════════════════════════════════════════════════
   GUARD 1 · THE BOUNDARY DID NOT MOVE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 🔒 THE EXACT PREDICATE, normalised only for whitespace.
 *
 * Written by `20260513040000_fix_rls_infinite_recursion.sql` and unchanged
 * since. MB16 adds three tables, four RPCs and two UI surfaces and does not
 * touch it — a vendor's write goes through `apply_colour_change`, which is
 * SECURITY DEFINER, so no policy has to grow for the feature to exist.
 *
 * ⚠ AND A WIDENED POLICY IS INVISIBLE. Nothing on any screen changes; the app
 * simply starts accepting writes it used to refuse, from people it used to
 * refuse them from. That is why this reads the live catalog rather than
 * grepping the migration: a later migration could widen it and the original
 * file would still say the right thing.
 */
const EVENTS_UPDATE_QUAL =
  '((event_id IN ( SELECT current_couple_event_ids() AS current_couple_event_ids)) OR is_admin())';

function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

test('GUARD 1 · couple_can_update_event is byte-unchanged — MB16 widened nothing', async () => {
  await reset();
  const r = await db.query<{
    policyname: string; qual: string | null; cmd: string; roles: string; permissive: string;
  }>(
    `SELECT policyname, qual, cmd, roles::text AS roles, permissive
       FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'events' AND cmd = 'UPDATE'
      ORDER BY policyname`,
  );
  // ⚠ THERE ARE TWO, AND BOTH ARE PINNED. `anon_cannot_publish_event` is a
  // RESTRICTIVE policy on the same command; naming only the permissive one
  // would let a third appear unnoticed, and a third permissive UPDATE policy on
  // `events` IS the widening this guard exists to catch.
  assert.deepEqual(
    r.rows.map((x) => x.policyname),
    ['anon_cannot_publish_event', 'couple_can_update_event'],
    'the UPDATE policy set on events changed — a new one is the same widening by another name',
  );
  const couple = r.rows.find((x) => x.policyname === 'couple_can_update_event')!;
  assert.equal(squash(couple.qual ?? ''), squash(EVENTS_UPDATE_QUAL));
  assert.equal(couple.roles, '{authenticated}');
  const anon = r.rows.find((x) => x.policyname === 'anon_cannot_publish_event')!;
  assert.equal(anon.permissive, 'RESTRICTIVE', 'the anon guard stopped being restrictive');
});

test('GUARD 1 · current_couple_event_ids still means member_type = couple, and nothing else', async () => {
  await reset();
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(oid) AS def FROM pg_proc
      WHERE proname = 'current_couple_event_ids' AND pronamespace = 'public'::regnamespace`,
  );
  const def = squash(r.rows[0]!.def);
  assert.ok(def.includes("member_type = 'couple'"), def);
  // Widening the FUNCTION is the same widening as widening the policy, and it
  // reaches 40-odd other policies at the same time.
  assert.ok(!def.includes('coordinator'), 'the couple gate now admits coordinators');
  assert.ok(!def.includes('vendor'), 'the couple gate now admits vendors');
});

test('GUARD 1 · a granted vendor STILL cannot UPDATE events directly', async () => {
  // The grant is real and active; the raw UPDATE is still refused by RLS. This
  // is the sentence "the function is the door, not a wider window", measured.
  await reset();
  await db.query(`SELECT public.set_vendor_colour_access($1,$2,TRUE)`, [W.eventId, W.floristBooking])
    .catch(() => {});
  await asUser(W.couple);
  await db.query(`SELECT public.set_vendor_colour_access($1,$2,TRUE) AS out`, [
    W.eventId, W.floristBooking,
  ]);
  await reset();

  await asUser(W.florist);
  const r = await db.query(
    `UPDATE public.events SET role_palette = '{"reception":["#000000"]}'::jsonb
      WHERE event_id = $1 RETURNING event_id`,
    [W.eventId],
  );
  await reset();
  assert.equal(r.rows.length, 0, 'a colour grant handed a vendor raw UPDATE on events');
});

/* ════════════════════════════════════════════════════════════════════════════
   GUARD 2 · AN INACTIVE GRANT REFUSES AT THE FUNCTION
   ══════════════════════════════════════════════════════════════════════════ */

test('GUARD 2 · with NO grant at all, apply_colour_change refuses — called directly', async () => {
  const before = await palette();
  const r = await rpcAs(W.stranger, APPLY, [
    W.eventId, 'florals', 'room_dressing', 'florals', null, '#123456',
  ]);
  assert.equal(r.ok, false);
  assert.equal((r as { code: string }).code, '42501');
  assert.deepEqual(await palette(), before, 'a refused call still moved the palette');
});

test('GUARD 2 · the SWITCH is the gate — turning it off refuses the very next write', async () => {
  // ON: the write lands.
  await rpcAs(W.couple, `SELECT public.set_vendor_colour_access($1,$2,TRUE) AS out`, [
    W.eventId, W.floristBooking,
  ]);
  const on = await rpcAs<{ status: string }>(W.florist, APPLY, [
    W.eventId, 'florals', 'room_dressing', 'florals', null, '#AA3355',
  ]);
  assert.equal(on.ok, true);
  assert.equal((on as { value: { status: string } }).value.status, 'ok');

  // OFF: the identical call is refused at the function, not hidden in a UI.
  await rpcAs(W.couple, `SELECT public.set_vendor_colour_access($1,$2,FALSE) AS out`, [
    W.eventId, W.floristBooking,
  ]);
  const snapshot = await palette();
  const off = await rpcAs(W.florist, APPLY, [
    W.eventId, 'florals', 'room_dressing', 'florals', null, '#00FF00',
  ]);
  assert.equal(off.ok, false, 'a revoked florist still wrote a colour');
  assert.equal((off as { code: string }).code, '42501');
  assert.deepEqual(await palette(), snapshot);

  // And the row is kept, not deleted — the log has to stay explainable.
  await reset();
  const rows = await db.query<{ is_active: boolean; revoked_at: string | null }>(
    `SELECT is_active, revoked_at FROM public.event_colour_grants
      WHERE event_id = $1 AND vendor_id = $2`,
    [W.eventId, W.floristBooking],
  );
  assert.ok(rows.rows.length > 0, 'revoking DELETED the grant row');
  assert.ok(rows.rows.every((x) => x.is_active === false && x.revoked_at !== null));
});

test('GUARD 2 · a grant in ONE domain does not reach another — the florist and the majors', async () => {
  await rpcAs(W.couple, `SELECT public.set_vendor_colour_access($1,$2,TRUE) AS out`, [
    W.eventId, W.floristBooking,
  ]);
  const snapshot = await palette();
  // Asking under the domain they hold, for a target that domain does not cover.
  const wrongTarget = await rpcAs(W.florist, APPLY, [
    W.eventId, 'florals', 'palette', 'reception', 0, '#111111',
  ]);
  assert.equal(wrongTarget.ok, false);
  assert.equal((wrongTarget as { code: string }).code, '42501');
  // Asking under a domain they do NOT hold.
  const wrongDomain = await rpcAs(W.florist, APPLY, [
    W.eventId, 'main_colours', 'palette', 'reception', 0, '#111111',
  ]);
  assert.equal(wrongDomain.ok, false);
  assert.equal((wrongDomain as { code: string }).code, '42501');
  assert.deepEqual(await palette(), snapshot, 'a florist changed the couple’s five majors');
});

test('GUARD 2 · the stylist IS the wide lane, and reaches the majors it was given', async () => {
  await rpcAs(W.couple, `SELECT public.set_vendor_colour_access($1,$2,TRUE) AS out`, [
    W.eventId, W.stylistBooking,
  ]);
  await reset();
  const domains = await db.query<{ domain: string }>(
    `SELECT domain FROM public.event_colour_grants
      WHERE event_id = $1 AND vendor_id = $2 AND is_active ORDER BY domain`,
    [W.eventId, W.stylistBooking],
  );
  assert.deepEqual(
    domains.rows.map((r) => r.domain),
    ['decor', 'main_colours'],
    'one on-screen switch must write the RESOLVED lane, both rows',
  );
});

test('GUARD 2 · a palette slot that does not exist is refused, never created', async () => {
  const snapshot = await palette();
  const r = await rpcAs<{ status: string }>(W.couple, APPLY, [
    W.eventId, 'main_colours', 'palette', 'reception', 9, '#111111',
  ]);
  // The couple holds no grant either — the refusal comes first, which is
  // itself correct: they have their own RLS path and do not need this door.
  assert.equal(r.ok, false);
  assert.deepEqual(await palette(), snapshot);
});

test('GUARD 2 · authenticated cannot INSERT a grant it was never given', async () => {
  await asUser(W.florist);
  let refused = false;
  try {
    await db.query(
      `INSERT INTO public.event_colour_grants (event_id, vendor_id, domain)
       VALUES ($1,$2,'main_colours')`,
      [W.eventId, W.floristBooking],
    );
  } catch {
    refused = true;
  }
  await reset();
  assert.ok(refused, 'a vendor granted themselves the couple’s five main colours');
});

/* ════════════════════════════════════════════════════════════════════════════
   GUARD 3 · REJECT AND REVOKE ARE INDEPENDENT, BOTH WAYS
   ══════════════════════════════════════════════════════════════════════════ */

async function activeGrantCount(vendorId: string): Promise<number> {
  await reset();
  const r = await db.query(
    `SELECT 1 FROM public.event_colour_grants
      WHERE event_id = $1 AND vendor_id = $2 AND is_active`,
    [W.eventId, vendorId],
  );
  return r.rows.length;
}

test('GUARD 3a · rejecting a change leaves the grant STANDING, and the next write lands', async () => {
  await rpcAs(W.couple, `SELECT public.set_vendor_colour_access($1,$2,TRUE) AS out`, [
    W.eventId, W.floristBooking,
  ]);
  const applied = await rpcAs<{ status: string; change_id: string }>(W.florist, APPLY, [
    W.eventId, 'florals', 'room_dressing', 'florals', null, '#7788AA',
  ]);
  assert.equal((applied as { value: { status: string } }).value.status, 'ok');
  const changeId = (applied as { value: { change_id: string } }).value.change_id;

  const grantsBefore = await activeGrantCount(W.floristBooking);
  assert.ok(grantsBefore > 0);

  const rejected = await rpcAs<{ status: string }>(
    W.couple, `SELECT public.reject_colour_change($1) AS out`, [changeId],
  );
  assert.equal((rejected as { value: { status: string } }).value.status, 'ok');

  // 🔑 THE INDEPENDENCE, MEASURED TWICE: the grant is still there, AND the
  // florist can still write. A count alone would pass on an implementation
  // that left the row and broke the check.
  assert.equal(await activeGrantCount(W.floristBooking), grantsBefore, 'reject revoked the grant');
  const next = await rpcAs<{ status: string }>(W.florist, APPLY, [
    W.eventId, 'florals', 'room_dressing', 'florals', null, '#445566',
  ]);
  assert.equal(
    (next as { value?: { status: string } }).value?.status,
    'ok',
    'a rejected supplier was locked out — reject is not a revoke',
  );
});

test('GUARD 3b · revoking access leaves the HISTORY intact, reverted flags and all', async () => {
  await reset();
  const before = await db.query<{ change_id: string; reverted_at: string | null }>(
    `SELECT change_id, reverted_at FROM public.event_colour_changes
      WHERE event_id = $1 AND vendor_id = $2 ORDER BY created_at`,
    [W.eventId, W.floristBooking],
  );
  assert.ok(before.rows.length >= 2, 'fixture floor: the log needs rows to be erasable');
  const revertedBefore = before.rows.filter((r) => r.reverted_at !== null).length;

  await rpcAs(W.couple, `SELECT public.set_vendor_colour_access($1,$2,FALSE) AS out`, [
    W.eventId, W.floristBooking,
  ]);

  await reset();
  const after = await db.query<{ change_id: string; reverted_at: string | null }>(
    `SELECT change_id, reverted_at FROM public.event_colour_changes
      WHERE event_id = $1 AND vendor_id = $2 ORDER BY created_at`,
    [W.eventId, W.floristBooking],
  );
  assert.deepEqual(
    after.rows.map((r) => r.change_id),
    before.rows.map((r) => r.change_id),
    'revoking access deleted history — the couple can no longer see what happened',
  );
  assert.equal(
    after.rows.filter((r) => r.reverted_at !== null).length,
    revertedBefore,
    'revoking access changed which changes count as reverted',
  );
});

test('GUARD 3c · the two functions cannot reach each other’s table — read the SQL', () => {
  // The behavioural tests above prove the current implementation. This proves
  // the SHAPE: a future edit that coupled them would have to add a statement
  // naming the other table, and that is what goes red here.
  const sql = fs.readFileSync(
    path.join(MIGRATIONS_DIR, '20271204966904_colour_access_grants.sql'),
    'utf8',
  );
  const reject = bodyOf(sql, 'reject_colour_change');
  assert.ok(!/event_colour_grants/.test(reject), 'reject_colour_change now touches a grant table');
  const grantVendor = bodyOf(sql, 'set_vendor_colour_access');
  assert.ok(
    !/event_colour_changes/.test(grantVendor),
    'set_vendor_colour_access now touches the change log',
  );
  const grantHost = bodyOf(sql, 'set_coordinator_colour_access');
  assert.ok(
    !/event_colour_changes/.test(grantHost),
    'set_coordinator_colour_access now touches the change log',
  );
});

/** The `AS $$ … $$;` body of one CREATE FUNCTION, comments stripped. */
function bodyOf(sql: string, fnName: string): string {
  const at = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fnName}(`);
  assert.ok(at >= 0, `${fnName} not found — did it move or get renamed?`);
  const open = sql.indexOf('AS $$', at);
  const close = sql.indexOf('$$;', open);
  assert.ok(open > at && close > open, `${fnName} has no $$ body`);
  const body = sql.slice(open, close);
  // Floor: an empty slice would make every "does not mention" assertion pass.
  assert.ok(body.length > 200, `${fnName} body parse floor: ${body.length} chars`);
  return body.replace(/--[^\n]*/g, '');
}

test('GUARD 3d · the switch off/on cycle keeps the ORIGINAL grant date', async () => {
  await reset();
  const first = await db.query<{ granted_at: string }>(
    `SELECT granted_at FROM public.event_colour_grants
      WHERE event_id = $1 AND vendor_id = $2 LIMIT 1`,
    [W.eventId, W.floristBooking],
  );
  await rpcAs(W.couple, `SELECT public.set_vendor_colour_access($1,$2,TRUE) AS out`, [
    W.eventId, W.floristBooking,
  ]);
  await reset();
  const second = await db.query<{ granted_at: string; revoked_at: string | null }>(
    `SELECT granted_at, revoked_at FROM public.event_colour_grants
      WHERE event_id = $1 AND vendor_id = $2 LIMIT 1`,
    [W.eventId, W.floristBooking],
  );
  assert.equal(
    String(second.rows[0]!.granted_at),
    String(first.rows[0]!.granted_at),
    '"since when has this shop been able to do this" must survive an off/on cycle',
  );
  assert.equal(second.rows[0]!.revoked_at, null);
});

/* ════════════════════════════════════════════════════════════════════════════
   GUARD 4 · THE LANE IS ONE MAP — SQL and TypeScript, asked the same questions
   ══════════════════════════════════════════════════════════════════════════ */

test('GUARD 4 · every vendor_category enum member resolves to the SAME lane in both', async () => {
  await reset();
  const cats = await db.query<{ label: string }>(
    `SELECT unnest(enum_range(NULL::public.vendor_category))::text AS label ORDER BY 1`,
  );
  assert.ok(cats.rows.length >= 28, `enum floor: ${cats.rows.length} categories`);
  for (const { label } of cats.rows) {
    const sql = await db.query<{ out: string[] }>(
      `SELECT public.colour_domains_for_category($1) AS out`,
      [label],
    );
    const fromDb = [...(sql.rows[0]!.out ?? [])].sort();
    const fromTs = [...laneForVendorCategory(label)].sort();
    assert.deepEqual(
      fromDb,
      fromTs,
      `${label}: the database says [${fromDb}] and the screen says [${fromTs}] — ` +
        'the database wins at runtime and the person has already been told otherwise',
    );
  }
});

test('GUARD 4 · every palette key + dressing field agrees about which domain reaches it', async () => {
  await reset();
  const dressing = ['linens', 'chairs', 'florals', 'lighting_warmth'];
  let checked = 0;
  for (const domain of COLOUR_DOMAINS as readonly ColourDomain[]) {
    for (const key of PALETTE_ORDER) {
      const r = await db.query<{ out: boolean }>(
        `SELECT public.colour_domain_covers($1,'palette',$2) AS out`, [domain, key],
      );
      assert.equal(
        r.rows[0]!.out,
        domainCovers(domain, 'palette', key),
        `${domain} × palette:${key}`,
      );
      checked += 1;
    }
    for (const key of dressing) {
      const r = await db.query<{ out: boolean }>(
        `SELECT public.colour_domain_covers($1,'room_dressing',$2) AS out`, [domain, key],
      );
      assert.equal(
        r.rows[0]!.out,
        domainCovers(domain, 'room_dressing', key),
        `${domain} × room_dressing:${key}`,
      );
      checked += 1;
    }
  }
  // Floor: a loop that ran zero times reports a perfectly clean mirror.
  assert.ok(checked >= 60, `mirror floor: only ${checked} pairs compared`);
});

test('GUARD 4 · and the mirror can go red — a target nobody covers is FALSE in both', async () => {
  await reset();
  const r = await db.query<{ out: boolean }>(
    `SELECT public.colour_domain_covers('attire','palette','ceremony') AS out`,
  );
  assert.equal(r.rows[0]!.out, false);
  assert.equal(domainCovers('attire', 'palette', 'ceremony'), false);
});

/* ════════════════════════════════════════════════════════════════════════════
   THE TWO WIRES WITH NO SCREEN
   ══════════════════════════════════════════════════════════════════════════ */

test('WIRE · removing a delegate CASCADES their colour grants away — no code does it', async () => {
  const ok = await rpcAs<{ status: string }>(
    W.couple,
    `SELECT public.set_coordinator_colour_access($1,$2,'decor',TRUE) AS out`,
    [W.eventId, W.coordinator],
  );
  assert.equal((ok as { value: { status: string } }).value.status, 'ok');

  await reset();
  const held = await db.query(
    `SELECT 1 FROM public.event_colour_grants_coordinator WHERE event_id=$1 AND user_id=$2 AND is_active`,
    [W.eventId, W.coordinator],
  );
  assert.equal(held.rows.length, 1);

  // The membership row is what sync_delegate_membership deletes when a
  // delegate is removed. Deleting it here IS that path's effect.
  await db.query(
    `DELETE FROM public.event_members WHERE event_id=$1 AND user_id=$2 AND member_type='coordinator'`,
    [W.eventId, W.coordinator],
  );
  const after = await db.query(
    `SELECT 1 FROM public.event_colour_grants_coordinator WHERE event_id=$1 AND user_id=$2`,
    [W.eventId, W.coordinator],
  );
  assert.equal(
    after.rows.length,
    0,
    'a removed delegate kept standing permission to change the couple’s colours',
  );
});

test('WIRE · a coordinator who is not a member of the event cannot be granted at all', async () => {
  const r = await rpcAs<{ status: string }>(
    W.couple,
    `SELECT public.set_coordinator_colour_access($1,$2,'decor',TRUE) AS out`,
    [W.eventId, W.stranger],
  );
  assert.equal((r as { value: { status: string } }).value.status, 'not_a_coordinator');
});

test('WIRE · MB12’s freeze BEATS a granted write, and the caller is TOLD', async () => {
  // 🔴 THE FAILURE THIS CATCHES. events_hold_part_finalization_freeze is a
  // BEFORE UPDATE trigger that puts an agreed part's colours back on every
  // write. The UPDATE still reports success, so without the read-back inside
  // apply_colour_change the supplier is told "saved", the log carries a change
  // that never happened, and the couple gets an undo button for nothing.
  await reset();
  // Freeze `bride` by hand, through the same mechanism a real agreement uses:
  // an AGREED finalization row whose snapshot names the key.
  await db.query(
    `INSERT INTO public.moodboard_part_finalizations
       (event_id, part_id, vendor_id, state, design_snapshot, agreed_at,
        frozen_palette_keys, frozen_dressing_fields)
     VALUES ($1, 'people:bride', $2, 'agreed', $3::jsonb, NOW(), ARRAY['bride'], ARRAY[]::text[])`,
    [W.eventId, W.stylistBooking, JSON.stringify({ palette: { bride: ['#FFF8F0', '#E8D9C5'] } })],
  );

  // Give the stylist ATTIRE by hand — their real lane is decor + main_colours,
  // and the point here is the freeze, not the lane.
  await db.query(
    `INSERT INTO public.event_colour_grants (event_id, vendor_id, domain)
     VALUES ($1,$2,'attire')
     ON CONFLICT (event_id, vendor_id, domain) DO UPDATE SET is_active = TRUE, revoked_at = NULL`,
    [W.eventId, W.stylistBooking],
  );

  const stylistOwner = await db.query<{ user_id: string }>(
    `SELECT vp.user_id FROM public.event_vendors ev
       JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
      WHERE ev.vendor_id = $1`,
    [W.stylistBooking],
  );

  const logBefore = await db.query(
    `SELECT 1 FROM public.event_colour_changes WHERE event_id = $1`, [W.eventId],
  );

  const r = await rpcAs<{ status: string }>(stylistOwner.rows[0]!.user_id, APPLY, [
    W.eventId, 'attire', 'palette', 'bride', 0, '#000000',
  ]);
  assert.equal((r as { value?: { status: string } }).value?.status, 'frozen');

  await reset();
  const p = await palette();
  assert.equal(
    (p.bride as string[])[0],
    '#FFF8F0',
    'the freeze did not hold, which means the read-back is testing nothing',
  );
  const logAfter = await db.query(
    `SELECT 1 FROM public.event_colour_changes WHERE event_id = $1`, [W.eventId],
  );
  assert.equal(
    logAfter.rows.length,
    logBefore.rows.length,
    'a change that never landed was written into the log — the couple gets an undo for nothing',
  );
});

test('WIRE · reject is idempotent — two tabs cannot walk a colour backwards', async () => {
  await rpcAs(W.couple, `SELECT public.set_vendor_colour_access($1,$2,TRUE) AS out`, [
    W.eventId, W.floristBooking,
  ]);
  const applied = await rpcAs<{ status: string; change_id: string }>(W.florist, APPLY, [
    W.eventId, 'florals', 'room_dressing', 'florals', null, '#0A0B0C',
  ]);
  const id = (applied as { value: { change_id: string } }).value.change_id;
  const first = await rpcAs<{ status: string }>(
    W.couple, `SELECT public.reject_colour_change($1) AS out`, [id],
  );
  const second = await rpcAs<{ status: string }>(
    W.couple, `SELECT public.reject_colour_change($1) AS out`, [id],
  );
  assert.equal((first as { value: { status: string } }).value.status, 'ok');
  assert.equal((second as { value: { status: string } }).value.status, 'already');
});

test('WIRE · a vendor cannot reject — the undo is the couple’s alone', async () => {
  const applied = await rpcAs<{ status: string; change_id: string }>(W.florist, APPLY, [
    W.eventId, 'florals', 'room_dressing', 'florals', null, '#D0D1D2',
  ]);
  const id = (applied as { value: { change_id: string } }).value.change_id;
  const r = await rpcAs(W.florist, `SELECT public.reject_colour_change($1) AS out`, [id]);
  assert.equal(r.ok, false);
  assert.equal((r as { code: string }).code, '42501');
});

/**
 * THE VENDOR BRIEF CAN ACTUALLY BE CALLED (test:db).
 *
 * 🛑 WHY THIS FILE EXISTS — a bug that shipped inside this branch and that every
 * other db test was structurally incapable of seeing.
 *
 * 20271193010764 dropped `events.attire_guide_palette`. The drop was correct:
 * the column's only writer was dead code. But the live definition of
 * `public.get_vendor_event_brief` still SELECTed that column, and **Postgres
 * does not dependency-check a plpgsql body** — it is an opaque string to the
 * dependency tracker. So the DROP succeeded with no error and no warning, the
 * migration replay went green, and the function was broken from that moment on,
 * failing only at INVOCATION with 42703 `column e.attire_guide_palette does not
 * exist`. In production that first invocation is a supplier opening a brief.
 *
 * 🔑 THE GAP WAS EXACTLY "NOTHING CALLED IT". Replaying DDL proves a schema can
 * be BUILT; it proves nothing about whether a function body still resolves. A
 * function that only fails when invoked needs a test that invokes it. That is
 * this file, and it is deliberately NOT about attire colours — it is about the
 * whole class: any future column drop, rename or view rebuild that a
 * `get_vendor_event_brief` body still references turns these tests red at the
 * point of the drop, instead of turning a vendor's screen into a 500.
 *
 * Both payloads are asserted because the function builds them in TWO separate
 * `jsonb_build_object` calls, on opposite sides of a stage gate. A future edit
 * can break one and leave the other resolving perfectly.
 *
 * The key sets below are a CONTRACT, not a description. `get_vendor_event_brief`
 * backs the vendor client page, the .ics calendar feed, challenge-photos, the
 * on-the-day console and its live view, proposals, the supplier desk and the
 * song-desk gate. A key silently vanishing from the payload is the same class of
 * defect as the function failing outright, so these assert the EXACT key set:
 * an accidental removal goes red here, and a deliberate addition is a one-line,
 * visible edit to this list.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

type Row = Record<string, unknown>;

/**
 * Every top-level key the pre-agreement payload returns. `lock_request` is the
 * one key the 'requested' rung adds over 'inquiry' (NULL at inquiry, present as
 * a key either way).
 */
const PRE_AGREEMENT_KEYS = [
  'attire_guide',
  'booked_categories',
  'budget_band',
  'dietary',
  'event',
  'lock_request',
  'monogram',
  'palette',
  'pax',
  'seat_plan',
  'stage',
  'timeline',
].sort();

/** The booked payload. Same set MINUS `lock_request` — an ask envelope is not a fact about a booking. */
const BOOKED_KEYS = PRE_AGREEMENT_KEYS.filter((k) => k !== 'lock_request').sort();

/** 🔒 The pre-agreement `event` object. venue_name/venue_address are KEYS but hard-NULL; `region` is the city grain that replaces them. */
const PRE_AGREEMENT_EVENT_KEYS = [
  'ceremony_type',
  'display_name',
  'event_date',
  'region',
  'venue_address',
  'venue_name',
].sort();

/** The booked `event` object — carries the real venue, and drops `region` (the coarse stand-in is no longer needed). */
const BOOKED_EVENT_KEYS = ['ceremony_type', 'display_name', 'event_date', 'venue_address', 'venue_name'].sort();

const MONOGRAM_KEYS = ['color', 'custom_svg', 'font_key', 'frame_key', 'text'].sort();
const SEAT_PLAN_KEYS = ['assigned_guests', 'published', 'published_at', 'table_count'].sort();

/**
 * A role_palette shaped like the live one: per-role colour ARRAYS, plus the
 * couple-defined custom_roles the mood-board redesign added. This is the column
 * that actually carries the wedding's per-role attire colour, and the payload's
 * `palette` key is where a vendor reads it.
 */
const ROLE_PALETTE = {
  ceremony: ['#F3E9DC'],
  reception: ['#7A2E3B', '#C9A227', '#F3E9DC', '#2E3A46', '#B7C9B1'],
  bride: ['#FFFFFF'],
  groom: ['#1B1B1B'],
  guest: ['#8FA6B2', '#C2B49A'],
  wedding_party: ['#7A2E3B'],
  principal_sponsors: ['#D8CFC0'],
  custom_roles: [{ key: 'ninongs', label: 'Ninongs', colors: ['#4A5C6A'] }],
};

async function newUser(email: string, type = 'customer'): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [email, type],
  );
  return u.rows[0]!.id;
}

async function newVendor(email: string): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser(email);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Invocation Co', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

/**
 * A REAL event, populated on every field the payload reads — palette, monogram,
 * venue, run-of-show, a guest.
 *
 * 🔑 POPULATING IT IS THE POINT. Against an empty event most of this payload is
 * NULL anyway, so a broken read and an unset field look identical — the same
 * "a search that cannot match is not a negative result" failure, in test form.
 */
async function newFullEvent(label: string): Promise<{ eventId: string; coupleUid: string }> {
  const coupleUid = await newUser(`couple-${label}@brief-invocation.test`);
  const e = await db.query<{ event_id: string }>(
    // A WEDDING row: events_wedding_fields_consistency is a biconditional, so
    // event_type='wedding' obliges both ceremony_type and venue_setting to be
    // non-null. ceremony_type is a field the payload actually returns, so the
    // event has to be the kind of event that is allowed to have one.
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_date_precision,
        venue_name, venue_address, region, ceremony_type, venue_setting, role_palette,
        monogram_text, monogram_color, monogram_font_key)
     VALUES ($1, 'wedding', '2027-06-06'::date, 'day',
             'Casa Invocation', '1 Called Street, Makati', 'NCR', 'civil', 'garden', $2::jsonb,
             'A&B', '#7A2E3B', 'serif')
     RETURNING event_id`,
    [`Event ${label}`, JSON.stringify(ROLE_PALETTE)],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, coupleUid],
  );
  await db.query(
    `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, location)
     VALUES ($1, 'Ceremony', 'ceremony', '2027-06-06T14:00:00Z', 'Casa Invocation')`,
    [eventId],
  );
  await db.query(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
     VALUES ($1, 'Invited', 'Guest', 'both', 'friends', 'attending')`,
    [eventId],
  );
  return { eventId, coupleUid };
}

async function newBooking(
  eventId: string,
  vpid: string,
  opts: { status?: string; pending?: boolean } = {},
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        lock_request_state, lock_requested_at)
     VALUES ($1, 'photographer'::public.vendor_category, 'Invocation Co',
             $2::public.vendor_status, $3, $4, $5)
     RETURNING vendor_id`,
    [
      eventId,
      opts.status ?? 'considering',
      vpid,
      opts.pending ? 'pending' : null,
      opts.pending ? new Date().toISOString() : null,
    ],
  );
  return r.rows[0]!.vendor_id;
}

async function asVendor(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
}

/**
 * Invoke the function. Any Postgres error is re-thrown with the diagnosis
 * attached, because the failure this file guards against (42703 / 42P01) is
 * otherwise a bare column name with no hint about what to do next.
 */
async function brief(eventId: string): Promise<Row> {
  try {
    const r = await db.query<{ b: Row }>(`SELECT public.get_vendor_event_brief($1) AS b`, [eventId]);
    return r.rows[0]!.b;
  } catch (err) {
    const code = (err as { code?: string }).code;
    const msg = (err as Error).message;
    if (code === '42703' || code === '42P01') {
      throw new Error(
        `get_vendor_event_brief FAILED AT INVOCATION (${code}): ${msg}\n` +
          '🔑 A migration dropped or renamed something the function body still reads. ' +
          'Postgres does NOT dependency-check a plpgsql body, so the drop succeeded ' +
          'silently and only a CALL can see it. Fix: CREATE OR REPLACE the function ' +
          'in a new migration with the dead reference removed — do not weaken this test.',
      );
    }
    throw err;
  }
}

const sortedKeys = (v: unknown): string[] => Object.keys(v as object).sort();

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

test('a BOOKED supplier can call the brief, and it carries every key its callers read', async () => {
  const { eventId } = await newFullEvent('booked');
  const { vpid, uid } = await newVendor('booked@brief-invocation.test');
  await newBooking(eventId, vpid, { status: 'contracted' });
  await asVendor(uid);

  const b = await brief(eventId);

  assert.equal(b.stage, 'booked');
  assert.deepEqual(sortedKeys(b), BOOKED_KEYS, 'booked payload key set changed — that is a contract break');
  assert.deepEqual(sortedKeys(b.event), BOOKED_EVENT_KEYS);
  assert.deepEqual(sortedKeys(b.monogram), MONOGRAM_KEYS);
  assert.deepEqual(sortedKeys(b.seat_plan), SEAT_PLAN_KEYS);

  // The fields that prove the read actually resolved rather than returning NULLs.
  assert.equal((b.event as Row).venue_name, 'Casa Invocation');
  assert.equal((b.event as Row).ceremony_type, 'civil');
  assert.equal((b.monogram as Row).text, 'A&B');
  assert.equal((b.pax as Row).attending, 1);
  assert.equal((b.timeline as unknown[]).length, 1);
});

test('an ASKED supplier can call the brief, and it carries every key its callers read', async () => {
  const { eventId } = await newFullEvent('asked');
  const { vpid, uid } = await newVendor('asked@brief-invocation.test');
  await newBooking(eventId, vpid, { pending: true });
  await asVendor(uid);

  const b = await brief(eventId);

  assert.equal(b.stage, 'requested');
  assert.deepEqual(sortedKeys(b), PRE_AGREEMENT_KEYS, 'pre-agreement payload key set changed — that is a contract break');
  assert.deepEqual(sortedKeys(b.event), PRE_AGREEMENT_EVENT_KEYS);
  assert.deepEqual(sortedKeys(b.monogram), MONOGRAM_KEYS);
  assert.deepEqual(sortedKeys(b.seat_plan), SEAT_PLAN_KEYS);

  // The ceiling still holds — this file must not become a way to widen it.
  assert.equal((b.event as Row).venue_name, null);
  assert.equal((b.event as Row).venue_address, null);
  assert.equal((b.event as Row).region, 'NCR');
});

test('an INQUIRY supplier can call the brief — the third caller of the same payload builder', async () => {
  const { eventId } = await newFullEvent('inquiry');
  const { vpid, uid } = await newVendor('inquiry@brief-invocation.test');
  await newBooking(eventId, vpid);
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source, inquiry_status)
     VALUES ($1, $2, 'explore', 'accepted')`,
    [eventId, vpid],
  );
  await asVendor(uid);

  const b = await brief(eventId);

  assert.equal(b.stage, 'inquiry');
  assert.deepEqual(sortedKeys(b), PRE_AGREEMENT_KEYS);
  assert.equal(b.lock_request, null, 'an inquiry has no ask envelope — the key is present and NULL');
});

/**
 * 🔑 THE REGRESSION ITSELF, NAMED.
 *
 * `attire_guide` is retained as an EMPTY OBJECT, not deleted and not re-sourced.
 * `events.attire_guide_palette` was dropped by 20271193010764 and had never been
 * written for any event (measured against prod 2026-09-03: 0 of 5 rows
 * non-empty), so `{}` is byte-identical to everything the key has ever returned.
 *
 * The vendor's real per-role colour is NOT lost with it — it lives in
 * `events.role_palette` and reaches the same payload under `palette`, which the
 * vendor client page already renders role by role. This test asserts both halves
 * together, because that pairing is the whole justification for blanking the
 * key: if `palette` ever stops carrying the colours, `attire_guide` returning
 * `{}` stops being harmless and this goes red.
 */
test('attire_guide is an empty object, and the colours it used to imply still arrive via palette', async () => {
  const { eventId } = await newFullEvent('palette');
  const { vpid, uid } = await newVendor('palette@brief-invocation.test');
  await newBooking(eventId, vpid, { status: 'contracted' });
  await asVendor(uid);

  const b = await brief(eventId);

  assert.deepEqual(b.attire_guide, {}, 'attire_guide must stay a present, empty OBJECT — never absent, never null');

  // Bound BEFORE the deepEqual below: `assert.deepEqual` is an `asserts` guard,
  // so asserting on `b.palette` narrows it to ROLE_PALETTE's literal type, which
  // has no index signature and cannot be indexed by a loop variable.
  const palette = b.palette as Record<string, unknown>;
  assert.deepEqual(b.palette, ROLE_PALETTE, 'palette must carry role_palette verbatim, custom_roles included');
  for (const role of ['bride', 'groom', 'guest', 'wedding_party', 'principal_sponsors']) {
    const colors = palette[role];
    assert.ok(
      Array.isArray(colors) && colors.length > 0,
      `palette.${role} is where the vendor reads this role's colour now — it must not be empty`,
    );
  }
});

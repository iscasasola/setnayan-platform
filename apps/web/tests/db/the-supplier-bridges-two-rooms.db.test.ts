/**
 * THE BRIDGE BETWEEN TWO ROOMS ON ONE DAY — and what it must never name.
 *
 * A caterer with a morning christening and an evening reception has two desks
 * at two addresses and no time to hunt for links mid-service. The binding
 * design (§ E) puts one line under the top chrome. This is the read behind it.
 *
 * ── WHY THESE ASSERTIONS ────────────────────────────────────────────────────
 * The function's whole job is to answer "which OTHER celebrations may I name to
 * this person, today". Every way it can be wrong is a disclosure or a silence:
 *
 *   · naming a celebration this caller is not booked on — a leak;
 *   · naming one from ANOTHER SHOP that happens to share a teammate — the leak
 *     the design names outright, and the reason the team-member union used by
 *     `get_vendor_event_brief` is deliberately absent here;
 *   · answering at all for somebody not booked in the room they claim to be
 *     standing in;
 *   · missing the middle day of a celebration that spans several — the same
 *     first-day-only mistake the desk's opening rule had to be taught out of;
 *   · naming a celebration the organiser has closed out or put away.
 *
 * Run: `pnpm --filter @setnayan/web test:db` (or the single file with `tsx
 * --test tests/db/the-supplier-bridges-two-rooms.db.test.ts`). Require a
 * NON-ZERO test count before believing a pass.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.close();
});

let n = 0;
async function newUser(): Promise<string> {
  n += 1;
  const id = `00000000-0000-4000-8000-${String(700000 + n).padStart(12, '0')}`;
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
    id,
    `bridge${n}@t.invalid`,
  ]);
  return id;
}

async function newShop(): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Bridge Co', 'Manila', ARRAY['catering']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

async function newEvent(
  name: string,
  date: string,
  opts: { endDate?: string; cleared?: boolean; archived?: boolean; slug?: string } = {},
): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_end_date, event_date_precision, region,
        slug, cleared_at, archived)
     VALUES ($1, 'birthday', $2::date, $3::date, 'day', 'NCR', $4,
             CASE WHEN $5 THEN NOW() ELSE NULL END, $6)
     RETURNING event_id`,
    [name, date, opts.endDate ?? null, opts.slug ?? null, opts.cleared ?? false, opts.archived ?? false],
  );
  return e.rows[0]!.event_id;
}

/** A real booking — the four statuses every other reader treats as booked. */
async function book(eventId: string, vpid: string, status = 'contracted'): Promise<void> {
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'catering', 'Bridge Co', $2::public.vendor_status, $3)`,
    [eventId, status, vpid],
  );
}

type Row = { event_id: string; display_name: string; slug: string | null; event_date: string };

async function bridge(uid: string, eventId: string, day: string): Promise<Row[]> {
  await setAuthUid(db, uid);
  const r = await db.query<{ out: Row[] }>(
    `SELECT public.get_vendor_same_day_bookings($1, $2::date) AS out`,
    [eventId, day],
  );
  return r.rows[0]!.out;
}

const DAY = '2027-06-12';

test('it names the shop’s OTHER booking running that same day', async () => {
  const shop = await newShop();
  const here = await newEvent('The christening', DAY);
  const there = await newEvent('Maria’s reception', DAY, { slug: 'maria-reception' });
  await book(here, shop.vpid);
  await book(there, shop.vpid);

  const rows = await bridge(shop.uid, here, DAY);
  assert.equal(rows.length, 1, 'exactly the other one');
  assert.equal(rows[0]!.event_id, there);
  assert.equal(rows[0]!.display_name, 'Maria’s reception');
  assert.equal(rows[0]!.slug, 'maria-reception', 'the address is what makes it a bridge');
  // The room they are standing in is never on its own bridge.
  assert.ok(!rows.some((r) => r.event_id === here));
});

test('it never names a celebration this shop is not booked on', async () => {
  const shop = await newShop();
  const other = await newShop();
  const here = await newEvent('Mine', DAY);
  const strangers = await newEvent('Somebody else’s wedding', DAY, { slug: 'not-mine' });
  await book(here, shop.vpid);
  await book(strangers, other.vpid);

  const rows = await bridge(shop.uid, here, DAY);
  assert.deepEqual(rows, [], 'a celebration on the same day is not a celebration you may name');
});

test('a shortlisted or archived link is not a booking', async () => {
  const shop = await newShop();
  const here = await newEvent('Mine', DAY);
  const shortlisted = await newEvent('Only shortlisted', DAY);
  const archived = await newEvent('Archived link', DAY);
  await book(here, shop.vpid);
  await book(shortlisted, shop.vpid, 'shortlisted');
  await book(archived, shop.vpid);
  await db.query(`UPDATE public.event_vendors SET archived_at = NOW() WHERE event_id = $1`, [
    archived,
  ]);

  const rows = await bridge(shop.uid, here, DAY);
  assert.deepEqual(rows, [], 'a link is not a booking — the same rule the doorway itself asks');
});

test('somebody not booked in the room they claim to be standing in gets nothing', async () => {
  const shop = await newShop();
  const stranger = await newShop();
  const here = await newEvent('Mine', DAY);
  const mineToo = await newEvent('Also mine', DAY);
  await book(here, shop.vpid);
  await book(mineToo, shop.vpid);

  // The stranger owns a shop and has bookings of their own — but none here.
  const theirs = await newEvent('Theirs', DAY);
  await book(theirs, stranger.vpid);

  const rows = await bridge(stranger.uid, here, DAY);
  assert.deepEqual(
    rows,
    [],
    'answering here would let any signed-in shop read their own diary through somebody else’s ' +
      'event id — harmless in content, and an unproved premise the next extension would inherit',
  );
});

test('a celebration that spans days bridges on its MIDDLE days, not only its first', async () => {
  const shop = await newShop();
  const here = await newEvent('The christening', DAY);
  const festival = await newEvent('Three-day festival', '2027-06-10', {
    endDate: '2027-06-14',
    slug: 'festival',
  });
  await book(here, shop.vpid);
  await book(festival, shop.vpid);

  const rows = await bridge(shop.uid, here, DAY);
  assert.equal(
    rows.length,
    1,
    'anchoring on event_date alone hides the reception from a caterer working day three — the ' +
      'same first-day-only mistake the desk’s opening rule had to be taught out of',
  );
  assert.equal(rows[0]!.slug, 'festival');
});

test('a celebration the organiser closed out or put away is not a room to step into', async () => {
  const shop = await newShop();
  const here = await newEvent('Mine', DAY);
  const cleared = await newEvent('Closed out', DAY, { cleared: true });
  const archived = await newEvent('Put away', DAY, { archived: true });
  await book(here, shop.vpid);
  await book(cleared, shop.vpid);
  await book(archived, shop.vpid);

  const rows = await bridge(shop.uid, here, DAY);
  assert.deepEqual(rows, []);
});

test('a different day is a different answer', async () => {
  const shop = await newShop();
  const here = await newEvent('Mine', DAY);
  const tomorrow = await newEvent('Tomorrow’s reception', '2027-06-13', { slug: 'tomorrow' });
  await book(here, shop.vpid);
  await book(tomorrow, shop.vpid);

  assert.deepEqual(await bridge(shop.uid, here, DAY), [], 'not today');
  const next = await bridge(shop.uid, here, '2027-06-13');
  assert.equal(next.length, 1, 'and the day it IS running, it is named');
});

test('a signed-out caller gets an empty answer, not an error and not a diary', async () => {
  const shop = await newShop();
  const here = await newEvent('Mine', DAY);
  const there = await newEvent('Also mine', DAY);
  await book(here, shop.vpid);
  await book(there, shop.vpid);

  await setAuthUid(db, null);
  const r = await db.query<{ out: Row[] }>(
    `SELECT public.get_vendor_same_day_bookings($1, $2::date) AS out`,
    [here, DAY],
  );
  assert.deepEqual(r.rows[0]!.out, []);
});

test('THE ONE THAT MATTERS: a teammate of the shop is not the shop', async () => {
  // 🔒 `get_vendor_event_brief` resolves the caller's orgs as *profiles owned*
  // UNION *vendor_team_members*. Pasting that union in here is shorter, looks
  // equivalent, and would tell an agent granted ONE celebration about every
  // other booking the shop holds — which is exactly what the design forbids and
  // what the owner ruled against when he kept grants per-event.
  const shop = await newShop();
  const mate = await newUser();
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'agent'::public.vendor_team_role)`,
    [shop.vpid, mate],
  );
  const here = await newEvent('The christening', DAY);
  const there = await newEvent('The reception they were never told about', DAY);
  await book(here, shop.vpid);
  await book(there, shop.vpid);

  assert.deepEqual(
    await bridge(mate, here, DAY),
    [],
    'the teammate union must stay out of this function until the teammate desk is built, and ' +
      'then be widened PER GRANT — never by pasting the brief’s union in',
  );
  // …and the owner still sees their own second booking, so the narrowing is not
  // an accidental "nobody gets anything".
  assert.equal((await bridge(shop.uid, here, DAY)).length, 1);
});

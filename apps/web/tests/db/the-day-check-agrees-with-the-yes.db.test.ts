/**
 * THE DAY CHECK AGREES WITH THE YES — 2026-11-04 DAY CHECK BEFORE ACCEPT,
 * migration 20271306441834.
 *
 * The supplier now sees a booking ask's day BEFORE pressing Agree
 * (`vendor_day_check`): "Dec 19 · 0 of 4 booked · 1 shortlisted", or red "Full
 * on Feb 14 · … · you take 1 a day" with Accept swapped for "Waiting list".
 *
 * 🔑 ONE RULE, PREVIEW AND REFUSAL. A preview that says "open" over a yes the
 * server then refuses — or "full" over a yes that would have gone through — is
 * worse than no preview. So every scenario below asks BOTH, for the SAME row,
 * as the SAME real `authenticated` supplier session: the day check's `verdict`
 * first, then `vendor_agree_to_lock`, and asserts they name the same thing
 * ('open' ⇔ the yes goes through; otherwise the verdict IS the refusal status).
 *   · an open day (one of two booked)            → open · ok
 *   · a full card ("Bookings per day" 2, 2 booked) → daily_limit_reached
 *   · a full time slot (1 per slot, 1 booked)    → slot_full
 *   · another couple asking for the same day     → resolve_others_first
 *   · a month-only booking stored as the 1st     → not counted (open · ok)
 * Plus what the day check lists (booked on Setnayan + outside, asking,
 * shortlisted-not-asked), that a stranger is refused, and that "Waiting list"
 * puts the couple on the shop's EXISTING waiting list only when the day is full.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { parseDayCheck, dayCheckLine } from '../../lib/day-check';

let replay: ReplayResult;
let db: PGlite;

const OPEN_DAY = '2027-12-18';
const FULL_DAY = '2027-12-19';
const SLOT_DAY = '2027-12-20';
const RIVAL_DAY = '2027-12-21';
const FIRST_DAY = '2028-01-01';

const F = { couple: '', supplier: '', shop: '', card: '', slotCard: '', slot: '', stranger: '' };

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}

let seq = 0;
async function mkUser(label: string, type: 'customer' | 'vendor'): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
      [`${label}-${++seq}@day-check.test`, type],
    )
  ).rows[0]!.id;
}

async function mkShop(label: string): Promise<{ uid: string; vpid: string }> {
  const uid = await mkUser(label, 'vendor');
  const vpid =
    (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid]))
      .rows[0]?.v ??
    (
      await db.query<{ v: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2) RETURNING vendor_profile_id AS v`,
        [uid, label],
      )
    ).rows[0]!.v;
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = $2, location_city = 'Manila', services = ARRAY['photography']::text[],
            verification_state = 'verified'::public.vendor_verification_state, last_verified_at = NOW(),
            public_visibility = 'verified'::public.vendor_public_visibility,
            tier_state = 'solo'
      WHERE vendor_profile_id = $1`,
    [vpid, label],
  );
  return { uid, vpid };
}

async function mkCard(vpid: string, category: string, dailyCapacity: number | null, title: string): Promise<string> {
  const s = await db.query<{ s: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
     VALUES ($1, $2, 40000, 'Free extra hour', FALSE, 'vendor-media/day-check/cover.jpg') RETURNING vendor_service_id AS s`,
    [vpid, category],
  );
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
     VALUES ($1, $2, 'Unlimited prints', 0, 0)`,
    [s.rows[0]!.s, vpid],
  );
  await db.query(`UPDATE public.vendor_services SET daily_capacity = $2, title = $3, is_active = TRUE WHERE vendor_service_id = $1`, [
    s.rows[0]!.s,
    dailyCapacity,
    title,
  ]);
  return s.rows[0]!.s;
}

async function mkEvent(name: string, day: string, precision: 'day' | 'month' = 'day'): Promise<string> {
  return (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ($1, 'birthday', $2::date, $3) RETURNING event_id AS e`,
      [name, day, precision],
    )
  ).rows[0]!.e;
}

async function row(
  eventId: string,
  opts: { card: string | null; status?: string; slot?: string | null; pending?: boolean; by?: string | null },
): Promise<string> {
  return (
    await db.query<{ v: string }>(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, marketplace_vendor_id, service_id, service_time_slot_id,
          lock_request_state, lock_requested_at, lock_requested_by_user_id)
       VALUES ($1, 'misc', 'Day Check Studio', $2, $3, $4, $5,
               CASE WHEN $6 THEN 'pending' END, CASE WHEN $6 THEN NOW() END, $7)
       RETURNING vendor_id AS v`,
      [eventId, opts.status ?? 'contracted', F.shop, opts.card, opts.slot ?? null, opts.pending ?? false, opts.by ?? null],
    )
  ).rows[0]!.v;
}

/** Another couple, booked (or asking, or shortlisting) on `day`. */
async function other(name: string, day: string, opts: { card: string | null; status?: string; slot?: string | null; pending?: boolean; precision?: 'day' | 'month' }): Promise<string> {
  const ev = await mkEvent(name, day, opts.precision ?? 'day');
  await row(ev, opts);
  return ev;
}

/** OUR couple's open ask on `day`. */
async function ourAsk(day: string, card: string, slot: string | null = null): Promise<string> {
  const ev = await mkEvent('Indalecio & Claire', day);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [ev, F.couple]);
  return row(ev, { card, status: 'considering', slot, pending: true, by: F.couple });
}

type Check = Record<string, unknown> & { status: string; verdict?: string };
async function check(uid: string, rowId: string): Promise<Check> {
  return asUser(uid, async () => (await db.query<{ r: Check }>(`SELECT public.vendor_day_check($1) AS r`, [rowId])).rows[0]!.r);
}
async function agree(uid: string, rowId: string): Promise<string> {
  return asUser(uid, async () => (await db.query<{ r: { status: string } }>(`SELECT public.vendor_agree_to_lock($1) AS r`, [rowId])).rows[0]!.r.status);
}
async function waitlist(uid: string, rowId: string): Promise<string> {
  return asUser(uid, async () => (await db.query<{ r: { status: string } }>(`SELECT public.vendor_waitlist_the_ask($1) AS r`, [rowId])).rows[0]!.r.status);
}

/** THE PROPERTY: the preview's verdict names exactly what the yes then does. */
async function previewEqualsRefusal(rowId: string): Promise<{ verdict: string; answer: string; check: Check }> {
  const c = await check(F.supplier, rowId);
  assert.equal(c.status, 'ok', `the day check did not answer: ${JSON.stringify(c)}`);
  const answer = await agree(F.supplier, rowId);
  assert.equal(c.verdict, answer === 'ok' ? 'open' : answer, `preview said ${c.verdict}, the yes answered ${answer}`);
  return { verdict: c.verdict!, answer, check: c };
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  F.couple = await mkUser('couple', 'customer');
  ({ uid: F.supplier, vpid: F.shop } = await mkShop('Day Check Studio'));
  ({ uid: F.stranger } = await mkShop('Someone Else'));
  F.card = await mkCard(F.shop, 'photo_booth', 2, 'Photo booth');
  F.slotCard = await mkCard(F.shop, 'host_emcee', null, 'Host');
  F.slot = (
    await db.query<{ s: string }>(
      `INSERT INTO public.vendor_service_time_slots (vendor_profile_id, vendor_service_id, slot_label, start_time, end_time, slot_capacity)
       VALUES ($1, $2, 'Morning', '08:00', '12:00', 1) RETURNING slot_id AS s`,
      [F.shop, F.slotCard],
    )
  ).rows[0]!.s;

  // OPEN_DAY: one of two booked; one couple shortlisted the shop and has not asked.
  await other('Reyes & Cruz', OPEN_DAY, { card: F.card, status: 'deposit_paid' });
  await other('Santos & Lim', OPEN_DAY, { card: null, status: 'shortlisted' });
  // FULL_DAY: two booked (a third archived-equivalent is a shortlist, not a booking) + an outside client.
  await other('Lopez & Pineda', FULL_DAY, { card: F.card, status: 'contracted' });
  await other('Tan & Uy', FULL_DAY, { card: F.card, status: 'complete' });
  const pool = (
    await db.query<{ p: string }>(
      `INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label, daily_booking_capacity, is_active)
       VALUES ($1, 'Main', 3, TRUE) RETURNING pool_id AS p`,
      [F.shop],
    )
  ).rows[0]!.p;
  await db.query(
    `INSERT INTO public.vendor_calendar_blocks (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source, is_private, client_name)
     VALUES ($1, $3, ($2 || ' 00:00:00+08')::timestamptz, ($2 || ' 23:30:00+08')::timestamptz, 'Garcia debut', 'external_client', TRUE, 'Garcia debut')`,
    [F.shop, FULL_DAY, pool],
  );
  // SLOT_DAY: the one Morning place is booked.
  await other('Bautista & Go', SLOT_DAY, { card: F.slotCard, slot: F.slot, status: 'contracted' });
  // FIRST_DAY: two MONTH-only bookings stored as the 1st — neither is on the 1st.
  await other('Month A', FIRST_DAY, { card: F.card, precision: 'month' });
  await other('Month B', FIRST_DAY, { card: F.card, precision: 'month' });
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('a full card: the preview says daily_limit_reached, and so does the yes', async () => {
  const ask = await ourAsk(FULL_DAY, F.card);
  // The waiting list first — the yes below leaves the ask open (refused), so order does not matter, but read it while open.
  const { verdict, check: c } = await previewEqualsRefusal(ask);
  assert.equal(verdict, 'daily_limit_reached');
  const parsed = parseDayCheck(c);
  assert.ok(parsed, 'the app could not read its own RPC');
  const card = parsed.services.find((s) => s.serviceId === F.card)!;
  assert.deepEqual([card.mode, card.dailyLimit, card.booked, card.full], ['day', 2, 2, true]);
  // Booked that day: both couples on Setnayan AND the outside client — the outside one is listed, not counted.
  const names = parsed.booked.map((b) => `${b.name}|${b.source}`).sort();
  assert.deepEqual(names, ['Garcia debut|outside', 'Lopez & Pineda|setnayan', 'Tan & Uy|setnayan']);
  const line = dayCheckLine(parsed, 'Dec 19');
  assert.equal(line.full, true);
  assert.match(line.text, /^Full on Dec 19 · Lopez & Pineda, Tan & Uy booked · you take 2 a day$/);
});

test('"Waiting list" on a full day puts the couple on the shop\'s existing waiting list — once', async () => {
  const ask = await ourAsk(FULL_DAY, F.card);
  assert.equal(await waitlist(F.supplier, ask), 'ok');
  const rows = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_date_waitlist
      WHERE vendor_profile_id = $1 AND requested_date = $2::date AND user_id = $3 AND status = 'pending'`,
    [F.shop, FULL_DAY, F.couple],
  );
  assert.equal(rows.rows[0]!.n, 1);
  assert.equal(await waitlist(F.supplier, ask), 'already');
  assert.equal(await waitlist(F.stranger, ask).catch((e: Error) => e.message), 'not_your_booking');
});

test('a full time slot: the preview says slot_full, and so does the yes', async () => {
  const ask = await ourAsk(SLOT_DAY, F.slotCard, F.slot);
  const { verdict, check: c } = await previewEqualsRefusal(ask);
  assert.equal(verdict, 'slot_full');
  const card = parseDayCheck(c)!.services.find((s) => s.serviceId === F.slotCard)!;
  assert.deepEqual([card.mode, card.slots, card.perSlot, card.booked, card.full], ['slot', 1, 1, 1, true]);
});

test('another couple asking for the same day: the preview says resolve_others_first, and so does the yes', async () => {
  const rival = await mkEvent('Aquino & Diaz', RIVAL_DAY);
  await row(rival, { card: F.card, status: 'considering', pending: true });
  const ask = await ourAsk(RIVAL_DAY, F.card);
  const { verdict, check: c } = await previewEqualsRefusal(ask);
  assert.equal(verdict, 'resolve_others_first');
  const parsed = parseDayCheck(c)!;
  assert.deepEqual(parsed.asking.map((a) => a.name), ['Aquino & Diaz']);
  assert.equal(dayCheckLine(parsed, 'Dec 21').full, false, 'others asking is not a full day');
});

test('a month-only booking stored as the 1st is not a booking on the 1st — preview and yes agree it is open', async () => {
  const ask = await ourAsk(FIRST_DAY, F.card);
  const { verdict, answer } = await previewEqualsRefusal(ask);
  assert.deepEqual([verdict, answer], ['open', 'ok']);
});

test('an open day: the preview says open, lists who is booked and who shortlisted; the yes goes through', async () => {
  const ask = await ourAsk(OPEN_DAY, F.card);
  // Waiting list is refused on an open day — it is for a full one.
  assert.equal(await waitlist(F.supplier, ask), 'not_full');
  const { verdict, answer, check: c } = await previewEqualsRefusal(ask);
  assert.deepEqual([verdict, answer], ['open', 'ok']);
  const parsed = parseDayCheck(c)!;
  assert.deepEqual(parsed.booked.map((b) => b.name), ['Reyes & Cruz']);
  assert.deepEqual(parsed.shortlisted.map((s) => s.name), ['Santos & Lim']);
  assert.equal(dayCheckLine(parsed, 'Dec 18').text, 'Dec 18 · 1 of 2 booked · 1 shortlisted');
});

test('a stranger cannot read another shop\'s day', async () => {
  const ask = await ourAsk(OPEN_DAY, F.card);
  await assert.rejects(() => check(F.stranger, ask), /not_your_booking/);
});

test('both functions are SECURITY DEFINER, pinned search_path, authenticated yes, anon no', async () => {
  for (const fn of ['public.vendor_day_check(uuid)', 'public.vendor_waitlist_the_ask(uuid)']) {
    const r = await db.query<{ sd: boolean; cfg: string[] | null; auth: boolean; anon: boolean }>(
      `SELECT p.prosecdef AS sd, p.proconfig AS cfg,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
              has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
         FROM pg_proc p WHERE p.oid = $1::regprocedure`,
      [fn],
    );
    const f = r.rows[0]!;
    assert.equal(f.sd, true, `${fn} is not SECURITY DEFINER`);
    assert.ok((f.cfg ?? []).some((c) => c.startsWith('search_path=')), `${fn} has no pinned search_path`);
    assert.deepEqual([f.auth, f.anon], [true, false], `${fn} grants moved`);
  }
});

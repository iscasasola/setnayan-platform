/**
 * 🤝 PARTNERS COME AFTER A SHARED EVENT — asserted against the DATABASE (migration 20271316893943).
 *
 * Owner, verbatim, 2026-11-06 (DECISION_LOG): "Suppliers can connect partnerships with suppliers they have been with
 * in events. cannot link until they have served the same event."
 *
 *   1 · a proposal between two shops that never served together is REFUSED by the insert trigger (NOT_SERVED_TOGETHER);
 *   2 · a shared event that has not happened yet does not count — refused;
 *   3 · a shared event whose date has passed, both shops BOOKED — allowed;
 *   4 · "considering" is not booked, a sample event is not an event — refused;
 *   5 · partners_you_served_with() lists ONLY the eligible shops — type + date, never the event's name;
 *       and refuses a shop that is not the caller's (not_your_shop), rather than answering empty;
 *   6 · re-proposing an already-accepted partnership (a new kind) is a restatement, not a new link — allowed;
 *   7 · the old any-vendor "worked with" hint is gone.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

type Shop = { uid: string; vp: string };
let demoEventId = '';
const S: Record<'photo' | 'florist' | 'band' | 'stranger' | 'future' | 'maybe' | 'sample', Shop> = {} as never;

async function mkShop(email: string, name: string, cat: string): Promise<Shop> {
  const uid = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    )
  ).rows[0]!.id;
  const vp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1,$2,'Manila',ARRAY[$3]::text[],'verified', NOW()) RETURNING vendor_profile_id`,
      [uid, name, cat],
    )
  ).rows[0]!.vendor_profile_id;
  await db.query(`UPDATE public.vendor_profiles SET public_visibility = 'verified' WHERE vendor_profile_id = $1`, [vp]);
  return { uid, vp };
}

async function mkEvent(name: string, date: string, isSample = false): Promise<string> {
  const id = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ($1, 'wedding', 'catholic', 'banquet_hall', $2::date, 'day') RETURNING event_id`,
      [name, date],
    )
  ).rows[0]!.event_id;
  if (isSample) await db.query(`UPDATE public.events SET is_sample = TRUE WHERE event_id = $1`, [id]);
  return id;
}

async function book(eventId: string, shop: Shop, cat: string, status = 'contracted'): Promise<void> {
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1,$2,'x',$3,10000,$4)`,
    [eventId, cat, status, shop.vp],
  );
}

async function propose(from: Shop, to: Shop, kind = 'general'): Promise<void> {
  await asUser(from.uid);
  try {
    await db.query(
      `INSERT INTO public.vendor_partnerships (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active)
       VALUES ($1,$2,$3,'proposed',true)`,
      [from.vp, to.vp, kind],
    );
  } finally {
    await asOwner();
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  S.photo = await mkShop('photo@partners.test', 'Sample Photo', 'photographer');
  S.florist = await mkShop('florist@partners.test', 'Sample Florist', 'florist');
  S.band = await mkShop('band@partners.test', 'Sample Band', 'band_dj');
  S.stranger = await mkShop('stranger@partners.test', 'Sample Stranger', 'photographer');
  S.future = await mkShop('future@partners.test', 'Sample Future', 'florist');
  S.maybe = await mkShop('maybe@partners.test', 'Sample Maybe', 'florist');
  S.sample = await mkShop('sample@partners.test', 'Sample Demo', 'florist');

  // A past wedding — photo + florist + band all booked; "maybe" only considered.
  const past = await mkEvent('Private Couple Name', '2024-03-15');
  await book(past, S.photo, 'photographer');
  await book(past, S.florist, 'florist', 'complete');
  await book(past, S.band, 'band_dj', 'deposit_paid');
  await book(past, S.maybe, 'florist', 'considering');

  // A wedding that has not happened yet — photo + future booked.
  const coming = await mkEvent('Next Year Wedding', '2099-12-18');
  await book(coming, S.photo, 'photographer');
  await book(coming, S.future, 'florist');

  // A past SAMPLE event. A showcase is not a served event. Since
  // 20271316355263 (a real event never books a demo shop) only a DEMO shop can
  // be booked on it — S.sample is a demo shop, and a real shop (S.photo) is
  // refused by the database itself (asserted in test 4).
  await db.query(`UPDATE public.vendor_profiles SET is_demo = TRUE WHERE vendor_profile_id = $1`, [S.sample.vp]);
  demoEventId = await mkEvent('Sample Event', '2024-01-10', true);
  await book(demoEventId, S.sample, 'florist');
});

after(async () => {
  await replay?.db.close();
});

test('1 · two shops that never served together cannot link', async () => {
  await assert.rejects(propose(S.photo, S.stranger), /NOT_SERVED_TOGETHER/);
});

test('2 · a shared event in the future does not count yet', async () => {
  await assert.rejects(propose(S.photo, S.future), /NOT_SERVED_TOGETHER/);
});

test('3 · after a shared past event, both booked — the link is allowed (either direction)', async () => {
  await propose(S.photo, S.florist);
  await propose(S.band, S.photo);
  const n = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.vendor_partnerships WHERE status = 'proposed'`,
  );
  assert.equal(n.rows[0]!.c, 2);
});

test('4 · "considering" is not booked, and a sample event is not an event', async () => {
  await assert.rejects(propose(S.photo, S.maybe), /NOT_SERVED_TOGETHER/);
  await assert.rejects(propose(S.photo, S.sample), /NOT_SERVED_TOGETHER/);
  // A real shop cannot even be booked on a sample event, so a sample event can never make two shops "served together".
  await assert.rejects(book(demoEventId, S.photo, 'photographer'), /demo_cross_booking/);
});

test('5 · the picker read lists only eligible shops — type + date, never the event name — and only for your own shop', async () => {
  await asUser(S.photo.uid);
  const rows = (
    await db.query<Record<string, unknown>>(`SELECT * FROM public.partners_you_served_with($1)`, [S.photo.vp])
  ).rows;
  const names = rows.map((r) => r.business_name).sort();
  assert.deepEqual(names, ['Sample Band', 'Sample Florist']);
  assert.deepEqual(
    Object.keys(rows[0]!).sort(),
    ['business_name', 'event_date', 'event_date_precision', 'event_type', 'is_live', 'other_vendor_profile_id'],
  );
  assert.ok(!JSON.stringify(rows).includes('Private Couple Name'), 'the event name / couple leaked into the read');
  assert.equal(rows[0]!.event_type, 'wedding');
  assert.equal(rows[0]!.is_live, true);

  await assert.rejects(
    db.query(`SELECT * FROM public.partners_you_served_with($1)`, [S.florist.vp]),
    /not_your_shop/,
  );
  // The internal definition is not callable from a client role.
  await assert.rejects(
    db.query(`SELECT * FROM public.vendor_served_together_rows($1)`, [S.photo.vp]),
    /permission denied/,
  );
  await asOwner();
});

test('6 · re-proposing an accepted partnership under a new kind is a restatement, not a new link', async () => {
  // A partnership accepted BEFORE the rule, between shops with no shared past event — seeded with the trigger off,
  // as a pre-rule row was written (the trigger fires for every role, the owner included).
  await db.exec(`ALTER TABLE public.vendor_partnerships DISABLE TRIGGER trg_vendor_partnerships_need_a_shared_event`);
  await db.query(
    `INSERT INTO public.vendor_partnerships (recommending_vendor_id, recommended_vendor_id, relationship_type, status, is_active, accepted_at)
     VALUES ($1, $2, 'general', 'withdrawn', true, NOW())`,
    [S.stranger.vp, S.future.vp],
  );
  await db.exec(`ALTER TABLE public.vendor_partnerships ENABLE TRIGGER trg_vendor_partnerships_need_a_shared_event`);
  // (status 'withdrawn' + accepted_at: exactly what changePartnershipKind leaves before it inserts the new wording.)
  await propose(S.stranger, S.future, 'accredited');
  // …but a stranger pair with no history at all is still refused.
  await assert.rejects(propose(S.stranger, S.band), /NOT_SERVED_TOGETHER/);
});

test('7 · the old any-vendor "worked with" hint is gone', async () => {
  const r = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'vendor_worked_with_ids'`,
  );
  assert.equal(r.rows[0]!.c, 0);
});

/**
 * 🎭 BACKSTAGE INSIDE THE VENUE'S WINDOW GOES IN AT ONCE — asserted against the DATABASE (migration 20271356061492;
 * Unichat part F, owner 2026-11-20, DECISION_LOG "A supplier sets its own BACKSTAGE moments without the host's OK").
 *
 * The chapter: Cocktail + Reception, event 4:00–9:30 PM, setup from 12:00 PM (240 min before), out by 11:00 PM (420 min
 * after the start) — the drawing's Fernwood Gardens.
 *
 *   1 · the verdict (`schedule_request_goes_in_at_once`): a supplier's own new moment backstage inside the window is yes;
 *       a moment guests see, one outside the hours, one that ends after "out by", one with no time, a delete, a host's
 *       ask and a Time-TBA chapter are no;
 *   2 · an adjust is yes only when the moment is backstage NOW and ends up backstage inside the window;
 *   3 · the record: an accept nobody pressed (`auto_agreed`) is refused for a request the rule does not allow, and
 *       passes for one it does, or when the event's Auto-agree is on; a host's own Approve is untouched;
 *   4 · a signed-in user cannot ask the verdict (service role only).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}

const F = { eventId: '', couple: '', catUid: '', catVp: '', catEv: '', chapter: '', tba: '', setup: '', dinner: '' };
const T = (hhmm: string) => `2099-12-18T${hhmm}:00Z`;

async function block(label: string, parent: string | null, start: string | null, end: string | null = null, extra = ''): Promise<string> {
  await asOwner();
  const r = await db.query<{ block_id: string }>(
    `INSERT INTO public.event_schedule_blocks (event_id, parent_block_id, label, start_at, end_at, responsible_vendor_ids${extra ? ', ' + extra.split('=')[0] : ''})
     VALUES ($1,$2,$3,$4,$5,$6::uuid[]${extra ? ', ' + extra.split('=')[1] : ''}) RETURNING block_id`,
    [F.eventId, parent, label, start, end, [F.catEv]],
  );
  return r.rows[0]!.block_id;
}

async function ask(over: { kind?: string; block?: string | null; parent?: string | null; start?: string | null; end?: string | null; direction?: string }): Promise<string> {
  await asOwner();
  const kind = over.kind ?? 'new';
  const r = await db.query<{ suggestion_id: string }>(
    `INSERT INTO public.event_schedule_suggestions
       (event_id, block_id, vendor_profile_id, suggested_by_user_id, suggested_by_name, kind, proposed_label,
        proposed_start_at, proposed_end_at, proposed_parent_block_id, direction, asked_as, note)
     VALUES ($1,$2,$3,$4,'Bituin Catering',$5,'Setup',$6,$7,$8,$9,$10,'Our time') RETURNING suggestion_id`,
    [
      F.eventId,
      over.block ?? null,
      F.catVp,
      F.catUid,
      kind,
      over.start === undefined ? T('12:30') : over.start,
      over.end === undefined ? T('13:30') : over.end,
      kind === 'new' ? (over.parent === undefined ? F.chapter : over.parent) : null,
      over.direction ?? 'to_host',
      over.direction === 'to_supplier' ? 'host' : null,
    ],
  );
  return r.rows[0]!.suggestion_id;
}

async function verdict(id: string): Promise<boolean> {
  await asOwner();
  return (await db.query<{ ok: boolean }>(`SELECT public.schedule_request_goes_in_at_once($1) AS ok`, [id])).rows[0]!.ok;
}

async function autoAccept(id: string): Promise<void> {
  await asOwner();
  await db.query(`UPDATE public.event_schedule_suggestions SET status = 'accepted', auto_agreed = TRUE, resolved_at = NOW() WHERE suggestion_id = $1`, [id]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('couple@backstage.test');
  F.catUid = await mkUser('cater@backstage.test');
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Backstage Day','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);
  F.catVp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
       VALUES ($1,'Bituin Catering','Manila',ARRAY['catering']::text[],'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
      [F.catUid],
    )
  ).rows[0]!.vendor_profile_id;
  F.catEv = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
       VALUES ($1,'catering','Bituin Catering','contracted',100000,$2) RETURNING vendor_id`,
      [F.eventId, F.catVp],
    )
  ).rows[0]!.vendor_id;
  F.chapter = await block('Cocktail + Reception', null, T('16:00'), T('21:30'), 'ingress_minutes_before, egress_minutes_after=240, 420');
  F.tba = await block('After party', null, T('22:00'), null, 'time_tba, is_public, ingress_minutes_before=TRUE, FALSE, 60');
  F.setup = await block('Buffet setup', F.chapter, T('13:00'), T('14:00'));
  F.dinner = await block('Dinner', F.chapter, T('18:00'), T('19:00'));
});

after(async () => {
  await db?.close?.();
});

test('1 · a new moment: backstage inside the window is yes, everything else waits', async () => {
  assert.equal(await verdict(await ask({})), true, 'setup at 12:30 inside the window waited');
  assert.equal(await verdict(await ask({ start: T('22:00'), end: T('22:45') })), true, 'pack-up before out-by waited');
  assert.equal(await verdict(await ask({ start: T('17:00'), end: T('17:30') })), false, 'a moment guests see went straight in');
  assert.equal(await verdict(await ask({ start: T('10:00'), end: T('10:30') })), false, 'before setup-from went straight in');
  assert.equal(await verdict(await ask({ start: T('22:30'), end: T('23:30') })), false, 'a moment ending after out-by went straight in');
  assert.equal(await verdict(await ask({ start: null, end: null })), false, 'a moment with no time went straight in');
  assert.equal(await verdict(await ask({ parent: F.tba, start: T('21:30'), end: T('21:45') })), false, 'a Time-TBA chapter has a window');
  assert.equal(await verdict(await ask({ parent: F.setup })), false, 'a moment under a moment has a window');
  assert.equal(await verdict(await ask({ direction: 'to_supplier' })), false, 'a host’s ask applied itself');
});

test('2 · an adjust: backstage now AND backstage inside the window after', async () => {
  assert.equal(await verdict(await ask({ kind: 'adjust', block: F.setup, start: T('14:00'), end: T('15:00') })), true, 'a setup move inside the window waited');
  assert.equal(await verdict(await ask({ kind: 'adjust', block: F.dinner, start: T('14:00'), end: T('15:00') })), false, 'a moment guests see was moved backstage without a person');
  assert.equal(await verdict(await ask({ kind: 'adjust', block: F.setup, start: T('11:00'), end: T('11:30') })), false, 'moved outside the hours without a person');
  assert.equal(await verdict(await ask({ kind: 'remove', block: F.setup, start: null, end: null })), false, 'a delete went straight in');
});

test('3 · the record: an accept nobody pressed is only written for what the rule allows', async () => {
  const front = await ask({ start: T('17:00'), end: T('17:30') });
  await assert.rejects(() => autoAccept(front), /schedulerequest:needs_a_person/, 'a moment guests see was marked auto-agreed');
  const back = await ask({});
  await autoAccept(back);
  // A host's own Approve (auto_agreed stays false) is untouched by the guard.
  const host = await ask({ start: T('17:00'), end: T('17:30') });
  await asOwner();
  await db.query(`UPDATE public.event_schedule_suggestions SET status = 'accepted', resolved_at = NOW() WHERE suggestion_id = $1`, [host]);
  // The host's standing Auto-agree lets every request in.
  await db.query(`UPDATE public.events SET supplier_requests_auto_agree = TRUE WHERE event_id = $1`, [F.eventId]);
  await autoAccept(await ask({ start: T('17:00'), end: T('17:30') }));
  await db.query(`UPDATE public.events SET supplier_requests_auto_agree = FALSE WHERE event_id = $1`, [F.eventId]);
  const s = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_schedule_suggestions WHERE suggestion_id = $1 AND status = 'open'`, [front])).rows[0]!.n;
  assert.equal(s, 1, 'the refused accept changed the row');
});

test('4 · only the service role asks the verdict', async () => {
  const id = await ask({});
  await asUser(F.catUid);
  await assert.rejects(() => db.query(`SELECT public.schedule_request_goes_in_at_once($1)`, [id]), /permission denied/);
  await asOwner();
});

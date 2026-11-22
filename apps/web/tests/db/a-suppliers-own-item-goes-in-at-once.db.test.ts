/**
 * ✏️ A SUPPLIER'S EDIT TO THEIR OWN ITEM GOES IN AT ONCE — asserted against the DATABASE (migration 20271359080029;
 * owner 2026-11-21 "'THEIR EVENT' DOOR SHAPE + SCHEDULE RULE", controller 22 Nov 2026).
 *
 * The record guard (`schedule_request_auto_accept_guard`, #8080) refuses an accept nobody pressed unless the rule allows
 * it. #8094 applies a shop's change to ITS OWN moment at once (`editsOwnItem`), so the guard must allow exactly that —
 * and nothing wider. Auto-agree is OFF throughout, and every moment below is one GUESTS SEE (so #8080's backstage rule
 * alone would refuse every one of them):
 *
 *   1 · the shop's own moment (its booking is in `responsible_vendor_ids`) → the accept is written;
 *   2 · another shop's moment → refused, the request stays open;
 *   3 · a moment with no responsible supplier → refused;
 *   4 · a NEW moment, a delete, and a host's ask aimed at the shop → refused (only an adjust of an existing moment).
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

const F = { eventId: '', catUid: '', catVp: '', catEv: '', lightsVp: '', lightsEv: '', chapter: '', dinner: '', lights: '', nobody: '' };
const T = (hhmm: string) => `2099-12-19T${hhmm}:00Z`;

async function block(label: string, parent: string | null, start: string, end: string, responsible: string[], extra = ''): Promise<string> {
  await asOwner();
  const r = await db.query<{ block_id: string }>(
    `INSERT INTO public.event_schedule_blocks (event_id, parent_block_id, label, start_at, end_at, responsible_vendor_ids${extra ? ', ' + extra.split('=')[0] : ''})
     VALUES ($1,$2,$3,$4,$5,$6::uuid[]${extra ? ', ' + extra.split('=')[1] : ''}) RETURNING block_id`,
    [F.eventId, parent, label, start, end, responsible],
  );
  return r.rows[0]!.block_id;
}

async function ask(o: { kind?: string; block?: string | null; direction?: string; start?: string | null; end?: string | null }): Promise<string> {
  await asOwner();
  const kind = o.kind ?? 'adjust';
  const r = await db.query<{ suggestion_id: string }>(
    `INSERT INTO public.event_schedule_suggestions
       (event_id, block_id, vendor_profile_id, suggested_by_user_id, suggested_by_name, kind, proposed_label,
        proposed_start_at, proposed_end_at, proposed_parent_block_id, direction, asked_as, note)
     VALUES ($1,$2,$3,$4,'Bituin Catering',$5,'Dinner',$6,$7,$8,$9,$10,'Our time') RETURNING suggestion_id`,
    [
      F.eventId,
      o.block ?? null,
      F.catVp,
      F.catUid,
      kind,
      o.start === undefined ? T('18:30') : o.start,
      o.end === undefined ? T('19:30') : o.end,
      kind === 'new' ? F.chapter : null,
      o.direction ?? 'to_host',
      o.direction === 'to_supplier' ? 'host' : null,
    ],
  );
  return r.rows[0]!.suggestion_id;
}

async function autoAccept(id: string): Promise<void> {
  await asOwner();
  await db.query(`UPDATE public.event_schedule_suggestions SET status = 'accepted', auto_agreed = TRUE, resolved_at = NOW() WHERE suggestion_id = $1`, [id]);
}

async function statusOf(id: string): Promise<string> {
  await asOwner();
  return (await db.query<{ status: string }>(`SELECT status FROM public.event_schedule_suggestions WHERE suggestion_id = $1`, [id])).rows[0]!.status;
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
  const couple = await mkUser('couple@own-item.test');
  F.catUid = await mkUser('cater@own-item.test');
  const lightsUid = await mkUser('lights@own-item.test');
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Own Item Day','wedding','catholic','banquet_hall', DATE '2099-12-19', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, couple]);
  const shop = async (uid: string, name: string, service: string): Promise<string> =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
         VALUES ($1,$2,'Manila',ARRAY[$3]::text[],'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
        [uid, name, service],
      )
    ).rows[0]!.vendor_profile_id;
  F.catVp = await shop(F.catUid, 'Bituin Catering', 'catering');
  F.lightsVp = await shop(lightsUid, 'Liwanag Lights', 'lights_and_sound');
  const book = async (vp: string, name: string, category: string): Promise<string> =>
    (
      await db.query<{ vendor_id: string }>(
        `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
         VALUES ($1,$2,$3,'contracted',100000,$4) RETURNING vendor_id`,
        [F.eventId, category, name, vp],
      )
    ).rows[0]!.vendor_id;
  F.catEv = await book(F.catVp, 'Bituin Catering', 'catering');
  F.lightsEv = await book(F.lightsVp, 'Liwanag Lights', 'lights_and_sound');
  F.chapter = await block('Cocktail + Reception', null, T('16:00'), T('21:30'), [], 'ingress_minutes_before, egress_minutes_after=240, 420');
  F.dinner = await block('Dinner', F.chapter, T('18:00'), T('19:00'), [F.catEv]); // the caterer's own, guests see it
  F.lights = await block('First dance lights', F.chapter, T('19:30'), T('19:45'), [F.lightsEv]); // another shop's
  F.nobody = await block('Toasts', F.chapter, T('19:00'), T('19:20'), []);
  await db.query(`UPDATE public.events SET supplier_requests_auto_agree = FALSE WHERE event_id = $1`, [F.eventId]);
});

after(async () => {
  await db?.close?.();
});

test('1 · the shop’s own moment goes in at once, Auto-agree off, even one guests see', async () => {
  const id = await ask({ block: F.dinner });
  await autoAccept(id);
  assert.equal(await statusOf(id), 'accepted', 'the caterer’s own Dinner change was refused by the record guard');
});

test('2 · another shop’s moment is refused and stays open', async () => {
  const id = await ask({ block: F.lights, start: T('19:40'), end: T('19:55') });
  await assert.rejects(() => autoAccept(id), /schedulerequest:needs_a_person/, 'the caterer moved the lights supplier’s moment without a person');
  assert.equal(await statusOf(id), 'open');
});

test('3 · a moment with no responsible supplier is refused', async () => {
  const id = await ask({ block: F.nobody, start: T('19:05'), end: T('19:25') });
  await assert.rejects(() => autoAccept(id), /schedulerequest:needs_a_person/, 'a moment nobody owns went straight in');
});

test('4 · only an adjust of an existing moment — a new moment, a delete and a host’s ask still wait', async () => {
  await assert.rejects(async () => autoAccept(await ask({ kind: 'new', start: T('18:10'), end: T('18:40') })), /schedulerequest:needs_a_person/, 'a new moment guests see went straight in');
  await assert.rejects(async () => autoAccept(await ask({ kind: 'remove', block: F.dinner, start: null, end: null })), /schedulerequest:needs_a_person/, 'a delete of their own moment went straight in');
  await assert.rejects(async () => autoAccept(await ask({ block: F.dinner, direction: 'to_supplier' })), /schedulerequest:needs_a_person/, 'a host’s ask applied itself');
});

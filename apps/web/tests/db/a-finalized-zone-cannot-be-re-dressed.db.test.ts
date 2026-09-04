/**
 * A FINALIZED ROOM ZONE CANNOT BE RE-DRESSED — BY ANY WRITER (MB15).
 *
 * MB12 froze what an agreement means for `events.role_palette` and put a
 * BEFORE UPDATE trigger behind it, because a guard on one writer is a guard on
 * one writer. `events.reception_design` — the treatments themselves, which is
 * what a room supplier actually agreed to BUILD — got neither.
 *
 * The failure is the same shape MB12's own header names, one field over: the
 * row says `agreed`, the couple re-picks "Fairy lights" over the draped canopy
 * the stylist quoted, nothing renders differently anywhere, and the supplier
 * builds what they agreed to — which is now wrong on the day.
 *
 * ⚠ WHY THIS IS A `*.db.test.ts`. Every claim here is about a trigger rewriting
 * a value on its way into the table. DDL that PARSES is not DDL that BEHAVES,
 * and no TypeScript test can observe that a design write was silently corrected
 * — the UI refusal in `reception-design-editor.tsx` is the LEGIBILITY half and
 * is guarded separately; this is the half that actually holds.
 *
 * 🔑 THE SABOTAGE THAT MUST GO RED: freeze the zone in the editor only. Every
 * unit test still passes, `applyMoodboardTemplate` still overwrites the agreed
 * ceiling, and this file is the only thing that notices.
 */

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

/** The design the stylist agreed to: a draped ceiling and a step-and-repeat. */
const AGREED_DESIGN = {
  ceiling: { treatment: 'draped' },
  photo_wall: { style: 'step_repeat' },
};
const SNAPSHOT = {
  palette: {},
  room_dressing: {},
  reception_design: AGREED_DESIGN,
};

async function newUser(email: string, type = 'customer'): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [email, type],
  );
  return u.rows[0]!.id;
}

async function newShop(email: string): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser(email);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Bloom & Vine', 'Manila', ARRAY['florist']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

async function newEvent(label: string): Promise<{ eventId: string; coupleUid: string }> {
  const coupleUid = await newUser(`couple-${label}@mb15.test`);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1,'celebration')
     RETURNING event_id`,
    [`Event ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUid],
  );
  await db.query(
    `UPDATE public.events SET reception_design = $2::jsonb WHERE event_id = $1`,
    [eventId, JSON.stringify(AGREED_DESIGN)],
  );
  return { eventId, coupleUid };
}

/** Ask, then have the supplier agree — the real path, not a hand-written row. */
async function agreedZone(
  label: string,
  partId: string,
): Promise<{ eventId: string; coupleUid: string; shopUid: string }> {
  const { eventId, coupleUid } = await newEvent(label);
  const { vpid, uid } = await newShop(`shop-${label}@mb15.test`);
  const b = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1,'florist'::public.vendor_category,'Bloom & Vine','contracted'::public.vendor_status,$2)
     RETURNING vendor_id`,
    [eventId, vpid],
  );
  const vendorId = b.rows[0]!.vendor_id;
  await setAuthUid(db, coupleUid);
  const asked = await db.query<{ out: { finalization_id?: string; status?: string } }>(
    `SELECT public.request_part_finalization($1,$2,$3,$4::jsonb) AS out`,
    [eventId, partId, vendorId, JSON.stringify(SNAPSHOT)],
  );
  const id = asked.rows[0]!.out.finalization_id;
  assert.ok(id, `the ask was refused: ${JSON.stringify(asked.rows[0]!.out)}`);
  // The SHOP answers, not the couple — `vendor_agree_to_part` refuses anybody
  // else with `not_your_booking`, which is the whole point of a handshake.
  await setAuthUid(db, uid);
  const agreed = await db.query<{ out: { status?: string } }>(
    `SELECT public.vendor_agree_to_part($1) AS out`,
    [id],
  );
  assert.equal(agreed.rows[0]!.out.status, 'ok', JSON.stringify(agreed.rows[0]!.out));
  await setAuthUid(db, coupleUid);
  return { eventId, coupleUid, shopUid: uid };
}

async function readDesign(eventId: string): Promise<Record<string, unknown>> {
  const r = await db.query<{ d: Record<string, unknown> }>(
    `SELECT reception_design AS d FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  return r.rows[0]!.d ?? {};
}

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

/* ═══════════════════════════════════════════════════════════════════════════
   1 · THE TRIGGER AND THE FUNCTION EXIST, AND ARE WIRED TO EACH OTHER
   ═══════════════════════════════════════════════════════════════════════════ */

test('the design backstop is a BEFORE UPDATE trigger on the column it protects', async () => {
  const r = await db.query<{ tgname: string; timing: string; proname: string }>(
    `SELECT t.tgname,
            CASE WHEN (t.tgtype & 2) <> 0 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
            p.proname
       FROM pg_trigger t
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = 'public.events'::regclass
        AND t.tgname = 'events_hold_part_finalization_design'`,
  );
  assert.equal(r.rows.length, 1, 'the reception_design backstop is not installed');
  assert.equal(r.rows[0]!.timing, 'BEFORE', 'an AFTER trigger cannot rewrite the value being written');
  assert.equal(r.rows[0]!.proname, 'events_hold_part_finalization_design');
});

test('neither definer function is callable with the publishable key', async () => {
  // Both read `moodboard_part_finalizations` with RLS bypassed, so a caller who
  // chose its own arguments could read back another couple's agreed design. The
  // GRANT decides, not the caller — the class `anon-rpc-surface.db.test.ts`
  // exists for.
  for (const fn of [
    'reassert_part_finalization_design',
    'events_hold_part_finalization_design',
  ]) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_function_privilege($1, p.oid, 'EXECUTE') AS ok
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $2`,
        [role, fn],
      );
      assert.equal(r.rows.length, 1, `${fn} is missing`);
      assert.equal(r.rows[0]!.ok, false, `${role} can EXECUTE ${fn}`);
    }
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   2 · THE FREEZE ACTUALLY HOLDS
   ═══════════════════════════════════════════════════════════════════════════ */

test('re-dressing an agreed ceiling does not take — from any writer', async () => {
  const { eventId } = await agreedZone('ceiling', 'room:ceiling');
  // The couple's own designer write, and then the shape a theme apply sends:
  // a whole new design object replacing the blob.
  for (const attempt of [
    { ceiling: { treatment: 'fairy_lights' }, photo_wall: { style: 'step_repeat' } },
    { ceiling: { treatment: 'none' } },
    {},
  ]) {
    await db.query(`UPDATE public.events SET reception_design = $2::jsonb WHERE event_id = $1`, [
      eventId,
      JSON.stringify(attempt),
    ]);
    const after = await readDesign(eventId);
    assert.deepEqual(
      after.ceiling,
      { treatment: 'draped' },
      `the agreed ceiling was overwritten by ${JSON.stringify(attempt)} — the supplier quoted a ` +
        'draped canopy and the room now says something else, with nothing anywhere saying so',
    );
  }
});

test('a zone nobody agreed to still moves freely', async () => {
  // The freeze is per part. A finalized ceiling must not stop a couple dressing
  // their photo wall — over-freezing is its own defect, and a silent one.
  const { eventId } = await agreedZone('scoped', 'room:ceiling');
  await db.query(
    `UPDATE public.events SET reception_design = $2::jsonb WHERE event_id = $1`,
    [eventId, JSON.stringify({ ceiling: { treatment: 'draped' }, photo_wall: { style: 'neon_backdrop' } })],
  );
  const after = await readDesign(eventId);
  assert.deepEqual(after.photo_wall, { style: 'neon_backdrop' }, 'an unagreed zone was frozen too');
  assert.deepEqual(after.ceiling, { treatment: 'draped' });
});

test('an event with no agreement is untouched — the trigger costs nothing and changes nothing', async () => {
  const { eventId, coupleUid } = await newEvent('free');
  await setAuthUid(db, coupleUid);
  const next = { ceiling: { treatment: 'fairy_lights' }, walls: { treatment: 'floral_garland' } };
  await db.query(`UPDATE public.events SET reception_design = $2::jsonb WHERE event_id = $1`, [
    eventId,
    JSON.stringify(next),
  ]);
  assert.deepEqual(await readDesign(eventId), next);
});

test('a people: agreement freezes no zone at all', async () => {
  // `people:bride` freezes colours in role_palette. Freezing a design zone from
  // it would freeze something nobody agreed to build.
  const { eventId } = await agreedZone('people', 'people:bride');
  await db.query(
    `UPDATE public.events SET reception_design = $2::jsonb WHERE event_id = $1`,
    [eventId, JSON.stringify({ ceiling: { treatment: 'fairy_lights' } })],
  );
  assert.deepEqual(await readDesign(eventId), { ceiling: { treatment: 'fairy_lights' } });
});

test('a re-opened zone moves again', async () => {
  /*
    THE OTHER HALF OF THE FREEZE, AND THE ONE THAT IS EASY TO FORGET. A zone
    that stayed frozen after the supplier released it would be a lock with no
    key: every surface would offer the control and the write would never take.
  */
  const { eventId, coupleUid, shopUid } = await agreedZone('reopen', 'room:ceiling');
  const idRow = await db.query<{ id: string }>(
    `SELECT finalization_id AS id FROM public.moodboard_part_finalizations WHERE event_id = $1`,
    [eventId],
  );
  const id = idRow.rows[0]!.id;
  await setAuthUid(db, coupleUid);
  await db.query(`SELECT public.request_part_reopen($1)`, [id]);
  await setAuthUid(db, shopUid);
  await db.query(`SELECT public.vendor_answer_part_reopen($1, TRUE, NULL)`, [id]);
  await setAuthUid(db, coupleUid);

  await db.query(
    `UPDATE public.events SET reception_design = $2::jsonb WHERE event_id = $1`,
    [eventId, JSON.stringify({ ceiling: { treatment: 'fairy_lights' } })],
  );
  assert.deepEqual(
    (await readDesign(eventId)).ceiling,
    { treatment: 'fairy_lights' },
    'the zone is still frozen after both sides agreed to re-open it',
  );
});

test('a snapshot that never mentioned the zone restores nothing rather than blanking it', async () => {
  /*
    `buildDesignSnapshot` stores the whole sanitized design, so a zone left at
    its default is simply ABSENT from it. Writing an empty object back would be
    a claim the supplier never made, and it would erase whatever the couple has
    since chosen for a zone nobody froze.
  */
  const { eventId, coupleUid } = await newEvent('sparse');
  const { vpid, uid: shopUid } = await newShop('sparse@mb15.test');
  const b = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1,'florist'::public.vendor_category,'Bloom & Vine','contracted'::public.vendor_status,$2)
     RETURNING vendor_id`,
    [eventId, vpid],
  );
  await setAuthUid(db, coupleUid);
  const asked = await db.query<{ out: { finalization_id?: string } }>(
    `SELECT public.request_part_finalization($1,$2,$3,$4::jsonb) AS out`,
    [
      eventId,
      'room:ceiling',
      b.rows[0]!.vendor_id,
      // No `ceiling` key at all — the couple had not dressed it when they asked.
      JSON.stringify({ palette: {}, room_dressing: {}, reception_design: { stage: { setup: 'sweetheart' } } }),
    ],
  );
  await setAuthUid(db, shopUid);
  await db.query(`SELECT public.vendor_agree_to_part($1)`, [asked.rows[0]!.out.finalization_id]);
  await setAuthUid(db, coupleUid);

  await db.query(
    `UPDATE public.events SET reception_design = $2::jsonb WHERE event_id = $1`,
    [eventId, JSON.stringify({ ceiling: { treatment: 'fairy_lights' } })],
  );
  assert.deepEqual(
    (await readDesign(eventId)).ceiling,
    { treatment: 'fairy_lights' },
    'an absent snapshot entry blanked a zone the supplier never spoke about',
  );
});

/**
 * A HELD-BACK CAPTURE CANNOT BE ACCEPTED — BY ANY ROUTE (08 step 1.2).
 *
 * The desk's acceptance criterion says "…including a hand-made request", and
 * that phrase is the whole point of this file. The host holds a per-column
 * UPDATE grant on `papic_mission_completions.status` (migration 20271214724787),
 * so they can PATCH `/rest/v1/papic_mission_completions` with the public anon
 * key and their own session and **never execute the server action's check at
 * all**. An app-side `if` is therefore advisory here, exactly as the eight
 * refusals on `recordSeatCapture` were advisory until the row stopped going in
 * through the caller's own session.
 *
 * So the refusal lives in the database, and these tests attack it the way a
 * hand-made request would: a plain `UPDATE`, no application code anywhere.
 *
 * ⚠ THIS ONE GENUINELY REFUSES, so `assert.rejects` IS the right shape — unlike
 * a PIN trigger (which overwrites) or an RLS policy (which returns zero rows
 * rather than throwing). Both of those mistakes are recorded in this repo; the
 * distinction is checked explicitly in the last test, which proves a refused
 * write left the row untouched rather than silently succeeding.
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
  await replay?.close?.();
});

let n = 0;

/**
 * One event, one mission, one guest, one capture, one completion.
 * `optedOut` decides whether a SECOND guest — tagged in the capture — has
 * withdrawn from photos, which is the RA 10173 veto this trigger enforces.
 */
async function seed(opts: {
  moderationState?: string;
  consentToPublic?: boolean;
  hidden?: boolean;
  consentToShare?: boolean;
  taggedGuestOptedOut?: boolean;
  captureMissing?: boolean;
}) {
  n += 1;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Desk test ${n}', 'birthday', CURRENT_DATE - 1) RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;

  const shooter = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests
       (event_id, first_name, last_name, side, group_category, role, rsvp_status,
        meal_preference, invited_to_blocks, entry_source, photo_consent)
     VALUES ($1, $2, 'Shooter', 'both', 'other', 'guest', 'pending',
             'no_preference', ARRAY['ceremony'], 'host_seeded', true)
     RETURNING guest_id`,
    [eventId, `Shooter${n}`],
  );
  const shooterId = shooter.rows[0]!.guest_id;

  const mission = await db.query<{ mission_id: string }>(
    `INSERT INTO public.papic_missions (event_id, mission_type, prompt)
     VALUES ($1, 'prompt', 'say one thing you know about them that we do not')
     RETURNING mission_id`,
    [eventId],
  );
  const missionId = mission.rows[0]!.mission_id;

  let captureId: string | null = null;
  if (!opts.captureMissing) {
    const cap = await db.query<{ capture_id: string }>(
      `INSERT INTO public.papic_guest_captures
         (event_id, guest_id, r2_object_key, moderation_state, consent_to_public, hidden_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING capture_id`,
      [
        eventId,
        shooterId,
        `r2://desk/${n}.jpg`,
        opts.moderationState ?? 'clean',
        opts.consentToPublic ?? true,
        opts.hidden ? new Date().toISOString() : null,
      ],
    );
    captureId = cap.rows[0]!.capture_id;

    if (opts.taggedGuestOptedOut) {
      const shy = await db.query<{ guest_id: string }>(
        `INSERT INTO public.guests
           (event_id, first_name, last_name, side, group_category, role, rsvp_status,
            meal_preference, invited_to_blocks, entry_source, photo_consent)
         VALUES ($1, $2, 'Shy', 'both', 'other', 'guest', 'pending',
                 'no_preference', ARRAY['ceremony'], 'host_seeded', false)
         RETURNING guest_id`,
        [eventId, `Shy${n}`],
      );
      await db.query(
        `INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
         VALUES ($1, 'papic_guest_captures', $2, $3, 'manual_pick')`,
        [eventId, captureId, shy.rows[0]!.guest_id],
      );
    }
  }

  const completion = await db.query<{ completion_id: string }>(
    `INSERT INTO public.papic_mission_completions
       (mission_id, event_id, guest_id, capture_id, consent_to_share)
     VALUES ($1, $2, $3, $4, $5) RETURNING completion_id`,
    [missionId, eventId, shooterId, captureId, opts.consentToShare ?? true],
  );
  return { eventId, completionId: completion.rows[0]!.completion_id };
}

const accept = (completionId: string) =>
  db.query(`UPDATE public.papic_mission_completions SET status = 'approved' WHERE completion_id = $1`, [
    completionId,
  ]);

/* ── ANTI-VACUITY: the happy path must actually work ───────────────────────── */

test('a clean, consented, untagged answer CAN be accepted', async () => {
  // 🔑 WITHOUT THIS TEST EVERY REFUSAL BELOW IS MEANINGLESS. A trigger that
  // refuses EVERYTHING would pass all six of them, and the host would be unable
  // to accept anything at all — a desk that only ever says no.
  const { completionId } = await seed({});
  await accept(completionId);
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.papic_mission_completions WHERE completion_id = $1`,
    [completionId],
  );
  assert.equal(r.rows[0]!.status, 'approved');
});

test('the column is born pending — accept is the only way anything enters', async () => {
  const { completionId } = await seed({});
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.papic_mission_completions WHERE completion_id = $1`,
    [completionId],
  );
  assert.equal(
    r.rows[0]!.status,
    'pending',
    'a freshly written answer defaults to something other than pending — it ' +
      'would publish itself without the host ever being asked',
  );
});

/* ── THE REFUSALS ─────────────────────────────────────────────────────────── */

test('a capture showing a guest who opted out of photos CANNOT be accepted', async () => {
  // The ruling this enforces: *a capture's veto BEATS the host's curation.*
  const { completionId } = await seed({ taggedGuestOptedOut: true });
  await assert.rejects(() => accept(completionId), /desk:held_back/);
});

test('an unscreened capture cannot be accepted', async () => {
  const { completionId } = await seed({ moderationState: 'unscreened' });
  await assert.rejects(() => accept(completionId), /desk:held_back/);
});

test('a capture the guest withdrew from public view cannot be accepted', async () => {
  const withdrawn = await seed({ consentToPublic: false });
  await assert.rejects(() => accept(withdrawn.completionId), /desk:held_back/);
  const hidden = await seed({ hidden: true });
  await assert.rejects(() => accept(hidden.completionId), /desk:held_back/);
});

test('an answer with no capture at all cannot be accepted', async () => {
  const { completionId } = await seed({ captureMissing: true });
  await assert.rejects(() => accept(completionId), /desk:no_capture/);
});

/* ── THE REFUSAL IS A REFUSAL, NOT A SILENT NO-OP ──────────────────────────── */

test('a refused acceptance leaves the row exactly as it was', async () => {
  /*
    ⚠ THE MISTAKE THIS RULES OUT. An RLS refusal updates zero rows and throws
    nothing; a PIN trigger overwrites rather than refusing. Either would let
    "the write did not take" and "the write was refused" look the same to a
    reader of this file — so the state is read back explicitly.
  */
  const { completionId } = await seed({ taggedGuestOptedOut: true });
  await assert.rejects(() => accept(completionId));
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.papic_mission_completions WHERE completion_id = $1`,
    [completionId],
  );
  assert.equal(r.rows[0]!.status, 'pending', 'the refused write moved the row anyway');
});

test('a held-back answer can still be REJECTED and un-decided — it is never stranded', async () => {
  /*
    The trigger refuses only the transition to 'approved'. If it refused every
    write, a veto arriving after an acceptance would leave a row the host could
    not move at all, and the desk would never reach 100%.
  */
  const { completionId } = await seed({ taggedGuestOptedOut: true });
  await db.query(
    `UPDATE public.papic_mission_completions SET status = 'rejected' WHERE completion_id = $1`,
    [completionId],
  );
  await db.query(
    `UPDATE public.papic_mission_completions SET status = 'pending' WHERE completion_id = $1`,
    [completionId],
  );
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.papic_mission_completions WHERE completion_id = $1`,
    [completionId],
  );
  assert.equal(r.rows[0]!.status, 'pending');
});

test('a supplier frame cannot be accepted until the screen settles', async () => {
  // The vendor half of the same rule — a CHECK rather than a trigger, because
  // both columns sit on the same row.
  n += 1;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Desk vendor ${n}', 'birthday', CURRENT_DATE - 1) RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name) VALUES ($1) RETURNING vendor_profile_id`,
    [`Goldenhour ${n}`],
  );
  const mk = async (state: string) => {
    const r = await db.query<{ media_id: string }>(
      `INSERT INTO public.editorial_vendor_media
         (event_id, vendor_profile_id, media_type, still_r2_key, moderation_state)
       VALUES ($1, $2, 'photo', $3, $4) RETURNING media_id`,
      [eventId, vp.rows[0]!.vendor_profile_id, `r2://v/${n}-${state}.jpg`, state],
    );
    return r.rows[0]!.media_id;
  };

  const unscreened = await mk('unscreened');
  await assert.rejects(
    () => db.query(`UPDATE public.editorial_vendor_media SET status='approved' WHERE media_id=$1`, [unscreened]),
    /evm_approved_needs_screen/,
  );

  const blocked = await mk('nsfw_blocked');
  await assert.rejects(
    () => db.query(`UPDATE public.editorial_vendor_media SET status='approved' WHERE media_id=$1`, [blocked]),
    /evm_approved_needs_screen/,
  );

  // …and the anti-vacuity half: a clean one goes through.
  const clean = await mk('clean');
  await db.query(`UPDATE public.editorial_vendor_media SET status='approved' WHERE media_id=$1`, [clean]);
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.editorial_vendor_media WHERE media_id=$1`,
    [clean],
  );
  assert.equal(r.rows[0]!.status, 'approved');
});

test('a supplier submission is born pending, not shown', async () => {
  n += 1;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Desk vendor default ${n}', 'birthday', CURRENT_DATE - 1) RETURNING event_id`,
  );
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name) VALUES ($1) RETURNING vendor_profile_id`,
    [`Longtable ${n}`],
  );
  const r = await db.query<{ status: string; hidden_by_couple: boolean }>(
    `INSERT INTO public.editorial_vendor_media
       (event_id, vendor_profile_id, media_type, still_r2_key)
     VALUES ($1, $2, 'photo', $3) RETURNING status, hidden_by_couple`,
    [ev.rows[0]!.event_id, vp.rows[0]!.vendor_profile_id, `r2://v/${n}.jpg`],
  );
  assert.equal(
    r.rows[0]!.status,
    'pending',
    'a supplier submission defaults to something other than pending — the ' +
      'opt-out model this column exists to replace',
  );
  // And the old lever still reads its old way: this migration did not write it.
  assert.equal(r.rows[0]!.hidden_by_couple, false);
});

/**
 * THE SUPPLIER KEEPS THE NOTE. IT STOPS BEING A FILE ON A PERSON.
 *
 * Owner, 2026-08-24: the supplier keeps the note, but it stops being filed under
 * that person's name. They keep their working history.
 *
 * `vendor_client_notes` is the supplier's own CRM — 2,000 characters a row,
 * readable by nobody else including Setnayan. It is unambiguously their business
 * record, so "vendor data stays" reaches it. But its SUBJECT is the couple, who
 * have just asked to be forgotten. The ruling threads that needle: the working
 * history survives; the file on a named person does not.
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
  await db?.close();
});

async function seed(tag: string, opts: { remind?: boolean } = {}) {
  const vu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`note-vendor-${tag}@example.com`],
  );
  const vendorUserId = vu.rows[0]!.id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Note Keep Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [vendorUserId],
  );
  const vendorProfileId = vp.rows[0]!.vendor_profile_id;

  const cu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`note-couple-${tag}@example.com`],
  );
  const coupleUserId = cu.rows[0]!.id;

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Note Keep Day','birthday') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUserId],
  );

  const n = await db.query<{ note_id: string }>(
    `INSERT INTO public.vendor_client_notes
       (vendor_profile_id, event_id, author_user_id, body, remind_at)
     VALUES ($1,$2,$3,'Bring the long lens; the hall is dark at the back.', $4)
     RETURNING note_id`,
    [vendorProfileId, eventId, vendorUserId, opts.remind ? '2027-01-15' : null],
  );
  return { vendorProfileId, vendorUserId, eventId, noteId: n.rows[0]!.note_id };
}

async function readNote(noteId: string) {
  const r = await db.query<{
    event_id: string | null;
    body: string | null;
    remind_at: string | null;
  }>(
    `SELECT event_id, body, remind_at FROM public.vendor_client_notes WHERE note_id = $1`,
    [noteId],
  );
  return r.rows[0] ?? null;
}

test('the supplier keeps what they wrote', async () => {
  const s = await seed('keeps');
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const after = await readNote(s.noteId);
  assert.ok(after, 'THE REGRESSION: the supplier’s own working note was destroyed');
  assert.equal(
    after.body,
    'Bring the long lens; the hall is dark at the back.',
    'and it keeps the words — this is the supplier’s business record',
  );
});

test('and it stops being filed under that person', async () => {
  const s = await seed('unfiled');
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const after = await readNote(s.noteId);
  assert.equal(
    after?.event_id,
    null,
    'the celebration is the ONLY thing that made this "their file" — the note ' +
      'carries no name, no contact and no user id of its own',
  );
});

test('a follow-up reminder about a person who left does NOT survive', async () => {
  // "Chase the down-payment on the 15th" is a file on a named person that acts
  // on its own schedule. There is nobody to chase.
  const s = await seed('remind', { remind: true });
  assert.ok((await readNote(s.noteId))?.remind_at, 'precondition: the reminder is set');

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const after = await readNote(s.noteId);
  assert.equal(after?.remind_at, null, 'the reminder must be cleared at severance');
  assert.ok(after?.body, 'while the words the supplier wrote are untouched');
});

test('a kept note is still fully the supplier’s — readable, editable, deletable', async () => {
  // The RLS policy keys on the vendor org, NOT the event, so severing must not
  // quietly strand the row beyond its owner's reach.
  const s = await seed('rls');
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const pol = await db.query<{ using_expr: string | null }>(
    `SELECT pg_get_expr(polqual, polrelid) AS using_expr
       FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='vendor_client_notes'`,
  );
  assert.ok(pol.rows.length > 0, 'the org policy must still exist');
  for (const row of pol.rows) {
    assert.ok(
      !/event_id/.test(row.using_expr ?? ''),
      'the policy must not key on the event, or every kept note becomes unreachable',
    );
  }
});

test('the note is NOT reachable from the per-event Customer Card any more', async () => {
  // The boundary in the other direction: "unfiled" has to mean unfiled.
  const s = await seed('boundary');
  const eventId = s.eventId;
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  const byEvent = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_client_notes
      WHERE vendor_profile_id = $1 AND event_id = $2`,
    [s.vendorProfileId, eventId],
  );
  assert.equal(byEvent.rows[0]!.n, 0, 'nothing may still answer to that person’s celebration');

  const unfiled = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_client_notes
      WHERE vendor_profile_id = $1 AND event_id IS NULL`,
    [s.vendorProfileId],
  );
  assert.equal(unfiled.rows[0]!.n, 1, 'and the supplier’s history is where the new surface reads');
});

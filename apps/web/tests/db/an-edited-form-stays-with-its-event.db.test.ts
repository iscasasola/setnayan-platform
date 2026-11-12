/**
 * 📋 AN EDITED FORM STAYS WITH ITS EVENT — Piece 3a (DECISION_LOG 2026-11-12 "A FORM IS VIEWED BEFORE IT IS EDITED OR
 * SENT; AN EDIT SAVES A NEW FORM" + "FILES · HUB · FORMS DESIGN APPROVED" call 3), walked in SQL as each person under
 * RLS. Covers migration 20271340142149_an_edited_form_stays_with_its_event.
 *
 *   1. every pre-3a form is a library form (in_library TRUE, no event) — nothing shipped moved;
 *   2. an edit saves a NEW row for the event; the original is untouched;
 *   3. an event-only form is sent ONLY into its own event — the on-booking service-role lane included;
 *   4. an event-only form links to no service card (a linked form sends itself into OTHER events on booking);
 *   5. a library form never drops out by in_library → FALSE (retire is the way out); "Save to my library" flips it on;
 *   6. a form is made only for an event the shop talks to, and edited only from the shop's OWN form;
 *   7. an unsent event-only form is never read by the couple; once sent, it is.
 *   8. no cap: a shop keeps any number of forms with one event.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function asUser(uid: string): Promise<void> {
  await asOwner();
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function signUp(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}
async function shopOf(uid: string): Promise<string> {
  await asOwner();
  const r = await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid]);
  return r.rows[0]!.v;
}
async function tryAs(uid: string, sql: string, params: unknown[] = []): Promise<string> {
  await asUser(uid);
  const out = await db.query(sql, params).then(
    () => 'ok',
    (e: Error) => `refused: ${e.message}`,
  );
  await asOwner();
  return out;
}
async function tryAsOwner(sql: string, params: unknown[] = []): Promise<string> {
  await asOwner();
  return db.query(sql, params).then(
    () => 'ok',
    (e: Error) => `refused: ${e.message}`,
  );
}

const F = { host: '', supplier: '', shop: '', rival: '', rivalShop: '', ev: '', other: '', card: '', original: '', edited: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.host = await signUp('host@forms-3a.test', 'customer');
  F.supplier = await signUp('rosa@forms-3a.test', 'vendor');
  F.rival = await signUp('rival@forms-3a.test', 'vendor');
  F.shop = await shopOf(F.supplier);
  F.rivalShop = await shopOf(F.rival);
  await asOwner();
  const mkEvent = async (name: string) =>
    (
      await db.query<{ e: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
         VALUES ($1, 'wedding', 'catholic', 'banquet_hall', DATE '2027-03-20') RETURNING event_id AS e`,
        [name],
      )
    ).rows[0]!.e;
  F.ev = await mkEvent('Ana & Miguel');
  F.other = await mkEvent('Cara & Dan');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.ev, F.host]);
  // Rosa talks to BOTH couples; the rival talks to Ana & Miguel only.
  for (const ev of [F.ev, F.other]) {
    await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`, [ev, F.shop, F.supplier]);
  }
  await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`, [F.ev, F.rivalShop, F.rival]);
  F.card = (
    await db.query<{ s: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active) VALUES ($1, 'catering', 'Garden buffet', FALSE) RETURNING vendor_service_id AS s`,
      [F.shop],
    )
  ).rows[0]!.s;
  await asUser(F.supplier);
  F.original = (
    await db.query<{ f: string }>(`INSERT INTO public.vendor_forms (vendor_profile_id, title) VALUES ($1, 'Any allergies at the table?') RETURNING form_id AS f`, [F.shop])
  ).rows[0]!.f;
  await db.query(
    `INSERT INTO public.vendor_questions (vendor_profile_id, form_id, prompt, answer_type, display_order) VALUES ($1, $2, 'Any allergies?', 'short_answer', 0)`,
    [F.shop, F.original],
  );
  await asOwner();
});
after(async () => {
  await db?.close();
});

test('1 · a plain form is a library form: in_library TRUE, no event, edited from nothing', async () => {
  await asOwner();
  const r = await db.query<{ in_library: boolean; for_event_id: string | null; edited_from_form_id: string | null }>(
    `SELECT in_library, for_event_id, edited_from_form_id FROM public.vendor_forms WHERE form_id = $1`,
    [F.original],
  );
  assert.deepEqual(r.rows[0], { in_library: true, for_event_id: null, edited_from_form_id: null });
});

test('2 · an edit saves a NEW form with the event; the original is untouched', async () => {
  await asUser(F.supplier);
  F.edited = (
    await db.query<{ f: string }>(
      `INSERT INTO public.vendor_forms (vendor_profile_id, title, for_event_id, edited_from_form_id, in_library)
       VALUES ($1, 'Any allergies at the table? · for Ana & Miguel', $2, $3, FALSE) RETURNING form_id AS f`,
      [F.shop, F.ev, F.original],
    )
  ).rows[0]!.f;
  await asOwner();
  assert.notEqual(F.edited, F.original);
  const orig = await db.query<{ title: string }>(`SELECT title FROM public.vendor_forms WHERE form_id = $1`, [F.original]);
  assert.equal(orig.rows[0]!.title, 'Any allergies at the table?', 'the edit rewrote the library original');
  assert.match(
    await tryAs(F.supplier, `INSERT INTO public.vendor_forms (vendor_profile_id, title, in_library) VALUES ($1, 'loose', FALSE)`, [F.shop]),
    /^refused/,
    'a form kept out of the library with no event was stored (it could never be found again)',
  );
});

test('3 · an event-only form is sent only into its own event — for the supplier AND the booking lane', async () => {
  assert.equal(
    await tryAs(
      F.supplier,
      `INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, sent_by) VALUES ($1, $2, $3, 'supplier')`,
      [F.ev, F.edited, F.shop],
    ),
    'ok',
  );
  assert.match(
    await tryAs(
      F.supplier,
      `INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, sent_by) VALUES ($1, $2, $3, 'supplier')`,
      [F.other, F.edited, F.shop],
    ),
    /^refused/,
    'Ana & Miguel’s form was sent to another couple',
  );
  assert.match(
    await tryAsOwner(
      `INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, sent_by) VALUES ($1, $2, $3, 'on_booking')`,
      [F.other, F.edited, F.shop],
    ),
    /^refused/,
    'the booking lane sent an event-only form to another couple',
  );
  // A library form still goes anywhere the shop talks to.
  assert.equal(
    await tryAs(
      F.supplier,
      `INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, sent_by) VALUES ($1, $2, $3, 'supplier')`,
      [F.other, F.original, F.shop],
    ),
    'ok',
  );
});

test('4 · an event-only form links to no service card', async () => {
  assert.match(
    await tryAs(F.supplier, `INSERT INTO public.vendor_form_service_links (form_id, vendor_service_id) VALUES ($1, $2)`, [F.edited, F.card]),
    /^refused/,
    'an event-only form was linked to a card — it would send itself into other couples’ events on booking',
  );
  assert.equal(
    await tryAs(F.supplier, `INSERT INTO public.vendor_form_service_links (form_id, vendor_service_id) VALUES ($1, $2)`, [F.original, F.card]),
    'ok',
  );
});

test('5 · a library form never drops out by in_library → FALSE; "Save to my library" turns it on', async () => {
  assert.match(
    await tryAs(F.supplier, `UPDATE public.vendor_forms SET in_library = FALSE, for_event_id = $2 WHERE form_id = $1`, [F.original, F.ev]),
    /^refused/,
    'a linked, sent library form was hidden from the library',
  );
  assert.equal(await tryAs(F.supplier, `UPDATE public.vendor_forms SET in_library = TRUE WHERE form_id = $1`, [F.edited]), 'ok');
  await asOwner();
  const r = await db.query<{ in_library: boolean; for_event_id: string }>(`SELECT in_library, for_event_id FROM public.vendor_forms WHERE form_id = $1`, [F.edited]);
  assert.deepEqual(r.rows[0], { in_library: true, for_event_id: F.ev }, 'saved to the library, still with its event');
});

test('6 · made only for an event the shop talks to; edited only from the shop’s own form', async () => {
  assert.match(
    await tryAs(
      F.rival,
      `INSERT INTO public.vendor_forms (vendor_profile_id, title, for_event_id, in_library) VALUES ($1, 'x', $2, FALSE)`,
      [F.rivalShop, F.other],
    ),
    /^refused/,
    'a form was made for an event the shop never talked to',
  );
  assert.match(
    await tryAs(
      F.rival,
      `INSERT INTO public.vendor_forms (vendor_profile_id, title, for_event_id, edited_from_form_id, in_library) VALUES ($1, 'x', $2, $3, FALSE)`,
      [F.rivalShop, F.ev, F.original],
    ),
    /^refused/,
    'a shop “edited” another shop’s form',
  );
});

test('7 · the couple reads an event-only form only once it was sent into their event', async () => {
  await asUser(F.supplier);
  const unsent = (
    await db.query<{ f: string }>(
      `INSERT INTO public.vendor_forms (vendor_profile_id, title, for_event_id, edited_from_form_id, in_library)
       VALUES ($1, 'Where do we set up? · for Ana & Miguel', $2, $3, FALSE) RETURNING form_id AS f`,
      [F.shop, F.ev, F.original],
    )
  ).rows[0]!.f;
  await asUser(F.host);
  const seen = await db.query<{ form_id: string }>(`SELECT form_id FROM public.vendor_forms WHERE form_id = ANY($1::uuid[])`, [[unsent, F.edited]]);
  await asOwner();
  assert.deepEqual(seen.rows.map((r) => r.form_id), [F.edited], 'the couple read a form that was never sent to them');
});

test('8 · no cap per event — ten event-only forms for one couple all save', async () => {
  await asUser(F.supplier);
  for (let i = 0; i < 10; i++) {
    await db.query(
      `INSERT INTO public.vendor_forms (vendor_profile_id, title, for_event_id, edited_from_form_id, in_library) VALUES ($1, $2, $3, $4, FALSE)`,
      [F.shop, `Form ${i} · for Ana & Miguel`, F.ev, F.original],
    );
  }
  const n = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_forms WHERE for_event_id = $1`, [F.ev]);
  await asOwner();
  assert.ok(n.rows[0]!.n >= 12);
});

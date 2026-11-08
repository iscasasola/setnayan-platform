/**
 * 📋 A FORM REACHES ONLY ITS EVENT — the Form Maker's schema walked in SQL, as each person, under RLS.
 *
 * Covers 20271325118550_a_shop_keeps_a_library_of_forms (THE ONE BUILD §5.5 / §9 #13; DECISION_LOG 2026-10-28
 * "THE FORM MAKER IS APPROVED"). The library EXTENDS the shipped "Questions for the couple" tables — no parallel
 * storage — so the walk proves both halves:
 *
 *   1. the shipped set is untouched: its rows read form_id NULL, item_kind 'question', answer_type 'long_answer';
 *      a media item or a link can never join the shipped set;
 *   2. a shop's items and links stay in that shop (same-shop triggers);
 *   3. a supplier sends only its OWN live form, only into an event it talks to, and never as 'on_booking'
 *      (that lane is the service role's — `sendLinkedFormsForBooking`);
 *   4. the couple reads a form only once it was sent into their event, and answers its items;
 *   5. the supplier reads answers only to its OWN items of a form sent into THAT event — never another shop's;
 *   6. the auto-send is idempotent (one row per event × form) and a sent form cannot be deleted;
 *   7. templates + suggestions: anyone signed in reads, nobody but the service role writes; they ship EMPTY.
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
async function asServer(): Promise<void> {
  await asOwner();
  await setAuthRole('service_role');
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
/** Run as `uid`; 'ok' or 'refused: <message>'. */
async function tryAs(uid: string, sql: string, params: unknown[] = []): Promise<string> {
  await asUser(uid);
  const out = await db.query(sql, params).then(
    () => 'ok',
    (e: Error) => `refused: ${e.message}`,
  );
  await asOwner();
  return out;
}
async function countAs(uid: string, sql: string, params: unknown[] = []): Promise<number> {
  await asUser(uid);
  const r = await db.query<{ n: number }>(sql, params);
  await asOwner();
  return r.rows[0]!.n;
}

const F = {
  host: '',
  eventId: '',
  otherEventId: '',
  photog: '',
  photogShop: '',
  rival: '',
  rivalShop: '',
  card: '',
  rivalCard: '',
  form: '',
  rivalForm: '',
  item: '',
  rivalItem: '',
  setQuestion: '',
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.host = await signUp('host@forms-e2e.test', 'customer');
  F.photog = await signUp('photog@forms-e2e.test', 'vendor');
  F.rival = await signUp('rival@forms-e2e.test', 'vendor');
  F.photogShop = await shopOf(F.photog);
  F.rivalShop = await shopOf(F.rival);
  assert.ok(F.photogShop && F.rivalShop, 'a vendor sign-up must create its shop');

  await asOwner();
  const mkEvent = async (name: string) =>
    (
      await db.query<{ e: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
         VALUES ($1, 'wedding', 'catholic', 'banquet_hall', DATE '2027-03-20') RETURNING event_id AS e`,
        [name],
      )
    ).rows[0]!.e;
  F.eventId = await mkEvent('Ana & Ben');
  F.otherEventId = await mkEvent('Cara & Dan');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.eventId, F.host]);
  // Both shops talk to Ana & Ben; nobody talks to Cara & Dan.
  for (const [shop, uid] of [
    [F.photogShop, F.photog],
    [F.rivalShop, F.rival],
  ] as const) {
    await db.query(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`,
      [F.eventId, shop, uid],
    );
  }
  F.card = (
    await db.query<{ s: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active) VALUES ($1, 'photography', 'Photo card', FALSE) RETURNING vendor_service_id AS s`,
      [F.photogShop],
    )
  ).rows[0]!.s;
  F.rivalCard = (
    await db.query<{ s: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active) VALUES ($1, 'videography', 'Video card', FALSE) RETURNING vendor_service_id AS s`,
      [F.rivalShop],
    )
  ).rows[0]!.s;
  // The shipped set, written the shipped way (no new columns named).
  F.setQuestion = (
    await db.query<{ q: string }>(
      `INSERT INTO public.vendor_questions (vendor_profile_id, prompt) VALUES ($1, 'How do you say your names?') RETURNING question_id AS q`,
      [F.photogShop],
    )
  ).rows[0]!.q;
});
after(async () => {
  await db?.close();
});

test('1 · the shipped set is untouched: form_id NULL, a long-answer text question', async () => {
  await asOwner();
  const r = await db.query<{ form_id: string | null; item_kind: string; answer_type: string; is_required: boolean }>(
    `SELECT form_id, item_kind, answer_type, is_required FROM public.vendor_questions WHERE question_id = $1`,
    [F.setQuestion],
  );
  assert.deepEqual(r.rows[0], { form_id: null, item_kind: 'question', answer_type: 'long_answer', is_required: false });
  const media = await tryAs(
    F.photog,
    `INSERT INTO public.vendor_questions (vendor_profile_id, prompt, item_kind, media_keys) VALUES ($1, 'Our sample', 'media', ARRAY['k1'])`,
    [F.photogShop],
  );
  assert.match(media, /^refused/, 'a media item joined the shipped "Questions for the couple" set');
});

test('2 · a shop builds a form: title, items of every kind, a card link — all inside its own shop', async () => {
  await asUser(F.photog);
  F.form = (
    await db.query<{ f: string }>(
      `INSERT INTO public.vendor_forms (vendor_profile_id, title) VALUES ($1, 'Shot list') RETURNING form_id AS f`,
      [F.photogShop],
    )
  ).rows[0]!.f;
  F.item = (
    await db.query<{ q: string }>(
      `INSERT INTO public.vendor_questions (vendor_profile_id, form_id, prompt, answer_type, is_required, options, display_order)
       VALUES ($1, $2, 'Which moments matter most?', 'checkboxes', true, ARRAY['First kiss','Entrance'], 0) RETURNING question_id AS q`,
      [F.photogShop, F.form],
    )
  ).rows[0]!.q;
  await db.query(
    `INSERT INTO public.vendor_questions (vendor_profile_id, form_id, prompt, item_kind, video_url, display_order)
     VALUES ($1, $2, 'How we shoot', 'video_link', 'https://youtu.be/abc', 1)`,
    [F.photogShop, F.form],
  );
  await db.query(`INSERT INTO public.vendor_form_service_links (form_id, vendor_service_id) VALUES ($1, $2)`, [F.form, F.card]);
  await asOwner();

  // Shape: a choice question needs its choices; a link must be https.
  assert.match(
    await tryAs(
      F.photog,
      `INSERT INTO public.vendor_questions (vendor_profile_id, form_id, prompt, answer_type) VALUES ($1, $2, 'Pick one', 'dropdown')`,
      [F.photogShop, F.form],
    ),
    /^refused/,
    'a dropdown with no choices was stored',
  );
  assert.match(
    await tryAs(
      F.photog,
      `INSERT INTO public.vendor_questions (vendor_profile_id, form_id, prompt, item_kind, video_url) VALUES ($1, $2, 'x', 'video_link', 'javascript:alert(1)')`,
      [F.photogShop, F.form],
    ),
    /^refused/,
    'a non-https video link was stored',
  );
  assert.match(
    await tryAs(
      F.photog,
      `INSERT INTO public.vendor_questions (vendor_profile_id, form_id, prompt, answer_type) VALUES ($1, $2, 'Upload', 'photo_upload')`,
      [F.photogShop, F.form],
    ),
    /^refused/,
    'photo-upload answers are OUT of this build (text answers only)',
  );

  // The rival builds its own form…
  await asUser(F.rival);
  F.rivalForm = (
    await db.query<{ f: string }>(
      `INSERT INTO public.vendor_forms (vendor_profile_id, title) VALUES ($1, 'Rival brief') RETURNING form_id AS f`,
      [F.rivalShop],
    )
  ).rows[0]!.f;
  F.rivalItem = (
    await db.query<{ q: string }>(
      `INSERT INTO public.vendor_questions (vendor_profile_id, form_id, prompt, answer_type) VALUES ($1, $2, 'Budget?', 'number') RETURNING question_id AS q`,
      [F.rivalShop, F.rivalForm],
    )
  ).rows[0]!.q;
  await asOwner();
  // …and can neither put an item in the photographer's form, nor link the photographer's card, nor read its form.
  assert.match(
    await tryAs(
      F.rival,
      `INSERT INTO public.vendor_questions (vendor_profile_id, form_id, prompt) VALUES ($1, $2, 'sneak')`,
      [F.rivalShop, F.form],
    ),
    /^refused/,
  );
  assert.match(
    await tryAs(F.rival, `INSERT INTO public.vendor_form_service_links (form_id, vendor_service_id) VALUES ($1, $2)`, [
      F.rivalForm,
      F.card,
    ]),
    /^refused/,
    'a form linked to another shop’s card',
  );
  assert.equal(await countAs(F.rival, `SELECT count(*)::int AS n FROM public.vendor_forms WHERE form_id = $1`, [F.form]), 0);
});

test('3 · a supplier sends only its own live form, only into an event it talks to, never as on_booking', async () => {
  // Not into a stranger's event.
  assert.match(
    await tryAs(
      F.photog,
      `INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, sent_by) VALUES ($1, $2, $3, 'supplier')`,
      [F.otherEventId, F.form, F.photogShop],
    ),
    /^refused/,
  );
  // Not another shop's form.
  assert.match(
    await tryAs(
      F.rival,
      `INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, sent_by) VALUES ($1, $2, $3, 'supplier')`,
      [F.eventId, F.form, F.rivalShop],
    ),
    /^refused/,
  );
  // Not dressed up as the booking moment.
  assert.match(
    await tryAs(
      F.photog,
      `INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, sent_by) VALUES ($1, $2, $3, 'on_booking')`,
      [F.eventId, F.form, F.photogShop],
    ),
    /^refused/,
  );
  // The real send.
  assert.equal(
    await tryAs(
      F.photog,
      `INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, sent_by) VALUES ($1, $2, $3, 'supplier')`,
      [F.eventId, F.form, F.photogShop],
    ),
    'ok',
  );
});

test('4 · the couple reads a form only once it was sent, and answers its item', async () => {
  assert.equal(await countAs(F.host, `SELECT count(*)::int AS n FROM public.vendor_forms WHERE form_id = $1`, [F.form]), 1);
  assert.equal(
    await countAs(F.host, `SELECT count(*)::int AS n FROM public.vendor_forms WHERE form_id = $1`, [F.rivalForm]),
    0,
    'the couple read a form nobody sent them',
  );
  assert.equal(
    await tryAs(F.host, `INSERT INTO public.event_question_answers (event_id, question_id, answer) VALUES ($1, $2, 'First kiss')`, [
      F.eventId,
      F.item,
    ]),
    'ok',
  );
  // The rival's item, answered too (couple lane covers any question on their event) — the rival must not read it
  // until the rival SENDS its form.
  assert.equal(
    await tryAs(F.host, `INSERT INTO public.event_question_answers (event_id, question_id, answer) VALUES ($1, $2, '50000')`, [
      F.eventId,
      F.rivalItem,
    ]),
    'ok',
  );
});

test('5 · a supplier reads answers only to its own items of a form sent into THAT event', async () => {
  assert.equal(
    await countAs(F.photog, `SELECT count(*)::int AS n FROM public.event_question_answers WHERE event_id = $1`, [F.eventId]),
    1,
    'the photographer reads exactly its own sent item',
  );
  assert.equal(
    await countAs(F.rival, `SELECT count(*)::int AS n FROM public.event_question_answers WHERE event_id = $1`, [F.eventId]),
    0,
    'a form never sent opens no answers — and never another shop’s',
  );
});

test('6 · the booking moment sends once; a sent form cannot be deleted', async () => {
  await asServer();
  const send = `INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, sent_by)
                VALUES ($1, $2, $3, 'on_booking') ON CONFLICT (event_id, form_id) DO NOTHING`;
  await db.query(send, [F.eventId, F.rivalForm, F.rivalShop]);
  await db.query(send, [F.eventId, F.rivalForm, F.rivalShop]);
  const n = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_form_sends WHERE event_id = $1 AND form_id = $2`, [
    F.eventId,
    F.rivalForm,
  ]);
  assert.equal(n.rows[0]!.n, 1, 'the auto-send is not idempotent');
  await asOwner();
  assert.equal(
    await countAs(F.rival, `SELECT count(*)::int AS n FROM public.event_question_answers WHERE event_id = $1`, [F.eventId]),
    1,
    'once sent, the rival reads its own item’s answer (and only that)',
  );
  // No DELETE grant on a form, and the FK refuses even the owner role while a send remains.
  assert.match(await tryAs(F.photog, `DELETE FROM public.vendor_forms WHERE form_id = $1`, [F.form]), /^refused/);
  const ownerDelete = await db.query(`DELETE FROM public.vendor_forms WHERE form_id = $1`, [F.form]).then(
    () => 'ok',
    () => 'refused',
  );
  assert.equal(ownerDelete, 'refused', 'a sent form was deleted out from under the couple’s answers');
});

test('7 · templates + suggestions: read by anyone signed in, written by nobody in a browser, shipped empty', async () => {
  assert.equal(await countAs(F.photog, `SELECT count(*)::int AS n FROM public.form_templates`), 0, 'a seed was invented');
  assert.equal(await countAs(F.photog, `SELECT count(*)::int AS n FROM public.category_form_suggestions`), 0, 'a seed was invented');
  assert.match(
    await tryAs(F.photog, `INSERT INTO public.form_templates (template_key, title) VALUES ('shot_list', 'Shot list')`),
    /^refused/,
  );
  const anon = await db.query<{ p: boolean }>(`SELECT has_table_privilege('anon', 'public.form_templates', 'SELECT') AS p`);
  assert.equal(anon.rows[0]!.p, false);
  for (const t of ['vendor_forms', 'vendor_form_service_links', 'event_form_sends', 'form_templates', 'category_form_suggestions']) {
    const rls = await db.query<{ on: boolean }>(`SELECT relrowsecurity AS on FROM pg_class WHERE oid = ('public.' || $1)::regclass`, [t]);
    assert.equal(rls.rows[0]!.on, true, `${t}: RLS is off`);
  }
});

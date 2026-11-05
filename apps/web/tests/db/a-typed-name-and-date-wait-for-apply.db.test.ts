/**
 * A TYPED NAME WAITS FOR APPLY; THE DATE SAVES TO THE EVENT — owner 2026-10-01
 * (DECISION_LOG "ELEVEN OWNER ANSWERS" #1, verbatim *"wait for apply"*): names
 * typed in the Maker (the hero's tap-to-type, Details › Your event) are DRAFT
 * until Apply, like every Maker edit. AMENDED for the date only, 2026-11-05
 * (verbatim *"it shouldn't rely on the hub."*): the date is a fact of the
 * event, never drafted, written at once by its one door (`updateEventDate`).
 * Proven against the real schema, as the couple's own `authenticated` session
 * (SET ROLE + JWT claims) — never as the superuser the replay runs as:
 *
 *   1. a SAVE writes the draft row (`event_site_drafts`) and NOTHING else: the
 *      `events` row a guest reads is byte-for-byte what it was — and a date in
 *      the patch never reaches the draft;
 *   2. APPLY writes the drafted names ONCE, through the couple's session (the
 *      column grants and `couple_can_update_event` both let it) — and a second
 *      plan against the new live row has nothing left to write;
 *   2b. a date an OLDER draft still holds is never read, planned or written;
 *   2c. the date's own write lands on `events` at once through the couple's
 *      session, and a guest's session reaches no row;
 *   3. a GUEST of the same event still cannot read the draft.
 *
 * The draft's JSON and Apply's plan are built by the SAME pure functions the
 * server action calls (`mergeHubDraft`, `planHubDraftApply`), so a column that
 * left the draft's allow-list would fail here, not in prod.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { parsePrintDetails, serializePrintDetails } from '../../lib/print-pieces';
import {
  HUB_DRAFT_EVENT_COLUMNS,
  emptyHubDraft,
  mergeHubDraft,
  planHubDraftApply,
  sanitizeHubDraft,
  type HubDraft,
  type HubLiveState,
} from '../../lib/hub-draft';

let replay: ReplayResult;
let db: PGlite;

const F = { couple: '', guest: '', eventId: '' };
const BEFORE = { display_name: 'Ana & Miguel', bride_name: 'Ana Reyes', groom_name: 'Miguel Santos', event_date: '2031-03-13', event_date_precision: 'day' };
const TYPED = { display_name: 'Ana Reyes & Miguel' };
/** 🗓 The day the couple picks — saved to the event at once (owner 2026-11-05). */
const PICKED = { event_date: '2031-04-17', event_date_precision: 'day' };
// As PostgREST hands them back: a date is its ISO text, never a JS Date.
// (`print_details` — the Name style — is proved in its own test below.)
const FACTS = 'display_name, bride_name, groom_name, event_date::text AS event_date, event_date_precision';

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}

/** One statement as `uid`, the couple's own session. Committed — the steps build on each other. */
async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []) {
  try {
    await setAuthUid(db, uid);
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
    await db.exec('SET ROLE authenticated');
    const r = await db.query<T>(sql, params);
    return { err: null as string | null, rows: r.rows, n: r.affectedRows ?? r.rows.length };
  } catch (e) {
    return { err: (e as Error).message, rows: [] as T[], n: 0 };
  } finally {
    await reset();
  }
}

async function liveFacts(): Promise<Record<string, unknown>> {
  const r = await db.query<Record<string, unknown>>(
    `SELECT ${FACTS} FROM public.events WHERE event_id = $1`,
    [F.eventId],
  );
  return r.rows[0]!;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mkUser = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('wait-couple@apply.test');
  F.guest = await mkUser('wait-guest@apply.test');
  F.eventId = (
    await db.query<{ e: string }>(
      // `events_wedding_fields_consistency`: a wedding carries its ceremony and venue setting.
      `INSERT INTO public.events (display_name, bride_name, groom_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ($1, $2, $3, 'wedding', 'catholic', 'garden', $4, $5) RETURNING event_id AS e`,
      [BEFORE.display_name, BEFORE.bride_name, BEFORE.groom_name, BEFORE.event_date, BEFORE.event_date_precision],
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.eventId, F.couple]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [F.eventId, F.guest]);
});

after(async () => {
  await reset();
  await db?.close?.();
});

let draft: HubDraft;

test('anti-vacuity: the row starts as the couple left it', async () => {
  assert.deepEqual(await liveFacts(), BEFORE);
});

test('1 · typing the names SAVES THE DRAFT — the events row is unchanged, and a date never enters the draft', async () => {
  assert.equal((HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes('event_date'), false, 'the date is a draftable column again');
  assert.equal((HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes('event_date_precision'), false);
  draft = mergeHubDraft(emptyHubDraft(), { events: { ...TYPED, ...PICKED } as never });
  assert.deepEqual(draft.events, TYPED, 'the draft holds the names that were typed — and no date');
  // The store's own write: one row per event, upserted.
  const w = await as(
    F.couple,
    `INSERT INTO public.event_site_drafts (event_id, draft_json) VALUES ($1, $2::jsonb)
     ON CONFLICT (event_id) DO UPDATE SET draft_json = EXCLUDED.draft_json RETURNING event_id`,
    [F.eventId, JSON.stringify(draft)],
  );
  assert.equal(w.err, null, w.err ?? '');
  assert.equal(w.n, 1);
  assert.deepEqual(await liveFacts(), BEFORE, 'a draft save reached the live events row');
  // …and a guest of the same event cannot read it.
  const peek = await as(F.guest, `SELECT event_id FROM public.event_site_drafts WHERE event_id = $1`, [F.eventId]);
  assert.equal(peek.rows.length, 0, 'a guest read the couple’s unpublished names');
});

test('2 · APPLY writes the drafted names ONCE, through the couple’s own session', async () => {
  const live = await as<Record<string, unknown>>(F.couple, `SELECT ${FACTS} FROM public.events WHERE event_id = $1`, [F.eventId]);
  assert.equal(live.err, null, live.err ?? '');
  const liveState: HubLiveState = { events: live.rows[0] as HubLiveState['events'], widgets: [] };
  const plan = planHubDraftApply(draft, liveState, false);
  assert.equal(plan.refused.length, 0, 'a name is never Pro');
  const patch: Record<string, unknown> = {};
  for (const item of plan.apply) if (item.kind === 'event') patch[item.column] = item.value;
  assert.deepEqual(Object.keys(patch).sort(), ['display_name'], 'only what differs from live is written — never a date');
  const cols = Object.keys(patch);
  const w = await as(
    F.couple,
    `UPDATE public.events SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE event_id = $1 RETURNING event_id`,
    [F.eventId, ...cols.map((c) => patch[c])],
  );
  assert.equal(w.err, null, `Apply’s session write was refused: ${w.err}`);
  assert.equal(w.n, 1, 'Apply wrote no row — a zero-row UPDATE reads as success');
  assert.deepEqual(await liveFacts(), { ...BEFORE, ...TYPED }, 'the guests now read what was typed');
  // Once: against the new live row the same draft has nothing left to write.
  const again = planHubDraftApply(draft, { events: { ...liveState.events, ...patch }, widgets: [] }, false);
  assert.equal(again.apply.length + again.refused.length, 0, 'Apply would write the same names twice');
});

test('2b · a date an OLDER draft still holds is never read, planned or written', async () => {
  // A draft saved before 2026-11-05 — stored as the old door wrote it, a date at the top and in its history.
  const old = { v: 1, events: { event_date: '2031-09-09', event_date_precision: 'day' }, widgets: {}, history: [{ events: { event_date: '2031-08-08', event_date_precision: 'day' }, widgets: {} }] };
  const w = await as(
    F.couple,
    `INSERT INTO public.event_site_drafts (event_id, draft_json) VALUES ($1, $2::jsonb)
     ON CONFLICT (event_id) DO UPDATE SET draft_json = EXCLUDED.draft_json RETURNING draft_json`,
    [F.eventId, JSON.stringify(old)],
  );
  assert.equal(w.err, null, w.err ?? '');
  const read = sanitizeHubDraft((w.rows[0] as { draft_json: unknown }).draft_json);
  assert.equal('event_date' in read.events, false, 'the reader kept a drafted date');
  assert.equal(read.history.some((h) => 'event_date' in h.events), false, 'Undo could bring a drafted date back');
  const live = await liveFacts();
  const plan = planHubDraftApply(read, { events: live as HubLiveState['events'], widgets: [] }, false);
  assert.equal(plan.apply.length + plan.refused.length, 0, 'Apply would write a stale drafted date over the real one');
  assert.equal(live.event_date, BEFORE.event_date, 'anti-vacuity: the live date is still the couple’s');
});

test('2c · THE DATE SAVES TO THE EVENT AT ONCE — the couple’s own session writes it; a guest’s reaches no row', async () => {
  // `updateEventDate`'s one write (app/dashboard/[eventId]/actions.ts), as the couple's session.
  const write = `UPDATE public.events SET event_date = $2, event_date_precision = $3 WHERE event_id = $1 RETURNING event_id`;
  const guest = await as(F.guest, write, [F.eventId, '2031-06-06', 'day']);
  assert.ok(guest.err !== null || guest.n === 0, 'a guest moved the event’s date');
  const w = await as(F.couple, write, [F.eventId, PICKED.event_date, PICKED.event_date_precision]);
  assert.equal(w.err, null, `the couple’s date write was refused: ${w.err}`);
  assert.equal(w.n, 1, 'the date write reached no row — a zero-row UPDATE reads as success');
  assert.deepEqual(await liveFacts(), { ...BEFORE, ...TYPED, ...PICKED }, 'Home, the suppliers and the Hub now read the picked day — no Apply');
});

test('3 · the NAME STYLE waits for Apply too — a save leaves print_details alone; Apply merges the one key, once', async () => {
  const printDetails = async () => (await db.query<{ p: unknown }>(`SELECT print_details AS p FROM public.events WHERE event_id = $1`, [F.eventId])).rows[0]!.p;
  // The prints' own words are already there — Apply must carry them untouched.
  await db.query(`UPDATE public.events SET print_details = $2::jsonb WHERE event_id = $1`, [
    F.eventId,
    JSON.stringify(serializePrintDetails({ ...parsePrintDetails(await printDetails()), openingLine: 'Together with their families' })),
  ]);
  const before = await printDetails();
  assert.equal(parsePrintDetails(before).nameStyle, 'full', 'anti-vacuity: the style starts as Full');

  /* ⏳ The blob's DRAFTABLE keys are the Name style, the ticket style and — since 2026-10-08, owner "draft 1-3" —
     the opening line. Every other key stays the prints' own: the one sneaked in here is `invite_message`
     (it used to be `opening_line`, which this test pinned as un-draftable until the owner made it wait for Apply). */
  const styled = mergeHubDraft(emptyHubDraft(), { events: { print_details: { name_style: 'surname-first', invite_message: 'SNEAKED IN' } as never } });
  assert.deepEqual(styled.events.print_details, { name_style: 'surname-first' }, 'the draft holds the Name style and no other key of the blob');
  const drafted = mergeHubDraft(emptyHubDraft(), { events: { print_details: { opening_line: 'Kindly join us', menu: 'SNEAKED IN' } as never } });
  assert.deepEqual(drafted.events.print_details, { opening_line: 'Kindly join us' }, 'the opening line waits for Apply; the menu beside it does not ride along');
  const w = await as(
    F.couple,
    `INSERT INTO public.event_site_drafts (event_id, draft_json) VALUES ($1, $2::jsonb)
     ON CONFLICT (event_id) DO UPDATE SET draft_json = EXCLUDED.draft_json RETURNING event_id`,
    [F.eventId, JSON.stringify(styled)],
  );
  assert.equal(w.err, null, w.err ?? '');
  assert.deepEqual(await printDetails(), before, 'picking a Name style reached the live prints setting before Apply');

  // Apply: the plan holds exactly one free change; the write MERGES the style into the blob as it stands.
  const plan = planHubDraftApply(styled, { events: { print_details: before }, widgets: [] }, false);
  assert.equal(plan.refused.length, 0, 'a name style is never Pro');
  assert.deepEqual(plan.apply.map((i) => (i.kind === 'event' ? i.column : i.kind)), ['print_details']);
  const item = plan.apply[0]!;
  const asked = (item as { value: Record<string, unknown> }).value.name_style;
  await db.query(`UPDATE public.events SET print_details = $2::jsonb WHERE event_id = $1`, [
    F.eventId,
    JSON.stringify(serializePrintDetails({ ...parsePrintDetails(await printDetails()), nameStyle: asked as 'surname-first' })),
  ]);
  const after = parsePrintDetails(await printDetails());
  assert.equal(after.nameStyle, 'surname-first', 'the guests and the prints now read the picked style');
  assert.equal(after.openingLine, 'Together with their families', 'Apply left the prints’ other words untouched');
  const again = planHubDraftApply(styled, { events: { print_details: await printDetails() }, widgets: [] }, false);
  assert.equal(again.apply.length + again.refused.length, 0, 'Apply would write the style twice');
});

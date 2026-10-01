/**
 * A TYPED NAME AND DATE WAIT FOR APPLY — owner 2026-10-01 (DECISION_LOG
 * "ELEVEN OWNER ANSWERS" #1, verbatim *"wait for apply"*): names and the date
 * typed in the Maker (the hero's tap-to-type, Details › Your event) are DRAFT
 * until Apply, like every Maker edit. Proven against the real schema, as the
 * couple's own `authenticated` session (SET ROLE + JWT claims) — never as the
 * superuser the replay runs as:
 *
 *   1. a SAVE writes the draft row (`event_site_drafts`) and NOTHING else: the
 *      `events` row a guest reads is byte-for-byte what it was;
 *   2. APPLY writes the drafted columns ONCE, through the couple's session (the
 *      column grants and `couple_can_update_event` both let it) — and a second
 *      plan against the new live row has nothing left to write;
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
import {
  HUB_DRAFT_FACT_COLUMNS,
  emptyHubDraft,
  mergeHubDraft,
  planHubDraftApply,
  type HubDraft,
  type HubLiveState,
} from '../../lib/hub-draft';

let replay: ReplayResult;
let db: PGlite;

const F = { couple: '', guest: '', eventId: '' };
const BEFORE = { display_name: 'Ana & Miguel', bride_name: 'Ana Reyes', groom_name: 'Miguel Santos', event_date: '2031-03-13', event_date_precision: 'day' };
const TYPED = { display_name: 'Ana Reyes & Miguel', event_date: '2031-04-17', event_date_precision: 'day' };
// As PostgREST hands them to Apply: a date is its ISO text, never a JS Date.
const FACTS = HUB_DRAFT_FACT_COLUMNS.map((c) => (c === 'event_date' ? 'event_date::text AS event_date' : c)).join(', ');

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

test('1 · typing the names and a date SAVES THE DRAFT — the events row is unchanged', async () => {
  draft = mergeHubDraft(emptyHubDraft(), { events: TYPED });
  assert.deepEqual(draft.events, TYPED, 'the draft holds what was typed (the allow-list kept every column)');
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

test('2 · APPLY writes the drafted names and date ONCE, through the couple’s own session', async () => {
  const live = await as<Record<string, unknown>>(F.couple, `SELECT ${FACTS} FROM public.events WHERE event_id = $1`, [F.eventId]);
  assert.equal(live.err, null, live.err ?? '');
  const liveState: HubLiveState = { events: live.rows[0] as HubLiveState['events'], widgets: [] };
  const plan = planHubDraftApply(draft, liveState, false);
  assert.equal(plan.refused.length, 0, 'a name or a date is never Pro');
  const patch: Record<string, unknown> = {};
  for (const item of plan.apply) if (item.kind === 'event') patch[item.column] = item.value;
  assert.deepEqual(Object.keys(patch).sort(), ['display_name', 'event_date'], 'only what differs from live is written');
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

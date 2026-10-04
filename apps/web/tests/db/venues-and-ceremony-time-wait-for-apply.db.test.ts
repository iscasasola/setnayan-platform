/**
 * VENUES AND THE CEREMONY TIME WAIT FOR APPLY — owner 2026-10-01 (DECISION_LOG
 * "THE MAKER'S VENUES GET A REAL PIN AND A PICKED CITY" + "NOTHING TAKES EFFECT
 * UNTIL APPLY") and 2026-10-04 ("YES TO ALL" on
 * `prototypes/maker_venues_pin_and_time_2026-10-04_fable.html`). Proven against
 * the real schema, as the couple's own `authenticated` session (SET ROLE + JWT
 * claims) — never as the superuser the replay runs as:
 *
 *   1. typing the venues (names, street addresses, both pins, the city) and a
 *      ceremony time SAVES THE DRAFT and nothing else — the `events` row a
 *      guest reads is byte-for-byte what it was, and no schedule block exists;
 *   2. APPLY writes the venues AND their pins through the couple's session —
 *      the reception pin into `venue_latitude/longitude` (the event's own
 *      location anchor), the ceremony's into its own columns (20271263730696);
 *   3. the ceremony time, applied, CREATES the Ceremony block on the event's
 *      day when the Schedule has none, and MOVES it (its parts with it) when it
 *      has one — through the REAL `placeCeremonyBlock`, as the couple; the
 *      invitation's own read (`ceremonyBlock` · `blockTime`) then prints it;
 *   4. a date that moves takes the ceremony with it;
 *   5. 📅 a date that moves takes THE WHOLE SCHEDULE with it (owner 2026-10-04,
 *      DECISION_LOG "CHANGING THE EVENT DATE MOVES THE WHOLE SCHEDULE") — every
 *      block, every type, parents and parts, by the same number of days, each
 *      keeping its time — through the REAL `moveScheduleWithDate`, as the
 *      couple; pressing Apply again moves nothing; a date that was a month (no
 *      exact day) moves nothing; a stranger's session is refused;
 *   6. 🔒 the move is ALL OR NOTHING and ONCE (`move_event_schedule_with_date`,
 *      20271264726195): a block that refuses leaves every block where it was,
 *      the coordinator's hidden prep moves too, and the same move asked twice
 *      (two racing Applies) shifts the day once; the move is measured from the
 *      day the Schedule STANDS ON (`event_schedule_day_anchor`), so a date sent
 *      back elsewhere never makes a real move be skipped or doubled (12); an
 *      edit delegate may move it, a view delegate and anon may not (13); a
 *      HAND edit of the Schedule forgets the anchor, so the next move measures
 *      from where the host put the blocks — never from a stale record (14).
 *
 * Draft JSON and Apply's plan come from the SAME pure functions the server
 * action calls (`mergeHubDraft`, `planHubDraftApply`).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
// Side effect: installs the `server-only` shim, so the real server module below can be imported.
import './supabase-over-pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import {
  HUB_DRAFT_VENUE_COLUMNS,
  emptyHubDraft,
  mergeHubDraft,
  planHubDraftApply,
  summarizeHubDraft,
  type HubDraft,
  type HubLiveState,
} from '../../lib/hub-draft';
import { blockTime, ceremonyBlock } from '../../lib/print-pieces';
import { exactDayOf, toDatetimeLocalValue } from '../../lib/schedule-datetime-local';

let replay: ReplayResult;
let db: PGlite;
let placeCeremonyBlock: typeof import('../../lib/ceremony-time.server').placeCeremonyBlock;
let readLiveCeremonyTime: typeof import('../../lib/ceremony-time.server').readLiveCeremonyTime;
let moveScheduleWithDate: typeof import('../../lib/ceremony-time.server').moveScheduleWithDate;
let writeHubDraft: typeof import('../../lib/hub-draft-store').writeHubDraft;

const F = { couple: '', eventId: '' };
const DAY = '2031-03-13';
const TYPED = {
  std_film_ceremony_name: 'San Agustín Church',
  ceremony_venue_address: 'General Luna St, Intramuros, Manila',
  ceremony_venue_latitude: 14.5888,
  ceremony_venue_longitude: 120.9755,
  std_film_venue_name: 'Blackbird at the Nielson Tower',
  venue_address: 'Ayala Triangle Gardens, Makati',
  venue_latitude: 14.55412,
  venue_longitude: 121.02451,
  std_film_venue_city: 'Makati',
};
const VENUES = HUB_DRAFT_VENUE_COLUMNS.join(', ');

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}

/** One statement as `uid`, the couple's own session. */
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

/**
 * The supabase-js call shapes `lib/ceremony-time.server.ts` makes, each run as
 * the COUPLE (RLS in force) — `.select().eq()…`, `.insert().select()`,
 * `.update().eq()….select()` and an awaited `.update().eq()`. Errors are
 * returned, never thrown, as supabase-js does. Anything else throws loudly.
 */
function coupleClient(uid: string): SupabaseClient {
  const run = async (sql: string, params: unknown[]) => {
    const r = await as<Record<string, unknown>>(uid, sql, params);
    if (r.err) return { data: null, error: { message: r.err } };
    // PostgREST hands a timestamptz over as ISO text, never a Date.
    const rows = r.rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])));
    return { data: rows, error: null };
  };
  const cols = (c: string) => c.split(',').map((x) => `"${x.trim()}"`).join(', ');
  return {
    /** `supabase.rpc(name, args)` — the function runs as the couple, named arguments. */
    rpc(name: string, args: Record<string, unknown>) {
      const keys = Object.keys(args);
      const sql = `SELECT public."${name}"(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) AS r`;
      return run(sql, keys.map((k) => args[k])).then((res) =>
        res.error ? { data: null, error: res.error } : { data: (res.data as Array<{ r: unknown }>)[0]?.r ?? null, error: null },
      );
    },
    from(table: string) {
      const eqs: Array<[string, unknown]> = [];
      const where = (params: unknown[]) =>
        eqs.length ? ` WHERE ${eqs.map(([c, v]) => (params.push(v), `"${c}" = $${params.length}`)).join(' AND ')}` : '';
      const chain = (build: (params: unknown[]) => string, params: unknown[] = []) => {
        let returning: string | null = null;
        const q = {
          eq(c: string, v: unknown) {
            eqs.push([c, v]);
            return q;
          },
          select(c: string) {
            returning = c;
            return q;
          },
          then(ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) {
            const p = [...params];
            const sql = build(p) + (returning ? ` RETURNING ${cols(returning)}` : '');
            return run(sql, p).then(ok, bad);
          },
        };
        return q;
      };
      return {
        select: (c: string) => {
          const q = {
            eq(col: string, v: unknown) {
              eqs.push([col, v]);
              return q;
            },
            then(ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) {
              const p: unknown[] = [];
              return run(`SELECT ${cols(c)} FROM public."${table}"${where(p)}`, p).then(ok, bad);
            },
          };
          return q;
        },
        insert: (row: Record<string, unknown>) =>
          chain((p) => {
            const keys = Object.keys(row);
            for (const k of keys) p.push(row[k]);
            return `INSERT INTO public."${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`;
          }),
        update: (patch: Record<string, unknown>) =>
          chain((p) => {
            const keys = Object.keys(patch);
            for (const k of keys) p.push(patch[k]);
            return `UPDATE public."${table}" SET ${keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')}${where(p)}`;
          }),
      };
    },
  } as unknown as SupabaseClient;
}

async function liveVenues(): Promise<Record<string, unknown>> {
  return (await db.query<Record<string, unknown>>(`SELECT ${VENUES} FROM public.events WHERE event_id = $1`, [F.eventId])).rows[0]!;
}
async function blocks() {
  return (
    await db.query<{ block_id: string; label: string; block_type: string; start_at: string; end_at: string | null; parent_block_id: string | null }>(
      `SELECT block_id, label, block_type, to_char(start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS start_at,
              to_char(end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS end_at, parent_block_id
         FROM public.event_schedule_blocks WHERE event_id = $1 ORDER BY start_at`,
      [F.eventId],
    )
  ).rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  ({ placeCeremonyBlock, readLiveCeremonyTime, moveScheduleWithDate } = await import('../../lib/ceremony-time.server'));
  ({ writeHubDraft } = await import('../../lib/hub-draft-store'));
  F.couple = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('venues-couple@apply.test', jsonb_build_object('account_type', 'customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  F.eventId = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Ana & Miguel', 'wedding', 'catholic', 'garden', $1, 'day') RETURNING event_id AS e`,
      [DAY],
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.eventId, F.couple]);
});

after(async () => {
  await reset();
  await db?.close?.();
});

let draft: HubDraft;

test('anti-vacuity: no venue typed, no pin, no ceremony — and the couple can read every venue column', async () => {
  const live = await liveVenues();
  for (const c of HUB_DRAFT_VENUE_COLUMNS) assert.equal(live[c], null, `${c} starts empty`);
  assert.deepEqual(await blocks(), []);
  const r = await as(F.couple, `SELECT ${VENUES} FROM public.events WHERE event_id = $1`, [F.eventId]);
  assert.equal(r.err, null, `the couple cannot read a venue column Apply compares: ${r.err}`);
});

test('1 · typing the venues and a ceremony time SAVES THE DRAFT — no events row, no schedule block', async () => {
  draft = mergeHubDraft(emptyHubDraft(), { events: { ...TYPED, ceremony_time: '15:00' } });
  assert.deepEqual(draft.events, { ...TYPED, ceremony_time: '15:00' }, 'the allow-list kept every venue column and the time');
  // The REAL draft store's write (the one `hubDraftAction` intent=save makes), as the couple.
  await writeHubDraft(coupleClient(F.couple) as never, F.eventId, draft);
  const stored = (await db.query<{ d: { events: Record<string, unknown> } }>(`SELECT draft_json AS d FROM public.event_site_drafts WHERE event_id = $1`, [F.eventId])).rows[0];
  assert.equal(stored?.d.events.venue_address, TYPED.venue_address, 'the draft row does not hold the typed venue');
  const live = await liveVenues();
  for (const c of HUB_DRAFT_VENUE_COLUMNS) assert.equal(live[c], null, `typing ${c} reached the live events row before Apply`);
  assert.deepEqual(await blocks(), [], 'a typed ceremony time made a schedule block before Apply');
  // The Apply badge counts the venues ONCE (nine columns) and the time once.
  const liveState: HubLiveState = { events: { ...live, ceremony_time: null } as HubLiveState['events'], widgets: [] };
  assert.equal(summarizeHubDraft(draft, liveState, false).changeCount, 2);
});

test('2 · APPLY writes the venues and both pins through the couple’s own session — the reception pin is the event’s anchor', async () => {
  const live = await as<Record<string, unknown>>(F.couple, `SELECT ${VENUES} FROM public.events WHERE event_id = $1`, [F.eventId]);
  const plan = planHubDraftApply(draft, { events: { ...live.rows[0], ceremony_time: await readLiveCeremonyTime(coupleClient(F.couple), F.eventId) }, widgets: [] }, false);
  assert.equal(plan.refused.length, 0, 'a venue is never Pro');
  const patch: Record<string, unknown> = {};
  for (const item of plan.apply) if (item.kind === 'event' && item.column !== 'ceremony_time') patch[item.column] = item.value;
  assert.deepEqual(Object.keys(patch).sort(), [...HUB_DRAFT_VENUE_COLUMNS].sort(), 'every typed venue column is written');
  const cols = Object.keys(patch);
  const w = await as(
    F.couple,
    `UPDATE public.events SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE event_id = $1 RETURNING event_id`,
    [F.eventId, ...cols.map((c) => patch[c])],
  );
  assert.equal(w.err, null, `Apply’s session write was refused: ${w.err}`);
  assert.equal(w.n, 1, 'Apply wrote no row — a zero-row UPDATE reads as success');
  const after = await liveVenues();
  assert.equal(Number(after.venue_latitude), TYPED.venue_latitude, 'the reception pin did not refresh events.venue_latitude');
  assert.equal(Number(after.venue_longitude), TYPED.venue_longitude);
  assert.equal(Number(after.ceremony_venue_latitude), TYPED.ceremony_venue_latitude, 'the ceremony pin was not written');
  assert.equal(after.std_film_venue_name, TYPED.std_film_venue_name);
  assert.equal(after.std_film_venue_city, 'Makati');
  // Once: "14.5541200" read back is the same pin — nothing left to write.
  const again = planHubDraftApply(draft, { events: { ...after, ceremony_time: '15:00' } as HubLiveState['events'], widgets: [] }, false);
  assert.equal(again.apply.length + again.refused.length, 0, 'Apply would write the same venues twice');
});

test('2b · a half pin is refused by the schema — never stored as half a place', async () => {
  const w = await as(F.couple, `UPDATE public.events SET ceremony_venue_longitude = NULL WHERE event_id = $1 RETURNING event_id`, [F.eventId]);
  assert.match(w.err ?? '', /events_ceremony_venue_pin_pair/);
});

test('3 · the ceremony time CREATES the Ceremony on the event’s day when there is none — and the invitation prints it', async () => {
  const r = await placeCeremonyBlock({ supabase: coupleClient(F.couple), eventId: F.eventId, day: DAY, time: '15:00' });
  assert.deepEqual(r, { ok: true, wrote: 'created' });
  const rows = await blocks();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.block_type, 'ceremony');
  assert.equal(rows[0]!.start_at, `${DAY}T15:00:00.000Z`, 'the wall clock was converted, not kept');
  assert.equal(blockTime(ceremonyBlock(rows)), '3:00 PM', 'the invitation does not read "Ceremony at 3:00 PM"');
  assert.equal(await readLiveCeremonyTime(coupleClient(F.couple), F.eventId), '15:00', 'Apply compares against the block it just made');
});

test('3b · …and MOVES it when there is one — its end and its parts by the same amount, never a second Ceremony', async () => {
  const [c] = await blocks();
  await db.query(`UPDATE public.event_schedule_blocks SET end_at = $2 WHERE block_id = $1`, [c!.block_id, `${DAY}T16:00:00Z`]);
  await db.query(
    `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, parent_block_id) VALUES ($1, 'Sand ceremony', 'custom', $2, $3)`,
    [F.eventId, `${DAY}T15:30:00Z`, c!.block_id],
  );
  const r = await placeCeremonyBlock({ supabase: coupleClient(F.couple), eventId: F.eventId, day: DAY, time: '16:30' });
  assert.deepEqual(r, { ok: true, wrote: 'moved' });
  const rows = await blocks();
  const ceremonies = rows.filter((b) => b.block_type === 'ceremony');
  assert.equal(ceremonies.length, 1, 'a second Ceremony was made instead of moving the first');
  assert.equal(ceremonies[0]!.start_at, `${DAY}T16:30:00.000Z`);
  assert.equal(ceremonies[0]!.end_at, `${DAY}T17:30:00.000Z`, 'the ceremony’s length changed');
  assert.equal(rows.find((b) => b.label === 'Sand ceremony')!.start_at, `${DAY}T17:00:00.000Z`, 'its part did not walk with it');
  assert.equal(blockTime(ceremonyBlock(rows)), '4:30 PM');
});

test('4 · a date that moves takes the ceremony with it — its time kept', async () => {
  const r = await placeCeremonyBlock({ supabase: coupleClient(F.couple), eventId: F.eventId, day: '2031-04-17', time: null, fromDay: DAY });
  assert.deepEqual(r, { ok: true, wrote: 'moved' });
  const c = (await blocks()).find((b) => b.block_type === 'ceremony')!;
  assert.equal(c.start_at, '2031-04-17T16:30:00.000Z');
  // A ceremony the couple put on ANOTHER day stays where they put it.
  const stay = await placeCeremonyBlock({ supabase: coupleClient(F.couple), eventId: F.eventId, day: '2031-05-01', time: null, fromDay: DAY });
  assert.deepEqual(stay, { ok: true, wrote: 'none' });
});

/* ═══════════════════════════════════════════════════════════════════════════
   📅 THE WHOLE SCHEDULE FOLLOWS THE DATE — owner 2026-10-04, verbatim: "Yes if
   possible". Its own event, so the blocks above never blur what moved.
   ═══════════════════════════════════════════════════════════════════════════ */

const D1 = '2031-06-07';
const D2 = '2031-06-21';
const G = { eventId: '', stranger: '' };

async function blocksOf(eventId: string) {
  return (
    await db.query<{ label: string; block_type: string; start_at: string; end_at: string | null; parent: string | null }>(
      `SELECT b.label, b.block_type::text AS block_type,
              to_char(b.start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS start_at,
              to_char(b.end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS end_at,
              p.label AS parent
         FROM public.event_schedule_blocks b LEFT JOIN public.event_schedule_blocks p ON p.block_id = b.parent_block_id
        WHERE b.event_id = $1 ORDER BY b.label`,
      [eventId],
    )
  ).rows;
}

/** The live date as Apply reads it — through the couple's session. */
async function liveDate(eventId: string) {
  const r = await as<{ event_date: string; event_date_precision: string }>(
    F.couple,
    `SELECT to_char(event_date, 'YYYY-MM-DD') AS event_date, event_date_precision FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.err, null, `the couple cannot read their own date: ${r.err}`);
  return r.rows[0]!;
}

/** Apply's date write, as the couple, asking for the row back. */
async function applyDate(eventId: string, date: string) {
  const w = await as(F.couple, `UPDATE public.events SET event_date = $2 WHERE event_id = $1 RETURNING event_id`, [eventId, date]);
  assert.equal(w.err, null, `Apply’s date write was refused: ${w.err}`);
  assert.equal(w.n, 1, 'the date write reached no row');
}

test('5 · setup — a full day on D1: hair at 8, the ceremony with a part, the reception, and the civil rite the day before', async () => {
  G.eventId = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Rina & Paolo', 'wedding', 'catholic', 'garden', $1, 'day') RETURNING event_id AS e`,
      [D1],
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [G.eventId, F.couple]);
  G.stranger = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('stranger@apply.test', jsonb_build_object('account_type', 'customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  const ins = async (label: string, type: string, start: string, end: string | null, parent: string | null = null) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, end_at, parent_block_id)
         VALUES ($1, $2, $3::public.schedule_block_type, $4, $5, $6) RETURNING block_id AS id`,
        [G.eventId, label, type, start, end, parent],
      )
    ).rows[0]!.id;
  await ins('Civil rite', 'custom', '2031-06-06T10:00:00Z', '2031-06-06T10:30:00Z');
  await ins('Hair & make-up', 'custom', `${D1}T08:00:00Z`, `${D1}T10:00:00Z`);
  const ceremony = await ins('Ceremony', 'ceremony', `${D1}T15:00:00Z`, `${D1}T16:00:00Z`);
  await ins('Sand ceremony', 'custom', `${D1}T15:30:00Z`, null, ceremony);
  await ins('Reception', 'reception', `${D1}T18:00:00Z`, `${D1}T23:30:00Z`);
  assert.equal((await blocksOf(G.eventId)).length, 5, 'anti-vacuity: the day has five blocks to move');
});

test('6 · APPLY moves EVERY block by the same days — each keeps its time, its length and its parent', async () => {
  const before = await blocksOf(G.eventId);
  // The draft and the plan the action runs: the date is the one change.
  const draft = mergeHubDraft(emptyHubDraft(), { events: { event_date: D2 } });
  const prior = await liveDate(G.eventId);
  const plan = planHubDraftApply(draft, { events: { ...prior, ceremony_time: null } as HubLiveState['events'], widgets: [] }, false);
  assert.ok(plan.apply.some((i) => i.kind === 'event' && i.column === 'event_date'), 'the plan does not write the date');
  await applyDate(G.eventId, D2);
  const r = await moveScheduleWithDate({
    supabase: coupleClient(F.couple),
    eventId: G.eventId,
    fromDay: exactDayOf(prior.event_date, prior.event_date_precision),
    toDay: exactDayOf(D2, 'day'),
  });
  assert.deepEqual(r, { ok: true, status: 'moved', moved: 5 }, 'not every block moved');
  const after = await blocksOf(G.eventId);
  assert.equal(after.length, before.length, 'a block was created or deleted — the move only moves');
  for (const b of before) {
    const a = after.find((x) => x.label === b.label)!;
    const was = toDatetimeLocalValue(b.start_at);
    const now = toDatetimeLocalValue(a.start_at);
    assert.equal(now.slice(11), was.slice(11), `${b.label}: its time changed (${was} → ${now})`);
    const days = (Date.parse(`${now.slice(0, 10)}T00:00Z`) - Date.parse(`${was.slice(0, 10)}T00:00Z`)) / 86_400_000;
    assert.equal(days, 14, `${b.label}: moved ${days} days, not 14`);
    if (b.end_at) assert.equal(Date.parse(a.end_at!) - Date.parse(a.start_at), Date.parse(b.end_at) - Date.parse(b.start_at), `${b.label}: its length changed`);
    else assert.equal(a.end_at, null, `${b.label}: an open block gained an end`);
    assert.equal(a.parent, b.parent, `${b.label}: its parent changed`);
  }
  assert.equal(after.find((b) => b.label === 'Sand ceremony')!.start_at, `${D2}T15:30:00.000Z`, 'the part did not move with its ceremony');
  assert.equal(after.find((b) => b.label === 'Civil rite')!.start_at, '2031-06-20T10:00:00.000Z', 'the day before did not stay the day before');
  assert.equal(blockTime(ceremonyBlock(after)), '3:00 PM', 'the invitation no longer reads the ceremony at 3:00 PM');
});

test('7 · pressing Apply AGAIN moves nothing — the live date is already the new one', async () => {
  const before = await blocksOf(G.eventId);
  const draft = mergeHubDraft(emptyHubDraft(), { events: { event_date: D2 } });
  const live = await liveDate(G.eventId);
  const plan = planHubDraftApply(draft, { events: { ...live, ceremony_time: null } as HubLiveState['events'], widgets: [] }, false);
  assert.equal(plan.apply.length, 0, 'Apply would write the same date twice');
  const r = await moveScheduleWithDate({
    supabase: coupleClient(F.couple),
    eventId: G.eventId,
    fromDay: exactDayOf(live.event_date, live.event_date_precision),
    toDay: exactDayOf(D2, 'day'),
  });
  assert.deepEqual(r, { ok: true, status: 'unchanged', moved: 0 });
  assert.deepEqual(await blocksOf(G.eventId), before, 'a second Apply moved the schedule again');
});

test('8 · a date that was NOT one exact day (a month) moves nothing — there is no day to measure from', async () => {
  await db.query(`UPDATE public.events SET event_date_precision = 'month' WHERE event_id = $1`, [G.eventId]);
  const before = await blocksOf(G.eventId);
  const prior = await liveDate(G.eventId);
  assert.equal(exactDayOf(prior.event_date, prior.event_date_precision), null, 'a month read as a day');
  assert.equal(exactDayOf('2031-06-01', 'year'), null, 'a year read as a day');
  await applyDate(G.eventId, '2031-07-05');
  const r = await moveScheduleWithDate({
    supabase: coupleClient(F.couple),
    eventId: G.eventId,
    fromDay: exactDayOf(prior.event_date, prior.event_date_precision),
    toDay: exactDayOf('2031-07-05', 'day'),
  });
  assert.deepEqual(r, { ok: true, status: 'unchanged', moved: 0 });
  assert.deepEqual(await blocksOf(G.eventId), before, 'a month-precision date moved the schedule');
  await db.query(`UPDATE public.events SET event_date = $2, event_date_precision = 'day' WHERE event_id = $1`, [G.eventId, D2]);
});

test('9 · only the host moves it — a stranger’s session is REFUSED and moves no block', async () => {
  const before = await blocksOf(G.eventId);
  await db.query(`UPDATE public.events SET event_date = '2031-08-02' WHERE event_id = $1`, [G.eventId]);
  const r = await moveScheduleWithDate({ supabase: coupleClient(G.stranger), eventId: G.eventId, fromDay: D2, toDay: '2031-08-02' });
  assert.equal(r.ok, false, 'a stranger’s move was answered as a success');
  assert.deepEqual(await blocksOf(G.eventId), before, 'a stranger’s session moved the couple’s schedule');
  await db.query(`UPDATE public.events SET event_date = $2 WHERE event_id = $1`, [G.eventId, D2]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   🔒 ALL OR NOTHING, AND ONCE (2026-10-04, the train-g audit of #6337). The
   move is ONE SQL function (`move_event_schedule_with_date`): a failure on any
   block leaves EVERY block where it was, and the same move asked twice — two
   Applies that both read the old date — shifts the day once.
   ═══════════════════════════════════════════════════════════════════════════ */

const D3 = '2031-06-28';

/** The day the Schedule stands on, as the database records it (null = none). */
async function anchorOf(eventId: string) {
  return (
    await db.query<{ d: string }>(
      `SELECT to_char(anchor_day, 'YYYY-MM-DD') AS d FROM public.event_schedule_day_anchor WHERE event_id = $1`,
      [eventId],
    )
  ).rows[0]?.d ?? null;
}
/** The ceremony's day and time, as the invitation prints it. */
async function ceremonyAt(eventId: string) {
  return toDatetimeLocalValue(ceremonyBlock(await blocksOf(eventId))!.start_at);
}
/** A date written by a path that does NOT move the Schedule (the dashboard's date field, an admin). */
async function dateElsewhere(eventId: string, date: string) {
  await db.query(`UPDATE public.events SET event_date = $2 WHERE event_id = $1`, [eventId, date]);
}

test('10 · a failure on ONE block moves NO block — and leaves the anchor, so the move can still run', async () => {
  // The coordinator's own prep, hidden from the couple's read — it must move too.
  await db.query(
    `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, end_at, visibility)
     VALUES ($1, 'Coordinator prep', 'custom'::public.schedule_block_type, $2, $3, 'coordinator_only')`,
    [G.eventId, `${D2}T06:00:00Z`, `${D2}T07:00:00Z`],
  );
  const before = await blocksOf(G.eventId);
  assert.equal(before.length, 6, 'anti-vacuity: six blocks to move');
  // A block added by hand: the record of where the Schedule stood is forgotten…
  assert.equal(await anchorOf(G.eventId), null, 'a hand-added block left the old anchor standing');
  await applyDate(G.eventId, D3);
  // …and the date's own change seeds it again from the day it changed FROM.
  assert.equal(await anchorOf(G.eventId), D2, 'the date change did not record where the Schedule stood');
  // A block that refuses to move — sorted LAST of six, so a per-block loop
  // would already have moved five when it hit it.
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.zz_test_refuse_reception() RETURNS trigger LANGUAGE plpgsql AS $f$
    BEGIN RAISE EXCEPTION 'forced: the reception refuses to move'; END $f$;
    CREATE TRIGGER zz_refuse_reception BEFORE UPDATE ON public.event_schedule_blocks
      FOR EACH ROW WHEN (NEW.label = 'Reception') EXECUTE FUNCTION public.zz_test_refuse_reception();
  `);
  try {
    const r = await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: G.eventId, fromDay: D2, toDay: D3 });
    assert.equal(r.ok, false, 'a refused block was answered as a success');
    assert.deepEqual(await blocksOf(G.eventId), before, 'a failure part-way left part of the Schedule on the new day');
    assert.equal(await anchorOf(G.eventId), D2, 'a failed move was recorded as done');
  } finally {
    await db.exec(`DROP TRIGGER IF EXISTS zz_refuse_reception ON public.event_schedule_blocks; DROP FUNCTION IF EXISTS public.zz_test_refuse_reception()`);
  }
  const ok = await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: G.eventId, fromDay: D2, toDay: D3 });
  assert.deepEqual(ok, { ok: true, status: 'moved', moved: 6 }, 'the move did not run once the block could move — or skipped the coordinator’s prep');
  const after = await blocksOf(G.eventId);
  for (const b of before) {
    const a = after.find((x) => x.label === b.label)!;
    assert.equal(Date.parse(a.start_at) - Date.parse(b.start_at), 7 * 86_400_000, `${b.label}: did not move 7 days`);
  }
  assert.equal(await anchorOf(G.eventId), D3);
});

test('11 · two Applies that both read the old date move the day ONCE; a stale move is said, not "ok"', async () => {
  const before = await blocksOf(G.eventId);
  // The second Apply computed the SAME move (D2 → D3) from the same stale read.
  const again = await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: G.eventId, fromDay: D2, toDay: D3 });
  assert.deepEqual(again, { ok: true, status: 'aligned', moved: 0 }, 'the second Apply moved the Schedule again');
  assert.deepEqual(await blocksOf(G.eventId), before, 'the day shifted twice');
  // A move to a day that is no longer live: nothing moves, and it is NOT ok.
  const stale = await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: G.eventId, fromDay: D1, toDay: D2 });
  assert.deepEqual(stale, { ok: false, error: 'stale' }, 'a move that did not happen was answered as ok');
  assert.deepEqual(await blocksOf(G.eventId), before);
  // …and moving BACK is a real move, which runs.
  await applyDate(G.eventId, D2);
  const back = await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: G.eventId, fromDay: D3, toDay: D2 });
  assert.deepEqual(back, { ok: true, status: 'moved', moved: 6 }, 'moving back was mistaken for the move already done');
});

test('12 · A→B, the date sent back to A ELSEWHERE, then A→B again: the Schedule ends on B — never skipped, never doubled', async () => {
  const A = D2;
  const B = '2031-07-12';
  assert.equal((await ceremonyAt(G.eventId)).slice(0, 10), A, 'anti-vacuity: the ceremony stands on A');
  await applyDate(G.eventId, B);
  assert.equal((await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: G.eventId, fromDay: A, toDay: B })).ok, true);
  assert.equal(await ceremonyAt(G.eventId), `${B}T15:00`, 'A→B did not take the ceremony to B');
  const onB = await blocksOf(G.eventId);
  // The date goes back to A by a path that does NOT move the Schedule: it stays on B.
  await dateElsewhere(G.eventId, A);
  assert.deepEqual(await blocksOf(G.eventId), onB, 'a date change elsewhere moved the Schedule');
  assert.equal(await anchorOf(G.eventId), B, 'the record of where the Schedule stands was lost');
  // A→B again through Apply: the Schedule is ALREADY on B — said so, nothing doubled.
  await applyDate(G.eventId, B);
  const again = await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: G.eventId, fromDay: A, toDay: B });
  assert.deepEqual(again, { ok: true, status: 'aligned', moved: 0 });
  assert.equal(await ceremonyAt(G.eventId), `${B}T15:00`, 'the Schedule is not on the live date B');
  // The date goes elsewhere to C, then Apply C→D: the Schedule moves from where it STANDS (B) to D.
  const C = '2031-07-20';
  const D = '2031-07-27';
  await dateElsewhere(G.eventId, C);
  await applyDate(G.eventId, D);
  const real = await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: G.eventId, fromDay: C, toDay: D });
  assert.deepEqual(real, { ok: true, status: 'moved', moved: 6 }, 'a real move was skipped');
  assert.equal(await ceremonyAt(G.eventId), `${D}T15:00`, 'the Schedule did not land on the live date D');
  assert.equal(await anchorOf(G.eventId), D);
});

test('13 · who may move it, at runtime: an EDIT delegate yes; a VIEW delegate and anon are refused (42501)', async () => {
  const mk = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  const viewer = await mk('schedule-view@apply.test');
  const editor = await mk('schedule-edit@apply.test');
  for (const [uid, level] of [[viewer, 'view'], [editor, 'edit']] as const) {
    await db.query(
      `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, accepted_at, permissions_json)
       VALUES ($1, $2, 'wedding_planner_external', now(), jsonb_build_object('areas', jsonb_build_object('schedule', $3::text)))`,
      [G.eventId, uid, level],
    );
  }
  const E = '2031-08-03';
  const before = await blocksOf(G.eventId);
  await dateElsewhere(G.eventId, E); // the Schedule stands on D (27 Jul); the live date is now E
  // A VIEW delegate: refused, nothing moved.
  const viewed = await moveScheduleWithDate({ supabase: coupleClient(viewer), eventId: G.eventId, fromDay: '2031-07-27', toDay: E });
  assert.equal(viewed.ok, false, 'a view-only delegate moved the Schedule');
  assert.match(viewed.ok ? '' : viewed.error, /not_allowed/);
  assert.deepEqual(await blocksOf(G.eventId), before);
  // anon — the public key over REST: refused before the body runs.
  try {
    await db.exec('SET ROLE anon');
    await assert.rejects(
      db.query(`SELECT public.move_event_schedule_with_date($1, $2)`, [G.eventId, E]),
      (e: Error) => /permission denied|not_allowed/.test(e.message),
      'anon could call the move',
    );
  } finally {
    await reset();
  }
  assert.deepEqual(await blocksOf(G.eventId), before);
  // An EDIT delegate: allowed — the whole Schedule moves to E.
  const edited = await moveScheduleWithDate({ supabase: coupleClient(editor), eventId: G.eventId, fromDay: '2031-07-27', toDay: E });
  assert.deepEqual(edited, { ok: true, status: 'moved', moved: 6 }, 'an edit delegate was refused');
  assert.equal(await ceremonyAt(G.eventId), `${E}T15:00`);
});

test('14 · dashboard A→B, the host drags the blocks to B BY HAND, then Apply to C: the Schedule lands on C — not C+(B−A)', async () => {
  const A = '2031-09-06';
  const B = '2031-09-13';
  const C = '2031-09-20';
  const H = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Lia & Ben', 'wedding', 'catholic', 'garden', $1, 'day') RETURNING event_id AS e`,
      [A],
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [H, F.couple]);
  await db.query(
    `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, end_at) VALUES
       ($1, 'Ceremony', 'ceremony'::public.schedule_block_type, $2, $3),
       ($1, 'Reception', 'reception'::public.schedule_block_type, $4, $5)`,
    [H, `${A}T15:00:00Z`, `${A}T16:00:00Z`, `${A}T18:00:00Z`, `${A}T22:00:00Z`],
  );
  // The dashboard's date field moves the date, not the Schedule: the anchor records A.
  await dateElsewhere(H, B);
  assert.equal(await anchorOf(H), A, 'anti-vacuity: the Schedule is recorded on A');
  // The host drags every block to B themselves — their own session, as the Schedule page does.
  const drag = await as(
    F.couple,
    `UPDATE public.event_schedule_blocks
        SET start_at = start_at + interval '168 hours', end_at = end_at + interval '168 hours'
      WHERE event_id = $1 RETURNING block_id`,
    [H],
  );
  assert.equal(drag.err, null, `the host could not move their own blocks: ${drag.err}`);
  assert.equal(drag.n, 2);
  assert.equal(await ceremonyAt(H), `${B}T15:00`);
  assert.equal(await anchorOf(H), null, 'a hand edit left the stale anchor (A) standing — the next move would land 7 days late');
  // Apply to C: measured from where the host put the blocks (B), never from the stale A.
  await applyDate(H, C);
  const r = await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: H, fromDay: B, toDay: C });
  assert.deepEqual(r, { ok: true, status: 'moved', moved: 2 });
  assert.equal(await ceremonyAt(H), `${C}T15:00`, 'the Schedule did not land on C');
  // The move's OWN bulk shift is not a hand edit: the anchor stands on C afterwards.
  assert.equal(await anchorOf(H), C, 'the move forgot its own anchor — the next Apply could not move');
  // And the next normal Apply still moves.
  const D = '2031-09-27';
  await applyDate(H, D);
  assert.deepEqual(await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: H, fromDay: C, toDay: D }), { ok: true, status: 'moved', moved: 2 });
  assert.equal(await ceremonyAt(H), `${D}T15:00`);
});

test('14b · with no record of where the Schedule stands, the move refuses SAFE — nothing moves, and it is not ok', async () => {
  const H = (await db.query<{ e: string }>(`SELECT event_id AS e FROM public.events WHERE display_name = 'Lia & Ben'`)).rows[0]!.e;
  const before = await blocksOf(H);
  // A hand edit forgets the anchor; nothing has changed the date since.
  const touch = await as(F.couple, `UPDATE public.event_schedule_blocks SET end_at = end_at + interval '1 hour' WHERE event_id = $1 AND label = 'Reception' RETURNING block_id`, [H]);
  assert.equal(touch.n, 1);
  assert.equal(await anchorOf(H), null);
  const after = await blocksOf(H);
  const r = await moveScheduleWithDate({ supabase: coupleClient(F.couple), eventId: H, fromDay: '2031-09-20', toDay: '2031-09-27' });
  assert.deepEqual(r, { ok: false, error: 'no-anchor' }, 'a move with nothing to measure from was guessed, or read as ok');
  assert.deepEqual(await blocksOf(H), after, 'a move with no anchor moved blocks');
  assert.notDeepEqual(after, before, 'anti-vacuity: the hand edit changed a block');
});

test('15 · the move locks the event row FOR NO KEY UPDATE — a guest or child row inserted meanwhile is not blocked', async () => {
  // PGlite is one connection, so the wait itself cannot be staged; the lock
  // the APPLIED function takes is read from the database's own definition.
  const def = (
    await db.query<{ d: string }>(`SELECT pg_get_functiondef('public.move_event_schedule_with_date(uuid, date)'::regprocedure) AS d`)
  ).rows[0]!.d;
  const eventLock = def.slice(def.indexOf('FROM public.events e'), def.indexOf(';', def.indexOf('FROM public.events e')));
  assert.ok(eventLock.length > 0, 'anti-vacuity: the event read is gone');
  assert.match(eventLock, /FOR NO KEY UPDATE\s*$/, 'the move takes a key lock on the event row — every guest insert waits on it');
});

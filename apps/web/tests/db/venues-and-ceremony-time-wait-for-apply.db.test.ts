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
 *   4. a date that moves takes the ceremony with it.
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

let replay: ReplayResult;
let db: PGlite;
let placeCeremonyBlock: typeof import('../../lib/ceremony-time.server').placeCeremonyBlock;
let readLiveCeremonyTime: typeof import('../../lib/ceremony-time.server').readLiveCeremonyTime;
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
  ({ placeCeremonyBlock, readLiveCeremonyTime } = await import('../../lib/ceremony-time.server'));
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

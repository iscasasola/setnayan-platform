/**
 * 🧪 Shared fake data for the three Step 5 guards (RSVP by chapter, a TBA venue still sends, Details › Schedule never
 * shows a private moment) — fake ids and names only, never a real event. Also an in-memory `event_schedule_blocks`
 * that REALLY filters, so the server read is tested by its rows, not by its source.
 */
import type { ScheduleBlockRow } from './schedule';

export const EVENT = '00000000-0000-4000-8000-00000000e001';
export const CEREMONY = '00000000-0000-4000-8000-0000000000c1';
export const RECEPTION = '00000000-0000-4000-8000-0000000000c2'; // no venue yet — Venue TBA
export const AFTER_PARTY = '00000000-0000-4000-8000-0000000000c3'; // Time TBA, on the invitation
export const PREP_BRIDE = '00000000-0000-4000-8000-0000000000c4'; // private chapter
export const STAGED = '00000000-0000-4000-8000-0000000000c5'; // on the invitation but staged by the coordinator

type Row = Record<string, unknown>;

function block(over: Row): Row {
  return {
    block_id: '',
    public_id: 'S89B-TEST',
    event_id: EVENT,
    label: '',
    block_type: 'custom',
    start_at: '2026-12-18T15:00:00.000Z',
    end_at: null,
    location: null,
    spot: null,
    notes: null,
    is_public: false,
    sort_order: 0,
    parent_block_id: null,
    created_at: '2026-11-01T00:00:00.000Z',
    run_state: 'upcoming',
    actual_start_at: null,
    actual_end_at: null,
    audience: null,
    visibility: 'couple_visible',
    time_tba: false,
    on_invitation: false,
    ...over,
  };
}

/** A whole event's blocks: chapters and moments, public and private. */
export const BLOCKS: Row[] = [
  block({ block_id: CEREMONY, label: 'Ceremony', start_at: '2026-12-18T15:00:00.000Z', end_at: '2026-12-18T16:30:00.000Z', location: 'San Vicente Parish', on_invitation: true }),
  block({ block_id: RECEPTION, label: 'Reception', start_at: '2026-12-18T18:00:00.000Z', end_at: '2026-12-18T22:00:00.000Z', location: null, on_invitation: true }),
  block({ block_id: AFTER_PARTY, label: 'After party', start_at: '2026-12-18T00:00:00.000Z', location: 'Seda Rooftop', time_tba: true, on_invitation: true }),
  block({ block_id: PREP_BRIDE, label: 'Preparation · Bride', start_at: '2026-12-18T09:00:00.000Z', location: 'Seda', spot: 'Bridal suite', on_invitation: false, is_public: true }),
  block({ block_id: STAGED, label: 'Coordinator walk-through', start_at: '2026-12-18T12:00:00.000Z', on_invitation: true, visibility: 'coordinator_only' }),
  // Moments.
  block({ block_id: 'm-procession', parent_block_id: CEREMONY, label: 'Procession', start_at: '2026-12-18T15:05:00.000Z', is_public: true }),
  block({ block_id: 'm-vows-private', parent_block_id: CEREMONY, label: 'Family huddle before vows', start_at: '2026-12-18T15:20:00.000Z', is_public: false }),
  block({ block_id: 'm-entourage-only', parent_block_id: CEREMONY, label: 'Entourage photo call', start_at: '2026-12-18T16:20:00.000Z', is_public: true, audience: 'entourage' }),
  block({ block_id: 'm-staged', parent_block_id: RECEPTION, label: 'Caterer plating window', start_at: '2026-12-18T18:30:00.000Z', is_public: true, visibility: 'coordinator_only' }),
  block({ block_id: 'm-first-dance', parent_block_id: RECEPTION, label: 'First dance', start_at: '2026-12-18T19:00:00.000Z', is_public: true }),
  block({ block_id: 'm-glam', parent_block_id: PREP_BRIDE, label: 'Glam squad arrives', start_at: '2026-12-18T09:00:00.000Z', is_public: true }),
  // A moment wrongly flagged on_invitation — a moment is never replied to.
  block({ block_id: 'm-flagged', parent_block_id: RECEPTION, label: 'Cake cutting', start_at: '2026-12-18T20:00:00.000Z', is_public: true, on_invitation: true }),
];

export const PRIVATE_LABELS = ['Family huddle before vows', 'Entourage photo call', 'Caterer plating window', 'Glam squad arrives', 'Preparation · Bride', 'Coordinator walk-through'];

/** The public rows the page already reads (`fetchPublicScheduleBlocks`, the guests' fence) — and, on purpose, a few it
 *  never would, so the composer is tested as the fence it claims to be. */
export const PUBLIC_AND_STRAYS = BLOCKS as unknown as ScheduleBlockRow[];

/* ── an in-memory table that really filters ─────────────────────────────────────────────────────────────────── */

type Pred = (r: Row) => boolean;

class FakeQuery implements PromiseLike<{ data: Row[]; error: null }> {
  private preds: Pred[] = [];
  constructor(private rows: Row[]) {}
  select() { return this; }
  eq(c: string, v: unknown) { this.preds.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.preds.push((r) => r[c] !== v); return this; }
  is(c: string, v: null) { this.preds.push((r) => (r[c] ?? null) === v); return this; }
  in(c: string, vs: unknown[]) { this.preds.push((r) => vs.includes(r[c])); return this; }
  order() { return this; }
  then<A, B>(ok?: ((v: { data: Row[]; error: null }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    const data = this.rows.filter((r) => this.preds.every((p) => p(r)));
    return Promise.resolve({ data, error: null as null }).then(ok, bad);
  }
}

export function fakeAdmin(rows: Row[] = BLOCKS) {
  return { from: (_table: string) => new FakeQuery(rows) } as never;
}

/** Lets a test import modules that start with `import 'server-only'`. */
export function allowServerOnly() {
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

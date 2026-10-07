/**
 * march-draft.ts — THE WEDDING MARCH WAITS FOR APPLY.
 *
 * ⚖ Owner 2026-10-06 (DECISION_LOG "THE WEDDING MARCH ITEM IS A DRAG-AND-DROP
 * MARCH MAKER"), asked whether "Guests see this right away" should stay:
 * *"Wait for apply"* — and 2026-10-07: *"our goal is just to build the step 1-6
 * completely and all its fixes"*. Every march move (swap · walk together · walk
 * alone · move · section drag · into or out of "Not walking") is drafted like
 * every other Maker edit: it shows in the Maker at once, counts on ✓ Apply, and
 * reaches guests only at Apply.
 *
 * 🔑 +0 WRITERS. A drafted move is the SAME list of shipped march steps the
 * maker used to send at once (`MarchStep`, `lib/march-drag.ts`). Apply replays
 * them, in order, through the shipped actions (`runDraftedMarch` here, wired to
 * `callMarchStep` in `guests/march-step.ts`) — the march has no second writer.
 *
 * 🔑 THE DRAFT HOLDS MOVES, NOT A PICTURE. Each entry is one drop's steps; the
 * Maker draws the march as live with those steps laid on (`replayMarch`), so a
 * guest added or taken off the list while a move waits is still drawn where
 * the live march has them — never a stale snapshot.
 *
 * ⛔ A REFUSAL ENDS THE REPLAY, as it ended a burst before: the steps already
 * made stay made, what was still queued is dropped, and Apply says so by name
 * ("Wedding March stopped partway"). A step that could not be SENT (a thrown
 * call) is not a refusal — it and every step after it stay drafted, so Apply
 * again finishes the march.
 *
 * Pure: no React, no I/O — `the-march-waits-for-apply.test.ts` drives it.
 */
import type { MarchResult } from './march-result';
import type { MarchStep } from './march-drag';

/**
 * How many drafted moves the march holds before Apply. Every Undo state of the
 * draft carries the list (`HUB_DRAFT_HISTORY_LIMIT`), and a whole-section order
 * step names every walk in it — a bound keeps the draft under its byte cap.
 */
export const MARCH_DRAFT_MAX_MOVES = 60;
/** Said when a move would pass that bound — what to do, not "try again". */
export const MARCH_DRAFT_FULL_MESSAGE = 'Apply your Wedding March changes first — then keep arranging.';
/** The place the ✓ Apply sheet names, and the label a held march is said by. */
export const MARCH_DRAFT_PLACE = 'Wedding March';

const MAX_STEPS_PER_MOVE = 120;
const MAX_LEADS = 400;

const id = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 80 ? v : null);

/** One posted or stored step → a step, or null when it is not one of the shipped moves. */
export function sanitizeMarchStep(raw: unknown): MarchStep | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === 'sections-default') return { kind: 'sections-default' };
  const section = id(r.section);
  if (!section) return null;
  switch (r.kind) {
    case 'swap': {
      const a = id(r.a);
      const b = id(r.b);
      return a && b ? { kind: 'swap', section, a, b } : null;
    }
    case 'join': {
      const anchor = id(r.anchor);
      const joiner = id(r.joiner);
      return anchor && joiner ? { kind: 'join', section, anchor, joiner } : null;
    }
    case 'unpair': {
      const guest = id(r.guest);
      return guest ? { kind: 'unpair', section, guest } : null;
    }
    case 'order': {
      if (!Array.isArray(r.leads) || r.leads.length > MAX_LEADS) return null;
      const leads = r.leads.map(id);
      return leads.every((x): x is string => x !== null) ? { kind: 'order', section, leads } : null;
    }
    case 'section':
      return r.direction === 'up' || r.direction === 'down' ? { kind: 'section', section, direction: r.direction } : null;
    case 'walking': {
      const guest = id(r.guest);
      return guest && typeof r.walks === 'boolean' ? { kind: 'walking', section, guest, walks: r.walks } : null;
    }
    default:
      return null;
  }
}

/**
 * The drafted moves (or a patch's moves to add), sanitised. A move with ANY
 * unusable step is dropped whole — half a move replayed would be a march nobody
 * drew. `undefined` = no moves.
 */
export function sanitizeMarchMoves(raw: unknown): MarchStep[][] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const moves: MarchStep[][] = [];
  for (const move of raw.slice(0, MARCH_DRAFT_MAX_MOVES)) {
    if (!Array.isArray(move) || move.length === 0 || move.length > MAX_STEPS_PER_MOVE) continue;
    const steps = move.map(sanitizeMarchStep);
    if (steps.every((s): s is MarchStep => s !== null)) moves.push(steps);
  }
  return moves.length > 0 ? moves : undefined;
}

/** "1 change" · "3 changes" — what the ✓ Apply sheet says beside "Wedding March". */
export function marchChangesWord(moves: number): string {
  return `${moves} change${moves === 1 ? '' : 's'}`;
}

/** What Apply's replay did. */
export type MarchReplay = {
  /** Steps the shipped actions carried out. */
  applied: number;
  /** A refusal's own words — the replay stopped there and dropped what was queued. Null = no refusal. */
  stopped: string | null;
  /** A step could not be sent (it threw). Everything from it on is in `left`. */
  failed: boolean;
  /** The moves still to make — only after a step that could not be sent; empty otherwise. */
  left: MarchStep[][];
};

/**
 * Apply's half: send every drafted step, IN ORDER, one after another (each
 * action re-reads the march on the server, so they may not overlap), through
 * `call` — the shipped actions in production, a model of them in the tests.
 */
export async function runDraftedMarch(
  moves: readonly (readonly MarchStep[])[],
  call: (step: MarchStep) => Promise<MarchResult>,
): Promise<MarchReplay> {
  let applied = 0;
  for (const [i, move] of moves.entries()) {
    for (const [j, step] of move.entries()) {
      let r: MarchResult;
      try {
        r = await call(step);
      } catch {
        // Not sent: this step and every one after it wait for the next Apply.
        const rest = move.slice(j);
        return { applied, stopped: null, failed: true, left: [...(rest.length ? [rest] : []), ...moves.slice(i + 1).map((m) => [...m])] };
      }
      if (!r.ok) return { applied, stopped: r.reason, failed: false, left: [] };
      applied += 1;
    }
  }
  return { applied, stopped: null, failed: false, left: [] };
}

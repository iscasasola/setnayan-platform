/**
 * STAGE SCRIPT — the decision core behind the host/MC day-of specialization
 * ("Script & cues", `VendorSpecializationSet = 'stage_script'`).
 *
 * WHY A PURE MODULE. Same reason as `lib/vendor-dayof-frame.ts` and the gate it
 * consumes: the interesting part of this desk is a set of DECISIONS — what the
 * host says right now, what is coming, which of the couple's notes must never be
 * read aloud, and which card belongs at the top of the screen — and a decision is
 * only trustworthy if a test can hold it down. The surface component becomes a
 * thin renderer over {@link buildStageScript}.
 *
 * ── BUILT ON THE SHIPPED SUBSTRATE, NOT A FORK ─────────────────────────────
 *
 * Three things already existed and are REUSED rather than reimplemented:
 *
 *   • `BLOCK_CUE` from `lib/emcee-script.ts` — the per-block cue sentences the
 *     couple already downloads as their emcee script. Imported, not copied, so
 *     the paper script and this on-stage desk can never tell one host two
 *     different things about the same moment.
 *   • `deriveRunOfShow` from `lib/run-of-show.ts` — the now/next/drift
 *     derivation the realtime run-of-show header already uses. The run-state
 *     pointer is the truth here too; this module does not re-derive "what is
 *     live" from the wall clock.
 *   • `driftLabel` from the same module — "12 min behind" / "on time".
 *
 * The wall clock enters in exactly ONE place: how many minutes away the next
 * block's PLANNED start is. Everything else is run-state driven, which is why
 * `now` is injectable and every test below is deterministic.
 *
 * ── THE DATA BOUNDARY THIS DESK LIVES INSIDE (2026-07-27) ──────────────────
 *
 * The host/MC opening this desk is a BOOKED VENDOR, and a booked vendor's RLS
 * reach is narrower than the couple's. Verified against the live policies:
 *
 *   • `event_schedule_blocks` — READABLE. `event_schedule_blocks_booked_vendor_read`
 *     grants the full timeline (`current_vendor_booked_event_ids()`), minus the
 *     coordinator's unreleased prep. This is the desk's ONLY source.
 *   • `guests` — NOT readable. Every SELECT policy routes through
 *     `current_event_ids()` (= `event_members`) or the guest's own row. So the
 *     wedding-party ROSTER that `buildEmceeScript` prints for the couple cannot
 *     be shown here, and reaching for the admin client to force it would be the
 *     exact guest-PI exposure the standing DPO/NPC item governs. The roster is
 *     deliberately absent rather than fetched with elevated credentials.
 *   • `coordinator_broadcasts` — NOT readable (member / moderator / admin only).
 *     So "announcements" here are NOT coordinator broadcasts; wiring them would
 *     have produced a permanently empty card — a fake door.
 *
 * Announcements are therefore derived from the one authoritative thing the host
 * CAN see: the couple's own `notes` on their schedule blocks. That is also the
 * right answer on the merits — a note on a block is literally the couple telling
 * the host what to say at that moment.
 *
 * ── THE SAFETY DECISION THIS MODULE EXISTS FOR ─────────────────────────────
 *
 * A booked vendor reads the FULL timeline, public blocks and private ones alike.
 * A private block's note is context for the host ("don't reveal the surprise
 * yet"), NOT copy to read into a microphone. Every entry this module emits
 * carries `publicFacing`, and it is `false` for a non-public block — so the
 * renderer can mark it, and a host holding a live mic is never handed a private
 * instruction that looks like a line to deliver. `stage-script.test.ts` pins
 * this: no `publicFacing: true` entry can originate from an `is_public: false`
 * block, on any path.
 *
 * ── NO NEW SCHEMA, AND NO STORED CARD-PLACEMENT PREFERENCE ─────────────────
 *
 * Card order is DERIVED (see {@link StageScriptModel.order}), not stored. The
 * rule is that the cue card leads while there is a show to cue, and the
 * announcements card overtakes the script the moment the current or next block
 * carries a note the host must say. That is strictly better than a saved
 * preference for a screen a host looks at while holding a microphone: it puts
 * the urgent thing on top by itself, and it needs no table, no column, no
 * migration, and no settings UI to get right. (Had a persisted preference been
 * warranted, the existing `invitation_widgets` display_order/mode pattern is the
 * one to copy — but it is not warranted here.)
 */

import {
  formatBlockTimeRange,
  type ScheduleBlockType,
} from '@/lib/schedule';
import { BLOCK_CUE } from '@/lib/emcee-script';
import {
  deriveRunOfShow,
  driftLabel,
  type RunState,
} from '@/lib/run-of-show';

/**
 * The block shape this desk needs. A strict SUBSET of `ScheduleBlockRow`, so the
 * real row is assignable without a cast or a mapping layer, and a subset of what
 * a booked vendor may actually SELECT (see the data-boundary note above).
 */
export type StageScriptBlock = {
  block_id: string;
  label: string;
  block_type: ScheduleBlockType;
  start_at: string;
  end_at: string | null;
  location: string | null;
  notes: string | null;
  is_public: boolean;
  sort_order: number;
  parent_block_id: string | null;
  run_state: RunState;
  actual_start_at: string | null;
};

/** Where the show is, as a whole. Drives the headline and the card order. */
export type StageScriptPhase =
  /** No blocks at all — the couple has not built a timeline. */
  | 'empty'
  /** Blocks exist, nothing advanced yet. Standing by. */
  | 'not_started'
  /** The run of show is under way (something live, or some done). */
  | 'running'
  /** Every block is done. */
  | 'wrapped';

/** One line of the running script. */
export type StageScriptEntry = {
  blockId: string;
  label: string;
  /** Formatted wall-clock range, via the injected formatter. */
  time: string;
  /** The shared per-block cue from `BLOCK_CUE`, when the type has one. */
  cue: string | null;
  /** The couple's own note on this block, verbatim. */
  note: string | null;
  location: string | null;
  state: RunState;
  /**
   * TRUE only for a block the guests can see. FALSE = private: context for the
   * host, never copy to read aloud. See the module doc.
   */
  publicFacing: boolean;
  /** 0 = top-level block · 1 = a part nested inside its parent. */
  depth: 0 | 1;
};

/** One thing the host has to say, lifted out of the script so it cannot be
 *  missed inside a long program. */
export type StageAnnouncement = {
  blockId: string;
  blockLabel: string;
  time: string;
  /** The couple's words. */
  note: string;
  state: RunState;
  /** FALSE = private block — show it, mark it, never read it out. */
  publicFacing: boolean;
};

/** One side of the cue card. */
export type StageCueBlock = {
  label: string;
  time: string;
  cue: string | null;
  note: string | null;
  publicFacing: boolean;
};

/** The cue card — the one thing a host glances at mid-room. */
export type StageCue = {
  /** The block that is live right now, or null (pre-show / between moments). */
  now: StageCueBlock | null;
  /** The next upcoming block, or null once nothing is left. */
  next: (StageCueBlock & { minutesAway: number | null }) | null;
  /** "12 min behind" / "on time" — from the shared `driftLabel`. */
  drift: string | null;
  /** The single sentence the host reads first. Always present. */
  headline: string;
};

/** Which card sits where. Derived, never stored — see the module doc. */
export type StageCardId = 'cue' | 'script' | 'announcements';

export type StageScriptModel = {
  phase: StageScriptPhase;
  cue: StageCue;
  script: StageScriptEntry[];
  announcements: StageAnnouncement[];
  /** Render order, top to bottom. Omits `cue` once the show has wrapped. */
  order: StageCardId[];
};

export type StageScriptOptions = {
  /** Injectable so tests are deterministic; defaults to the shared formatter
   *  the couple's schedule and emcee script already use. */
  formatTime?: (startIso: string, endIso: string | null) => string;
  /** Injectable clock. Feeds ONLY `next.minutesAway`. */
  now?: Date;
};

/**
 * How to say when the next block is due.
 *
 * A running show goes LATE, which makes `minutesAway` negative — the next item
 * was due before now. Suppressing that (the obvious first cut) hides the single
 * most actionable fact on a late floor, so it is stated: "due 15 min ago". Kept
 * here, pure and tested, rather than as a ternary in the renderer.
 */
export function nextTimingLabel(minutesAway: number | null): string | null {
  if (minutesAway === null) return null;
  if (minutesAway > 0) return `in ${minutesAway} min`;
  if (minutesAway === 0) return 'due now';
  const late = Math.abs(minutesAway);
  return `due ${late} min ago`;
}

/** A note worth surfacing — non-empty after trimming. */
function cleanNote(note: string | null): string | null {
  const t = note?.trim();
  return t ? t : null;
}

/**
 * Time order, matching how the emcee script narrates: chronological, with
 * `sort_order` as the tiebreak for blocks sharing a start.
 */
function byTime(a: StageScriptBlock, b: StageScriptBlock): number {
  if (a.start_at !== b.start_at) return a.start_at < b.start_at ? -1 : 1;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.block_id < b.block_id ? -1 : a.block_id > b.block_id ? 1 : 0;
}

/** Whole minutes from `now` to a planned start. Null on an unparseable time. */
function minutesUntil(startIso: string, now: Date): number | null {
  const t = new Date(startIso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now.getTime()) / 60000);
}

function toCueBlock(
  block: StageScriptBlock,
  formatTime: (s: string, e: string | null) => string,
): StageCueBlock {
  return {
    label: block.label,
    time: formatTime(block.start_at, block.end_at),
    cue: BLOCK_CUE[block.block_type] ?? null,
    note: cleanNote(block.notes),
    // The one safety invariant: a private block is never marked sayable.
    publicFacing: block.is_public,
  };
}

/**
 * The running script, in the order the host reads it: every top-level block
 * chronologically, each followed by its own parts. Mirrors the nesting
 * `buildEmceeScript` prints, so the desk and the printed script agree.
 */
function buildScript(
  blocks: readonly StageScriptBlock[],
  formatTime: (s: string, e: string | null) => string,
): StageScriptEntry[] {
  const entry = (b: StageScriptBlock, depth: 0 | 1): StageScriptEntry => ({
    blockId: b.block_id,
    label: b.label,
    time: formatTime(b.start_at, b.end_at),
    cue: BLOCK_CUE[b.block_type] ?? null,
    note: cleanNote(b.notes),
    location: b.location,
    state: b.run_state,
    publicFacing: b.is_public,
    depth,
  });

  const topLevel = blocks.filter((b) => b.parent_block_id === null).sort(byTime);
  const childrenByParent = new Map<string, StageScriptBlock[]>();
  for (const b of blocks) {
    if (b.parent_block_id === null) continue;
    const bucket = childrenByParent.get(b.parent_block_id) ?? [];
    bucket.push(b);
    childrenByParent.set(b.parent_block_id, bucket);
  }

  const out: StageScriptEntry[] = [];
  const seen = new Set<string>();
  for (const parent of topLevel) {
    out.push(entry(parent, 0));
    seen.add(parent.block_id);
    for (const child of (childrenByParent.get(parent.block_id) ?? []).sort(byTime)) {
      out.push(entry(child, 1));
      seen.add(child.block_id);
    }
  }
  // An ORPHAN part — `parent_block_id` pointing at a block this vendor cannot
  // see (the coordinator's unreleased prep is filtered by RLS before it reaches
  // us). Dropping it would silently lose a line from a host's script, so it is
  // rendered at top level rather than discarded.
  for (const b of blocks.filter((x) => !seen.has(x.block_id)).sort(byTime)) {
    out.push(entry(b, 0));
  }
  return out;
}

/**
 * BUILD THE DESK.
 *
 * Pure and total: no throw on any input, including an empty timeline, blocks
 * with unparseable timestamps, or a parent pointer RLS filtered away.
 */
export function buildStageScript(input: {
  blocks: readonly StageScriptBlock[];
  options?: StageScriptOptions;
}): StageScriptModel {
  const formatTime = input.options?.formatTime ?? formatBlockTimeRange;
  const now = input.options?.now ?? new Date();
  const blocks = input.blocks;

  const script = buildScript(blocks, formatTime);

  // Announcements: the couple's notes, in reading order, public and private
  // alike — private ones carried through MARKED, never dropped (a host who is
  // told nothing about a private moment is worse off than one who is told and
  // told not to say it).
  const announcements: StageAnnouncement[] = script
    .filter((e) => e.note !== null)
    .map((e) => ({
      blockId: e.blockId,
      blockLabel: e.label,
      time: e.time,
      note: e.note!,
      state: e.state,
      publicFacing: e.publicFacing,
    }));

  // Run-state truth, reusing the shipped derivation. `StageScriptBlock` is a
  // structural superset of `RunOfShowBlock`, so the real rows go straight in.
  const run = deriveRunOfShow(blocks, now);
  const byId = new Map(blocks.map((b) => [b.block_id, b]));
  const currentBlock = run.current ? byId.get(run.current.block_id) ?? null : null;
  const nextBlock = run.next ? byId.get(run.next.block_id) ?? null : null;

  const phase: StageScriptPhase =
    blocks.length === 0
      ? 'empty'
      : run.allDone
        ? 'wrapped'
        : run.notStarted
          ? 'not_started'
          : 'running';

  const nowCue = currentBlock ? toCueBlock(currentBlock, formatTime) : null;
  const nextCue = nextBlock
    ? { ...toCueBlock(nextBlock, formatTime), minutesAway: minutesUntil(nextBlock.start_at, now) }
    : null;

  const cue: StageCue = {
    now: nowCue,
    next: nextCue,
    drift: driftLabel(run.driftMinutes),
    headline: buildHeadline(phase, nowCue, nextCue),
  };

  return { phase, cue, script, announcements, order: cardOrder(phase, cue) };
}

/**
 * The one sentence the host reads first. Every phase gets a real sentence —
 * there is no path that returns an empty string or a spinner-ish placeholder.
 */
function buildHeadline(
  phase: StageScriptPhase,
  now: StageCueBlock | null,
  next: (StageCueBlock & { minutesAway: number | null }) | null,
): string {
  if (phase === 'empty') return 'No program yet — the couple has not built their timeline.';
  if (phase === 'wrapped') return 'That’s a wrap — every block is done.';
  if (now) return `You’re on: ${now.label}.`;
  if (phase === 'not_started') {
    return next ? `Standing by. Opening: ${next.label}.` : 'Standing by.';
  }
  // Running, but nothing is live — the gap between two blocks.
  return next ? `Between moments. Next: ${next.label}.` : 'Between moments.';
}

/**
 * CARD ORDER — the derived alternative to a stored placement preference.
 *
 *   • Wrapped: the cue card has nothing left to cue, so it is dropped entirely
 *     rather than left on screen saying nothing.
 *   • A note on the CURRENT or NEXT block outranks the script: it is the thing
 *     the host is about to have to say, so it goes directly under the cue card
 *     instead of being buried in a long program.
 *   • Otherwise the script leads, because that is what a host reads from.
 */
function cardOrder(phase: StageScriptPhase, cue: StageCue): StageCardId[] {
  if (phase === 'wrapped') return ['script', 'announcements'];
  const imminentNote = Boolean(cue.now?.note) || Boolean(cue.next?.note);
  return imminentNote
    ? ['cue', 'announcements', 'script']
    : ['cue', 'script', 'announcements'];
}

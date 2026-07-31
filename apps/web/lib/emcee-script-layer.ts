/**
 * THE EMCEE'S SCRIPT LAYER — assembling a host's working script.
 *
 * Owner, 2026-07-29: *"we want to help the emcees be able to help creating
 * their scripts, and plotting of the planned scripts for each part of the
 * event."*
 *
 * ── THE IDEA IN ONE LINE ───────────────────────────────────────────────────
 *
 * **He does not write a document. He fills in a layer over the couple's night,
 * and the script assembles itself.** Four things meet on every moment:
 *
 *   | where it comes from            | what it is                    | whose  |
 *   |--------------------------------|-------------------------------|--------|
 *   | `event_schedule_blocks.label`  | what happens, and when        | couple |
 *   | `event_schedule_blocks.notes`  | what they want said           | couple |
 *   | `BLOCK_CUE` (lib/emcee-script) | the shared prompt for the type | ours   |
 *   | `vendor_block_scripts.body`    | what HE will say              | his    |
 *
 * This module joins them into one ordered list. Because his line is attached to
 * a BLOCK and not to a position in a document, the couple can move dinner and
 * his script moves with it — the thing a Word file can never do.
 *
 * ── WHY A PURE MODULE ──────────────────────────────────────────────────────
 *
 * Same reason as `lib/stage-script.ts` and `lib/vendor-activities.ts`: the
 * interesting part is a decision — what counts as written, what is still blank,
 * what he must never read aloud — and a decision is only trustworthy if a test
 * can hold it down. Both surfaces (his prep page and his day-of desk) become
 * renderers over {@link buildScriptWorkbook}.
 *
 * ── THE SAFETY RULE THIS INHERITS ──────────────────────────────────────────
 *
 * A booked vendor reads the FULL timeline, private blocks included. A private
 * block's note is context, never copy — the same invariant `lib/stage-script.ts`
 * exists to protect. Every entry carries `publicFacing`, and anything not
 * strictly `is_public === true` is FALSE, so an unexpected value fails toward
 * silence rather than toward a host reading a surprise into a microphone.
 */

import { BLOCK_CUE } from '@/lib/emcee-script';
import type { ScheduleBlockType } from '@/lib/schedule';

/** The block shape this needs — a strict subset of `ScheduleBlockRow`. */
export type ScriptBlock = {
  block_id: string;
  label: string;
  block_type: ScheduleBlockType;
  start_at: string;
  end_at: string | null;
  notes: string | null;
  is_public: boolean;
  sort_order: number;
  parent_block_id: string | null;
};

/** One saved line, as stored. */
export type BlockScript = {
  block_id: string;
  body: string;
};

/** One moment of the night, with everything that belongs to it. */
export type ScriptEntry = {
  blockId: string;
  label: string;
  /** Formatted by the injected formatter — deterministic in tests. */
  time: string;
  /** The shared prompt for this block type, when one exists. */
  cue: string | null;
  /** The couple's instruction, verbatim. */
  note: string | null;
  /** What he will say. `null` = not written yet. */
  script: string | null;
  /** FALSE = a private block: context for him, never copy to read aloud. */
  publicFacing: boolean;
  /** 0 = a moment · 1 = a part inside one. */
  depth: 0 | 1;
};

export type ScriptWorkbook = {
  entries: ScriptEntry[];
  /** How many moments have a line written. */
  written: number;
  /** How many are still blank — the number the page counts down. */
  blank: number;
  /** Moments the couple wrote an instruction on but he has not answered yet.
   *  The most useful "what next" on the page: they asked, he has not replied. */
  unanswered: string[];
  /** True when there is no timeline at all yet. */
  empty: boolean;
};

export type BuildOptions = {
  /** Injectable so tests never depend on a locale or a clock. */
  formatTime?: (startIso: string, endIso: string | null) => string;
};

function defaultFormat(startIso: string): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function clean(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

/** Chronological, with `sort_order` as the tiebreak — the order he reads in. */
function byTime(a: ScriptBlock, b: ScriptBlock): number {
  if (a.start_at !== b.start_at) return a.start_at < b.start_at ? -1 : 1;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.block_id < b.block_id ? -1 : a.block_id > b.block_id ? 1 : 0;
}

/**
 * BUILD THE WORKBOOK.
 *
 * Pure and total: no throw on any input, including an empty timeline, a script
 * whose block was deleted, or a part whose parent RLS filtered away.
 */
export function buildScriptWorkbook(input: {
  blocks: readonly ScriptBlock[];
  scripts: readonly BlockScript[];
  options?: BuildOptions;
}): ScriptWorkbook {
  const fmt = input.options?.formatTime ?? ((s: string) => defaultFormat(s));

  // Last write wins if the same block somehow appears twice — a UNIQUE
  // constraint prevents it in the DB, but this must not depend on that.
  const byBlock = new Map<string, string>();
  for (const s of input.scripts) {
    const body = clean(s.body);
    if (body) byBlock.set(s.block_id, body);
  }

  const entry = (b: ScriptBlock, depth: 0 | 1): ScriptEntry => ({
    blockId: b.block_id,
    label: b.label,
    time: fmt(b.start_at, b.end_at),
    cue: BLOCK_CUE[b.block_type] ?? null,
    note: clean(b.notes),
    script: byBlock.get(b.block_id) ?? null,
    // The one safety line: anything not strictly TRUE reads as private.
    publicFacing: b.is_public === true,
    depth,
  });

  const top = input.blocks.filter((b) => b.parent_block_id === null).sort(byTime);
  const kids = new Map<string, ScriptBlock[]>();
  for (const b of input.blocks) {
    if (b.parent_block_id === null) continue;
    const bucket = kids.get(b.parent_block_id) ?? [];
    bucket.push(b);
    kids.set(b.parent_block_id, bucket);
  }

  const entries: ScriptEntry[] = [];
  const seen = new Set<string>();
  for (const parent of top) {
    entries.push(entry(parent, 0));
    seen.add(parent.block_id);
    for (const kid of (kids.get(parent.block_id) ?? []).sort(byTime)) {
      entries.push(entry(kid, 1));
      seen.add(kid.block_id);
    }
  }
  // A part whose parent this vendor cannot see (the coordinator's unreleased
  // prep is filtered by RLS before it reaches us). Promote rather than drop —
  // silently losing a moment from a host's script is the worst failure here.
  for (const orphan of input.blocks.filter((b) => !seen.has(b.block_id)).sort(byTime)) {
    entries.push(entry(orphan, 0));
  }

  const written = entries.filter((e) => e.script !== null).length;

  return {
    entries,
    written,
    blank: entries.length - written,
    // They asked for something and he has not written his line for it yet.
    unanswered: entries.filter((e) => e.note !== null && e.script === null).map((e) => e.blockId),
    empty: entries.length === 0,
  };
}

/**
 * Compile the workbook into plain text he can print or paste.
 *
 * Deliberately NOT `buildEmceeScript` (lib/emcee-script.ts): that one is the
 * COUPLE's export and prints the wedding-party roster from `guests`, which a
 * booked vendor cannot read. This is his own copy — same night, his lines, no
 * guest data. Two audiences, two compilers, one shared `BLOCK_CUE`.
 */
export function compileScriptText(
  workbook: ScriptWorkbook,
  header: { coupleName: string | null; eventDate: string | null },
): string {
  const lines: string[] = [
    '═══════════════════════════════════════════',
    `  HOST SCRIPT — ${header.coupleName?.trim() || 'the wedding'}`,
  ];
  if (header.eventDate) lines.push(`  ${header.eventDate}`);
  lines.push('═══════════════════════════════════════════', '');

  if (workbook.empty) {
    lines.push('  (No timeline yet — nothing to script.)', '');
    return lines.join('\n');
  }

  for (const e of workbook.entries) {
    const pad = e.depth === 1 ? '    ' : '  ';
    lines.push(`${pad}${e.time} — ${e.depth === 0 ? e.label.toUpperCase() : e.label}`);
    if (!e.publicFacing) lines.push(`${pad}  [PRIVATE — DO NOT READ ALOUD]`);
    if (e.note) lines.push(`${pad}  They asked: ${e.note}`);
    if (e.cue) lines.push(`${pad}  Cue: ${e.cue}`);
    if (e.script) lines.push(`${pad}  YOU SAY: ${e.script}`);
    else lines.push(`${pad}  YOU SAY: ______________________`);
    lines.push('');
  }

  lines.push(`— ${workbook.written} of ${workbook.entries.length} written —`);
  return lines.join('\n');
}

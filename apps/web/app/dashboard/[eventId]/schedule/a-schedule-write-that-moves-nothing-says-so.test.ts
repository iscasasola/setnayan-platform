/**
 * a-schedule-write-that-moves-nothing-says-so.test.ts — the coordinator walk of 2026-10-23 (owner: "Keep what we
 * have first and make them run smoothly").
 *
 * The schedule's writes go through the caller's own client, so RLS decides who may write. RLS answers a refused
 * UPDATE with ZERO ROWS and NO ERROR — so every write that only checked `error` reported success over an unchanged
 * schedule:
 *
 *   ⓵ Running late (`bulkRetimeScheduleBlocks`): the sheet closed as if the day had moved; a span with nothing the
 *      caller could see to move `return`ed quietly.
 *   ⓶ The floor's +5/+10/+15 (`floorRetimeFrom`): "Moved 6 blocks." in green to a booked coordinator who does not
 *      hold Edit on the schedule — the day did not move.
 *   ⓷ "Who's responsible" (`setBlockResponsibleParty`) and an approved change (`resolveScheduleSuggestion`): "saved".
 *   ⓸ In the Event Hub Maker the shift is a QUIET write (no render follows), and the sheet closed over the OLD times —
 *      the rail kept saying the ceremony was at 2:00 after it had moved to 2:30.
 *   ⓹ A supplier's change "in words only" (no new time, place or name): Approve moved nothing, yet the sheet said
 *      "Approving changes the moment" and the supplier was told "Your proposed change is now on their schedule."
 *   ⓺ A template pressed on a screen gone stale (someone added a moment) did nothing and said nothing.
 *
 * Property, not phrasing: each UPDATE of `event_schedule_blocks` in these writers READS BACK what it changed and
 * refuses an empty answer, wherever it sits in the function.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { isNoteOnlySuggestion } from '@/lib/schedule-ros';

const WEB = join(__dirname, '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ACTIONS = 'app/dashboard/[eventId]/schedule/actions.ts';
const FLOOR = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/actions.ts';
const SHEETS = 'app/dashboard/[eventId]/schedule/_components/day-sheets.tsx';
const RAIL = 'app/dashboard/[eventId]/schedule/_components/day-rail.tsx';

/** The body of `function <name>(…) {…}` in `src`, brace-matched. */
function body(src: string, name: string): string {
  const at = src.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*[(<]`));
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  // The body's brace closes the parameter list (and an optional plain return type) — never a destructuring `({`.
  const head = /\)(?:\s*:\s*[\w<>[\]., |]+)?\s*\{\n/.exec(src.slice(at));
  assert.ok(head, `${name} has no body brace`);
  const open = at + head.index + head[0].length - 2;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`${name} never closes`);
}

/** Every `.from('event_schedule_blocks') … .update(…) …;` statement in `src`, with the 300 characters after it. */
function blockUpdates(src: string): { stmt: string; after: string }[] {
  const out: { stmt: string; after: string }[] = [];
  const re = /\.from\('event_schedule_blocks'\)\s*\.update\(/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const start = src.lastIndexOf('const', m.index);
    const end = src.indexOf(';', m.index);
    out.push({ stmt: src.slice(start, end + 1), after: src.slice(end + 1, end + 300) });
  }
  return out;
}

const WRITERS: [file: string, fn: string][] = [
  [ACTIONS, 'bulkRetimeScheduleBlocks'],
  [ACTIONS, 'setBlockResponsibleParty'],
  [ACTIONS, 'resolveScheduleSuggestion'],
  [FLOOR, 'floorRetimeFrom'],
];

test('⓵⓶⓷ every UPDATE of a schedule row reads back what it changed and refuses an empty answer', () => {
  for (const [file, fn] of WRITERS) {
    const updates = blockUpdates(body(read(file), fn));
    assert.ok(updates.length > 0, `${fn} writes no schedule row any more — re-point this guard`);
    for (const { stmt, after } of updates) {
      const rows = /const\s*\{\s*data:\s*(\w+)\s*,\s*error\s*\}/.exec(stmt)?.[1];
      assert.ok(rows, `${fn}: an UPDATE of event_schedule_blocks keeps only its error — RLS refuses with zero rows, no error`);
      assert.match(stmt, /\.select\(/, `${fn}: the UPDATE does not .select() — it returns no rows to count`);
      assert.match(
        after,
        new RegExp(`!${rows}\\?\\.length`),
        `${fn}: the rows the UPDATE read back are never checked — an empty answer still reads as saved`,
      );
    }
  }
});

test('⓵ a shift with nothing to move is refused, not a quiet return', () => {
  const retime = body(read(ACTIONS), 'bulkRetimeScheduleBlocks');
  assert.doesNotMatch(retime, /patches\.length\s*===\s*0\)\s*return/, 'an empty span returns quietly again');
  assert.match(retime, /patches\.length\s*===\s*0\)\s*throw/);
});

test('⓸ a shift that landed is on the rail at once — every Running-late sheet hands its times back', () => {
  const sheet = body(read(SHEETS), 'ShiftSheet');
  const submit = body(sheet, 'submit');
  const landed = submit.indexOf('onShifted?.(patches)');
  assert.ok(landed > 0, 'the sheet no longer hands the landed times back');
  assert.ok(landed > submit.indexOf('await bulkRetimeScheduleBlocks('), 'the times are laid before the shift landed');
  assert.ok(landed < submit.indexOf('onClose()'), 'the sheet closes before laying the new times');
  const rail = read(RAIL);
  const mounts = rail.match(/<ShiftSheet\b[\s\S]*?\/>/g) ?? [];
  const sheets = mounts.length;
  const wired = mounts.filter((m) => /onShifted=\{landShift\}/.test(m)).length;
  assert.ok(sheets > 0, 'the rail mounts no Running-late sheet — re-point this guard');
  assert.equal(wired, sheets, `${sheets - wired} Running-late sheet(s) close over the old times in the Maker`);
  assert.match(body(rail, 'landShift'), /override\(p\.block_id/);
});

test('⓹ a change in words only is said as one — on the sheet and in the supplier’s notice', () => {
  const words = { kind: 'adjust', proposed_label: null, proposed_start_at: null, proposed_end_at: null, proposed_location: null };
  assert.equal(isNoteOnlySuggestion(words), true);
  assert.equal(isNoteOnlySuggestion({ ...words, proposed_start_at: '2026-12-18T14:30:00Z' }), false);
  assert.equal(isNoteOnlySuggestion({ ...words, proposed_location: 'Garden' }), false);
  assert.equal(isNoteOnlySuggestion({ ...words, kind: 'new' }), false);
  assert.equal(isNoteOnlySuggestion({ ...words, kind: 'remove' }), false);

  const requests = body(read(SHEETS), 'RequestsSheet');
  assert.equal(requests.match(/isNoteOnlySuggestion\(r\)/g)?.length ?? 0, 2, 'the Asked line and the footnote must both tell a note from a change');
  const resolve = body(read(ACTIONS), 'resolveScheduleSuggestion');
  assert.match(resolve, /isNoteOnlySuggestion\(suggestion\)/, 'the supplier is told their note moved the schedule');
});

test('⓺ a template on a schedule that is no longer empty redraws the page instead of doing nothing', () => {
  const load = body(read(ACTIONS), 'loadScheduleTemplate');
  assert.match(load, /existing\.length\s*>\s*0\)\s*\{\s*revalidatePath\(/, 'a template press on a stale screen is silent again');
});

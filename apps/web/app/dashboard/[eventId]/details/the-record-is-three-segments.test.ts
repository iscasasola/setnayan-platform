/**
 * the-record-is-three-segments.test.ts — Event Details is THREE SEGMENTS,
 * Event · Access · Settings, one body, one row shape; and NOTHING on it writes
 * the Event Hub draft, so the Maker's Undo · Apply are gone from it.
 *
 * ⚖ Owner 2026-10-07, DECISION_LOG "EVENT DETAILS IS THREE SEGMENTS: EVENT ·
 * ACCESS · SETTINGS" (*"approve all"* on `EVENT_DETAILS_ARRANGE_2026-10-07_fable.md`
 * § (e) PR-A); owner 2026-10-08: *"why is there still undo and apply?"*.
 * Replaces `the-record-is-four-folds-on-the-phone.test.ts` (the four folds retired).
 *
 * What is held, each as a PROPERTY of the source (comments stripped) or of the
 * pure decisions, run for real:
 *   1. the three words, in order, drawn by the one segmented control;
 *   2. no fold, `<Section>` or `sn-tile` box left in the body;
 *   3. every › is a plain link OUT of Event Details;
 *   4. no file under `details/` imports `hubDraftAction`, `HubDraftField` or
 *      `HubDraftDock` (sabotage: re-import the dock → red);
 *   5. a Settled row mounts no editor (sabotage: give Kind a PickMenu → red);
 *   6. Put this away is last, outside the three bodies;
 *   7. honest reads — a failed or hidden read never becomes "0".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { joinOneOpen } from '@/lib/one-open';
import { COULD_NOT_LOAD, HIDDEN_BY_THE_COUPLE } from '@/lib/event-details-sheet';
import {
  DETAILS_SEGMENTS,
  FAILED,
  HIDDEN,
  guestsLine,
  hubLine,
  moneyLine,
  ok,
  parseDetailsView,
  purchasesLine,
  suppliersLine,
} from '@/lib/event-details-segments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const D = 'app/dashboard/[eventId]/details';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE = read(`${D}/page.tsx`);
const SEGMENTS = read(`${D}/_components/details-segments.tsx`);
const FOLD = read(`${D}/_components/details-fold.tsx`);

/** The source between `const <name> =` and the next top-level `const` of the page. */
function block(name: string): string {
  const at = PAGE.indexOf(`const ${name} =`);
  assert.ok(at > 0, `the page has no ${name}`);
  const next = PAGE.indexOf('\n  const ', at + 1);
  return PAGE.slice(at, next < 0 ? undefined : next);
}

test('three segments — Event · Access · Settings — on the one segmented control', () => {
  assert.deepEqual(
    DETAILS_SEGMENTS.map((s) => s.title),
    ['Event', 'Access', 'Settings'],
  );
  assert.match(SEGMENTS, /DETAILS_SEGMENTS\.map\(/, 'the control does not draw the three segments');
  assert.match(SEGMENTS, /className=\{I_SEGMENTED_CLASS\}/, 'not the app’s one segmented track');
  assert.match(SEGMENTS, /iSegClass\(on, 'wine'\)/, 'the chosen segment is not in Setnayan wine');
  assert.match(SEGMENTS, /\bsn-glass-row\b/, 'the pinned line is not the floating row’s glass');
  assert.match(SEGMENTS, /\bsticky top-0\b/, 'the line and the segments are not pinned');
  // One body each, all from the server, shown by the tap.
  assert.match(PAGE, /bodies=\{\{ event: eventBody, access: accessBody, settings: settingsBody \}\}/);
  assert.match(PAGE, /parseDetailsView\(flashParams\.view/, 'the address does not pick the segment');
  assert.equal(parseDetailsView('access'), 'access');
  assert.equal(parseDetailsView('<script>'), 'event');
  assert.equal(parseDetailsView(undefined), 'event');
});

test('no fold, no section, no box — the four folds are gone', () => {
  for (const gone of ['<RecordFold', '<Section', 'sn-tile', 'Finish your Event Hub', 'data-record-finish']) {
    assert.ok(!PAGE.includes(gone), `Event Details still draws ${gone}`);
  }
  // The Finish card folded into the Event Hub row's summary (owner question 1, "yes").
  assert.match(PAGE, /hubLine\(\{ look: theme\.name, font: headingFont, done: guide\?\.done \?\? null, total: guide\?\.total \?\? null \}\)/);
});

test('every › is a plain link OUT of Event Details', () => {
  const jumps = [...PAGE.matchAll(/<JumpRow\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.ok(jumps.length >= 8, `only ${jumps.length} jump rows — the scan is not measuring the page`);
  for (const j of jumps) {
    const href = /href=\{([\s\S]*?)\}\s*(?:\/>|\w+=)/.exec(j)?.[1] ?? '';
    assert.ok(href.includes('${base}/'), `a › row has no home of its own: ${j.slice(0, 80)}`);
    assert.ok(!/\/details\b/.test(href), `a › row jumps back into Event Details: ${href}`);
  }
  const rows = read(`${D}/_components/details-rows.tsx`);
  const jumpRow = rows.slice(rows.indexOf('export function JumpRow('), rows.indexOf('export function PlainRow('));
  assert.match(jumpRow, /<RecordRowLink row=\{row\} href=\{href\} recordHref=\{href\}>/, 'a › row is not a plain link');
  assert.doesNotMatch(jumpRow, /onClick=/);
  // No go-edit-elsewhere wording (owner 2026-09-28).
  assert.doesNotMatch(PAGE, /Edit in |↗|Open (Budget|Suppliers|Services|Purchases|Guest list)/);
});

test('no file under details/ writes the Event Hub draft — no Undo · Apply', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) files.push(p);
    }
  };
  walk(join(WEB, D));
  assert.ok(files.length >= 15, `only ${files.length} files under details/ — the walk is not measuring the folder`);
  const offenders = files.filter((f) => /\b(hubDraftAction|HubDraftField|HubDraftDock)\b/.test(stripComments(readFileSync(f, 'utf8'))));
  assert.deepEqual(offenders.map((f) => relative(WEB, f)), [], 'a file under details/ reaches the Event Hub draft');
  for (const gone of ['overlayHubDraftEvent', 'readHubDraft', 'Waiting for Apply', 'RECORD_ROW_TOOL']) {
    assert.ok(!PAGE.includes(gone), `Event Details still carries ${gone}`);
  }
});

test('a Settled row mounts no editor', () => {
  const editors = /<(FieldRow|DetailsFold|PickMenu|AreaPick|CostsPick|Switch|PlanMyselfRow)\b/;
  // Date · Venue · Suppliers are › or plain rows in either state.
  for (const name of ['dateRow', 'venueRow', 'suppliersRow']) assert.doesNotMatch(block(name), editors, `${name} mounts an editor`);
  // Kind and the guest count: the editor only while NOT settled; the settled branch is a plain row.
  for (const [name, flag] of [['kindRow', 'kindSettled'], ['estimateRow', 'estimateSettled']] as const) {
    const src = block(name);
    assert.match(src, new RegExp(`!${flag} && [^?]*\\? \\(\\s*<FieldRow\\b`), `${name} opens an editor while settled`);
    const settledBranch = src.slice(src.lastIndexOf(') : ('));
    assert.match(settledBranch, /^\) : \(\s*<PlainRow\b[^]*?\/>\s*\);?\s*$/, `${name}'s settled branch is not one plain row`);
    assert.doesNotMatch(settledBranch, editors, `${name}'s settled branch mounts an editor`);
  }
  // Membership comes from the lock source, row by row.
  assert.match(PAGE, /\(dateSettled \? settled : open\)\.push/);
  assert.match(PAGE, /\(kindSettled \? settled : open\)\.push/);
  assert.match(PAGE, /<SettledGroup title=\{SETTLED\} note=\{SETTLED_NOTE\}>/);
  assert.doesNotMatch(PAGE, /<Lock\b|Fixed by your booking/, 'a padlock per row came back');
});

test('Put this away is the last row, after the three bodies, un-boxed', () => {
  const segments = PAGE.indexOf('<DetailsSegments');
  const away = PAGE.indexOf('data-section="put-away"');
  assert.ok(segments > 0 && away > segments, 'Put this away is not after the segments');
  assert.match(PAGE.slice(away), /<DetailsFold\s+row="put-away"[\s\S]*?<PutAwayCard\b[^>]*\bbare\b/);
});

test('the money rows are never kept as last-seen data', () => {
  for (const row of ['money', 'purchases']) {
    assert.match(PAGE, new RegExp(`row="${row}"[^>]*\\bmoney\\b`), `${row} is not marked money`);
  }
});

test('one open at a time — a ⌄ row joins the app’s one mechanism; a dropdown inside it is its child', () => {
  assert.match(FOLD, /const id = useOneOpen\(open, setOpen\);/);
  assert.match(FOLD, /<OneOpenScope id=\{id\}>\{children\}<\/OneOpenScope>/);
  const state: Record<string, boolean> = { area: false, costs: false, pick: false };
  const leave: Record<string, () => void> = {};
  const open = (id: string, chain: string[] = []) => {
    state[id] = true;
    leave[id] = joinOneOpen(id, chain, () => {
      state[id] = false;
      leave[id]?.();
    }, true);
  };
  open('area');
  open('pick', ['area']);
  assert.deepEqual(state, { area: true, costs: false, pick: true }, 'the dropdown folded its own row');
  open('costs');
  assert.deepEqual(state, { area: false, costs: true, pick: false }, 'two rows open at once');
  for (const id of Object.keys(leave)) leave[id]?.();
});

test('honest reads: failed and hidden are words, never 0', () => {
  assert.equal(guestsLine(FAILED), COULD_NOT_LOAD);
  assert.equal(guestsLine(HIDDEN), HIDDEN_BY_THE_COUPLE);
  assert.equal(guestsLine(ok({ listed: 180, replied: 96, asking: 3 })), '180 listed · 96 replied · 3 asking to join');
  assert.equal(guestsLine(ok({ listed: 0, replied: 0, asking: 0 })), 'None listed yet');
  assert.equal(moneyLine(FAILED), COULD_NOT_LOAD);
  assert.equal(moneyLine(HIDDEN), HIDDEN_BY_THE_COUPLE);
  assert.match(moneyLine(ok({ paid: 62000, owed: 84000, target: 180000 })), /paid · .* to go · target /);
  assert.equal(purchasesLine({ pro: ok(true), ai: true, papic: ok({ remaining: 40, total: 50 }), paid: HIDDEN }), HIDDEN_BY_THE_COUPLE);
  assert.equal(purchasesLine({ pro: FAILED, ai: false, papic: ok(null), paid: ok(0) }), COULD_NOT_LOAD);
  assert.doesNotMatch(purchasesLine({ pro: ok(false), ai: false, papic: ok(null), paid: ok(0) }), /₱0|\b0\b/);
  assert.equal(suppliersLine(FAILED), COULD_NOT_LOAD);
  assert.equal(suppliersLine(ok([])), 'None booked yet');
  assert.equal(hubLine({ look: 'Classic', font: 'Cormorant', done: 9, total: 18 }), 'Classic · Cormorant · 9 of 18 in place');
  // The page builds each from its read, never a bare default.
  assert.match(PAGE, /= moneyHidden \? HIDDEN : FAILED;/);
  assert.match(PAGE, /!mayReadGuests\s*\?\s*HIDDEN/);
});

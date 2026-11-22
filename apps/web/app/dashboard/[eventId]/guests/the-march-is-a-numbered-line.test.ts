/**
 * the-march-is-a-numbered-line.test.ts — 🚶 GUESTS › MARCH READS LIKE THE PRINTED PROGRAM (Guests redesign § 7).
 *
 * Owner, 20 Nov 2026, on `prototypes/guests_redesign_2026-11-20` (*"Yes, your picks"*, then *"Yes, build it"*): one line
 * down the page with a numbered step for each walk; headings on the line; one frame per name, none around the walk; the
 * role a small caption; a grip at the right moves the whole walk; the counts one line of words; Preview the one
 * terracotta button, now in the top row.
 *
 *   1 · THE COUNT TILES ARE GONE — one line of words; "not walking" still opens the Not walking tray.
 *   2 · PREVIEW IS IN THE TOP ROW — a portal into the Guests screen's own seat (`lens.toolsSlot`).
 *   3 · NO BOX AROUND A WALK, NO "N walks" BESIDE A HEADING — in Guests; the step is a circle on the line and the grip
 *       at the right is the walk's handle. The Maker's own march keeps its shipped look.
 *
 * Each goes red if undone: `<ViewCountRow` back (1) · the portal's target changed (2) · the walk's ring/box or the
 * heading's count drawn in Guests again (3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const MARCH = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'details-march.tsx'), 'utf8'));

test('1 · the counts are ONE line of words — no tiles — and "not walking" still opens the tray', () => {
  assert.doesNotMatch(MARCH, /ViewCountRow|view-summary-lazy|tiles=\{/, 'the count tiles are back');
  const line = MARCH.slice(MARCH.indexOf('data-march-count-line=""'), MARCH.indexOf('{lens?.toolsSlot'));
  assert.ok(line.length > 0, 'the count line moved — re-aim this guard');
  assert.match(line, /\{formatCount\(walks\)\}<\/b> \{walks === 1 \? 'walk' : 'walks'\}/);
  assert.match(line, /\{formatCount\(people\)\}<\/b> walking/);
  assert.match(line, /<button[\s\S]*?data-march-count-out=""[\s\S]*?querySelector\('\[data-march-tray-slot\]'\)\?\.scrollIntoView[\s\S]*?not walking\s*<\/button>/, '"not walking" no longer opens the tray');
  // An unread tray is never a 0.
  assert.match(line, /\{outUnread \? '—' : formatCount\(shownOut\.length\)\}/);
});

test('2 · Preview is the one terracotta button, in the Guests top row', () => {
  const at = MARCH.indexOf('{lens?.toolsSlot');
  assert.notEqual(at, -1, 'Preview left the top row’s seat');
  const btn = MARCH.slice(at, at + 1100);
  assert.match(btn, /createPortal\(\s*<span data-march-preview=""[\s\S]*?<\/span>,\s*lens\.toolsSlot,\s*\)/, 'Preview is not drawn into the top row');
  assert.match(btn, /tone="brand"\s+filled/);
  assert.match(btn, /label=\{play === null \? 'Preview' : 'Stop'\}/);
  assert.equal((MARCH.match(/data-march-preview=""/g) ?? []).length, 1, 'there are two Previews');
  assert.equal((MARCH.match(/tone="brand"/g) ?? []).length, 1, 'March has a second terracotta button');
});

test('3 · a numbered line: a step circle per walk, no box around the walk, no "N walks" beside a heading', () => {
  // The line itself, per section, only in Guests.
  assert.match(MARCH, /data-march-line=\{guests \? '' : undefined\}/);
  assert.match(MARCH, /const MARCH_LINE = 'before:pointer-events-none before:absolute before:bottom-0 before:left-4 before:top-0 before:w-px /);
  // The walk's row: in Guests no card (no bg, no ring, no padding box) — the box is the Maker's branch only.
  const row = MARCH.slice(MARCH.indexOf('data-march-walk={step}'), MARCH.indexOf('<PairBox guests={guests}>'));
  const guestsBranch = /guests\s*\? '([^']*)'\s*:/.exec(row)?.[1];
  assert.ok(guestsBranch, 'the walk row moved — re-aim this guard');
  assert.doesNotMatch(guestsBranch!, /\bring-|\bbg-|rounded-xl|\bborder\b|\bp-1\.5\b/, 'the outer box around a walk is back in Guests');
  assert.match(guestsBranch!, /grid-cols-\[2rem_minmax\(0,1fr\)_2rem\]/, 'the walk is not step · names · grip');
  assert.match(row, /\{guests \? \(\s*<span\s+aria-hidden\s+data-march-no=""[\s\S]*?rounded-full border-\[1\.5px\]/, 'the step is not a circle on the line');
  // The grip at the right is the walk's handle (the shipped walk drag).
  assert.match(MARCH, /<span\s+\{\.\.\.walkHandle\}\s+data-march-grip=""[\s\S]*?<GripVertical/);
  // The heading: no count beside it in Guests.
  assert.match(MARCH, /\{guests \? null : \(\s*<small[^>]*>\s*\{sec\.rows\.length\} walk\{sec\.rows\.length === 1 \? '' : 's'\}\s*<\/small>\s*\)\}/, 'the "N walks" count is beside a heading in Guests again');
  // The role is a small caption under the name, in sentence case.
  assert.match(MARCH, /data-march-role="" className=\{guests \? 'mt-0\.5 text-\[12px\] leading-tight text-ink\/70' :/);
  // Kept: Undo and "Put the sections back in their usual order".
  assert.match(MARCH, /action=\{toast\.undo \? \{ label: 'Undo', onPress: undo \} : undefined\}/);
  assert.match(MARCH, /label="Put the sections back in their usual order"/);
});

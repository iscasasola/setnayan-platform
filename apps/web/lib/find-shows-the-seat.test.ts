/**
 * find-shows-the-seat.test.ts — 🔎 SEAT PLAN C · SEARCH SHOWS THE SEAT ON 2D (owner 28 Nov 2026, DECISION_LOG;
 * `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.5; drawing `prototypes/seating_later_2026-11-27/` C).
 *
 * Shipped before: on 2D, Enter in Search lit the TABLE (`setHighlightId`); 3D walked there (Guide me). Now:
 *   1 · on 2D the found guest's SEAT lights — a ring that stays lit, and a pulse that runs TWICE (transform + opacity,
 *       the Move speed on Settle, `lib/motion-table.ts`); reduced motion keeps only the lit ring;
 *   2 · a pill "Name · Table · Seat N" sits over the thumb row; a tap opens their table (Seats › List, risen);
 *   3 · the field says "1 of N", and Enter on the same words steps to the next one found (new words start at the first);
 *   4 · the count is drawn by the ONE thumb row (`ThumbField.count`), never a second search box.
 *
 * SABOTAGE (each seen red, then restored): `foundSeatId` no longer read by the chair → 1 · `(found.at + 1)` → `0` → 3.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const WEB = join(__dirname, '..');
const ED = readFileSync(join(WEB, 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8');
const ROW = readFileSync(join(WEB, 'components/thumb-row.tsx'), 'utf8');
const goTo = ED.slice(ED.indexOf('const goToFound = '), ED.indexOf('const foundPill ='));

test('1 · on 2D, Find lights the SEAT, not only the table — two pulses, then it stays lit', () => {
  assert.match(goTo, /setHighlightId\(g\.seated_table_id\);[\s\S]{0,120}requestAnimationFrame\(\(\) => zoomToTable\(tid\)\)/, 'the table is not brought close enough to draw its chairs');
  assert.match(ED, /const z1 = clampZoom\(Math\.max\(zoomRef\.current, DETAIL_AT \* 1\.15\)\);/, 'Find zooms out, or not to where chairs are drawn');
  assert.match(goTo, /const foundSeatId = roomOnly && foundGuest\?\.seated_table_id \? foundGuest\.guest_id : null;/, 'the seat is not lit on 2D');
  assert.match(ED, /\{foundSeatId === occupant\.guest_id \? <FoundSeatRing key=\{found\?\.tick\} still=\{reducedMotion\} \/> : null\}/, 'the chair does not draw the lit seat');
  const ring = ED.slice(ED.indexOf('function FoundSeatRing('));
  assert.match(ring, /iterations: 2/, 'the seat does not pulse twice');
  assert.match(ring, /duration: MOVE_MS, easing: EASE_SETTLE/, 'the pulse is not the Move speed on Settle');
  assert.match(ring, /transform: 'scale\(1\.9\)', opacity: 0/);
  assert.doesNotMatch(ring, /\b(width|height|top|left|box-shadow)\s*:/, 'the pulse animates more than transform and opacity');
  assert.match(ring, /data-seat-found="" className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-terracotta"/, 'the seat does not stay lit');
  assert.match(ring, /\{still \? null : <span ref=\{pulse\}/, 'reduced motion still pulses');
});

test('2 · a pill "Name · Table · Seat N" — its tap opens their table', () => {
  const pill = ED.slice(ED.indexOf('const foundPill ='), ED.indexOf('const foundPill =') + 900);
  assert.match(pill, /label=\{`\$\{foundGuest\.name\} · \$\{tableLabelById\.get\(foundGuest\.seated_table_id\)/, 'the pill does not say name · table');
  assert.match(pill, /` · Seat \$\{formatCount\(foundGuest\.seat_number \+ 1\)\}`/, 'the pill does not say the seat');
  assert.match(pill, /onClick=\{openFoundTable\}/);
  const open = ED.slice(ED.indexOf('const openFoundTable = '), ED.indexOf('const foundPill ='));
  assert.match(open, /onSelectView\('list'\)/);
  assert.match(open, /setFaceOpen\(new Set\(\[unit\.key\]\)\)/, 'the pill does not raise their table');
  assert.match(ED, /<OverThumbRow mark="legend">\s*\{\/\*[^*]*\*\/\}\s*\{foundPill\}/, 'the pill is not over the thumb row');
});

test('3 · "1 of N", and Enter steps to the next one found', () => {
  assert.match(goTo, /const at = found && found\.words === words \? \(found\.at \+ 1\) % list\.length : 0;/, 'Enter does not step to the next match');
  assert.match(ED, /const findCount = lens && seatQ \? \(foundList\.length \? `\$\{formatCount\(foundAt \+ 1\)\} of \$\{formatCount\(foundList\.length\)\}` : 'No match'\) : null;/);
  assert.match(ED, /if \(v\) goToFound\(v\);/, 'Enter no longer finds');
});

test('4 · the count is the ONE thumb row’s', () => {
  assert.match(ED, /placeholder: 'Search guests',\s*count: findCount,/);
  assert.match(ROW, /count\?: string \| null;/);
  assert.match(ROW, /\{field\.count \? \(\s*<span className=\{`\$\{styles\.count\}[^`]*text-sn-sm[^`]*`\} data-thumb-count="" aria-live="polite">/, 'the count is not drawn in the field');
  assert.match(readFileSync(join(WEB, 'components/thumb-row.module.css'), 'utf8'), /\.field:not\(:focus-within\) > \.count \{ display: none; \}/, 'a folded search still draws its count');
  assert.match(readFileSync(join(WEB, 'components/thumb-row.module.css'), 'utf8'), /@container \(max-width: 160px\) \{ \.count \{ display: none; \} \}/, 'a narrow field clips its count');
});

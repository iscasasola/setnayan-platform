/**
 * 🚶 THE MAKER'S PAGE SHOWS THE DRAFTED WEDDING MARCH (owner 2026-10-07,
 * DECISION_LOG "SIX BUILD QUESTIONS SETTLED" (3)): the entourage scene on the
 * Maker canvas reads the march draft like the march editor does; guests keep
 * the live order until Apply.
 *
 * Driven the way production runs it: the live rows → the march editor's own
 * picture (`marchSections`) → the drafted steps laid on (`replayMarch`) →
 * written back (`printedRowsAsDrafted`) → the ONE printer (`buildEntourage`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEntourage, type EntourageGroup, type EntourageGuestRow } from './entourage';
import { marchSections, marchTray, printedSectionOrder } from './march-sections';
import { leadOf, replayMarch, type MarchStep } from './march-drag';
import { printedRowsAsDrafted } from './march-draft-print';
import { stripComments } from './strip-comments';

const row = (id: string, first: string, role: string, walk: number | null, place = 0): EntourageGuestRow => ({
  guest_id: id,
  first_name: first,
  last_name: 'Cruz',
  role,
  march: walk === null ? null : { walk_no: walk, place_in_walk: place },
});

/** Two Ninong–Ninang pairs, then a bridesmaid pair-off. */
const ROWS: EntourageGuestRow[] = [
  row('g1', 'Andres', 'principal_sponsor_ninong', 1, 0),
  row('g2', 'Bea', 'principal_sponsor_ninang', 1, 1),
  row('g3', 'Carlo', 'principal_sponsor_ninong', 2, 0),
  row('g4', 'Dina', 'principal_sponsor_ninang', 2, 1),
  row('g5', 'Ella', 'bridesmaid', 3, 1),
  row('g6', 'Fred', 'groomsman', 3, 0),
];

/** The Maker canvas's entourage: live + the draft, through the one printer. */
function drafted(steps: MarchStep[]): EntourageGroup[] {
  const walking = buildEntourage(ROWS, null, {}, undefined, { march: true });
  const live = { sections: marchSections(walking), printed: printedSectionOrder(walking, null), out: marchTray([]) };
  const d = printedRowsAsDrafted(ROWS, replayMarch(live, steps));
  return buildEntourage(d.rows, d.sectionOrder);
}
const firsts = (g: EntourageGroup | undefined) => (g?.rows ?? []).map((r) => r.map((p) => p?.name.split(' ')[0] ?? '·').join('+'));
const group = (gs: EntourageGroup[], key: string) => gs.find((g) => g.key === key);

test('no drafted moves → the canvas prints exactly the live entourage', () => {
  assert.deepEqual(drafted([]), buildEntourage(ROWS));
});

test('🔴 a drafted reorder shows on the canvas — the second pair walks first', () => {
  const live = buildEntourage(ROWS);
  assert.deepEqual(firsts(group(live, 'principal_sponsors')), ['Andres+Bea', 'Carlo+Dina'], 'fixture is wrong');
  const walking = buildEntourage(ROWS, null, {}, undefined, { march: true });
  const sec = marchSections(walking).find((s) => s.key === 'principal_sponsors')!;
  const leads = [...sec.rows].reverse().map(leadOf);
  const got = drafted([{ kind: 'order', section: 'principal_sponsors', leads }]);
  assert.deepEqual(firsts(group(got, 'principal_sponsors')), ['Carlo+Dina', 'Andres+Bea'], 'the canvas still prints the live order');
});

test('🔴 a drafted swap re-pairs on the canvas', () => {
  const got = drafted([{ kind: 'swap', section: 'principal_sponsors', a: 'g2', b: 'g4' }]);
  assert.deepEqual(firsts(group(got, 'principal_sponsors')), ['Andres+Dina', 'Carlo+Bea']);
});

test('🔴 a drafted section move changes the printed section order on the canvas', () => {
  const before = buildEntourage(ROWS).map((g) => g.key);
  const got = drafted([{ kind: 'section', section: 'bridesmaids_groomsmen', direction: 'up' }]).map((g) => g.key);
  assert.notDeepEqual(got, before, 'the section did not move');
  assert.ok(got.indexOf('bridesmaids_groomsmen') < got.indexOf('principal_sponsors'));
});

test('the guest page passes the HOST’s draft only — a guest reads the live march', () => {
  const page = stripComments(readFileSync(join(__dirname, '../app/[slug]/page.tsx'), 'utf8'));
  assert.match(page, /entourage: await loadEntourage\([\s\S]*?hostDraft\?\.march\?\.flat\(\),\s*\)/, 'the canvas no longer reads the drafted march');
  const loaders = stripComments(readFileSync(join(__dirname, '../app/[slug]/_lib/loaders.ts'), 'utf8'));
  assert.match(loaders, /if \(marchSteps\?\.length\) \{[\s\S]{0,400}?await draftedMarchPrint\(/, 'loadEntourage ignores the drafted steps');
});

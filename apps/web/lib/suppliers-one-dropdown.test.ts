/**
 * suppliers-one-dropdown.test.ts — 📌 SUPPLIERS' TOP ROW IS ONE DROPDOWN, AND EVERY OLD DOOR STILL LANDS.
 *
 * Owner 2026-10-30, "all yes" (DECISION_LOG "ONE SELECTOR FOR EVERY PAGE — COUPLE · SUPPLIER · ADMIN"): the segmented
 * Find | Build | Booked row becomes the same `Page · View ▾` dropdown. Owner 2026-10-31, live iPhone: *"Suppliers. needs
 * to have that drop down effect to be able to safely integrate all. Booked has the 3 drop down Team, Budget, and
 * Schedule"*. Held, each as a PROPERTY:
 *   1. ONE dropdown on the row (the shared compact PickMenu), at rest and pinned alike — no segmented row anywhere on
 *      the Suppliers screen, no face laid over one, and no second "Team ▾ / Schedule ▾" row in a Booked part.
 *   2. The dropdown lists Find · Build · each of Booked's parts (Team · Budget · Schedule), Build and Team with counts.
 *   3. Every old address still lands: each `?tab=` key opens its body, `?part=` its part, `?settings=1` the ⚙ sheet,
 *      `/schedule?view=…` the Schedule part with its view.
 *
 * Sabotage (2026-10-31, each reverted, each red): an `<ISegmented` put back in the row · `bookedParts.map` dropped from
 * the options · `<PickMenu` added to `booked-part-row.tsx` · the `?tab=` adoption effect deleted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { BUDGET_BUILD_TABS } from './budget-build';
import { SUPPLIERS_MODE_TAB, suppliersModeOfTab } from './suppliers-shell';
import { bookedParts } from './pillar-parts';

const V = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const read = (...p: string[]) => stripComments(readFileSync(join(...p), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('1 · the row is ONE dropdown (the shared compact face) — no segmented row, no second Booked row', () => {
  const shell = read(V, '_components', 'services-takeover.tsx');
  const at = shell.indexOf('data-suppliers-stick=""');
  const row = shell.slice(shell.lastIndexOf('<div', at), shell.indexOf('<MenuSettingsButton', at));
  assert.equal(count(row, /<PickMenu\b/g), 1, 'the row holds more or less than ONE dropdown');
  assert.match(row, /<PickMenu\b[^>]*\bcompact\b/, 'the row’s dropdown is not the shared compact face');
  assert.doesNotMatch(row, /<PickMenu\b[^>]*\b(trigger|className)=/, 'the row’s dropdown wears a local look');
  for (const f of ['services-takeover.tsx', 'booked-part-row.tsx', 'booked-body.tsx', 'booked-part-page.tsx']) {
    const src = read(V, '_components', f);
    assert.equal(count(src, /<ISegmented\b|<ISeg\b|I_SEGMENTED_CLASS|<PillTrack\b|role="tablist"|data-sup-face/g), 0, `${f} draws a segmented row`);
  }
  assert.equal(count(read(V, '_components', 'booked-part-row.tsx'), /<PickMenu\b/g), 0, 'a Booked part draws its own second dropdown again');
});

test('2 · the dropdown lists Find · Build · Booked › Team · Budget · Schedule, with Build’s and Team’s counts', () => {
  const shell = read(V, '_components', 'services-takeover.tsx');
  assert.match(shell, /\{ key: 'find', label: SUPPLIERS_MODE_LABEL\.find \}/);
  assert.match(shell, /\{ key: 'build', label: SUPPLIERS_MODE_LABEL\.build, trail: buildCount \?/);
  assert.match(shell, /bookedParts\.map\(\(p\) => \(\{\s*key: `booked-\$\{p\.key\}`,\s*label: `\$\{SUPPLIERS_MODE_LABEL\.booked\} · \$\{p\.label\}`,\s*trail: p\.key === 'team' && bookedCount > 0/);
  assert.deepEqual(bookedParts({ eventId: 'E', budgetEnabled: true }).map((p) => p.key), ['team', 'budget', 'schedule']);
});

test('3 · every old address still lands on the same view', () => {
  // Each `?tab=` key opens a body, and the body's own key is one of them (the bus is unchanged).
  for (const tab of BUDGET_BUILD_TABS) assert.ok(['find', 'build', 'booked'].includes(suppliersModeOfTab(tab)), tab);
  for (const [mode, tab] of Object.entries(SUPPLIERS_MODE_TAB)) assert.equal(suppliersModeOfTab(tab), mode);
  const shell = read(V, '_components', 'services-takeover.tsx');
  assert.match(shell, /new URLSearchParams\(window\.location\.search\)\.get\('tab'\)/, 'a `?tab=` written while loading is no longer adopted');
  assert.match(shell, /window\.addEventListener\(BB_TAB_EVENT, onTab\)/, 'the bus no longer swaps the body');
  const page = read(V, 'page.tsx');
  assert.match(page, /if \(sp\.part === YOUR_TEAM_BUDGET_PART\)/, '`?part=budget` no longer lands');
  assert.match(page, /if \(sp\.part === BOOKED_SCHEDULE_PART\)[\s\S]*?view: sp\.view/, '`?part=schedule` lost its `?view=`');
  assert.match(page, /settingsOpenAtFirst=\{/, '`?settings=1` no longer opens the ⚙ sheet');
  const sched = read(V, '..', 'schedule', 'page.tsx');
  assert.match(sched, /const q = new URLSearchParams\(\{ part: BOOKED_SCHEDULE_PART \}\);[\s\S]*?view: viewParam/, '/schedule?view= no longer forwards with its view');
  assert.match(sched, /viewParam === 'journey' \|\| viewParam === 'preparation' \|\| viewParam === 'event-day'/, '`?view=` no longer picks the view');
});

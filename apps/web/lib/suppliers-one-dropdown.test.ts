/**
 * suppliers-one-dropdown.test.ts — 📌 SUPPLIERS' TOP ROW IS ONE DROPDOWN, AND EVERY OLD DOOR STILL LANDS.
 *
 * Owner 2026-10-30, "all yes" (DECISION_LOG "ONE SELECTOR FOR EVERY PAGE — COUPLE · SUPPLIER · ADMIN"): the segmented
 * Find | Build | Booked row becomes the same `Page · View ▾` dropdown. Owner 2026-11-02 ("BOOKED IS JUST THE TEAM"):
 * *"no just schedule"* · *"and booked-team will just be booked."* — Booked's Team · Budget · Schedule parts are gone.
 * Held, each as a PROPERTY:
 *   1. ONE dropdown on the row (the shared compact PickMenu), at rest and pinned alike — no segmented row anywhere on
 *      the Suppliers screen, and no Booked part row (`booked-part-row.tsx` is deleted).
 *   2. The dropdown lists exactly Find · Build · Booked — never Schedule or Budget — Build and Booked with counts.
 *   3. Every old address still lands: each `?tab=` key opens its body, `?part=budget|schedule` FORWARDS to its own page
 *      with its query, `?settings=1` opens the ⚙ sheet.
 *
 * Sabotage (2026-11-02, each reverted, each red): a `Booked · Schedule` option put back in `faceOptions` (2) · the
 * `?part=schedule` forward deleted (3) · an `<ISegmented` put back in the row (1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { BUDGET_BUILD_TABS } from './budget-build';
import { SUPPLIERS_MODE_TAB, suppliersModeOfTab } from './suppliers-shell';

const V = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const read = (...p: string[]) => stripComments(readFileSync(join(...p), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('1 · the row is ONE dropdown (the shared compact face) — no segmented row, no Booked part row', () => {
  const shell = read(V, '_components', 'services-takeover.tsx');
  const at = shell.indexOf('data-suppliers-stick=""');
  const row = shell.slice(shell.lastIndexOf('<div', at), shell.indexOf('<MenuSettingsButton', at));
  assert.equal(count(row, /<PickMenu\b/g), 1, 'the row holds more or less than ONE dropdown');
  assert.match(row, /<PickMenu\b[^>]*\bcompact\b/, 'the row’s dropdown is not the shared compact face');
  assert.doesNotMatch(row, /<PickMenu\b[^>]*\b(trigger|className)=/, 'the row’s dropdown wears a local look');
  for (const f of ['services-takeover.tsx', 'booked-body.tsx']) {
    const src = read(V, '_components', f);
    assert.equal(count(src, /<ISegmented\b|<ISeg\b|I_SEGMENTED_CLASS|<PillTrack\b|role="tablist"|data-sup-face/g), 0, `${f} draws a segmented row`);
  }
  for (const gone of ['booked-part-row.tsx', 'booked-part-page.tsx']) {
    assert.ok(!existsSync(join(V, '_components', gone)), `${gone} is back — Booked is just the team`);
  }
});

test('2 · the dropdown lists exactly Find · Build · Booked — never Schedule or Budget', () => {
  const shell = read(V, '_components', 'services-takeover.tsx');
  const opts = shell.slice(shell.indexOf('const faceOptions'), shell.indexOf('];', shell.indexOf('const faceOptions')));
  assert.deepEqual([...opts.matchAll(/key: '([a-z-]+)'/g)].map((m) => m[1]), ['find', 'build', 'booked']);
  assert.doesNotMatch(opts, /Schedule|Budget|bookedParts|\.map\(/, 'the dropdown lists a Booked part again');
  assert.match(opts, /\{ key: 'build', label: SUPPLIERS_MODE_LABEL\.build, trail: buildCount \?/, 'Build lost its count');
  assert.match(opts, /\{ key: 'booked', label: SUPPLIERS_MODE_LABEL\.booked, trail: bookedCount > 0/, 'Booked lost its count');
});

test('3 · every old address still lands on the same view', () => {
  // Each `?tab=` key opens a body, and the body's own key is one of them (the bus is unchanged).
  for (const tab of BUDGET_BUILD_TABS) assert.ok(['find', 'build', 'booked'].includes(suppliersModeOfTab(tab)), tab);
  for (const [mode, tab] of Object.entries(SUPPLIERS_MODE_TAB)) assert.equal(suppliersModeOfTab(tab), mode);
  const shell = read(V, '_components', 'services-takeover.tsx');
  assert.match(shell, /new URLSearchParams\(window\.location\.search\)\.get\('tab'\)/, 'a `?tab=` written while loading is no longer adopted');
  assert.match(shell, /window\.addEventListener\(BB_TAB_EVENT, onTab\)/, 'the bus no longer swaps the body');
  const page = read(V, 'page.tsx');
  assert.match(page, /if \(sp\.part === YOUR_TEAM_BUDGET_PART\) redirect\(budgetPageHref\(eventId, \{ pay: sp\.pay \}\)\);/, 'an old `?part=budget` no longer lands on the Budget page');
  assert.match(page, /if \(sp\.part === BOOKED_SCHEDULE_PART\) \{\s*redirect\(\s*schedulePageHref\(eventId, \{ view: sp\.view,/, 'an old `?part=schedule` no longer lands on the Schedule page with its view');
  assert.match(page, /settingsOpenAtFirst=\{/, '`?settings=1` no longer opens the ⚙ sheet');
  const sched = read(V, '..', 'schedule', 'page.tsx');
  assert.match(sched, /viewParam === 'preparation' \|\| viewParam === 'event-day'/, '`?view=` no longer picks the view');
});

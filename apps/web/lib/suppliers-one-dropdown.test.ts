/**
 * suppliers-one-dropdown.test.ts — 🛒 SUPPLIERS' TOP ROW IS FIND · BUILD · BOOK, AND EVERY OLD DOOR STILL LANDS.
 *
 * ⚠ SUPERSEDED IN PART, 2026-11-17 (owner: *"technically this is like search, view cart and ordered on a shopping
 * app"* · *"the find build book"*; drawing v15 — it overturns the 30 Oct one-selector rule for Suppliers ONLY). Tests 1
 * and 2 now hold the new row: three plain steps with READ badges (cart = picks not yet asked · orders = a first payment
 * to make), no dropdown, no fraction, no ▶. Test 3 (every old door lands) is unchanged. The history below is kept.
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
import { SUPPLIERS_MODES, SUPPLIERS_MODE_TAB, suppliersModeOfTab } from './suppliers-shell';

const V = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const read = (...p: string[]) => stripComments(readFileSync(join(...p), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('1 · the row is THREE plain steps — Find · Build · Book — and ⚙; no dropdown, no fraction, no ▶ next (owner 2026-11-17)', () => {
  const shell = read(V, '_components', 'services-takeover.tsx');
  const at = shell.indexOf('data-suppliers-stick=""');
  const row = shell.slice(shell.lastIndexOf('<div', at), shell.indexOf('<MenuSettingsButton', at));
  assert.equal(count(row, /<PickMenu\b/g), 0, 'a dropdown is back on the Suppliers row — the 17 Nov ruling replaced it');
  assert.doesNotMatch(row, /data-sup-row-next|SUPPLIERS_NEXT_MODE|ChevronRight/, 'the ▶ next button is back');
  assert.doesNotMatch(row, /<CoverCount\b|sup-row-filled|tally\.filled/, 'a fraction is back on the row (it moved to one quiet line in Build)');
  assert.match(row, /SUPPLIERS_MODES\.map\(/, 'the steps are no longer the three modes, in their order');
  assert.match(row, /onClick=\{\(\) => \{\s*if \(!on\) goToBuildTab\(SUPPLIERS_MODE_TAB\[m\]\)/, 'a step no longer goes through the shipped bus');
  assert.match(row, /aria-current=\{on \? 'page' : undefined\}/, 'the step you are on is not said to a screen reader');
  for (const f of ['services-takeover.tsx', 'booked-body.tsx']) {
    const src = read(V, '_components', f);
    assert.equal(count(src, /<ISegmented\b|<ISeg\b|I_SEGMENTED_CLASS|<PillTrack\b|role="tablist"|data-sup-face/g), 0, `${f} draws a segmented row`);
  }
  for (const gone of ['booked-part-row.tsx', 'booked-part-page.tsx']) {
    assert.ok(!existsSync(join(V, '_components', gone)), `${gone} is back — Booked is just the team`);
  }
});

test('2 · the steps are exactly Find · Build · Book — never Schedule or Budget — and each badge is READ', () => {
  const shell = read(V, '_components', 'services-takeover.tsx');
  assert.deepEqual([...SUPPLIERS_MODES], ['find', 'build', 'booked']);
  const badges = shell.slice(shell.indexOf('const badge:'), shell.indexOf(';', shell.indexOf('const badge:')));
  assert.match(badges, /find: 0, build: cart, booked: ordersCount/, 'a badge is no longer the read count (cart · orders)');
  assert.match(shell, /countCart\(liveTally,/, 'the cart badge no longer moves at the press');
  const page = read(V, 'page.tsx');
  assert.match(page, /cartCount=\{cartCount\(liveTallyBase,/, 'the page no longer reads the cart badge');
  assert.match(page, /ordersCount=\{ordersWaitingCount\(teamRowList\)\}/, 'the page no longer reads the orders badge');
  assert.doesNotMatch(shell.slice(shell.indexOf('data-sup-steps'), shell.indexOf('</nav>')), /Schedule|Budget/, 'a step names a Booked part again');
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

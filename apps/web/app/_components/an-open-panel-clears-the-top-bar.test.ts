/**
 * GUARD — from the tablet line (701) an open Sheet inside the page is drawn OVER the shell's top bar, so its head (the
 * title and the ×) is on screen and its scrim dims the bar.
 *
 * Approved design: DECISION_LOG 2026-10-19 "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET (AREA 2)" — every bottom sheet
 * becomes the 440-px right panel; the prototype's frame budget-05 draws it the full height with its title and × at the
 * top, over a scrim that dims the rail and the bar.
 *
 * MEASURED 2026-10-20 (lab, `/dev/budget-lab?shell=1` › Add expense, Chromium + WebKit, 1000–1920): the panel's × was
 * NOT hittable — `elementFromPoint` on it returned the top bar — and the bar stayed undimmed. Why: `.sn-vt-page` (the
 * page's `<main>`) carries a `view-transition-name`, which makes it a stacking context, so the Sheet's `z-50` only counts
 * inside the page, and the sticky bar (`.fd-topwrap`) paints over the whole page. The fix lifts the page's stacking
 * context above the shell's chrome WHILE a Sheet is open, from 701 (where the panel starts at the top edge).
 *
 * Every number is READ from its file: a bar raised, the lift lowered or dropped, the line moved, or the Sheet losing its
 * hook turns this red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const TAB = Number(/\btab\s*:\s*(\d+)/.exec(read('lib/use-responsive.ts'))?.[1]);
const CSS = read('app/globals.css');
const SHELL = read('app/_components/frontdoor/front-door.css');

/** The declarations of the first rule whose selector is exactly `sel` (anywhere in `css`, inside @media or not). */
function ruleBody(css: string, sel: string, within?: string): string | null {
  const scope = within ?? css;
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\n}])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(scope)?.[1] ?? null;
}
const zOf = (body: string | null) => Number(/(?:^|[\s;])z-index:\s*(\d+)/.exec(body ?? '')?.[1] ?? NaN);

test('the page is a stacking context (the reason a Sheet inside it cannot clear the bar on its own)', () => {
  assert.match(ruleBody(CSS, '.sn-vt-page') ?? '', /view-transition-name:\s*sn-page/, 'the page no longer carries its transition name — re-check whether the lift is still needed');
});

test(`from ${TAB}px, while a Sheet is open, the page is lifted above the top bar and the rail`, () => {
  assert.equal(TAB, 701, `BREAKPOINTS.tab is ${TAB}`);
  const media = [...CSS.matchAll(new RegExp(`@media \\(min-width: ${TAB}px\\) \\{([\\s\\S]*?)\\n\\}`, 'g'))].map((m) => m[1]!);
  const lift = media.map((m) => ruleBody(CSS, '.sn-vt-page:has([data-sheet])', m)).find((b) => b !== null) ?? null;
  assert.ok(lift, `no "@media (min-width: ${TAB}px) { .sn-vt-page:has([data-sheet]) {…} }" — an open panel sits under the top bar`);
  assert.match(lift!, /(?:^|[\s;])position:\s*(?:relative|sticky|fixed|absolute)\s*;/, 'the lifted page is not positioned — its z-index would do nothing');
  const liftZ = zOf(lift);
  const barZ = zOf(ruleBody(SHELL, ".fd[data-chrome='app'] .fd-topwrap"));
  assert.ok(Number.isFinite(barZ), "the app top bar's z-index is no longer found — re-anchor this test on it");
  assert.ok(liftZ > barZ, `the lifted page (z ${liftZ}) is not above the top bar (z ${barZ}) — the panel's head is hidden under it`);
  // Every z the shell's resting rail / scrim takes stays under the lifted page. The 59/60 layers are the OPENED
  // navigation drawer (below 1024 on the other trees), which is meant to cover everything, a panel included.
  const shellZs = [...SHELL.matchAll(/\.fd-(?:rail|scrim)[^{]*\{([^}]*)\}/g)].map((m) => zOf(m[1]!)).filter(Number.isFinite);
  assert.ok(shellZs.length >= 1, 'no rail/scrim z-index found — re-anchor this test');
  for (const z of shellZs.filter((z) => z < 50)) assert.ok(liftZ > z, `the lifted page (z ${liftZ}) is under a rail/scrim layer (z ${z})`);
});

test('below the line nothing is lifted (the phone sheet rises from the bottom, under nothing it did not already clear)', () => {
  const top = CSS.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '');
  assert.equal(ruleBody(top, '.sn-vt-page:has([data-sheet])'), null, 'the lift is no longer scoped to the tablet line');
});

test('the Sheet still wears the hook the lift reads, on its one root', () => {
  const sheet = read('app/_components/sheet.tsx');
  assert.match(sheet, /aria-modal="true"[\s\S]{0,120}data-sheet=""\s*className=\{at\.root\}/, 'the Sheet root lost `data-sheet` — the page is never lifted');
  assert.match(sheet, /if \(!open\) return null;/, 'a closed Sheet now stays in the tree — the page would stay lifted');
});

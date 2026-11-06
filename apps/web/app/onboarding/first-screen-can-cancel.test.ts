/**
 * first-screen-can-cancel.test.ts — every onboarding flow's FIRST screen has a way out.
 *
 * ─── THE REPORT ────────────────────────────────────────────────────────────
 * Owner, 2026-10-26: *"i noticed event onboarding doesn't have a cancel. so when
 * they misclick that event type. they can cancel"*.
 *
 * ─── WHAT WAS ACTUALLY THERE (measured, not assumed) ───────────────────────
 * • The wedding flow drew a "‹" on its first screen that did NOTHING: it called
 *   go(-1), which clamps at step 0. Its "hide on the first screen" rule and its
 *   hardware-Back "exit on the first screen" rule were both keyed on the screen id
 *   'welcome' — which is in REMOVED_SCREENS and absent from the approved list, so it
 *   is never active. Production, 2026-10-26: pressing the browser Back on "Who's
 *   getting married?" twice left the visitor on /onboarding/wedding both times —
 *   the sentinel re-armed forever. No way out by any control.
 * • The generic flow (every other type) had a bottom Back drawn at opacity 0 on
 *   step 0, and its "What do you need?" first screen hides that row entirely.
 * • The Get-together form (`onboarding/simple`) already had "‹ Back" to the picker.
 *
 * 🔑 "THE FIRST SCREEN" IS AN INDEX, NEVER A SCREEN ID. A rule keyed on a named
 * screen dies silently the day that screen is removed from the sequence — which is
 * exactly how the wedding exit died. So this guard pins the index-based predicate.
 *
 * Per component, so one flow regressing cannot hide behind another passing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { ONBOARDING_EXIT_HREF, onboardingExit } from '@/app/onboarding/_shared/onboarding-exit';
import { weddingFlowScreens } from '@/lib/onboarding/wedding-cards';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEDDING = join(HERE, 'wedding', '_components', 'onboarding-shell.tsx');
const WEDDING_CSS = join(HERE, 'wedding', '_styles', 'onboarding.css');
const GENERIC = join(HERE, '[type]', '_components', 'generic-onboarding.tsx');
const SIMPLE = join(HERE, 'simple', 'page.tsx');

const code = (p: string) => stripComments(readFileSync(p, 'utf8'));

/** The source between the first `from` and the next `to` after it ('' when either is missing). */
function between(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  if (a < 0) return '';
  const b = src.indexOf(to, a + from.length);
  return b < 0 ? '' : src.slice(a, b);
}

test('the anchor: every flow this guard reasons about exists', () => {
  for (const f of [WEDDING, WEDDING_CSS, GENERIC, SIMPLE]) {
    assert.ok(existsSync(f) && readFileSync(f, 'utf8').length > 500, `${f} is missing or a stub — every assertion below would pass vacuously.`);
  }
});

test('the way out goes to the event-type picker for a signed-in person', () => {
  assert.equal(ONBOARDING_EXIT_HREF, '/dashboard/create-event');
  assert.equal(onboardingExit(true).href, '/dashboard/create-event');
  assert.match(onboardingExit(true).label, /^Cancel/);
  // The picker is behind sign-in; a signed-out visitor must not be bounced to /login for pressing Cancel.
  assert.ok(!onboardingExit(false).href.startsWith('/dashboard'), 'a signed-out visitor would hit the login wall');
});

test('why the predicate is an index: the wedding flow does not start on "welcome"', () => {
  const first = weddingFlowScreens({ engineCards: [], skipAccount: true, services: false })[0];
  assert.ok(first && first !== 'welcome', `the approved wedding flow starts on ${first} — a rule keyed on 'welcome' never fires`);
});

test('wedding: the first screen draws ✕ to the picker in the "‹" slot; later screens keep ‹', () => {
  const src = code(WEDDING);
  assert.match(src, /const onFirstScreen = stepClamped === 0;/, 'the first screen must be step 0, not a named screen');
  assert.match(src, /const exit = onboardingExit\(authed\);/);

  const row = between(src, 'className="brandrow"', 'className="brandlock"');
  assert.ok(row.length > 0, 'the brand row (the "‹" slot) was not found');
  // Split on the ternary's own `) : (`: a lazy `(…)` would stop at the first `)` inside `go(-1)`.
  const q = row.indexOf('onFirstScreen ?');
  const colon = row.indexOf(') : (', q);
  assert.ok(q >= 0 && colon > q, 'the "‹" slot no longer switches on onFirstScreen');
  const firstBranch = row.slice(q, colon);
  const laterBranch = row.slice(colon);
  const exits = (firstBranch!.match(/data-onboarding-exit/g) ?? []).length;
  console.log(`  wedding: ${exits} exit control(s) on the first screen`);
  assert.equal(exits, 1);
  assert.match(firstBranch!, /<Link\b/);
  assert.match(firstBranch!, /href=\{exit\.href\}/);
  assert.match(firstBranch!, /aria-label=\{exit\.label\}/);
  assert.match(firstBranch!, /exitingOnbRef\.current = true/, 'leaving must not let the sentinel re-step the flow');
  assert.match(laterBranch!, /onClick=\{\(\) => go\(-1\)\}/);
  assert.match(laterBranch!, /<ChevronLeft\b/);
  // ONE shape in both branches, so screen 1 → 2 swaps only the icon (presentation rule, 2026-10-26).
  for (const [name, branch] of [['first', firstBranch], ['later', laterBranch]] as const) {
    assert.match(branch, /className="btn-back btn-ring\b/, `the ${name}-screen control lost the shared ring`);
    assert.match(branch, /className="btn-ring-face"/, `the ${name}-screen control lost the shared ring face`);
  }

  // Hardware / browser Back exits on the same screen the ✕ shows on.
  const canGoBack = /canGoBackRef\.current = ([^;]+);/.exec(src);
  assert.ok(canGoBack, 'canGoBackRef assignment not found');
  assert.equal(canGoBack[1]!.trim(), '!onFirstScreen');
});

test('wedding: the top-left control is a 44px tap target drawn as a round 34px ring', () => {
  const css = readFileSync(WEDDING_CSS, 'utf8');
  assert.match(css, /\.btn-back\.btn-ring\{width:44px;height:44px;min-height:44px;/);
  assert.match(css, /\.btn-ring \.btn-ring-face\{width:34px;height:34px;border-radius:50%;/);
});

test('every other event type: step 0 draws ✕ to the picker, later steps ‹ — one slot, so the brand never moves', () => {
  const src = code(GENERIC);
  assert.match(src, /const exit = onboardingExit\(authed\);/);
  const header = between(src, '<header', '<FirstRunBrand');
  assert.ok(header.length > 0, 'the generic header was not found');
  const q = header.indexOf('step === 0 ?');
  const colon = header.indexOf(') : (', q);
  assert.ok(q >= 0 && colon > q, 'the header no longer draws a control on every step (an empty slot moves the brand)');
  const firstBranch = header.slice(q, colon);
  const laterBranch = header.slice(colon);
  const exits = (firstBranch.match(/data-onboarding-exit/g) ?? []).length;
  console.log(`  generic: ${exits} exit control(s) on the first screen`);
  assert.equal(exits, 1);
  assert.match(firstBranch, /<Link\b/);
  assert.match(firstBranch, /href=\{exit\.href\}/);
  assert.match(firstBranch, /aria-label=\{exit\.label\}/);
  assert.match(laterBranch, /onClick=\{\(\) => go\(-1\)\}/);
  assert.match(laterBranch, /<ChevronLeft\b/);
  for (const [name, branch] of [['first', firstBranch], ['later', laterBranch]] as const) {
    assert.match(branch, /className=\{TOP_RING\}/, `the ${name}-step control lost the shared tap target`);
    assert.match(branch, /className=\{TOP_RING_FACE\}/, `the ${name}-step control lost the shared ring`);
  }
  const ring = /const TOP_RING =\s*'([^']+)'/.exec(src)?.[1] ?? '';
  const face = /const TOP_RING_FACE =\s*'([^']+)'/.exec(src)?.[1] ?? '';
  assert.match(ring, /\bh-11\b/);
  assert.match(ring, /\bw-11\b/);
  assert.match(face, /h-\[34px\]/);
  assert.match(face, /w-\[34px\]/);
  assert.match(face, /\brounded-full\b/);

  const nav = between(src, 'data-glass-row="onboarding-nav"', 'isLast ?');
  assert.match(nav, /onClick=\{\(\) => go\(-1\)\}/, 'later screens lost their bottom Back');
  assert.match(nav, />\s*Back\s*</);
});

test('Get-together: the form opens with "‹ Back" to the picker', () => {
  const header = between(code(SIMPLE), '<header', '</header>');
  assert.ok(header.length > 0, 'the simple header was not found');
  assert.match(header, new RegExp(`href="${ONBOARDING_EXIT_HREF}"`));
});

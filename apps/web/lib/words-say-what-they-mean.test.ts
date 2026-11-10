/**
 * WORDS SAY WHAT THEY MEAN — Build 5 Step 0 row 28 + Step 0b item 9 (F5, 2026-11-10).
 *
 * Three ways a correct number or a correct setting still read wrong on screen:
 *   1. RAW CODES — Your details › "What you do" read `pabati · day_of_coordinator`: `serviceLabels` names only the 30
 *      coarse categories, so a service-level key fell through to itself. The line now reads each service by its
 *      taxonomy name (`lib/service-labels.ts`, the admin-managed `canonical_service_schemas.display_name_en`).
 *   2. PLURALS — the supplier's Clients badge said "1 new inquiries"; a step said "in 1 days"; countdowns said
 *      "1 days". The noun follows the count (`countNoun`), and one day ahead is "tomorrow" (`inDaysWords`).
 *   3. THE ⚙ EMOJI — copy pointing at a page's Settings drew the emoji, not the button's icon. `gearText` draws the
 *      real lucide `Settings` in its place.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { inDaysWords } from './format-number';
import { stripComments } from './strip-comments';
import { gearText } from '../app/_components/gear-text';

// The test runner compiles JSX to the classic runtime (`React.createElement`), as the sibling render tests do.
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('inDaysWords: one day ahead is "tomorrow", never "in 1 days"', () => {
  assert.equal(inDaysWords(0), 'today');
  assert.equal(inDaysWords(1), 'tomorrow');
  assert.equal(inDaysWords(2), 'in 2 days');
  assert.equal(inDaysWords(1240), 'in 1,240 days');
  assert.equal(inDaysWords(-3), 'today', 'a count already behind never reads "in -3 days"');
});

test('the sites that printed "in N days" go through inDaysWords', () => {
  for (const rel of [
    'lib/whats-next.ts',
    'lib/shop-permit-line.ts',
    'app/dashboard/[eventId]/story/_components/whats-next-step.tsx',
    'app/dashboard/(launcher)/_components/year-moments-strip.tsx',
  ]) {
    const s = src(rel);
    assert.doesNotMatch(s, /in \$\{[^}]*\} days/, `${rel} prints "in \${n} days" — one day ahead reads "in 1 days"`);
    assert.match(s, /inDaysWords\(/, `${rel} no longer says its day count through inDaysWords`);
  }
});

test('the countdowns that printed "N days" count through countNoun', () => {
  const sites: [string, RegExp][] = [
    ['app/onboarding/_shared/date-calendar.tsx', /`\$\{dd\} days`/],
    ['app/onboarding/wedding/_components/onboarding-shell.tsx', /\$\{days\} days until/],
    ['app/dashboard/[eventId]/website/editor/_components/maker-navigator-data.ts', /`\$\{facts\.daysToGo\} days`/],
    ['app/[slug]/_components/story/story-spine.tsx', /\$\{daysTold - days\.length\} days/],
    ['app/sample/hub/[guestKey]/page.tsx', /\{day\.daysToGo\} days to go/],
    ['app/dashboard/[eventId]/_components/event-dashboard.tsx', /: daysOut\} days to go/],
  ];
  for (const [rel, bare] of sites) {
    const s = src(rel);
    assert.doesNotMatch(s, bare, `${rel} prints a bare count before "days" — one day reads "1 days"`);
    assert.match(s, /countNoun\([^)]*'day', 'days'\)/, `${rel} no longer counts its days through countNoun`);
  }
});

test('the supplier Clients badge never reads "1 new inquiries"', () => {
  const s = src('lib/nav-badges.ts');
  assert.doesNotMatch(s, /\}\s+new inquiries/, 'a count printed straight before the plural "new inquiries"');
  assert.match(s, /countNoun\(inquiries, 'new inquiry', 'new inquiries'\)/);
});

test('"What you do" reads each service by its taxonomy name, never its key', () => {
  const screen = src('app/vendor-dashboard/profile/_components/details-screen.tsx');
  assert.doesNotMatch(
    screen,
    /serviceLabels\?\.\[s\]\s*\?\?\s*s\b/,
    'the line falls back to the raw key — a service-level key ("day_of_coordinator") is shown as itself',
  );
  assert.match(screen, /const services = d\.serviceNames;/);
  const data = src('app/vendor-dashboard/profile/details-data.ts');
  assert.match(data, /readServiceLabels\(\)/, 'details-data no longer reads the taxonomy service names');
  assert.match(data, /serviceLabelOf\(canonicalLabels, s\)/, 'a service-level key no longer resolves through serviceLabelOf');
});

test('gearText draws the real Settings icon in place of the ⚙ emoji, words untouched', () => {
  const html = renderToStaticMarkup(gearText('Your shop-wide settings stay in Clients ⚙.') as never);
  assert.ok(!html.includes('⚙'), 'the emoji is still drawn');
  assert.match(html, /^Your shop-wide settings stay in Clients <svg[^>]*aria-label="Settings"[^>]*>[\s\S]*<\/svg>\.$/);
  assert.equal(gearText('No gear here'), 'No gear here', 'copy without a ⚙ comes back as the same string');
});

test('the ⚙ copy rendered as JSX goes through gearText', () => {
  const sites: [string, RegExp][] = [
    ['app/_components/menu-settings-button.tsx', /gearText\(line\?\.tip \?\? entry\.tip \?\? MENU_SETTINGS_TIP\)/],
    ['app/dashboard/[eventId]/launch/_components/details-guide.tsx', /gearText\(GUIDE_GUESTS_LINE\)[\s\S]*gearText\(GUIDE_GUESTS_GO\)/],
    ['app/dashboard/[eventId]/launch/_components/stage-panel/kit.tsx', /\{gearText\(about\)\}/],
    ['app/dashboard/[eventId]/launch/_components/stage-tools.tsx', /\{gearText\(why\.words\)\}/],
  ];
  for (const [rel, re] of sites) assert.match(src(rel), re, `${rel} draws its ⚙ copy as the emoji again`);
});

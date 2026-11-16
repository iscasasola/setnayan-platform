/**
 * 🎗 Service-card badge congratulations + rules pop-up shell (v86 .scz / #cbDlg). Source guards: v86 words verbatim,
 * the one shared ✕ on the full screen, J3's data passed in (nothing decided here), client-only, no colour in the .tsx.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments as strip } from '@/lib/strip-comments';

const DIR = __dirname;
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

test('congratulations: v86 words verbatim, the shared ✕, tap anywhere closes', () => {
  const src = read('card-badge-congrats.tsx');
  const code = strip(src);
  assert.match(code, /'use client'/);
  assert.match(code, /hi: 'Congratulations!'/);
  assert.match(code, /'It stays on the card for as long as the card keeps passing\.'/);
  assert.match(code, /'Tap anywhere to close'/);
  assert.match(code, /service card earned <b>\{badgeName\}<\/b>\./);
  assert.match(code, /<AwardClose onClose=\{close\} \/>/, 'the full screen uses the ONE shared ✕');
  assert.match(code, /<dialog[\s\S]*?onClick=\{close\}/, 'a tap anywhere closes');
  assert.doesNotMatch(code, /confetti/i, 'confetti is for No. 1 only');
  assert.doesNotMatch(code, /#[0-9a-fA-F]{3,8}\b/, 'colours live in the CSS module');
});

test('the Today line reads as v86 draws it', () => {
  // (the module imports a CSS module, which the test runner cannot load — read the source instead)
  assert.match(read('card-badge-congrats.tsx'), /return `Congratulations, your \$\{cardName\} service card earned \$\{badgeName\}`;/);
});

test('rules pop-up: a shell J3 fills — title rule, held line, daily-check note, Got it', () => {
  const code = strip(read('card-badge-rules.tsx'));
  assert.match(code, /'use client'/);
  assert.match(code, /many: 'This card’s badges'/);
  assert.match(code, /badges\.length === 1 \? badges\[0\]!\.name : CARD_RULES_COPY\.many/, 'one badge → its own name');
  assert.match(code, /Each badge is checked every day\. It comes off the day the card stops passing, and its time starts again when it earns it back\./);
  assert.match(code, /ok: 'Got it'/);
  assert.match(code, /<ActionButton tone="info" main/);
  assert.match(code, /<em>\{b\.held\}<\/em>/);
  assert.doesNotMatch(code, /#[0-9a-fA-F]{3,8}\b/, 'colours live in the CSS module');
  // a shell: no badge names, rules or thresholds are typed here
  assert.doesNotMatch(code, /Hot Booking|Top Rated|Fast Reply/);
});

test('the pop-up CSS keeps the v86 width and radius tokens', () => {
  const css = read('card-badge.module.css');
  assert.match(css, /width: min\(360px, calc\(100vw - 32px\)\)/);
  assert.match(css, /border-radius: var\(--m-r-lg\)/);
  assert.doesNotMatch(css, /border-radius: \d+px/, 'radius uses the tokens');
});

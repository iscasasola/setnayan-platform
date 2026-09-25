/**
 * the-info-dot-is-round.test.ts — 2026-09-25. Owner: *"(i) is not round."*
 *
 * On Your Team the per-category ⓘ rendered as tall pills (and clipped at the
 * right edge); the bench's ⓘ too. 🔑 ROOT CAUSE, one line of globals.css: the
 * base touch-target rule gives EVERY <button> `min-height: 44px`, which beats
 * a 16px or 22px `height` — so a circle drawn `h-4 w-4 rounded-full` (the
 * design foundation's <InfoTip>) or `.cat-info` (22×22) came out 44px tall at
 * its own width. Nothing about the circles themselves was wrong.
 *
 * `.sn-dot-btn` is the one opt-out (min-height 0, square aspect, no flex
 * squeeze, an invisible halo that keeps a usable target). This pins the rule
 * and every ⓘ that must wear it, and that the Your Team head rows can shrink
 * so the ⓘ is not pushed off a phone's right edge.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

const CSS = read('app', 'globals.css');

function ruleBody(selector: string): string {
  const i = CSS.indexOf(`${selector} {`);
  assert.ok(i >= 0, `globals.css has no \`${selector}\` rule`);
  return CSS.slice(i, CSS.indexOf('}', i));
}

test('the premise: every <button> still gets the 44px floor that stretches a small circle', () => {
  assert.match(CSS, /button,\s*\[role='button'\],\s*a\.button,\s*input\[type='submit'\]\s*\{\s*min-height:\s*44px;/);
});

test('ⓘ .sn-dot-btn drops the floor and pins the circle square', () => {
  const body = ruleBody('.sn-dot-btn');
  assert.match(body, /min-height:\s*0\s*;/, 'the 44px floor still applies — the circle stretches into a pill');
  assert.match(body, /aspect-ratio:\s*1\s*\/\s*1\s*;/, 'nothing holds the box square');
  assert.match(body, /flex-shrink:\s*0\s*;/, 'a flex row can still squeeze the circle into an oval');
  // The touch target is not given up: a halo wider than the circle.
  assert.match(ruleBody('.sn-dot-btn::after'), /inset:\s*-\d+px\s*;/, 'the halo that keeps the target usable is gone');
});

test('ⓘ every info circle wears it — InfoTip, the Your Team category ⓘ, the bench ⓘ', () => {
  const infoTip = read('app', '_components', 'info-tip.tsx');
  assert.match(infoTip, /<button[\s\S]*?className="[^"]*\bsn-dot-btn\b[^"]*"[\s\S]*?<span aria-hidden="true">i<\/span>/);

  const cats = read('app', 'dashboard', '[eventId]', 'vendors', '_components', 'shortlist-categories.tsx');
  const catInfo = cats.match(/className="cat-info[^"]*"/g) ?? [];
  assert.ok(catInfo.length >= 2, `found ${catInfo.length} .cat-info buttons — the folder and the category ⓘ`);
  for (const c of catInfo) assert.match(c, /\bsn-dot-btn\b/, `${c} is still stretched by the 44px floor`);

  const bench = read('app', 'dashboard', '[eventId]', 'vendors', '_components', 'services-takeover.tsx');
  assert.match(
    bench,
    /aria-label=\{EXPLORE_INFO_BUTTON_LABEL\}[\s\S]*?className="[^"]*\bsn-dot-btn\b/,
    'the bench ⓘ is still stretched by the 44px floor',
  );
});

test('ⓘ the Your Team head rows let the head shrink, so the ⓘ stays on screen', () => {
  const cats = read('app', 'dashboard', '[eventId]', 'vendors', '_components', 'shortlist-categories.tsx');
  assert.match(
    cats,
    /\.slcat \.cat-head-row>\.cat-head,\.slcat \.fold-head-row>\.fold-head\{min-width:0\}/,
    'the head buttons are width:100% with a nowrap name inside — without min-width:0 they refuse to ' +
      "shrink and push the ⓘ past a phone's right edge",
  );
});

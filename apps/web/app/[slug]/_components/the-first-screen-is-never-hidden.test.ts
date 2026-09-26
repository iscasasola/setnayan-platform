/**
 * THE FIRST SCREEN IS NEVER HIDDEN — the names and the date are readable on the
 * first frame a guest sees.
 *
 * ── 🔴 THE DEFECT (measured 2026-09-26/27) ─────────────────────────────────
 * On https://www.setnayan.com/cale-ice at 390×844 (headless Chromium, mobile +
 * touch, signed out, fresh storage), the hero card — "Together with their
 * families", the mark, "Indalecio and Claire", the date — sat at EFFECTIVE
 * opacity 0 from the moment it streamed in, and reached 1 only ~0.7s after
 * DOMContentLoaded (~2.7s after navigation on that run). A guest opening the
 * link in Messenger saw the background loop and nothing else for that long.
 *
 * Two things were hiding it, stacked:
 *   1. The §6 scroll reveal (`.pahina-js … [data-pahina-chapters] > *`) hid
 *      EVERY chapter — the masthead's included — until the observer attached,
 *      which on the streamed page waits for DOMContentLoaded (or a 1.5s timer),
 *      then faded it over 0.7s.
 *   2. The one-time arrival started the names and the date from `opacity: 0`
 *      with 0.18s / 0.34s delays under `backwards` fill.
 *
 * ── WHAT THIS HOLDS ─────────────────────────────────────────────────────────
 * The read-moves rule: content may animate IN, but is never invisible while it
 * waits. So:
 *   · no rule that zeroes a chapter's opacity may match a first-screen chapter;
 *   · the arrival's keyframes never touch opacity or visibility;
 *   · the first screen is MARKED, in every shape the masthead renders.
 * Reduced motion needs nothing new: RootFlag and ArrivalOnce already withhold
 * their classes for it (`the-hub-moves-with-meaning.test.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const css = read('app/globals.css');

const MARK = '[data-pahina-first-screen]';

/** Every top-level-ish `selector { body }` pair in the sheet (nested @media bodies included). */
function rules(sheet: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  for (const m of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1]!.trim(), body: m[2]! });
  }
  return out;
}

test('1 · no rule that hides a chapter can match a first-screen chapter', () => {
  const hiding = rules(css).filter(
    (r) => r.selector.includes('[data-pahina-chapters]') && /opacity:\s*0\s*;/.test(r.body),
  );
  assert.ok(hiding.length >= 1, 'precondition: the scroll reveal still hides chapters — this guard is looking at nothing');
  for (const r of hiding) {
    for (const sel of r.selector.split(',')) {
      assert.ok(
        sel.includes(`:not(${MARK})`),
        `this rule hides a chapter and does not exempt the first screen:\n  ${sel.trim()}`,
      );
    }
  }
});

test('2 · the arrival moves the words and never hides them', () => {
  const arrive = rules(css).filter((r) => /\[data-motion='arrive-(mark|names|date|action)'\]/.test(r.selector));
  const animated = arrive.filter((r) => /animation:\s*[a-z]/.test(r.body) && !/animation:\s*none/.test(r.body));
  const seen = new Set<string>();
  for (const r of animated) {
    for (const m of ['mark', 'names', 'date', 'action']) if (r.selector.includes(`arrive-${m}`)) seen.add(m);
  }
  assert.deepEqual([...seen].sort(), ['action', 'date', 'mark', 'names'], 'precondition: all four arrival movements found');
  for (const r of animated) {
    const name = /animation:\s*([\w-]+)/.exec(r.body)![1]!;
    const kf = new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?\\})\\s*\\}`).exec(css);
    assert.ok(kf, `keyframes ${name} not found`);
    assert.doesNotMatch(kf[1]!, /opacity|visibility/, `${r.selector} animates through ${name}, which hides the words while they wait`);
  }
});

test('3 · the first screen is marked in every shape the masthead renders', () => {
  const mast = read('app/[slug]/_components/pahina-masthead.tsx');
  const cardAt = mast.indexOf('if (card) {');
  assert.ok(cardAt > 0, 'the masthead still branches on `card`');
  const classicAt = mast.indexOf('\n  return (', cardAt);
  assert.ok(classicAt > cardAt);
  for (const [where, branch] of [
    ['card', mast.slice(cardAt, classicAt)],
    ['classic', mast.slice(classicAt)],
  ] as const) {
    // The ROOT element of the branch — the first tag after `return (` — carries it.
    const root = /return \(\s*<(\w+)([^>]*)>/.exec(branch);
    assert.ok(root, `the ${where} masthead has no root element`);
    assert.match(root[2]!, /data-pahina-first-screen=""/, `the ${where} masthead's root is not marked`);
  }

  // The one action under the mark is part of the first screen too.
  const action = read('app/[slug]/_components/arrival-action.tsx');
  assert.match(action, /data-motion="arrive-action"\s+data-pahina-first-screen=""/);

  // The anonymous text-only masthead is NOT a direct chapter — it sits inside a
  // wrapper div, and that wrapper is the chapter, so the wrapper is marked.
  const body = read('app/[slug]/_components/site-body.tsx');
  const wrap = body.indexOf('<div data-pahina-first-screen="" className="space-y-6 text-center">');
  assert.ok(wrap > 0, 'the anonymous masthead wrapper is not marked');
  const next = body.indexOf('<PahinaMasthead', wrap);
  const close = body.indexOf('</div>', wrap);
  assert.ok(next > wrap && next < close, 'the marked wrapper no longer holds the masthead');
});

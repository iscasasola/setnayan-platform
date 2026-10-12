/**
 * find-walk-fixes.test.ts — the faults the controller measured walking Find at
 * 375 px on 2026-10-08, held at the source.
 *
 *  1. A verb row drew two heights: "Pay" (a link) 40 px beside "Your record"
 *     (a button) 44 px. `globals.css` floors every <button> at 44 px; the
 *     button rule is a 40 px pill whatever the element.
 *  2. A row's label showed between the app's top bar and the pinned date line
 *     while the bar slid back in. The bar, the pinned block and the pinned
 *     category head move the same distance at the same instant — so they must
 *     move for the same time on the same curve, with no reduced-motion
 *     exception the bar does not have.
 *  3. "More to compare" is not drawn for a booked category — the prototype's
 *     `bookedIn(k) ? '' : …` — which instead carries "Add your own" at its foot.
 *
 * Measured in a browser on `/dev/suppliers-lab` (the numbers are in the PR
 * body); these keep the cause from coming back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(...p), 'utf8');
const BENCH = stripComments(read(HERE, '_components', 'shortlist-categories.tsx'));
const SHELL = stripComments(read(HERE, '_components', 'services-takeover.tsx'));
const GLOBALS = read(WEB, 'app', 'globals.css');
const FRONT_DOOR = read(WEB, 'app', '_components', 'frontdoor', 'front-door.css');

/** `0.3s` / `.3s` / `300ms` → milliseconds. */
function ms(v: string): number {
  const m = /^(\d*\.?\d+)(ms|s)$/.exec(v.trim());
  assert.ok(m, `not a duration: ${v}`);
  return Number(m![1]) * (m![2] === 's' ? 1000 : 1);
}

/** The `<duration> <curve>` of one property inside a `transition:` value. */
function motionOf(transition: string, property: string): { ms: number; curve: string } {
  const part = transition
    .split(',')
    .map((p) => p.trim())
    .find((p) => p.split(/\s+/)[0] === property);
  assert.ok(part, `no transition on ${property} in "${transition}"`);
  const [, duration, ...curve] = part!.split(/\s+/);
  return { ms: ms(duration!), curve: curve.join(' ') };
}

test('1 · every button in the bench is ONE height — 40 px, link or button', () => {
  // Why it is needed at all: a <button> is floored at 44 px, a link is not.
  assert.match(
    GLOBALS,
    /button,\s*\[role='button'\],\s*a\.button,\s*input\[type='submit'\]\s*\{\s*min-height:\s*44px;/,
    'the 44 px floor on every <button> moved — re-read why the bench overrides it',
  );
  assert.match(GLOBALS, /\n\.ab \{[^}]*\bheight: 40px;/, 'ActionButton is no longer a 40 px pill');
  assert.match(
    BENCH,
    /\n\.slcat \.ab\{min-height:40px\}/,
    'a <button> ActionButton in the bench is 44 px tall again beside a 40 px link',
  );
});

test('2 · the pinned block and the pinned category head travel WITH the top bar', () => {
  // The bar: `.fd-topwrap`, the app variant.
  const bar = /\.fd\[data-chrome='app'\] \.fd-topwrap \{[^}]*?transition:\s*([^;]+);/.exec(FRONT_DOOR)?.[1];
  assert.ok(bar, "the app top bar's transition moved — re-anchor on .fd-topwrap");
  const barMotion = motionOf(bar!, 'transform');
  assert.equal(barMotion.ms, 300);
  assert.equal(barMotion.curve, 'ease-out');
  // It slides for everybody: no reduced-motion rule stops it.
  assert.doesNotMatch(
    FRONT_DOOR,
    /prefers-reduced-motion[^}]*\{[^}]*\.fd-topwrap/,
    'the bar now stands still under reduced motion — the block and the head must do the same',
  );

  // The pinned block (date · place, Find · Build · Booked).
  const block = /\[data-suppliers-stick\]\{transition:([^}]+)\}/.exec(SHELL)?.[1];
  assert.ok(block, 'the pinned block has no transition of its own — it will jump while the bar slides');
  assert.deepEqual(motionOf(block!, 'top'), barMotion, 'the pinned block and the bar no longer move as one');
  const cls = /<div\s+ref=\{stickRef\}\s+data-suppliers-stick=""\s+className="([^"]*)"/.exec(SHELL)?.[1] ?? '';
  assert.ok(cls, 'the pinned block is gone — re-anchor on data-suppliers-stick');
  assert.doesNotMatch(cls, /(^| )(ease-\S+|duration-\S+|transition\S*)( |$)/, "a Tailwind curve on the block is not the bar's curve");
  assert.doesNotMatch(cls, /motion-reduce:transition-none/, 'the block stands still under reduced motion while the bar slides');

  // The open category's pinned head.
  const head = /\.slcat \.fold\.flat \.cat\.open>\.cat-head-row\{transition:([^}]+)\}/.exec(BENCH)?.[1];
  assert.ok(head, "the pinned category head jumps to its new place while the bar is still sliding");
  assert.deepEqual(motionOf(head!, 'top'), barMotion, 'the pinned head and the bar no longer move as one');
  assert.doesNotMatch(
    BENCH,
    /prefers-reduced-motion:reduce\)\{[^@]*\.cat-head-row\{transition:none/,
    'the head stands still under reduced motion while the bar slides',
  );
});

test('3 · a booked category shows no marketplace list, and offers "Add your own" at its foot', () => {
  assert.match(
    BENCH,
    /\{replan && tileOpen && !rowBooked && !coveredGroup \? \(\s*<MoreToCompare/,
    '"More to compare" is drawn under a booked category (the prototype: bookedIn(k) ? "" : …)',
  );
  const foot = /\{replan && rowBooked \? \(\s*<div className="morefoot">([\s\S]*?)<\/div>/.exec(BENCH)?.[1] ?? '';
  assert.match(foot, /label="Add your own"/, 'a booked category lost its own way to add a supplier');
  assert.match(BENCH, /const rowBooked = \(rowCoverage\?\.lockedCount \?\? 0\) > 0;/);
});

/**
 * the-toast-peeks-from-the-top.test.ts — THE APPROVED TOAST, DRAWN ONCE.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, kind 12; the approved gallery § 12): *"pop up is like a
 * notification. so it should peek from the top"* · *"the peek on the bottom of the screen saying deleted is not
 * centered properly"* · on the ink-black "Saved": *"teracota"*.
 *
 *   (1) WHERE — the top centre of the screen, under the safe area; never the bottom; over everything; it takes no tap.
 *   (2) A GOOD RESULT IS THE ACCENT WITH A ✓ — from the token, never a colour written in the file.
 *   (3) A FAILURE NEVER LOOKS LIKE SUCCESS — the danger token (not the accent), a warning mark, said as an alert, and
 *       "Try again" only where the caller can do it again — the one thing in it that takes a tap.
 *   (4) IT LEAVES BY ITSELF and tells the caller — 2.2 s, 4.2 s for a failure; one life per message, cleaned up.
 *   (5) MOTION — the family's speed and spring, read from the tokens; nothing under "reduce motion".
 *   (6) IT NEVER DARKENS THE PAGE — it is not a pop-up.
 *   (8) AN ACTION (owner 2026-10-09 — the guest list's Undo): optional, a small pill at the right, the toast stays 6 s,
 *       only that pill takes a tap, announced as a live region — and with no action the markup is today's, byte for byte.
 *   (7) ONE DRAWING — the Stages panel's "added / removed / moved" is this toast, not a strip of its own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { PEEK_TOAST_ACTION_MS, PEEK_TOAST_LEAVE_MS, PEEK_TOAST_MS, PEEK_TOAST_PILL, PEEK_TOAST_PLACE, PEEK_TOAST_SLIDE, PEEK_TOAST_TONE, PeekToast } from '../app/_components/toast/peek-toast';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SRC = read('app/_components/toast/peek-toast.tsx');
const draw = async (props: Record<string, unknown>, words = 'Countdown moved') => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(React.createElement(PeekToast as never, props, words));
};
const has = (classes: string, c: string) => classes.split(/\s+/).includes(c);

test('(1) it sits at the TOP centre, under the safe area, over everything — and takes no tap', async () => {
  const html = await draw({});
  assert.match(html, /^<div data-peek-toast="" data-tone="ok" class="([^"]*)">/);
  for (const c of ['fixed', 'inset-x-0', 'flex', 'justify-center', 'top-[calc(12px+env(safe-area-inset-top))]', 'pointer-events-none', 'z-[100]']) {
    assert.ok(has(PEEK_TOAST_PLACE, c), `the toast’s place lost “${c}”`);
  }
  assert.ok(!PEEK_TOAST_PLACE.split(/\s+/).some((c) => /^(?:bottom-|inset-0$|inset-y-)/.test(c)), 'the toast reaches the bottom of the screen');
  /* Its words: one line, centred, cut — never wrapped off the screen. */
  assert.ok(has(PEEK_TOAST_PILL, 'rounded-full') && has(PEEK_TOAST_PILL, 'h-12') && has(PEEK_TOAST_PILL, 'justify-center') && has(PEEK_TOAST_PILL, 'max-w-full'));
  assert.match(html, /<span class="min-w-0 truncate">Countdown moved<\/span>/);
});

test('(2) a good result is the accent with a ✓ — and the file writes no colour for it', async () => {
  const html = await draw({ tone: 'ok' });
  assert.equal(PEEK_TOAST_TONE.ok, 'bg-sn-accent text-sn-on-accent');
  assert.match(html, /role="status"[^>]*class="[^"]*bg-sn-accent text-sn-on-accent"/);
  assert.match(html, /<svg[^>]*lucide-check\b/, 'no ✓');
  assert.doesNotMatch(html, /Try again/);
  for (const [what, re] of [['a hex colour', /#[0-9a-fA-F]{3,8}\b/], ['`mulberry`', /mulberry/], ['`text-white`', /\btext-white\b/], ['an ink fill', /\bbg-ink\b/]] as const) {
    assert.doesNotMatch(SRC, re, `the toast writes ${what}`);
  }
});

test('(3) a failure never looks like success: the danger token, a warning mark, an alert — and Try again only when it can be done again', async () => {
  const bad = await draw({ tone: 'bad' }, 'That change could not be saved');
  assert.match(bad, /data-tone="bad"/);
  assert.match(bad, /role="alert"/);
  assert.match(PEEK_TOAST_TONE.bad, /bg-\[color-mix\(in_srgb,rgb\(var\(--color-danger\)\)_68%,black\)\]/, 'a failure is not the house danger token, darkened');
  assert.doesNotMatch(PEEK_TOAST_TONE.bad, /sn-accent/, 'a failure wears the accent');
  assert.match(bad, /<svg[^>]*lucide-triangle-alert\b/, 'no warning mark');
  assert.doesNotMatch(bad, /lucide-check\b/, 'a failure carries the tick');
  assert.doesNotMatch(bad, /<button/, 'Try again is offered with nothing to try');
  const again = await draw({ tone: 'bad', onRetry: () => {} }, 'That change could not be saved');
  assert.match(again, /<button type="button" data-peek-toast-retry="" class="[^"]*pointer-events-auto[^"]*">Try again<\/button>/);
  /* A good result never offers it, whatever it is handed. */
  assert.doesNotMatch(await draw({ tone: 'ok', onRetry: () => {} }), /Try again/);
});

test('(3b) a NOTE is neither a result nor a fault: white with a hairline and ink words, an ⓘ — never the tick, the accent or the red', async () => {
  const note = await draw({ tone: 'note' }, 'Nothing to change here — edit it in Studio.');
  assert.match(note, /data-tone="note"/);
  assert.match(note, /role="status"/, 'a note is announced as a fault');
  assert.equal(PEEK_TOAST_TONE.note, 'bg-white text-ink ring-1 ring-inset ring-ink/15');
  assert.doesNotMatch(PEEK_TOAST_TONE.note, /sn-accent|danger/, 'a note wears a result’s colour');
  assert.match(note, /<svg[^>]*lucide-info\b/, 'a note has no mark of its own');
  assert.doesNotMatch(note, /lucide-check\b|lucide-triangle-alert\b|Try again/, 'a note reads as done, or as a fault');
  assert.match(note, /<span class="min-w-0 truncate">Nothing to change here — edit it in Studio\.<\/span>/);
});

test('(4) it leaves by itself and tells the caller — one life per message, cleaned up', () => {
  assert.deepEqual(PEEK_TOAST_MS, { ok: 2200, bad: 4200, note: 3200 });
  assert.ok(PEEK_TOAST_LEAVE_MS >= 364, 'the caller is told it has gone before it has slid away (0.52 × 700 ms)');
  assert.match(SRC, /const life = hasAction \? PEEK_TOAST_ACTION_MS : PEEK_TOAST_MS\[tone\];/);
  assert.match(SRC, /const leave = window\.setTimeout\(\(\) => setDown\(false\), life\);/);
  assert.match(SRC, /const left = window\.setTimeout\(\(\) => gone\.current\?\.\(\), life \+ PEEK_TOAST_LEAVE_MS\);/);
  assert.match(SRC, /return \(\) => \{\s*window\.cancelAnimationFrame\(raf\);\s*window\.clearTimeout\(leave\);\s*window\.clearTimeout\(left\);\s*\};\s*\}, \[tone, hasAction\]\);/, 'a toast that unmounts early leaves a timer behind');
  assert.doesNotMatch(SRC, /setInterval|fetch\(|router\.|useToast/, 'the toast polls, asks the server, or leans on the older provider');
});

test('(5) it slides at the family’s speed with the family’s spring — and not at all under “reduce motion”', async () => {
  assert.equal(PEEK_TOAST_SLIDE, 'transform calc(var(--sn-pill-dur) * 0.52) var(--sn-pill-spring)');
  assert.ok(has(PEEK_TOAST_PILL, 'motion-reduce:!transition-none'), 'the slide plays under “reduce motion”');
  assert.doesNotMatch(PEEK_TOAST_PILL + PEEK_TOAST_PLACE, /duration-\[|animate-/, 'an arbitrary duration emits nothing here; the speed is the token');
  const html = await draw({});
  /* Server and first paint: above the screen (so the slide down is seen), the transition already on it. */
  assert.match(html, /data-down="false" style="transform:translateY\(calc\(-100% - 12px - env\(safe-area-inset-top\) - 24px\)\);transition:transform calc\(var\(--sn-pill-dur\) \* 0\.52\) var\(--sn-pill-spring\)"/);
  const css = read('app/globals.css');
  assert.match(css, /--sn-pill-dur:\s*700ms;/);
  assert.match(css, /--sn-pill-spring:/, 'anti-vacuity: the spring token is gone');
});

test('(6) it never darkens the page — a toast is not a pop-up', async () => {
  assert.doesNotMatch(SRC, /sn-popup-dark|inertBehind|aria-modal|useModalA11y|backdrop/, 'the toast darkens, blurs or locks the page');
  assert.doesNotMatch(await draw({}), /role="dialog"/);
});

test('(7) the Stages panel says what happened with THIS toast — no strip of its own', () => {
  const sheet = read('app/dashboard/[eventId]/launch/_components/add-part-sheet.tsx');
  assert.match(sheet, /<PeekToast key=\{toast\.n\} data="part" onGone=\{\(\) => setToastNow\(\(t\) => \(t\?\.n === toast\.n \? null : t\)\)\}>\s*\{toast\.words\}\s*<\/PeekToast>/);
  assert.doesNotMatch(sheet, /data-part-toast|role="status"/, 'the panel still draws a status strip of its own');
  /* Each message is a new toast (its own life), and the four things said are still said. */
  assert.match(sheet, /const setToast = useCallback\(\(words: string\) => setToastNow\(\(t\) => \(\{ words, n: \(t\?\.n \?\? 0\) \+ 1 \}\)\), \[\]\);/);
  assert.equal((sheet.match(/setToast\(/g) ?? []).length, 4, 'a message the panel used to say is gone (moved · added · added · removed)');
});

test('(8) an action: a small pill at the right, 6 s, the only tap — and without one the toast is today\'s, byte for byte', async () => {
  assert.equal(PEEK_TOAST_ACTION_MS, 6000);
  const plain = await draw({}, 'Removed Maria');
  const withAction = await draw({ action: { label: 'Undo', onPress: () => {} } }, 'Removed Maria');
  /* The pill: after the words, a real button, taking the tap the toast otherwise refuses. */
  assert.match(withAction, /<span class="min-w-0 truncate">Removed Maria<\/span><button type="button" data-peek-toast-action="" class="[^"]*pointer-events-auto[^"]*">Undo<\/button>/);
  assert.match(withAction, /role="status" aria-live="polite"/, 'a toast with an action is not announced');
  assert.match(withAction, /class="[^"]*!pr-2[^"]*"/, 'the pill has no room at the right');
  /* The place still refuses every tap but the pill's. */
  assert.ok(has(PEEK_TOAST_PLACE, 'pointer-events-none'));
  /* No action → nothing of it in the markup, and the markup is exactly the pre-action markup. */
  assert.doesNotMatch(plain, /data-peek-toast-action|aria-live|<button/);
  assert.equal(
    plain,
    await draw({ tone: 'ok', action: undefined }, 'Removed Maria'),
    'an undefined action changes the markup',
  );
  assert.equal(
    plain.replace(/<svg[\s\S]*?<\/svg>/, '<MARK/>'),
    '<div data-peek-toast="" data-tone="ok" class="' + PEEK_TOAST_PLACE + '"><div role="status" data-down="false" style="transform:translateY(calc(-100% - 12px - env(safe-area-inset-top) - 24px));transition:transform calc(var(--sn-pill-dur) * 0.52) var(--sn-pill-spring)" class="' + PEEK_TOAST_PILL + ' ' + PEEK_TOAST_TONE.ok + '"><MARK/><span class="min-w-0 truncate">Removed Maria</span></div></div>',
    'the no-action markup is no longer what it was',
  );
  /* An action-bearing failure still shows "Try again" too, and a plain "Try again" toast has no action pill. */
  assert.doesNotMatch(await draw({ tone: 'bad', onRetry: () => {} }), /data-peek-toast-action/);
  assert.doesNotMatch(SRC, /setInterval|useToast/, 'the action leans on a poll or the older provider');
});

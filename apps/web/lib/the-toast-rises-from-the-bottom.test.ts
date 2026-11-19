/**
 * the-toast-rises-from-the-bottom.test.ts — THE ONE TOAST: ONE PILL, FROM THE BOTTOM.
 *
 * Owner, 18 Nov 2026 (the motion standard, `MOTION_STANDARD_2026-11-18.md` § 4 #5 + § 9): *"Bottom"* — "One place:
 * the bottom, just above the thumb row. One shape: the pill." This RETIRES the top slide of 8 Oct ("it should peek
 * from the top"; this file was `the-toast-peeks-from-the-top.test.ts`): the pill, its tones, its words, its lives and
 * its one action are the same — where it comes from and how it moves changed.
 *
 *   (1) WHERE — the BOTTOM centre, above the thumb row or the bottom nav (`--sn-thumb-clear`); never the top; over
 *       everything; it takes no tap.
 *   (2) A GOOD RESULT IS THE ACCENT WITH A ✓ — from the token, never a colour written in the file.
 *   (3) A FAILURE NEVER LOOKS LIKE SUCCESS — the danger token, a warning mark, said as an alert, and "Try again" only
 *       where the caller can do it again.
 *   (4) IT LEAVES BY ITSELF and tells the caller — 2.2 s, 4.2 s for a failure; one life per message, cleaned up.
 *   (5) MOTION — it ENTERS FROM BELOW (Move on Spring, `@starting-style`), leaves downward (Quick on Settle); transform
 *       family and opacity only; nothing under "reduce motion".
 *   (6) IT NEVER DARKENS THE PAGE — it is not a pop-up.
 *   (7) ONE DRAWING — the Stages panel's "added / removed / moved" is this toast, not a strip of its own.
 *   (8) AN ACTION (Undo): a small pill at the right, 6 s, the only tap — and with no action the markup carries none.
 *   (9) A SENTENCE IS READ IN FULL — one line or two, never a third.
 *  (10) ONE PILL — the app-wide provider and the admin map's toast are the same pill, place and motion.
 *
 * Sabotage (each proved red, 18 Nov 2026): the place given `top-[…]` back (1) · `.sn-m-toast`'s starting translate
 * flipped to `0 calc(-100% - 24px)` — entering from above (5) · the provider's place put back to `bottom-4` and its
 * `sn-rise 320ms` (10).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { QUICK_MS } from './motion-table';
import {
  PEEK_TOAST_ACTION_MS, PEEK_TOAST_LAYER, PEEK_TOAST_LEAVE_MS, PEEK_TOAST_MOTION, PEEK_TOAST_MS, PEEK_TOAST_PILL, PEEK_TOAST_PLACE, PEEK_TOAST_TONE,
  PEEK_TOAST_WORDS, PeekToast,
} from '../app/_components/toast/peek-toast';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SRC = read('app/_components/toast/peek-toast.tsx');
const CSS = read('app/globals.css');
const draw = async (props: Record<string, unknown>, words = 'Countdown moved') => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(React.createElement(PeekToast as never, props, words));
};
const has = (classes: string, c: string) => classes.split(/\s+/).includes(c);
/** The body of a top-level rule, by its exact selector. */
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, 'm').exec(CSS);
  assert.ok(m, `globals.css has no rule “${sel}”`);
  return m[1]!;
};

test('(1) it sits at the BOTTOM centre, above the thumb row, over everything — and takes no tap', async () => {
  const html = await draw({});
  assert.match(html, /^<div data-peek-toast="" data-tone="ok" class="([^"]*)">/);
  for (const c of ['fixed', 'inset-x-0', 'flex', 'justify-center', 'sn-m-toast-place', 'pointer-events-none', 'z-[100]']) {
    assert.ok(has(PEEK_TOAST_PLACE, c), `the toast’s place lost “${c}”`);
  }
  /* Never the top, never the whole screen: the place names no top edge at all. */
  assert.ok(!PEEK_TOAST_PLACE.split(/\s+/).some((c) => /^(?:top-|inset-0$|inset-y-)/.test(c)), 'the toast reaches the top of the screen again');
  assert.doesNotMatch(SRC, /\btop:\s|peekToastUnder|PEEK_TOAST_UNDER/, 'the toast still places itself under a top bar');
  /* The bottom edge is the thumb row's clearance — the token, on phones; a plain foot from 1024. */
  assert.match(rule('.sn-m-toast-place'), /bottom:\s*var\(--sn-thumb-clear\);/, 'the toast does not sit above the thumb row');
  assert.doesNotMatch(rule('.sn-m-toast-place'), /\btop\s*:/, 'the toast’s place names a top edge');
  assert.match(CSS, /--sn-thumb-clear:\s*calc\(/, 'anti-vacuity: the thumb row’s clearance token is gone');
  /* The layer the update notice shares names no edge. */
  assert.equal(PEEK_TOAST_PLACE, `sn-m-toast-place ${PEEK_TOAST_LAYER}`);
  /* Its words: centred, never wider than the screen — and read in full (9, below). */
  assert.ok(has(PEEK_TOAST_PILL, 'justify-center') && has(PEEK_TOAST_PILL, 'text-center') && has(PEEK_TOAST_PILL, 'max-w-full'));
  assert.match(html, /<span class="min-w-0 line-clamp-2 \[text-wrap:balance\]">Countdown moved<\/span>/);
});

test('(9) a sentence is read in full: one line or two, never a third', () => {
  assert.ok(has(PEEK_TOAST_PILL, 'min-h-12'), 'the pill has no floor');
  assert.ok(!PEEK_TOAST_PILL.split(/\s+/).some((c) => /^h-\d|^h-\[/.test(c)), 'the pill is a fixed height again — a second line cannot fit');
  assert.ok(has(PEEK_TOAST_PILL, 'leading-[1.25]'), 'two lines have no set leading (the prototype’s 1.25)');
  assert.equal(PEEK_TOAST_WORDS, 'min-w-0 line-clamp-2 [text-wrap:balance]');
  for (const c of ['truncate', 'whitespace-nowrap', 'line-clamp-1']) assert.ok(!has(PEEK_TOAST_WORDS, c) && !has(PEEK_TOAST_PILL, c), `the words are one line again (“${c}”)`);
  assert.equal((SRC.match(/\{children\}/g) ?? []).length, 1);
  assert.match(SRC, /<span className=\{PEEK_TOAST_WORDS\}>\{children\}<\/span>/);
  assert.ok(has(PEEK_TOAST_PILL, 'rounded-full'), 'the notice lost its rounded ends');
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
  // + its dark partner (dark-mode PR 4): the approved card in dark — white with dark-mode ink was white on white.
  assert.equal(PEEK_TOAST_TONE.note, 'bg-white text-ink ring-1 ring-inset ring-ink/15 dark:bg-raised');
  assert.doesNotMatch(PEEK_TOAST_TONE.note, /sn-accent|danger/, 'a note wears a result’s colour');
  assert.match(note, /<svg[^>]*lucide-info\b/, 'a note has no mark of its own');
  assert.doesNotMatch(note, /lucide-check\b|lucide-triangle-alert\b|Try again/, 'a note reads as done, or as a fault');
  assert.match(note, /<span class="min-w-0 line-clamp-2 \[text-wrap:balance\]">Nothing to change here — edit it in Studio\.<\/span>/);
});

test('(4) it leaves by itself and tells the caller — one life per message, cleaned up', () => {
  assert.deepEqual(PEEK_TOAST_MS, { ok: 2200, bad: 4200, note: 3200 });
  assert.ok(PEEK_TOAST_LEAVE_MS >= QUICK_MS, 'the caller is told it has gone before it has sunk back (Quick)');
  assert.ok(PEEK_TOAST_LEAVE_MS <= QUICK_MS + 120, 'the caller waits long after the toast has gone');
  assert.match(SRC, /const life = hasAction \? PEEK_TOAST_ACTION_MS : PEEK_TOAST_MS\[tone\];/);
  assert.match(SRC, /const leave = window\.setTimeout\(\(\) => setLeaving\(true\), life\);/);
  assert.match(SRC, /const left = window\.setTimeout\(\(\) => gone\.current\?\.\(\), life \+ PEEK_TOAST_LEAVE_MS\);/);
  assert.match(SRC, /return \(\) => \{\s*window\.clearTimeout\(leave\);\s*window\.clearTimeout\(left\);\s*\};\s*\}, \[tone, hasAction\]\);/, 'a toast that unmounts early leaves a timer behind');
  assert.doesNotMatch(SRC, /setInterval|fetch\(|router\.|useToast/, 'the toast polls, asks the server, or leans on the older provider');
});

test('(5) it ENTERS FROM BELOW on the spring and sinks back on Settle — transform family and opacity only', async () => {
  assert.equal(PEEK_TOAST_MOTION, 'sn-m-toast');
  const html = await draw({});
  assert.match(html, /<div role="status" class="sn-m-toast /, 'the pill does not wear the one toast motion');
  assert.doesNotMatch(html, /style="/, 'the toast carries a motion written inline again');
  /* The entrance: `@starting-style` puts it BELOW its place (a positive Y), unseen — so it rises. */
  const start = /@starting-style\s*\{\s*\.sn-m-toast\s*\{([^}]*)\}\s*\}/.exec(CSS);
  assert.ok(start, 'the toast has no @starting-style entrance');
  const from = /translate:\s*0\s+([^;]+);/.exec(start[1]!);
  assert.ok(from, 'the entrance does not start from a translate on Y');
  assert.match(from[1]!, /^calc\(100% \+ \d+px\)$/, `the toast enters from “${from[1]}” — not from BELOW its place`);
  assert.doesNotMatch(from[1]!, /-/, 'the toast enters from above');
  assert.match(start[1]!, /opacity:\s*0;/);
  /* In: Move on Spring (it travels). Out: Quick on Settle, back DOWN. Both read the standard's tokens. */
  assert.match(rule('.sn-m-toast'), /transition:\s*translate var\(--sn-m-move\) var\(--sn-m-spring\),\s*opacity var\(--sn-m-quick\) var\(--sn-m-settle\);/);
  const out = rule('.sn-m-toast[data-leaving]');
  assert.match(out, /translate:\s*0\s+calc\(100% \+ \d+px\);/, 'the toast does not leave downward');
  assert.match(out, /transition:\s*translate var\(--sn-m-quick\) var\(--sn-m-settle\),\s*opacity var\(--sn-m-quick\) var\(--sn-m-settle\);/);
  /* Never a layout property, never a raw number. */
  for (const body of [rule('.sn-m-toast'), out, start[1]!]) {
    assert.doesNotMatch(body, /\b(?:top|bottom|left|right|height|width|max-height|margin)\s*:/, 'the toast moves a layout property');
    assert.doesNotMatch(body, /\d(?:ms|s)\b|cubic-bezier/, 'the toast’s motion writes a raw time or curve');
  }
  /* Leaving is a state on the pill, not a timer-driven style. */
  assert.match(SRC, /data-leaving=\{leaving \? '' : undefined\}/);
  /* Reduced motion: no transition at all. */
  const reduce = /@media \(prefers-reduced-motion: reduce\) \{\s*\.sn-m-toast,\s*\.sn-m-toast\[data-leaving\],[^{]*\{\s*transition:\s*none !important;\s*\}/.exec(CSS);
  assert.ok(reduce, 'the toast still moves under “reduce motion”');
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
  /* 🔁 RE-AIMED 2026-10-11: a move and the scenes' ＋ say theirs through `settle` — once the page shows it, never at the
     press (owner: "a pop up says it moved but didn't") — and `settle` ends in the one `setToast(words)`. */
  assert.match(sheet, /const settle = \(what: PartWorking, words: string[^{]*\{[\s\S]{0,260}?setToast\(words\);/);
  const direct = (sheet.match(/setToast\(/g) ?? []).length - 1;
  const settled = (sheet.match(/(?<![.\w])settle\(/g) ?? []).length;
  /* Two wait for the page: ＋ a part of this page, ＋ a part another page draws ("… added on Details").
     (🔁 Re-aimed 2026-10-11 (DECISION_LOG "IN THE MAKER, A SCENE IS MOVED BY DRAGGING IT ON THE PAGE AND REMOVED BY DROPPING IT ON A BIN"): "<Scene> moved" and "<Scene> removed from this page" were this toast's.
     The approved prototype says them on THE LINE UNDER THE TOOLS — "Saving…", then nothing for a move; "<Scene>
     removed" beside Undo — because a scene dropped on the page is already where it was put, and Undo has to be a
     button that stays. That line is the toolbar's row 4 (`scene-drag.tsx`), never a strip in this panel.) */
  assert.equal(settled, 2, 'the scenes’ ＋ no longer waits for the page before it speaks');
  /* (`direct`: a Post Event scene added — said at the press, as before; the other `setToast` is `settle`'s own.) */
  /* (2026-10-12, `rd/maker-moves-instant`, `lib/a-scene-move-is-drawn-at-once.test.ts`): ＋ beside a picked scene is drawn at once and speaks through `landed` — once the page shows the
     part (its save and the page's own redraw), never at the press: a fourth `setToast(words)`, the same words. */
  assert.match(sheet, /void landed\('add', done\)\.then\(\(how\) => \{\s*if \(how !== 'shown'\) return;\s*bringOntoScreen\(c\);\s*setToast\(words\);/);
  assert.equal(direct + settled, 4, 'a message the panel used to say is gone (added · added drawn · added on another page · a Post Event scene added)');
  const line = read('app/dashboard/[eventId]/launch/_components/scene-drag.tsx');
  assert.match(line, /put\(step\.type === 'remove' \? \{ kind: 'removed', label: step\.label \} : null\);/, 'a removed scene is not said on the line under the tools');
});

test('(8) an action: a small pill at the right, 6 s, the only tap — and without one the markup carries none', async () => {
  assert.equal(PEEK_TOAST_ACTION_MS, 6000);
  const plain = await draw({}, 'Removed Maria');
  const withAction = await draw({ action: { label: 'Undo', onPress: () => {} } }, 'Removed Maria');
  assert.match(withAction, /<span class="min-w-0 line-clamp-2 \[text-wrap:balance\]">Removed Maria<\/span><button type="button" data-peek-toast-action="" class="[^"]*pointer-events-auto[^"]*">Undo<\/button>/);
  assert.match(withAction, /role="status" aria-live="polite"/, 'a toast with an action is not announced');
  assert.match(withAction, /class="[^"]*!pr-2[^"]*"/, 'the pill has no room at the right');
  assert.ok(has(PEEK_TOAST_PLACE, 'pointer-events-none'));
  assert.doesNotMatch(plain, /data-peek-toast-action|aria-live|<button/);
  assert.equal(plain, await draw({ tone: 'ok', action: undefined }, 'Removed Maria'), 'an undefined action changes the markup');
  assert.equal(
    plain.replace(/<svg[\s\S]*?<\/svg>/, '<MARK/>'),
    '<div data-peek-toast="" data-tone="ok" class="' + PEEK_TOAST_PLACE + '"><div role="status" class="' + PEEK_TOAST_MOTION + ' ' + PEEK_TOAST_PILL + ' ' + PEEK_TOAST_TONE.ok + '"><MARK/><span class="' + PEEK_TOAST_WORDS + '">Removed Maria</span></div></div>',
    'the no-action markup is no longer the one pill',
  );
  assert.doesNotMatch(await draw({ tone: 'bad', onRetry: () => {} }), /data-peek-toast-action/);
  assert.doesNotMatch(SRC, /setInterval|useToast/, 'the action leans on a poll or the older provider');
});

test('(10) ONE PILL — the app-wide provider and the admin map’s toast wear the same pill, place and motion', async () => {
  const provider = read('app/_components/toast/toast-provider.tsx');
  assert.match(provider, /import \{ PEEK_TOAST_MOTION, PEEK_TOAST_PILL, PEEK_TOAST_TONE, PEEK_TOAST_WORDS, type PeekToastTone \} from '\.\/peek-toast';/);
  assert.match(provider, /className=\{`\$\{PEEK_TOAST_MOTION\} \$\{PEEK_TOAST_PILL\} \$\{PEEK_TOAST_TONE\[tone\]\}/, 'the provider draws a shape of its own');
  assert.match(provider, /className="sn-m-toast-place pointer-events-none fixed inset-x-0 z-\[100\] /, 'the provider is not in the toast’s place');
  assert.doesNotMatch(provider, /\bbottom-\d|\btop-\d|\btop-\[|sn-rise|animation:|\d+ms/, 'the provider places or times itself');
  /* Its leaving is the same state (`data-leaving`), then it is taken off the page. */
  assert.match(provider, /data-leaving=\{leaving \? '' : undefined\}/);
  const map = read('app/admin/categories/_components/map-toast.tsx');
  assert.match(map, /className="sn-m-toast-place pointer-events-none fixed inset-x-0 /, 'the map’s toast is not in the toast’s place');
  assert.match(map, /className="sn-m-toast /, 'the map’s toast does not wear the one motion');
  assert.doesNotMatch(map, /\bbottom-\[|\btop-|-translate-x-1\/2/, 'the map’s toast places itself (a translate of its own would fight the rise)');
  /* The guests' Undo toast is this pill already (its host renders `PeekToast`). */
  assert.match(read('app/dashboard/[eventId]/guests/_components/undo-toast.tsx'), /<PeekToast\b[\s\S]*?action=\{\{/);
  /* Rendered: the provider's container sits at the foot. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ToastProvider } = await import('../app/_components/toast/toast-provider');
  const html = renderToStaticMarkup(React.createElement(ToastProvider, null, 'x'));
  assert.match(html, /<div role="status" aria-live="polite" data-toasts="" class="sn-m-toast-place /);
});

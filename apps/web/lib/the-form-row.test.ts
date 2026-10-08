/**
 * the-form-row.test.ts — THE FORM ROW, THE ⓘ EXPLANATION AND THE FOLD: the shared pieces.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9; approved gallery `prototypes/control_templates_2026-10-08.html`
 * § 6 Form row · § 7 ⓘ explanation · § 10 Field · § 19 Fold): *"field follow form row style"* · *"cannot edit the
 * other. no more check just (X) tapping out is auto accept or pressing enter"* · *"highlighted text box are
 * required"* · *"if a text box has incomplete information or invalid. make it shake so they can find it easily"* ·
 * *"i want this to scroll so they see the whole content of the message. pause for 1 second then start from the
 * beginning again"* · *"should dropdown have a consistent width?"* · *"the collapse should also animate how the Row
 * Name returns"* · *"pill box not rounded edge"*.
 *
 *   (1) LEAVING A FIELD — tapping out and Enter KEEP, ✕ and Esc leave it as it was; nothing changed = nothing sent;
 *       a required box left empty is not kept; something wrong is NOT sent and is said; a long message keeps its
 *       lines and Enter is a new line there.
 *   (2) A LONG ANSWER — rests ONE second, scrolls to its end at a reading pace, rests ONE second, returns, and that
 *       turn repeats; words that fit do not move; it moves only on screen, never while edited, never under reduce
 *       motion; it is moved with `transform` (never `text-indent`).
 *   (3) THE ROW, RENDERED — the name left, the answer right as ONE white pill; every pill of a list is the SAME
 *       width (typed and chosen alike); the pencil says "type"; a switch is the one switch; a fact has no control.
 *   (4) REQUIRED AND WRONG — required = the accent highlight + the word "Required", gone once filled; red only for
 *       something wrong; an amount keeps its ₱.
 *   (5) THE OPEN FIELD, RENDERED — across the row with ONLY ✕ (no ✓, no Save); the name is its placeholder; a long
 *       one is a taller box with the large corner under its name.
 *   (6) A SAVE THAT DID NOT LAND — says so with Try again; the tick is drawn only for a save that landed.
 *   (7) THE MOTION — open, fold back, the name's return and the shake are in the stylesheet at the family's speed,
 *       hold no transform afterwards, and none runs under reduce motion.
 *   (8) THE ⓘ — its own 44-px button; a phone gets the centred popup (dark, blurred, locked, "Got it"), a computer
 *       the attached note; one open at a time.
 *   (9) THE FOLD — opens downward, the arrow turns, one open at a time; what is inside stays mounted, out of reach.
 *  (10) THE WATCH — the shared pieces import nothing of the Maker's and write no colour for the accent.
 *
 * Mutations seen RED (2026-10-08), each restored: `exitKeeps` also keeping `x` → (1); the rest at each end 1000 →
 * 400 ms → (2); the typed pill given `w-auto` instead of the list's width → (3); "Required" left on a filled row →
 * (4); a ✓ button added to the open field → (5); the failed line dropped → (6); `forwards` on the fold-back → (7);
 * the popup's dark layer removed → (8); the fold unmounting what is inside → (9).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import * as R from './form-row';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const ROW = 'app/_components/form-row.tsx';
const EXPLAIN = 'app/_components/explain.tsx';
const FOLD = 'app/_components/fold.tsx';
const CSS = raw('app/globals.css');
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const h = React.createElement;

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
const rows = () => import('../app/_components/form-row');

test('(1) leaving a field: tapping out and Enter keep, ✕ and Esc leave it; unchanged, required-empty and wrong are never sent', () => {
  // THE CLAIM: there is no ✓ — exactly two exits keep.
  assert.deepEqual((['tap-out', 'enter', 'x', 'escape'] as const).map(R.exitKeeps), [true, true, false, false]);
  const before = 'Maria & Jose';
  assert.deepEqual(R.keepOutcome({ exit: 'tap-out', typed: ' Maria  &  Joseph ', before }), { kind: 'send', text: 'Maria & Joseph' }, 'a tap out does not keep the change');
  assert.deepEqual(R.keepOutcome({ exit: 'enter', typed: 'Maria & Joseph', before }), { kind: 'send', text: 'Maria & Joseph' });
  assert.deepEqual(R.keepOutcome({ exit: 'x', typed: 'Maria & Joseph', before }), { kind: 'as-it-was' }, '✕ kept the change');
  assert.deepEqual(R.keepOutcome({ exit: 'escape', typed: 'Maria & Joseph', before }), { kind: 'as-it-was' }, 'Esc kept the change');
  // Nothing changed = nothing sent (one request per EDIT, none for a look).
  assert.deepEqual(R.keepOutcome({ exit: 'tap-out', typed: ' Maria & Jose ', before }), { kind: 'as-it-was' });
  // A box that must be filled, left empty: not kept. An optional one may be cleared.
  assert.deepEqual(R.keepOutcome({ exit: 'tap-out', typed: '   ', before, required: true }), { kind: 'still-needed' });
  assert.deepEqual(R.keepOutcome({ exit: 'tap-out', typed: '   ', before }), { kind: 'send', text: '' });
  // Something WRONG stays (so it can be fixed), is said — and is not sent.
  const email = (t: string) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? null : 'That email is not complete. Add the part after @.');
  assert.deepEqual(R.keepOutcome({ exit: 'tap-out', typed: 'maria@', before: '', check: email }), { kind: 'wrong', text: 'maria@', words: 'That email is not complete. Add the part after @.' });
  assert.deepEqual(R.keepOutcome({ exit: 'enter', typed: 'maria@santos.ph', before: '', check: email }), { kind: 'send', text: 'maria@santos.ph' });
  assert.deepEqual(R.keepOutcome({ exit: 'x', typed: 'maria@', before: 'm@s.ph', check: email }), { kind: 'as-it-was' }, '✕ on a wrong answer did not leave it as it was');
  // A long message keeps its own lines; Enter is a new line there, so only the tap out keeps it.
  assert.deepEqual(R.keepOutcome({ exit: 'tap-out', typed: ' Dear friends,\n\nsee you there. ', before: '', long: true }), { kind: 'send', text: 'Dear friends,\n\nsee you there.' });
  assert.equal(R.enterKeeps(true), false);
  assert.equal(R.enterKeeps(false), true);
});

test('(2) a long answer rests one second, scrolls to its end, rests one second, returns — and repeats; never while edited', () => {
  // Words that fit (or miss by a hair) do not move.
  assert.equal(R.longAnswerPlan(0), null);
  assert.equal(R.longAnswerPlan(2), null);
  assert.equal(R.longAnswerPlan(-40), null);
  const plan = R.longAnswerPlan(120)!;
  const at = plan.frames.map((f) => [f.x, Math.round(f.offset * plan.totalMs)]);
  // THE CLAIM, measured in ms: still for the first 1000, at the end by 1000 + travel, still there for 1000, back at the turn's end.
  assert.deepEqual(at[0], [0, 0]);
  assert.deepEqual(at[1], [0, 1000], 'it does not rest one second at the beginning');
  assert.equal(at[2]![0], -120, 'it does not reach the end of the words');
  assert.equal(at[3]![0], -120);
  assert.equal(at[3]![1]! - at[2]![1]!, 1000, 'it does not rest one second at the end');
  assert.deepEqual(at[4], [0, plan.totalMs], 'it does not start from the beginning again');
  // A reading pace: longer words take longer, and a short overrun is never a flick.
  const travel = (px: number) => { const p = R.longAnswerPlan(px)!; return Math.round((p.frames[2]!.offset - p.frames[1]!.offset) * p.totalMs); };
  assert.equal(travel(10), R.LONG_ANSWER_MIN_MOVE_MS);
  assert.equal(travel(300), 300 * R.LONG_ANSWER_MS_PER_PX);
  assert.ok(travel(300) > travel(120));
  // When it may move at all.
  assert.equal(R.longAnswerMoves({ onScreen: true, editing: false, reducedMotion: false }), true);
  assert.equal(R.longAnswerMoves({ onScreen: false, editing: false, reducedMotion: false }), false, 'it runs off screen');
  assert.equal(R.longAnswerMoves({ onScreen: true, editing: true, reducedMotion: false }), false, 'it runs while its row is edited');
  assert.equal(R.longAnswerMoves({ onScreen: true, editing: false, reducedMotion: true }), false, 'it moves under reduce motion');
  // The wiring: its own strip moved with transform, repeating, only while seen — and stopped (unmounted) while the row is open.
  const src = read(ROW);
  assert.match(src, /transform: `translateX\(\$\{f\.x\}px\)`/, 'the words are not moved with transform');
  assert.doesNotMatch(src, /text-?indent/i, 'an animated text-indent is not repainted in the owner’s browser');
  assert.match(src, /iterations: Infinity/, 'the turn does not repeat');
  assert.match(src, /new IntersectionObserver\(/, 'it is not limited to while it is on screen');
  assert.match(src, /longAnswerMoves\(\{ onScreen, editing: false, reducedMotion: still\.matches \}\)/);
  assert.match(src, /\{editing \? \(\s*<FormRowField/, 'the pill (and its moving words) stays drawn while the row is edited');
});

test('(3) the row, rendered: the name left, ONE white pill right — every pill of a list the same width; a switch; a fact', async () => {
  const { FormRows, TypedRow, ChosenRow, SwitchRow, FactRow, FORM_PILL_WIDTH } = await rows();
  const list = (width?: 'short' | 'wide') =>
    h(FormRows, { width, children: [
      h(TypedRow, { key: 'a', name: 'Event name', value: 'Maria & Jose', onKeep: () => {} }),
      h(ChosenRow, { key: 'b', name: 'Name style', value: 'full', options: [{ key: 'full', label: 'Full' }, { key: 'mi', label: 'Middle initial' }, { key: 'sf', label: 'Surname first' }], onPick: () => {} }),
      h(TypedRow, { key: 'c', name: 'Special message', value: '', empty: 'Add a message', long: true, onKeep: () => {} }),
      h(SwitchRow, { key: 'd', name: 'Show the event QR', on: true, onChange: () => {} }),
      h(FactRow, { key: 'e', name: 'Date', value: 'Saturday, December 12, 2026', where: 'Set when you book your venue in Suppliers' }),
    ] });
  const html = await paint(list());
  assert.equal(count(html, /data-form-row=""/g), 5);
  // THE CLAIM — one width for the list: the two typed pills and the dropdown's button all wear it.
  assert.equal(FORM_PILL_WIDTH.wide, 'w-[200px]');
  const pills = html.match(/<button[^>]*(?:data-form-row-pill="typed"|aria-haspopup="listbox")[^>]*>/g) ?? [];
  assert.equal(pills.length, 3, 'anti-vacuity: the three pills were not found');
  for (const p of pills) {
    assert.match(p, /\bw-\[200px\]/, `a pill does not take the list’s width: ${p.slice(0, 120)}`);
    assert.match(p, /rounded-full/, 'a pill is not a full pill');
    assert.match(p, /justify-between/, 'the mark is not pinned to the right');
  }
  const short = await paint(list('short'));
  assert.equal(count(short, /\bw-\[150px\]/g), 3, 'a `short` list’s pills are not all 150 px');
  assert.doesNotMatch(short, /w-\[200px\]/);
  // The name is on the left, before its answer; the pencil is the accent and says "type".
  assert.ok(html.indexOf('Event name') < html.indexOf('data-form-row-pill="typed"'));
  assert.equal(count(html, /data-form-row-mark="pencil"/g), 2);
  assert.match(html, /<svg[^>]*text-sn-accent[^>]*data-form-row-mark="pencil"/, 'the pencil is not the accent');
  assert.match(html, /aria-label="Event name: Maria &amp; Jose\. Tap to change"/);
  // Nothing is open on arrival: no box, no ✕ — and never a ✓ or a Save.
  assert.doesNotMatch(html, /<input|<textarea|data-form-row-leave/);
  assert.doesNotMatch(html, />\s*(Save|Saved|Done)\s*</);
  // An empty answer says what to do, quietly.
  assert.match(html, /text-ink\/45[^>]*><span>Add a message/);
  // The switch is the one switch; the fact has no control at all.
  assert.match(html, /<button[^>]*role="switch"[^>]*aria-checked="true"[^>]*aria-label="Show the event QR"/);
  assert.match(html, /class="sn-switch /);
  const fact = html.slice(html.indexOf('data-form-row-kind="fact"'));
  assert.doesNotMatch(fact, /<button|<input/, 'a fact that cannot be changed here looks tappable');
  assert.match(fact, /Saturday, December 12, 2026/);
  assert.match(fact, /Set when you book your venue in Suppliers/);
});

test('(4) required = the accent highlight and the word "Required", gone once filled; an amount keeps its ₱', async () => {
  const { TypedRow } = await rows();
  const empty = await paint(h(TypedRow, { name: 'Guest’s name', value: '', required: true, onKeep: () => {} }));
  assert.match(empty, /data-form-row-required=""[^>]*>Required</);
  assert.match(empty, /data-form-row-needs="answer"/);
  assert.match(empty, /data-form-row-pill="typed"[^>]*class="[^"]*border-sn-accent[^"]*ring-sn-accent\/15/, 'a required box is not highlighted');
  assert.doesNotMatch(empty, /danger/, 'red is used for "not filled yet"');
  const filled = await paint(h(TypedRow, { name: 'Guest’s name', value: 'Teresita Santos', required: true, onKeep: () => {} }));
  assert.doesNotMatch(filled, /Required|data-form-row-needs|border-sn-accent/, 'the highlight stays on a filled box');
  // Not required: never the word, never the highlight.
  assert.doesNotMatch(await paint(h(TypedRow, { name: 'Mobile', value: '', onKeep: () => {} })), /Required|border-sn-accent/);
  assert.equal(R.showsRequired(true, '  '), true);
  assert.equal(R.showsRequired(true, 'x'), false);
  assert.equal(R.showsRequired(false, ''), false);
  // ₱: the digits are what is kept, the pill shows the mark and the commas.
  assert.equal(R.amountDigits('₱250,000.00 po'), '250000');
  assert.equal(R.amountDigits('007'), '7');
  assert.equal(R.amountWords('250000'), '₱250,000');
  assert.equal(R.amountWords(''), '');
  const budget = await paint(h(TypedRow, { name: 'Budget', value: '250000', amount: true, onKeep: () => {} }));
  assert.match(budget, /aria-label="Budget: ₱250,000\. Tap to change"/);
  assert.match(budget, /<span>₱250,000<\/span>/);
});

test('(5) the open field, rendered: across the row with ONLY ✕ — no ✓; the name is its placeholder; a long one is a tall box', async () => {
  const { FormRowField } = await rows();
  const open = (extra: Record<string, unknown>) =>
    paint(h(FormRowField, { handle: { current: null }, name: 'Event name', nameId: 'n1', start: 'Maria & Jose', placeholder: 'Event name', long: false, maxLength: 240, mark: null, leaving: false, onEnd: () => {}, onGone: () => {}, ...extra } as never));
  const line = await open({});
  assert.equal(count(line, /<button/g), 1, 'the open field has more than its one ✕');
  assert.match(line, /<button[^>]*aria-label="Leave it as it was"[^>]*data-form-row-leave=""/);
  assert.doesNotMatch(line, />\s*(Keep|Save|Done)\s*<|aria-label="[^"]*(keep|save|accept)/i, 'there is a ✓ again');
  assert.match(line, /<input[^>]*placeholder="Event name"/, 'the name does not become the placeholder');
  assert.match(line, /<input[^>]*value="Maria &amp; Jose"/);
  // The row keeps its height: the field sits on the row's own line; it is a full pill.
  assert.match(line, /data-form-row-field="line"[^>]*class="sn-row-field flex min-h-\[52px\] items-center/);
  assert.match(line, /rounded-full border border-sn-accent bg-white/);
  // An amount keeps its ₱ in front of the box.
  assert.match(await open({ mark: '₱', start: '250000' }), /data-form-row-amount-mark=""[^>]*>₱<\/span><input/);
  // A long message: its name above it, a taller box with the large corner — a pill cannot hold lines.
  const long = await open({ long: true, start: 'We can’t wait to see you.' });
  assert.match(long, /data-form-row-field="long"/);
  assert.match(long, /<textarea/);
  assert.match(long, /rounded-2xl border border-sn-accent/);
  assert.doesNotMatch(long, /<span class="flex rounded-full/);
  assert.equal(count(long, /<button/g), 1);
  assert.ok(long.indexOf('>Event name<') < long.indexOf('<textarea'), 'the long box is not under its name');
  // The wiring of the two ways out, in the source.
  const src = read(ROW);
  assert.match(src, /onBlur: \(\) => end\('tap-out'\)/);
  assert.match(src, /if \(!wrap\.current\?\.contains\(e\.target as Node\)\) endRef\.current\('tap-out'\);/, 'a tap outside the field does not keep it');
  assert.match(src, /onPointerDown=\{\(e\) => \{\s*e\.preventDefault\(\);\s*end\('x'\);/, '✕ can be read as the tap-out that keeps');
  assert.match(src, /if \(e\.key === 'Enter' && enterKeeps\(long\)\)/);
  assert.match(src, /else if \(e\.key === 'Escape'\) \{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*end\('escape'\);/);
  // ONE row open at a time: opening another asks this one to keep and close.
  assert.match(src, /if \(openElsewhere && mode === 'open'\) field\.current\?\.end\('tap-out'\);/);
});

test('(6) a save that did not land says so with Try again — the tick is only for one that landed', () => {
  assert.equal(R.saveFailedWords('Special message', 'You may be offline.'), 'Special message did not save. You may be offline.');
  assert.equal(R.saveFailedWords('Special message', null), 'Special message did not save.');
  const src = read(ROW);
  // A refusal, and a thrown save, both end in `failed` — never `saved`.
  assert.match(src, /if \(r && r\.ok === false\) setState\(\{ kind: 'failed', text, reason: r\.error \?\? null \}\);\s*else setState\(\{ kind: 'saved' \}\);/);
  assert.equal(count(src, /setState\(\{ kind: 'failed', text, reason: null \}\)/g), 2, 'a save that throws is not said');
  // The line and its retry are drawn for `failed`; the tick only for `saved`.
  assert.match(src, /failed \? \(\s*<p role="alert" data-form-row-unsaved=""/);
  assert.match(src, /data-form-row-retry="" onClick=\{\(\) => send\(state\.text\)\}/, 'Try again does not send the same words again');
  assert.match(src, /state\.kind === 'saved' \? \(\s*<Check aria-hidden data-form-row-mark="tick"/);
  // …and something WRONG is never sent at all.
  assert.match(src, /out\.kind === 'wrong'\) \{\s*setShown\(out\.text\);\s*after\.current = \(\) => \{\s*setState\(\{ kind: 'wrong', words: out\.words \}\);\s*setShake/);
});

test('(7) the motion is in the stylesheet at the family’s speed, holds no transform afterwards, and is off under reduce motion', () => {
  const rule = (sel: string) => {
    const at = CSS.indexOf(`\n${sel} {`);
    assert.ok(at > 0, `anti-vacuity: \`${sel}\` is not in the stylesheet`);
    return CSS.slice(at, CSS.indexOf('}', at));
  };
  for (const k of ['sn-row-field-in', 'sn-row-field-out', 'sn-row-name-back', 'sn-row-pill-back', 'sn-row-shake', 'sn-explain-in']) {
    assert.match(CSS, new RegExp(`@keyframes ${k} \\{`), `the stylesheet has no ${k}`);
  }
  // Open, fold back, and the name's return: each at a share of the ONE speed token.
  for (const sel of ['.sn-row-field', '.sn-row-field[data-leaving]', '[data-form-row-back] > .sn-row-name', '[data-form-row-back] > .sn-row-pill']) {
    assert.match(rule(sel), /animation: sn-row-[a-z-]+ calc\(var\(--sn-pill-dur\) \* 0\.\d+\)/, `${sel} does not move at the family’s speed`);
    assert.doesNotMatch(rule(sel), /\b(forwards|both)\b/, `${sel} would be left holding a transform`);
  }
  // The fold-back ends GONE without a fill mode: the leaving field's own style is invisible.
  assert.match(rule('.sn-row-field[data-leaving]'), /opacity: 0;/);
  assert.match(CSS, /@keyframes sn-row-name-back \{\s*from \{ opacity: 0; transform: translateX\(-14px\); \}/, 'the name does not slide back in from the left');
  assert.match(CSS, /@keyframes sn-row-field-out \{[^}]*\}\s*to \{ opacity: 0; transform: scaleX\(0\.7\); \}/, 'the field does not fold back');
  assert.match(rule('.sn-row-field'), /transform-origin: right center;/, 'it does not fold toward the right');
  // The shake: once (no `infinite`), and the screen moves to it.
  assert.doesNotMatch(rule('.sn-row-shake'), /infinite/);
  const src = read(ROW);
  assert.match(src, /el\.scrollIntoView\(\{ block: 'center', behavior: still \? 'auto' : 'smooth' \}\);\s*if \(still\) return;/, 'under reduce motion the screen does not move to it, or it still shakes');
  // Reduce motion: none of it.
  const off = CSS.slice(CSS.indexOf('.sn-row-field,\n  .sn-row-field[data-leaving],'));
  assert.ok(off.length > 20, 'anti-vacuity: the reduce-motion block was not found');
  const block = off.slice(0, off.indexOf('}'));
  for (const s of ['.sn-row-shake', '[data-form-row-back] > .sn-row-name', '.sn-explain-pop']) assert.ok(block.includes(s), `${s} still moves under reduce motion`);
  assert.match(block, /animation: none !important;/);
});

test('(8) the ⓘ is its own 44-px button: a centred popup with "Got it" on a phone (dark, blurred, locked), a note on a computer', async () => {
  const { Explain, explainOpensAs, EXPLAIN_PHONE_QUERY } = await import('../app/_components/explain');
  assert.equal(explainOpensAs(375), 'popup');
  assert.equal(explainOpensAs(1023), 'popup');
  assert.equal(explainOpensAs(1024), 'note');
  assert.equal(EXPLAIN_PHONE_QUERY, '(max-width: 1023.98px)');
  const html = await paint(h(Explain, { title: 'Look', children: 'How every guest page looks and sounds.' }));
  assert.match(html, /^<button type="button" data-explain="" aria-label="About Look" aria-haspopup="dialog" aria-expanded="false"/);
  assert.match(html, /class="sn-press [^"]*h-11 w-11 flex-none/, 'the ⓘ is not a 44-px target');
  assert.match(html, /text-sn-accent/, 'the mark is not the accent');
  assert.doesNotMatch(html, /Got it|role="dialog"/, 'the explanation is drawn before it is asked for');
  const src = read(EXPLAIN);
  // The pop-up rule, on a phone: dark + blurred, nothing behind works, the page does not scroll, the dark closes.
  assert.match(src, /<span aria-hidden className="sn-popup-dark pointer-events-none absolute inset-0" \/>/, 'the rest of the screen is not darkened and blurred');
  assert.match(src, /return el \? inertBehind\(el\) : undefined;/, 'what is behind the popup still works');
  assert.match(src, /useModalA11y\(\{ open: true, onClose, containerRef: panel, initialFocusRef: got \}\);/);
  assert.match(src, /<button type="button" aria-label="Close" data-explain-scrim="" onClick=\{onClose\}/, 'a tap on the dark does not close it');
  assert.match(src, /role="dialog"\s*aria-modal="true"/);
  assert.match(src, /data-explain-got-it=""\s*onClick=\{onClose\}[^>]*>\s*Got it\s*<\/button>/);
  assert.match(src, /max-h-\[calc\(100dvh-48px\)\]/, 'the popup can be taller than the screen');
  // A computer: attached to its ⓘ, and it does NOT darken the page.
  const note = src.slice(src.indexOf('function ExplainNote'));
  assert.doesNotMatch(note, /sn-popup-dark|inertBehind|aria-modal/);
  assert.match(note, /placePickList\(/);
  // One open at a time.
  assert.match(src, /useOneOpen\(open !== null, \(\) => setOpen\(null\)\);/);
  // Which one: decided by the screen's width at the press.
  assert.match(src, /setOpen\(\(o\) => \(o \? null : explainOpensAs\(window\.innerWidth\)\)\)/);
});

test('(9) the fold opens downward, its arrow turns, one is open at a time — and what is inside stays mounted', async () => {
  const { Fold } = await import('../app/_components/fold');
  const shut = await paint(h(Fold, { title: 'More for guests', summary: 'the address, who can view, the QR', children: h('input', { name: 'kept', defaultValue: 'still here' }) }));
  assert.match(shut, /<button type="button" data-fold-head="" aria-expanded="false"/);
  assert.match(shut, /More for guests<small[^>]*> · the address, who can view, the QR<\/small>/);
  // THE CLAIM: shut, the field inside is still in the page (it keeps its words) — only out of reach.
  assert.match(shut, /<input name="kept" value="still here"\/>/, 'a shut fold unmounts what is inside');
  assert.match(shut, /data-fold-body="" inert=""/, 'a shut fold’s controls can still be reached');
  assert.match(shut, /grid-rows-\[0fr\]/);
  const open = await paint(h(Fold, { title: 'More for guests', defaultOpen: true, children: 'x' }));
  assert.match(open, /aria-expanded="true"/);
  assert.match(open, /grid-rows-\[1fr\]/);
  assert.doesNotMatch(open, /inert/);
  assert.match(open, /text-sn-accent[^"]*rotate-180/, 'the arrow does not turn over, or is not the accent');
  assert.doesNotMatch(shut, /rotate-180/);
  const src = read(FOLD);
  assert.match(src, /const scope = useOneOpen\(open, setOpen\);/, 'opening one fold does not close another');
  assert.match(src, /<OneOpenScope id=\{scope\}>\{children\}<\/OneOpenScope>/, 'a dropdown opened inside the fold would close it');
  assert.match(src, /duration-sn-pill/);
});

test('(10) the watch: the shared pieces know no screen and write no colour for the accent', () => {
  for (const file of [ROW, EXPLAIN, FOLD, 'lib/form-row.ts']) {
    const src = read(file);
    assert.ok(src.length > 400, `anti-vacuity: ${file} was not read`);
    assert.doesNotMatch(src, /launch\/_components|maker-|studio-|useMaker|hubDraftAction/, `${file} knows the Maker`);
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, `${file} writes a hex colour`);
    assert.doesNotMatch(src, /mulberry|terracotta|\btext-white\b/, `${file} writes a colour for the accent by name`);
  }
  // What is on / picked / tappable is the ONE token.
  const row = read(ROW);
  for (const cls of ['text-sn-accent', 'border-sn-accent', 'ring-sn-accent/15']) assert.ok(row.includes(cls), `the row does not use ${cls}`);
  // The dropdown and the switch are the house's own — not redrawn here.
  assert.match(row, /import \{ PickMenu \} from '@\/app\/dashboard\/\[eventId\]\/website\/editor\/_components\/pick-menu';/);
  assert.match(row, /import \{ SWITCH_BUTTON, SwitchTrack \} from '\.\/switch-track';/);
  assert.doesNotMatch(row, /role="listbox"|<select/);
});

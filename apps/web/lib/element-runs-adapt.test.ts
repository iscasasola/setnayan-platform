/**
 * element-runs-adapt.test.ts — ✍ PER-LETTER STYLES ADAPT WHEN THE WORDS CHANGE.
 *
 * Owner, 2026-09-28 (DECISION_LOG "DETAILS IS THE ONE FILL-IN AREA…", answer
 * 2, *"can't it adapt?"*): the old and new text are diffed and each styled run
 * is remapped onto the characters that survived — kept letters keep their
 * style, inserted letters take no special style, deleted letters drop theirs —
 * never cleared wholesale, never left on the wrong letter.
 *
 * `adaptHubRuns` is proved here on its own, case by case (insert · delete ·
 * replace · case · whitespace · emoji · Filipino ñ · large edits), then the
 * places that call it: `hubRunsOn` (every render), `withRunChoice` /
 * `withoutRuns` (the save), and `hubRunsTarget` (which scene part a run is on).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { adaptHubRuns } from './element-runs-adapt';
import {
  HUB_ELEMENT_RUN_TEXT_MAX,
  hubRunsOn,
  hubRunsTarget,
  hubTextHash,
  hubTextSegments,
  sanitizeHubElements,
  withRunChoice,
  withoutRuns,
  type HubElementRun,
  type HubElementStyle,
} from './element-style';

const R = (start: number, end: number, extra: Partial<HubElementRun> = {}): HubElementRun => ({ start, end, color: '#8a1c2b', ...extra });
/** The letters each run covers in `text` — what a guest would see styled. */
const lettersOf = (runs: HubElementRun[], text: string) => runs.map((r) => text.slice(r.start, r.end));

/* ── unchanged ──────────────────────────────────────────────────────────── */

test('unchanged text: every run as it was (a copy, not the same objects)', () => {
  const runs = [R(0, 1), R(7, 10, { font: 'script' })];
  const out = adaptHubRuns(runs, 'CaleandIce', 'CaleandIce');
  assert.deepEqual(out, runs);
  assert.notEqual(out[0], runs[0]);
});

/* ── insert ─────────────────────────────────────────────────────────────── */

test('insert BEFORE a run: the run moves with its letters', () => {
  // "I" of Ice styled; a longer first name pushes it right.
  const out = adaptHubRuns([R(7, 8)], 'CaleandIce', 'CarolineandIce');
  assert.deepEqual(lettersOf(out, 'CarolineandIce'), ['I']);
  assert.deepEqual(out, [R(11, 12)]);
});

test('insert AFTER a run: the run stays put', () => {
  const out = adaptHubRuns([R(0, 4)], 'Cale', 'Cale Jr');
  assert.deepEqual(out, [R(0, 4)]);
});

test('insert INSIDE a styled word: the new letter is plain — the run splits around it', () => {
  const out = adaptHubRuns([R(0, 5, { font: 'script' })], 'Maria', 'Marisa');
  assert.deepEqual(lettersOf(out, 'Marisa'), ['Mari', 'a']);
  assert.ok(out.every((r) => r.font === 'script' && r.color === '#8a1c2b'), 'each piece keeps the whole look');
});

test('insert at the very START of a styled word: the new letter is plain', () => {
  const out = adaptHubRuns([R(0, 3)], 'Ice', 'Nice');
  assert.deepEqual(lettersOf(out, 'Nice'), ['ice']);
});

/* ── delete ─────────────────────────────────────────────────────────────── */

test('delete a styled letter: its style goes with it; the others stay on theirs', () => {
  // "J" (offset 0) and "e" (offset 3) styled separately; the "J" is deleted.
  const out = adaptHubRuns([R(0, 1, { font: 'script' }), R(3, 4, { size: 120 })], 'Jose', 'ose');
  assert.deepEqual(out, [{ start: 2, end: 3, color: '#8a1c2b', size: 120 }]);
});

test('delete INSIDE a styled word: the run closes over the gap, one piece', () => {
  const out = adaptHubRuns([R(0, 5)], 'Maria', 'Mara');
  assert.deepEqual(out, [R(0, 4)]);
});

test('delete the whole styled word: no run is left anywhere', () => {
  const out = adaptHubRuns([R(4, 7)], 'CaleandIce', 'CaleIce');
  assert.deepEqual(out, []);
});

test('delete everything: nothing to style', () => {
  assert.deepEqual(adaptHubRuns([R(0, 3)], 'Ice', ''), []);
});

/* ── replace ────────────────────────────────────────────────────────────── */

test('replace ONE name: a run on the other name stays exactly on its letters', () => {
  const was = 'MariaandJose';
  const now = 'MariaandPedro';
  const out = adaptHubRuns([R(0, 1, { font: 'script' }), R(8, 12)], was, now);
  // The "M" keeps its style; "Jose" is gone, and nothing of its style lands on "Pedro".
  assert.deepEqual(lettersOf(out, now), ['M']);
});

test('a replaced letter inside a run: the new letter is plain, the rest keep the style', () => {
  const out = adaptHubRuns([R(0, 4)], 'Cale', 'Cole');
  assert.deepEqual(lettersOf(out, 'Cole'), ['C', 'le']);
});

test('words rewritten completely: no style survives on letters that are not the old ones', () => {
  const out = adaptHubRuns([R(0, 1), R(2, 3)], 'abc', 'xyz');
  assert.deepEqual(out, []);
});

test('the joiner changed ("and" → "&"): the names keep their styles', () => {
  const out = adaptHubRuns([R(0, 1), R(7, 8)], 'CaleandIce', 'Cale&Ice');
  assert.deepEqual(lettersOf(out, 'Cale&Ice'), ['C', 'I']);
});

/* ── case ───────────────────────────────────────────────────────────────── */

test('a change of CASE keeps the style — it is the same letter', () => {
  const out = adaptHubRuns([R(0, 1, { font: 'script' })], 'maria', 'Maria');
  assert.deepEqual(out, [R(0, 1, { font: 'script' })]);
  const upper = adaptHubRuns([R(0, 5)], 'Maria', 'MARIA SANTOS');
  assert.deepEqual(lettersOf(upper, 'MARIA SANTOS'), ['MARIA']);
});

/* ── whitespace ─────────────────────────────────────────────────────────── */

test('whitespace: a doubled space collapsed, a line break become a space — the words keep their styles', () => {
  const was = 'Our  day\nbegins';
  const now = 'Our day begins';
  const out = adaptHubRuns([R(0, 3), R(5, 8), R(9, 15)], was, now);
  assert.deepEqual(lettersOf(out, now), ['Our', 'day', 'begins']);
});

test('a styled SPACE survives a change of its kind (tab → space), and is dropped when deleted', () => {
  assert.deepEqual(lettersOf(adaptHubRuns([R(1, 2)], 'a\tb', 'a b'), 'a b'), [' ']);
  assert.deepEqual(adaptHubRuns([R(1, 2)], 'a b', 'ab'), []);
});

/* ── emoji ──────────────────────────────────────────────────────────────── */

test('emoji: an inserted emoji (two UTF-16 units) shifts the run by exactly its length', () => {
  const was = 'Cale & Ice';
  const now = 'Cale 💍 & Ice';
  const out = adaptHubRuns([R(7, 10)], was, now);
  assert.deepEqual(lettersOf(out, now), ['Ice']);
  assert.equal(out[0]!.start, 10, 'offsets are UTF-16 code units, the unit a Range counts in');
});

test('emoji: a styled emoji keeps its style whole — never half a surrogate pair', () => {
  const was = 'I 💍 you';
  const now = 'We 💍 you';
  const out = adaptHubRuns([R(2, 4)], was, now);
  assert.deepEqual(lettersOf(out, now), ['💍']);
  // A family emoji is ONE character to the couple (a ZWJ sequence).
  const fam = '👨‍👩‍👧';
  const out2 = adaptHubRuns([R(0, fam.length)], `${fam} Santos`, `The ${fam} Santos`);
  assert.deepEqual(lettersOf(out2, `The ${fam} Santos`), [fam]);
});

test('emoji: a skin tone or a flag is ONE character — changing it replaces the whole emoji, never styles half', () => {
  // 👍🏽 → 👍🏿: the modifier is part of the character, so the styled emoji is REPLACED.
  assert.deepEqual(adaptHubRuns([R(4, 8)], 'Yes 👍🏽!', 'Yes 👍🏿!'), []);
  // 🇵🇭 is two regional indicators drawn as one flag.
  assert.deepEqual(lettersOf(adaptHubRuns([R(0, 4)], '🇵🇭 Manila', 'From 🇵🇭 Manila'), 'From 🇵🇭 Manila'), ['🇵🇭']);
  assert.deepEqual(adaptHubRuns([R(0, 4)], '🇵🇭 Manila', '🇯🇵 Manila'), []);
});

test('emoji: a different emoji in its place is a replaced letter — plain', () => {
  assert.deepEqual(adaptHubRuns([R(2, 4)], 'I 💍 you', 'I 💐 you'), []);
});

/* ── Filipino ñ ─────────────────────────────────────────────────────────── */

test('ñ: a styled ñ keeps its style when the words around it change', () => {
  const was = 'Niño & Ana';
  const now = 'Niño & Anabel';
  const out = adaptHubRuns([R(2, 3, { font: 'script' })], was, now);
  assert.deepEqual(lettersOf(out, now), ['ñ']);
});

test('ñ: precomposed (U+00F1) and decomposed (n + U+0303) are the SAME letter', () => {
  const composed = 'Peña';
  const decomposed = 'Peña';
  const out = adaptHubRuns([R(2, 3)], composed, decomposed);
  // The run covers the whole decomposed letter — both code units — never the bare "n".
  assert.deepEqual(lettersOf(out, decomposed), ['ñ']);
  const back = adaptHubRuns([R(2, 4)], decomposed, composed);
  assert.deepEqual(lettersOf(back, composed), ['ñ']);
});

test('ñ: n → ñ is a DIFFERENT letter (a replace), so the style does not carry onto it', () => {
  assert.deepEqual(adaptHubRuns([R(2, 3)], 'Pena', 'Peña'), []);
});

test('ñ: Ñ in capitals keeps the style of ñ (case)', () => {
  assert.deepEqual(lettersOf(adaptHubRuns([R(2, 3)], 'Niño', 'NIÑO'), 'NIÑO'), ['Ñ']);
});

/* ── shape of the result ────────────────────────────────────────────────── */

test('the result is sorted and never overlaps, whatever the edit', () => {
  const was = 'Together with their families';
  const now = 'Together, with all of their families and friends';
  const runs = [R(0, 3), R(9, 13, { font: 'script' }), R(14, 19, { size: 120 }), R(20, 28)];
  const out = adaptHubRuns(runs, was, now);
  for (let i = 1; i < out.length; i += 1) assert.ok(out[i]!.start >= out[i - 1]!.end, JSON.stringify(out));
  assert.deepEqual(lettersOf(out, now), ['Tog', 'with', 'their', 'families']);
});

test('a middle too large to diff: the head and tail keep their styles, the middle drops — never guessed', () => {
  const head = 'Dear ';
  const tail = ' — love, M&J';
  const was = `${head}${'a'.repeat(600)}${tail}`;
  const now = `${head}${'b'.repeat(600)}${tail}`;
  const out = adaptHubRuns([R(0, 4), R(10, 20), R(was.length - 3, was.length)], was, now);
  assert.deepEqual(lettersOf(out, now), ['Dear', 'M&J']);
});

/* ── every render reads through hubRunsOn ───────────────────────────────── */

const NAMES = 'CaleandIce';
const withWas = (runs: HubElementRun[], was: string): HubElementStyle => ({ runs, of: hubTextHash(was), was });

test('hubRunsOn: the same words → the runs as stored; changed words + `was` → adapted; no `was` → none', () => {
  const style = withWas([R(7, 8)], NAMES);
  assert.equal(hubRunsOn(style, NAMES), style.runs);
  assert.deepEqual(hubRunsOn(style, 'CaleandIvy'), [R(7, 8)]);
  assert.deepEqual(hubRunsOn(style, 'CarolineandIce'), [R(11, 12)]);
  // A run made before `was` existed: dropped on changed words, exactly as before.
  assert.equal(hubRunsOn({ runs: [R(7, 8)], of: hubTextHash(NAMES) }, 'CarolineandIce'), null);
  // Every letter it had is gone: null, not an empty list the page must check.
  assert.equal(hubRunsOn(style, 'CaleandBo'), null);
});

test('hubRunsOn: a forged `was` (not the text `of` fingerprints) adapts nothing', () => {
  const style: HubElementStyle = { runs: [R(0, 1)], of: hubTextHash(NAMES), was: 'Something else' };
  assert.equal(hubRunsOn(style, 'Xyz'), null);
});

test('the guest render cuts the ADAPTED run — the "I" of Ice after the first name grew', () => {
  const style = withWas([R(7, 8, { font: 'script' })], NAMES);
  const now = 'CarolineandIce';
  const segs = hubTextSegments('Ice', style, { text: now, segmentStart: 11 });
  assert.deepEqual(
    segs.map((s) => [s.text, Boolean(s.run)]),
    [
      ['I', true],
      ['ce', false],
    ],
  );
});

/* ── the save re-anchors (withRunChoice / withoutRuns) ──────────────────── */

test('withRunChoice on CHANGED words: the older runs are adapted onto them, never dropped wholesale', () => {
  const els = sanitizeHubElements({ names: withWas([R(0, 1, { font: 'script' }), R(7, 8)], NAMES) });
  const now = 'CarolineandIce';
  const next = withRunChoice(els, 'names', { start: 8, end: 11, of: hubTextHash(now), was: now }, 'color', '#112233');
  assert.deepEqual(lettersOf(next!.names!.runs!, now), ['C', 'and', 'I']);
  assert.equal(next!.names!.of, hubTextHash(now), 're-anchored to the words the choice was made on');
  assert.equal(next!.names!.was, now);
});

test('withRunChoice without the words themselves: older runs on other words are dropped, as before', () => {
  const els = sanitizeHubElements({ names: withWas([R(0, 1)], NAMES) });
  const now = 'CarolineandIce';
  const next = withRunChoice(els, 'names', { start: 8, end: 11, of: hubTextHash(now) }, 'color', '#112233');
  assert.deepEqual(next!.names!.runs, [{ start: 8, end: 11, color: '#112233' }]);
  assert.equal(next!.names!.was, undefined, 'no `was` is kept that the choice did not measure');
});

test('withoutRuns on CHANGED words clears the run where it now is — not at its old offsets', () => {
  const els = sanitizeHubElements({ names: withWas([R(0, 1), R(7, 8)], NAMES) });
  const now = 'CarolineandIce';
  // The "I" is at 11 now; clearing 11–12 must take IT off and keep the "C".
  const next = withoutRuns(els, 'names', { start: 11, end: 12, of: hubTextHash(now), was: now });
  assert.deepEqual(lettersOf(next!.names!.runs!, now), ['C']);
});

test('the sanitizer keeps `was` only while it is the text `of` fingerprints, and not past the run limit', () => {
  const ok = sanitizeHubElements({ heading: withWas([R(0, 3)], 'Our day') });
  assert.equal(ok?.heading?.was, 'Our day');
  const forged = sanitizeHubElements({ heading: { runs: [R(0, 3)], of: hubTextHash('Our day'), was: 'Their day' } });
  assert.equal(forged?.heading?.was, undefined);
  assert.deepEqual(forged?.heading?.runs, [R(0, 3)], 'the runs themselves stay — only the adapt source goes');
  const long = 'x'.repeat(HUB_ELEMENT_RUN_TEXT_MAX + 1);
  assert.equal(sanitizeHubElements({ body: withWas([R(0, 3)], long) })?.body?.was, undefined);
  assert.equal(sanitizeHubElements({ body: { was: 'Our day' } }), null, 'a `was` with no runs is nothing');
});

/* ── which scene part the runs are on ───────────────────────────────────── */

test('hubRunsTarget: the part with the same words; else the one that kept most of them; else none', () => {
  const style = withWas([R(0, 3)], 'Our story');
  assert.equal(hubRunsTarget(['Schedule', 'Our story', 'Gifts'], style), 1);
  assert.equal(hubRunsTarget(['Schedule', 'Our love story', 'Gifts'], style), 1);
  assert.equal(hubRunsTarget(['Schedule', 'Gifts'], style), -1, 'no part keeps half its letters: none, never a guess');
  assert.equal(hubRunsTarget(['Our story'], { runs: [R(0, 3)], of: hubTextHash('Our story') }), 0);
  assert.equal(hubRunsTarget(['Our love story'], { runs: [R(0, 3)], of: hubTextHash('Our story') }), -1, 'no `was`: exact words only');
  assert.equal(hubRunsTarget(['Our story'], null), -1);
});

/* ── a replaced word leaves no stray letter behind ──────────────────────── */

test('a replaced word keeps NO stray letter it happens to share with the new one', () => {
  // "story" → "journey" share o · r · y; the couple styled "story", not those letters of "journey".
  assert.deepEqual(adaptHubRuns([R(4, 9)], 'Our story', 'Our journey'), []);
  // "Jose" → "Pedro" share an "e" / an "o".
  assert.deepEqual(adaptHubRuns([R(0, 4)], 'Jose', 'Pedro'), []);
  // …while a whole kept word always stays, however large the edits around it.
  const out = adaptHubRuns([R(10, 14)], 'We met in 2019 and', 'Long ago we met in Baguio, in 2019, and then');
  assert.deepEqual(lettersOf(out, 'Long ago we met in Baguio, in 2019, and then'), ['2019']);
});

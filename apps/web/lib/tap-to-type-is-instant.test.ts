/**
 * tap-to-type-is-instant.test.ts — ✍ TAP ANY TEXT, TYPE RIGHT THERE: ONE WRITE,
 * THE PAGE'S OWN WORDS, NOTHING RELOADS.
 *
 * Maker core part 2 (`prototypes/maker_in_four_2026-09-30_fable.html` frames B ·
 * C · H; DECISION_LOG "THE MAKER RE-PLAN IS CUT TO ITS CORE" and "EVERYTHING
 * REBUILT IN THE MAKER IS INSTANT BY DESIGN"). What this proves:
 *
 *   1. typed words become the part's OWN words on the hero's canvas (the field
 *      the joiner, link and caption already had), the page's own words or
 *      nothing = the automatic words back, and anything unsafe is refused, not
 *      stored — for every part a caret can go in;
 *   2. what the Maker shows for a Format ▾ pick is exactly what a guest's page
 *      draws for it — the masthead is rendered and compared — including
 *      "Ika-13 ng Marso, 2027", and no format = today's words, byte for byte;
 *   3. the eyebrow and the invitation line carry the couple's words to a
 *      guest's page, and the Maker canvas knows the automatic words to put back;
 *   4. Wording ▾ offers only lines that already exist (never invented), and one
 *      line alone is no dropdown;
 *   5. 🔒 THE GUARDS — the bar never renders the Maker (every save is `held`,
 *      through the element sheet's own queue and key; no refresh, no
 *      revalidate); the canvas half never saves; the caret is placed IN the
 *      tap (a phone raises its keyboard only then); a typed tap is not a
 *      selection that pops the style sheet; the bar loads with the Details
 *      pieces, never with the Maker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_JOINER_WORDS, sanitizeHubElements, type HubElementKey } from './element-style';
import { HUB_FORMAT_DEFAULT, HUB_DATE_FORMATS, HUB_TIME_FORMATS, formatHubDate } from './hub-date-formats';
import {
  HUB_TYPE_PARTS,
  HUB_TYPE_WORD_PARTS,
  formatChoices,
  formatWords,
  withTypedFormat,
  withTypedWords,
  wordingLines,
} from './type-in-place';
import { OPENING_LINE_TEMPLATES } from './opening-lines';
import { HUB_CARD_EYEBROWS } from './hub-part-words';
import { invitationCard } from '../app/[slug]/_lib/invitation-card';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const CARD = invitationCard({
  words: { solemn: false, twoPeople: true, eventWord: 'wedding' },
  firstStartAt: '2027-03-13T14:30:00Z',
  firstLabel: 'Guests arrive',
})!;

async function hero(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('../app/[slug]/_components/pahina-masthead');
  return renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: 'Ana & Miguel',
      eventDate: '2027-03-13',
      twoPeople: true,
      card: CARD,
      ...props,
    }),
  );
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/* ═══ 1 · TYPED WORDS → THE PART'S OWN WORDS, ONE CANVAS ═══ */

test('1 · typed words become the part’s own words; the automatic words or nothing clear them; unsafe is refused', () => {
  for (const el of HUB_TYPE_WORD_PARTS as readonly HubElementKey[]) {
    const typed = el === 'joiner' ? 'at' : 'With love, from us';
    const auto = el === 'joiner' ? 'and' : 'The page’s own words';
    const own = withTypedWords(null, el, `  ${typed}  `, auto);
    assert.equal(own.refused, false, el);
    assert.equal(own.elements?.[el]?.word, typed, `${el}: the typed words are its own`);
    // Built on what is there: another part's look rides along untouched.
    const kept = withTypedWords({ names: { color: '#8a1c2b' } }, el, typed, auto);
    assert.equal(kept.elements?.names?.color, '#8a1c2b', `${el}: the rest of the hero is kept`);
    assert.equal(withTypedWords(own.elements, el, auto, auto).elements, null, `${el}: its automatic words = no word stored`);
    assert.equal(withTypedWords(own.elements, el, '   ', auto).elements, null, `${el}: emptied = the automatic words back`);
    const bad = withTypedWords(own.elements, el, 'a\u0000b', auto);
    assert.equal(bad.refused, true, `${el}: a control character is refused`);
    assert.equal(bad.elements?.[el]?.word, typed, `${el}: …and the last good words are kept`);
  }
  assert.equal(withTypedWords(null, 'line', 'x'.repeat(121), null).refused, true, 'one short line');
});

/* ═══ 2 · FORMAT ▾ — THE MAKER'S WORDS ARE THE GUEST'S WORDS ═══ */

test('2 · every date format the Maker shows is exactly what the guest page draws — Ika-13 ng Marso, 2027 included', async () => {
  const base = text(await hero({}));
  assert.match(base, /March 13, 2027/, 'no format = today’s words');
  assert.equal(await hero({ elements: sanitizeHubElements({ date: { format: 'bogus' } }) }), await hero({}), 'an unknown format is dropped');
  for (const f of HUB_DATE_FORMATS) {
    const elements = withTypedFormat(null, 'date', f);
    const want = formatWords('date', f, { iso: '2027-03-13' })!;
    assert.equal(want, formatHubDate('2027-03-13', f));
    const html = text(await hero({ elements }));
    assert.ok(html.includes(want), `${f}: the page draws “${want}”`);
  }
  assert.equal(formatHubDate('2027-03-13', 'tagalog'), 'Ika-13 ng Marso, 2027');
  assert.deepEqual(
    formatChoices('date', { iso: '2027-03-13' }).map((c) => c.label),
    ['March 13, 2027', '13 March 2027', 'Saturday, March 13, 2027', 'Sat · Mar 13', '03 · 13 · 2027', 'Ika-13 ng Marso, 2027'],
    'ONE list, in the prototype’s order, each in the couple’s own date',
  );
  assert.equal(withTypedFormat({ date: { format: 'dmy' } }, 'date', HUB_FORMAT_DEFAULT), null, 'the page’s own = nothing stored');
});

test('2b · every time format the Maker shows is what the guest page draws, after the moment’s own title', async () => {
  assert.match(text(await hero({})), /Guests arrive 2:30 PM/, 'no format = today’s words');
  assert.deepEqual(
    formatChoices('time', { at: '2027-03-13T14:30:00Z' }).map((c) => c.label),
    ['2:30 PM', '14:30', 'Two-thirty in the afternoon', 'Half past two'],
  );
  for (const f of HUB_TIME_FORMATS) {
    const want = formatWords('time', f, { at: CARD.timeAt, title: CARD.timeTitle })!;
    const html = text(await hero({ elements: withTypedFormat(null, 'time', f) }));
    assert.ok(html.includes(want), `${f}: the page draws “${want}”`);
  }
});

/* ═══ 3 · THE EYEBROW AND THE LINE CARRY THE COUPLE'S WORDS ═══ */

test('3 · the eyebrow and the line: the couple’s words for a guest; the automatic words known to the Maker canvas', async () => {
  const elements = sanitizeHubElements({ eyebrow: { word: 'With joy' }, line: { word: 'request your presence' } });
  const guest = await hero({ elements });
  assert.match(text(guest), /With joy/);
  assert.match(text(guest), /request your presence/);
  assert.doesNotMatch(guest, /Together with their families|invite you to celebrate/, 'replaced, not added to');
  assert.doesNotMatch(guest, /data-el/, 'a guest’s markup never carries the Maker’s marks');
  const maker = await hero({ elements, stampElements: true });
  assert.match(maker, /data-el-word="Together with their families"/, 'the eyebrow’s automatic words, to put back');
  assert.match(maker, /data-el-word="invite you to celebrate their wedding"/, 'the line’s automatic words, to put back');
  assert.match(maker, /data-el-iso="2027-03-13"/, 'the date’s fact, for Format ▾');
  assert.match(maker, /data-el-at="2027-03-13T14:30:00Z"/, 'the time’s fact, for Format ▾');
});

/* ═══ 4 · WORDING ▾ OFFERS ONLY WHAT EXISTS ═══ */

test('4 · Wording ▾ offers only existing lines, the page’s own first; one line alone is no dropdown', () => {
  const known = new Set<string>([
    HUB_CARD_EYEBROWS.twoPeople,
    HUB_CARD_EYEBROWS.one,
    ...OPENING_LINE_TEMPLATES.map((t) => t.body),
    ...HUB_JOINER_WORDS,
  ]);
  for (const el of HUB_TYPE_PARTS as readonly HubElementKey[]) {
    for (const twoPeople of [true, false]) {
      const auto = 'The page’s own';
      const lines = wordingLines(el, { auto, twoPeople });
      if (lines.length === 0) continue;
      assert.equal(lines[0], auto, `${el}: the page’s own words first`);
      for (const l of lines.slice(1)) assert.ok(known.has(l), `${el}: “${l}” is not a line the product already has`);
    }
  }
  assert.deepEqual(wordingLines('link', { auto: 'the day, the place, the story', twoPeople: true }), [], 'one line is no choice');
  assert.ok(wordingLines('eyebrow', { auto: HUB_CARD_EYEBROWS.twoPeople, twoPeople: true }).length >= 2);
  assert.deepEqual(wordingLines('joiner', { auto: 'and', twoPeople: true }), ['and', '&', '+']);
});

/* ═══ 5 · THE GUARDS ═══ */

test('5a · the bar never renders the Maker: every save is held, in the element sheet’s own queue and key', () => {
  const bar = read('app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx');
  const saves = bar.match(/makerSave\(/g) ?? [];
  assert.equal(saves.length, 1, 'ONE write path for every change the bar makes');
  assert.match(bar, /makerSave\(\s*\(\) => makerLatestWrite\(canvasWriteKey\('hero'\)/, 'the element sheet’s queue and key');
  assert.match(bar, /requestMakerRefresh,\s*\{ held: true, ok:/, 'held — no Maker render behind it');
  assert.match(bar, /noteDraftedCanvas\('hero', next/, 'the Maker’s own copy, before the write');
  assert.match(bar, /onSaving\('hero', next\)/, 'the canvas hold, before the write');
  assert.doesNotMatch(bar, /revalidatePath|router\.refresh|location\.reload|contentWindow\.location/);
  assert.equal((bar.match(/requestMakerRefresh/g) ?? []).length, 2, 'imported, and handed to makerSave only — never called');
});

test('5b · the canvas half never saves, and puts the caret in the tap itself', () => {
  const canvas = read('app/[slug]/_components/type-in-place-canvas.ts');
  assert.doesNotMatch(canvas, /fetch\(|actions'|FormData|makerSave|hub-draft/, 'the canvas only types and tells');
  assert.match(canvas, /contenteditable', 'plaintext-only'/, 'words only, never markup');
  const from = canvas.indexOf('begin(part, key, el, at) {');
  assert.ok(from > 0, 'the canvas has its begin');
  const begin = canvas.slice(from, canvas.indexOf('stop: () => {', from));
  assert.doesNotMatch(begin, /await|setTimeout|then\(/, 'the focus is made in the tap — a phone raises its keyboard only then');
  assert.match(begin, /target\.focus\(/);
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  const send = bridge.slice(bridge.indexOf('const send = (e: Event)'), bridge.indexOf("el.addEventListener('click', send)"));
  assert.match(send, /typing\.begin\(/, 'the tap on a part begins typing, in the click');
  assert.match(bridge, /if \(typing\.typing\(\)\) return;/, 'a typed tap is not a selection that opens the style sheet');
});

test('5c · the bar loads with the Details pieces on the first tap, never with the Maker; a keystroke never re-renders the Maker', () => {
  // Raw (with comments): the chunk's NAME is a comment, and it is what keeps the runtime from growing.
  const lazy = readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/details-lazy.tsx'), 'utf8');
  assert.match(
    lazy,
    /export const TypeBar = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\.\/\.\.\/website\/editor\/_components\/type-in-place'\)/,
    'in the Details pieces’ own chunk — no new chunk, no new runtime entry',
  );
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.doesNotMatch(shell, /from '\.\/type-in-place'/, 'the shell never imports the bar itself');
  assert.match(shell, /<TypeBar\b/);
  // The shell keeps only the tap that began typing; the bar hears the keystrokes.
  assert.match(shell, /readTypeStart\(event\.data/);
  assert.doesNotMatch(shell, /phase === 'input'|t === 'type'/, 'no keystroke reaches the Maker’s own state');
  const bar = read('app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx');
  assert.match(bar, /window\.addEventListener\('message', onMessage\)/, 'the bar hears the canvas itself');
  assert.match(bar, /t: 'typeSync'/, 'letters typed while it loaded are asked for, not lost');
});

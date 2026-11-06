/**
 * a-moment-shows-its-first-line.test.ts — A LOVE STORY ROW SHOWS THE START OF ITS WORDS UNDER ITS NAME.
 *
 * Owner, 2026-10-08, on Studio › Love Story in the lab: *"i do not see the subtext? unlike the Sep 2026"* — the one
 * row that had a line under its name was the moment kept off the Event Hub (its amber notice); every other row was a
 * name alone, though the approved drawing (gallery § 13) gives each row the FIRST LINE of its story as a quiet
 * second line.
 *
 *   (1) WHICH WORDS — the first line the couple wrote, never a later one and never words of ours; nothing when there
 *       are no words; "…" when more follows than is shown.
 *   (2) ON THE ROW — painted: under the name, inside the same tap, one line that cuts with "…"; the amber
 *       "Off the Event Hub" notice stays its own line below; a moment with no words has no second line.
 *   (3) THE HEIGHT RULE — the row grows by that ONE line and never more: the name still stops at two lines, the
 *       quiet line is one and cannot wrap; and a row with no quiet line (every Schedule row) is drawn exactly as
 *       it was.
 *   (4) A NEW MOMENT with a name and no words yet shows no quiet line — it says "Not saved yet — a moment needs a
 *       line or two." instead.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { sortMoments, type LoveStoryMoment } from './love-story-moments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const STORY = 'app/dashboard/[eventId]/website/our-story/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const UMBRELLA = 'A rainy Tuesday in Katipunan — one umbrella, two strangers, no bus for an hour.';
const story: LoveStoryMoment[] = [
  { id: 'u', date: { y: 2019 }, title: 'One umbrella', line: UMBRELLA, order: 0, canvas: {} },
  { id: 't', date: { y: 2021, m: 2, d: 14 }, title: 'Our first trip', line: 'Baguio, on a bus that left at four.\nWe slept the whole way.', order: 1, canvas: {} },
  { id: 'f', date: { y: 2026, m: 9 }, title: 'The fitting', line: 'Her mother cried first.', order: 2, hidden: true, canvas: {} },
  // Kept by its place alone — a moment may hold no words.
  { id: 'p', date: { y: 2024 }, title: 'Tagaytay', line: '', place: 'Tagaytay', order: 3, canvas: {} },
];

async function rows(moments: LoveStoryMoment[]): Promise<Record<string, string>> {
  const { MomentOrderCards } = await import(`../${STORY}/moment-order-cards`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const action = async () => {};
  const html = renderToStaticMarkup(
    React.createElement(MomentOrderCards, {
      action,
      moments: sortMoments(moments),
      mediaUrls: {},
      sheet: { action, moments, partners: ['Maria', 'Jose'], ownsPro: true, storeShell: false, proHref: '/p', proPrice: null, eventId: 'ev-1', mediaUrls: {} },
      add: { can: true },
    }),
  );
  const out: Record<string, string> = {};
  for (const r of html.split(/(?=<li[^>]*data-moment-card=")/).slice(1)) out[/data-moment-card="([^"]+)"/.exec(r)![1]!] = r.slice(0, r.indexOf('</li>'));
  return out;
}
const text = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

test('(1) which words: the first line the couple wrote — nothing when there are none, "…" when more follows', async () => {
  const { momentFirstLine, MOMENT_FIRST_LINE_MAX } = await import(`../${STORY}/moment-order-cards`);
  assert.equal(momentFirstLine(UMBRELLA), UMBRELLA, 'a line that fits was changed');
  // No words yet: no line at all — never a placeholder of ours.
  for (const none of ['', '   ', '\n \n', null, undefined]) assert.equal(momentFirstLine(none), null);
  // The FIRST line, not a later one; and it does not read as the whole story when more follows.
  assert.equal(momentFirstLine('Baguio, on a bus that left at four.\nWe slept the whole way.'), 'Baguio, on a bus that left at four…');
  assert.equal(momentFirstLine('\n\n  He   asked.  \n\n'), 'He asked.', 'a blank first line, or stray spaces, reached the row');
  assert.equal(momentFirstLine('He asked.\r\nShe said yes.'), 'He asked…');
  // A very long first line is handed over cut at a word, ending "…".
  const long = `${'Seven summers of ferries, typhoons, borrowed umbrellas '.repeat(6)}until the sun came up.`;
  assert.match(long.slice(MOMENT_FIRST_LINE_MAX - 1, MOMENT_FIRST_LINE_MAX + 1), /^\S\S$/, 'anti-vacuity: the cap does not fall inside a word of this line');
  const cut = momentFirstLine(long)!;
  assert.ok(cut.length <= MOMENT_FIRST_LINE_MAX + 1, `the row was handed ${cut.length} characters`);
  assert.ok(cut.endsWith('…') && !/\s…$/.test(cut), `“${cut.slice(-12)}” does not end cleanly in "…"`);
  assert.ok(long.startsWith(cut.slice(0, -1)), 'the cut line is not the start of their words');
  const lastWord = cut.slice(0, -1).split(' ').at(-1)!;
  assert.ok(long.split(/[\s,]+/).includes(lastWord), `it was cut in the middle of a word: “…${lastWord}…”`);
});

test('(2) on the row: under the name, inside the same tap, one line — the amber notice stays its own line below; no words, no second line', async () => {
  const r = await rows(story);
  // Under the name, in the SAME button — tapping it still opens the name.
  assert.match(text(r.u!), new RegExp(`<button[^>]*data-timeline-name=""[^>]*><span[^>]*>One umbrella</span><span data-timeline-sub=""[^>]*>${UMBRELLA}</span></button>`), 'the first line is not under the name');
  assert.match(r.t!, /<span data-timeline-sub=""[^>]*>Baguio, on a bus that left at four…<\/span>/);
  assert.doesNotMatch(r.t!, /slept the whole way/, 'a later line of the story is on the row');
  for (const id of ['u', 't', 'f']) assert.equal((r[id]!.match(/data-timeline-sub/g) ?? []).length, 1, `row ${id} does not carry exactly one quiet line`);
  // The moment kept off the Event Hub: its words under the name, AND the amber notice as its own line below the row.
  const f = r.f!;
  const [sub, note] = [f.indexOf('data-timeline-sub'), f.indexOf('data-timeline-note')];
  assert.ok(sub > -1 && note > sub, 'the amber notice is not below the quiet line');
  assert.match(f, /<span data-timeline-sub=""[^>]*>Her mother cried first\.<\/span>/);
  assert.match(f, /<p data-timeline-note=""[^>]*>Off the Event Hub — guests do not see this moment\.<\/p>/);
  assert.ok(!/data-timeline-note/.test(f.slice(0, f.indexOf('</button>', sub))), 'the amber notice was folded into the name');
  // No words: no second line — and nothing of ours in its place.
  assert.doesNotMatch(r.p!, /data-timeline-sub/, 'a moment with no words shows a second line');
  assert.match(r.p!, /data-timeline-name=""[^>]*><span[^>]*>Tagaytay<\/span><\/button>/);
  // The row hands over the words as they stand in its own box (so typing shows at once), through the one function.
  assert.match(read(`${STORY}/moment-order-cards.tsx`), /sub=\{momentFirstLine\(line\)\}/);
});

test('(3) the height rule: the row grows by that ONE line, never more — and a row with no quiet line is drawn exactly as it was', async () => {
  const { TimelineRow } = await import('../app/_components/timeline-row');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const paint = (sub: string | null | undefined) =>
    renderToStaticMarkup(React.createElement(TimelineRow, { when: React.createElement('i', null, 'when'), name: 'Ceremony', placeholder: 'Name this moment', nameLabel: 'Name', sub, as: 'div' }));
  const classOf = (html: string, attr: string) => new RegExp(`<(?:button|span)[^>]*${attr}=""[^>]*class="([^"]*)"|<(?:button|span)[^>]*class="([^"]*)"[^>]*${attr}=""`).exec(html)?.slice(1).find(Boolean) ?? '';
  const withLine = paint('It rained.');
  const sub = classOf(withLine, 'data-timeline-sub').split(/\s+/);
  assert.ok(sub.includes('truncate'), 'the quiet line can run past one line');
  assert.ok(!sub.some((c) => /^line-clamp-|^whitespace-normal$|^break-/.test(c)), 'the quiet line may wrap');
  assert.ok(sub.includes('font-normal') && sub.some((c) => /^text-ink\/\d+$/.test(c)), 'the quiet line is not quiet');
  // The name still stops at two lines, and sits ABOVE the quiet line (a column), never beside it.
  assert.match(withLine, /<span class="line-clamp-2 min-w-0 break-words">Ceremony<\/span><span data-timeline-sub=""/);
  const button = classOf(withLine, 'data-timeline-name').split(/\s+/);
  assert.ok(button.includes('flex-col') && button.includes('justify-center') && !button.includes('items-center'), 'the quiet line is beside the name, not under it');
  // No quiet line (every Schedule row, and a moment with no words): exactly the row as it was.
  for (const none of [undefined, null, '']) {
    const plain = paint(none);
    assert.doesNotMatch(plain, /data-timeline-sub/);
    assert.match(plain, /<button type="button" data-timeline-name="" class="sn-press flex min-h-11 min-w-0 flex-1 items-center rounded-xl px-1 text-left text-\[15px\] leading-tight font-medium text-ink"><span class="line-clamp-2 min-w-0 break-words">Ceremony<\/span><\/button>/, 'a row with no quiet line changed');
  }
  // The Schedule hands none.
  assert.doesNotMatch(read('app/dashboard/[eventId]/schedule/_components/studio-day.tsx'), /\bsub=/);
});

test('(4) a new moment with a name and no words yet shows no quiet line — it says it is not saved', () => {
  const s = read(`${STORY}/moment-order-cards.tsx`);
  const fresh = s.slice(s.indexOf('data="new"'), s.indexOf('data-studio-add-moment'));
  assert.ok(fresh.length > 600, 'anti-vacuity: the new row was not found');
  assert.doesNotMatch(fresh, /\bsub=/, 'the unsaved row shows a quiet line');
  assert.match(fresh, /data-studio-story-not-saved=""[^>]*>\s*Not saved yet — a moment needs a line or two\.\s*<\/p>/);
  assert.equal((s.match(/\bsub=\{/g) ?? []).length, 1);
});

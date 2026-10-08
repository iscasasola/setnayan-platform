/**
 * the-page-card.test.ts — THE PAGE CARD, AND THE STUDIO HOME THAT WEARS IT.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, kind 4; approved gallery `prototypes/control_templates_2026-10-08.html`
 * § 4; the designer's eleven, `prototypes/studio_home_2026-10-08_fable.html`): *"we can improve the page card as
 * well. how they can be presented — Logo / Topic / Description and a small (i) that will give a more detailed
 * explanation"* · *"Improve Page Card so it looks like an app button that feels consistent with our design"*.
 *
 *   (1) THE CARD, RENDERED — the mark as an app-icon tile in the accent with the ink that reads on it · the topic ·
 *       ONE plain line · and the ⓘ as its OWN 44-px button BESIDE the card's button, never inside it.
 *   (2) ITS STATE HAS ITS WORD — Ready / Missing as a badge; "Full screen" a small tag; a fact that could not be
 *       read is SAID on the card, with no badge.
 *   (3) THE STUDIO HOME — eleven cards, each with a DISTINCT mark, its line and its ⓘ; the tile's own marks
 *       (`data-studio-tile`, `data-studio-done`) and the ready count kept; one column on a phone, two from 768 px.
 *   (4) THE WORDS — eleven lines that are sentences (never nouns joined by dots), in the house's words.
 *   (5) IT ASKS NOTHING — opening the home, a card or an ⓘ adds no request and no preload; the card knows no screen
 *       and writes no colour for the accent.
 *
 * Mutations seen RED (2026-10-08), each restored: the ⓘ moved inside the card's button → (1); the unread sentence
 * no longer said → (2); Look given the Mood Board's mark → (3, the cards AND the chooser); two columns on a phone →
 * (3); a line turned into nouns joined by dots → (4); a preload added to the home → (5); the mark tile painted with a
 * colour by name → `the-accent-is-one-token` (1) and (5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { STUDIO_PAGE_CARDS, STUDIO_TILE_UNREAD } from './studio-page-cards';
import { STUDIO_TILE_KEYS, STUDIO_TILES } from './studio-tiles';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CARD = 'app/_components/page-card.tsx';
const HOME = 'app/dashboard/[eventId]/launch/_components/studio-home.tsx';
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
/** Draw a component with a test's props (each test hands exactly the props the component names). */
const h = (C: unknown, props: Record<string, unknown> | null = null, ...kids: React.ReactNode[]) => React.createElement(C as React.FC<Record<string, unknown>>, props, ...kids);

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
/** The card's own button, from its `<button` to ITS `</button>` (the first one after it). */
function cardButton(html: string): string {
  const at = html.indexOf('<button type="button"');
  return html.slice(at, html.indexOf('</button>', at) + 9);
}

test('(1) the card, rendered: an accent app-icon tile, the topic, one line — and the ⓘ its own 44-px button BESIDE it', async () => {
  const { PageCard } = await import('../app/_components/page-card');
  const html = await paint(
    h(PageCard, { mark: h('svg', { 'data-icon': 'look' }), topic: 'Look', description: 'The background, the colours and fonts, and the music of your Event Hub.', about: { words: 'How every guest page looks and sounds.' }, onOpen: () => {}, attrs: { 'data-studio-tile': 'look' } }),
  );
  const card = cardButton(html);
  assert.match(card, /^<button type="button" data-studio-tile="look" data-page-card-open=""/);
  // THE CLAIM: nothing pressable is inside the card's button, and the ⓘ comes after it — a sibling.
  assert.equal(count(card, /<button/g), 1, 'a button is nested inside the card’s button');
  assert.doesNotMatch(card, /data-explain|role="button"|<a /);
  const rest = html.slice(html.indexOf(card) + card.length);
  assert.match(rest, /^<button type="button" data-explain="" aria-label="About Look" aria-haspopup="dialog" aria-expanded="false"/, 'the ⓘ is not the card’s next sibling');
  assert.match(rest, /class="sn-press [^"]*h-11 w-11 flex-none/, 'the ⓘ is not a 44-px target');
  assert.equal(count(html, /<button/g), 2);
  // The mark: an app-icon tile in the accent, its picture in the label ink.
  assert.match(card, /data-page-card-mark="" class="[^"]*h-\[52px\] w-\[52px\][^"]*rounded-xl bg-sn-accent [^"]*text-sn-on-accent/);
  assert.match(card, /<svg data-icon="look"><\/svg>/);
  // The topic, and ONE line.
  assert.match(card, /data-page-card-topic=""[^>]*>Look<\/b>/);
  assert.equal(count(card, /data-page-card-line=""/g), 1);
  assert.match(card, /The background, the colours and fonts, and the music of your Event Hub\./);
  // It presses like every other control (the app's one press, with its ring), and is a comfortable target.
  assert.match(card, /class="sn-press sn-press-ring [^"]*min-h-\[76px\]/);
  // The explanation is not drawn until it is asked for.
  assert.doesNotMatch(html, /How every guest page looks and sounds|Got it/);
});

test('(2) a state has its word: Ready / Missing as a badge, "Full screen" a tag; an unread fact is said, with no badge', async () => {
  const { PageCard } = await import('../app/_components/page-card');
  const draw = (extra: Record<string, unknown>) => paint(h(PageCard, { mark: null, topic: 'Seat plan', description: 'The tables, and who sits where.', about: { words: 'x' }, onOpen: () => {}, ...extra }));
  const ready = await draw({ badge: { tone: 'ok', word: 'Ready' }, tag: 'Full screen' });
  assert.match(ready, /data-page-card-badge="ok"[^>]*>Ready</);
  assert.match(ready, /data-page-card-tag=""[^>]*>Full screen</);
  assert.match(await draw({ badge: { tone: 'wait', word: 'Missing' } }), /data-page-card-badge="wait"[^>]*>Missing</);
  const plain = await draw({});
  assert.doesNotMatch(plain, /data-page-card-badge|data-page-card-tag|data-page-card-problem/);
  // A fact that could not be read: said in the line's place — never the ordinary line of an untouched page.
  const unread = await draw({ problem: STUDIO_TILE_UNREAD });
  assert.match(unread, /data-page-card-problem=""[^>]*>Could not be read just now</);
  assert.doesNotMatch(unread, /data-page-card-line/);
});

const tiles = (over: Partial<Record<string, { done?: boolean | undefined; status?: string }>> = {}) =>
  STUDIO_TILE_KEYS.map((key) => ({
    key,
    label: STUDIO_TILES[key].label,
    short: STUDIO_TILES[key].short,
    item: STUDIO_TILES[key].item,
    immersive: STUDIO_TILES[key].immersive === true,
    done: key in over ? over[key]!.done : (true as boolean | undefined),
    status: over[key]?.status ?? STUDIO_TILES[key].sub,
  }));

test('(3) the Studio home: eleven cards, eleven DISTINCT marks, the tile’s own marks and the count kept; one column, two from 768', async () => {
  const { StudioHome, TILE_ICON } = await import(`../${HOME}`);
  const html = await paint(h(StudioHome, { tiles: tiles({ logo: { done: false }, gifts: { done: undefined, status: STUDIO_TILE_UNREAD }, rsvp: { done: undefined } }), onOpen: () => {} }));
  assert.equal(count(html, /data-page-card="/g), 11);
  assert.deepEqual([...html.matchAll(/data-studio-tile="([a-z]+)"/g)].map((m) => m[1]), [...STUDIO_TILE_KEYS], 'the cards are not the eleven, in the owner’s order');
  // The shipped marks: ✓ / Missing / no claim, and the count.
  assert.equal(count(html, /data-studio-done="yes"/g), 8);
  assert.equal(count(html, /data-studio-done="no"/g), 1);
  assert.equal(count(html, /data-studio-done="unread"/g), 2);
  assert.match(html, /data-studio-ready="">8 of 11 ready</);
  assert.equal(count(html, />Ready</g), 8);
  assert.equal(count(html, />Missing</g), 1);
  assert.equal(count(html, />Could not be read just now</g), 1, 'a fact that could not be read looks like an untouched page');
  // "Full screen" on the two that take the screen — a small tag.
  const tagged = [...html.matchAll(/data-studio-tile="([a-z]+)"[\s\S]*?<\/button>/g)].filter((m) => m[0].includes('data-page-card-tag')).map((m) => m[1]);
  assert.deepEqual(tagged, ['march', 'seats']);
  // THE CLAIM: eleven DISTINCT marks (Look and the Mood Board shared one) — compared as drawn.
  const marks = [...html.matchAll(/data-page-card-mark=""[^>]*>(<svg[\s\S]*?<\/svg>)/g)].map((m) => m[1]!.replace(/\s+/g, ' '));
  assert.equal(marks.length, 11, 'anti-vacuity: the marks were not found');
  assert.equal(new Set(marks).size, 11, 'two pages share one mark');
  assert.equal(new Set(Object.values(TILE_ICON)).size, 11);
  // ONE list of marks: "Studio ▾" in the top nav draws each page with the card's own mark (it had Look and the Mood
  // Board on the same four squares).
  const parts = read('app/dashboard/[eventId]/launch/_components/stages-studio-parts.tsx');
  assert.match(parts, /import \{ StudioHome, TILE_ICON \} from '\.\/studio-home';/);
  assert.match(parts, /const Icon = TILE_ICON\[t\.key\];/, 'the chooser keeps a second list of marks');
  const { studioChooserOptions } = await import('../app/dashboard/[eventId]/launch/_components/stages-studio-parts');
  const drawn = await Promise.all(studioChooserOptions(tiles()).map((o) => paint(o.icon as React.ReactElement)));
  assert.equal(new Set(drawn.map((d) => d.replace(/class="[^"]*"/, ''))).size, 11, 'two pages share one mark in the chooser');
  // Each has its line and its own ⓘ.
  for (const key of STUDIO_TILE_KEYS) {
    if (key !== 'gifts') assert.ok(html.includes(STUDIO_PAGE_CARDS[key].description.replace(/’/g, '’')), `${key} has no line`);
    assert.ok(html.includes(`aria-label="About ${STUDIO_TILES[key].label.replace(/&/g, '&amp;')}"`), `${key} has no ⓘ`);
  }
  assert.equal(count(html, /data-explain=""/g), 11);
  // One column on a phone; two only from 768 px.
  assert.match(html, /<ul data-studio-cards="" class="grid grid-cols-1 gap-2 md:grid-cols-2 /, 'the home is two columns on a phone (a sentence and a 44-px ⓘ do not fit)');
  assert.doesNotMatch(html, /class="grid grid-cols-2/);
});

test('(4) the words: eleven lines that are sentences — never nouns joined by dots — in the house’s words', () => {
  assert.deepEqual(Object.keys(STUDIO_PAGE_CARDS), [...STUDIO_TILE_KEYS]);
  for (const key of STUDIO_TILE_KEYS) {
    const c = STUDIO_PAGE_CARDS[key];
    assert.match(c.description, /^[A-Z].*\.$/, `${key}’s line is not a sentence`);
    assert.doesNotMatch(c.description, / · /, `${key}’s line is nouns joined by dots`);
    assert.ok(c.description.length <= 90, `${key}’s line is too long to be one line of a card (${c.description.length})`);
    for (const text of [c.description, c.controls, c.seenAt, c.first]) {
      assert.ok(text.trim().length > 12, `${key} has an empty text`);
      assert.doesNotMatch(text, /\bwebsite\b|\bvendor|\bcelebration/i, `${key} uses a word the house does not (${text})`);
    }
  }
});

test('(5) it asks nothing: no request, no preload, no navigation of its own — and the card knows no screen', () => {
  const home = read(HOME);
  assert.doesNotMatch(home, /fetch\(|useEffect|useRouter|router\.|prefetch|preload|<a\s|<Link\b|href=|location\.|import\(/, 'the Studio home asks for something, or leaves the Maker');
  assert.match(home, /onOpen=\{\(\) => onOpen\(t\.key\)\}/, 'a card does not open its page the way the tile did');
  assert.match(home, /problem=\{t\.status === STUDIO_TILE_UNREAD \? STUDIO_TILE_UNREAD : null\}/);
  const card = read(CARD);
  assert.ok(card.length > 400, 'anti-vacuity');
  assert.doesNotMatch(card, /launch\/_components|maker-|studio-|useMaker|fetch\(|useEffect|router/, 'the Page card knows a screen, or asks for something');
  assert.doesNotMatch(card, /#[0-9a-fA-F]{3,8}\b|mulberry|terracotta|\btext-white\b/, 'the Page card writes a colour for the accent');
  assert.match(card, /import \{ Explain \} from '\.\/explain';/, 'the ⓘ is not the one explanation');
});

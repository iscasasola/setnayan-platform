import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PahinaMasthead } from '@/app/[slug]/_components/pahina-masthead';
import { partWords, setPartWords, tidyNames } from '@/app/[slug]/_components/type-in-place-canvas';
import { HERO_DESIGNS } from './hero-design';
import { splitCoupleNames } from './couple-names';

/**
 * 🔗 A JOINER NEVER STANDS OVER NOTHING — for a guest, and in the Maker while a name is typed.
 *
 * Owner, 2026-10-11, on his own event in the new Maker: one name and no "&" in the Names line, and the cover read
 * "TEsting Event / and / (nothing)" — while typing AND after Done ("did not go away").
 *
 * Two readers of one name line. The PAGE (the masthead, drawn by the server) asks `splitCoupleNames` and draws a
 * joiner only when there is a second name: a guest never had it — held below for every design. The Maker's CANVAS
 * (`setPartWords`, the bridge's `typeText`) wrote the first name into the first person's line, an empty string into
 * the second and left the joiner where it was; the save is held (the canvas is not reloaded), so the stale cover
 * stayed until the next reload. The canvas now reads the same rule and steps the joiner and the empty line aside.
 */

/* `tsx --test` compiles a `.tsx` component to the classic runtime — React is in scope before one is drawn. */
(globalThis as unknown as { React: unknown }).React = React;

const ONE_NAME = ['TEsting Event', 'Maria', 'Ana & ', 'Ana and ', 'Mateo Cruz'];
const CARD = { eyebrow: 'Together with their families', line: 'invite you to celebrate their wedding', timeLabel: null, hubHref: '#details', hubLabel: 'Open the Event Hub' };

test('one name → no second person, whatever trails it', () => {
  for (const line of ['TEsting Event', 'Maria', 'Mateo Cruz']) assert.deepEqual(splitCoupleNames(line), { first: line, second: null, joiner: null }, line);
  /* A joiner typed with nothing after it names ONE person: the page draws no joiner for it. */
  for (const line of ['Ana & ', 'Ana &', 'Ana and ']) assert.equal(splitCoupleNames(line).second, null, JSON.stringify(line));
  assert.deepEqual(splitCoupleNames('Maria & Jose'), { first: 'Maria', second: 'Jose', joiner: '&' });
  assert.deepEqual(splitCoupleNames('Ana and Leo'), { first: 'Ana', second: 'Leo', joiner: 'and' });
});

test('THE PAGE: for every cover and every design, one name is drawn with no joiner — a guest never sees one', () => {
  const draw = (displayName: string, extra: Record<string, unknown>) =>
    renderToStaticMarkup(React.createElement(PahinaMasthead, { displayName, eventDate: '2026-12-18', twoPeople: true, ...extra }));
  for (const line of ONE_NAME) {
    for (const design of HERO_DESIGNS) {
      for (const cover of [{ card: CARD }, {}] as const) {
        for (const maker of [false, true]) {
          const html = draw(line, { design, stampElements: maker, ...cover });
          const where = `${JSON.stringify(line)} · ${design} · ${'card' in cover ? 'the card' : 'the plain cover'} · ${maker ? 'the Maker’s canvas' : 'a guest'}`;
          /* The joiner is the gild italic line between the names (`aria-hidden`); in the Maker it is also `data-el`. */
          assert.doesNotMatch(html, /italic text-gild" aria-hidden/, `a joiner is drawn: ${where}`);
          assert.doesNotMatch(html, /data-el="joiner"/, `a joiner part is drawn: ${where}`);
          assert.doesNotMatch(html, /data-el-person="1"/, `an empty second name is drawn: ${where}`);
        }
      }
    }
  }
  /* The control: two names DO draw one. */
  assert.match(draw('Maria & Jose', { card: CARD, stampElements: true }), /data-el="joiner"[^>]*>and</);
  for (const design of HERO_DESIGNS) {
    const two = draw('Maria & Jose', { design, card: CARD, stampElements: true });
    assert.match(two, /data-el="joiner"/, `anti-vacuity: ${design} draws no joiner part for two names`);
    assert.match(two, /data-el-person="1"/, `anti-vacuity: ${design} draws no second name`);
  }
});

/* ── the Maker's canvas, on a cover drawn for TWO people ───────────────────────────────────────────────────────── */

type Fake = { textContent: string; attrs: Record<string, string>; css: Record<string, string>; style: { setProperty(k: string, v: string): void; removeProperty(k: string): void }; setAttribute(k: string, v: string): void; removeAttribute(k: string): void; hasAttribute(k: string): boolean };
const fake = (text: string): Fake => {
  const css: Record<string, string> = {};
  return { ...bare(text), css, style: { setProperty: (k, v) => void (css[k] = v), removeProperty: (k) => void delete css[k] } };
};
const bare = (text: string): Omit<Fake, 'css' | 'style'> => ({
  textContent: text,
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = v; },
  removeAttribute(k) { delete this.attrs[k]; },
  hasAttribute(k) { return k in this.attrs; },
});
/** The names part as the masthead stamps it in the Maker: person 0 · the joiner · person 1. */
function cover(first = 'Maria', joiner = 'and', second = 'Jose') {
  const p0 = fake(first), j = fake(joiner), p1 = fake(second);
  const part = {
    querySelectorAll: (sel: string) => (sel === '[data-el-person]' ? [p0, p1] : []),
    querySelector: (sel: string) => (sel === '[data-el="joiner"]' ? j : null),
    matches: () => false,
    getAttribute: () => null,
  } as unknown as HTMLElement;
  return { part, p0, j, p1, shown: () => [p0, j, p1].filter((e) => e.css.display !== 'none').map((e) => e.textContent.trim()).filter(Boolean) };
}

test('THE CANVAS: one name typed into a two-name cover — the joiner and the empty line step aside', () => {
  for (const line of ONE_NAME) {
    const c = cover();
    setPartWords(c.part, line);
    /* Off the screen by its OWN display — each line is a `block` by class, which beats the `hidden` attribute. */
    assert.equal(c.j.css.display, 'none', `the joiner still stands over nothing: ${JSON.stringify(line)}`);
    assert.equal(c.p1.css.display, 'none', JSON.stringify(line));
    assert.equal(c.shown().length, 1, `the cover reads ${JSON.stringify(c.shown())} for ${JSON.stringify(line)}`);
    /* …and what is SAVED is that one name — no "&" trailing it. */
    assert.equal(partWords(c.part), splitCoupleNames(line).first.trim());
  }
});

test('THE CANVAS: a second name typed back brings the joiner back — "&" or "and", as the page splits them', () => {
  const c = cover();
  setPartWords(c.part, 'TEsting Event');
  for (const [line, first, second] of [['Ana & Ben', 'Ana', 'Ben'], ['Ana and Ben', 'Ana', 'Ben']] as const) {
    setPartWords(c.part, line);
    assert.equal(c.j.css.display, undefined, line);
    assert.equal(c.p1.css.display, undefined, line);
    assert.deepEqual([c.p0.textContent, c.p1.textContent], [first, second], line);
  }
});

test('THE CANVAS: typed on the page itself (a name erased by hand), the end of typing tidies it too', () => {
  const c = cover('TEsting Event', 'and', '');
  tidyNames(c.part);
  assert.deepEqual(c.shown(), ['TEsting Event']);
  const two = cover();
  tidyNames(two.part);
  assert.deepEqual(two.shown(), ['Maria', 'and', 'Jose'], 'a full cover was touched');
});

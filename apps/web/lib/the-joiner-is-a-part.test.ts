/**
 * the-joiner-is-a-part.test.ts — THE WORD BETWEEN THE NAMES IS THE COUPLE'S.
 *
 * Owner, 2026-09-27, on the approved Maker toolbars prototype, answer 2
 * ("build the Joiner part — and · & · + · your own word, styled like any
 * part"): *"okay"*. Before it, the "and" was made from the display name and
 * could not be edited. What this proves, by RENDERING the guest hero:
 *
 *   1. a guest sees the couple's chosen word, in the joiner's own style;
 *   2. with no word chosen the hero is exactly as before (the display name's
 *      word, "&" drawn as "and" on the card);
 *   3. a solo name draws no joiner, whatever is stored — no sample word, ever;
 *   4. their own word is words, never markup: anything that is not a short
 *      run of letters is dropped, so nothing typed becomes HTML or CSS;
 *   5. the joiner carries `data-el` only in the Maker canvas, and a hidden
 *      joiner is gone for guests but ghosted in the Maker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { HUB_JOINER_MAX, sanitizeHubElements, sanitizeHubJoinerWord } from './element-style';

(globalThis as unknown as { React: unknown }).React = React;

async function hero(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('../app/[slug]/_components/pahina-masthead');
  return renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: 'Cale & Ice',
      eventDate: '2026-12-18',
      card: { eyebrow: 'Together with their families', line: 'invite you', timeLabel: '3:00 PM', hubHref: '#hub', hubLabel: 'Open' },
      ...props,
    }),
  );
}

/** The joiner's span, as drawn between the two names. */
const joinerOf = (html: string) => /<span class="block">Cale<\/span>(<span[^>]*>[^<]*<\/span>)<span class="block">Ice<\/span>/.exec(html)?.[1] ?? null;

test('a guest sees the couple’s own joiner, styled like any part', async () => {
  for (const word of ['+', '&', 'and', 'at saka']) {
    const html = await hero({ elements: sanitizeHubElements({ joiner: { word, color: '#8a1c2b', size: 120 } }) });
    const span = joinerOf(html);
    assert.ok(span, `the joiner sits between the names: ${html}`);
    assert.ok(span!.includes(`>${word.replace('&', '&amp;')}<`), `the guest reads "${word}": ${span}`);
    assert.match(span!, /style="color:#8a1c2b;zoom:1\.2"/, 'in its own style');
    assert.doesNotMatch(span!, /data-el/, 'a guest’s markup never carries data-el');
  }
});

test('with no word chosen the hero is exactly as before', async () => {
  const before = await hero({});
  assert.match(joinerOf(before)!, />and</, 'the card draws "&" as "and", as it always did');
  const plain = await hero({ card: undefined, displayName: 'Cale and Ice' });
  assert.match(plain, /italic text-gild" aria-hidden="true">and</);
  assert.equal(await hero({ elements: null }), before);
});

test('a solo name draws no joiner — no sample word, whatever is stored', async () => {
  const html = await hero({ displayName: 'Ayala & Partners Year-End', twoPeople: false, elements: sanitizeHubElements({ joiner: { word: '+' } }) });
  assert.doesNotMatch(html, /text-gild" aria-hidden/);
  assert.doesNotMatch(html, />\+</);
});

test('their own word is words: letters only, short, never markup', () => {
  assert.equal(sanitizeHubJoinerWord('  at   saka '), 'at saka');
  assert.equal(sanitizeHubJoinerWord('<b>and</b>'), null);
  assert.equal(sanitizeHubJoinerWord('and;color:red'), null);
  assert.equal(sanitizeHubJoinerWord('x'.repeat(HUB_JOINER_MAX + 1)), null);
  assert.equal(sanitizeHubJoinerWord(''), null);
  assert.equal(sanitizeHubJoinerWord('y'), 'y');
  assert.equal(sanitizeHubElements({ joiner: { word: '<script>' } }), null);
  // Only the joiner has a word.
  assert.equal(sanitizeHubElements({ names: { word: 'and' } }), null);
});

test('the Maker canvas stamps the joiner and ghosts it when hidden; a guest never sees a hidden one', async () => {
  const elements = sanitizeHubElements({ joiner: { word: '+', hidden: true } });
  const maker = joinerOf(await hero({ elements, stampElements: true }));
  assert.match(maker!, /data-el="joiner"/);
  assert.match(maker!, /opacity:0\.3/, 'ghosted in the Maker, so it can be brought back');
  const guest = joinerOf(await hero({ elements }));
  assert.match(guest!, /display:none/, 'never drawn for a guest');
});

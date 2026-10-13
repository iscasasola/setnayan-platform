/**
 * the-ticket-style-follows-the-draft.test.ts — STUDIO › PRINTS' TICKET STYLE SHOWS WHAT THE DRAFT HOLDS (batch-4 Maker walk, F1, 2026-10-13).
 *
 * Found in both engines, 3 of 3: pick Photo poster → ↺. The bar said "Apply 0 changes" and the draft was back on Classic, but Photo poster
 * STAYED RINGED, and tapping it again saved nothing — `pass-card-design-picker.tsx` seeded its shown look ONCE from `saved` and took a tap
 * on that stale copy for "already worn". Now every render reads the look through the Maker's draft store (`draftedPassLookOr`, the
 * store's "the first render after an Undo is the truth", #6485): a pick is drawn at the tap (ours, while our save is newer than the
 * page), and after ↺ (an unheld write, then a Maker render) the page's draft wins.
 *
 * SABOTAGE (seen RED, then restored — see the PR): the picker seeding its look once from `saved` again · the store's copy not told of the
 * unheld write · "already worn" compared against a copy instead of the look shown.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
/* The store listens for the unheld write on `window` — a plain EventTarget stands in, installed BEFORE the store loads. */
(globalThis as unknown as { window: EventTarget }).window ??= new EventTarget();
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
const L = 'app/dashboard/[eventId]/launch/_components';
const PREVIEWS = { classic: '/c.png', ticket: '/t.png', poster: '/p.png' };

async function ringed(saved: string): Promise<string | null> {
  const { PassCardDesignPicker } = await import(`../${L}/pass-card-design-picker`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const m = renderToStaticMarkup(React.createElement(PassCardDesignPicker as never, { eventId: 'E1', saved, studio: true, previews: PREVIEWS } as never));
  return m.match(/aria-pressed="true"[^>]*data-bg-card="([a-z]+)"/)?.[1] ?? null;
}

test('a pick is shown at once; after ↺ (an unheld write, then a Maker render) the strip rings what the draft holds', async () => {
  const store = await import('./maker-draft-store');
  const { MAKER_UNHELD_WRITE_EVENT } = await import('./maker-refresh');
  store.makerRendered('render-1');
  assert.equal(await ringed('classic'), 'classic', 'the strip does not start on the draft’s look');
  /* The tap: drawn at once, before any render. */
  store.noteDraftedPassLook('poster', 'classic');
  assert.equal(store.draftedPassLookOr('classic'), 'poster');
  assert.equal(await ringed('classic'), 'poster', 'a pick is not drawn at the tap');
  /* A render that is still the page the pick was built on keeps ours (the save has not come back yet). */
  store.makerRendered('render-1');
  assert.equal(await ringed('classic'), 'poster');
  /* ↺: the bar's unheld write is announced, then the Maker renders with the draft back on Classic. */
  window.dispatchEvent(new Event(MAKER_UNHELD_WRITE_EVENT));
  store.makerRendered('render-2');
  assert.equal(store.draftedPassLookOr('classic'), 'classic', 'the store still holds the undone pick');
  assert.equal(await ringed('classic'), 'classic', 'after ↺ the undone look stays ringed (F1)');
  /* …so the same look can be picked again: it is no longer "already worn". */
  store.noteDraftedPassLook('poster', 'classic');
  assert.equal(await ringed('classic'), 'poster', 'the undone look cannot be picked again');
  /* A render that brings the saved pick drops our copy; the page's value is then the truth. */
  assert.equal(store.draftedPassLookOr('poster'), 'poster');
});

test('the picker reads its look through the store, and "already worn" is the look shown — never a copy seeded once', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', L, 'pass-card-design-picker.tsx'), 'utf8'));
  assert.doesNotMatch(src, /useState<PassCardDesign>\(saved\)|useRef<PassCardDesign>\(saved\)/, 'the shown look is seeded once from `saved` again');
  assert.match(src, /const read = draftedPassLookOr\(saved\);/);
  assert.match(src, /if \(!design \|\| design === shown\) return;/, '"already worn" is not the look shown');
  assert.match(src, /noteDraftedPassLook\(design, saved\);/, 'a pick is not noted in the store');
  const store = stripComments(readFileSync(join(__dirname, 'maker-draft-store.ts'), 'utf8'));
  assert.match(store, /passLookShared\.unheld\(\);/, 'the store’s ticket copy is not told of an unheld write (↺)');
  assert.match(store, /passLookShared\.rendered\(stamp\);/, 'the store’s ticket copy is not told of a Maker render');
});

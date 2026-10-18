/**
 * apps/web/lib/the-empty-gifts-wears-its-accent.test.ts
 *
 * 🕯 THE PICKED E-GIFTS ACCENT SHOWS ON THE MAKER'S EMPTY GIFTS CARD (owner 2026-10-18, on the Vintage art kit approved
 * 2026-10-16). The corner spray and the lace abaniko were drawn only on a REAL way to give (`PabuyaCardList`'s first
 * bank card), so a couple who picked them with no way to give yet saw an empty gifts block with nothing of what they
 * picked. Measured through the real welcome page (`GuestWelcome`), not a copy of it:
 *
 *   1  the Maker, no way to give, a kit → the divider before the block, and the card accent on ONE card holding the
 *      shipped prompt ("Add a way to receive gifts.") — as the first child of an `li`, so the kit's own corner rules
 *      (`li:has(>[data-kit-slot="gifts-card"])`, `lib/art-kits.ts`) place it, as on a bank card;
 *   2  the Maker, no kit → the empty block byte for byte as before (no card);
 *   3  a GUEST with no way to give → nothing at all, kit or not (no way to give = no card).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { artKitView } from './art-kits';
import { GuestWelcome } from '../app/[slug]/_components/guest-welcome';
import { MakerWelcomeGiftsEmpty } from '../app/[slug]/_components/maker-guest-scenes';

(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;
const VIEW = artKitView({ theme: 'vintage', accents: {}, ownsPro: true, tryOn: false })!;
const base = { parts: ['gifts'] as const, words: {} as never, look: null, reminders: null, giftHref: null };
const draw = (p: Record<string, unknown>) => renderToStaticMarkup(h(GuestWelcome, { ...base, ...p } as never));

test('1 · the Maker, no way to give, a kit: the divider, and the card accent on the one card with the prompt', () => {
  const html = draw({ maker: true, artKit: VIEW });
  assert.equal((html.match(/data-kit-slot="gifts-divider"/g) ?? []).length, 1, 'the divider is not drawn');
  assert.equal((html.match(/data-kit-slot="gifts-card"/g) ?? []).length, 1, 'the card accent is not drawn once');
  assert.match(html, /<li[^>]*><span aria-hidden="true" data-kit-slot="gifts-card"/, 'the accent is not the first child of the card');
  const card = html.slice(html.indexOf('data-maker-gifts-card'));
  assert.match(card, /Add a way to receive gifts\./, 'the card does not hold the shipped prompt');
  assert.ok(html.indexOf('gifts-divider') < html.indexOf('data-maker-guest-scene="gifts"'), 'the divider is not before the block');
});

test('2 · the Maker with no kit draws the empty block exactly as before — no card', () => {
  const html = draw({ maker: true, artKit: null });
  assert.doesNotMatch(html, /data-kit-slot|data-maker-gifts-card/, 'a card or an accent without a kit');
  assert.equal(renderToStaticMarkup(h(MakerWelcomeGiftsEmpty, { kit: null })), renderToStaticMarkup(h(MakerWelcomeGiftsEmpty, {})), 'a null kit changed the block');
  assert.match(html, /Add a way to receive gifts\./);
});

test('3 · a guest with no way to give sees nothing — kit or not', () => {
  assert.equal(draw({ maker: false, artKit: VIEW }), draw({ maker: false, artKit: null }), 'the kit changed a guest’s page');
  assert.doesNotMatch(draw({ maker: false, artKit: VIEW }), /gifts|Add a way/i, 'a guest was shown the empty gifts block');
});

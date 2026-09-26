/**
 * 🫥 AN EMPTY SECTION IS LEFT OUT FOR GUESTS, KEPT IN THE MAKER (owner 2026-09-26).
 *
 * cale-ice's live invitation printed "Your hosts haven't shared the dress code
 * yet" and "will share their photo guidance closer to the wedding" to every
 * guest. Guests now see nothing for a section with nothing in it; the couple's
 * Maker canvas still shows the placeholder so they know what to fill. The
 * INC / Muslim modest-dress guidance is real guidance and still shows.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The components compile with the classic JSX runtime under tsx: React must be global.
(globalThis as { React?: unknown }).React = React;
const { createElement } = React;
const { PhotoMomentsWidget } = require('../_components/photo-moments-widget') as typeof import('../_components/photo-moments-widget');
const { DressCodeWidget } = require('../_components/dress-code-widget') as typeof import('../_components/dress-code-widget');

const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
const render = (el: unknown) => renderToStaticMarkup(el as never);

test('photo moments: empty → nothing for a guest, the placeholder in the Maker', () => {
  assert.equal(render(createElement(PhotoMomentsWidget, { config: null, words, hideWhenEmpty: true })), '');
  assert.match(render(createElement(PhotoMomentsWidget, { config: null, words })), /photo guidance/);
});

test('dress code: nothing authored → nothing for a guest, the placeholder in the Maker', () => {
  assert.equal(render(createElement(DressCodeWidget, { config: null, words, hideWhenEmpty: true })), '');
  assert.match(render(createElement(DressCodeWidget, { config: null, words })), /dress code yet/);
});

test('dress code: INC and Muslim modest-dress guidance still shows to guests', () => {
  assert.match(render(createElement(DressCodeWidget, { config: null, words, ceremonyType: 'inc', hideWhenEmpty: true })), /Modest/);
  assert.notEqual(render(createElement(DressCodeWidget, { config: null, words, ceremonyType: 'muslim', hideWhenEmpty: true })), '');
});

test('both doors pass the guest view, and only the Maker canvas keeps the placeholders', () => {
  const body = readFileSync(join(__dirname, '..', '_components', 'site-body.tsx'), 'utf8');
  const passes = body.match(/guestView=\{!isMakerCanvas\}/g) ?? [];
  assert.equal(passes.length, 2, `the guest door and the stranger door both pass it (found ${passes.length})`);
  for (const door of ['hideable-widget-render.tsx', 'public-hideable-widget.tsx']) {
    const src = readFileSync(join(__dirname, '..', '_components', door), 'utf8');
    assert.equal((src.match(/hideWhenEmpty=\{guestView\}/g) ?? []).length, 2, `${door}: dress code + photo moments`);
  }
});

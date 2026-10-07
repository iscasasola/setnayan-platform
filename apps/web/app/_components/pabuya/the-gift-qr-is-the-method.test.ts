/**
 * 📱 THE GIFT QR IS THE METHOD — owner, 2026-10-07, on the guest page's E-Gifts
 * (each method drawn with a gift icon tile): *"shouldn't we show the actual QR
 * instead?"*
 *
 * RENDERED (`PabuyaCardList`, the one card list the guest gift page and the
 * couple's preview share):
 *   1. a scan-first rail (`qrPrimary`: GCash, Maya) WITH an uploaded QR draws the
 *      QR itself where the icon tile stood — sized to scan (≥ 120 px, `h-32`),
 *      a link to the full-size image — and no icon tile, no second QR;
 *   2. the same rail with NO QR keeps its mark (the icon tile), no image;
 *   3. bank and PayPal keep their details and their mark; a QR they uploaded
 *      stays beside them as before;
 *   4. the save is the shipped one (`?download=1`, `PabuyaMethodActions`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const QR = '/api/pabuya/qr/S89G-ABCDEFGHJK';
async function card(kind: string, qrUrl: string | null) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PabuyaCardList } = await import('./pabuya-card-list');
  return renderToStaticMarkup(
    React.createElement(PabuyaCardList, {
      methods: [{ kind, label: '', accountName: 'Ana Reyes', handle: '0917 123 4567', note: null, qrUrl }],
    }),
  );
}
const ICON_TILE = /rounded-full bg-mulberry\/10/;
const imgs = (html: string) => html.match(/<img\b/g) ?? [];

test('1 · GCash and Maya with a QR: the QR stands where the icon was, sized to scan, tap = full size', async () => {
  for (const kind of ['gcash', 'maya']) {
    const html = await card(kind, QR);
    assert.match(html, /data-egift-qr="primary"/, `${kind}: the QR is not the method`);
    assert.match(html, /data-egift-qr="primary"[^>]*class="[^"]*\bh-32 w-32\b/, `${kind}: the QR is smaller than 120 px`);
    assert.match(html, new RegExp(`href="${QR}"[^>]*data-egift-qr="primary"`), `${kind}: the QR does not open full size`);
    assert.doesNotMatch(html, ICON_TILE, `${kind}: the icon tile is still drawn beside the QR`);
    assert.equal(imgs(html).length, 1, `${kind}: the QR is drawn twice`);
  }
});

test('2 · no QR uploaded: the mark as today, no image', async () => {
  const html = await card('gcash', null);
  assert.match(html, ICON_TILE);
  assert.equal(imgs(html).length, 0);
});

test('3 · bank and PayPal keep their details and their mark; their QR stays beside', async () => {
  for (const kind of ['bank', 'paypal']) {
    const html = await card(kind, QR);
    assert.match(html, ICON_TILE, `${kind}: lost its mark`);
    assert.match(html, /0917 123 4567/, `${kind}: lost its details`);
    assert.match(html, /data-egift-qr="side"/, `${kind}: its uploaded QR moved`);
  }
});

test('4 · the save is the shipped one', async () => {
  assert.match(await card('gcash', QR), /download=1/, 'no "Save" for the QR');
});

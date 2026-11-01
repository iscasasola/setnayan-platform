/**
 * 📏 THE COVER'S WORDS START BELOW THE ARAÑA (walk 2026-11-01, `/dev/art-kit-lab` at 390 in WebKit).
 *
 * The approved proof (DECISION_LOG 2026-10-16 "APPROVED — THE VINTAGE ART KIT, AS THE PROOF SHOWS";
 * `prototypes/art_kit_cale_ice_2026-10-16.html`) hangs the chandelier "into the cover from the top edge, between the
 * drapes and above the first line". Built, its layer sat UNDER the words but ON them: the top line ("With thanksgiving
 * to God…") and "Maria" were drawn through the brass and the crystal drops. The drapes were moved further out for the
 * same reason ("the drapes must not clip the top line"); a piece in the words' own column cannot be moved out, so the
 * words move down.
 *
 * THE PROPERTY: every cover piece that hangs in the words' column (its box is centred on the slot) makes the cover's
 * header start its words below that piece's bottom edge — and a cover without such a piece keeps its own padding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ART_KITS, artKitCss, artKitView, coverWordsClearance, kitPlacements } from './art-kits';
import { KitSlot } from '../app/[slug]/_components/kit-piece';

(globalThis as unknown as { React: unknown }).React = React;

const centred = (left: string | undefined) => typeof left === 'string' && /50%/.test(left);

test('🔑 every cover piece in the words’ column asks the words to start below it', () => {
  let seen = 0;
  for (const kit of Object.values(ART_KITS)) {
    for (const p of kitPlacements(kit, 'cover')) {
      if (!centred(p.box.left)) continue;
      seen += 1;
      assert.equal(p.clearsWords, true, `${kit.ornament}: the cover's ${p.piece} hangs in the words' column but the words do not clear it`);
    }
  }
  assert.ok(seen > 0, 'no centred cover piece found — the scan is blind (the araña moved?)');
});

test('🔑 the cover header’s padding clears the araña’s bottom edge', () => {
  const view = artKitView({ theme: 'vintage', accents: {}, ownsPro: true, tryOn: false })!;
  const chandelier = kitPlacements(view.kit, 'cover').find((p) => p.piece === 'chandelier')!;
  const piece = view.kit.pieces.chandelier!;
  const bottom = Number.parseFloat(chandelier.box.top!) + (Number.parseFloat(chandelier.box.width) * piece.h) / piece.w;
  const clearance = coverWordsClearance(view);
  assert.ok(clearance !== null && clearance >= bottom, `the words start at ${clearance}px, the araña ends at ${bottom}px`);
  const css = artKitCss(view);
  assert.ok(
    css.includes(`header:has(>[data-kit-slot="cover"] [data-kit-clear]){padding-top:calc(${clearance}px - var(--cover-scene-pad,0px))}`),
    'the kit stylesheet no longer pushes the cover words below the araña',
  );
  const html = renderToStaticMarkup(React.createElement(KitSlot, { kit: view, slot: 'cover' }));
  assert.match(html, /data-kit-piece="chandelier"[^>]*data-kit-clear=""|data-kit-clear=""[^>]*data-kit-piece="chandelier"/, 'the drawn araña does not carry the mark the padding rule finds');
});

test('a cover without the araña (Drapes only, or None) keeps its own padding', () => {
  for (const hero of ['drapes', 'none']) {
    const view = artKitView({ theme: 'vintage', accents: { hero }, ownsPro: true, tryOn: false })!;
    assert.equal(coverWordsClearance(view), null, `hero=${hero} still pushes the words down`);
    assert.ok(!artKitCss(view).includes('[data-kit-clear]'), `hero=${hero} still writes the clearance rule`);
  }
});

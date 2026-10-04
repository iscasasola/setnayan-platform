/**
 * a-phone-sheet-opens-at-half.test.ts — THE SHEET OVER THE CANVAS RESTS AT
 * HALF, KEEPS THE PAGE LIVE, AND NEVER WRITES (PR-0 of the Maker
 * rearrangement; owner 2026-10-04, "EVENT DETAILS / MAKER: FOUR FIXES BEFORE
 * BUILD", fix 1: *"The phone scene sheet is half height; the edited scene
 * scrolls into view above it; drag up for more rows; Peek (press-and-hold)
 * hides the sheet to see the whole scene"*; screen 8 of
 * `prototypes/event_details_improved_2026-10-04_fable.html`).
 *
 * Held on the RENDER of `MakerHalfSheet` (`launch/_components/maker-sheet.tsx`):
 *   · at rest it is HALF — at 375 × 812 the top bar + the sheet cover ≤ 50% of
 *     the screen, and it is not a sliver either (≥ 40%); the taller size is
 *     only ever the couple's drag, never the rest;
 *   · the page above it is NOT dimmed — a change is seen live, and a tap on
 *     another element reaches the canvas (no scrim over it);
 *   · Peek is in its header, a 44 px press-and-hold, named;
 *   · the scene sheet (the Inspector) is mounted in it;
 *   · 🔒 opening, dragging, peeking and collapsing never write: the sheet and
 *     its reducer import no action, save or fetch;
 *   · ONE reducer: the half sheet runs the part sheet's `elementSheetStep`
 *     (`lib/element-sheet-state.ts`), never a second mechanism.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { HALF_SHEET_REST, HALF_SHEET_UP } from './element-sheet-state';
import { MAKER_PHONE_BAR_PX, phoneHeightPx } from './maker-phone-room';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const SHEET = 'app/dashboard/[eventId]/launch/_components/maker-sheet.tsx';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

async function rest(): Promise<string> {
  const { MakerHalfSheet } = await import(`../${SHEET}`);
  return renderToStaticMarkup(
    React.createElement(
      MakerHalfSheet,
      { label: 'Inspector', title: 'When & where', target: 'scene:venues', section: 'Format', onClose: () => {} },
      React.createElement('div', { 'data-stub': 'rows' }, 'rows'),
    ),
  );
}

const asideOf = (html: string) => {
  const tag = /<aside\b[^>]*aria-label="Inspector"[^>]*>/.exec(html)?.[0];
  assert.ok(tag, 'the half sheet did not render its aside');
  return { tag, classes: /\bclass="([^"]*)"/.exec(tag)?.[1] ?? '' };
};

test('▁ at rest the sheet is HALF: at 375 × 812 the bar + the sheet cover ≤ 50% (and ≥ 40%) of the screen', async () => {
  const { tag, classes } = asideOf(await rest());
  assert.match(tag, /data-half-sheet="half"/, 'the sheet does not open at half');
  assert.ok(classes.includes(HALF_SHEET_REST), `the sheet does not wear the rest height (${HALF_SHEET_REST})`);
  assert.ok(!classes.includes(HALF_SHEET_UP), 'the sheet opens dragged up — the taller size is the couple’s drag, never the rest');
  for (const height of [812, 844, 667]) {
    const px = phoneHeightPx(classes, height);
    assert.ok(px !== null, 'the sheet declares no phone height');
    const covered = (px + MAKER_PHONE_BAR_PX) / height;
    assert.ok(covered <= 0.5 + 1e-9, `375×${height}: the bar + the sheet cover ${(covered * 100).toFixed(1)}% — more than half`);
    assert.ok(covered >= 0.4, `375×${height}: the sheet is a sliver (${(covered * 100).toFixed(1)}%), not half`);
  }
  assert.match(tag, /data-phone-chrome="panel"/, 'the sheet no longer says it is phone chrome');
});

test('👁 the page above the half sheet is LIVE — no scrim; Peek is in the header, 44 px and named', async () => {
  const html = await rest();
  assert.doesNotMatch(html, /data-sheet-scrim=""/, 'the half sheet dims the page — the change must be seen live and the page tappable');
  const peek = /<button\b[^>]*data-half-sheet-peek=""[^>]*>/.exec(html)?.[0] ?? '';
  assert.ok(peek, 'Peek is not in the sheet’s header');
  assert.match(peek, /aria-label="Peek — hold to see the whole page"/);
  assert.match(peek, /\bh-11\b/, 'Peek is under 44 px');
  assert.match(peek, /\btouch-none\b/, 'a held Peek would scroll the sheet instead');
  assert.match(html, /data-half-sheet-grip=""/, 'the grab handle is gone');
  assert.match(html, /aria-label="Close"[^>]*data-half-sheet-close=""|data-half-sheet-close=""[^>]*aria-label="Close"/, 'the × is gone');
  // The slim bar and the Peek note draw only when asked.
  assert.doesNotMatch(html, /data-half-sheet-slim=""|data-half-sheet-peek-note=""/, 'the slim bar or the Peek note shows at rest');
  // Peek's press is held by pointer capture and let go on up / cancel / lost capture.
  const src = read(SHEET);
  for (const needle of ['setPointerCapture', 'onPointerUp={peekOff}', 'onPointerCancel={peekOff}', 'onLostPointerCapture={peekOff}']) {
    assert.ok(src.includes(needle), `Peek lost ${needle}`);
  }
});

test('🧩 the scene sheet (the Inspector) is mounted in the half sheet, and reveals its scene above it', () => {
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(shell, /<MakerHalfSheet\s+label="Inspector"/, 'the scene sheet is not the half sheet');
  assert.match(shell, /onReveal=\{\(\) => scrollPreviewTo\(selectedKeyRef\.current \?\? undefined\)\}/, 'the edited scene is not brought into view above the sheet');
  assert.doesNotMatch(shell, /<SheetScrim onClose=\{onClose\} \/>[\s\S]{0,400}aria-label="Inspector"/, 'the scene sheet dims the page again');
  // A tap on nothing reaches the sheet: the bridge says it.
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /t: 'tapOutside'/, 'the canvas no longer says a tap landed on nothing');
});

test('🔒 opening, dragging, peeking and collapsing NEVER write — no action, save or fetch in the sheet or its reducer', () => {
  for (const rel of [SHEET, 'lib/element-sheet-state.ts']) {
    const src = read(rel);
    assert.ok(src.length > 400, `${rel} scanned nearly empty`);
    for (const write of [/\bfetch\(/, /\bFormData\b/, /makerSave/, /Action\(/, /draftAction/, /'use server'/, /from '[^']*actions'/, /router\.(refresh|push|replace)/]) {
      assert.doesNotMatch(src, write, `${rel} can write (${write}) — a sheet's moves are draw-time state only`);
    }
  }
  // ONE reducer for every sheet over the canvas — the part sheet's.
  assert.match(read(SHEET), /elementSheetStep\(st, ev\)/, 'the half sheet runs its own reducer — it must run the part sheet’s');
  assert.doesNotMatch(read(SHEET), /function \w*[Rr]educer\b/, 'a second sheet reducer grew back in maker-sheet.tsx');
  const imports = [...read(SHEET).matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['@/lib/element-sheet-state', 'lucide-react', 'react'], 'the sheet imports something new — check it cannot write');
});

/**
 * GUARD — ON MEMORIES, PAPIC IS ON TOP (owner 2026-11-20, *"memories approved"* — `prototypes/memories_redesign_2026-11-20/`,
 * DECISION_LOG "EVENT › MEMORIES — PAPIC ON TOP + FIVE OPENED PAGES, APPROVED" (1): *"Order: Papic block → Magazine ·
 * Recap · Flash · Thank You → filter row → grid"*).
 *
 * RENDERED, not grepped: the real `EventMemoriesGallery`, handed sentinel Papic and keepsake parts, drawn to markup —
 * so the order checked is the order a host sees.
 *
 *   1 · the Papic block comes before BOTH the keepsake row and the filter row (Albums ▾ · Chapter ▾ · count · ⚙), and the
 *       grid comes after all three;
 *   2 · the page builds the one Papic card and hands it to that slot (and Add photos opens the picker in the same tap
 *       where adding is open);
 *   3 · SABOTAGE — the check can fail: a gallery that draws Papic under the filter row is caught.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';

/* 🪤 `globalThis.React` before the dynamic import (`"jsx": "preserve"`), a CSS-module stub (the thumb row's search imports
   a `*.module.css` node cannot parse — each class name resolves to itself) and a `server-only` stub — the repo's pattern
   (`every-empty-part-shows-an-example.test.ts`). */
(globalThis as unknown as { React: unknown }).React = React;
{
  type ModT = {
    _extensions: Record<string, (m: { exports: unknown }) => void>;
    _load: (request: string, ...rest: unknown[]) => unknown;
  };
  const Mod = (createRequire(import.meta.url)('node:module') as { Module: ModT }).Module;
  Mod._extensions['.css'] = (m) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : k === 'default' ? m.exports : String(k)) });
  };
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Where each part starts in the markup: Papic · keepsakes · the filter row · the grid. */
export function topOrder(html: string): { papic: number; keepsakes: number; filters: number; grid: number } {
  return {
    papic: html.indexOf('data-test-papic'),
    keepsakes: html.indexOf('data-test-keepsakes'),
    filters: html.indexOf('data-memories-top=""'),
    grid: html.indexOf('data-memories-grid=""'),
  };
}

export function assertPapicOnTop(html: string): void {
  const at = topOrder(html);
  assert.ok(at.papic >= 0, 'the Papic block is not drawn for the host');
  assert.ok(at.keepsakes >= 0 && at.filters >= 0 && at.grid >= 0, `premise: every part is drawn (${JSON.stringify(at)})`);
  assert.ok(at.papic < at.keepsakes, 'the keepsake row is drawn above the Papic block');
  assert.ok(at.papic < at.filters, 'the filter row is drawn above the Papic block');
  assert.ok(at.keepsakes < at.filters, 'the keepsake row is under the filter row');
  assert.ok(at.filters < at.grid, 'the grid is above the filter row that filters it');
}

async function drawGallery(host = true): Promise<string> {
  const { EventMemoriesGallery } = await import('@/app/_components/memories/event-memories-gallery');
  return renderToStaticMarkup(
    React.createElement(EventMemoriesGallery, {
      eventId: '00000000-0000-4000-8000-000000000000',
      items: [],
      host,
      totals: { all: 0, papic: 0 },
      footLine: null,
      cappedLine: null,
      emptyLine: 'Your photos land here as your guests and suppliers shoot.',
      unreadable: false,
      timeZone: 'Asia/Manila',
      papic: React.createElement('div', { 'data-test-papic': '' }),
      keepsakes: React.createElement('nav', { 'data-test-keepsakes': '' }),
    }),
  );
}

test('1 · rendered: Papic → the keepsake row → the filter row → the grid', async () => {
  assertPapicOnTop(await drawGallery());
  // A viewer who is not the host gets neither (the server never builds them for one; the gallery holds it too).
  const guest = await drawGallery(false);
  assert.equal(topOrder(guest).papic, -1, 'a non-host is drawn the Papic block');
  assert.equal(topOrder(guest).keepsakes, -1, 'a non-host is drawn the keepsake row');
});

test('2 · the page builds the one Papic card and hands it to that slot', () => {
  const page = code('app/dashboard/[eventId]/memories/page.tsx');
  assert.equal((page.match(/<PapicCard\b/g) ?? []).length, 1, 'Memories builds other than one Papic card');
  assert.match(page, /papic=\{papicCard\}/, 'the card is not handed to the gallery');
  assert.match(page, /addPicksAtOnce=\{addPicksAtOnce\}/, 'the gallery is not told whether Add photos picks at once');
  assert.match(page, /addPicksAtOnce = uploadsOpen;/, 'Add photos picks at once even where adding by hand is off');
  assert.match(page, /add: addPhotos \? <MemoriesAddPhotosButton \/> : null,/, 'the block has no Add photos');
});

test('3 · SABOTAGE — a gallery that draws Papic under the filter row fails the check', async () => {
  const html = await drawGallery();
  const at = topOrder(html);
  const papic = html.slice(at.papic - 5, html.indexOf('>', at.papic) + 1);
  assert.ok(papic.startsWith('<div ') || papic.includes('data-test-papic'), 'premise: the sentinel is found');
  const moved = html.replace(/<div data-test-papic=""><\/div>/, '').replace('data-memories-grid=""', 'data-memories-grid=""><i data-test-papic=""></i');
  assert.notEqual(moved, html, 'premise: the sabotage found its anchor');
  assert.throws(() => assertPapicOnTop(moved), /filter row is drawn above the Papic block|keepsake row is drawn above/);
});

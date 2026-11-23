/**
 * GUARD — MEMORIES GOES DARK, AND ITS ONE GLOW IS THE PAPIC BLOCK (22 Nov 2026).
 *
 * The approved drawing (`prototypes/memories_redesign_2026-11-20/memories_redesign_2026-11-20_fable.html`, DECISION_LOG
 * 2026-11-20 "EVENT › MEMORIES — PAPIC ON TOP + FIVE OPENED PAGES, APPROVED") carries its dark tokens, and the ruling
 * defers dark to `DARK_MODE_STANDARD_2026-11-20.md`: the page is FLAT dark, and the tone glow lives only in the screen's
 * TOP BLOCK (§3). On Memories the top block is the Papic block.
 *
 *   1 · the tab — exactly the tab — is on the ready-list (`DARK_READY`): a host who picked Dark sees it dark, while its
 *       sub-pages (the Thank-You Video, Download all) stay Light until they are walked (call 3: never a half-dark screen);
 *   2 · RENDERED: the Papic block draws `--color-band-glow` on its own frame — once, and nothing else on the block does;
 *   3 · the files Memories draws (the block, the keepsake row and its four sheets, ⚙, the page) type no light-only
 *       colour — a hex, `bg-white`, or a numbered palette class with no `dark:` pair — which would stay light on the
 *       dark page;
 *   4 · SABOTAGE — each check can fail: a list without the entry, a block without the glow, a typed `bg-white`.
 *
 * Not scanned, on purpose: `event-memories-gallery.tsx`, whose only typed colours are the badges and names drawn ON a
 * photo (art, the same in both modes — "Screened", "Event Hub", the ▶ mark, the name's shadow).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { DARK_READY, isDarkReady } from '@/lib/appearance';

/* 🪤 `globalThis.React` before the dynamic import (`"jsx": "preserve"`) — the repo's pattern. */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EVENT = '0b6a8c1e-3f2d-4c5b-9a7e-1d2c3b4a5f60';
const GLOW = '[background-image:var(--color-band-glow,none)]';

/** Every file Memories draws whose colours are chrome (not a photo's). */
const SWEPT = [
  'app/dashboard/[eventId]/memories/page.tsx',
  'app/dashboard/[eventId]/memories/_components/memories-settings.tsx',
  'app/dashboard/[eventId]/_components/papic-home-card.tsx',
  'app/_components/memories/memories-keepsake-row.tsx',
  'app/_components/memories/memories-add-photos.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/magazine-card.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/recap-card.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/recap-privacy-pill.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/life-flash-card.tsx',
  'app/dashboard/[eventId]/studio/_components/service-parts.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/papic-camera-help.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/papic-self-heal.tsx',
  'app/dashboard/[eventId]/_components/papic-chapter-read.tsx',
];

const PALETTE = /\b(?:bg|text|border|ring|from|to)-(?:gray|stone|neutral|zinc|slate|red|green|amber|yellow|blue|emerald|orange|rose|sky|indigo|purple|pink|lime|teal|cyan|violet|fuchsia)-\d{2,3}\b/;

/** The light-only colours a source types — each a line that would stay light on the dark page. */
export function lightOnlyColours(source: string): string[] {
  return stripComments(source)
    .split('\n')
    .filter((line) => /#[0-9a-fA-F]{3,8}\b(?![-\w])/.test(line) || /\bbg-white\b/.test(line) || (PALETTE.test(line) && !/\bdark:/.test(line)))
    .map((line) => line.trim());
}

export function assertMemoriesIsDarkReady(ready: readonly string[]): void {
  assert.ok(ready.includes('/dashboard/*/memories$'), 'Memories left the dark ready-list (lib/appearance.ts DARK_READY)');
  assert.equal(isDarkReady(`/dashboard/${EVENT}/memories`, ready), true, 'the Memories tab is not dark-ready');
  assert.equal(isDarkReady(`/dashboard/${EVENT}/memories/thank-you`, ready), false, 'the Thank-You Video page went dark unwalked');
  assert.equal(isDarkReady(`/dashboard/${EVENT}/memories/download-all`, ready), false, 'Download all went dark unwalked');
}

async function drawBlock(): Promise<string> {
  const { PapicHomeCard } = await import('@/app/dashboard/[eventId]/_components/papic-home-card');
  return renderToStaticMarkup(
    React.createElement(PapicHomeCard, {
      name: 'Papic',
      icon: React.createElement('svg'),
      phase: null,
      settings: React.createElement('div'),
      counts: { total: 100150, left: 100137 },
    }),
  );
}

export function assertOneGlowOnTheBlock(html: string): void {
  assert.equal(html.split(GLOW).length - 1, 1, 'the Papic block does not wear the top block’s glow exactly once');
  const block = html.slice(html.lastIndexOf('<div', html.indexOf(GLOW)), html.indexOf('>', html.indexOf(GLOW)) + 1);
  assert.match(block, /\bsn-frame\b/, 'the glow is not on the block’s own frame');
  assert.match(block, /data-papic-top-glow=""/, 'the glow is not on the Papic block');
}

test('1 · the Memories tab — exactly the tab — is on the dark ready-list', () => {
  assertMemoriesIsDarkReady(DARK_READY);
});

test('2 · rendered: the Papic block is the top block — it wears the one glow', async () => {
  assertOneGlowOnTheBlock(await drawBlock());
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  assert.match(css, /--color-band-glow:\s*none;/, 'Light lost its "no glow"');
  assert.match(css, /--color-band-glow:\s*radial-gradient\(/, 'Dark lost the glow the block reads');
});

test('3 · the files Memories draws type no light-only colour', () => {
  for (const rel of SWEPT) {
    assert.deepEqual(lightOnlyColours(readFileSync(join(WEB, rel), 'utf8')), [], `${rel} types a colour that stays light on the dark page`);
  }
});

test('4 · SABOTAGE — each check can fail', async () => {
  assert.throws(() => assertMemoriesIsDarkReady(DARK_READY.filter((e) => e !== '/dashboard/*/memories$')), /left the dark ready-list/);
  assert.throws(() => assertMemoriesIsDarkReady([...DARK_READY, '/dashboard/*/memories']), /Thank-You Video page went dark/);
  const html = await drawBlock();
  assert.ok(html.includes(GLOW), 'premise: the glow is drawn');
  assert.throws(() => assertOneGlowOnTheBlock(html.replace(GLOW, '')), /exactly once/);
  assert.throws(() => assertOneGlowOnTheBlock(html.replace(GLOW, `${GLOW} ${GLOW}`)), /exactly once/);
  assert.deepEqual(lightOnlyColours(`<div className="bg-white p-4" />`).length, 1);
  assert.deepEqual(lightOnlyColours(`<p style={{ color: '#2C2A29' }} />`).length, 1);
  assert.deepEqual(lightOnlyColours(`<p className="text-amber-800" />`).length, 1);
  assert.deepEqual(lightOnlyColours(`<p className="text-amber-800 dark:text-[rgb(var(--color-warn))]" />`).length, 0);
  assert.deepEqual(lightOnlyColours(`// was #C24E25\n<p className="text-ink" data-x="S89E-#12" />`).length, 0);
});

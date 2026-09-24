/**
 * planning-is-the-collection-template.test.ts
 *
 * ⚖ Owner-approved 2026-09-24 (DECISION_LOG, "the template is good"): the home
 * Planning shelf IS the collection template — soonest first, undated last,
 * ten per page with "1 · 2 · … · Last" and "1–10 of N", the dashed tile only
 * while the page has room, and an empty state that invites.
 *
 * The arithmetic is executed in `lib/collection-pagination.test.ts` and the
 * order in `lib/event-board-shelves.test.ts`. This file executes the two
 * RENDERED pieces (the pager and the empty state) and pins the one wiring a
 * number cannot catch: that Planning actually slices by the page and gates the
 * tile on room, rather than computing a pager and then rendering every card.
 *
 * 🪤 `globalThis.React` is set before DYNAMIC imports because the repo's
 * tsconfig uses `"jsx": "preserve"` (see `collection-card-is-the-only-card.test.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { paginateCollection } from '@/lib/collection-pagination';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const launcher = () => stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

async function render(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

async function pager(total: number, page: number): Promise<string> {
  const { CollectionPager } = await import('@/app/_components/collection-card');
  const p = paginateCollection(total, page);
  return render(
    React.createElement(CollectionPager, {
      label: 'Planning pages',
      rangeLabel: p.rangeLabel,
      links: p.stops.map((s) =>
        s.kind === 'gap'
          ? s
          : { kind: 'page' as const, href: `/dashboard?page=${s.page}#events`, label: s.label, current: s.current },
      ),
    }),
  );
}

const visibleText = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

test('the pager renders "1 · 2 · … · Last" and "1–10 of 100", the current page marked', async () => {
  const html = await pager(100, 1);
  assert.equal(visibleText(html), '1 2 … Last 1–10 of 100');
  assert.match(html, /<nav aria-label="Planning pages"/);
  assert.match(html, /<a aria-current="page"[^>]*href="\/dashboard\?page=1#events">1</);
  assert.equal((html.match(/aria-current=/g) ?? []).length, 1, 'exactly one current page');
  assert.match(html, /href="\/dashboard\?page=10#events"[^>]*>Last</);
});

test('the pager renders NOTHING while everything fits on one page', async () => {
  assert.equal(await pager(10, 1), '');
  assert.equal(await pager(3, 1), '');
});

test('the empty state carries its door and never claims a zero', async () => {
  const { CollectionEmptyState } = await import('@/app/_components/collection-card');
  const html = await render(
    React.createElement(CollectionEmptyState, {
      title: 'Start a celebration',
      body: 'Everything you plan gathers here.',
      action: React.createElement('a', { href: '/dashboard/create-event' }, 'Create an event'),
    }),
  );
  assert.match(html, /Start a celebration/);
  assert.match(html, /href="\/dashboard\/create-event"/);
});

test('Planning slices by the page, gates the tile on room, and mounts the pager', () => {
  const src = launcher();
  assert.match(
    src,
    /paginateCollection\(\s*upcoming\.length,\s*parseCollectionPage\(sp\.page\)\s*\)/,
    'Planning no longer pages `upcoming` by ?page=',
  );
  assert.match(
    src,
    /upcoming\.slice\(planningPage\.from,\s*planningPage\.to\)/,
    'Planning computes a page but no longer slices by it',
  );
  assert.match(
    src,
    /\{upcomingOnPage\.map\(\(event, i\)/,
    'the Planning grid renders every card, not the page',
  );
  assert.doesNotMatch(
    src,
    /\{upcoming\.map\(\(event, i\)/,
    'the Planning grid renders every card, not the page',
  );
  assert.match(
    src,
    /planningPage\.hasRoomForNewTile \? \(\s*<NewEventCard/,
    'the dashed tile is no longer gated on the page having room',
  );
  assert.match(src, /<CollectionPager[\s\S]{0,120}label="Planning pages"/);
  assert.match(src, /<CollectionEmptyState\b/, 'Planning lost its empty state');
});

test('the empty state never says "no events" — the read behind it degrades to []', () => {
  // `fetchUserEvents` returns [] on a refused read, and a person whose events
  // have all finished also sees an empty Planning shelf. "No celebrations yet"
  // (the prototype's line) would be false for both, so Planning's copy says what
  // the shelf is for and how to start one.
  const src = launcher();
  const block = src.match(/<CollectionEmptyState[\s\S]{0,700}?\/>/)?.[0] ?? '';
  assert.ok(block, 'could not find the empty state');
  assert.doesNotMatch(block, /\bno (celebrations|events)\b|\bnothing\b|\bfirst event\b/i);
});

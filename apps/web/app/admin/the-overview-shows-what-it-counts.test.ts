/**
 * Guard: the admin Overview cannot report work it has no tile for.
 *
 * WHAT WENT WRONG (measured 2026-08-25, on the owner's own screen). The Overview
 * keeps its OWN hand-written list of queue tiles, separate from the work list's
 * `BASE_ROWS` — and only `BASE_ROWS` was guarded (`lib/admin/work-rows.test.ts`
 * asserts it covers every `ADMIN_QUEUE_META` key). Nothing referenced the
 * Overview's list at all, so when four queues were given counts on 2026-08-19
 * they were never given tiles here.
 *
 * The result was a page contradicting itself. Its headline sums ALL the counted
 * queues; its "busiest queues" preview and its "All actionable queues are clear."
 * sentence are both built from the TILE list. With the only non-empty queue
 * absent from the tiles, the page printed "45 items need you · 1 past SLA" and
 * "All actionable queues are clear." at once — and the owner, reading the
 * sentence and sixteen zeroes, reported no notices.
 *
 * 🔑 THE HEADLINE AND THE THINGS UNDER IT MUST COUNT THE SAME QUEUES. A number
 * with nothing beneath it accounting for it is worse than no number.
 *
 * The key list is DERIVED — from `ADMIN_QUEUE_META` on one side and from the
 * page's own source on the other. A hand-written expectation here would be a
 * list of the queues somebody thought of, which is the defect, not the guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADMIN_QUEUE_META } from '@/lib/admin/queue-counts';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, 'page.tsx');

/** Comments here name the defect and quote the old copy; a raw match would
 *  count the explanation as an implementation. */
const code = (p: string) =>
  readFileSync(p, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

/** Every queue key the Overview actually draws a counted tile for. */
function tiledKeys(): Set<string> {
  const src = code(PAGE);
  return new Set(
    [...src.matchAll(/queueTile\(\s*'([a-z-]+)'/g)].map((m) => m[1]).filter((k): k is string => Boolean(k)),
  );
}

test('every counted queue has a tile on the Overview', () => {
  const meta = Object.keys(ADMIN_QUEUE_META);
  assert.ok(
    meta.length >= 15,
    `floor: expected 15+ counted queues, found ${meta.length} — if the registry ` +
      'shrank, re-derive rather than lowering this',
  );

  const tiled = tiledKeys();
  assert.ok(
    tiled.size >= 15,
    `floor: found only ${tiled.size} counted tiles on the Overview — the match ` +
      'is probably broken, not the page',
  );

  const missing = meta.filter((k) => !tiled.has(k));
  assert.deepEqual(
    missing,
    [],
    'These queues feed the Overview headline but have no tile there, so the page ' +
      'can report work with nothing beneath it explaining what. Add a queueTile ' +
      'for each — that is the whole bug of 2026-08-19.',
  );
});

test('the Overview draws no tile for a queue nothing counts', () => {
  /* The opposite direction: a tile whose key is not in the registry would render
     a permanent blank or a stale zero. */
  const stray = [...tiledKeys()].filter((k) => !(k in ADMIN_QUEUE_META));
  assert.deepEqual(
    stray,
    [],
    'the Overview draws a counted tile for a key no queue definition counts',
  );
});

test('⛔ the "no live count" caption never names a queue that HAS one', () => {
  /* The sentence that told the owner not to expect a number from the one desk
     with work in it. Any counted queue's route must be absent from that block. */
  const src = code(PAGE);
  const start = src.indexOf('More queues');
  assert.ok(start > 0, 'the "More queues" section vanished — re-point this guard');
  /* 🪤 BOUNDED TO THE SECTION, NOT TO END-OF-FILE. The first cut of this sliced
     from the heading to the bottom of the page and swallowed the later
     "every admin surface" directory, which legitimately links /admin/verify and
     /admin/payouts as destinations. It reported two false offenders — and a
     guard that cries wolf teaches you to skim past the one time it is right. */
  const end = src.indexOf('</section>', start);
  assert.ok(end > start, 'could not find the end of the "More queues" section');
  const block = src.slice(start, end);
  const offenders = Object.keys(ADMIN_QUEUE_META).filter((k) =>
    new RegExp(`href="/admin/${k}"`).test(block),
  );
  assert.deepEqual(
    offenders,
    [],
    'a queue with a live count is listed under "these carry no live count". ' +
      'That sentence is why nobody looked at the one queue that had work.',
  );
});

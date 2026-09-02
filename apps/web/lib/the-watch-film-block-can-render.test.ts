/**
 * the-watch-film-block-can-render.test.ts
 *
 * LS1 — the editorial "Watch the Film" block could never render, for two
 * independent reasons, both live on origin/main before this change:
 *
 *   1. THE GATE ASKED FOR A SKU NOBODY CAN OWN. The block gated on
 *      `eventSkuActive(admin, eventId, 'PANOOD_SYSTEM')`. `PANOOD_SYSTEM` is
 *      retired — it is not a row in `platform_retail_catalog_v2` at all (only
 *      `LIVE_STUDIO` is), so no order can ever carry it and the gate was false
 *      for every event that has ever existed. The fix gates on 'LIVE_STUDIO'
 *      instead — WIDER, not a swap: `SKU_OWNERSHIP_ALIASES.LIVE_STUDIO` is
 *      exactly `PANOOD_PAID_SKUS`, so a grandfathered Cast buyer still
 *      qualifies through the alias (see panood-retirement.test.ts).
 *
 *   2. THE URL IS WIPED THE MOMENT THE WEDDING ENDS. `events.panood_watch_url`
 *      is the LIVE embed, and ending a broadcast deliberately clears it so a
 *      finished event stops advertising itself as on-air. The REPLAY wants
 *      exactly what End destroys, so even with the SKU fixed the film vanished
 *      at the moment someone went looking for it. The fix falls back to the
 *      most recent `panood_broadcasts` row with `status = 'complete'` — its
 *      `broadcast_id` IS the YouTube video id (same convention
 *      lib/live-studio-recordings.ts uses).
 *
 * Every assertion here is WINDOWED to the "Watch the Film" block, not the
 * whole file — `data.ts` is thousands of lines and mentions `LIVE_STUDIO`,
 * `panood_broadcasts` and `panood_watch_url` elsewhere for unrelated reasons;
 * a whole-file match would stay green through a gutted gate.
 *
 * Run: `pnpm test:unit` (or `npx tsx --test apps/web/lib/the-watch-film-block-can-render.test.ts` from `apps/web`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { PANOOD_PAID_SKUS } from '@/lib/panood-watermark';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const DATA_TS = join(WEB, 'app/[slug]/_components/editorial/data.ts');

// Anchors in the RAW (unstripped) source. `stripComments` blanks comment text
// to spaces, so a marker that lives only in a comment (like the section
// banner) cannot be found post-strip — slice the raw file on CODE anchors
// first, then strip comments only within that already-bounded window.
const BLOCK_START_CODE = 'let watchFilmEmbedUrl: string | null = null;';
const BLOCK_END_CODE = '// ── Their song';

/** The "Watch the Film" block, comments stripped, and nothing outside it. */
function watchFilmBlock(): string {
  const raw = readFileSync(DATA_TS, 'utf8');
  const startAt = raw.indexOf(BLOCK_START_CODE);
  assert.ok(startAt >= 0, 'the "Watch the Film" block start anchor is gone from data.ts');
  const endAt = raw.indexOf(BLOCK_END_CODE, startAt);
  assert.ok(endAt > startAt, 'could not find the end-of-block marker ("Their song")');
  return stripComments(raw.slice(startAt, endAt));
}

test('sanity: PANOOD_PAID_SKUS is still the pair the alias depends on', () => {
  assert.deepEqual([...PANOOD_PAID_SKUS], ['PANOOD_SYSTEM', 'PANOOD_SYSTEM_MOBILE']);
});

test('the replay gate reads the sellable SKU, LIVE_STUDIO — never the retired PANOOD_SYSTEM', () => {
  const block = watchFilmBlock();
  assert.match(
    block,
    /eventSkuActive\(\s*admin\s*,\s*eventId\s*,\s*'LIVE_STUDIO'\s*\)/,
    "the gate must call eventSkuActive(admin, eventId, 'LIVE_STUDIO')",
  );
  for (const retired of PANOOD_PAID_SKUS) {
    assert.ok(
      !block.includes(`eventSkuActive(admin, eventId, '${retired}')`),
      `the gate must not ask eventSkuActive for the retired '${retired}' — no order can ever carry it`,
    );
  }
});

test('a second source exists: the most recent COMPLETE panood_broadcasts row', () => {
  const block = watchFilmBlock();
  assert.match(
    block,
    /\.from\('panood_broadcasts'\)/,
    'no fallback reads panood_broadcasts — the replay still depends solely on panood_watch_url, '
      + 'which End wipes the moment the wedding is over',
  );
  assert.match(
    block,
    /\.eq\('status', 'complete'\)/,
    "the panood_broadcasts fallback must filter to status = 'complete' — an in-progress or "
      + 'errored row is not a finished replay',
  );
  assert.match(
    block,
    /order\('ended_at',\s*\{\s*ascending:\s*false\s*\}\)/,
    'the fallback must pick the MOST RECENT complete broadcast (order by ended_at desc)',
  );
});

test('the panood_broadcasts fallback clears the injection barrier before it reaches the embed', () => {
  const block = watchFilmBlock();
  const fallbackAt = block.indexOf(".from('panood_broadcasts')");
  assert.ok(fallbackAt >= 0, 'panood_broadcasts fallback not found');
  const afterFallback = block.slice(fallbackAt);
  const barrierAt = afterFallback.indexOf('isYouTubeVideoId(');
  assert.ok(
    barrierAt > 0,
    'the raw broadcast_id column must pass through isYouTubeVideoId before it can reach '
      + 'youTubeEmbedUrl — unlike panood_watch_url, this column gets no free normalize',
  );
  const embedAt = afterFallback.indexOf('youTubeEmbedUrl(');
  assert.ok(embedAt > barrierAt, 'the barrier must run BEFORE the id reaches youTubeEmbedUrl');
});

test('panood_watch_url is read here, never written — the replay must not resurrect the LIVE block', () => {
  const block = watchFilmBlock();
  assert.ok(
    !/\.update\(\s*\{[^}]*panood_watch_url/.test(block),
    'the replay path must never write panood_watch_url — that column drives the separate '
      + '"Watch Live" block, and setting it here would tell guests a finished broadcast is still on air',
  );
});

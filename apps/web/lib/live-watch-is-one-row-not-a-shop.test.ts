/**
 * GUARD — the Live Watch page is rows, not a shop window (corpus
 * `MORE_MENU_PAGES_AUDIT_2026-10-07_fable.md` §3 step 1; prototype
 * `prototypes/more-menu-pages-2026-10-07/3-live-watch.html`).
 *
 * Owner, 2026-10-07, on the More-menu pages: *"those have so many words. it
 * doesn't feel simple and easy to understand"* · *"Live Stream full
 * controller."* The page measured ≥500 words at 375 px — a hero, four stat
 * tiles, a highlights list, three paragraphs, a plans table and a
 * not-included list that ended in a developer note to couples ("Build state:
 * the switching controller and picker are in place…").
 *
 * What must stay true:
 *   1. No `AppStoreLayout` (the shop window) and no "Build state" line.
 *   2. The purchase survives as ONE row — `MoreCamerasRow` — opening the SAME
 *      `ChoosePlanSheet`, with the LIVE_STUDIO plan and the four readiness
 *      notices (the sheet is untouched; only the words in front of it went).
 *   3. The free single-camera door is still on the page (`controllerHref`) —
 *      WHERE it should live is an open owner call (audit §4), not this PR's.
 *   4. The first-visit tour is mounted, and the visible copy says "event",
 *      never "celebration".
 *
 * Source-level on purpose: an RSC page with no render harness in this repo,
 * the shape `lib/live-studio-cast-retirement.test.ts` already uses here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');
const PAGE = 'app/dashboard/[eventId]/studio/live-studio-control/page.tsx';
const ROW = 'app/dashboard/[eventId]/studio/live-studio-control/_components/more-cameras-row.tsx';

const page = stripComments(read(PAGE));
const row = stripComments(read(ROW));

test('NON-VACUITY — the page and its row are real files', () => {
  assert.ok(page.length > 2000, `${PAGE} is a stub`);
  assert.ok(row.length > 400, `${ROW} is a stub`);
});

test('1 · no shop window — no AppStoreLayout, no stat tiles, no "Build state" note', () => {
  assert.doesNotMatch(page, /AppStoreLayout|StatTile|highlights=|notIncluded/, 'the shop window is back');
  assert.doesNotMatch(page, /Build state/i, 'a developer note is shown to couples again');
});

test('2 · the purchase is ONE row, opening the same ChoosePlanSheet', () => {
  assert.match(page, /<MoreCamerasRow\b/, 'the More cameras row is not mounted');
  assert.match(row, /<ChoosePlanSheet\b/, 'the row no longer opens the plan sheet');
  assert.match(row, /renderTrigger=/, 'the row is not the sheet’s trigger');
  assert.match(page, /sku_code:\s*LIVE_STUDIO_SKU_CODE/, 'the LIVE_STUDIO plan left the sheet');
  for (const n of ['LEAD_TIME_NOTICE', 'YOUTUBE_READY_NOTICE', 'ENCODER_BUY_NOTICE', 'MUSIC_RIGHTS_NOTICE']) {
    assert.match(page, new RegExp(`notice:[^\\]]*\\b${n}\\b`), `${n} no longer reaches the buyer`);
  }
  // Every AddOnState still has an answer on the row (mirrors AddOnStateCta).
  for (const s of ['add', 'request_sent', 'launch', 'blocked', 'expired']) {
    assert.match(row, new RegExp(`case '${s}'`), `the row has no answer for state "${s}"`);
  }
});

test('3 · the free single-camera door is still here, in the thumb zone', () => {
  assert.match(page, /<ThumbBar\b[\s\S]*href=\{controllerHref\}[\s\S]*<\/ThumbBar>/, 'the free door left the page');
});

test('4 · the tour is mounted and the copy says "event"', () => {
  assert.match(page, /<MiniTour tourKey="customer_live_watch_v1"/, 'no first-visit tour');
  assert.doesNotMatch(page, /celebration/i, '"celebration" is back in the visible copy');
});

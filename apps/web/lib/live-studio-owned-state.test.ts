/**
 * ⭐ A COUPLE WHO PAYS ₱3,000 MUST BE TREATED AS HAVING PAID.
 *
 * `ADD_ON_SKU_MAP` (lib/add-on-stats.ts) keys the two Live Studio generations
 * separately — `panood` → the RETIRED Cast SKUs, `live-studio-roam` → the live
 * `LIVE_STUDIO` ₱3,000 — and `SKU_OWNERSHIP_ALIASES` does **not** expand at this
 * layer (it applies inside `eventSkuActive`). So a surface that asks for `panood`
 * resolves a LIVE_STUDIO buyer to NOT-OWNED.
 *
 * The two surfaces where that costs the couple something real:
 *   • the day-of LAUNCH checklist — an "Add" button instead of "Go live", at the
 *     wedding, on the one doorway that is pressed exactly once;
 *   • GALLERIES — no "Watch the recording" card afterwards.
 *
 * Latent today only because no Live Studio SKU has ever been bought. It arms on the
 * first sale, and the SKU is listed and purchasable on the public /pricing page.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADD_ON_SKU_MAP } from './add-on-stats';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

const LAUNCH = 'app/dashboard/[eventId]/launch/page.tsx';
const GALLERIES = 'app/dashboard/[eventId]/galleries/page.tsx';

test('the two feature keys map to different SKU generations — this is the trap', () => {
  assert.deepEqual(ADD_ON_SKU_MAP['panood'], ['PANOOD_SYSTEM', 'PANOOD_SYSTEM_MOBILE']);
  assert.ok(
    ADD_ON_SKU_MAP['live-studio-roam']?.includes('LIVE_STUDIO'),
    'the unified key must map to the SKU people can actually buy',
  );
  // Non-vacuity: if these two ever merged, the test below would pass for free.
  assert.ok(
    !ADD_ON_SKU_MAP['panood']?.includes('LIVE_STUDIO'),
    'panood must NOT resolve LIVE_STUDIO — if it did, this whole guard is unnecessary',
  );
});

test('⭐ the day-of LAUNCH checklist resolves ownership from the LIVE SKU', () => {
  const src = repoFile(LAUNCH);
  assert.match(
    src,
    /resolveAddOnState\(supabase, eventId, 'live-studio-roam', 'couple'\)/,
    'a paying couple would see "Add" instead of "Go live" at their wedding',
  );
  assert.doesNotMatch(
    src,
    /resolveAddOnState\(supabase, eventId, 'panood', 'couple'\)/,
    'the retired-SKU key is still being asked for',
  );
});

test('⭐ GALLERIES resolves ownership from the LIVE SKU', () => {
  const src = repoFile(GALLERIES);
  assert.match(src, /resolveAddOnState\(supabase, eventId, 'live-studio-roam', 'couple'\)/);
  assert.doesNotMatch(src, /resolveAddOnState\(supabase, eventId, 'panood', 'couple'\)/);
});

test('the launch BUY doorway does not point at the retired Cast detail page', () => {
  // /studio/panood is the Cast detail page; its SKU is is_active=false, so it offers
  // no buy control — an "Add" button landing there is a dead end.
  const src = repoFile(LAUNCH);
  assert.doesNotMatch(src, /addHref: `\$\{base\}\/studio\/panood`/);
  assert.match(src, /addHref: `\$\{base\}\/studio\/live-studio-control`/);
});

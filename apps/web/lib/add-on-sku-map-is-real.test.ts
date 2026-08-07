import test from 'node:test';
import assert from 'node:assert/strict';
import { ADD_ON_SKU_MAP } from './add-on-stats';

/**
 * A FEATURE IN ADD_ON_SKU_MAP MUST NEVER MAP TO AN EMPTY SKU LIST.
 *
 * WHY. An empty list makes every ownership lookup answer "not owned", for every
 * event, forever — and nothing errors, because "no matching order" is exactly
 * what genuinely not owning it looks like. On 2026-07-21 the `panood` entry
 * listed seven codes that could never match while prod held two paid orders on
 * one event, and that host was shown a **buy button instead of their control
 * room**. An empty array is the same failure in cleaner clothes.
 *
 * It is also the shape the `papic` key had: an empty array behind a "SKUs slot
 * in here later" TODO, sitting there waiting to be filled by someone who would
 * then have keyed Papic ownership off `orders` — which is wrong, because Papic
 * is free to start and its grant writes `papic_event_point_grants`.
 *
 * 🚫 A SECOND DRAFT ALSO OVER-FIRED AND WAS DROPPED. "No feature may map to an
 * empty SKU list" sounds right and is false here: `mood-board`, `save-the-date`,
 * `led` and `patiktok` are legitimately empty — save-the-date is the free
 * page-opening reveal with no SKU at all. A rule that reddens on four correct
 * entries teaches you to skim past the one time it is right. What is asserted
 * below is only what is actually true.
 *
 * 🚫 WHAT THIS TEST DELIBERATELY DOES NOT DO: check that each SKU code EXISTS.
 * The first draft compared against `lib/sku-catalog.ts` and flagged all four
 * live codes — because `add-on-stats.ts` says in its own header to verify
 * against `platform_retail_catalog_v2` and **never** against `sku-catalog.ts`.
 * Any code-file version of that check is two hand-typed lists agreeing with each
 * other, which is not a guard; and a db test would read the PGlite replay seed,
 * not the production catalog. A guard that cries wolf is worse than none, so the
 * unsound half was dropped rather than weakened into something that passes.
 *
 * ⏭ The existence check belongs against the LIVE catalog. Until there is a
 * sound home for it, verify by hand when adding a SKU here:
 *   select service_code from platform_retail_catalog_v2 where service_code = '…';
 */

test('the map still carries the SKUs the 2026-07-21 incident was about', () => {
  // Non-vacuity: pins that the two Live Studio generations are still distinct
  // and populated, so the papic assertion below cannot pass on an empty map.
  assert.ok(
    (ADD_ON_SKU_MAP['panood'] ?? []).includes('PANOOD_SYSTEM'),
    'panood lost its SKUs — a paid host would be shown a buy button',
  );
  assert.ok(
    (ADD_ON_SKU_MAP['live-studio-roam'] ?? []).includes('LIVE_STUDIO'),
    'the unified key must map to the SKU people can actually buy',
  );
});

test('papic is absent from the map, deliberately', () => {
  // Papic ownership is NOT an orders question: it is free to start and the grant
  // writes papic_event_point_grants. Prod holds 13 seats and 9 grants against 0
  // orders, so an orders-keyed lookup answers "not owned" for every Papic-active
  // event that exists. Use eventPapicActive() (lib/papic-seats.ts).
  assert.equal(
    ADD_ON_SKU_MAP['papic'],
    undefined,
    'Adding a `papic` key here re-creates the 2026-07-21 defect pointed at a ' +
      'different feature. Ownership lives in eventPapicActive(), not in orders.',
  );
});

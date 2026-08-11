/**
 * tests/db/sellable-promises.db.test.ts — a live SKU may not promise something
 * the app cannot do.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * `platform_retail_catalog_v2.description` is customer-facing copy on a thing
 * people pay for. It is therefore a PROMISE, and on 2026-08-11 two live rows
 * were making one the app could not keep — read out of PROD, not out of a doc:
 *
 *   • EVENT_SUBDOMAIN (₱999/yr, is_active=TRUE) — "Your own web address —
 *     yourname.setnayan.com". No such address resolves: there is no wildcard
 *     DNS and no subdomain-aware routing. Owner ruled it off sale 2026-08-10.
 *
 *   • ANIMATED_MONOGRAM (₱1,000, is_active=TRUE) — "…and up on the LED stage
 *     screen. Includes the Live Background." The monogram works and stays on
 *     sale; the LED half did not. The maker saved a design and NOTHING
 *     produced a file — `led_background_renders` sat in prod with zero rows
 *     and zero writers — so a couple could not hand anything to their venue.
 *     ⚠ UPDATED 2026-08-11: the owner chose removal over building a render
 *     farm ("remove wall backdrop"), so the maker, its route, its save
 *     endpoint, its templates and its two tables are GONE. This assertion is
 *     therefore no longer "do not promise it until it is built" — it is "we do
 *     not sell an LED backdrop." Re-adding the sentence without re-adding a
 *     working end-to-end backdrop is the failure this catches.
 *
 * ── WHY A REPLAY AND NOT A PROD QUERY ──────────────────────────────────────
 * A test that queries prod would pass or fail on whatever an admin last typed
 * into the pricing screen, which is not a property of this branch. Replaying
 * the migrations asserts what the CODE ships: that the correcting migration is
 * present and does what it says. If someone re-adds the LED sentence in a new
 * migration, the replay carries it and this fails — which is the point.
 *
 * ── 🔑 WHY THIS EXISTS AS A TEST AND NOT A CHECK CONSTRAINT ────────────────
 * A CHECK cannot know whether the renderer has since been built, so it would
 * fight a legitimate future edit. The rule being enforced is "do not describe a
 * capability that does not exist YET" — a judgement with a date on it. When the
 * LED file can really be produced, the honest change is one line here, in a PR
 * that also contains the renderer.
 *
 * ── ⚠ SCOPE ───────────────────────────────────────────────────────────────
 * This is NOT a general prose linter. It pins the two specific promises that
 * were found false, plus the structural rule that the retired SKU stays
 * retired. A guard that tried to judge all marketing copy would cry wolf, and a
 * guard that cries wolf gets skimmed past on the one day it is right.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  // `ReplayResult` has no close() — the PGlite handle does. Matching the
  // convention in business-slug-mirror.db.test.ts.
  await db?.close();
});

async function row(code: string) {
  const res = await db.query<{ is_active: boolean; description: string | null }>(
    `SELECT is_active, description FROM public.platform_retail_catalog_v2 WHERE service_code = $1`,
    [code],
  );
  return res.rows[0] ?? null;
}

test('META: the catalog and both rows survive the replay', async () => {
  // Without this, every assertion below would pass vacuously on a missing row —
  // the same "an absence reads as a pass" shape that let the dead vendor gate
  // ship. Prove the subject exists before asserting anything about it.
  assert.ok(await row('ANIMATED_MONOGRAM'), 'ANIMATED_MONOGRAM is not in the replayed catalog.');
  assert.ok(await row('EVENT_SUBDOMAIN'), 'EVENT_SUBDOMAIN is not in the replayed catalog.');
});

test('the Custom Subdomain is off sale', async () => {
  const r = await row('EVENT_SUBDOMAIN');
  assert.equal(
    r!.is_active,
    false,
    'EVENT_SUBDOMAIN is on sale again. ₱999/year buys an address that resolves ' +
      'nowhere — there is no wildcard DNS and no subdomain-aware routing. Owner ' +
      'ruled it off sale 2026-08-10. Put it back on sale only in the PR that ' +
      'ships the provisioning.',
  );
});

test('the Animated Monogram stays on sale — only its LED claim went', async () => {
  const r = await row('ANIMATED_MONOGRAM');
  assert.equal(
    r!.is_active,
    true,
    'ANIMATED_MONOGRAM was deactivated. The monogram itself WORKS and was never ' +
      'the problem — only the LED sentence was false. Withdrawing a working ' +
      'product is not the fix.',
  );
});

test('no live SKU promises the LED stage screen while no file can be made', async () => {
  // ⚠ `ILIKE '%LED%'` WAS WRONG AND THIS COMMENT IS THE RECEIPT. The first cut
  // used it and flagged PATIKTOK_COMPILER, whose blurb says clips are
  // "compiLED into post-ready reels". Prod holds exactly ONE offending row, so
  // the guard was crying wolf on its very first run — the failure mode this
  // file's own docblock warns about. `~*` with `\y` word boundaries matches the
  // acronym and not the suffix of an ordinary English word.
  const res = await db.query<{ service_code: string; description: string }>(
    `SELECT service_code, description
       FROM public.platform_retail_catalog_v2
      WHERE is_active = TRUE
        AND description IS NOT NULL
        AND (description ~* '\\yLED\\y' OR description ILIKE '%Live Background%')`,
  );
  assert.deepEqual(
    res.rows.map((x) => x.service_code),
    [],
    'A live SKU description promises the LED stage screen or the Live Background. ' +
      'THE LED WALL BACKDROP WAS REMOVED FROM THE PRODUCT on 2026-08-11 (owner: ' +
      '"remove wall backdrop") — there is no maker, no route, no save endpoint and ' +
      'no renderer, so this is not a gap to be filled but a thing we do not sell. ' +
      'Either ship a real backdrop end-to-end in this PR, or do not sell the promise.',
  );
});

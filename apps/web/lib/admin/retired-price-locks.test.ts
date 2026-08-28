/**
 * A RETIRED PRICE CAN STILL BE LOAD-BEARING — AND NO DATABASE CHECK CAN SEE IT.
 *
 * The owner ruled 2026-08-28, of the 43 switched-off prices: "delete them."
 * Eight did not go, and the reason is a shape this codebase keeps re-finding:
 * application code reads a price by LITERAL STRING, with no `is_active` filter,
 * and substitutes a hardcoded constant when the row is missing. There is no
 * foreign key, so every database-only safety check calls the row free. Delete
 * it and no number moves — the fallback is identical — but the row was the only
 * handle the owner had on that price, and the figure freezes inside a deploy.
 *
 * 🚨 THE FIRST LIST WAS FOUND BY READING ONE MIGRATION'S DOCBLOCK, and
 * `pricing-removability.ts` said so itself: "a floor, not a ceiling ... only
 * this one family was ever vetted." Enumerating every
 * `from('platform_retail_catalog_v2')` CALL SITE instead of every code turned
 * up a second family with the identical shape — the four Papic camera-day
 * rates, two of which price a live buy surface and a real `orders` row.
 *
 * ── WHY THIS GUARD IS DERIVED AND NOT A LIST ─────────────────────────────────
 * A hand-written list of locked codes is a list of the codes somebody thought
 * of, which is exactly how the first sweep missed four. So the codes are
 * SCANNED out of the two modules that actually read them — `AI_TIER_SKU` and
 * the `PAPIC_CAMERA_*_SKU` constants — and the lock set must cover every one.
 * Add a fifth AI tier or a fifth camera rung without locking its row and this
 * fails.
 *
 * ⚠ IT READS SOURCE RATHER THAN IMPORTING. `pricing-removability.ts` starts
 * with `import 'server-only'`, which no node:test can load in this repo, and an
 * `@/lib/...` import under `tsx --test` can resolve to EMPTY NAMED EXPORTS —
 * which would make every assertion below loop over nothing and report a pass.
 * Every scan therefore carries its own non-zero anti-vacuity assertion.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = join(HERE, '..');
const MIGRATIONS = join(HERE, '../../../../supabase/migrations');

const read = (p: string) => readFileSync(p, 'utf8');

/** The migration that carried out the owner's "delete them". */
const DELETE_MIGRATION = 'the_catalogue_forgets_what_it_retired';

/** Codes `AI_TIER_SKU` names — the assisted-planner ladder, read past is_active. */
function aiLadderCodes(): string[] {
  const src = read(join(LIB, 'setnayan-ai-type-pricing.ts'));
  const block = /export const AI_TIER_SKU[^=]*=\s*\{([\s\S]*?)\};/.exec(src);
  assert.ok(block, 'AI_TIER_SKU block not found — the scan cannot see the ladder');
  return [...block[1]!.matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]!);
}

/** The per-camera-per-day rate SKUs `fetchCameraRates` reads past is_active. */
function cameraRateCodes(): string[] {
  const src = read(join(LIB, 'papic-cameras.ts'));
  const call = /fetchCameraRates[\s\S]*?\.in\('service_code',\s*\[([\s\S]*?)\]/.exec(src);
  assert.ok(call, 'the fetchCameraRates catalog read was not found — scan is blind');
  // The call names CONSTANTS, so resolve each back to its literal.
  const names = [...call[1]!.matchAll(/([A-Z0-9_]+_SKU)/g)].map((m) => m[1]!);
  return names.map((n) => {
    const lit = new RegExp(`export const ${n} = '([^']+)';`).exec(src);
    assert.ok(lit, `${n} has no string literal — cannot resolve the code it reads`);
    return lit[1]!;
  });
}

/** The codes `pricing-removability.ts` refuses to let the admin delete. */
function lockedCodes(): string[] {
  const src = read(join(LIB, 'admin/pricing-removability.ts'));
  const block = /KNOWN_CODE_LITERAL_DEPENDENCIES[^=]*=\s*new Set\(\[([\s\S]*?)\]\);/.exec(src);
  assert.ok(block, 'KNOWN_CODE_LITERAL_DEPENDENCIES not found');
  // Comments in that block quote code names too — take only quoted literals.
  const withoutComments = block[1]!.replace(/\/\/[^\n]*/g, '');
  return [...withoutComments.matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]!);
}

/** The codes the delete migration actually removes. */
function deletedCodes(): string[] {
  const file = readdirSync(MIGRATIONS).find((f) => f.includes(DELETE_MIGRATION));
  assert.ok(file, `no migration matching ${DELETE_MIGRATION}`);
  const src = read(join(MIGRATIONS, file));
  const block = /DELETE FROM public\.platform_retail_catalog_v2[\s\S]*?IN \(([\s\S]*?)\);/.exec(src);
  assert.ok(block, 'the catalogue DELETE list was not found in the migration');
  return [...block[1]!.matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]!);
}

test('the scans found something — none of these assertions is vacuous', () => {
  assert.ok(aiLadderCodes().length >= 4, 'AI ladder scan found nothing');
  assert.equal(cameraRateCodes().length, 4, 'camera-rate scan should find four rungs');
  assert.ok(lockedCodes().length >= 8, 'lock set scan found nothing');
  assert.ok(deletedCodes().length >= 30, 'migration delete-list scan found nothing');
});

test('every price the AI ladder reads by name is locked against deletion', () => {
  const locked = new Set(lockedCodes());
  // Tier A (SETNAYAN_AI) is ON SALE, so it is not a retired row and needs no
  // lock — the rule is about codes that are switched off AND still read.
  const retiredLadder = aiLadderCodes().filter((c) => c !== 'SETNAYAN_AI');
  assert.ok(retiredLadder.length > 0, 'no retired ladder tiers found — scan is blind');
  for (const code of retiredLadder) {
    assert.ok(locked.has(code), `${code} prices an event type but is not locked`);
  }
});

test('every camera rate fetchCameraRates reads by name is locked against deletion', () => {
  const locked = new Set(lockedCodes());
  for (const code of cameraRateCodes()) {
    assert.ok(locked.has(code), `${code} prices the camera picker but is not locked`);
  }
});

test('the migration deletes nothing that is locked', () => {
  const locked = new Set(lockedCodes());
  const overlap = deletedCodes().filter((c) => locked.has(c));
  assert.deepEqual(overlap, [], `the delete list removes locked codes: ${overlap.join(', ')}`);
});

test('the delete list and the locks together account for all 43 retired rows', () => {
  // 43 was the measured count in production on 2026-08-29. If a row is retired
  // later this number moves — and that is a decision worth making out loud
  // rather than a total drifting quietly.
  const deleted = deletedCodes();
  const locked = lockedCodes();
  assert.equal(new Set(deleted).size, deleted.length, 'the delete list repeats a code');
  assert.equal(new Set(locked).size, locked.length, 'the lock set repeats a code');
  assert.equal(
    deleted.length + locked.length,
    43,
    `expected 35 deleted + 8 locked = 43; got ${deleted.length} + ${locked.length}`,
  );
});

/**
 * "START FROM ONE OF YOUR CARDS" — the boundaries that make a copy safe.
 *
 * Source-scanned. `lib/vendor-card-copy.ts` opens with `import 'server-only'`
 * and cannot be imported here (this repo ships no `server-only` package —
 * Next aliases it at build time), which is exactly why the properties below are
 * asserted against the source. Every assertion is mutation-checked by
 * occurrence count.
 *
 * The four things a copy must never become:
 *   1. someone ELSE's card (owner scoping)
 *   2. a second claim on the original's HISTORY (bookings, record, address)
 *   3. an edit of the original (the maker posts no id, so it can only insert)
 *   4. a silent loss (the options that cannot come across are said out loud)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const COPY = join(ROOT, 'lib/vendor-card-copy.ts');
const PAGE = join(ROOT, 'app/vendor-dashboard/services/new/[category]/page.tsx');
const CANVAS = join(ROOT, 'app/vendor-dashboard/services/_components/canvas-maker.tsx');
const MANAGER = join(ROOT, 'app/vendor-dashboard/services/_components/services-manager.tsx');

/**
 * Strip comments FIRST — block comments before line comments.
 *
 * Every file below carries prose naming the very things these assertions hunt
 * ("bookings", "the Card Record", "never deleted"). Five guards in this repo
 * have already gone red on their own explanation.
 */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('the source card is read owner-scoped, on EVERY read', () => {
  const src = code(COPY);
  // Two reads name a service id from the URL: the card itself and its bundle
  // links. Both must also name the profile. RLS is a FLOOR, not a scope — this
  // repo has already shipped a read that leaned on a policy whose second
  // disjunct (`OR is_admin()`) made it wider than the caller.
  assert.equal(
    [...src.matchAll(/\.eq\('vendor_profile_id', vendorProfileId\)/g)].length,
    2,
    'both the card read and the links read must filter on the vendor profile',
  );
  // A malformed id must not reach the database as a query at all.
  assert.match(src, /test\(sourceServiceId\)/, 'the id is shape-checked before use');
  // Supabase does not throw. A refused read must land on the same branch as a
  // missing card, not fall through with `data` undefined.
  assert.match(src, /if \(error \|\| !data\) return null;/);
});

test('a copy carries what was AUTHORED and nothing the card EARNED', () => {
  const src = code(COPY);
  const select = src.match(/\.select\(\s*'([^']+)'/);
  assert.ok(select, 'expected a single-quoted column list on the card read');
  const cols = select[1].split(',').map((c) => c.trim());

  // The card's identity and its history are not authored content. `public_id`
  // is the card's permanent address; `is_active` is whether the ORIGINAL is
  // live. Copying either would make the new card a claim on the old one.
  for (const forbidden of ['public_id', 'is_active', 'created_at', 'updated_at']) {
    assert.ok(
      !cols.includes(forbidden),
      `the copy must not read ${forbidden} — it belongs to the original card`,
    );
  }
  // And it must never go looking for the original's work.
  for (const table of ['event_vendors', 'vendor_reviews', 'service_card_records']) {
    assert.ok(
      !src.includes(table),
      `a copy must not touch ${table} — the original keeps everything it has done`,
    );
  }
  // What it MUST carry: the money, or a copy is a blank card wearing a name.
  for (const required of ['starting_price_php', 'pricing_basis', 'exclusive_perk_text']) {
    assert.ok(cols.includes(required), `the copy must carry ${required}`);
  }
});

test('media is REFERENCED, never moved, copied or deleted', () => {
  const src = code(COPY);
  // Two cards naming one object is the normal state after this feature, so the
  // copy path must not touch object storage at all — and a future delete path
  // has to check for other referents before sweeping.
  for (const verb of ['deleteObject', 'copyObject', 'putObject', 'uploadTo', 'DeleteObject']) {
    assert.ok(!src.includes(verb), `the copy path must not ${verb} — it only references keys`);
  }
  // A stored ref is not a URL: an `r2://` value in an <img> fails SILENTLY.
  assert.match(src, /displayUrlForStoredAsset/, 'refs must be resolved for display');
});

test('the maker can only INSERT — the original cannot be edited through it', () => {
  const canvas = code(CANVAS);
  // No service id on the wire ⇒ `commitVendorService` has nothing to update.
  // This is what makes "the copy is a new card" true by construction rather
  // than by anybody remembering it.
  assert.doesNotMatch(
    canvas,
    /name="vendor_service_id"/,
    'the maker must never post a service id, or a copy could overwrite its source',
  );
});

test('the copy discloses what it could NOT bring across', () => {
  const canvas = readFileSync(CANVAS, 'utf8');
  // The ★ Customization options live in a one-service package with no link back
  // to the card. A copy that drops them silently is a card published missing
  // the choices it sells, and the vendor finds out from a couple.
  assert.match(
    canvas,
    /don’t come across yet/,
    'the maker must say that the customization options were not copied',
  );
  assert.match(canvas, /keeps its bookings/, 'and that the original is untouched');
});

test('the doorway and the parameter are gated on the SAME flag as the maker', () => {
  // Only the canvas can open pre-filled; the 6-step wizard takes no defaults.
  // A link that renders while the flag is off would look like a feature and do
  // nothing — the "fake door" this project has already shipped twice.
  const manager = code(MANAGER);
  assert.match(manager, /const canvasMaker = canvasMakerEnabled\(\);/);
  assert.equal(
    [...manager.matchAll(/\{canvasMaker \? \(/g)].length,
    1,
    'exactly one flag-gated doorway',
  );
  assert.match(manager, /services\/new\/\$\{svc\.category\}\?from=\$\{svc\.vendor_service_id\}/);

  const page = code(PAGE);
  assert.match(
    page,
    /canvas && typeof from === 'string' && from\.length > 0/,
    'the ?from= parameter must be ignored entirely while the maker flag is off',
  );
});

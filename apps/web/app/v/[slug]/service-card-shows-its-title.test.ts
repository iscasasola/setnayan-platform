/**
 * service-card-shows-its-title.test.ts
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 * `toServiceCard` — the function that builds the card `ServicesGallery`
 * actually renders on a shop's public page — computed its `label` as
 *
 *   isCanonicalService(row.category) ? VENDOR_CATEGORY_LABEL[row.category] : row.category
 *
 * which never once read `row.title`. A vendor can name a card in the maker
 * (and the maker now writes a kind-derived default even when they leave it
 * blank), but every published card showed the bare category instead — the
 * one couple-visible field the whole maker exists to author was silently
 * dropped between "Publish" and the shop page.
 *
 * The SAME file already had the correct fallback in a sibling helper
 * (`serviceLabel`, used for the inquiry composer) — a second, independently
 * wrong copy of "how to label a service" is exactly how this drifts again.
 *
 * A second, narrower defect rode along in the same lines: for a CUSTOM
 * (non-canonical) category, the `: row.category` branch printed the raw
 * stored key, the exact "never print a database key at a couple" bug
 * `displayServiceLabel` (lib/vendors.ts) was written to close — on the
 * couple-facing card, the inquiry composer's "linked services" chips, and
 * the public JSON-LD Google reads.
 *
 * ── WHAT THIS GUARDS ─────────────────────────────────────────────────────
 * Every couple-facing label site in this page must read the vendor's own
 * title first (where the field exists) and must route any category
 * fallback through `displayServiceLabel` — never a raw ternary that hands
 * back the stored key for a non-canonical category.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8'),
);

test('the card the gallery renders reads the vendor-authored title first', () => {
  assert.match(
    src,
    /const label = row\.title\?\.trim\(\) \|\| displayServiceLabel\(row\.category\);/,
    'toServiceCard must prefer row.title over the bare category label',
  );
});

test('the inquiry-composer label helper prefers the title the same way', () => {
  assert.match(
    src,
    /const serviceLabel = \(s: VendorServiceRow\): string =>\s*\n\s*s\.title\?\.trim\(\) \|\| displayServiceLabel\(s\.category\);/,
    'serviceLabel must prefer s.title over the bare category label',
  );
});

test('no couple-facing label falls back to a raw category key instead of displayServiceLabel', () => {
  // The regression shape: `isCanonicalService(x) ? displayServiceLabel(x) : x`
  // (or the VENDOR_CATEGORY_LABEL[x] equivalent) hands back the raw stored
  // key for exactly the custom-category case displayServiceLabel exists to
  // humanize. A caller that has already imported displayServiceLabel has no
  // reason to reach for the raw value instead.
  assert.doesNotMatch(
    src,
    /isCanonicalService\([^)]+\)\s*\?\s*displayServiceLabel\([^)]+\)\s*:/,
    'a label must not gate displayServiceLabel behind isCanonicalService — call it unconditionally',
  );
});

test('the static category map is no longer imported for card labels', () => {
  // VENDOR_CATEGORY_LABEL is the raw, comment-carrying map displayServiceLabel
  // wraps. Importing it directly into this page is how the bypass creeps back
  // in — the fix removed the import entirely.
  assert.doesNotMatch(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8'),
    /VENDOR_CATEGORY_LABEL/,
    'label logic should go through displayServiceLabel, not the raw map',
  );
});

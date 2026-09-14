import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { serviceGroupOf, SERVICE_GROUPS } from '@/lib/vendors';
import { eventVendorCategoryForCardKind } from '@/lib/event-vendor-category';

/**
 * SUP-12 + SUP-14 · the two joins the shop page was missing.
 *
 * The first three tests are BEHAVIOURAL — they run the real translator and the
 * real grouping function over the kinds production actually stores, so they
 * would fail if the taxonomy stopped resolving them, not merely if this page
 * stopped calling it. The rest pin the page to using that answer.
 */

const WEB = process.cwd();
const PAGE = join(WEB, 'app/v/[slug]/page.tsx');

function code(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const stripped = stripComments(raw);
  assert.ok(stripped.length > raw.length * 0.15, `stripping ${path} removed too much`);
  return stripped;
}

const headingFor = (kind: string): string | undefined => {
  const coarse = eventVendorCategoryForCardKind(kind, null);
  const key = serviceGroupOf(coarse);
  return SERVICE_GROUPS.find((g) => g.key === key)?.label;
};

test('the two kinds live in production leave "Other" for their real trade', () => {
  // Measured on the published shop 2026-09-15: both cards sat under "Other"
  // while the same page listed "Live Band · Host / MC" two sections above.
  assert.equal(headingFor('live_band'), 'Media & entertainment');
  assert.equal(headingFor('host_mc'), 'Media & entertainment');
});

test('a kind the coarse vocabulary already knows is NOT re-derived', () => {
  // `photographer` was never broken; this row must not move it.
  assert.equal(headingFor('photographer'), headingFor('photographer'));
  assert.equal(eventVendorCategoryForCardKind('photographer', null), 'photographer');
});

test('NO CARD DISAPPEARS — every kind lands in a real section', () => {
  // The clause this row is written around. The old code's `: 'other'` was what
  // prevented it; now the translator's `misc` rung must carry it, because
  // serviceGroupOf returns UNDEFINED for anything outside the coarse list and
  // no SERVICE_GROUPS entry has that key.
  for (const kind of ['live_band', 'host_mc', 'photographer', 'caterer', 'not_a_real_kind', '']) {
    const heading = headingFor(kind);
    assert.ok(
      heading,
      `"${kind}" resolved to no section at all — its cards would vanish from the page`,
    );
  }
});

test('the page asks the translator, and groups by its answer', () => {
  const src = code(PAGE);
  assert.match(
    src,
    /const coarse = eventVendorCategoryForCardKind\(\s*s\.category,/,
    'the grouping no longer routes the stored kind through the translator',
  );
  assert.match(src, /const key: ServiceGroupKey = serviceGroupOf\(coarse\)/);
  // The shape that produced the bug: a canonical-only test with an `other` arm.
  assert.doesNotMatch(
    src,
    /isCanonicalService\(s\.category\)/,
    'the canonical-only ternary is back; every non-coarse kind falls to Other again',
  );
});

test('the cover photo is RESOLVED and PASSED — the argument the call was short of', () => {
  const src = code(PAGE);
  assert.match(
    src,
    /displayUrlForStoredAsset\(s\.primary_photo_r2_key\)/,
    'the stored cover ref is never turned into a display URL',
  );
  // toServiceCard takes it LAST; passing nothing renders exactly as before, so
  // presence at the call site is the whole fix.
  assert.match(
    src,
    /coverUrlByService\.get\(row\.vendor_service_id\) \?\? null,\s*\),/,
    'the resolved cover is not handed to toServiceCard',
  );
});

test('the cover never displaces a real showcase gallery', () => {
  // toServiceCard only reaches for the cover when showcase photos are empty.
  // This pins that the page does not pre-empt that decision by merging them.
  const src = code(PAGE);
  assert.doesNotMatch(
    src,
    /showcase\w*\.photos\.push|\.\.\.showcase\w*\.photos,\s*cover/,
    'the page is merging cover into the showcase strip instead of letting the card decide',
  );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADD_ONS, appStoreDetailHref } from './add-ons-catalog';
import { ADD_ON_DETAILS, addOnDetail } from './add-ons-detail';

// The Studio hub renders the four visible sections (Setnayan AI · Website ·
// Capture · Branding). Every available feature in those sections links to its
// App Store detail page at /studio/about/<key> — EXCEPT Panood, which has its
// own bespoke detail surface. This guard fails the build if a hub row would
// point at a detail page that has no authored content (a 404 for the couple).
const VISIBLE_GROUPS = new Set(['setnayan_ai', 'website', 'capture', 'branding']);

// Hub features that open their OWN surface directly instead of a
// /studio/about/<key> detail page — so they need no authored detail content and
// their detail href intentionally does NOT route under /studio/about:
//   • panood / supplies-marketplace — bespoke feature surfaces
//   • seating — opens the seat-plan editor
//   • rsvp / event / editorial / landing-page — the website parts open the
//     full-screen site editor (the four-part split, 2026-06-21). Save the Date
//     is NOT here: it keeps its /studio/about detail page.
const OPENS_OWN_SURFACE = new Set([
  'panood',
  'supplies-marketplace',
  'seating',
  'rsvp',
  'event',
  'editorial',
  'landing-page',
]);

test('every available hub feature has App Store detail content', () => {
  const missing = ADD_ONS.filter(
    (a) =>
      VISIBLE_GROUPS.has(a.studioGroup) &&
      a.status !== 'coming_soon' &&
      !OPENS_OWN_SURFACE.has(a.key) &&
      !addOnDetail(a.key),
  ).map((a) => a.key);
  assert.deepEqual(missing, [], `add-ons missing detail content: ${missing.join(', ')}`);
});

test('detail entries are well-formed and not Panood', () => {
  for (const [key, d] of Object.entries(ADD_ON_DETAILS)) {
    assert.notEqual(key, 'panood', 'Panood owns its own detail page — remove it from ADD_ON_DETAILS');
    assert.ok(d.eyebrow && d.heroTitle && d.tagline, `${key}: missing hero fields`);
    assert.ok(d.paragraphs.length > 0, `${key}: needs at least one About paragraph`);
    assert.ok(d.highlights.length > 0, `${key}: needs at least one highlight`);
    assert.ok(d.preview.length > 0, `${key}: needs at least one preview frame`);
  }
});

test('detail links route under /studio/about (never shadowed by a feature folder)', () => {
  // A literal /studio/<key>/about is SHADOWED by the feature's own static
  // /studio/<key> folder — in Next.js a literal path segment beats the [addon]
  // dynamic sibling and routing does not backtrack, so /studio/papic/about 404s.
  // The detail route therefore lives under the literal /studio/about/<key>
  // segment, which no feature key can shadow. This guard fails the build if a
  // detail href ever regresses to the shadowed shape. The OPENS_OWN_SURFACE
  // features (Panood + supplies + seating + the website parts) link to their
  // own surfaces, not an /about page (see appStoreDetailHref).
  const eventId = 'EVT';
  const offenders = ADD_ONS.filter((a) => !OPENS_OWN_SURFACE.has(a.key))
    .map((a) => appStoreDetailHref(a.key, eventId))
    .filter((href) => !href.includes('/studio/about/'));
  assert.deepEqual(
    offenders,
    [],
    `detail hrefs not under /studio/about (would be shadowed → 404): ${offenders.join(', ')}`,
  );
});

test('no detail key is orphaned from the catalog', () => {
  const keys = new Set(ADD_ONS.map((a) => a.key));
  const orphans = Object.keys(ADD_ON_DETAILS).filter((k) => !keys.has(k));
  assert.deepEqual(orphans, [], `detail keys not in catalog: ${orphans.join(', ')}`);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADD_ONS } from './add-ons-catalog';
import { ADD_ON_DETAILS, addOnDetail } from './add-ons-detail';

// The Studio hub renders the four visible sections (Setnayan AI · Website ·
// Capture · Branding). Every available feature in those sections links to its
// App Store detail page at /add-ons/<key>/about — EXCEPT Panood, which has its
// own bespoke detail surface. This guard fails the build if a hub row would
// point at a detail page that has no authored content (a 404 for the couple).
const VISIBLE_GROUPS = new Set(['setnayan_ai', 'website', 'capture', 'branding']);

test('every available hub feature has App Store detail content', () => {
  const missing = ADD_ONS.filter(
    (a) =>
      VISIBLE_GROUPS.has(a.studioGroup) &&
      a.status !== 'coming_soon' &&
      a.key !== 'panood' &&
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

test('no detail key is orphaned from the catalog', () => {
  const keys = new Set(ADD_ONS.map((a) => a.key));
  const orphans = Object.keys(ADD_ON_DETAILS).filter((k) => !keys.has(k));
  assert.deepEqual(orphans, [], `detail keys not in catalog: ${orphans.join(', ')}`);
});

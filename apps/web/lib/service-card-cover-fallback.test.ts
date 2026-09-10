/**
 * C2 (2026-09-11): a card with a cover photo shows it on the main marketplace
 * grid, even when it has no showcase gallery.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 * `app/(shell)/explore/page.tsx`'s landing grid called `toServiceCard` with
 * `showcase: undefined` on every card — it never resolved showcase photos for
 * this view at all — and `toServiceCard` had no fallback to the card's own
 * cover (`primary_photo_r2_key`, required to publish). So the couple's FIRST
 * impression of the marketplace was a grid of cards with nothing to look at,
 * even though every published card carries a cover.
 *
 * `toServiceCard` stays a PURE function (no React, no I/O) — it cannot sign
 * or resolve the r2 ref itself, so the caller resolves the cover to a display
 * URL and hands it in as the new, optional last argument. These tests pin the
 * fallback RULE inside the pure builder: real showcase photos always win; an
 * empty showcase still falls back to the cover; no cover and no showcase
 * still renders an empty gallery (never a broken reference).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { toServiceCard } from '@/lib/service-card-view-model';
import type { VendorServiceRow } from '@/lib/vendor-services';

const BASE_ROW: VendorServiceRow = {
  vendor_service_id: 'svc-1',
  public_id: 'S89V-0000000001',
  vendor_profile_id: 'vendor-1',
  category: 'live_band',
  title: 'Live Band',
  starting_price_php: 35000,
  added_pax_price_php: null,
  pricing_basis: 'fixed',
  per_pax_price_php: null,
  min_pax: null,
  hour_base_php: null,
  min_hours: null,
  extra_hour_php: null,
  crew_size: null,
  crew_meal_required: false,
  crew_meal_included: true,
  transport_included: true,
  transport_flat_fee_php: null,
  primary_photo_r2_key: 'r2://setnayan-media/cover.jpg',
  showcase_video_r2_key: null,
  showcase_photo_r2_keys: [],
  is_active: true,
  branch_id: null,
  recommended_lead_time_months: null,
  last_minute_end_months: null,
  last_minute_surcharge_pct: null,
  daily_capacity: null,
  exclusive_perk_text: null,
  includes_setnayan_gift: null,
  base_pax: null,
  coverage_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function build(showcase: { photos: string[]; videoUrl: string | null } | undefined, coverPhotoUrl?: string | null) {
  return toServiceCard(
    BASE_ROW,
    undefined,
    undefined,
    undefined,
    showcase,
    false,
    null,
    new Date('2026-09-11T00:00:00Z'),
    null,
    null,
    false,
    coverPhotoUrl,
  );
}

test('no showcase photos + a cover URL → the cover fills the card', () => {
  const card = build(undefined, 'https://media.setnayan.com/cover.jpg');
  assert.deepEqual(card.photos, ['https://media.setnayan.com/cover.jpg']);
});

test('an EMPTY showcase array (not just undefined) still falls back to the cover', () => {
  // A card given no gallery is not a card that opted out of a picture.
  const card = build({ photos: [], videoUrl: null }, 'https://media.setnayan.com/cover.jpg');
  assert.deepEqual(card.photos, ['https://media.setnayan.com/cover.jpg']);
});

test('real showcase photos always win over the cover', () => {
  const card = build(
    { photos: ['https://media.setnayan.com/gallery-1.jpg'], videoUrl: null },
    'https://media.setnayan.com/cover.jpg',
  );
  assert.deepEqual(card.photos, ['https://media.setnayan.com/gallery-1.jpg']);
});

test('no showcase and no cover URL → an empty gallery, never a broken reference', () => {
  const card = build(undefined, null);
  assert.deepEqual(card.photos, []);
});

test('a caller that never passes coverPhotoUrl (the existing two call sites) is unchanged', () => {
  // services-manager.tsx and app/v/[slug]/page.tsx (D2 owns that file) don't
  // pass the new argument at all — must render byte-identical to before.
  const card = toServiceCard(
    BASE_ROW,
    undefined,
    undefined,
    undefined,
    undefined,
    false,
    null,
    new Date('2026-09-11T00:00:00Z'),
    null,
    null,
    false,
  );
  assert.deepEqual(card.photos, []);
});

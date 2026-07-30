/**
 * Guard suite for the Studio add-ons' event-type SURFACE tagging (2026-06-28).
 * The `surface` field gates wedding-only tools out of non-wedding Studio hubs
 * (studio/page.tsx filters by surfaceEnabled). This locks the intended mapping so
 * a wedding-only tool can't silently become universal (or vice-versa).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADD_ONS } from './add-ons-catalog';
import { ADD_ON_SKU_MAP } from './add-on-stats';

const byKey = new Map(ADD_ONS.map((a) => [a.key, a] as const));

// ── Unified Live Studio: no dead buy buttons for the retired SKUs (2026-07-25) ──

test('no Studio tile sells the retired LIVE_STUDIO_ROAM SKU (no dead buy button)', () => {
  // LIVE_STUDIO_ROAM is is_active=false (retired into LIVE_STUDIO). If any tile still
  // carried it as serviceKey, its buy drawer would 500-reject at checkout
  // (resolveServiceSellability → 'retired'). The unified tile must sell LIVE_STUDIO.
  for (const a of ADD_ONS) {
    assert.notEqual(
      a.serviceKey,
      'LIVE_STUDIO_ROAM',
      `add-on "${a.key}" must not sell the retired Roam SKU`,
    );
  }
});

test('the Live Studio feature resolves ownership against the active LIVE_STUDIO SKU', () => {
  // Ownership/stats/launch-state read orders by these service_keys. After the
  // merge the feature must grant on LIVE_STUDIO; the retired LIVE_STUDIO_ROAM stays
  // so any historical order still flips the card to 'launch'.
  const skus = ADD_ON_SKU_MAP['live-studio-roam'] ?? [];
  assert.ok(skus.includes('LIVE_STUDIO'), 'live-studio feature must grant on LIVE_STUDIO');
});

test('wedding-surface add-ons carry the right surface', () => {
  const expected: Record<string, string> = {
    'save-the-date': 'save_the_date',
    rsvp: 'rsvp',
    event: 'website',
    editorial: 'website',
    'landing-page': 'website',
    'animated-monogram': 'monogram',
    // Papic Buong Araw (PAPIC_GUEST) — the flat guest-camera pass needs a guest
    // ROSTER, so it hides wherever the type has no RSVP surface (simple_event).
    // NOTE: `surface` alone does NOT deny travel (its profile enables rsvp) —
    // lib/papic-event-access.ts carries that deny.
    'papic-guest': 'rsvp',
  };
  for (const [key, surface] of Object.entries(expected)) {
    const entry = byKey.get(key);
    assert.ok(entry, `add-on "${key}" should exist`);
    assert.equal(entry!.surface, surface, `${key} surface`);
  }
});

test('universal in-app services carry NO surface (shown for every event type)', () => {
  // A representative set of non-wedding-gated services — they must stay universal.
  for (const key of ['setnayan-ai', 'papic', 'panood', 'pakanta', 'mood-board', 'seating']) {
    const entry = byKey.get(key);
    if (!entry) continue; // tolerate catalog churn — only assert when present
    assert.equal(entry.surface, undefined, `${key} must stay universal (no surface)`);
  }
});

test('Papic Pool is LIVE, and sells shots rather than per-guest cameras', () => {
  // Flipped 2026-07-30, in the same PR as the status — as the previous version of
  // this test instructed. Its two economic gates are closed: 0b (the repricing off
  // the pax curve) and 0c (the event-scoped points pool, shipped 20271019231590 +
  // #3847/#3848). Verified against prod: PAPIC_GUEST ₱1,000 · _6K ₱2,000 ·
  // _10K ₱3,000 all is_active; the pax-priced ₱2,999 row is _TOPUP, now inactive.
  //
  // ⚠ 0d/0e (guest-media ROPA row + DPO sign-off on the RSVP consent text) remain
  // OPEN and are tracked as their own compliance item. They are deliberately NOT
  // asserted here: the sale they gate went live 2026-07-29 through the studio and
  // the guest buy sheet, so pinning this ONE card dark would have recorded a
  // closed gate that isn't closed anywhere else.
  const entry = byKey.get('papic-guest');
  assert.ok(entry, 'papic-guest add-on should exist (the doorway is gate 0h)');
  assert.notEqual(entry!.status, 'coming_soon', 'Papic Pool is on sale — no "Soon" pill');
  assert.equal(entry!.serviceKey, 'PAPIC_GUEST');
  // The copy must not re-import the retired pax model. The pool meters SHOTS, so
  // a per-guest / per-day / roster promise is false by construction — this is the
  // sentence that was wrong ("every guest on the list gets a camera, all day").
  for (const re of [/every guest/i, /all day/i, /per guest/i, /on the list/i, /\bseats?\b/i]) {
    assert.equal(
      re.test(entry!.blurb),
      false,
      `Papic Pool blurb carries retired pax-pass language (${re}): "${entry!.blurb}"`,
    );
  }
  // …and it must not spell a shot count or a peso figure: both are derived on the
  // surface the card opens (papic_pass_tiers + the live catalog).
  assert.equal(/₱|\d{2,}/.test(entry!.blurb), false, 'no price/points literal in the blurb');
  assert.equal(entry!.tags?.includes('Soon'), false, 'the "Soon" tag must go with the pill');
});

test('the umbrella Papic card points at NO single SKU', () => {
  // PAPIC_SEATS (₱2,999, five seats) is is_active=false with zero orders ever, and
  // the two-type lock retired the product. A dead serviceKey here made the card
  // `isRecommendable()` on the Studio hub — a coordinator could recommend a SKU
  // nobody can buy. Papic is two products across five active rows now; its own
  // surface owns the buy, which is what `variablePricing` declares.
  const entry = byKey.get('papic');
  assert.ok(entry, 'papic add-on should exist');
  assert.equal(entry!.serviceKey, undefined, 'Papic has no single representative SKU');
  assert.equal(entry!.variablePricing, true, 'per-unit pricing must stay declared');
});

test('every surface value is a known ProfileSurface', () => {
  const valid = new Set(['website', 'save_the_date', 'rsvp', 'seating', 'budget', 'schedule', 'monogram', 'day_of', 'gallery']);
  for (const a of ADD_ONS) {
    if (a.surface !== undefined) {
      assert.ok(valid.has(a.surface), `${a.key}: "${a.surface}" is not a ProfileSurface`);
    }
  }
});

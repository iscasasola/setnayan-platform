/**
 * BRAND YOUR BOOTH AT ONE WEDDING — the ₱500 per-event 3D Booth.
 *
 * Owner 2026-09-05: "500 per event. or 3000/4 week cycle." and "unverified
 * vendors cannot purchase here and free. only paid vendors (solo, pro and
 * enterprise)".
 *
 * ── WHAT THIS PINS ──────────────────────────────────────────────────────────
 * 1 · The decision is an OR of two halves, and both render paths read it
 *     through the ONE boolean `boothAddonActive` (lib/seating.ts fetchBooths →
 *     lib/seating-3d.ts boothIsBranded). The couple's lab and the public walk
 *     can never disagree about who is branded.
 * 2 · The per-event half is read through the SECURITY DEFINER RPC, never a
 *     direct `orders` select: `orders_owner_read` is `user_id = auth.uid()`, so
 *     a direct read under the couple's session returns [] — and an empty set
 *     renders exactly like "nobody paid". That is the disease this codebase
 *     keeps paying for, and the RPC is the cure. The RPC is service_role-ONLY
 *     (the exposure-freeze guard refused an `authenticated` grant), so every
 *     caller of fetchBooths that holds a SESSION client must hand it the admin
 *     client as `brandedReader` — or the refusal renders as "nobody paid".
 * 3 · The purchase carries EVERY gate the cycle has, plus booked-on-this-event,
 *     and scopes the order to the event. An order minted with eventId: null
 *     would be a per-event product with no event.
 * 4 · One FALLBACK + one SKU_CODE in the pricing module, so the
 *     fallback-prices-match-the-catalog db test can pair them.
 * 5 · The section stands in the retired unlock section's slot, booked-only.
 * 6 · The migration seeds the row as `vendor_addon_per_event` — an EXISTING
 *     vocabulary value (no re-listed CHECK) — and the RPC is scoped.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  boothBrandedAtEvent,
  boothEventOrderState,
  VENDOR_3D_BOOTH_EVENT_SKU_CODE,
  VENDOR_3D_BOOTH_EVENT_FALLBACK_PHP,
  EVENT_BRANDED_BOOTH_VENDOR_IDS_RPC,
} from './vendor-3d-booth-event-pricing';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));
const ACTION = 'app/vendor-dashboard/clients/[eventId]/booth-event-actions.ts';
const SECTION = 'app/vendor-dashboard/clients/[eventId]/_components/booth-event-section.tsx';
const PAGE = 'app/vendor-dashboard/clients/[eventId]/page.tsx';

test('branded = cycle OR per-event order — the full truth table', () => {
  assert.equal(boothBrandedAtEvent({ cycleActive: false, eventOrderActive: false }), false);
  assert.equal(boothBrandedAtEvent({ cycleActive: true, eventOrderActive: false }), true);
  assert.equal(boothBrandedAtEvent({ cycleActive: false, eventOrderActive: true }), true);
  assert.equal(boothBrandedAtEvent({ cycleActive: true, eventOrderActive: true }), true);
});

test('order state: active beats pending; anything else is none', () => {
  assert.equal(boothEventOrderState([]), 'none');
  assert.equal(boothEventOrderState(['submitted']), 'pending');
  assert.equal(boothEventOrderState(['submitted', 'paid']), 'active');
  assert.equal(boothEventOrderState(['fulfilled']), 'active');
  assert.equal(boothEventOrderState(['cancelled', null, 'lapsed']), 'none');
});

test('fetchBooths resolves BOTH halves into the one boolean, via the RPC', () => {
  const src = read('lib/seating.ts');
  assert.ok(src.includes('fetchEventBrandedBoothVendorIds(opts.brandedReader ?? supabase, eventId)'), 'reads the per-event set once, through the privileged reader when given');
  assert.ok(
    /boothAddonActive:\s*boothBrandedAtEvent\(\{/.test(src),
    'boothAddonActive must be the OR resolver, not the cycle alone',
  );
  assert.ok(src.includes('cycleActive: isVendor3dBoothActive('), 'cycle half still present');
  assert.ok(src.includes('brandedHere.has(ev.marketplace_vendor_id)'), 'per-event half keyed on the marketplace vendor');
  // Never a direct orders read here — see pin 2.
  assert.ok(!/from\('orders'\)/.test(src), 'lib/seating.ts must not select orders directly');
});

test('the per-event read goes through the SECURITY DEFINER RPC', () => {
  const src = read('lib/vendor-3d-booth-event-pricing.ts');
  assert.equal(EVENT_BRANDED_BOOTH_VENDOR_IDS_RPC, 'event_branded_booth_vendor_ids');
  assert.ok(src.includes('.rpc(EVENT_BRANDED_BOOTH_VENDOR_IDS_RPC'), 'fetchEventBrandedBoothVendorIds calls the RPC');
  // The refusal is loud, not silent: an error must be logged before degrading.
  const fn = src.slice(src.indexOf('export async function fetchEventBrandedBoothVendorIds'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 3);
  assert.ok(body.includes('console.error('), 'a refused read must be logged, never rendered as "nobody paid" in silence');
});

test('the migration seeds the SKU with an EXISTING vocabulary value and a scoped RPC', () => {
  const dir = join(ROOT, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_vendor_3d_booth_per_event_sku.sql'));
  assert.ok(file, 'migration present');
  const sql = readFileSync(join(dir, file!), 'utf8');
  assert.ok(sql.includes(`('${VENDOR_3D_BOOTH_EVENT_SKU_CODE}', `), 'seeds the SKU row');
  assert.ok(sql.includes("'vendor_addon_per_event'"), 'uses the shipped per-event offering_type');
  assert.ok(!/ADD CONSTRAINT .*offering_type/i.test(sql), 'must NOT re-list the offering_type CHECK');
  assert.ok(/CREATE OR REPLACE FUNCTION public\.event_branded_booth_vendor_ids/.test(sql), 'the RPC');
  assert.ok(/SECURITY DEFINER/.test(sql), 'definer');
  assert.ok(/current_event_ids\(\)/.test(sql) && /is_admin\(\)/.test(sql), 'belt-and-braces scope stays in the body');
  assert.ok(
    /REVOKE ALL ON FUNCTION public\.event_branded_booth_vendor_ids\(UUID\) FROM PUBLIC, anon, authenticated;/.test(sql),
    'anon AND authenticated revoked — the browser must not reach this at /rest/v1/rpc/',
  );
  assert.ok(
    /GRANT EXECUTE ON FUNCTION public\.event_branded_booth_vendor_ids\(UUID\) TO service_role;/.test(sql),
    'service_role only, the vendor_papic_challenge_entitled precedent',
  );
  assert.ok(!/TO authenticated/.test(sql), 'no grant to authenticated anywhere in the file');
  assert.ok(/price_php intentionally NOT overwritten/.test(sql), 'admin-managed price');
});

test('one FALLBACK and one SKU_CODE in the pricing module — the db test can pair them', () => {
  const src = readFileSync(join(ROOT, 'lib/vendor-3d-booth-event-pricing.ts'), 'utf8');
  const fallbacks = src.match(/^export const [A-Z0-9_]*FALLBACK_PHP = \d+;/gm) ?? [];
  const skus = src.match(/^export const [A-Z0-9_]*SKU_CODE = '[a-z0-9_]+';/gm) ?? [];
  assert.equal(fallbacks.length, 1, 'exactly one fallback');
  assert.equal(skus.length, 1, 'exactly one sku code');
  assert.equal(VENDOR_3D_BOOTH_EVENT_FALLBACK_PHP, 500);
  assert.equal(VENDOR_3D_BOOTH_EVENT_SKU_CODE, 'vendor_3d_booth_event');
});

test('every session-client caller of fetchBooths hands over the admin reader', () => {
  // The RPC is service_role-only. A session client is refused (42501), which
  // fetchEventBrandedBoothVendorIds turns into an empty set — logged, but an
  // empty set still draws every booth generic. So each caller that reads with
  // the couple's session MUST pass the admin client for that one read. Derived
  // from the tree, not a hand list: every fetchBooths( call site is classified.
  const walk = (dir: string): string[] =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(join(dir, d.name)) : /\.(ts|tsx)$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [],
    );
  const files = [...walk('app'), ...walk('lib')];
  const callers: { file: string; call: string }[] = [];
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/fetchBooths\(([^)]*)\)/g)) {
      if (f.endsWith('lib/seating.ts')) continue; // the definition
      callers.push({ file: f, call: m[0] });
    }
  }
  assert.ok(callers.length >= 4, `expected the four shipped callers, found ${callers.length}`);
  const unsafe = callers.filter(
    (c) => !/^fetchBooths\(admin,/.test(c.call) && !/brandedReader:\s*createAdminClient\(\)/.test(c.call),
  );
  assert.deepEqual(
    unsafe.map((c) => `${c.file}: ${c.call}`),
    [],
    'a fetchBooths caller reads with a session client and passes no brandedReader — its per-event branding renders as absent',
  );
  // fetchBooths itself must USE the reader, not merely accept it.
  const seating = read('lib/seating.ts');
  assert.ok(seating.includes('fetchEventBrandedBoothVendorIds(opts.brandedReader ?? supabase, eventId)'), 'the reader is what performs the RPC');
});

test('the purchase carries every gate, in order, and scopes the order to the event', () => {
  const src = read(ACTION);
  const i = (s: string) => {
    const at = src.indexOf(s);
    assert.notEqual(at, -1, `missing: ${s}`);
    return at;
  };
  const own = i('fetchOwnVendorProfile(supabase, user.id)');
  const manage = i('canManageVendor(role)');
  const flag = i('seating3dEnabled()');
  const booked = i("rpc('get_vendor_event_brief'");
  const floor = i('isTierAtLeast(gate?.tier_state ?? null, BOOTH_BRANDING_MIN_TIER)');
  const verified = i("verification_state !== 'verified'");
  const price = i('fetchVendor3dBoothEventPricePhp(supabase)');
  const dup = i('fetchVendorBoothEventOrderState(admin, vendorProfileId, eventId)');
  const mint = i("from('orders')");
  assert.ok(own < manage && manage < flag && flag < booked && booked < floor && floor < verified && verified < price && price < dup && dup < mint, 'gates precede the mint, in the documented order');

  // The scope that IS the product.
  assert.ok(src.includes('{ userId: user.id, eventId, vendorProfileId }'), 'the order is minted WITH the eventId');
  assert.ok(!src.includes('eventId: null'), 'never an event-less per-event order');
  assert.ok(src.includes('service_key: VENDOR_3D_BOOTH_EVENT_SKU_CODE'), 'the per-event SKU, not the cycle');
  assert.ok(src.includes("status: 'submitted'"), 'apply-then-pay: submitted, never paid at mint');
  // A live cycle already covers this event — do not sell it twice.
  assert.ok(src.includes('isVendor3dBoothActive(gate?.booth_addon_expires_at ?? null)'), 'refuses when the cycle covers it');
  // Compensation on payment failure uses the SAME client that minted.
  assert.ok(src.includes("await moneyWriter.from('orders').delete().eq('order_id', orderId)"), 'rollback with the minting client');
});

test('the section stands in the retired slot, booked-only, and explains every state', () => {
  const page = read(PAGE);
  const mounts = page.match(/<BoothEventSection eventId=\{eventId\} vendorProfileId=\{vendorProfileId\} \/>/g) ?? [];
  assert.equal(mounts.length, 1, 'mounted exactly once');
  const at = page.indexOf('<BoothEventSection');
  const before = page.slice(Math.max(0, at - 80), at);
  assert.ok(/isBooked \?/.test(before), 'booked-only — an inquiry cannot brand a booth the couple never placed');
  assert.ok(!page.includes('Vendor3dPlanUnlockSection'), 'the retired section is gone');

  const section = read(SECTION);
  // The states a vendor can be in, each drawn — not a null that reads as "broken".
  for (const state of [
    'cycleActive ?',
    "orderState === 'active'",
    "orderState === 'pending'",
    '!tierOk ?',
    '!verified ?',
    'eventPricePhp == null',
  ]) {
    assert.ok(section.includes(state), `state branch present: ${state}`);
  }
  assert.ok(section.includes('fetchVendorBoothEventOrderState(admin, vendorProfileId, eventId)'), 'order state read with ADMIN — a teammate\'s order has another user_id');
  assert.ok(section.includes('<BoothEventBuyForm eventId={eventId} pricePhp={eventPricePhp} />'), 'the buy form is reached only in the buyable state');
});

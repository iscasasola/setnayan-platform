/**
 * What a host is SHOWN for Setnayan AI must be what checkout CHARGES — in either
 * state of the per-event-pricing flag.
 *
 * ── THE BUG THIS CLOSES ─────────────────────────────────────────────────────
 * `studio/setnayan-ai/page.tsx` resolved the price with `resolveSetnayanAiTypePricePhp`
 * **ungated**, while `lib/order-charge-authority.ts` takes the per-type branch only
 * when `resolveSetnayanAiPerEventPricingEnabled()` is true — otherwise falling
 * through to the flat `SETNAYAN_AI` retail row.
 *
 * So with the flag OFF, a `date` event (tier D) was shown **₱99** and charged
 * **₱1,499**: a mismatch in the customer's disfavour, on the one screen where the
 * number is a promise. Verified against prod: the flag is currently ON, which is
 * why the two agree today — the correctness of the price was a property of a
 * SETTING, not of the code.
 *
 * ── WHY THESE ARE SOURCE-SCANS ──────────────────────────────────────────────
 * Both sides read the catalog through an admin/session client and the flag through
 * `platform_settings`; asserting the arithmetic would mean mocking three modules to
 * re-prove what the resolvers already unit-test. What actually broke here was
 * STRUCTURAL — two call sites making the same decision independently — so that is
 * what is pinned: one switch, both sides, no direct call that bypasses it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...seg: string[]) => readFileSync(join(WEB, ...seg), 'utf8');

const PAGE = read('app', 'dashboard', '[eventId]', 'studio', 'setnayan-ai', 'page.tsx');
const CHARGE = read('lib', 'order-charge-authority.ts');
const PRICING = read('lib', 'setnayan-ai-server.ts');

test('the studio DISPLAY goes through the shared resolver, not the raw per-type one', () => {
  assert.match(
    PAGE,
    /resolveSetnayanAiDisplayPricePhp\(supabase, eventType\)/,
    'the display must use the resolver that consults the same flag as the charge path',
  );
  assert.equal(
    /await resolveSetnayanAiTypePricePhp\(/.test(PAGE),
    false,
    'calling the per-type resolver directly here is the bug: it ignores the flag the '
      + 'charge path obeys, so an OFF flag shows ₱99 and charges ₱1,499',
  );
});

test('ONE switch governs both sides', () => {
  // The display's switch...
  assert.match(
    PRICING,
    /resolveSetnayanAiDisplayPricePhp[\s\S]{0,600}?await resolveSetnayanAiPerEventPricingEnabled\(\)/,
    'the display resolver must gate on resolveSetnayanAiPerEventPricingEnabled',
  );
  // ...must be the SAME name the charge authority gates on. If either side ever
  // moves to a different switch, this is what catches the divergence.
  assert.match(
    CHARGE,
    /if \(await resolveSetnayanAiPerEventPricingEnabled\(\)\)/,
    'the charge authority must gate on the same switch',
  );
});

test('flag OFF resolves the FLAT SETNAYAN_AI row — what checkout would actually take', () => {
  // The off-branch must read the same row the charge path falls through to, not a
  // hardcoded number and not a tier row.
  assert.match(
    PRICING,
    /\.eq\('service_code', SETNAYAN_AI_SKU\)/,
    'the flag-off branch must price from the flat SETNAYAN_AI row',
  );
});

test('Tier E still shows nothing, in BOTH branches', () => {
  // No vendors ⇒ Setnayan AI is not present, which is a product fact rather than a
  // pricing one. The off-branch must not start quoting ₱1,499 for an event type the
  // product does not serve.
  assert.match(
    PRICING,
    /if \(setnayanAiTierSkuForEventType\(eventType\) === null\) return 0;/,
    'the flag-off branch must return 0 for Tier E, same as the per-type branch',
  );
});

test('the tier-ladder module stays free of server-only imports', () => {
  // Learned the hard way while writing this fix: putting the flag read into
  // lib/setnayan-ai-event-pricing.ts pulled `server-only` in transitively via
  // integration-config and broke that module's OWN unit test
  // (`Cannot find module 'server-only'`). It is deliberately import-light so the
  // tier ladder stays testable under `tsx --test`, which is why the display
  // resolver lives in the `server` sibling instead. Same split as
  // r2-client-ref.ts / r2-client-ref.server.ts.
  const pure = read('lib', 'setnayan-ai-event-pricing.ts');
  assert.equal(
    /from '\.\/integration-config'|import 'server-only'/.test(pure),
    false,
    'setnayan-ai-event-pricing.ts must not import server-only (directly or via '
      + 'integration-config) — it would break its own unit test. Put flag-reading '
      + 'resolvers in lib/setnayan-ai-server.ts.',
  );
});

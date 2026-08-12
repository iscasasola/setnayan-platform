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
import { execFileSync } from 'node:child_process';
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

/* ═══════════════════════════════════════════════════════════════════════════
   TWO PRICES (owner-locked 2026-08-12) — sign-up is cheaper than later.
   ═══════════════════════════════════════════════════════════════════════════
   The same "shown ≠ charged" hazard, now with a second axis. Every surface has
   to agree on WHICH of the two prices applies, not just on the tier. */

const ONBOARDING_DISPLAY = read('lib', 'onboarding', 'services-step-server.ts');
const ONBOARDING_ORDER = read('lib', 'onboarding-services-orders.ts');
const TIERS = read('lib', 'setnayan-ai-type-pricing.ts');

test('🔴 the SIGN-UP CARD goes through the shared resolver too — not the raw one', () => {
  // THE GAP THIS CLOSES. Everything above pinned the studio page, and the
  // onboarding card was calling `resolveSetnayanAiTypePricePhp` directly and
  // UNGATED — the identical bug, on the one screen the guard never looked at.
  // With the per-type model off it showed a tier price while checkout charged
  // the flat row. A guard is only as wide as the surfaces it names.
  assert.match(
    ONBOARDING_DISPLAY,
    /resolveSetnayanAiDisplayPricePhp\(client, eventType, 'onboarding'\)/,
    'the sign-up card must use the shared resolver, in onboarding context',
  );
  assert.equal(
    /resolveSetnayanAiTypePricePhp\(/.test(ONBOARDING_DISPLAY),
    false,
    'the sign-up card must not bypass the shared resolver',
  );
});

test('🔴 what the sign-up card SHOWS is the context checkout CHARGES', () => {
  // Display and charge are resolved by different modules; the only thing making
  // them agree is that both say 'onboarding'. If either drifts, the card quotes
  // one number and the bill takes another — on the screen where the number is a
  // promise.
  assert.match(
    ONBOARDING_ORDER,
    /priceContext: 'onboarding'/,
    'the sign-up ORDER must charge the sign-up price',
  );
});

test('🔒 only the sign-up path may ask for the discount', () => {
  // If any other module could pass 'onboarding', the discount stops being a
  // sign-up offer and becomes the price — forever, for anyone who asks.
  const offenders: string[] = [];
  for (const dir of ['app', 'lib', 'components']) {
    let out = '';
    try {
      out = execFileSync(
        'grep',
        ['-rn', "priceContext: 'onboarding'", dir, '--include=*.ts', '--include=*.tsx'],
        { encoding: 'utf8' },
      );
    } catch {
      continue; // grep exits 1 on no matches
    }
    for (const line of out.trim().split('\n').filter(Boolean)) {
      const file = line.split(':')[0] ?? '';
      // ⚠ SKIP TESTS — INCLUDING THIS ONE. The first cut failed on its own
      // assertion string: the guard found itself and reported itself as the
      // offender. Same family as a check satisfied by the comment explaining it.
      if (/\.test\.tsx?$/.test(file)) continue;
      if (file !== 'lib/onboarding-services-orders.ts') offenders.push(line);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'only lib/onboarding-services-orders.ts may request the sign-up price — it is '
      + 'the one module reachable solely from the server-side event commit:\n'
      + offenders.join('\n'),
  );
});

test('🔒 the two ladders never cross — sign-up is always ≤ regular', () => {
  // A sign-up price ABOVE its regular twin would punish buying early, which is
  // the exact opposite of the decision. Parsed from source so a hand-edit to
  // either ladder is caught, not just a mismatch in intent.
  const grab = (name: string) => {
    const m = new RegExp(`${name}: Readonly<Record<AiPriceTier, number>> = \\{([^}]*)\\}`).exec(TIERS);
    assert.notEqual(m, null, `${name} not found — this guard has gone blind`);
    const out: Record<string, number> = {};
    for (const row of m![1]!.matchAll(/([A-E]):\s*(\d+)/g)) out[row[1]!] = Number(row[2]);
    return out;
  };
  const regular = grab('AI_TIER_FALLBACK_PHP');
  const signup = grab('AI_TIER_ONBOARDING_FALLBACK_PHP');

  assert.deepEqual(Object.keys(regular).sort(), ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(Object.keys(signup).sort(), ['A', 'B', 'C', 'D', 'E']);

  const crossed = Object.keys(regular).filter((t) => signup[t]! > regular[t]!);
  assert.deepEqual(
    crossed,
    [],
    `sign-up price is HIGHER than the regular price on tier(s) ${crossed.join(', ')} — `
      + 'buying early must never cost more',
  );
  // And the ladder must still descend A→D, or a tier has been mis-keyed.
  for (const ladder of [regular, signup]) {
    assert.ok(ladder.A! > ladder.B! && ladder.B! > ladder.C! && ladder.C! > ladder.D!);
    assert.equal(ladder.E, 0, 'Tier E is not offered Setnayan AI — it must be 0');
  }
});

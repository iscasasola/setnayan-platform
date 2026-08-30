/**
 * THE COMEBACK OFFER — that its rate is DERIVED from the row it prices, that it
 * fails closed on a row with nothing to halve, and that its window is scoped to
 * the USER while its price stays per event.
 *
 * 🔴 THE TEST THAT HAD TO CHANGE. The draft's price test asserted
 *
 *     comebackPricePhp(regular) === signupPriceFor(regular, COMEBACK_OFFER_DISCOUNT_PCT)
 *
 * which is the implementation restated — it passes for ANY constant, including a
 * wrong one, so it proved nothing. The real question is whether the price MOVES
 * when the row's own sign-up price moves. A hard-coded percentage cannot move;
 * a midpoint must. That is `derives its rate from the row` below, and it is the
 * assertion the mutation test targets.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMEBACK_OFFER_WINDOW_HOURS,
  comebackEligibleEventIds,
  comebackPriceCentavos,
  comebackPricePhp,
  isComebackOfferEligible,
  resolveUserComebackWindow,
  userComebackAnchor,
  type ComebackScopeEvent,
} from './setnayan-ai-comeback-offer';
import { roundPesoTiesDown } from './onboarding-family-discount';
import { stripComments } from './strip-comments';

const HOUR_MS = 60 * 60 * 1000;

/**
 * The four live tier rows, measured against production 2026-08-30. Used as
 * FIXTURES to be perturbed, never as expected outputs typed by hand.
 */
const LIVE_TIERS = [
  { sku: 'SETNAYAN_AI', retailPhp: 2499, onboardingPhp: 1499 },
  { sku: 'SETNAYAN_AI_B', retailPhp: 1499, onboardingPhp: 899 },
  { sku: 'SETNAYAN_AI_C', retailPhp: 899, onboardingPhp: 539 },
  { sku: 'SETNAYAN_AI_D', retailPhp: 199, onboardingPhp: 119 },
] as const;

/* ── (1) The rate is derived ───────────────────────────────────────────────── */

test('the comeback price is HALF the row’s own sign-up saving, tier by tier', () => {
  for (const tier of LIVE_TIERS) {
    const saving = tier.retailPhp - tier.onboardingPhp;
    assert.equal(
      comebackPricePhp(tier),
      tier.retailPhp - saving / 2,
      `${tier.sku}: the offer must give back exactly half of ₱${saving}`,
    );
  }
});

/**
 * THE PIN. Sabotage the row's sign-up price and the computed comeback price MUST
 * follow it. A hard-coded percentage — the defect this file exists to prevent —
 * would return the same number for every perturbation, because it never reads
 * `onboardingPhp` at all.
 */
test('derives its rate from the row: moving onboarding_price_php moves the price', () => {
  const retailPhp = 2499;
  const seen = new Set<number>();
  for (const onboardingPhp of [1499, 1299, 999, 499, 1999]) {
    const php = comebackPricePhp({ retailPhp, onboardingPhp });
    assert.ok(php != null, `₱${onboardingPhp} must price`);
    // The midpoint, restated independently of the implementation.
    assert.equal(php, roundPesoTiesDown((retailPhp + onboardingPhp) / 2));
    seen.add(php);
  }
  assert.equal(
    seen.size,
    5,
    'five different sign-up prices must yield five different comeback prices — ' +
      'one repeated value is the signature of a hard-coded rate',
  );
});

test('a deeper sign-up discount yields a deeper comeback price (monotonic)', () => {
  const retailPhp = 1499;
  const prices = [1399, 1199, 899, 599].map(
    (onboardingPhp) => comebackPricePhp({ retailPhp, onboardingPhp })!,
  );
  for (let i = 1; i < prices.length; i += 1) {
    const prev = prices[i - 1]!;
    const curr = prices[i]!;
    assert.ok(curr < prev, 'a bigger sign-up saving must produce a bigger comeback saving');
  }
});

test('the implied sign-up discounts are NOT a clean 40, which is why 20 is wrong', () => {
  // The premise behind the derivation, pinned so it cannot be forgotten: if
  // these were all exactly 40, a literal 20 would be defensible. They are not.
  const pcts = LIVE_TIERS.map(
    (t) => Math.round((1 - t.onboardingPhp / t.retailPhp) * 10000) / 100,
  );
  assert.deepEqual(pcts, [40.02, 40.03, 40.04, 40.2]);
  assert.ok(
    new Set(pcts).size > 1,
    'the tiers imply DIFFERENT discounts, so no single percentage is right for all of them',
  );
});

/* ── (2) Fails closed ──────────────────────────────────────────────────────── */

test('NULL onboarding price ⇒ NO OFFER, never 0% and never a midpoint against zero', () => {
  // SETNAYAN_AI_RENEW, exactly as it is in production.
  assert.equal(comebackPricePhp({ retailPhp: 799, onboardingPhp: null }), null);
  assert.equal(comebackPriceCentavos({ retailPhp: 799, onboardingPhp: null }), null);
  assert.equal(comebackPricePhp({ retailPhp: 799, onboardingPhp: undefined }), null);
  // ...and specifically NOT the two wrong answers a fail-open would give.
  assert.notEqual(comebackPricePhp({ retailPhp: 799, onboardingPhp: null }), 799);
  assert.notEqual(comebackPricePhp({ retailPhp: 799, onboardingPhp: null }), 399.5);
});

test('an unusable regular price, a ₱0 tier E, and an inverted pair all refuse', () => {
  assert.equal(comebackPricePhp({ retailPhp: 0, onboardingPhp: null }), null, 'tier E');
  assert.equal(comebackPricePhp({ retailPhp: -1, onboardingPhp: 100 }), null);
  assert.equal(comebackPricePhp({ retailPhp: Number.NaN, onboardingPhp: 100 }), null);
  // Inverted: a sign-up price ABOVE retail would put the "discount" above the
  // regular price, charging somebody more for coming back.
  assert.equal(comebackPricePhp({ retailPhp: 100, onboardingPhp: 150 }), null);
  // Equal: a midpoint that saves nothing is not an offer.
  assert.equal(comebackPricePhp({ retailPhp: 100, onboardingPhp: 100 }), null);
});

test('whole pesos, ties DOWN — shared with signupPriceFor, never re-typed', () => {
  // An odd saving is the only case that rounds: ₱100/₱99 → midpoint ₱99.5.
  assert.equal(comebackPricePhp({ retailPhp: 100, onboardingPhp: 99 }), 99);
  assert.equal(comebackPriceCentavos({ retailPhp: 100, onboardingPhp: 99 }), 9900);
  // Every live tier has an even saving, so nothing rounds today.
  for (const tier of LIVE_TIERS) {
    assert.equal((tier.retailPhp - tier.onboardingPhp) % 2, 0, `${tier.sku} saving is even`);
    assert.equal(comebackPricePhp(tier)! % 1, 0, `${tier.sku} is a whole peso`);
  }
});

test('centavos is the peso answer ×100, never independently rounded', () => {
  for (const tier of LIVE_TIERS) {
    assert.equal(comebackPriceCentavos(tier), Math.round(comebackPricePhp(tier)! * 100));
  }
});

/* ── (3) The window is the USER’s; the price is the event’s ────────────────── */

const t0 = new Date('2026-01-01T00:00:00.000Z');
const at = (hours: number) => new Date(t0.getTime() + hours * HOUR_MS);

const ev = (
  eventId: string,
  createdAt: Date,
  setnayanAiActive: boolean | null = false,
): ComebackScopeEvent => ({ eventId, createdAt, setnayanAiActive });

test('the anchor is the host’s EARLIEST event, not the one being viewed', () => {
  const events = [ev('B', at(50)), ev('A', at(0)), ev('C', at(100))];
  assert.equal(userComebackAnchor(events)?.toISOString(), t0.toISOString());
});

test('a second event does NOT mint a second window — the per-event defect', () => {
  // Host created event A at t0 and event B fifty hours later. Under the draft's
  // per-event anchoring, B would open a fresh 24h window at hour 50. It must
  // not: the host's one window closed at hour 24.
  const events = [ev('A', at(0)), ev('B', at(50))];
  assert.equal(resolveUserComebackWindow(events, at(51))?.active, false);
  assert.deepEqual(comebackEligibleEventIds(events, at(51)), []);
  assert.equal(isComebackOfferEligible(events, 'B', at(51)), false);
});

test('inside the window EVERY unowned event the host owns is offered', () => {
  // The owner's decision: Setnayan AI is for ALL of a user's events.
  const events = [ev('A', at(0)), ev('B', at(1)), ev('C', at(2))];
  assert.deepEqual(comebackEligibleEventIds(events, at(3)).sort(), ['A', 'B', 'C']);
});

test('an event that already owns AI is dropped — never re-charged for it', () => {
  const events = [ev('A', at(0), true), ev('B', at(1), false), ev('C', at(2), null)];
  const eligible = comebackEligibleEventIds(events, at(3));
  assert.deepEqual(eligible.sort(), ['B', 'C']);
  assert.equal(isComebackOfferEligible(events, 'A', at(3)), false);
  // ...and owning AI on A does NOT withdraw the offer from the others.
  assert.equal(isComebackOfferEligible(events, 'B', at(3)), true);
});

test('the window is active up to the boundary and lapsed at it', () => {
  const events = [ev('A', at(0))];
  const W = COMEBACK_OFFER_WINDOW_HOURS;
  assert.equal(resolveUserComebackWindow(events, new Date(t0.getTime() + W * HOUR_MS - 1))?.active, true);
  // AT the boundary the window has fully elapsed — `<`, not `<=`.
  assert.equal(resolveUserComebackWindow(events, new Date(t0.getTime() + W * HOUR_MS))?.active, false);
  assert.equal(resolveUserComebackWindow(events, new Date(t0.getTime() + W * HOUR_MS + 1))?.active, false);
});

test('no usable created_at is "no window", never "open forever"', () => {
  assert.equal(resolveUserComebackWindow([]), null);
  assert.equal(resolveUserComebackWindow(null), null);
  assert.equal(resolveUserComebackWindow([ev('A', null as unknown as Date)]), null);
  assert.equal(
    resolveUserComebackWindow([{ eventId: 'A', createdAt: 'not-a-date', setnayanAiActive: false }]),
    null,
  );
  assert.deepEqual(comebackEligibleEventIds(null), []);
  assert.equal(isComebackOfferEligible(null, 'A'), false);
});

test('an unparseable created_at does not become the anchor for its siblings', () => {
  const events: ComebackScopeEvent[] = [
    { eventId: 'A', createdAt: 'not-a-date', setnayanAiActive: false },
    ev('B', at(0)),
  ];
  assert.equal(userComebackAnchor(events)?.toISOString(), t0.toISOString());
});

/* ── (4) THE GUARD — no percentage may re-enter the money path ─────────────── */

/**
 * Sibling of the booking-fee guard in `booking-fee-schedule-summary.test.ts`,
 * which exists because a hard-coded `(5%)` shipped and misstated the fee on
 * every booking above ₱100,000. This one holds the same door shut for the AI
 * comeback price.
 *
 * 🔑 IT HUNTS FOR THE MECHANISM, NOT THE NUMBER. Checking for the literal `20`
 * would pass the moment somebody wrote `0.2`, `80 / 100`, or restored a
 * differently-named constant. So it forbids (a) any import of the percentage
 * helper `signupPriceFor` into this module, and (b) any percent-shaped constant
 * declared in it.
 */
test('GUARD: the comeback price path contains no percentage', () => {
  const src = readFileSync(new URL('./setnayan-ai-comeback-offer.ts', import.meta.url), 'utf8');
  /**
   * Comments come out via the SHARED lexer, never a hand-rolled regex — the
   * module's docblock legitimately DISCUSSES percentages (40.02 · 20 · 10) and
   * must not trip the guard it is explaining.
   *
   * 🪤 THIS WAS A TWO-REPLACE REGEX AND CI CAUGHT IT
   * (`scripts/lint-one-comment-stripper.mjs`). That form is not a stripper: a
   * `/*` inside a STRING opens a comment that runs to the next real `*` + `/`,
   * blanking real code — and a guard that then asserts `doesNotMatch` against a
   * blank PASSES. A check that cannot fail is not a check.
   */
  const code = stripComments(src);
  // The stripper must not have eaten the file — the failure mode above, pinned
  // so this guard cannot go quietly vacuous.
  assert.ok(code.includes('comebackPricePhp'), 'stripComments must leave the code intact');

  assert.doesNotMatch(
    code,
    /\bsignupPriceFor\b/,
    'signupPriceFor takes a PERCENTAGE — the comeback price is a midpoint and must not route through it',
  );
  /**
   * 🪤 THIS PATTERN SHIPPED INERT ONCE, IN THIS VERY COMMIT, AND MUTATION
   * TESTING IS THE ONLY REASON IT DIDN'T STAY THAT WAY. It was written as
   * `/\b(?:DISCOUNT|OFFER)_[A-Z_]*PCT\b|\bPCT\b/` — and `\b` cannot match
   * inside an identifier: in `COMEBACK_OFFER_DISCOUNT_PCT` the character before
   * `DISCOUNT` and before `PCT` is `_`, a WORD character, so there is no
   * boundary there and neither alternative could ever fire. Re-introducing the
   * exact constant this guard exists to forbid left the suite fully green.
   *
   * The fix anchors on the SUFFIX, which is where the boundary really is.
   */
  assert.doesNotMatch(
    code,
    /_PCT\b|\bPCT\b|Pct\b/,
    'no percentage constant may re-enter this module — the rate is derived from the row',
  );
  assert.doesNotMatch(
    code,
    /onboarding_discount_pct/,
    'the house dial is 10 in production and is NOT this offer’s basis',
  );
  // The derivation itself must still be present and must read BOTH stored
  // prices — a guard that only forbids is one deletion away from vacuous.
  assert.match(code, /retailPhp/, 'the regular price must be read');
  assert.match(code, /onboardingPhp/, 'the sign-up price must be read — it IS the rate');
});

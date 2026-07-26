import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * WIRING guardrail for the vendor launch free window.
 *
 * ── WHY THIS FILE EXISTS (read before deleting it) ──────────────────────────
 * The first cut of this branch shipped 12 unit tests that all passed with all
 * 11 consuming files reverted to `main`: every test exercised the new pure
 * module and nothing imported a single changed action or component. That is
 * worse than no test — it is a false green.
 *
 * The consuming code is Next.js server actions and `'use client'` components:
 * they import `next/cache`, `next/navigation` and the Supabase server client,
 * so they cannot be imported under `tsx --test`. So this file asserts on their
 * SOURCE TEXT instead, and is honest about that limit:
 *
 *   • It is a STRUCTURAL lock, not a behavioural one. It proves the decision is
 *     WIRED — that the buy path calls the tested predicate and branches on the
 *     tested field. It does not prove the runtime result.
 *   • It is defeatable by renaming. A rewrite that keeps the behaviour but
 *     changes the identifiers will fail here and must be re-pinned by hand.
 *     That is the intended cost: this is the tripwire on the money path.
 *
 * The behavioural coverage lives in `vendor-launch-free-window-coverage.test.ts`
 * (which SKUs are free, when) and `vendor-addon-free-grant.test.ts` (which free
 * grant burns the trial). This file only guarantees those two are reachable
 * from production code.
 */

const APP = join(__dirname, '..', 'app', 'vendor-dashboard');

const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');

const SUBSCRIPTION_ACTIONS = 'subscription/actions.ts';
const SUBSCRIPTION_CARDS = 'subscription/_components/subscription-cards.tsx';
const AI_ACTIONS = 'subscription/ai-addon-actions.ts';
const BOOTH_ACTIONS = 'subscription/booth-addon-actions.ts';
const AI_CARD = 'subscription/_components/ai-addon-card.tsx';
const BOOTH_CARD = 'subscription/_components/booth-addon-card.tsx';
const CHALLENGE_ACTIONS = 'clients/[eventId]/photo-challenge-actions.ts';

// ── 1 · the DESCOPE lock: plans stay buyable ────────────────────────────────

test('plan purchase is NOT touched by the launch window (server action)', () => {
  // The first cut made `startSubscriptionPurchase` refuse outright while the
  // window was open. Because `create_vendor_subscription` is the only in-app
  // writer of a paid tier, that made every paid tier unobtainable — which in
  // turn made the two Solo+/Pro+ gated add-ons this window DOES cover
  // unreachable, and left a vendor whose tier lapsed mid-window unable to renew.
  const src = read(SUBSCRIPTION_ACTIONS);
  assert.equal(
    /vendor-launch-free-window/.test(src),
    false,
    'subscription/actions.ts must not consult the launch window — plan cycles are descoped',
  );
  assert.equal(
    src.includes('create_vendor_subscription'),
    true,
    'the plan purchase RPC call must still be here',
  );
});

test('plan CARDS still submit the purchase form unconditionally', () => {
  const src = read(SUBSCRIPTION_CARDS);
  assert.equal(
    /launchFree/.test(src),
    false,
    'subscription-cards.tsx must not carry a launchFree branch',
  );
  assert.equal(
    /vendor-launch-free-window/.test(src),
    false,
    'subscription-cards.tsx must not import the launch window module',
  );
  assert.equal(
    src.includes('<form action={startSubscriptionPurchase}'),
    true,
    'the plan buy form must still render (it was replaced by a disabled button)',
  );
  assert.equal(
    src.includes('disabled'),
    false,
    'no disabled plan CTA — that was the unbuyable state this branch removed',
  );
});

test('the subscription PAGE advertises no free plans', () => {
  const src = read('subscription/page.tsx');
  assert.equal(
    src.includes('subscriptionLaunchFree'),
    false,
    'the "every paid plan is free" banner must be gone',
  );
  assert.equal(
    src.includes("launchFreeFor('vendor_subscription')"),
    false,
    'the page must not ask the window about subscriptions',
  );
  // …but it must still ask about the two add-ons that ARE covered.
  assert.equal(src.includes("launchFreeFor('vendor_ai_addon')"), true);
  assert.equal(src.includes("launchFreeFor('vendor_3d_booth')"), true);
});

// ── 2 · the add-on buy paths actually consult the window ────────────────────

for (const [file, sku] of [
  [AI_ACTIONS, 'vendor_ai_addon'],
  [BOOTH_ACTIONS, 'vendor_3d_booth'],
  [CHALLENGE_ACTIONS, 'papic_challenge'],
] as const) {
  test(`${file} routes its price through the launch-window predicate for ${sku}`, () => {
    const src = read(file);
    assert.equal(
      src.includes('isVendorLaunchFreeNow'),
      true,
      'must call the tested predicate',
    );
    assert.equal(
      src.includes('isVendorLaunchFreeWindowEnabled'),
      true,
      'the env flag must be read at the call site, not inside the pure module',
    );
    assert.equal(src.includes(`sku: '${sku}'`), true, `must pass sku '${sku}'`);
  });
}

// ── 3 · a launch grant must not burn the one-time trial ─────────────────────

for (const file of [AI_ACTIONS, BOOTH_ACTIONS] as const) {
  test(`${file} branches on the TESTED grant kind, not a raw boolean`, () => {
    const src = read(file);
    assert.equal(
      src.includes('resolveVendorAddonGrant'),
      true,
      'the free-grant kind must come from the tested pure module',
    );
    assert.equal(
      src.includes('if (grant.repeatable) {'),
      true,
      'the repeatable/atomic-claim fork must key off grant.repeatable',
    );
  });

  test(`${file} only stamps *_trial_used_at on the non-repeatable branch`, () => {
    const src = read(file);
    // The WRITE, not a mention: `<addon>_trial_used_at: nowIso` inside an
    // `.update({ … })`. Prose that names the column is deliberately not matched.
    const stamps = src.split('\n').filter((l) => /_trial_used_at:\s*nowIso/.test(l));
    assert.equal(stamps.length, 1, 'exactly one place may stamp the trial column');
    const stamp = stamps[0] as string;
    // The stamp must sit AFTER the `if (grant.repeatable) {` fork opens and
    // inside its `else` — i.e. later in the file than the fork.
    const fork = src.indexOf('if (grant.repeatable) {');
    assert.equal(fork > -1, true);
    assert.equal(
      src.indexOf(stamp) > fork,
      true,
      'the trial stamp must live below the repeatable fork',
    );
  });
}

// ── 4 · the cards never promise "free" to a shop that cannot activate ───────

for (const file of [AI_CARD, BOOTH_CARD] as const) {
  test(`${file} gates its launch-free copy on eligibility`, () => {
    const src = read(file);
    assert.equal(
      src.includes('props.launchFree === true && eligible'),
      true,
      'the price line renders above the eligibility gate — a Free/unverified shop ' +
        'must not be told the add-on is free while the server would refuse it',
    );
  });
}

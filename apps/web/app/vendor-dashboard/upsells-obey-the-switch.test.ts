/**
 * upsells-obey-the-switch.test.ts — no supplier screen shows a plan paywall
 * the owner's switch cannot turn off.
 *
 * ── The defect, in one sentence ────────────────────────────────────────────
 * `VENDOR_TIER_FEATURE_GATE` is the owner's ONE switch for supplier paywalls,
 * and it is OFF in production — yet Creators returned a full-page "unlocks with
 * Pro" to every sub-Pro shop, the page editor hid its controls behind "Upgrade",
 * Reach told findable Free shops they were "not shown in couples' searches",
 * Team/Branches read "Upgrade to add", payment links were "Pro & Enterprise
 * only", Deep Search said "Upgrade to run it" — each checking the tier directly,
 * so each was a paywall that no switch reached (fixed 2026-09-30).
 *
 * ── The property ───────────────────────────────────────────────────────────
 * Sweep EVERY file under app/vendor-dashboard. A file whose supplier-visible
 * text (comments stripped) carries paywall copy — "upgrade", "unlocks with",
 * "Pro & Enterprise only", a <VendorTierGate>/<VendorTierTeaser> mount, a
 * PaidMark — must ASK THE SWITCH: call `vendorPaywallApplies(`,
 * `vendorAllowance(` or `isVendorFeatureGateEnabled(` (lib/vendor-feature-gate.ts).
 * A client component cannot read the server env, so it passes when EVERY file
 * that imports it asks the switch (the answer arrives as a prop).
 *
 * A file that is out of scope for a stated reason sits in `NOT_THE_SWITCH`
 * below, one reason per line — and that list is probed in BOTH directions: an
 * entry with no paywall copy left in it fails as stale.
 *
 * ⚠ FILE-LEVEL, deliberately and knowingly. A file that asks the switch for one
 * upsell and hard-codes another passes this sweep; the behavioural half at the
 * bottom pins the helper itself. Keep upsells one-per-question where you can.
 *
 * 🛡 Sabotage-checked 2026-09-30, call counts printed before/after each: the
 * Deep Search page computing `planAsks` from the tier directly (1→0 calls) →
 * RED on the runner; an unconditional <VendorTierGate> back in Creators (0→1
 * mounts) → RED; shop/page.tsx with every helper call replaced (6→0) → RED on
 * the page AND the website editor it feeds; a NOT_THE_SWITCH entry for a file
 * with no plan copy → RED. Each restored → green. The FIRST sabotage stayed
 * green: a hand-rolled comment stripper here read a type's `{ /**` as a JSX
 * comment and blanked whole components — which is why this file now uses the
 * repo's one `stripComments` (lib/strip-comments.ts), as the lint requires.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/vendor-dashboard
const APP = dirname(HERE); // app

/**
 * Files that carry plan copy for a reason OTHER than the tier paywall this
 * switch governs. Every line says why. Adding a file here is a decision — say
 * it in the PR.
 */
const NOT_THE_SWITCH: Record<string, string> = {
  // The plan page itself — it is where a supplier chooses to buy.
  'subscription/actions.ts': 'the Plans checkout — buying is its job',
  'subscription/_components/subscription-cards.tsx': 'the Plans page cards',
  'subscription/_components/ai-addon-card.tsx': 'Vendor AI — a separately sold add-on, on the Plans page',
  'subscription/_components/booth-addon-card.tsx': '3D Booth — a separately sold add-on, on the Plans page',
  'subscription/_components/papic-challenge-card.tsx': 'the Plans page cards',
  'subscription/ai-addon-actions.ts': 'Vendor AI add-on checkout',
  'subscription/custom/_components/custom-configurator.tsx': 'the Custom plan builder — "reach upgrade" names an axis',
  'shop/_components/voice-match-card.tsx': 'Voice-match is Vendor AI — Advanced, a separately sold add-on',
  'shop/autoreply-actions.ts': 'Voice-match is Vendor AI — Advanced, a separately sold add-on',
  // The gate component: it only ever renders where a caller asked the switch
  // (property 2 below checks every mount).
  '_components/tier-gate.tsx': 'the gate component itself; its mounts are checked',
  // Numeric plan QUOTAS on features the shop already has (services per
  // category, categories, bookings per day, time slots, coverage) — a limit,
  // not a feature paywall. Governed by the pipeline-caps switch, not this one.
  'services/actions.ts': 'numeric quotas (services per category, categories, bookings/day, time slots)',
  'services/_components/coverage-panel.tsx': 'numeric quota (coverage areas)',
  'services/_components/canvas-maker.tsx': 'numeric quota (families on a one-family plan)',
  'calendar/surface.tsx':
    'asks the switch for the waitlist; ALSO carries the bookings-per-day quota notice (capacity_clamped)',
  // Enforced by the DATABASE unconditionally, so the switch cannot lift it:
  // offer_creator_reach_hold raises TIER_BELOW_PRO_NO_REACH (owner decision
  // #4, 2026-07-16). The page is try-first (browse + draft); Send asks.
  'creators/actions.ts': 'maps the database’s own Pro floor (TIER_BELOW_PRO_NO_REACH) at Send',
  'creators/page.tsx': 'try-first browse; the ◆ note describes the database’s Pro floor at Send',
  // Day-of tools lapse with a paid Papic/day-of order, not the plan tier.
  'on-the-day/page.tsx': 'a lapsed day-of purchase, not the plan tier',
  'team/actions.ts':
    'asks the switch for the zero-seat case; ALSO the Enterprise extra-seat add-on and the at-limit quota hint',
};

// Supplier-visible paywall copy. Words only as whole words: `upgradeHref` is
// an identifier, not copy.
const PAYWALL_COPY: RegExp[] = [
  /\bupgrade\b/i,
  /\bunlocks? with\b/i,
  /Pro (?:&|&amp;) Enterprise only/i,
  /<VendorTierGate\b/,
  /<VendorTierTeaser\b/,
  /<PaidMark\b/,
];
const ASKS_THE_SWITCH = /\b(?:vendorPaywallApplies|vendorAllowance|isVendorFeatureGateEnabled)\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = walk(HERE);
const SRC = new Map(FILES.map((f) => [f, readFileSync(f, 'utf8')]));
const rel = (f: string) => relative(HERE, f).split('\\').join('/');

function hasPaywallCopy(f: string): boolean {
  const code = stripComments(SRC.get(f)!);
  return PAYWALL_COPY.some((re) => re.test(code));
}
function asksTheSwitch(src: string): boolean {
  return ASKS_THE_SWITCH.test(stripComments(src));
}

/** Every app/ file that imports `f` by its module path (alias or relative). */
let APP_FILES: Map<string, string> | null = null;
function importersOf(f: string): string[] {
  APP_FILES ??= new Map(walk(APP).map((g) => [g, readFileSync(g, 'utf8')]));
  const base = f.replace(/\.(ts|tsx)$/, '');
  const aliased = '@/' + relative(dirname(APP), base).split('\\').join('/');
  return [...APP_FILES.keys()].filter((g) => {
    if (g === f) return false;
    const src = APP_FILES!.get(g)!;
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1]!;
      if (spec === aliased) return true;
      if (spec.startsWith('.') && join(dirname(g), spec) === base) return true;
    }
    return false;
  });
}

test('the sweep reaches the supplier dashboard (not a vacuous pass)', () => {
  assert.ok(FILES.length > 150, `only ${FILES.length} files swept`);
  const withCopy = FILES.filter(hasPaywallCopy).length;
  assert.ok(withCopy >= 10, `only ${withCopy} files with paywall copy — the patterns stopped matching`);
});

test('every supplier file with paywall copy asks VENDOR_TIER_FEATURE_GATE', () => {
  const offenders: string[] = [];
  for (const f of FILES) {
    if (!hasPaywallCopy(f)) continue;
    const r = rel(f);
    if (r in NOT_THE_SWITCH) continue;
    const src = SRC.get(f)!;
    if (asksTheSwitch(src)) continue;
    if (/^\s*['"]use client['"]/.test(src)) {
      const parents = importersOf(f);
      if (parents.length > 0 && parents.every((p) => asksTheSwitch(readFileSync(p, 'utf8')))) continue;
      offenders.push(`${r}  (client component — importers not all asking: ${parents.map((p) => relative(APP, p)).join(', ') || 'none'})`);
      continue;
    }
    offenders.push(r);
  }
  assert.deepEqual(
    offenders,
    [],
    'These show a plan paywall the owner’s switch cannot turn off. Route the ' +
      'decision through vendorPaywallApplies() / vendorAllowance() ' +
      '(lib/vendor-feature-gate.ts) — or, if it is not the tier paywall, add ' +
      'the file to NOT_THE_SWITCH with its reason:\n  ' +
      offenders.join('\n  '),
  );
});

test('every <VendorTierGate>/<VendorTierTeaser> mount asks the switch', () => {
  const offenders = FILES.filter((f) => {
    const code = stripComments(SRC.get(f)!);
    if (!/<VendorTier(?:Gate|Teaser)\b/.test(code)) return false;
    if (rel(f) === '_components/tier-gate.tsx') return false;
    return !asksTheSwitch(SRC.get(f)!);
  }).map(rel);
  assert.deepEqual(offenders, [], `unconditional tier gates: ${offenders.join(', ')}`);
});

test('NOT_THE_SWITCH has no stale entries (probe the other direction)', () => {
  const stale: string[] = [];
  for (const r of Object.keys(NOT_THE_SWITCH)) {
    const f = join(HERE, r);
    if (!SRC.has(f)) stale.push(`${r} — file is gone`);
    else if (!hasPaywallCopy(f)) stale.push(`${r} — no plan copy left; remove the entry`);
  }
  assert.deepEqual(stale, []);
});

// ── Behavioural half: the helper itself ──────────────────────────────────────

async function withFlag<T>(value: string | undefined, fn: () => Promise<T> | T): Promise<T> {
  const prev = process.env.VENDOR_TIER_FEATURE_GATE;
  if (value === undefined) delete process.env.VENDOR_TIER_FEATURE_GATE;
  else process.env.VENDOR_TIER_FEATURE_GATE = value;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.VENDOR_TIER_FEATURE_GATE;
    else process.env.VENDOR_TIER_FEATURE_GATE = prev;
  }
}

test('switch OFF: nobody is asked, a zero allowance becomes the entry plan’s', async () => {
  const { vendorPaywallApplies, vendorAllowance } = await import('@/lib/vendor-feature-gate');
  const { entryTierAllowance } = await import('@/lib/vendor-tier-caps');
  for (const v of [undefined, '', 'false', '0', 'off']) {
    await withFlag(v, () => {
      assert.equal(vendorPaywallApplies(false), false, `flag=${String(v)}`);
      assert.equal(vendorPaywallApplies(true), false);
      assert.equal(vendorAllowance(0, 1), 1);
      assert.equal(vendorAllowance(3, 1), 3, 'a plan that has it keeps its own number');
    });
  }
  assert.ok(entryTierAllowance('agentAccounts') > 0, 'no plan includes team seats?');
  assert.ok(entryTierAllowance('waitlistAcceptances') > 0, 'no plan includes a waitlist?');
});

test('switch ON: only a shop that lacks it is asked; a zero stays zero', async () => {
  const { vendorPaywallApplies, vendorAllowance } = await import('@/lib/vendor-feature-gate');
  await withFlag('true', () => {
    assert.equal(vendorPaywallApplies(false), true);
    assert.equal(vendorPaywallApplies(true), false);
    assert.equal(vendorAllowance(0, 1), 0);
    assert.equal(vendorAllowance(Infinity, 1), Infinity);
  });
});

test('Deep Search: a verified Free shop may run while the switch is off', async () => {
  const { deepSearchEligibility } = await import('@/lib/vendor-deep-search-addon');
  assert.deepEqual(
    deepSearchEligibility({ tier: 'free', verification: 'verified', tierPaywall: false }),
    { ok: true },
  );
  assert.deepEqual(
    deepSearchEligibility({ tier: 'free', verification: 'verified', tierPaywall: true }),
    { ok: false, reason: 'tier_too_low' },
  );
  // Verification is not a plan and no switch lifts it.
  assert.deepEqual(
    deepSearchEligibility({ tier: 'pro', verification: 'unverified', tierPaywall: false }),
    { ok: false, reason: 'unverified' },
  );
});

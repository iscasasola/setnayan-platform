/**
 * The onboarding services step's derivation — the PURE half.
 *
 * What is actually at risk here is not layout, it is a false promise on the
 * screen where a couple first hears the word Papic. So these tests pin the three
 * ways this view-model can lie:
 *   1. quoting a rung the catalog cannot price,
 *   2. printing a free tier the meter will never mint,
 *   3. offering Setnayan AI on a vendor-free event.
 * Plus the ordering contract for `interested_services`, which after two years of
 * being written and never read finally has a reader — and must stay a
 * presentation-only one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { onboardingServicesStepEnabled } from './services-step-flag';
import {
  buildServicesStepView,
  orderPapicTypes,
  PAPIC_ONE_INAPP_KEY,
  PAPIC_POOL_INAPP_KEY,
  type PapicTypeView,
} from './services-step-data';
import { PAPIC_FREE_ONE_CAMERA_COUNT } from '@/lib/papic-one';
import { PAPIC_POINTS_PER_CLIP, PAPIC_POINTS_PER_PHOTO } from '@/lib/papic-cameras';

const POOL_TIERS = [
  { serviceCode: 'PAPIC_GUEST', points: 3000, isTopup: false, sortOrder: 10 }, // gitleaks:allow
  { serviceCode: 'PAPIC_GUEST_6K', points: 6000, isTopup: false, sortOrder: 20 }, // gitleaks:allow
  { serviceCode: 'PAPIC_GUEST_10K', points: 10000, isTopup: false, sortOrder: 30 }, // gitleaks:allow
  { serviceCode: 'PAPIC_GUEST_TOPUP', points: 10000, isTopup: true, sortOrder: 40 }, // gitleaks:allow
];
const ONE_TIERS = [
  { serviceCode: 'PAPIC_CAMERA_MINI_DAY', points: 50, sortOrder: 10 },
  { serviceCode: 'PAPIC_ONE_100', points: 100, sortOrder: 20 },
];
const PRICES = new Map<string, number>([
  ['PAPIC_GUEST', 1000], // gitleaks:allow
  ['PAPIC_GUEST_6K', 2000], // gitleaks:allow
  ['PAPIC_GUEST_10K', 3000], // gitleaks:allow
  ['PAPIC_GUEST_TOPUP', 3000], // gitleaks:allow
  ['PAPIC_CAMERA_MINI_DAY', 50],
  ['PAPIC_ONE_100', 100],
]);

const build = (over: Partial<Parameters<typeof buildServicesStepView>[0]> = {}) =>
  buildServicesStepView({
    eventWord: 'wedding',
    poolTiers: POOL_TIERS,
    oneTiers: ONE_TIERS,
    pricePhpByCode: PRICES,
    freePoolPoints: 50,
    freeOnePoints: 5,
    aiPricePhp: 1499,
    ...over,
  });

const typeOf = (v: ReturnType<typeof build>, id: PapicTypeView['id']) =>
  v.papic.types.find((t) => t.id === id)!;

test('both Papic products render, Pool first by default', () => {
  const v = build();
  assert.deepEqual(
    v.papic.types.map((t) => t.id),
    ['pool', 'one'],
  );
});

test('rungs carry live points AND a live price, cheapest first', () => {
  const pool = typeOf(build(), 'pool');
  assert.deepEqual(
    pool.rungs.map((r) => [r.points, r.pricePhp]),
    [
      [3000, 1000],
      [6000, 2000],
      [10000, 3000],
    ],
  );
  const one = typeOf(build(), 'one');
  assert.deepEqual(
    one.rungs.map((r) => [r.points, r.pricePhp]),
    [
      [50, 50],
      [100, 100],
    ],
  );
});

test('the repeatable Pool top-up is not a base pick', () => {
  const pool = typeOf(build(), 'pool');
  assert.equal(
    pool.rungs.some((r) => r.key === 'PAPIC_GUEST_TOPUP'), // gitleaks:allow
    false,
  );
});

test('a rung the catalog cannot price DISAPPEARS — it is never shown at ₱0', () => {
  // The failure this guards: a SKU deactivated in the catalog while its tier row
  // stays live. A ₱0 rung beside real ones reads as "free", which is the exact
  // false-bargain shape the 2026-07-21 onboarding fix was written to stop.
  const partial = new Map(PRICES);
  partial.delete('PAPIC_GUEST_6K'); // gitleaks:allow
  partial.set('PAPIC_GUEST_10K', 0); // gitleaks:allow — inactive rows read as 0
  const pool = typeOf(build({ pricePhpByCode: partial }), 'pool');
  assert.deepEqual(
    pool.rungs.map((r) => r.points),
    [3000],
  );
  assert.equal(
    pool.rungs.every((r) => r.pricePhp > 0),
    true,
  );
});

test('a dead catalog leaves the free tier standing and sells nothing', () => {
  const v = build({ pricePhpByCode: new Map() });
  assert.deepEqual(typeOf(v, 'pool').rungs, []);
  assert.deepEqual(typeOf(v, 'one').rungs, []);
  // The free half is armed by SQL, not the catalog, so it must survive.
  assert.equal(typeOf(v, 'pool').freePoints, 50);
  assert.equal(typeOf(v, 'one').freePoints, 5);
});

test('the Pool is camera-less; Papic One gets exactly ONE free camera', () => {
  const v = build();
  // null, not 0 and not 3: any guest phone shoots the pool, so there is no seat
  // to count. `papic_tier_config.free.seats_per_event` (3) is a different thing.
  assert.equal(typeOf(v, 'pool').freeCameras, null);
  assert.equal(typeOf(v, 'one').freeCameras, PAPIC_FREE_ONE_CAMERA_COUNT);
  assert.equal(PAPIC_FREE_ONE_CAMERA_COUNT, 1);
});

test('a zeroed free allowance removes the free tier rather than promising it', () => {
  // papic_ensure_free_one_camera treats <= 0 as "arm nothing". Copy must follow,
  // or the card promises a camera the meter never mints.
  const v = build({ freeOnePoints: 0, freePoolPoints: 0 });
  assert.equal(typeOf(v, 'one').freeCameras, 0);
  assert.equal(typeOf(v, 'one').freePoints, 0);
  assert.equal(typeOf(v, 'pool').freePoints, 0);
});

test('the free allowances track their admin columns, they are not literals', () => {
  const v = build({ freePoolPoints: 90, freeOnePoints: 12 });
  assert.equal(typeOf(v, 'pool').freePoints, 90);
  assert.equal(typeOf(v, 'one').freePoints, 12);
});

test('the point currency is derived from the capture-path constants', () => {
  const [photo, clip] = build().papic.currencyTerms;
  assert.match(photo, new RegExp(`= ${PAPIC_POINTS_PER_PHOTO} pt`));
  assert.match(clip, new RegExp(`= ${PAPIC_POINTS_PER_CLIP} pts`));
});

test('Setnayan AI renders only when the gate resolved a price', () => {
  // The numeric twin was added 2026-08-11 so the running total can add the tick
  // up. Both must be present and must agree — a label and a figure that disagree
  // is a couple charged something other than what they read.
  assert.deepEqual(build().ai, { priceLabel: '₱1,499', pricePhp: 1499 });
  // The vendor-free gate closes it with null — never with a ₱0 offer, because
  // "Setnayan AI cannot be free" (owner 2026-07-27).
  assert.equal(build({ aiPricePhp: null }).ai, null);
  assert.equal(build({ aiPricePhp: 0 }).ai, null);
});

test('the AI price is whatever the catalog said — no ladder is re-derived here', () => {
  assert.equal(build({ aiPricePhp: 499 }).ai?.priceLabel, '₱499');
  assert.equal(build({ aiPricePhp: 99 }).ai?.priceLabel, '₱99');
});

test('the runway noun is the type’s own word', () => {
  assert.equal(build({ eventWord: 'trip' }).papic.eventWord, 'trip');
});

// ── interested_services · the first reader ──────────────────────────────────

const TYPES = () => build().papic.types;

test('interested_services orders the products — and does nothing else', () => {
  const ordered = orderPapicTypes(TYPES(), [PAPIC_ONE_INAPP_KEY, 'advanced_website']);
  assert.deepEqual(
    ordered.map((t) => t.id),
    ['one', 'pool'],
  );
  // Both still render, with identical content — order is the ONLY effect.
  assert.deepEqual(
    ordered.map((t) => t.rungs.length).sort(),
    TYPES()
      .map((t) => t.rungs.length)
      .sort(),
  );
});

test('a named product outranks an unnamed one, in list order', () => {
  assert.deepEqual(
    orderPapicTypes(TYPES(), [PAPIC_POOL_INAPP_KEY, PAPIC_ONE_INAPP_KEY]).map((t) => t.id),
    ['pool', 'one'],
  );
  assert.deepEqual(
    orderPapicTypes(TYPES(), [PAPIC_ONE_INAPP_KEY, PAPIC_POOL_INAPP_KEY]).map((t) => t.id),
    ['one', 'pool'],
  );
});

test('an empty / unrecognised / missing list is a no-op', () => {
  for (const input of [[], ['pakanta', 'panood'], null, undefined]) {
    assert.deepEqual(
      orderPapicTypes(TYPES(), input).map((t) => t.id),
      ['pool', 'one'],
      `expected default order for ${JSON.stringify(input)}`,
    );
  }
});

test('the inapp keys are the ones already stored in interested_services', () => {
  // These strings are STABLE IDENTIFIERS written into every draft ever saved
  // (INAPP_TO_SERVICE_CODE); renaming either would orphan live rows AND silently
  // turn this reader back into a no-op.
  assert.equal(PAPIC_POOL_INAPP_KEY, 'papic_guest');
  assert.equal(PAPIC_ONE_INAPP_KEY, 'papic_seats');
  const v = build();
  assert.equal(typeOf(v, 'pool').inappKey, PAPIC_POOL_INAPP_KEY);
  assert.equal(typeOf(v, 'one').inappKey, PAPIC_ONE_INAPP_KEY);
});

// ── the flag's OFF-state contract ───────────────────────────────────────────
//
// The promise made to the owner is that OFF renders byte-identical to today.
// That promise lives in three separate files, so it is asserted here rather
// than left to a reviewer's eye: each mount must be guarded on the VIEW (which
// is null whenever the flag is off), not merely hidden with CSS or a truthy
// screen id — a screen that renders and hides still changes the DOM, the step
// count and the progress fraction.

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
/** Drop /* … *\/ blocks and // lines, so a guard never fires on its own prose. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the flag is off unless explicitly turned on', () => {
  const prev = process.env.NEXT_PUBLIC_ONBOARDING_SERVICES_STEP;
  try {
    for (const v of [undefined, '', 'false', 'no', '0', 'yes']) {
      if (v === undefined) delete process.env.NEXT_PUBLIC_ONBOARDING_SERVICES_STEP;
      else process.env.NEXT_PUBLIC_ONBOARDING_SERVICES_STEP = v;
      assert.equal(onboardingServicesStepEnabled(), false, `expected OFF for ${String(v)}`);
    }
    for (const v of ['true', 'TRUE', '1']) {
      process.env.NEXT_PUBLIC_ONBOARDING_SERVICES_STEP = v;
      assert.equal(onboardingServicesStepEnabled(), true, `expected ON for ${v}`);
    }
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_ONBOARDING_SERVICES_STEP;
    else process.env.NEXT_PUBLIC_ONBOARDING_SERVICES_STEP = prev;
  }
});

test('every server mount resolves the view ONLY behind the flag', () => {
  for (const rel of [
    'app/onboarding/[type]/page.tsx',
    'app/onboarding/wedding/page.tsx',
    'app/onboarding/simple/page.tsx',
  ]) {
    const src = read(rel);
    assert.match(src, /onboardingServicesStepEnabled\(\)/, `${rel} must gate on the flag`);
    // Every call site must sit inside the guard — an unconditional read would
    // spend queries (and could render cards) on a flag-off request. Checked over
    // a small window because the guard is a ternary in two of the three files.
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      if (!line.includes('readServicesStepView(')) return;
      const window = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
      assert.match(
        window,
        /onboardingServicesStepEnabled\(\)/,
        `${rel}:${i + 1} calls readServicesStepView outside the flag guard`,
      );
    });
  }
});

test('every render site is guarded on the view being present', () => {
  // wedding: the whole <section> is conditional, so flag-off emits no extra node.
  const shell = read('app/onboarding/wedding/_components/onboarding-shell.tsx');
  assert.match(shell, /\{servicesStepView \? \(\s*\n\s*<section/);
  // …and the screen id is filtered out of the sequence too, so indices + the
  // progress fraction are untouched.
  assert.match(shell, /id === 'services_step' && !SERVICES_STEP_ENABLED/);

  // generic wizard: the screen is ABSENT from the array, not skipped inside it.
  const generic = read('app/onboarding/[type]/_components/generic-onboarding.tsx');
  assert.match(generic, /\.\.\.\(servicesStepView \? \['services'\] : \[\]\)/);
  assert.match(generic, /screen === 'services' && servicesStepView/);

  // simple page: one conditional card, no wizard involved. Since 2026-08-11 it
  // renders through <PapicStepFields>, the client wrapper that mirrors the
  // picker's state into hidden inputs — that page is a plain server <form>, so
  // the selection has to reach commitSimpleEvent as FormData like every other
  // field on it. The GUARD is unchanged: still conditional on the view.
  const simple = read('app/onboarding/simple/page.tsx');
  assert.match(simple, /\{servicesStepView \? \(?\s*\n?\s*<PapicStepFields/);
});

test('the simple page posts the picker INSIDE its form, or the picks go nowhere', () => {
  // The one way this wrapper can silently fail: rendered after </form>, the
  // hidden inputs post nothing, commitSimpleEvent reads null for all three, and
  // the couple's pick evaporates with no error anywhere. That is exactly where
  // the read-only card used to sit, so it is a one-line regression away.
  const simple = read('app/onboarding/simple/page.tsx');
  const openForm = simple.indexOf('<form');
  const closeForm = simple.indexOf('</form>');
  const picker = simple.indexOf('<PapicStepFields');
  assert.ok(openForm >= 0 && closeForm > openForm, 'the simple page must still have a form');
  assert.ok(picker > openForm, '<PapicStepFields> must come after <form>');
  assert.ok(
    picker < closeForm,
    '<PapicStepFields> is OUTSIDE the form — its hidden inputs post nothing and every pick is silently dropped',
  );
});

test('the three simple-page field names are spelled ONCE and shared', () => {
  // Reader and writer must agree. A field name spelled separately in the client
  // component and the server action still renders, still submits, and simply
  // returns null on the other side the day one of them is edited.
  const names = read('app/onboarding/simple/_components/papic-step-field-names.ts');
  const fields = read('app/onboarding/simple/_components/papic-step-fields.tsx');
  const action = read('app/onboarding/simple/actions.ts');
  for (const konst of [
    'PAPIC_FIELD_POOL_RUNG',
    'PAPIC_FIELD_ONE_RUNG',
    'PAPIC_FIELD_ONE_CAMERAS',
  ]) {
    assert.match(names, new RegExp(`export const ${konst} =`), `${konst} must be defined once`);
    assert.match(fields, new RegExp(konst), `${konst} must be USED by the inputs, not re-typed`);
    assert.match(action, new RegExp(konst), `${konst} must be READ by the action, not re-typed`);
  }
  // And neither side may carry a raw literal that could drift from the constant.
  for (const [file, src] of [['fields', fields], ['action', action]] as const) {
    assert.equal(
      /['"]papic_(pool_rung|one_rung|one_cameras)['"]/.test(src),
      false,
      `${file} spells a field name literally — use the shared constant`,
    );
  }
});

test('the step is not smuggled into the wedding paywall tail', () => {
  // The 2026-06-21 "no paywall in onboarding" lock: plan/services/summary stay
  // filtered. This screen is informational and must NOT join that set — nor may
  // the set quietly lose a member.
  const shell = read('app/onboarding/wedding/_components/onboarding-shell.tsx');
  assert.match(
    shell,
    /const PAYWALL_SCREENS: ReadonlySet<ScreenId> = new Set\(\['plan', 'services', 'summary'\]\);/,
  );
});

test('the step CHOOSES, it never checks out', () => {
  // ⚠ REASONING UPDATED 2026-08-11, ASSERTION DELIBERATELY UNCHANGED. This used
  // to be justified as "Papic is already on, nothing here may take money". The
  // owner has since made the step a picker that DOES lead to a charge — so the
  // rule it enforces now matters MORE, not less, and its shape is exactly right.
  //
  // The step is a CHOOSER. It collects an intent; the money is resolved in the
  // event-commit path, which re-reads every rung from the tier tables and every
  // price from the active catalog (SEC-4). If this file ever grew its own form,
  // submit button, or order/billing import, the browser would be deciding a
  // peso figure — which is the one thing the whole design refuses.
  const step = read('app/onboarding/_shared/services-step.tsx');
  const code = step.slice(step.indexOf("import {"));
  for (const forbidden of [
    /from '@\/app\/[^']*(order|checkout|billing)/i,
    /from '@\/lib\/[^']*(order|checkout|billing|entitlement)/i,
    /submitOrderAction/,
    /<form\b/,
    /type="submit"/,
  ]) {
    assert.equal(
      forbidden.test(code),
      false,
      `services-step.tsx must take no money — found ${forbidden}`,
    );
  }
});

test('the picker only appears where the commit carries the pick to an order', () => {
  // THE FAKE-DOOR RULE, pinned. The steppers render only when a mount passes
  // BOTH `selection` and `onSelectionChange`; a flow that passes them without
  // sending `servicesSelection` to its commit would show a couple a price, take
  // their choice, and charge nothing — losing the sale AND their shots, with
  // nothing anywhere to notice.
  const step = read('app/onboarding/_shared/services-step.tsx');
  assert.match(
    step,
    /const interactive = selection != null && onSelectionChange != null;/,
    'the controls must be gated on BOTH props, never on one',
  );

  // Every mount that hands the step a selection must also send it at commit.
  const MOUNTS: Array<[string, string]> = [
    ['app/onboarding/[type]/_components/generic-onboarding.tsx', 'commitOnboardingEvent'],
    ['app/onboarding/wedding/_components/onboarding-shell.tsx', 'commitOnboardingWedding'],
    ['app/onboarding/simple/_components/papic-step-fields.tsx', 'PAPIC_FIELD_POOL_RUNG'],
  ];
  for (const [file, proof] of MOUNTS) {
    const src = read(file);
    if (!/selection=\{/.test(src)) continue; // read-only mount — nothing to prove
    assert.match(
      src,
      /servicesSelection|PAPIC_FIELD_POOL_RUNG/,
      `${file} renders the picker but never carries the selection anywhere`,
    );
    assert.match(src, new RegExp(proof), `${file} must reach its commit path`);
  }

  // 🚨 SETNAYAN AI MUST BE PRICED BY THE CHARGE AUTHORITY, NEVER THE CATALOG.
  // Its price depends on the EVENT TYPE and that override is live in prod: the
  // flat catalog row is the WEDDING figure. Reading the catalog for it — which
  // is exactly what the two Papic branches in the same file correctly do —
  // would overcharge every non-wedding couple on their very first order, and
  // the order row would look perfectly well-formed. This pins the asymmetry.
  const minter = read('lib/onboarding-services-orders.ts');
  assert.match(
    minter,
    /resolveOrderChargeCentavos\(\{\s*\n?\s*serviceKey: SETNAYAN_AI_SKU/,
    'the AI order must be priced through resolveOrderChargeCentavos',
  );
  const aiBlock = minter.slice(minter.indexOf('selection.ai'));
  assert.equal(
    /priceOf\(admin, SETNAYAN_AI_SKU\)|service_code.*SETNAYAN_AI/.test(aiBlock),
    false,
    'the AI branch reads the flat catalog row — that is the WEDDING price',
  );

  // …and each commit path must actually mint from it.
  for (const file of [
    'app/onboarding/_shared/commit-event.ts',
    'app/onboarding/wedding/actions.ts',
    'app/onboarding/simple/actions.ts',
  ]) {
    assert.match(
      read(file),
      /mintOnboardingServiceOrders/,
      `${file} accepts a Papic selection but never turns it into an order`,
    );
  }
});

test('the pure half stays client-safe — the reader lives in its own module', () => {
  // The RSC trap this guards: `services-step.tsx` is a client component and
  // imports this module for `orderPapicTypes`. If the live reader lived here
  // too, `createAdminClient` (plus v2-catalog and event-type-profile) would be
  // pulled into the onboarding BROWSER bundle — "never import this from a client
  // component", as lib/supabase/admin.ts says. tsc and eslint both pass on that
  // mistake; only `next build` or a user would find it.
  // Scan the CODE, not the prose — the header legitimately names every module
  // it is keeping out, and a guard that reads comments guards nothing.
  const pure = stripComments(read('lib/onboarding/services-step-data.ts'));
  for (const forbidden of [
    /supabase\/admin/,
    /papic-tier-config-read/,
    /v2-catalog/,
    /event-type-profile/,
    /setnayan-ai-event-pricing/,
    /from 'react'/,
  ]) {
    assert.equal(
      forbidden.test(pure),
      false,
      `services-step-data.ts must stay client-safe — found an import matching ${forbidden}`,
    );
  }
  // …and the client component must reach the server module only through props.
  const step = stripComments(read('app/onboarding/_shared/services-step.tsx'));
  assert.equal(/services-step-server/.test(step), false);
});

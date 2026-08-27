/**
 * CUSTOM IS OFF THE CUSTOMER-FACING PAGES — AND THE BENEFIT COUNT KNOWS IT.
 *
 * ⚖ Owner 2026-08-27: *"hide customized first. let's stay with the 3 first."*
 * Four paid tiers were public; three are now. This pins the hide, and pins the
 * one thing about it that fails silently.
 *
 * 🔑 THE COUNT IS THE TRAP, NOT THE COMPONENTS. A hidden column is obvious the
 * moment anybody loads the page. The homepage overlay's headline "N benefits"
 * is derived — `VENDOR_TIER_SECTIONS` + `VENDOR_CUSTOM_TIER.dials` + the plan
 * capability rows — so leaving it alone would have gone on counting dials a
 * customer can no longer see anywhere. Nothing renders wrong; the number is
 * just quietly too big. That is the assertion this file exists for.
 *
 * ⛔ AND THE HIDE IS NOT `is_active = false` ON THE CATALOG ROWS — deliberately.
 * That would have made `fetchCustomUnitPrices` fall through to the hardcoded
 * `CUSTOM_UNIT_PRICE_FALLBACK` forever, so the owner could edit Custom's price
 * on the admin screen and nothing would change for a vendor. All six rows stay
 * ACTIVE; only render sites are gated. See lib/custom-tier-offered.ts.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CUSTOM_TIER_OFFERED_PUBLICLY } from './custom-tier-offered';
import {
  VENDOR_TIER_SECTIONS,
  VENDOR_CUSTOM_TIER,
} from '../app/_components/home/vendor-benefits';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const MATRIX = strip(
  readFileSync(join(WEB, 'app/vendors/_components/vendor-tier-matrix.tsx'), 'utf8'),
);
const DELTAS = strip(
  readFileSync(join(WEB, 'app/vendors/_components/vendor-tier-deltas.tsx'), 'utf8'),
);
const OVERLAY = strip(
  readFileSync(join(WEB, 'app/_components/home/HomeOverlays.tsx'), 'utf8'),
);
const SUBSCRIPTION = strip(
  readFileSync(join(WEB, 'app/vendor-dashboard/subscription/page.tsx'), 'utf8'),
);

test('the imports arrived — this guard cannot run on an empty module', () => {
  assert.ok(VENDOR_TIER_SECTIONS.length > 0, 'VENDOR_TIER_SECTIONS imported empty');
  assert.ok(VENDOR_CUSTOM_TIER.dials.length > 0, 'VENDOR_CUSTOM_TIER imported empty');
  assert.equal(typeof CUSTOM_TIER_OFFERED_PUBLICLY, 'boolean');
});

test('THE TRAP: the public benefit count excludes Custom while Custom is hidden', () => {
  /*
    Re-derived here the same way the overlay derives it, so this fails if the
    overlay ever stops honouring the flag — including if somebody "simplifies"
    the expression back to an unconditional `.dials.length`.
  */
  const named = VENDOR_TIER_SECTIONS.reduce(
    (n, s) => n + s.groups.reduce((m, g) => m + g.items.length, 0),
    0,
  );
  const PLAN_CAPABILITY_ROW_COUNT = 9;
  const expectedCustom = CUSTOM_TIER_OFFERED_PUBLICLY ? VENDOR_CUSTOM_TIER.dials.length : 0;

  assert.match(
    OVERLAY,
    /const custom = CUSTOM_TIER_OFFERED_PUBLICLY \? VENDOR_CUSTOM_TIER\.dials\.length : 0;/,
    'the overlay benefit count stopped honouring the hide — it is counting dials ' +
      'a customer cannot see, and nothing on the page would look wrong',
  );

  // And the arithmetic itself, so a change to either input is caught too.
  const total = named + expectedCustom + PLAN_CAPABILITY_ROW_COUNT;
  assert.ok(total > PLAN_CAPABILITY_ROW_COUNT, 'the count collapsed — inputs are empty');
  if (!CUSTOM_TIER_OFFERED_PUBLICLY) {
    assert.equal(
      expectedCustom,
      0,
      'Custom dials are still being counted into the public benefit total',
    );
  }
});

test('all four public render sites are gated on the one flag', () => {
  // 🔑 FOUR, NOT THREE. `/vendors` quotes a Custom figure in TWO places — the
  // matrix column AND a separate dark "beyond Enterprise" band lower down. An
  // earlier survey of this page listed only the column; hiding just that one
  // would have left the price on the page.
  const matrixGates = MATRIX.split('CUSTOM_TIER_OFFERED_PUBLICLY').length - 1;
  assert.ok(
    matrixGates >= 3,
    `the matrix has ${matrixGates} references to the flag — expected 3 ` +
      '(the column list, the "Custom adds" group, and the beyond-Enterprise band)',
  );
  assert.match(DELTAS, /CUSTOM_TIER_OFFERED_PUBLICLY \? \(/, 'the deltas Custom card is not gated');
  assert.match(OVERLAY, /CUSTOM_TIER_OFFERED_PUBLICLY/, 'the overlay count is not gated');
});

test('no public surface quotes a Custom price while it is hidden', () => {
  // Every `prices.customFrom` render must sit behind the flag. This catches a
  // NEW public site being added without one.
  for (const [name, src] of [['matrix', MATRIX], ['deltas', DELTAS]] as const) {
    const uses = src.split('prices.customFrom').length - 1;
    if (uses === 0) continue;
    assert.match(
      src,
      /CUSTOM_TIER_OFFERED_PUBLICLY/,
      `${name} renders prices.customFrom with no flag in the file`,
    );
  }
});

test('THE VENDOR PATH IS DELIBERATELY LEFT OPEN — this is not an oversight', () => {
  /*
    ⚖ The owner ruled the PUBLIC side only: "a supplier who already knows the
    way in can still buy one." A vendor's own dashboard is not the public side.
    Asserted so that a later tidy-up does not "finish the job" by gating the
    link or the route and quietly turn a hide into a retirement he did not ask
    for.
  */
  assert.match(
    SUBSCRIPTION,
    /href="\/vendor-dashboard\/subscription\/custom"/,
    'the vendor-side Custom link was removed — the ruling was PUBLIC surfaces only',
  );
  assert.ok(
    !/CUSTOM_TIER_OFFERED_PUBLICLY/.test(SUBSCRIPTION),
    'the vendor subscription page is gating on the PUBLIC hide flag — it must not',
  );
});

test('the catalog rows are NOT the hiding mechanism', () => {
  // The flag module must keep saying why, because the tempting "simplification"
  // is to flip is_active and delete all this — which silently freezes Custom's
  // prices at the hardcoded fallback.
  const flagSrc = readFileSync(join(HERE, 'custom-tier-offered.ts'), 'utf8');
  assert.match(
    flagSrc,
    /is_active/,
    'the flag module no longer explains why is_active was rejected — the next ' +
      'reader will flip it and freeze Custom prices at the hardcoded fallback',
  );
});

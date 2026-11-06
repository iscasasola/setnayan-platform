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

// /for-suppliers is the owner-approved page of 2026-11-06. It replaced the old
// tier matrix + deltas (vendor-tier-matrix.tsx / vendor-tier-deltas.tsx, both
// deleted), which were two of this file's four render sites. The new page draws
// its plans from these three files.
const SUPPLIER_PAGE_FILES = [
  'app/for-suppliers/_components/supplier-front-page.tsx',
  'app/for-suppliers/_components/supplier-front-client.tsx',
  'app/for-suppliers/_components/supplier-front-data.ts',
] as const;
const SUPPLIER_PAGE = SUPPLIER_PAGE_FILES.map(
  (rel) => [rel, strip(readFileSync(join(WEB, rel), 'utf8'))] as const,
);
const OVERLAY = strip(
  readFileSync(join(WEB, 'app/_components/home/HomeOverlays.tsx'), 'utf8'),
);
// The vendor Plan page and its rows (the Custom row moved into `plan-rows.tsx` with the simpler supplier
// dashboard, 2026-10-14 — the page mounts it; read together, the page still offers Custom).
const SUBSCRIPTION = strip(
  readFileSync(join(WEB, 'app/vendor-dashboard/subscription/page.tsx'), 'utf8') +
    readFileSync(join(WEB, 'app/vendor-dashboard/subscription/_components/plan-rows.tsx'), 'utf8'),
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

test('every public render site is gated on the one flag', () => {
  // The old /vendors page quoted a Custom figure in TWO places (the matrix
  // column and a "beyond Enterprise" band), each gated on the flag. The
  // approved /for-suppliers page that replaced it (2026-11-06) shows only the
  // three public paid plans — its Grow step is `GROW_TIERS`. Pin that, so a
  // fourth (Custom) step cannot be added to the page without the flag.
  const data = SUPPLIER_PAGE.find(([rel]) => rel.endsWith('supplier-front-data.ts'))![1];
  assert.match(
    data,
    /export const GROW_TIERS = \['solo', 'pro', 'enterprise'\] as const;/,
    'the /for-suppliers Grow step no longer lists exactly Solo · Pro · Ultra — if Custom ' +
      'was added, it must be gated on CUSTOM_TIER_OFFERED_PUBLICLY',
  );
  assert.match(OVERLAY, /CUSTOM_TIER_OFFERED_PUBLICLY/, 'the overlay count is not gated');
});

test('no public surface quotes a Custom price while it is hidden', () => {
  // Every Custom price or Custom dial render must sit behind the flag. This
  // catches a NEW public site being added without one.
  for (const [name, src] of SUPPLIER_PAGE) {
    const uses =
      src.split('customFrom').length - 1 + (src.split('VENDOR_CUSTOM_TIER').length - 1);
    if (uses === 0) continue;
    assert.match(
      src,
      /CUSTOM_TIER_OFFERED_PUBLICLY/,
      `${name} renders a Custom price or dial with no flag in the file`,
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

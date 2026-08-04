/**
 * 🔧 THE SERVICE WORKSPACE MAY NOT OVERSTATE WHAT THE VENDOR IS DELIVERING.
 *
 * Two overstatements on one heading, both closed here:
 *   • a line the couple REMOVED still printed under "What's included", because
 *     the page never read `customizations_json` at all;
 *   • an ADD-ON — never inside `total_price_centavos`, never charged — printed
 *     in that same list behind an inline " (optional add-on)" suffix.
 *
 * This is a server component, so the RULE is what is tested, not the JSX.
 * ./package-sections is the pure module the page imports, and it delegates the
 * bucketing to the receipt's own `receiptSections` — the two pages differ only
 * in which buckets they DISPLAY. The repo has no pattern for rendering
 * `app/**` pages; the co-located tests here are all pure modules
 * (`packages/[bookingId]/receipt-sections.test.ts`,
 * `[slug]/_lib/site-menu.test.ts`), so this follows those.
 *
 * The two source pins at the bottom exist because the WIRING is the half a pure
 * test cannot reach: a select that stops asking for `customizations_json`, or a
 * call that stops passing the removals through, restores defect #1 in full with
 * every rule test still green.
 *
 * NEUTRALISATION: dropping `customizations_json` from the page's
 * `event_vendor_packages` select fails
 * "the workspace page READS customizations_json — the removals it must honour".
 *
 * Pure module — no mocks, no env, no clock.
 * `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseRemovedItemIds, workspaceSections } from './package-sections';
import type {
  VendorPackageItemRow,
  VendorPackageWithItems,
} from '@/lib/vendor-packages';

type ItemOverrides = {
  id: string;
  included?: boolean;
  required?: boolean;
  parent?: string | null;
};

function item({
  id,
  included = true,
  required = false,
  parent = null,
}: ItemOverrides): VendorPackageItemRow {
  return {
    item_id: id,
    package_id: 'PKG',
    canonical_service: 'catering',
    service_description: `line ${id}`,
    is_default_included: included,
    is_required: required,
    replacement_value_centavos: 1_000_00,
    display_order: 0,
    created_at: '2026-07-27T00:00:00Z',
    parent_option_id: parent,
  };
}

function pkg(items: VendorPackageItemRow[]): VendorPackageWithItems {
  return {
    package_id: 'PKG',
    vendor_profile_id: 'VEN',
    package_name: 'All-in Reception',
    description: null,
    total_price_centavos: 100_000_00,
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    primary_canonical_service: 'catering',
    is_active: true,
    created_at: '2026-07-27T00:00:00Z',
    updated_at: '2026-07-27T00:00:00Z',
    items,
  };
}

const ids = (rows: ReadonlyArray<VendorPackageItemRow>) =>
  rows.map((i) => i.item_id);

/* ────────────────────────────────────────────────────────────────────────── */
/* 1. DEFECT 1 — a removed line printed as included                           */
/* ────────────────────────────────────────────────────────────────────────── */

test('a REMOVED line is not in what this page prints as included', () => {
  const s = workspaceSections(
    pkg([item({ id: 'kept' }), item({ id: 'dropped' })]),
    ['dropped'],
  );

  // 🔧 THE DAY-OF CLAIM. Everything in `included` is printed under "What's
  // included" — a statement that the vendor is delivering it. The couple
  // removed this line on the receipt; it is not being delivered.
  assert.deepEqual(ids(s.included), ['kept']);
});

test('a removed line is HIDDEN here — it is not quietly moved to the add-ons', () => {
  // The ruling is "hidden", not "relabelled". An add-on is a live option the
  // vendor still offers; a removed line is a settled past decision, and
  // printing it as something the couple could still take would be a new
  // overstatement in place of the old one. The receipt is where a removal is
  // verifiable, and it still shows one.
  const s = workspaceSections(
    pkg([item({ id: 'kept' }), item({ id: 'dropped' })]),
    ['dropped'],
  );

  assert.deepEqual(ids(s.addOns), []);
  assert.deepEqual([...ids(s.included), ...ids(s.addOns)], ['kept']);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 2. DEFECT 2 — an add-on printed inside the included list                   */
/* ────────────────────────────────────────────────────────────────────────── */

test('an ADD-ON is never in the included list', () => {
  const s = workspaceSections(
    pkg([item({ id: 'base' }), item({ id: 'addon', included: false })]),
    [],
  );

  assert.deepEqual(ids(s.included), ['base']);
});

test('the add-on is still SHOWN, in its own section — never silently dropped', () => {
  const s = workspaceSections(
    pkg([item({ id: 'base' }), item({ id: 'addon', included: false })]),
    [],
  );

  assert.deepEqual(ids(s.addOns), ['addon']);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 3. The `is_required` trap — the column the old select omitted              */
/* ────────────────────────────────────────────────────────────────────────── */

test('a REQUIRED line survives a removal id and stays in the included list', () => {
  // The lock path ignores a removal id on a required line and keeps charging
  // for it (`isRemovableItem`), so the vendor is still delivering it. This is
  // the branch the page's hand-typed select broke: it never asked for
  // `is_required`, so the column read `undefined` → falsy → the line would
  // have vanished from a day-of view while the couple was still paying for it.
  const s = workspaceSections(
    pkg([item({ id: 'must', required: true }), item({ id: 'optional' })]),
    ['must', 'optional'],
  );

  assert.deepEqual(ids(s.included), ['must']);
  assert.deepEqual(ids(s.addOns), []);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 4. A follow-up appears in NEITHER list                                     */
/* ────────────────────────────────────────────────────────────────────────── */

test('a FOLLOW-UP is in neither the included list nor the add-on list', () => {
  // Its legal database shape is `is_default_included = FALSE` (the CHECK
  // constraint forces it), which is also the add-on shape — so the add-on
  // section is exactly where an unguarded filter leaks it, offering "which
  // style of lechon?" as a line the couple could take on its own.
  const s = workspaceSections(
    pkg([
      item({ id: 'base' }),
      item({ id: 'followup', included: false, parent: 'OPT1' }),
    ]),
    [],
  );

  assert.deepEqual(ids(s.included), ['base']);
  assert.deepEqual(ids(s.addOns), []);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 5. `customizations_json` is jsonb — the shape is a promise, not a fact     */
/* ────────────────────────────────────────────────────────────────────────── */

test('a malformed customizations_json degrades to NO removals and never throws', () => {
  for (const malformed of [
    null,
    undefined,
    0,
    'not json at all',
    '[[[',
    true,
    [],
    {},
    { removed_item_ids: null },
    { removed_item_ids: 'kept' },
    { removed_item_ids: { 0: 'kept' } },
    { removed_item_ids: 42 },
  ]) {
    assert.deepEqual(
      parseRemovedItemIds(malformed),
      [],
      `expected [] for ${JSON.stringify(malformed) ?? 'undefined'}`,
    );
  }
});

test('a well-formed customizations_json yields exactly its string ids', () => {
  assert.deepEqual(parseRemovedItemIds({ removed_item_ids: ['a', 'b'] }), [
    'a',
    'b',
  ]);
  // A `json`-typed column, or a client that stringified before writing.
  assert.deepEqual(
    parseRemovedItemIds('{"removed_item_ids":["a"]}'),
    ['a'],
  );
});

test('non-string and empty entries are dropped, the rest survive', () => {
  // Partial garbage must not discard the real ids — that would print removed
  // lines as included, the defect this file exists to close.
  assert.deepEqual(
    parseRemovedItemIds({ removed_item_ids: ['a', '', null, 7, { x: 1 }, 'b'] }),
    ['a', 'b'],
  );
});

test('a malformed payload cannot make a removed line reappear as included', () => {
  // The end-to-end shape of the degradation: garbage in means "nothing was
  // removed", so the page prints the package as authored. That is an honest
  // fallback ONLY because a failed READ never reaches here — the page throws on
  // `error` rather than treating it as an empty removal list.
  const s = workspaceSections(
    pkg([item({ id: 'kept' }), item({ id: 'dropped' })]),
    parseRemovedItemIds({ removed_item_ids: 'dropped' }),
  );

  assert.deepEqual(ids(s.included), ['kept', 'dropped']);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 6. The wiring — pinned at source, because it is unreachable from a unit    */
/* ────────────────────────────────────────────────────────────────────────── */

/** The page sits beside this file, so the pin cannot drift on a route rename. */
const read = () => readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8');

test('the workspace page READS customizations_json — the removals it must honour', () => {
  // 💣 THE ORIGINAL DEFECT IN ONE MISSING WORD. The select was
  // `'package_id, status, total_locked_centavos'`; `removed_item_ids` lives in
  // `customizations_json` and was never fetched, so every removal was invisible
  // to this page. Every rule test above stays green with the column dropped —
  // only this one notices.
  const src = read();
  assert.match(src, /select\(\s*'[^']*customizations_json/);
});

test('the workspace page passes the parsed removals into workspaceSections', () => {
  // Fetching the column and then not using it is the same bug with an extra
  // round trip, so pin the call too.
  const src = read();
  assert.match(src, /parseRemovedItemIds\(/);
  assert.match(src, /workspaceSections\([\s\S]{0,400}?removedItemIds/);
});

test('the workspace page throws on a failed booking read instead of assuming no removals', () => {
  // A PostgREST error is NOT "no removals" — treating it as one prints removed
  // lines as included. This repo shipped a destructive bug from a swallowed
  // select error, so the read fails loudly.
  const src = read();
  assert.match(src, /bookingErr/);
  assert.match(src, /if \(bookingErr\) throw new Error\(bookingErr\.message\)/);
});

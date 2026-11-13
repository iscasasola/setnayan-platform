/**
 * ALL EIGHT FIELDS ARE ON THE ONE SHEET. (owner 2026-09-20)
 *
 * His list, verbatim:
 *   "Vendor Name · Contact Person · Contact Number · Address Pin ·
 *    Services Covered · Inclusions · Price · Payment Plan"
 *   …prefaced with "how about we keep it simple?"
 *
 * ── Why this needs a guard ────────────────────────────────────────────────
 * Four of those eight previously lived on two OTHER tabs of the vendor
 * workspace, and that is exactly how the whole problem was reported: the owner
 * stood on a Quote tab that rendered nothing while services, inclusions, price
 * and the payment plan sat one tab away. Scattering is the default state this
 * feature was built to escape, and nothing but a test stops a field drifting
 * back out — a `name=` that is deleted, or a component that stops being
 * mounted, breaks no types and fails no other suite.
 *
 * ⚠ IT ASSERTS THE MOUNT, NOT THE IMPORT. An imported component that nothing
 * renders is invisible to the couple and invisible to a grep for the import.
 * Each row below names the thing that actually reaches the DOM.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODAL = path.join(HERE, 'new-manual-vendor-modal.tsx');
/**
 * Since 2026-11-13 the Price row is "How the price works ▾" (One price · Per guest · Per hour), and the row itself
 * lives in `price-basis-rows.tsx` — shared with the record card's edit fold. The sheet MOUNTS it; the component
 * renders `total_cost_php`. Both halves are asserted below: the mount in the sheet, and the field in the component.
 */
const PRICE_ROWS = path.join(HERE, 'price-basis-rows.tsx');
const PRICE_FIELD = /\b(?:name|fieldName)="total_cost_php"/g;

/**
 * field → the string that proves it is RENDERED, not merely imported.
 * Since 2026-10-12 a typed field is a Form row (`TypedRow`) that posts under
 * `fieldName` (its hidden carrier IS `name=` in the DOM) — either spelling counts.
 */
const EIGHT: ReadonlyArray<readonly [string, RegExp]> = [
  ['Vendor name', /\b(?:name|fieldName)="business_name"/],
  ['Contact person', /\b(?:name|fieldName)="contact_person"/],
  ['Contact number', /\b(?:name|fieldName)="contact_number"/],
  ['Address pin', /<AddressPinField\b/],
  ['Services covered', /<ServicesCoveredPicker\b/],
  ['Inclusions', /\b(?:name|fieldName)="inclusions"/],
  ['Price', /<PriceBasisRows\b/],
  ['Payment plan', /<PaymentPlanRows\b/],
];

describe('the add-manually sheet carries all eight fields', () => {
  const src = readFileSync(MODAL, 'utf8');

  it('renders Price — the mounted row really draws the total_cost_php field', () => {
    assert.equal(
      (readFileSync(PRICE_ROWS, 'utf8').match(PRICE_FIELD) ?? []).length,
      1,
      'price-basis-rows.tsx no longer renders total_cost_php exactly once — the sheet mounts it for its Price.',
    );
  });

  it('found the sheet', () => {
    assert.ok(src.includes('Add a contact') || src.includes('Add manually'), 're-point this guard');
  });

  for (const [name, needle] of EIGHT) {
    it(`renders ${name}`, () => {
      assert.match(
        src,
        needle,
        `${name} is no longer rendered on the Add-manually sheet. All eight ` +
          'belong on ONE screen (owner 2026-09-20). If it moved to another ' +
          'surface on purpose, that is an owner decision — bring it back or ' +
          'get the decision, do not delete this assertion.',
      );
    });
  }
});

describe('one save, and one writer per fact', () => {
  const src = readFileSync(MODAL, 'utf8');

  it('submits through the single consolidated action', () => {
    assert.match(
      src,
      /await addManualSupplier\(fd\)/,
      'the sheet no longer saves through addManualSupplier. Eight fields ' +
        'across several sequential client calls can half-succeed and leave a ' +
        'supplier with no price beside a success screen.',
    );
  });

  it('does not keep a second price input on the post-save panel', () => {
    // The panel's old "Their package price" input was the price's second
    // writer once the sheet gained its own. Two inputs for one column is the
    // defect this repo keeps re-finding, and the couple has already answered.
    assert.ok(
      !/Their package price/.test(src),
      'the post-save panel has a price input again — the sheet already owns ' +
        'total_cost_php, so this is a second writer of one column.',
    );
    // The sheet's one price field lives in the row it mounts (price-basis-rows.tsx); counted across BOTH files,
    // so a second input in either is still a second writer.
    const rows = readFileSync(PRICE_ROWS, 'utf8');
    assert.equal(
      (src.match(PRICE_FIELD) ?? []).length + (rows.match(PRICE_FIELD) ?? []).length,
      1,
      'total_cost_php is rendered more than once across the sheet and its price row.',
    );
    assert.equal((src.match(/<PriceBasisRows\b/g) ?? []).length, 1, 'the sheet mounts its price row more than once.');
  });
});

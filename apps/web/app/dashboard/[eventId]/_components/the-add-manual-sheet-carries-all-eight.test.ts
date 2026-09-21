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

/** field → the string that proves it is RENDERED, not merely imported. */
const EIGHT: ReadonlyArray<readonly [string, RegExp]> = [
  ['Vendor name', /name="business_name"/],
  ['Contact person', /name="contact_person"/],
  ['Contact number', /name="contact_number"/],
  ['Address pin', /<AddressPinField\b/],
  ['Services covered', /<ServicesCoveredPicker\b/],
  ['Inclusions', /name="inclusions"/],
  ['Price', /name="total_cost_php"/],
  ['Payment plan', /<PaymentPlanRows\b/],
];

describe('the add-manually sheet carries all eight fields', () => {
  const src = readFileSync(MODAL, 'utf8');

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
    assert.equal(
      (src.match(/name="total_cost_php"/g) ?? []).length,
      1,
      'total_cost_php is rendered more than once in this file.',
    );
  });
});

/**
 * THE CLAIM LINK MUST NOT BE A ONE-SHOT. (2026-09-20)
 *
 * ── The defect ────────────────────────────────────────────────────────────
 * The add-a-contact modal offers a supplier's claim QR the moment they are
 * added — at status 'considering', per the owner's 2026-07-01 directive. That
 * panel is destroyed when the modal closes. This page was the only other door,
 * and it refused to even OFFER to make a link until `status` reached
 * contracted+. So a couple who added a supplier and dismissed the modal had
 * nowhere left to get the QR.
 *
 * Owner, 2026-09-20: "i failed the qr code to import the vendor. i dont have
 * access for this qr and link to share to the vendor."
 *
 * Measured on prod the same day: `Seda Vertis North` — added that morning,
 * category `venue`, status `considering`, off platform — with ZERO rows in
 * `vendor_invites`. Re-measure, never trust this sentence:
 *   select ev.vendor_name, ev.status,
 *          (select count(*) from vendor_invites vi where vi.vendor_id = ev.vendor_id)
 *     from public.event_vendors ev where ev.archived_at is null;
 *
 * ── What this guard pins ──────────────────────────────────────────────────
 * That the `canOfferInvite` decision reads ONLY the two facts that bear on it
 * — is this supplier off platform, and is there already a live invite — and
 * never the booking's status again. `canInviteSupplier`'s own docblock says
 * the two axes are independent (owner, 2026-09-02); this stops the page
 * re-marrying them.
 *
 * ⚠ A SOURCE GUARD, so it is pinned to the ASSIGNMENT, not to the file. It
 * slices from `const canOfferInvite` to the first `;` and asserts on that
 * window alone — a `ev.status` anywhere else on this 2,900-line page is none
 * of its business, and a guard that reacted to one would be noise nobody
 * trusts. If the expression is ever refactored out of an assignment this test
 * FAILS LOUD (the anchor is asserted present) rather than passing vacuously.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, 'page.tsx');
const ANCHOR = 'const canOfferInvite';

describe('the claim link outlives the add modal', () => {
  const src = readFileSync(PAGE, 'utf8');

  it('still has exactly one canOfferInvite assignment to guard', () => {
    const hits = src.split(ANCHOR).length - 1;
    assert.equal(
      hits,
      1,
      `expected one \`${ANCHOR}\` assignment in page.tsx, found ${hits}. ` +
        'If it moved or was renamed, re-point this guard — do not delete it.',
    );
  });

  it('does not gate the invite on the booking status', () => {
    const start = src.indexOf(ANCHOR);
    const end = src.indexOf(';', start);
    assert.ok(end > start, 'could not find the end of the canOfferInvite expression');
    const expr = src.slice(start, end);

    assert.ok(
      !/\bev\.status\b/.test(expr),
      'canOfferInvite reads ev.status again. Being off platform and being ' +
        'booked are independent axes (owner 2026-09-02) — a couple must be ' +
        'able to re-open the claim QR for a supplier they have only just ' +
        'added. See lib/supplier-invite-eligibility.ts.\nExpression was:\n' +
        expr,
    );
    assert.ok(
      !/'contracted'|'deposit_paid'|'delivered'|'complete'/.test(expr),
      'canOfferInvite names a booking status. Same rule as above — the ' +
        'status clause is what produced the dead end on 2026-09-20.\n' +
        'Expression was:\n' +
        expr,
    );
  });

  it('still asks the shared eligibility predicate', () => {
    const start = src.indexOf(ANCHOR);
    const expr = src.slice(start, src.indexOf(';', start));
    assert.ok(
      /needsInvite/.test(expr),
      'canOfferInvite no longer reads `needsInvite` (canInviteSupplier). ' +
        'Dropping the status clause must not also drop the ONE eligibility ' +
        'gate — that would offer a claim link to a supplier who already has ' +
        'an account.',
    );
    assert.ok(
      /autoShareInvite/.test(expr),
      'canOfferInvite no longer checks for an existing invite, so the page ' +
        'would offer to CREATE one beside a live one it is already showing.',
    );
  });
});

/**
 * The second half of the same defect: a tab that can only ever render nothing.
 *
 * `VendorProposalsCard` opens `if (!marketplaceVendorId) return null`, so for
 * a self-added supplier the Quote tab was a blank page you could land on —
 * and the owner did, on a locked venue, while the price editor he wanted sat
 * one tab away. A `return null` is invisible to a grep of the page, so the
 * guard is on the page's own condition.
 */
describe('no tab that can only ever be blank', () => {
  const src = readFileSync(PAGE, 'utf8');

  it('offers the Quote tab only when there can be a quote to show', () => {
    assert.ok(
      /const hasQuotesToShow = Boolean\(ev\.marketplace_vendor_id\)/.test(src),
      'the Quote tab is no longer conditioned on the supplier having an ' +
        'account. VendorProposalsCard returns null without one, so the tab ' +
        'renders an empty page.',
    );
    assert.ok(
      /hasQuotesToShow\s*$|hasQuotesToShow\n|hasQuotesToShow\s*\?/m.test(src),
      'hasQuotesToShow is computed but never used to gate the tab.',
    );
  });
});

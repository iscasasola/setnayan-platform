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
 * ── What this guard pins (re-pointed 2026-11-02) ──────────────────────────
 * The claim link's door moved off this page to the supplier's row on
 * Suppliers › Booked › Team (`ClaimDoor`, booked-row.tsx — corpus
 * SCHEDULE_CHAPTERS_BUILD_PLAN "Sync: … Move its door to the Team row"). The
 * same rule follows it there: whether the row offers the link reads ONLY
 * whether the supplier is off platform (`canInviteSupplier`) — never the
 * booking's status — and its Share asks the ONE idempotent link writer, so a
 * link is there tomorrow whether or not one was made in the add modal.
 * Pinned to the ASSIGNMENT (`invite:` in lib/booked-rows.ts) — if it is
 * refactored away this FAILS LOUD (the anchor is asserted present).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, 'page.tsx');
const WEB = path.resolve(HERE, '..', '..', '..', '..', '..', '..');
const ROWS = path.join(WEB, 'lib', 'booked-rows.ts');
const ROW = path.join(WEB, 'app', 'dashboard', '[eventId]', 'vendors', '_components', 'booked-row.tsx');
const ANCHOR = 'invite: canInviteSupplier(';

describe('the claim link outlives the add modal', () => {
  const src = readFileSync(ROWS, 'utf8');

  it('still has exactly one invite assignment to guard', () => {
    const hits = src.split(ANCHOR).length - 1;
    assert.equal(hits, 1, `expected one \`${ANCHOR}\` in lib/booked-rows.ts, found ${hits}. Re-point this guard — do not delete it.`);
  });

  it('does not gate the invite on the booking status', () => {
    const start = src.indexOf(ANCHOR);
    const expr = src.slice(start, src.indexOf('\n', start));
    assert.ok(!/\bstatus\b|'contracted'|'deposit_paid'|'delivered'|'complete'/.test(expr), `the Team row's invite reads a booking status again:\n${expr}`);
  });

  it('the door asks the one link writer, which makes a link when there is none', () => {
    const row = readFileSync(ROW, 'utf8');
    assert.match(row, /\{row\.invite \? <ClaimDoor\b/, 'the Team row no longer draws its claim door from `invite`');
    assert.match(row, /function ClaimDoor[\s\S]{0,1400}?<SupplierShareButton\b/, 'the claim door no longer shares through the one link writer');
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

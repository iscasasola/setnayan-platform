/**
 * promote-vendor-invite-nudge.test.ts
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * Owner ruling 2026-09-08 (DECISION_LOG.md): a couple could already invite an
 * off-platform supplier onto Setnayan (`createManualVendorInvite` /
 * `ensureAutoShareInvite`, live since 2026-05-22), but the ONLY surface for it
 * was a one-time card shown right after a couple manually typed a vendor's
 * details in — nothing nudged them to it afterwards. Production: 44 of 45
 * booked suppliers were never invited this way (DECISION_LOG.md 2026-08-30).
 * The owner ruling: "we allow this. so promote it."
 *
 * This adds a second surface — a badge on the couple's own booked-vendor cards
 * (`plan-budget-accordion.tsx`'s `VendorCardAtom`) that a couple actually
 * revisits, not just a modal they see once. It reuses the EXACT existing
 * mechanism (no new write path): `needs_setnayan_invite` is stamped onto every
 * pick by `bucketVendorsByGroup` (lib/wedding-plan-groups.ts) using the SAME
 * `canInviteSupplier` gate the per-vendor workspace page's invite CTA already
 * calls (lib/supplier-invite-eligibility.ts, added 2026-09-03) — never a
 * second, independently-derived answer to "does this supplier have an
 * account?".
 *
 * ── WHAT COULD SILENTLY BREAK THIS ──────────────────────────────────────────
 *   1. THE STAMP re-deriving the fact from a proxy (a missing photo, a null
 *      business name) instead of the real `marketplace_vendor_id` column —
 *      exactly the class of bug CLAUDE.md's "guards must test the claim" note
 *      warns about. Tested behaviourally below against `canInviteSupplier`
 *      itself, not a hand-copied truth table.
 *   2. THE RENDER GATE losing its `locked &&` half — without it the badge
 *      would appear on considering/inquiring picks too, which is NOT what the
 *      per-vendor workspace page offers (`canOfferInvite` ANDs the same
 *      locked-status test) and would nudge the couple to invite a supplier
 *      they haven't actually booked yet.
 *   3. THE LINK losing its `#invite-vendor` anchor, silently downgrading the
 *      nudge to "click through, then scroll the whole workspace page to find
 *      the CTA" — the exact kind of dead-end the review comment on
 *      `createManualVendorInvite`'s one call site describes for the mechanism
 *      this reuses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { bucketVendorsByGroup, type EventVendorRowInput } from './wedding-plan-groups';
import { canInviteSupplier } from './supplier-invite-eligibility';
import { stripComments } from './strip-comments';

const CARD_FILE = path.join(
  __dirname,
  '..',
  'app',
  'dashboard',
  '[eventId]',
  'vendors',
  '_components',
  'plan-budget-accordion.tsx',
);
const WORKSPACE_PAGE = path.join(
  __dirname,
  '..',
  'app',
  'dashboard',
  '[eventId]',
  'vendors',
  '[vendorId]',
  'workspace',
  'page.tsx',
);

function code(file: string): string {
  return stripComments(fs.readFileSync(file, 'utf8'));
}

function count(haystack: string, needle: string | RegExp): number {
  if (typeof needle === 'string') return haystack.split(needle).length - 1;
  return haystack.match(new RegExp(needle, 'g'))?.length ?? 0;
}

function baseRow(overrides: Partial<EventVendorRowInput>): EventVendorRowInput {
  return {
    vendor_id: 'v-1',
    vendor_name: 'Test Supplier',
    category: 'catering',
    status: 'contracted',
    ...overrides,
  } as EventVendorRowInput;
}

/* ── 1 · THE STAMP — bucketVendorsByGroup, not a proxy ────────────────────── */

test('a locked off-platform pick is stamped needs_setnayan_invite = true', () => {
  const picks = [
    ...bucketVendorsByGroup([
      baseRow({ vendor_id: 'v-off', status: 'contracted', marketplace_vendor_id: null }),
    ]).values(),
  ].flat();
  const pick = picks.find((p) => p.vendor_id === 'v-off');
  assert.equal(pick?.needs_setnayan_invite, true);
});

test('a locked pick with a linked account is stamped false — they already have one', () => {
  const picks = [
    ...bucketVendorsByGroup([
      baseRow({ vendor_id: 'v-linked', status: 'contracted', marketplace_vendor_id: 'vp_1' }),
    ]).values(),
  ].flat();
  const pick = picks.find((p) => p.vendor_id === 'v-linked');
  assert.equal(pick?.needs_setnayan_invite, false);
});

test('the stamp is exactly canInviteSupplier — never a re-derived proxy', () => {
  // Same shapes the shared predicate's own guard test exercises
  // (one-gate-decides-a-supplier-invite.test.ts): absent column, null,
  // empty string, undefined, and a real id. If this ever drifts to reading
  // a stand-in field (missing photo, null business name, absent manual
  // contact), THIS is the test that catches it, not just the CSS.
  const shapes: Array<Partial<EventVendorRowInput>> = [
    {},
    { marketplace_vendor_id: null },
    { marketplace_vendor_id: undefined },
    { marketplace_vendor_id: '' },
    { marketplace_vendor_id: 'vp_9' },
    // A manual contact card must be irrelevant — same rule the shared
    // predicate enforces (event_manual_vendors requires contact fields a
    // name-only supplier can never have).
    { marketplace_vendor_id: null, manual_vendor_id: 'mv_1' },
    { marketplace_vendor_id: 'vp_9', manual_vendor_id: 'mv_1' },
  ];
  for (const shape of shapes) {
    const row = baseRow({ vendor_id: 'v-x', status: 'contracted', ...shape });
    const picks = [...bucketVendorsByGroup([row]).values()].flat();
    const pick = picks.find((p) => p.vendor_id === 'v-x');
    assert.equal(
      pick?.needs_setnayan_invite,
      canInviteSupplier(row),
      `stamp disagreed with canInviteSupplier for ${JSON.stringify(shape)}`,
    );
  }
});

test('an UNLOCKED off-platform pick still carries the fact — the AND with "locked" is the card\'s job', () => {
  // The model answers ONE question (does this supplier have an account?).
  // Whether the booking is real enough to nudge about is a per-surface AND,
  // deliberately left to the render gate (mirrors the workspace page's own
  // `canOfferInvite`, which ANDs a locked-status test onto the same fact).
  const picks = [
    ...bucketVendorsByGroup([
      baseRow({ vendor_id: 'v-considering', status: 'considering', marketplace_vendor_id: null }),
    ]).values(),
  ].flat();
  const pick = picks.find((p) => p.vendor_id === 'v-considering');
  assert.equal(
    pick?.needs_setnayan_invite,
    true,
    'the fact is unconditional — only the RENDER decides whether to act on it',
  );
});

/* ── 2 · THE RENDER GATE — locked AND the fact, exactly once ──────────────── */

test('⭐ THE GUARD · the card nudge is gated on locked AND needs_setnayan_invite together', () => {
  const src = code(CARD_FILE);
  assert.match(
    src,
    /\{locked && pick\.needs_setnayan_invite && \(/,
    'the badge must require BOTH — the fact alone would nudge for an unbooked considering pick too',
  );
  assert.equal(
    count(src, 'needs_setnayan_invite'),
    1,
    'the card must read the field exactly once — a second, ungated read would bypass the locked check',
  );
});

test('⭐ THE GUARD · the nudge links straight to the existing invite CTA, not just the vendor page', () => {
  const src = code(CARD_FILE);
  assert.match(
    src,
    /workspace#invite-vendor/,
    'without the anchor the couple lands at the top of the workspace page and has to find the CTA themselves',
  );
  assert.equal(
    count(src, 'className="invite-cta"'),
    1,
    'exactly one mount — a second would mean a duplicate or an orphaned first attempt',
  );
});

test('⭐ THE GUARD · the workspace page actually carries that anchor', () => {
  const src = code(WORKSPACE_PAGE);
  assert.match(
    src,
    /<div id="invite-vendor">/,
    'the anchor the card links to must actually exist on the landing page',
  );
});

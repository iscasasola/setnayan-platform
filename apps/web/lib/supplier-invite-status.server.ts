import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchLatestInvitesByVendorIds } from './vendor-invites';
import {
  supplierInviteStatus,
  type InviteStatusByVendorId,
  type SupplierInviteStatus,
} from './supplier-invite-status';

/**
 * Where each supplier's claim link stands, for the couple's Suppliers page —
 * the read half of `lib/supplier-invite-status.ts`.
 *
 * It is `fetchLatestInvitesByVendorIds`, the helper `lib/vendor-invites.ts` has
 * carried since 2026-05 "to compute the status pill alongside each row" and
 * which no page ever called: one read for the whole list, the newest link per
 * supplier.
 *
 * ⚠ `null` MEANS THE READ FAILED, and the page must say so. `{}` means it was
 * read and nobody has a link. The two must never be collapsed: a couple whose
 * supplier declined would otherwise read a row that looks as if no link had
 * ever been sent.
 *
 * Under the caller's own session: `vendor_invites_couple_read` admits the
 * couple's rows. A viewer the policy does not admit reads zero rows — the card
 * then draws no link line at all, which claims nothing.
 */
export async function readInviteStatusByVendorId(
  supabase: SupabaseClient,
  vendorIds: readonly string[],
  nowMs: number,
): Promise<InviteStatusByVendorId> {
  if (vendorIds.length === 0) return {};
  try {
    const latest = await fetchLatestInvitesByVendorIds(supabase, [...vendorIds]);
    const out: Record<string, SupplierInviteStatus> = {};
    for (const [vendorId, invite] of latest) {
      const status = supplierInviteStatus(
        { status: invite.status, sentAt: invite.sent_at, expiresAt: invite.expires_at },
        nowMs,
      );
      if (status) out[vendorId] = status;
    }
    return out;
  } catch (e) {
    console.error(
      '[supabase-error] lib/supplier-invite-status.server.ts · vendor_invites.select',
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

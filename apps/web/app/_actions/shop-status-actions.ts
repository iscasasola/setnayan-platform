'use server';

/**
 * ⏸ SHOP STATUS — the supplier's door (Shop ⚙ › Shop status: pause · reopen their own pause · close) and any
 * in-place admin caller (owner 2026-10-31 *"They can pause and close. Admin can also do that"*; 2026-11-16 "AN
 * ADMIN-HIDDEN SHOP IS PAUSED FOR EVERYTHING NEW"). One export: every exported "use server" function is one Vercel
 * route (`scripts/lint-server-action-budget.mjs`).
 *
 * Everything — who may, the audit row, the notice — is `applyShopStatus` (lib/shop-status.server.ts), which the
 * admin's Pause on /admin/verify (`setVendorPause`) also runs, so the two doors cannot drift.
 *
 * ⚠ No supplier screen calls this yet — the Shop status row waits on an owner-approved drawing.
 */
import { applyShopStatus, type ApplyShopStatusResult } from '@/lib/shop-status.server';
import type { ShopStatus } from '@/lib/shop-status';

export type SetShopStatusResult = ApplyShopStatusResult;

export async function setShopStatus(input: {
  vendorProfileId: string;
  status: ShopStatus;
  /** An admin's note for the audit log. Ignored for a supplier. */
  reason?: string | null;
}): Promise<SetShopStatusResult> {
  return applyShopStatus(input);
}

/**
 * lib/supplier-storage.ts — THE PLAN HOLDS STORAGE, THE PURE HALF.
 *
 * Owner 2026-11-13 (specs DECISION_LOG, commit ce2d0a8 "plan storage"): *Solo 5 GB · Pro 10 GB · Ultra 15 GB*, included
 * in the plan. Free and Free · Verified were given no allowance and keep what they had: no limit, nothing drawn.
 *
 *   · the number   — `TIER_CAPS[plan].storageBytes` (lib/vendor-tier-caps.ts), twin `vendor_tier_limit(…,'storage_gb')`.
 *   · what counts  — each stored copy a filed event file still points at, once (`vendor_storage_used_bytes`, read by
 *                    `readStoredBytes` in lib/downgrade-limits.server.ts). Removing a file from its events makes room;
 *                    nothing is ever deleted by the allowance.
 *   · shown        — the Plan's "Storage" row: "1.2 GB of 5 GB used" (`storageRowLine`); a read that failed SAYS so and
 *                    never shows 0 (`STORAGE_UNREAD`).
 *   · refused      — `/api/upload` before any bytes move, and the database (`enforce_supplier_storage_allowance`) for
 *                    every other path; both say `storageFullMessage` with the way up (`STORAGE_UPGRADE_HREF`).
 *
 * The paid packs `vendor_storage_5/10/15gb` stay inactive: nothing here offers or prices them.
 *
 * PURE: no I/O, no env. 🔒 lib/supplier-storage.test.ts
 */
import { storageWords } from './downgrade-limits';
import { TIER_CAPS, VENDOR_TIERS, asVendorTier, tierCaps, tierRank, type VendorTier } from './vendor-tier-caps';
import { planWord } from './vendor-plan-change-words';

/** The machine-readable half of a refusal (the sentence is `storageFullMessage`). */
export const STORAGE_FULL_CODE = 'supplier_storage_full';

/** Where "move to a plan that holds more" goes — the shop's Plan. */
export const STORAGE_UPGRADE_HREF = '/vendor-dashboard/subscription';

/** The Plan row's line when what the shop stores could not be read — said, never a 0. */
export const STORAGE_UNREAD = 'Couldn’t read what you store just now — nothing is lost';

/** The refusal when the allowance could not be checked — fail CLOSED, plain reason + try again. */
export const STORAGE_CHECK_FAILED = 'We couldn’t check your storage just now. Nothing was uploaded — try again in a moment.';

/**
 * The storage a plan holds, in bytes — READ FROM `TIER_CAPS`. Null = the plan has no allowance (Free · Verified).
 * (Re-exported by lib/downgrade-limits.server.ts, where the limits sheet has always asked for it.)
 */
export function storageAllowanceBytes(plan: string | null | undefined): number | null {
  return tierCaps(plan).storageBytes;
}

/** Bytes in the words a supplier reads — "0 MB" for nothing (storageWords floors at 1 MB). */
function words(bytes: number): string {
  return bytes <= 0 ? '0 MB' : storageWords(bytes);
}

/** The next plan up that holds more than this one, or null (Ultra — the packs are not on sale). */
export function nextStoragePlan(plan: string | null | undefined): VendorTier | null {
  const current = asVendorTier(plan);
  const have = TIER_CAPS[current].storageBytes;
  if (have === null) return null; // no allowance to outgrow
  for (const t of VENDOR_TIERS) {
    if (tierRank(t) <= tierRank(current)) continue;
    const s = TIER_CAPS[t].storageBytes;
    if (s !== null && s > have) return t;
  }
  return null;
}

/**
 * The Plan's "Storage" row. Null = the row is not drawn (a plan with no allowance — the screen stays as it was).
 *   ok      "1.2 GB of 5 GB used" · "5 GB of 5 GB used · full" · "6.1 GB of 5 GB used · over — new files wait for room"
 *   unread  `STORAGE_UNREAD` — never "0 MB of 5 GB used".
 */
export function storageRowLine(
  plan: string | null | undefined,
  read: { status: 'ok'; bytes: number } | { status: 'unread' },
): string | null {
  const allowance = storageAllowanceBytes(plan);
  if (allowance === null) return null;
  if (read.status !== 'ok') return STORAGE_UNREAD;
  const base = `${words(read.bytes)} of ${storageWords(allowance)} used`;
  if (read.bytes > allowance) return `${base} · over — new files wait for room`;
  if (read.bytes === allowance) return `${base} · full`;
  return base;
}

/**
 * The plain reason an upload is refused, with the way up. Names THIS plan's number; the next plan's number when there
 * is one. Nothing already stored is touched, and the sentence never says otherwise.
 */
export function storageFullMessage(plan: string | null | undefined, usedBytes: number, incomingBytes: number): string {
  const allowance = storageAllowanceBytes(plan) ?? 0;
  const name = planWord(asVendorTier(plan));
  const left = Math.max(0, allowance - Math.max(0, usedBytes));
  const next = nextStoragePlan(plan);
  const up = next ? ` or move to ${planWord(next)} for ${storageWords(TIER_CAPS[next].storageBytes ?? 0)}` : '';
  const reason =
    left < 1e6
      ? `Your ${name} plan’s ${storageWords(allowance)} of storage is full.`
      : `This file is ${words(incomingBytes)}, and your ${name} plan has ${words(left)} of its ${storageWords(allowance)} left.`;
  return `${reason} Remove files from an event to make room${up}. Nothing you stored was changed.`;
}

/** Does `incomingBytes` more fit? `null` allowance = no limit on this plan. */
export function storageFits(plan: string | null | undefined, usedBytes: number, incomingBytes: number): boolean {
  const allowance = storageAllowanceBytes(plan);
  if (allowance === null) return true;
  return Math.max(0, usedBytes) + Math.max(0, incomingBytes) <= allowance;
}

/** True for the database's refusal (`enforce_supplier_storage_allowance` raises 'storage_allowance: …'). */
export function isStorageRefusal(message: string | null | undefined): boolean {
  return typeof message === 'string' && message.includes('storage_allowance');
}

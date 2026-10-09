/**
 * lib/studio-egifts-saves.ts — WHAT STUDIO › E-GIFTS SENDS, as pure functions (2026-10-09, "the remaining Studio pages wear the
 * templates", E-Gifts first).
 *
 * The E-Gifts page is LIVE for its ways to give and its registry link (`event_egift_methods`, `events.gift_registry_url` — payment
 * details guests see at once), so moving its controls onto the Form row / Switch templates must not change one byte of what is
 * posted. The fields each press sends are built HERE, once, and `studio-tools.tsx` posts exactly these — so a test can run them
 * (`studio-egifts-posts-the-same.test.ts` holds them against the payloads recorded from the page as it stood before any control
 * moved), instead of describing them.
 *
 * Pure: no React, no I/O, no server import (this file rides the lazy Maker-details chunk with its caller, never the first load).
 */
import { EGIFT_KIND_META, type EgiftMethodKind } from './egift-kinds';

/** The stored way as the page reads it — only what the writer carries forward. */
export type EgiftStored = { egift_method_id: string; label: string | null; note: string | null; qr_r2_key: string | null } | null;

/**
 * Creating or changing a way (`saveEgiftMethod`): the number/link, the name on the account and the QR. A way that already exists
 * keeps its label, its note and (unless a QR is being set or removed right now) its QR; a new one is born with the kind's own
 * label. `qrRef` — `undefined` = leave the stored QR alone, a ref = set it, '' = remove it.
 */
export function egiftMethodFields(a: {
  stored: EgiftStored;
  kind: EgiftMethodKind;
  accountName: string;
  handle: string;
  qrRef?: string;
}): Record<string, string> {
  return {
    ...(a.stored ? { egift_method_id: a.stored.egift_method_id } : {}),
    method_kind: a.kind,
    label: a.stored?.label ?? EGIFT_KIND_META[a.kind].defaultLabel,
    account_name: a.accountName,
    handle: a.handle,
    note: a.stored?.note ?? '',
    qr_r2_key: a.qrRef !== undefined ? a.qrRef : (a.stored?.qr_r2_key ?? ''),
  };
}

/** Showing or hiding a way from guests (`setEgiftMethodEnabled`) — a hide is never a delete. */
export function egiftEnabledFields(id: string, on: boolean): Record<string, string> {
  return { egift_method_id: id, is_enabled: on ? 'true' : 'false' };
}

/** The registry link (`savePabuyaMessage`): the cleaned link, or '' for none. */
export function registryFields(link: string | null): Record<string, string> {
  return { gift_registry_url: link ?? '' };
}

/**
 * Does leaving a way's box send anything? Nothing is sent when what was typed is what is stored, and nothing is created from an
 * empty number — the account is made the first time a number is typed and left.
 */
export function egiftMethodNeedsSaving(a: {
  stored: { handle: string | null; account_name: string | null } | null;
  accountName: string;
  handle: string;
}): boolean {
  if (a.stored) return !((a.stored.handle ?? '') === a.handle.trim() && (a.stored.account_name ?? '') === a.accountName.trim());
  return a.handle.trim() !== '';
}

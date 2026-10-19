/**
 * lib/inspiration-suggestions.ts — 🤝🖼 SUPPLIER PHOTO SUGGESTIONS, the words and the shape both sides share (owner
 * 2026-10-19, DECISION_LOG "SUPPLIERS ADD INSPIRATION BY THEIR CATEGORY — EVERY PART, ATTIRE INCLUDED" + "FIVE
 * CONTROLLER RECOMMENDATIONS APPROVED" item 4 = option (b); prototype `supplier_inspiration_suggestions_2026-10-19.html`,
 * corpus 27eeb5e3; migration 20271279311294).
 *
 * A supplier BOOKED on the event suggests photos to the parts of ITS OWN category — the ONE slot→trade map
 * (`MOODBOARD_SLOT_TRADES`, the same `slotUploadVerdict` the inspiration library uses), mirrored in SQL by
 * `inspiration_suggestion_services` and enforced there (`vendor_begin_inspiration_suggestion`). Each photo goes through
 * the shipped content screen before it reaches the couple, and WAITS beside the couple's own photos with ✓ Keep · ✕ No
 * thanks. A part holding three asks which photo a Keep replaces. In-app only — nothing here sends an email.
 *
 * Pure and client-safe (no taxonomy, no server import): the parts a shop may suggest to are worked out on the server
 * (`suggestablePartsForShop`, `lib/inspiration-suggestion-parts.ts`) and handed down as keys.
 */

/** Up to three photos may wait per part per shop (the SQL function's own cap; this is only the words). */
export const SUGGESTIONS_WAITING_MAX = 3;

/** One waiting suggestion, as the couple's Palette draws it. */
export type CoupleSuggestion = {
  id: string;
  slotKey: string;
  shop: string;
  url: string;
  /** The photo's six sampled colours (what a Keep writes to the board). */
  swatches: string[];
};

/** One of the supplier's own suggestions, as its board draws it. */
export type SupplierSuggestion = {
  id: string;
  slotKey: string;
  url: string;
  state: 'waiting' | 'kept' | 'declined';
};

/** The couple's notice at the top of Palette (prototype frame 4): "2 suggestions from your suppliers". */
export function suggestionNoticeTitle(n: number): string {
  return `${n} ${n === 1 ? 'suggestion' : 'suggestions'} from your suppliers`;
}
export const SUGGESTION_NOTICE_LINE = 'Tap one to see it beside your photos';

/** A suggestion's two lines in its block (prototype frame 3): "From Bloom & Co." · "A photo for Bridal bouquet". */
export function suggestionFrom(shop: string): string {
  return `From ${shop}`;
}
export function suggestionFor(part: string): string {
  return `A photo for ${part}`;
}

/** The toast after Keep (prototype frame 5) — the shop sees it on its own board. */
export function keptToast(shop: string): string {
  return `Kept. ${shop} will see it.`;
}

/** The sheet when Keep lands on a part that already holds three (prototype frame 3b). */
export function fullSheetTitle(part: string): string {
  return `${part} already has 3 photos`;
}
export function fullSheetLine(shop: string): string {
  return `Which one does ${shop}’s photo replace?`;
}
export function fullSheetIncoming(shop: string): string {
  return `${shop}’s photo takes its place`;
}
export const FULL_SHEET_KEEP_ALL = 'Keep all three for now';

/**
 * The count beside a part's photos on the couple's side (prototype frame 5): "3 photos · 1 from Bloom & Co." — the
 * photos kept from a supplier are named by shop, one clause per shop.
 */
export function coupleCountLine(photos: number, fromShops: ReadonlyArray<string | null | undefined>): string {
  const base = photos === 0 ? 'No photos yet' : `${photos} ${photos === 1 ? 'photo' : 'photos'}`;
  const by = new Map<string, number>();
  for (const s of fromShops) if (s) by.set(s, (by.get(s) ?? 0) + 1);
  return [base, ...[...by].map(([shop, n]) => `${n} from ${shop}`)].join(' · ');
}

/**
 * The count beside a part's photos on the SUPPLIER's side (prototype frames 1–2): the couple's photos, then what this
 * shop has waiting — "Waiting to be kept" when that is all there is.
 */
export function supplierCountLine(couplePhotos: number, waiting: number): string {
  if (waiting === 0) return couplePhotos === 0 ? 'No photos yet' : `${couplePhotos} ${couplePhotos === 1 ? 'photo' : 'photos'}`;
  if (couplePhotos === 0) return 'Waiting to be kept';
  return `${couplePhotos} ${couplePhotos === 1 ? 'photo' : 'photos'} · ${waiting} waiting to be kept`;
}

/** The supplier's toast after sending (prototype frame 2): "Sent to Ice & Claire." */
export function sentToast(couple: string): string {
  return `Sent to ${couple}.`;
}

/** The supplier's line under the couple's name (prototype frame 1): "You are their florist — you can add photos to Flowers." */
export function supplierRoleLine(trade: string | null, groups: readonly string[]): string {
  const where = groups.length === 0 ? null : groups.length === 1 ? groups[0]! : `${groups.slice(0, -1).join(', ')} and ${groups[groups.length - 1]!}`;
  if (!where) return 'None of your shop’s services dress a part of this board yet.';
  return trade ? `You are their ${trade.toLowerCase()} — you can add photos to ${where}.` : `You can add photos to ${where}.`;
}

/** The small credit mark on a kept photo (prototype frame 5's "B"). */
export function shopInitial(shop: string): string {
  const m = shop.trim().match(/[\p{L}\p{N}]/u);
  return m ? m[0]!.toUpperCase() : '·';
}

/** The supplier's refusal words, by the SQL function's status. */
export const SUGGEST_REFUSAL: Readonly<Record<'wrong_trade' | 'full' | 'not_booked' | 'fee_unsettled' | 'failed', string>> = {
  wrong_trade: 'That part is for another kind of supplier — your shop’s services don’t dress it.',
  full: `${SUGGESTIONS_WAITING_MAX} of your photos are already waiting there — wait for the couple to keep one, or take one back.`,
  not_booked: 'You can suggest photos once you are booked on this event.',
  fee_unsettled: 'Settle the booking fee first — then you can suggest photos.',
  failed: 'That photo didn’t go through. Please try again.',
};

/** The couple's words when a Keep / No thanks / Undo did not land. */
export const DECIDE_NOT_SAVED = 'That didn’t go through — nothing changed. Please try again.';

/**
 * 🔑 KEEP NEVER REPLACES SILENTLY — what a Keep press does, decided before anything is sent: into a free place
 * (`keep`), into the photo the couple NAMED (`replace`), or, on a part with no free place and no photo named, ASK
 * (the "already has 3 photos" sheet) and send nothing. The database answers the same way (`full`) if the screen is
 * ever wrong about what is free.
 */
export function keepPlan(freePositions: readonly number[], named: number | null): { kind: 'keep' } | { kind: 'replace'; position: number } | { kind: 'ask' } {
  if (named !== null) return { kind: 'replace', position: named };
  return freePositions.length > 0 ? { kind: 'keep' } : { kind: 'ask' };
}

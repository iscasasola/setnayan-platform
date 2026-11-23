/**
 * lib/supplier-client-room.ts — HOW MANY CLIENTS A PLAN'S STORAGE HOLDS, ROUGHLY. PURE.
 *
 * Owner 2026-11-23 (specs DECISION_LOG "SUPPLIER SIZES FIXED"), verbatim: *"Give them a quick range of how many clients
 * can they serve"*. He asked *"up to 200 clients? or booked services?"*; the answer is CLIENTS: one client = one booked
 * event with that supplier.
 *
 * The range is COMPUTED from the plan's size (`TIER_CAPS[t].storageBytes`), never typed, so a size change moves every
 * card that says it. Every constant below names its source. They are estimates for a sales line, never a limit:
 * the only limit is the storage itself (lib/supplier-storage.ts).
 *
 *   one client = CLIENT_PHOTOS photos + their records (booking, line items, payments and a basic chat)
 *   fewest     = (plan − the shop's own photos, high) ÷ (5 × PHOTO_BYTES_FULL + CLIENT_RECORDS_BYTES)
 *   most       = (plan − the shop's own photos, low)  ÷ (5 × PHOTO_BYTES_COMPRESSED + CLIENT_RECORDS_BYTES)
 *
 * Both ends are rounded to a friendly number (`friendlyRound`). From 10,000 clients up the card says the size in
 * words ("tens of thousands of clients"), so a paid size reads as limitless.
 *
 * 🔒 lib/supplier-client-room.test.ts
 */
import { formatCount } from './format-number';
import { TIER_CAPS, asVendorTier } from './vendor-tier-caps';

const KB = 1_000;
const MB = 1_000_000;

/** Photos one client leaves in the shop's storage (owner brief 2026-11-23: "a client = 5 photos + a basic chat + their booking data"). */
export const CLIENT_PHOTOS = 5;

/** A full photo: a phone-compressed 2000 px JPEG is ~1 MB (lib/chat-file-rules.ts, `CHAT_PHOTO_MAX_MB`'s note). The FEWEST-clients end. */
export const PHOTO_BYTES_FULL = 1 * MB;

/**
 * A compressed photo: the 720p download + 400 px thumbnail form (DECISION_LOG 2026-11-03 "THE PHOTO RULE",
 * lib/papic-fullres-drop-core.ts) is ~150 KB. The MOST-clients end.
 */
export const PHOTO_BYTES_COMPRESSED = 150 * KB;

/**
 * One client's records, chat included: ~13 KB, measured on prod 2026-11-23 (a booking ~240 B, a line item ~120 B,
 * a payment ~170 B, a chat message ~210 B, summed over a real client).
 */
export const CLIENT_RECORDS_BYTES = 13 * KB;

/** The shop's own photos (its page, cover, service cards), taken off the top: ~2 MB (fewest) to ~10 MB (most). */
export const SHOP_OWN_BYTES_LOW = 2 * MB;
export const SHOP_OWN_BYTES_HIGH = 10 * MB;

/** From this many clients up, the card says the size in words instead of numbers. */
export const CLIENT_WORDS_FROM = 10_000;

/** The friendly steps inside each power of ten. */
const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** The nearest friendly number (by ratio): 23.5 → 25 · 165 → 150 · 1,308 → 1,200 · 131,000 → 120,000. At least 1. */
export function friendlyRound(n: number): number {
  if (!Number.isFinite(n) || n <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  const x = n / p;
  let best = STEPS[0]!;
  for (const s of STEPS) if (Math.abs(Math.log(x / s)) < Math.abs(Math.log(x / best))) best = s;
  return Math.round(best * p);
}

/** The rough range of clients `storageBytes` holds, rounded; null when the size is unknown. */
export function clientRange(storageBytes: number | null | undefined): { low: number; high: number } | null {
  if (typeof storageBytes !== 'number' || !Number.isFinite(storageBytes) || storageBytes <= 0) return null;
  const fewest = Math.max(0, storageBytes - SHOP_OWN_BYTES_HIGH) / (CLIENT_PHOTOS * PHOTO_BYTES_FULL + CLIENT_RECORDS_BYTES);
  const most = Math.max(0, storageBytes - SHOP_OWN_BYTES_LOW) / (CLIENT_PHOTOS * PHOTO_BYTES_COMPRESSED + CLIENT_RECORDS_BYTES);
  return { low: friendlyRound(fewest), high: friendlyRound(most) };
}

/** A count past CLIENT_WORDS_FROM, said as its size. */
function sizeWords(n: number): string {
  if (n >= 1_000_000) return 'over a million';
  if (n >= 100_000) return 'hundreds of thousands of';
  return 'tens of thousands of';
}

/**
 * The plan card's line: "Room for about 25–150 clients" · "Room for tens of thousands of clients".
 * Null when the plan's size is unknown (the card then draws no line, never a guess).
 */
export function clientRangeWords(plan: string | null | undefined): string | null {
  const r = clientRange(TIER_CAPS[asVendorTier(plan)].storageBytes);
  if (!r) return null;
  if (r.low >= CLIENT_WORDS_FROM) return `Room for ${sizeWords(r.low)} clients`;
  return `Room for about ${formatCount(r.low)}–${formatCount(r.high)} clients`;
}

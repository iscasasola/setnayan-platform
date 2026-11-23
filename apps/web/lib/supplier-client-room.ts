/**
 * lib/supplier-client-room.ts — HOW MANY CLIENTS A PLAN'S STORAGE KEEPS AT A TIME, ROUGHLY. PURE.
 *
 * Owner 2026-11-23 (specs DECISION_LOG "SUPPLIER SIZES FIXED"), verbatim:
 *   · *"Give them a quick range of how many clients can they serve"*. One client = one booked event with that supplier.
 *   · *"add * that this is just an estimate of a booked client with 5 photos collected for that event only."*
 *   · *"up to X clients as preserved data. but they can still get more client by deleting data of their older clients?"*:
 *     the number is the clients a shop KEEPS stored at one time; clearing an older client's photos makes room.
 *   · Q "Do we say the Storage is or what the storage can do for them?" → *"Yes, clients first"*: every plan card leads
 *     with `clientsKeptWords`, with `planStorageLine` under it and `CLIENTS_FOOTNOTE` once under the cards.
 *
 * The count is COMPUTED from the plan's size (`TIER_CAPS[t].storageBytes`), never typed, so a size change moves every
 * card. It is an estimate for a sales line, never a limit: the only limit is the storage itself (lib/supplier-storage.ts).
 * There is no chat & documents room since 2026-11-23 ("Yes, drop it"), so the whole plan holds photos.
 *
 *   clients kept = (plan − the shop's own photos) ÷ (CLIENT_PHOTOS × PHOTO_BYTES + CLIENT_RECORDS_BYTES), rounded DOWN
 *
 * From 10,000 clients up the card says the size in words ("tens of thousands of clients"), so a paid size reads as
 * limitless.
 *
 * 🔒 lib/supplier-client-room.test.ts
 */
import { storageWords } from './downgrade-limits';
import { formatCount } from './format-number';
import { TIER_CAPS, asVendorTier } from './vendor-tier-caps';

const KB = 1_000;
const MB = 1_000_000;

/** Photos one client leaves in the shop's storage (owner 2026-11-23: "a booked client with 5 photos collected for that event only"). */
export const CLIENT_PHOTOS = 5;

/**
 * One kept photo, compressed: the 720p download + 400 px thumbnail form (DECISION_LOG 2026-11-03 "THE PHOTO RULE",
 * lib/papic-fullres-drop-core.ts), ~150 KB. (A fresh phone photo is ~1 MB, lib/chat-file-rules.ts; the estimate counts
 * the kept, compressed form, as the owner asked: "free should only be 50 clients compressed photos".)
 */
export const PHOTO_BYTES = 150 * KB;

/**
 * One client's records, chat included: ~13 KB, measured on prod 2026-11-23 (a booking ~240 B, a line item ~120 B,
 * a payment ~170 B, a chat message ~210 B, summed over a real client).
 */
export const CLIENT_RECORDS_BYTES = 13 * KB;

/** The shop's own photos (its page, cover, service cards), taken off the top: ~2 MB. */
export const SHOP_OWN_BYTES = 2 * MB;

/** From this many clients up, the card says the size in words instead of a number. */
export const CLIENT_WORDS_FROM = 10_000;

/** The footnote under the plan cards — one string, read by every surface that shows the asterisk. */
export const CLIENTS_FOOTNOTE = `*An estimate: one booked client with ${CLIENT_PHOTOS} photos collected for that event only.`;

/** Rounded DOWN to a friendly number, so the card never promises more: 62.9 → 60 · 128 → 120 · 1,308 → 1,300 · 65,530 → 65,000. */
export function friendlyFloor(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 0;
  const step = n < 10 ? 1 : n < 100 ? 5 : 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.floor(n / step) * step;
}

/** About how many clients `storageBytes` keeps at a time; null when the size is unknown. */
export function clientsKept(storageBytes: number | null | undefined): number | null {
  if (typeof storageBytes !== 'number' || !Number.isFinite(storageBytes) || storageBytes <= 0) return null;
  const perClient = CLIENT_PHOTOS * PHOTO_BYTES + CLIENT_RECORDS_BYTES;
  return friendlyFloor(Math.max(0, storageBytes - SHOP_OWN_BYTES) / perClient);
}

/** A count past CLIENT_WORDS_FROM, said as its size. */
function sizeWords(n: number): string {
  if (n >= 1_000_000) return 'over a million';
  if (n >= 100_000) return 'hundreds of thousands of';
  return 'tens of thousands of';
}

const isWords = (n: number) => n >= CLIENT_WORDS_FROM;

/**
 * The plan card's headline: "Keeps about 60 clients at a time*" · "Keeps tens of thousands of clients*".
 * Null when the plan's size is unknown (the card then leads with its size, never a guess).
 */
export function clientsKeptWords(plan: string | null | undefined): string | null {
  const n = clientsKept(TIER_CAPS[asVendorTier(plan)].storageBytes);
  if (n === null) return null;
  return isWords(n) ? `Keeps ${sizeWords(n)} clients*` : `Keeps about ${formatCount(n)} clients at a time*`;
}

/**
 * The line under the headline: the size, from `TIER_CAPS` via `storageWords`. A plan whose count is a number also says
 * how to make room ("50 MB storage · clear older clients’ photos to make room"); a paid size says its size alone.
 */
export function planStorageLine(plan: string | null | undefined): string | null {
  const bytes = TIER_CAPS[asVendorTier(plan)].storageBytes;
  if (bytes === null) return null;
  const n = clientsKept(bytes);
  const base = `${storageWords(bytes)} storage`;
  return n !== null && !isWords(n) ? `${base} · clear older clients’ photos to make room` : base;
}

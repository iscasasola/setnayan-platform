/**
 * 🎁 OWN CLIENTS v3 + v4 — "Add a client", and the gift every own client carries (owner, 16 Nov 2026).
 *
 * ⚖ DECISION_LOG 2026-11-16 (closed, do not re-ask):
 *   · OWN CLIENTS v4 (both rows) — the drawing `prototypes/supplier_own_clients_2026-11-16/
 *     supplier_own_clients_v4_2026-11-16_fable.html` (specs 5af4037b), approved for building.
 *   · NO CAP ON CLIENT IMPORTS — no counter, no limit wall, no plan row. Nothing here counts invites.
 *   · EVERY SUPPLIER IMPORT CARRIES AT LEAST ONE SETNAYAN GIFT — at least one line, always.
 *   · GIFTS ARE ALWAYS BOUGHT AS STOCK FIRST — the menu lists ONLY the shop's stock; with none (or too little) the step
 *     lists what can be bought, paid with the shipped Buy gifts sheet. Nothing is ever put on a booking fee bill.
 *   · v4 answer 1 — the own link's gift is SET ONCE ON THE CODE.
 *   · v4 answer 3 — a BADGE-REWARD gift does not count: it is listed greyed, "Doesn't count here".
 *   · v4 answer 4 — no 40% gift limit on an own client (there is no booking fee to measure it against).
 *
 * Pure (no I/O). Every title, count and price comes from the live catalogue (`ShopGiftPack`) and the stock ledger —
 * nothing here types a number a customer pays. The one door the gift takes is `own_client_gift_give` (migration
 * `own_clients_carry_a_gift`); the I/O half is `lib/own-clients.server.ts`.
 *
 * 🎁 EVERY GIFT KIND: Papic credits land in the couple's pool; an Event Plus / Pro / Ultra unlocks the event the way the
 * quote door does (one unit each). Each kind is counted from its OWN bought stock — never pooled across kinds.
 */
import { SHOP_GIFT_KINDS, freeByKind, giftCount, type FreeByKind, type ShopGiftKind, type ShopGiftPack, type ShopGiftStocks } from './shop-gifts';
import { shopInvitePath } from './shop-address';

/** One gift line on an own client, as stored (`vendor_client_invites.gift_lines`, `vendor_own_link_gifts`). */
export type OwnGiftLine = { service_code: string; title: string; kind: ShopGiftKind; credits: number };

/**
 * At most this many gift lines on one client. ONE number, said twice on purpose and held equal by a guard
 * (`lib/own-clients.test.ts` reads the migration): `vendor_client_invites_gift_lines_shape` and the door's own refusal.
 */
export const OWN_GIFT_MAX_LINES = 5;

/* ── 🪪 verified: ONE test, shared by every screen and the server ─────────────────────────────────────────────── */

/**
 * Is this shop verified, for own-client purposes? `verification_state = 'verified'` — the SAME test the claim and the
 * own-link door use, so a screen never promises what the server will not keep. (Not `isMarketplaceVendorBookable`:
 * since 15 Nov an unverified shop is bookable, and its imports still pay the flat 5%.)
 */
export function shopIsVerified(verificationState: unknown): boolean {
  return verificationState === 'verified';
}
export const COULD_NOT_CHECK_VERIFIED =
  'We couldn’t check your verification just now — reload to see whether bookings from your QR can be free.';

/** The menu key that opens "buy more" instead of picking a gift. */
export const OWN_GIFT_BUY_KEY = '__buy';

/* ── the words (the drawing's, byte for byte) ──────────────────────────────────────────────────────────────────── */

export const ADD_CLIENT_TITLE = 'Add a client';
export const ADD_CLIENT_ROW_LINE = 'Their invite comes with a Setnayan gift from you';
// Copy: owner 2026-11-16 ("7. Yes" on #7889) — the drawing's lines, re-worded to the import-fee ruling.
export const OWN_CLIENT_PROMISE = 'Your clients can book you free.';
export const OWN_CLIENT_PROMISE_LINE = 'Each one comes with at least one Setnayan gift from you';
export const OWN_CLIENT_PROMISE_TIP =
  'Each client you add comes with a Setnayan gift from your stock — one is used when they join; an invite nobody uses costs nothing more. A client new to Setnayan books you with no booking fee for 12 months. A client already on Setnayan books free only for an event you are the first supplier to add them to. Gifts from a badge reward don’t count here.';
export const ADD_CLIENT_LEAD = 'Clients new to Setnayan book you free for a year. Each one comes with a Setnayan gift from you.';
export const CONFIRM_BOOKING_FEE = 'None if they are new to Setnayan, or you are the first supplier on their event';
export const GIFT_FROM_YOU = 'Gift from you';
/** The shipped Buy gifts sheet's added line on "Buy and add" (the drawing, part 2). */
export const BUY_AND_ADD_NOTE = 'This client is added with one of them.';
export const GIFT_WITH_YOUR_LINK = 'Gift with your link';
export const AT_LEAST_ONE = 'At least one';
export const GIFT_STEP_TIP =
  'Picked from the gifts you already bought. It is used from your stock only when the couple joins, and lands on their event as a gift from you. A gift from a badge reward can’t be this gift — it is Setnayan’s.';
export const ADD_ANOTHER_GIFT = '＋ Add another gift';
export const NO_STOCK_LINE = 'No gifts in your stock yet. Buy one now — it goes into your stock, then onto this client.';
export const TOO_LITTLE_STOCK_LINE = 'Not enough in your stock for this. Buy more — it goes into your stock, then onto this client.';
export const BUY_MORE = '＋ Buy more for your stock';
export const BUY_MORE_LINE = 'Packs, bundles, plans';
export const REWARD_DOES_NOT_COUNT = 'Doesn’t count here';
export const OWN_LINK_EACH_LINE = '1 from your stock is used for each couple who joins through it';
export const OWN_LINK_COVERS = 'The same gift goes with My page, Check a date and Reviews when you share them as your own.';
export const OWN_LINK_EMPTY =
  'Your stock is empty. Your link still works, but a couple who joins now is not yet your own client — buy more gifts.';
/**
 * Owner 2026-11-16 ("8. Yes" on #7889): a VERIFIED shop sharing its own link with no gift on it is told FIRST — on every
 * own code it can share (My page · Check a date · Reviews), before any ask through it is charged the fee.
 */
export const OWN_LINK_ADD_GIFT = 'Add a gift to your link so your clients book free.';
/**
 * 🪪 UNVERIFIED SHOPS DO GET THE QR (owner 2026-11-16, DECISION_LOG "UNVERIFIED SHOPS DO GET THE QR", amending
 * 34909f12): an unverified shop keeps Add a client and its own link, and its couples can join and book — but every
 * booking pays the flat 5% (no free import, no free year). Its screens carry the owner's line, verbatim.
 */
export const GET_VERIFIED_LINE = 'Get verified to qualify for free bookings from your QR.';
export const GET_VERIFIED_HREF = '/vendor-dashboard/profile#docs';


/** "1 from your stock is used when the couple joins" — counted in gifts, never credits. */
export function usedWhenJoinsLine(lines: number): string {
  const n = Math.max(1, Math.trunc(lines));
  return `${n} from your stock ${n === 1 ? 'is' : 'are'} used when the couple joins`;
}

/** "From your stock · 7 left". */
export function fromStockLine(left: number | null): string {
  return left === null ? 'From your stock · couldn’t count it' : `From your stock · ${giftCount(left)} left`;
}

/* ── the stock, as gifts (per kind) ───────────────────────────────────────────────────────────────────────────── */

const ZERO: FreeByKind = Object.fromEntries(SHOP_GIFT_KINDS.map((k) => [k, 0])) as FreeByKind;

/**
 * What is free to give AS AN OWN-CLIENT GIFT, per kind: free to offer, less what is still badge reward (v4 answer 3).
 * The database door measures exactly this (`own_client_gift_give`). Null = the stock could not be read — never 0.
 */
export function boughtFreeByKind(free: FreeByKind | null, rewardLeft: FreeByKind | null | undefined): FreeByKind | null {
  if (!free) return null;
  const out = { ...ZERO };
  for (const k of SHOP_GIFT_KINDS) {
    const reward = rewardLeft ? Math.max(0, Math.min(free[k], rewardLeft[k] ?? 0)) : 0;
    out[k] = Math.max(0, free[k] - reward);
  }
  return out;
}

/** How many of one pack a kind's stock covers ("7 left"). */
export function packsLeft(units: number | null | undefined, pack: Pick<ShopGiftPack, 'credits'>): number | null {
  if (units === null || units === undefined || !Number.isFinite(units) || pack.credits <= 0) return null;
  return Math.max(0, Math.floor(units / pack.credits));
}

/** The packs on sale that can be an own-client gift — every kind, Papic first (the catalogue's order). */
export function ownGiftPacks(packs: readonly ShopGiftPack[] | null): ShopGiftPack[] {
  return [...(packs ?? [])];
}

/** What the picked codes need, per kind, read from the catalogue; null when any code is not a pack on sale. */
export function needByKind(codes: readonly string[], packs: readonly ShopGiftPack[] | null): FreeByKind | null {
  const on = ownGiftPacks(packs);
  const out = { ...ZERO };
  for (const c of codes) {
    const p = on.find((x) => x.code === c);
    if (!p) return null;
    out[p.kind] += p.credits;
  }
  return out;
}

/** Do the needs fit the stock, every kind? */
export function fitsStock(need: FreeByKind | null, free: FreeByKind | null): boolean {
  if (!need || !free) return false;
  return SHOP_GIFT_KINDS.every((k) => need[k] <= free[k]);
}

/** The stock left for ONE line once every OTHER line is counted — two lines never promise the same unit twice. */
export function roomForLine(
  free: FreeByKind | null,
  packs: readonly ShopGiftPack[] | null,
  picks: readonly string[],
  index: number,
): FreeByKind | null {
  if (!free) return null;
  const others = needByKind(picks.filter((_, j) => j !== index), packs) ?? ZERO;
  const out = { ...ZERO };
  for (const k of SHOP_GIFT_KINDS) out[k] = Math.max(0, free[k] - others[k]);
  return out;
}

/** One choice in the gift ▾ (the `PickMenu` shape: `disabledNote` = listed, not pickable, and why). */
export type OwnGiftOption = { key: string; label: string; hint?: string; disabledNote?: string };

/**
 * The gift ▾: YOUR STOCK ONLY. One row per pack its kind's bought stock covers ("7 left"); a greyed badge-reward row
 * per kind the shop holds some of; then "＋ Buy more for your stock".
 */
export function ownGiftMenu(
  packs: readonly ShopGiftPack[] | null,
  room: FreeByKind | null,
  rewardLeft: FreeByKind,
  canBuy: boolean,
): OwnGiftOption[] {
  const out: OwnGiftOption[] = [];
  for (const p of ownGiftPacks(packs)) {
    const left = room ? packsLeft(room[p.kind], p) : null;
    if (left === null) {
      out.push({ key: p.code, label: p.title, disabledNote: 'Couldn’t read your gift stock right now' });
    } else if (left > 0) {
      out.push({ key: p.code, label: p.title, hint: `${giftCount(left)} left` });
    }
  }
  for (const k of SHOP_GIFT_KINDS) {
    const first = ownGiftPacks(packs).find((p) => p.kind === k);
    if ((rewardLeft[k] ?? 0) > 0 && first) {
      out.push({ key: `__reward_${k}`, label: `${first.title} · badge reward`, disabledNote: REWARD_DOES_NOT_COUNT });
    }
  }
  if (canBuy) out.push({ key: OWN_GIFT_BUY_KEY, label: BUY_MORE, hint: BUY_MORE_LINE });
  return out;
}

/** Is any pack pickable at all? False ⇒ the step shows the buy list instead of the ▾. */
export function anyPackPickable(packs: readonly ShopGiftPack[] | null, free: FreeByKind | null): boolean {
  if (!free) return false;
  return ownGiftPacks(packs).some((p) => (packsLeft(free[p.kind], p) ?? 0) > 0);
}

/** The first pack the stock covers — "one is picked for you from your stock". Null when none is. */
export function defaultOwnGift(packs: readonly ShopGiftPack[] | null, free: FreeByKind | null): string | null {
  if (!free) return null;
  return ownGiftPacks(packs).find((p) => (packsLeft(free[p.kind], p) ?? 0) > 0)?.code ?? null;
}

/**
 * The lines to STORE for the picked codes — titles, kinds and units from the catalogue, never from the browser. Null
 * when a code is not a pack on sale, there is none, or there are too many.
 */
export function ownGiftLinesOf(codes: readonly string[], packs: readonly ShopGiftPack[] | null): OwnGiftLine[] | null {
  if (codes.length < 1 || codes.length > OWN_GIFT_MAX_LINES) return null;
  const on = ownGiftPacks(packs);
  const out: OwnGiftLine[] = [];
  for (const c of codes) {
    const p = on.find((x) => x.code === c);
    if (!p) return null;
    out.push({ service_code: p.code, title: p.title, kind: p.kind, credits: p.credits });
  }
  return out;
}

/** "Papic 150" · "2 × Papic 150 and Papic 1000" — the confirm's Gift row. */
export function ownGiftWords(lines: readonly Pick<OwnGiftLine, 'title'>[]): string {
  const order: string[] = [];
  const n = new Map<string, number>();
  for (const l of lines) {
    const t = l.title.trim();
    if (!t) continue;
    if (!n.has(t)) order.push(t);
    n.set(t, (n.get(t) ?? 0) + 1);
  }
  const parts = order.map((t) => ((n.get(t) ?? 1) > 1 ? `${n.get(t)} × ${t}` : t));
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** A stored gift row → its one line, or null when the row is not a gift kind the door gives. */
export function ownLinkGiftLineOf(row: { service_code?: unknown; title?: unknown; gift_kind?: unknown; credits?: unknown } | null): OwnGiftLine | null {
  if (!row || typeof row.service_code !== 'string' || typeof row.title !== 'string') return null;
  const kind = SHOP_GIFT_KINDS.find((k) => k === row.gift_kind);
  if (!kind) return null;
  const credits = Number(row.credits);
  if (!Number.isInteger(credits) || credits <= 0 || (kind !== 'papic' && credits !== 1)) return null;
  return { service_code: row.service_code, title: row.title, kind, credits };
}

/* ── the invite ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The query key an Add-a-client invite rides on (`/<shop>/invite?ci=<token>` — `shopInvitePath`). */
export const CLIENT_INVITE_PARAM = 'ci';

export const CLIENT_INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function clientInviteTokenOf(raw: unknown): string | null {
  return typeof raw === 'string' && CLIENT_INVITE_TOKEN_RE.test(raw) ? raw : null;
}

/** The invite link: the shop's invite door (`shopInvitePath` — the address move), carrying this client's token. */
export function clientInviteUrl(origin: string, slug: string, token: string): string {
  return `${origin.replace(/\/$/, '')}${shopInvitePath(encodeURIComponent(slug))}?${CLIENT_INVITE_PARAM}=${encodeURIComponent(token)}`;
}

/** What the share sheet says with the link — from the shop, in the supplier's own voice. */
export function clientInviteShareText(clientName: string, shopName: string | null): string {
  const first = clientName.trim().split(/\s+/)[0] || 'there';
  return `Hi ${first}! Here is your invite to plan with ${shopName?.trim() || 'us'} on Setnayan — it comes with a gift from us.`;
}

/** The email-or-phone check the sheet and the server share: an email, or a number with at least 7 digits. */
export function isEmailOrPhone(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 3 || t.length > 160) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return true;
  return /^[+()\d\s.-]+$/.test(t) && (t.match(/\d/g) ?? []).length >= 7;
}

/**
 * The gift step's numbers, from the SAME read Shop › Promote's "Your gifts" makes (`loadShopGiftsSection`), so the
 * two screens can never disagree about the stock.
 */
export function ownGiftDataOf<R extends { id: string; label: string }>(g: {
  stock: ShopGiftStocks | null;
  packs: ShopGiftPack[] | null;
  paysGiftPrice: boolean;
  canBuy: boolean;
  openRails: R[];
  rewards?: { left: FreeByKind | null } | undefined;
}) {
  // Every kind the catalogue knows (`freeByKind`, the shared reader) — a kind added later can never be missed here.
  const free = freeByKind(g.stock);
  const rewardLeft = { ...ZERO };
  if (free && g.rewards?.left) for (const k of SHOP_GIFT_KINDS) rewardLeft[k] = Math.max(0, Math.min(free[k], g.rewards.left[k] ?? 0));
  return {
    packs: g.packs,
    free: boughtFreeByKind(free, g.rewards?.left ?? null),
    rewardLeft,
    canBuy: g.canBuy,
    paysGiftPrice: g.paysGiftPrice,
    openRails: g.openRails,
  };
}

/* ── the import's fee facts (owner 2026-11-16, "A NEW ACCOUNT IS FREE FOR ONE YEAR…") ───────────────────────── */

/** What `own_client_gift_give` recorded about one import. `null` = not known (an own-link arrival has no invite). */
export type ImportFacts = { accountNew: boolean | null; eventNew: boolean | null; firstImport: boolean };

/**
 * Does this import make the couple the shop's OWN client (no booking fee)? The ruling (specs d4899cd5, amended
 * 9fe95ebe the same day):
 *   (1) the import CREATED the client's account → yes (the 12-month window is the fee logic's to measure, from the
 *       import's own timestamp);
 *   (2) an existing account → yes for THAT event when this shop is its FIRST imported supplier — the event may be new
 *       or already on Setnayan (9fe95ebe dropped "new event"; `eventNew` stays recorded, it no longer decides);
 *   (3) every other supplier on that event → no — the normal booking fee (the gift is still given).
 * Unknown is never free. ⚠ "An earlier Setnayan contact with this supplier makes it a Setnayan booking" is the fee
 * logic's arm (it reads the thread, saves and views), not decided here.
 */
export function importIsOwnClient(f: ImportFacts, shopVerified: boolean): boolean {
  // An unverified shop's import is never free ("UNVERIFIED SHOPS DO GET THE QR": every booking pays the flat 5%).
  if (!shopVerified) return false;
  if (f.accountNew === true) return true;
  return f.firstImport === true;
}

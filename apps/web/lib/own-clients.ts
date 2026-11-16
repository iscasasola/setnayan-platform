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
 * 🔒 PAPIC ONLY, for now: the one door gives Papic credits into the couple's pool. Event Plus / Event Pro stock is not
 * offered as an own-client gift until a door gives an unlock without a quote (`shop_gift_deliver_unlocks_for_booking`
 * needs an accepted quote) — so this module never lists one as pickable.
 */
import { giftCount, type FreeByKind, type ShopGiftPack } from './shop-gifts';

/** One gift line on an own client, as stored (`vendor_client_invites.gift_lines`, `vendor_own_link_gifts`). */
export type OwnGiftLine = { service_code: string; title: string; kind: 'papic'; credits: number };

/** At most this many gift lines on one client (the migration's CHECK says the same). */
export const OWN_GIFT_MAX_LINES = 5;

/** The menu key that opens "buy more" instead of picking a gift. */
export const OWN_GIFT_BUY_KEY = '__buy';

/* ── the words (the drawing's, byte for byte) ──────────────────────────────────────────────────────────────────── */

export const ADD_CLIENT_TITLE = 'Add a client';
export const ADD_CLIENT_ROW_LINE = 'Their invite comes with a Setnayan gift from you';
export const OWN_CLIENT_PROMISE = 'Your clients pay no booking fee.';
export const OWN_CLIENT_PROMISE_LINE = 'Each one comes with at least one Setnayan gift from you';
export const OWN_CLIENT_PROMISE_TIP =
  'A client you add, or who first asks through your own link or QR, is your own client: no booking fee, on every event with you. Each one comes with at least one Setnayan gift from your stock — one is used when they join. An invite nobody uses costs nothing more. Gifts from a badge reward don’t count here.';
export const ADD_CLIENT_LEAD = 'Clients you bring pay no booking fee. Each one comes with a Setnayan gift from you.';
export const GIFT_FROM_YOU = 'Gift from you';
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
export const OWN_LINK_NOT_SET = 'Not set yet. Until it is, a couple who joins through your link is not your own client.';
export const NOT_YOUR_OWN_CLIENT = 'Not your own client';
export const NOT_YOUR_OWN_CLIENT_LINE = 'If they book, the normal booking fee applies.';
export const NOT_YOUR_OWN_CLIENT_TIP =
  'To make a couple your own client, with no booking fee, use Add a client or your own link. Both come with a gift.';

/** "1 from your stock is used when the couple joins" — counted in gifts, never credits. */
export function usedWhenJoinsLine(lines: number): string {
  const n = Math.max(1, Math.trunc(lines));
  return `${n} from your stock ${n === 1 ? 'is' : 'are'} used when the couple joins`;
}

/** "From your stock · 7 left". */
export function fromStockLine(left: number | null): string {
  return left === null ? 'From your stock · couldn’t count it' : `From your stock · ${giftCount(left)} left`;
}

/* ── the stock, as gifts ───────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Papic credits free to give AS AN OWN-CLIENT GIFT: free to offer, less what is still badge reward (v4 answer 3). The
 * database door measures exactly this (`own_client_gift_give`). Null = the stock could not be read — never 0.
 */
export function boughtFreePapic(free: FreeByKind | null, rewardLeft: FreeByKind | null | undefined): number | null {
  if (!free) return null;
  const reward = rewardLeft ? Math.max(0, Math.min(free.papic, rewardLeft.papic)) : 0;
  return Math.max(0, free.papic - reward);
}

/** How many of one pack the credits cover ("7 left"). */
export function packsLeft(credits: number | null, pack: Pick<ShopGiftPack, 'credits'>): number | null {
  if (credits === null || !Number.isFinite(credits) || pack.credits <= 0) return null;
  return Math.max(0, Math.floor(credits / pack.credits));
}

/** The Papic packs on sale — the only packs an own-client gift can be. Smallest first (the catalogue's order). */
export function ownGiftPacks(packs: readonly ShopGiftPack[] | null): ShopGiftPack[] {
  return (packs ?? []).filter((p) => p.kind === 'papic');
}

/** Credits the picked codes need, each code read from the catalogue; null when any code is not a Papic pack on sale. */
export function creditsFor(codes: readonly string[], packs: readonly ShopGiftPack[] | null): number | null {
  const on = ownGiftPacks(packs);
  let total = 0;
  for (const c of codes) {
    const p = on.find((x) => x.code === c);
    if (!p) return null;
    total += p.credits;
  }
  return total;
}

/** One choice in the gift ▾ (the `PickMenu` shape: `disabledNote` = listed, not pickable, and why). */
export type OwnGiftOption = { key: string; label: string; hint?: string; disabledNote?: string };

/**
 * The gift ▾: YOUR STOCK ONLY. One row per Papic pack the shop's bought stock covers ("7 left"); a badge-reward row,
 * greyed, when the shop holds some; then "＋ Buy more for your stock". `credits` = what is free after the OTHER lines
 * already picked on this client, so two lines can never promise the same credits twice.
 */
export function ownGiftMenu(
  packs: readonly ShopGiftPack[] | null,
  credits: number | null,
  rewardLeftPapic: number,
  canBuy: boolean,
): OwnGiftOption[] {
  const out: OwnGiftOption[] = [];
  for (const p of ownGiftPacks(packs)) {
    const left = packsLeft(credits, p);
    if (left === null) {
      out.push({ key: p.code, label: p.title, disabledNote: 'Couldn’t read your gift stock right now' });
    } else if (left > 0) {
      out.push({ key: p.code, label: p.title, hint: `${giftCount(left)} left` });
    }
  }
  const smallest = ownGiftPacks(packs)[0];
  if (rewardLeftPapic > 0 && smallest) {
    out.push({ key: '__reward', label: `${smallest.title} · badge reward`, disabledNote: REWARD_DOES_NOT_COUNT });
  }
  if (canBuy) out.push({ key: OWN_GIFT_BUY_KEY, label: BUY_MORE, hint: BUY_MORE_LINE });
  return out;
}

/** Is any pack pickable at all? False ⇒ the step shows the buy list instead of the ▾. */
export function anyPackPickable(packs: readonly ShopGiftPack[] | null, credits: number | null): boolean {
  if (credits === null) return false;
  return ownGiftPacks(packs).some((p) => (packsLeft(credits, p) ?? 0) > 0);
}

/** The first pack the stock covers — "one is picked for you from your stock". Null when none is. */
export function defaultOwnGift(packs: readonly ShopGiftPack[] | null, credits: number | null): string | null {
  if (credits === null) return null;
  return ownGiftPacks(packs).find((p) => (packsLeft(credits, p) ?? 0) > 0)?.code ?? null;
}

/**
 * The lines to STORE for the picked codes — titles and credits from the catalogue, never from the browser. Null when a
 * code is not a Papic pack on sale, there is none, or there are too many.
 */
export function ownGiftLinesOf(codes: readonly string[], packs: readonly ShopGiftPack[] | null): OwnGiftLine[] | null {
  if (codes.length < 1 || codes.length > OWN_GIFT_MAX_LINES) return null;
  const on = ownGiftPacks(packs);
  const out: OwnGiftLine[] = [];
  for (const c of codes) {
    const p = on.find((x) => x.code === c);
    if (!p) return null;
    out.push({ service_code: p.code, title: p.title, kind: 'papic', credits: p.credits });
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

/** A stored own-link gift row → its one line, or null when the row is not a Papic gift. */
export function ownLinkGiftLineOf(row: { service_code?: unknown; title?: unknown; gift_kind?: unknown; credits?: unknown } | null): OwnGiftLine | null {
  if (!row || row.gift_kind !== 'papic' || typeof row.service_code !== 'string' || typeof row.title !== 'string') return null;
  const credits = Number(row.credits);
  if (!Number.isInteger(credits) || credits <= 0) return null;
  return { service_code: row.service_code, title: row.title, kind: 'papic', credits };
}

/* ── the invite ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The query key an Add-a-client invite rides on (`/vendor-invite/<slug>?ci=<token>`). */
export const CLIENT_INVITE_PARAM = 'ci';

export const CLIENT_INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function clientInviteTokenOf(raw: unknown): string | null {
  return typeof raw === 'string' && CLIENT_INVITE_TOKEN_RE.test(raw) ? raw : null;
}

/** The invite link: the shop's Shortlist link, carrying this client's token. */
export function clientInviteUrl(origin: string, slug: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/vendor-invite/${encodeURIComponent(slug)}?${CLIENT_INVITE_PARAM}=${encodeURIComponent(token)}`;
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
  stock: Readonly<Record<'papic' | 'event_plus' | 'event_pro', { balance: number; held: number }>> | null;
  packs: ShopGiftPack[] | null;
  paysGiftPrice: boolean;
  canBuy: boolean;
  openRails: R[];
  rewards?: { left: FreeByKind | null } | undefined;
}) {
  const free: FreeByKind | null = g.stock
    ? {
        papic: Math.max(0, g.stock.papic.balance - g.stock.papic.held),
        event_plus: Math.max(0, g.stock.event_plus.balance - g.stock.event_plus.held),
        event_pro: Math.max(0, g.stock.event_pro.balance - g.stock.event_pro.held),
      }
    : null;
  return {
    packs: g.packs,
    credits: boughtFreePapic(free, g.rewards?.left ?? null),
    rewardLeft: free && g.rewards?.left ? Math.max(0, Math.min(free.papic, g.rewards.left.papic)) : 0,
    canBuy: g.canBuy,
    paysGiftPrice: g.paysGiftPrice,
    openRails: g.openRails,
  };
}

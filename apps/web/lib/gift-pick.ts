/**
 * THE GIFT ROW — one dropdown on the service card AND the bundle (owner 7 Nov 2026, DECISION_LOG "THE FOUR MAKERS ARE
 * APPROVED — BUILD THEM AS FIXES TO THE SHIPPED SCREENS, NEVER NEW ONES": "Gift row on both"; on the makers: "on
 * service card and bundles where are the gifts?").
 *
 * ONE dropdown, three kinds of answer — the approved prototype `makers_match_2026-11-07` § 3 (card) and § 4 (bundle):
 *   ''          No gift (the default)
 *   'setnayan'  the Setnayan gift — `includes_setnayan_gift`, the card's shipped yes/no (and the bundle's same-named
 *               column)
 *   <code>      one of the shop's OWN gift packs — `gift_pack_code`, a code `shopGiftKindOf` accepts
 *
 * 🔁 SHARED, NOT COPIED. The bundle maker (branch `claude/bundle-maker-fix-nov7`) drew this row first as
 * `lib/package-gift.ts`; this module is the same shape with the noun ("card" · "bundle") as a parameter, so the two
 * makers read ONE set of rules. Its option keys, its columns and its words are the bundle's, byte for byte where the
 * noun allows.
 *
 * Pure (no I/O): the rules live in `lib/shop-gifts.ts` and are REUSED here, never re-typed. This file does not edit
 * `shop-gifts.ts` (open PR #7298 is editing it). No price and no count is typed here: a pack's title and credits are
 * the live catalogue's (`ShopGiftPack`), its stock the ledger's (`FreeByKind`).
 */
import {
  shopGiftKindOf,
  giftPackLine,
  giftCount,
  coupleGiftHeadline,
  type FreeByKind,
  type ShopGiftKind,
  type ShopGiftPack,
} from './shop-gifts';

/** The Gift row's value: '' (no gift) · 'setnayan' · a shop gift pack's catalogue code. */
export type GiftPick = string;

export const GIFT_NONE = '';
export const GIFT_SETNAYAN = 'setnayan';

/** What the row sits on — the only word that differs between the two makers. */
export type GiftHost = 'card' | 'bundle';

/** The two columns a gift is stored in — the same two names on `vendor_services` and `vendor_packages`. */
export type GiftColumns = { includes_setnayan_gift: boolean; gift_pack_code: string | null };

/** The Gift row's value from a stored row. A stored pack code the app cannot gift reads as no gift. */
export function giftPickOf(row: Partial<GiftColumns> | null | undefined): GiftPick {
  if (!row) return GIFT_NONE;
  if (row.includes_setnayan_gift === true) return GIFT_SETNAYAN;
  return shopGiftKindOf(row.gift_pack_code) ? (row.gift_pack_code as string) : GIFT_NONE;
}

/**
 * The columns for one Gift row value — or `null` when the value is not a gift at all (a typed product, a code that
 * cannot be gifted). The server refuses a null; the database's CHECKs say the same twice over.
 */
export function giftColumns(gift: GiftPick | null | undefined): GiftColumns | null {
  if (!gift) return { includes_setnayan_gift: false, gift_pack_code: null };
  if (gift === GIFT_SETNAYAN) return { includes_setnayan_gift: true, gift_pack_code: null };
  return shopGiftKindOf(gift) ? { includes_setnayan_gift: false, gift_pack_code: gift } : null;
}

/** The Setnayan gift's line under the dropdown — the card maker's shipped fold sentence, without the noun. */
export const SETNAYAN_GIFT_HINT =
  'Free Papic photos for the couple, sized to the booking. Added to your booking fee bill — never more than 40% of that fee.';

/** What the ⓘ beside "Gift" says — the card's shipped words and the shop-gift rulings (DECISION_LOG 2026-11-04 / 05). */
export function giftTip(host: GiftHost): readonly string[] {
  return [
    `Setnayan gift — couples who book this get free Papic photos, sized to the booking. It is added to your booking fee bill — never more than 40% of that fee. Your ${host} shows either way.`,
    'Your own gifts — Papic credits, Event Plus or Event Pro from your stock (Shop › Promote › Your gifts · buy first). They leave your stock when the couple’s first payment clears and land on their event.',
    'On one booking your gifts are capped at 40% of its fee; the smallest Papic pack is always allowed.',
    'A second Event Plus on an event that already holds Plus unlocks Event Pro instead.',
  ];
}

/** One choice in the Gift dropdown — the shape `PickMenu` takes (`disabledNote` = listed, not pickable, and why). */
export type GiftOption = { key: string; label: string; hint?: string; disabledNote?: string };

/**
 * The Gift dropdown: No gift · Setnayan gift · every pack on the live catalogue. A pack this shop's stock cannot cover
 * is LISTED with the reason, never hidden — "buy first" is said where the choice is made (the quote menu's rule,
 * `addGiftMenu`). `free` null = the stock could not be read: every pack is then listed as unreadable, never as empty.
 * The CURRENT value stays pickable whatever the stock says, so opening a saved card never strands its own gift.
 */
export function giftMenu(
  packs: readonly ShopGiftPack[] | null,
  free: FreeByKind | null,
  current: GiftPick = GIFT_NONE,
): GiftOption[] {
  const out: GiftOption[] = [
    { key: GIFT_NONE, label: 'No gift' },
    { key: GIFT_SETNAYAN, label: 'Setnayan gift', hint: SETNAYAN_GIFT_HINT },
  ];
  for (const p of packs ?? []) {
    const have = free ? free[p.kind] : null;
    const enough = have != null && have >= p.credits;
    const off =
      p.code === current
        ? undefined
        : have == null
          ? 'Couldn’t read your gift stock right now'
          : enough
            ? undefined
            : 'Not enough in your stock · buy first';
    out.push({ key: p.code, label: p.title, hint: giftPackHint(p, free), ...(off ? { disabledNote: off } : {}) });
  }
  // A saved pack the catalogue no longer sells stays listed (as itself) so the row never reads a value it cannot show.
  if (current && current !== GIFT_SETNAYAN && !out.some((o) => o.key === current) && shopGiftKindOf(current)) {
    out.push({ key: current, label: GIFT_KIND_WORD[shopGiftKindOf(current) as ShopGiftKind], disabledNote: 'Not on sale right now' });
  }
  return out;
}

/** The line under a shop pack: "1,000 Papic credits · leaves your gift stock when their first payment clears · 850 free to offer". */
export function giftPackHint(pack: ShopGiftPack, free: FreeByKind | null): string {
  const left = free ? `${giftCount(free[pack.kind])} free to offer` : 'couldn’t read your stock';
  return `${giftPackLine(pack)} · leaves your gift stock when their first payment clears · ${left}`;
}

/** The line under the Gift dropdown for the value picked — the prototype's hint, "Off …" when there is none. */
export function giftLine(
  host: GiftHost,
  gift: GiftPick,
  packs: readonly ShopGiftPack[] | null,
  free: FreeByKind | null,
): string {
  if (!gift) return `Off. A gift the couple gets when they book this ${host}.`;
  if (gift === GIFT_SETNAYAN) return SETNAYAN_GIFT_HINT;
  const p = (packs ?? []).find((x) => x.code === gift);
  return p ? giftPackHint(p, free) : 'This gift is not on sale right now.';
}

/**
 * The KIND's own word — what a couple reads when no catalogue row is at hand (the couple-facing card reads only the
 * card row). A kind, never a price or a count: the count is the catalogue's and the quote's.
 */
export const GIFT_KIND_WORD: Readonly<Record<ShopGiftKind, string>> = {
  papic: 'Papic photos',
  event_plus: 'Event Plus',
  event_pro: 'Event Pro',
};

/**
 * What the COUPLE reads for a shop pack on a card: "Gift from Saysay Studio 🎁 · Event Plus" — the quote's own headline
 * (`coupleGiftHeadline`) with the pack's KIND as its word. 🔒 NO COUNT ON A CARD, EVER (the card face's rule for the
 * Setnayan gift, `service-card-face.tsx`, and the prototype's "counts read —"): how many credits is said on the QUOTE,
 * where the pack is actually given. Null for no pack / not a giftable code.
 */
export function coupleCardPackLine(code: string | null | undefined, shopName: string | null | undefined): string | null {
  const kind = shopGiftKindOf(code);
  if (!kind) return null;
  return coupleGiftHeadline(0, shopName, [GIFT_KIND_WORD[kind]]);
}

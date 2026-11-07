/**
 * A BUNDLE'S GIFT — the card's Gift row, on a bundle (owner 7 Nov 2026, DECISION_LOG "THE FOUR MAKERS ARE APPROVED —
 * BUILD THEM AS FIXES TO THE SHIPPED SCREENS, NEVER NEW ONES": "Gift row on both … bundle: NEW").
 *
 * ONE dropdown, three kinds of answer — the approved prototype `makers_match_2026-11-07` § 4, unchanged from the card:
 *   ''          No gift
 *   'setnayan'  the Setnayan gift — `vendor_packages.includes_setnayan_gift`, the SAME name as the card's column
 *   <code>      one of the shop's OWN gift packs — `vendor_packages.gift_pack_code`, a code `shopGiftKindOf` accepts
 *
 * Pure (no I/O): the rules live in `lib/shop-gifts.ts` and `lib/setnayan-gift.ts` and are REUSED here, never re-typed.
 * This file does not edit `shop-gifts.ts` (open PR #7298 is editing it).
 *
 * ⚠ STORED, NOT YET DELIVERED. A card's Setnayan gift reaches the couple through `setnayan_gift_offered_on`, which
 * reads cards only; a bundle lock cascades several booked rows, and whether the gift is once per bundle or once per
 * row is an owner money ruling not yet made. Migration `a_bundle_carries_its_cards_and_a_gift` says the same.
 */
import {
  shopGiftKindOf,
  giftPackLine,
  giftCount,
  coupleGiftHeadline,
  type FreeByKind,
  type ShopGiftPack,
} from './shop-gifts';
import { SETNAYAN_GIFT_CARD_COPY } from '@/app/_components/setnayan-gift-line';

/** The Gift row's value: '' (no gift) · 'setnayan' · a shop gift pack's catalogue code. */
export type PackageGift = string;

export const PACKAGE_GIFT_NONE = '';
export const PACKAGE_GIFT_SETNAYAN = 'setnayan';

/** The two columns a bundle's gift is stored in. */
export type PackageGiftColumns = { includes_setnayan_gift: boolean; gift_pack_code: string | null };

/** The Gift row's value from the stored row. A stored pack code the app cannot gift reads as no gift. */
export function packageGiftOf(row: Partial<PackageGiftColumns> | null | undefined): PackageGift {
  if (!row) return PACKAGE_GIFT_NONE;
  if (row.includes_setnayan_gift === true) return PACKAGE_GIFT_SETNAYAN;
  return shopGiftKindOf(row.gift_pack_code) ? (row.gift_pack_code as string) : PACKAGE_GIFT_NONE;
}

/**
 * The columns for one Gift row value — or `null` when the value is not a gift at all (a typed product, a code that
 * cannot be gifted). The server refuses a null; the database's CHECKs say the same twice over.
 */
export function packageGiftColumns(gift: PackageGift | null | undefined): PackageGiftColumns | null {
  if (!gift) return { includes_setnayan_gift: false, gift_pack_code: null };
  if (gift === PACKAGE_GIFT_SETNAYAN) return { includes_setnayan_gift: true, gift_pack_code: null };
  return shopGiftKindOf(gift) ? { includes_setnayan_gift: false, gift_pack_code: gift } : null;
}

/** The Setnayan gift, as the card maker's fold says it (canvas-maker.tsx "Setnayan gift"), for a bundle. */
export const SETNAYAN_GIFT_BUNDLE_HINT =
  'Free Papic photos for the couple, sized to the booking. Added to your booking fee bill — never more than 40% of that fee.';

/** What the ⓘ beside "Gift" says — the card's words and the shop-gift rulings (DECISION_LOG 2026-11-04 / 05). */
export const PACKAGE_GIFT_TIP: readonly string[] = [
  'Setnayan gift — couples who book this get free Papic photos, sized to the booking. It is added to your booking fee bill — never more than 40% of that fee. Your bundle shows either way.',
  'Your own gifts — Papic credits, Event Plus or Event Pro from your stock (Shop › Promote › Your gifts · buy first). They leave your stock when the couple’s first payment clears and land on their event.',
  'On one booking your gifts are capped at 40% of its fee; the smallest Papic pack is always allowed.',
  'A second Event Plus on an event that already holds Plus unlocks Event Pro instead.',
];

/** One choice in the Gift dropdown — the shape `PickMenu` takes (`disabledNote` = listed, not pickable, and why). */
export type PackageGiftOption = { key: string; label: string; hint?: string; disabledNote?: string };

/**
 * The Gift dropdown: No gift · Setnayan gift · every pack on the live catalogue. A pack this shop's stock cannot cover
 * is LISTED with the reason, never hidden — "buy first" is said where the choice is made (the quote menu's rule,
 * `addGiftMenu`). `free` null = the stock could not be read: every pack is then listed as unreadable, never as empty.
 * The CURRENT value stays pickable whatever the stock says, so opening a saved bundle never strands its own gift.
 */
export function packageGiftMenu(
  packs: readonly ShopGiftPack[] | null,
  free: FreeByKind | null,
  current: PackageGift = PACKAGE_GIFT_NONE,
): PackageGiftOption[] {
  const out: PackageGiftOption[] = [
    { key: PACKAGE_GIFT_NONE, label: 'No gift' },
    { key: PACKAGE_GIFT_SETNAYAN, label: 'Setnayan gift', hint: SETNAYAN_GIFT_BUNDLE_HINT },
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
    out.push({
      key: p.code,
      label: p.title,
      hint: packageGiftHint(p, free),
      ...(off ? { disabledNote: off } : {}),
    });
  }
  return out;
}

/** The line under a shop pack: "1,000 Papic credits · leaves your gift stock when their first payment clears · 850 free to offer". */
export function packageGiftHint(pack: ShopGiftPack, free: FreeByKind | null): string {
  const left = free ? `${giftCount(free[pack.kind])} free to offer` : 'couldn’t read your stock';
  return `${giftPackLine(pack)} · leaves your gift stock when their first payment clears · ${left}`;
}

/** The line under the Gift dropdown for the value picked — the prototype's hint, "Off …" when there is none. */
export function packageGiftLine(
  gift: PackageGift,
  packs: readonly ShopGiftPack[] | null,
  free: FreeByKind | null,
): string {
  if (!gift) return 'Off. A gift the couple gets when they book this bundle.';
  if (gift === PACKAGE_GIFT_SETNAYAN) return SETNAYAN_GIFT_BUNDLE_HINT;
  const p = (packs ?? []).find((x) => x.code === gift);
  return p ? packageGiftHint(p, free) : 'This gift is not on sale right now.';
}

/** What the COUPLE reads on a bundle — the card's own line for the Setnayan gift, the quote's headline for a pack. */
export type CoupleBundleGift = { setnayan: true; line: string } | { setnayan: false; line: string } | null;

export function coupleBundleGift(
  gift: PackageGift,
  packs: readonly ShopGiftPack[] | null,
  shopName: string | null | undefined,
): CoupleBundleGift {
  if (!gift) return null;
  if (gift === PACKAGE_GIFT_SETNAYAN) return { setnayan: true, line: SETNAYAN_GIFT_CARD_COPY };
  const p = (packs ?? []).find((x) => x.code === gift);
  // A pack that is no longer on the catalogue cannot be given — say nothing rather than promise it.
  if (!p) return null;
  const line =
    p.kind === 'papic' ? coupleGiftHeadline(p.credits, shopName) : coupleGiftHeadline(0, shopName, [p.title]);
  return line ? { setnayan: false, line } : null;
}

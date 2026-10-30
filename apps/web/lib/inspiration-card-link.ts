/**
 * lib/inspiration-card-link.ts — 🔗🖼 WHICH OF THE SUPPLIER'S SERVICE CARDS AN INSPIRATION PHOTO BELONGS TO (owner
 * 2026-10-30, DECISION_LOG "A SUPPLIER'S INSPIRATION PHOTO IS CONNECTED FOUR WAYS — ITS SERVICE CARD · THE EVENT · THE
 * SUPPLIER'S WEBSITE · THE CATEGORY/SERVICE POOL", item (1): "every supplier inspiration upload picks which of the
 * supplier's service cards it belongs to (one dropdown, only cards whose Service links that Part)").
 *
 * Pure — the client sheets and the server both read it, so the dropdown and the server's check can never disagree
 * about which cards fit a part.
 *
 * 🔑 "THE CARD'S SERVICE LINKS THAT PART" IS ONE JOIN THAT ALREADY EXISTS. `vendor_services.category` holds the
 * card's canonical service key (`lib/budget-allocation-data.ts` measured it: that column IS the canonical taxonomy key,
 * there is no `canonical_service` column), and a part names the services it takes in `inspiration_part_services`
 * (read into `canonicalServicesForSlot(slot, parts)` — the SAME list the upload's trade gate `slotUploadVerdict` and
 * the suggestion door `inspiration_suggestion_services` read). A card fits a part when its `category` is in that list.
 *
 * 🔑 A LIVE CARD IS WHAT A COUPLE CAN SEE: `is_active` (the shop page's own filter, `activeServices`) and not
 * `is_linked_only` (an auto-covered component with no card of its own — migration 20261014000000).
 */

/** One of the shop's own service cards, as the server read it (`readShopLiveCards`). */
export type ShopCardRow = {
  vendor_service_id: string;
  title: string | null;
  category: string | null;
  starting_price_php: number | null;
  is_active: boolean | null;
  is_linked_only: boolean | null;
};

/** One choice in "Which of your services is this?" — plain data, crosses to the client. */
export type CardChoice = { id: string; label: string; priceLabel: string | null };

/** A card a couple can see: active and a card of its own. */
export function isLiveCard(row: Pick<ShopCardRow, 'is_active' | 'is_linked_only'>): boolean {
  return row.is_active === true && row.is_linked_only !== true;
}

/** The shop's live cards whose Service links this part, in the order given. */
export function cardsForPart<R extends ShopCardRow>(rows: readonly R[], partServices: readonly string[]): R[] {
  const wanted = new Set(partServices);
  return rows.filter((r) => isLiveCard(r) && typeof r.category === 'string' && wanted.has(r.category));
}

/**
 * Preselect when EXACTLY ONE card fits (the ruling); otherwise nothing is preselected — two cards is the supplier's
 * call, none is "the shop only". Returns the card id, or '' for "none".
 */
export function preselectedCard(choices: readonly CardChoice[]): string {
  return choices.length === 1 ? choices[0]!.id : '';
}

/** The words of the "none of these" choice — a photo that fits no card belongs to the shop (owner 2026-10-29). */
export const NO_CARD_LABEL = 'None of these — just my shop';
/** The dropdown's question (the ruling's own words). */
export const WHICH_CARD_QUESTION = 'Which of your services is this?';

/**
 * The server's verdict on a card the browser sent for a part. `null`/'' = no card (always allowed: the card is
 * optional). A card id must be one of THIS shop's live cards whose Service links the part — the same `cardsForPart`
 * the dropdown was drawn from, re-run on rows the server read itself.
 */
export type CardVerdict = { ok: true; vendorServiceId: string | null } | { ok: false; message: string };

export const CARD_REFUSAL = {
  notYours: 'That service card isn’t one of your shop’s — pick one of yours, or “None of these”.',
  wrongPart: 'That service card doesn’t offer this part — pick another card, or “None of these”.',
  unreadable: 'We couldn’t check your service cards just now — please try again in a moment.',
} as const;

export function cardVerdict(input: {
  requested: string | null | undefined;
  /** This shop's cards, read by the server; `null` = the read failed. */
  shopCards: readonly ShopCardRow[] | null;
  partServices: readonly string[];
}): CardVerdict {
  const requested = (input.requested ?? '').trim();
  if (!requested) return { ok: true, vendorServiceId: null };
  /* 🛑 FAIL CLOSED on a refused read — we cannot prove the card is theirs, so it is not written. */
  if (input.shopCards === null) return { ok: false, message: CARD_REFUSAL.unreadable };
  const own = input.shopCards.find((c) => c.vendor_service_id === requested);
  if (!own || !isLiveCard(own)) return { ok: false, message: CARD_REFUSAL.notYours };
  if (cardsForPart([own], input.partServices).length === 0) return { ok: false, message: CARD_REFUSAL.wrongPart };
  return { ok: true, vendorServiceId: own.vendor_service_id };
}

/**
 * The dropdown's choices per part, for every part a sheet offers — computed ONCE on the server and handed down, so the
 * client imports no taxonomy (`lint-server-only-boundary`). A part with no fitting card maps to `[]` (the dropdown then
 * shows only "None of these"); a failed card read maps the whole thing to `null` (the sheet says so, never "no cards").
 */
export function cardChoicesByPart(input: {
  slots: readonly string[];
  shopCards: readonly ShopCardRow[] | null;
  servicesForSlot: (slot: string) => readonly string[];
  labelOf: (row: ShopCardRow) => string;
  priceOf: (row: ShopCardRow) => string | null;
}): Record<string, CardChoice[]> | null {
  if (input.shopCards === null) return null;
  const out: Record<string, CardChoice[]> = {};
  for (const slot of input.slots) {
    out[slot] = cardsForPart(input.shopCards, input.servicesForSlot(slot)).map((r) => ({
      id: r.vendor_service_id,
      label: input.labelOf(r),
      priceLabel: input.priceOf(r),
    }));
  }
  return out;
}

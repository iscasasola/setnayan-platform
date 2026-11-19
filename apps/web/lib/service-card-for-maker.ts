/**
 * 🃏 THE CARD MAKER'S GROWN CARD — the pure half (ruling c160a2aa, 2026-11-16: "the card as couples see it is pinned at
 * the top and updates as you type · tap it and it rises into the grown card · hiding lives only there").
 *
 * The server half (`service-card-for-maker.server.ts`) builds ONE `ServiceCard` for the shop's own SAVED card with the
 * same lib calls the shop page makes. This file says what the Card Maker lays over it while the supplier types, so the
 * grown card "updates as you type" too. Pure (no I/O, no React) so it is tested directly.
 *
 * WHAT IS OVERLAID, and nothing else: the NAME, the PRICE line (its first part → `priceLabel`, the rest →
 * `priceDetail`) and WHAT'S INCLUDED (`inclusions` · `inclusionsMore` · `inclusionsFull`). Everything else on the grown
 * card — photos, clip, serves, not-included, record, reviews, events, inspiration — is the SAVED card, as couples get it
 * today, until Save.
 */

import { SERVICE_CARD_INCLUSION_LIMIT, type ServiceCard } from '@/lib/service-card-view-model';

/** What the server hands the Card Maker. Absent (undefined) = no grown card: a new, unsaved card, or the grown card is off. */
export type MakerGrownCard =
  | {
      status: 'ok';
      /** The saved card as couples see it — hidden items KEPT (the owner curates them), refs attached. */
      card: ServiceCard;
      /** The keys hidden on this card now (`GrownCardOwner.hidden`). */
      hidden: string[];
      /**
       * The owner's view: the card's opens (null = that read failed, the grown card says "Couldn't load", never 0).
       * `curate: false` = hiding is not offered — the hides could not be read (nobody can say what is hidden, so the
       * card is drawn without its hideable items and says so) or this account is not the shop's to curate.
       */
      curate: boolean;
      opens: number | null;
      /** Parts of the card that could not be read — said under the pinned card, never drawn as empty. */
      unread: string[];
    }
  | { status: 'unread' };

/** The live form, as far as the overlay reads it. */
export type MakerTyped = {
  /** The name on the face right now (typed, or the kind's default). */
  name: string;
  /** `Snapshot.priceText` — "from ₱X · ₱Y/guest" or "from ₱—" when no price is typed. */
  priceText: string;
  hasPrice: boolean;
  /** What's included, as typed. */
  inclusionLabels: readonly string[];
};

/** The words a card without a price shows (the same as `toServiceCard`). */
const NO_PRICE = 'Price on request';

/**
 * The saved card with the typed name, price and included lines laid over it. Trimmed the way `toServiceCard` trims
 * (`SERVICE_CARD_INCLUSION_LIMIT`), so the grown card reads exactly as the saved card would once it is saved.
 */
export function overlayTyped(card: ServiceCard, typed: MakerTyped): ServiceCard {
  const name = typed.name.trim();
  const [lead, ...rest] = typed.hasPrice ? typed.priceText.split(' · ') : [];
  const lines = typed.inclusionLabels.map((l) => l.trim()).filter((l) => l.length > 0);
  const shown = lines.slice(0, SERVICE_CARD_INCLUSION_LIMIT);
  return {
    ...card,
    label: name || card.label,
    priceLabel: lead?.trim() ? lead.trim() : NO_PRICE,
    priceDetail: rest.length > 0 ? rest.join(' · ') : null,
    inclusions: shown,
    inclusionsMore: Math.max(0, lines.length - shown.length),
    inclusionsFull: lines,
  };
}

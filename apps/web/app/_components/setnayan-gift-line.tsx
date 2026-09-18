import { Gift } from 'lucide-react';

/**
 * THE SETNAYAN GIFT LINE — the one sentence a service card says about the gift.
 *
 * ── WHY IT IS ITS OWN COMPONENT (SUP-4, 2026-09-18) ────────────────────────
 * The line lived only inside `ServiceCardFace`, which a couple meets in exactly
 * one place: a card a supplier has already offered them in chat. The card they
 * meet while CHOOSING — `ServiceCardView`, on the marketplace and on the shop's
 * own page — never said it, so the gift could not influence the choice it
 * exists to influence. Both cards now mount THIS, so the promise is worded once
 * and cannot drift between the card a couple browses and the card they are
 * offered.
 *
 * 🔒 NO NUMBER HERE, EVER. The photo count is a function of the agreed price,
 * which does not exist while a card is being advertised: a figure printed here
 * could be broken by a lower quote, and honouring it would breach the 40%
 * ceiling. The count belongs on the QUOTE (`giftQuoteCopy`). "Starts at" is the
 * floor for EARNING the gift, never a block on quoting lower (BENCH-C5, ruled);
 * a quote below it earns none — which is why this says "sized to the booking"
 * and nothing more.
 *
 * Presentational only (no hooks, no 'use client'), so a server component and a
 * client one can both mount it. Colour comes from the caller: the supplier's
 * maker and the couple's card use two different palettes, and the WORDS are the
 * part that must not differ.
 */
export const SETNAYAN_GIFT_CARD_COPY =
  'Includes a Setnayan gift — free Papic photos for your celebration, sized to the booking';

export function SetnayanGiftLine({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <p className={className} style={style} data-testid="service-card-setnayan-gift">
      <Gift aria-hidden className="h-3 w-3 shrink-0" strokeWidth={1.75} />
      <span>{SETNAYAN_GIFT_CARD_COPY}</span>
    </p>
  );
}

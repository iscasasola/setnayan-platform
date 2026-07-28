/**
 * service-card-congrats.ts — the congratulations a vendor sees every time they
 * make a service card (owner, 2026-07-28: "we want a congratulations everytime
 * they make a service card!").
 *
 * The message is a TEACHING moment, in the owner's own frame:
 *   • take care of this card — use it well, build your foundation around it;
 *   • having more cards doesn't mean better — substance per card is what counts;
 *   • every event the card creates is documented ON the card (the card compiles
 *     their track record — that is its value);
 *   • "you now have X active cards" — the live count, stated truthfully.
 *
 * Pure module: no I/O, no clock — the caller supplies the counts, so the copy
 * is testable and the count can never drift from what the page itself renders.
 */

export type ServiceCardCongrats = {
  headline: string;
  /** The care/teaching lines, in display order. */
  care: string[];
  /** The active-count line, worded for the card's actual state. */
  count: string;
};

export function buildServiceCardCongrats({
  activeCount,
  isDraft,
}: {
  /** The vendor's LIVE (is_active) card count as rendered on this page load. */
  activeCount: number;
  /** True when the just-created card saved as a draft (not yet published). */
  isDraft: boolean;
}): ServiceCardCongrats {
  const n = Math.max(0, activeCount);
  const cards = n === 1 ? 'card' : 'cards';

  const count = isDraft
    ? n === 0
      ? 'This card saved as a draft — publish it to make it your first active card.'
      : `You have ${n} active ${cards}; this one joins them when you publish it.`
    : n === 1
      ? 'This is your first active card. 🙂'
      : `You now have ${n} active ${cards}. 🙂`;

  return {
    headline: 'Congratulations — your new service card is made! 🙂',
    care: [
      'Take care of this card. Use it well, and build your foundation around it.',
      'Having more cards doesn’t mean better — what matters is that each card has substance.',
      'Every event this card creates is documented on the card itself, so it compiles your track record as you grow.',
    ],
    count,
  };
}

/**
 * THE EXCLUSIVE PAPIC DEAL, ON THE QUOTE BEING WRITTEN — how much Papic this
 * booking can carry for the couple, and what it costs the supplier.
 *
 * PURE (no database, no `server-only`), like `lib/booking-fee-disclosure.ts`
 * beside it: every sentence and every number below is unit-testable and cannot
 * be re-typed at a call site.
 *
 * ─── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * ⚖ OWNER, 2026-09-20, verbatim: *"When they create a quote, similar to service
 * cards, they get to see the booking fee for that, and the maximum additional
 * papic service they can also purchase on top to offer that exclusive deal."*
 *
 * The fee half shipped first (`booking-fee-disclosure.ts`, the same day). This
 * is the other half — and it is NOT a new product. The "additional papic
 * service they can purchase on top to offer that exclusive deal" already exists
 * and is already priced, owner-locked on 2026-09-09: the SETNAYAN GIFT, free
 * Papic photos for the couple, sized at `GIFT_SHARE_OF_FEE_PCT`% of the booking
 * fee, capped at `GIFT_CAP_CREDITS`, billed to the supplier on top of the fee.
 * `lib/setnayan-gift.ts` is the rule; this file does not re-derive one centavo
 * of it.
 *
 * 🔴 WHAT WAS MISSING, MEASURED ON PRODUCTION 2026-09-20: the quote composer
 * shows the gift ONLY when the booking's service card already has it switched
 * on (`vendor_services.includes_setnayan_gift`, read by SQL
 * `setnayan_gift_offered_on`). **Zero of the two live service cards have it on**
 * (`select count(*) filter (where includes_setnayan_gift) from
 * vendor_services` → 0 of 2). So on EVERY quote written in production so far,
 * the composer has said NOTHING about Papic at all — the supplier is never told
 * the exclusive deal exists, what its ceiling is, or where its switch lives.
 *
 * 🔑 SILENCE AND "NONE" LOOK IDENTICAL. `giftQuoteBasis` collapses four
 * distinct database answers — `card_says_no`, `not_sourced`, `free_booking`,
 * `no_booking` — into one `null`, and `null` renders nothing. That is right for
 * the gift COUNT (never promise photos a bill will not carry) and wrong for the
 * supplier's question, which is *"how much CAN I add?"*. This file keeps the
 * four answers apart and gives each one a true sentence.
 *
 * ─── THE ONE QUOTER RULE ───────────────────────────────────────────────────
 * The maximum is `previewGiftForTotal` — `bookingFeePhp` then
 * `setnayanGiftForFee`, byte for byte what `quoteSetnayanGift` runs on the
 * server and what SQL `setnayan_gift_for_fee` prices the supplier's bill with.
 * There is no second ladder, no second rate and no local default here.
 *
 * ⚠ AND WHEN IT CANNOT BE COMPUTED, IT IS NOT GUESSED (`unreadable`). Owner,
 * 2026-08-31, on a money default shipped labelled as a guess: **"don't guess."**
 */

import {
  GIFT_CAP_CREDITS,
  GIFT_SHARE_OF_FEE_PCT,
  formatGiftPhotos,
  previewGiftForTotal,
  type GiftQuoteBasis,
} from '@/lib/setnayan-gift';
import { feePesos, type FeeDisclosure } from '@/lib/booking-fee-disclosure';
import { FREE_BOOKING_LIMIT } from '@/lib/booking-fee-lock';

/** Where the supplier's own service cards — and the gift switch — live. */
export const VENDOR_SERVICE_CARDS_PATH = '/vendor-dashboard/services';

/**
 * WHAT THE DATABASE SAID ABOUT THIS BOOKING'S GIFT, kept in the arms SQL
 * `setnayan_gift_quote_applies` actually returns, so a reader can check the two
 * side by side:
 *
 *   · `silent`      — the fee system is dark, or there is no booking row yet.
 *                     There is no question to answer; say NOTHING.
 *   · `included`    — RPC `'applies'`. The card offers it, the client is
 *                     Setnayan-sourced, the booking will be billed. The quote
 *                     ALREADY carries the gift.
 *   · `available`   — RPC `'card_says_no'`. Everything else lines up; only the
 *                     switch is off. This is the arm the owner asked for.
 *   · `free_booking`/`not_sourced` — no fee on this booking, so nothing to size
 *                     a gift from. A true "none", not a silence.
 *   · `unreadable`  — a read was refused, the ladder was unpriceable, or the
 *                     RPC returned an arm we do not recognise. NOT "none".
 *
 * `included` and `available` carry the SAME `GiftQuoteBasis` the composer
 * prices the gift from — the live fee schedule and the live credit ladder.
 */
export type PapicQuoteStanding =
  | { kind: 'silent' }
  | { kind: 'included'; basis: GiftQuoteBasis }
  | { kind: 'available'; basis: GiftQuoteBasis }
  | { kind: 'free_booking' }
  | { kind: 'not_sourced' }
  | { kind: 'unreadable' };

/** A disclosure that may carry a door to the place the supplier must act. */
export type PapicQuoteNotice = FeeDisclosure & {
  cta?: { href: string; label: string };
};

/**
 * THE GIFT'S OWN ELIGIBILITY, DERIVED FROM THE SAME READ.
 *
 * 🔑 ONE RPC, ONE ANSWER. Before this, the thread page asked
 * `setnayan_gift_quote_applies` through `giftQuoteBasis`, which returns a basis
 * or `null`. The Papic line needs the REASON, so it would have had to ask the
 * same question a second time — two calls that could be answered against two
 * different moments. The page now asks once, and the gift block reads its
 * answer through here.
 *
 * ⚠ THE GATE IS NOT RELAXED BY MOVING IT. A basis comes back for `included`
 * and for NOTHING else — which is exactly `giftQuoteBasis`'s contract (only
 * `'applies'`, only with a non-empty ladder). `available` deliberately does NOT
 * yield one: the card says no, so the quote must promise the couple no photos.
 */
export function giftBasisFrom(standing: PapicQuoteStanding): GiftQuoteBasis | null {
  return standing.kind === 'included' ? standing.basis : null;
}

/**
 * THE SERVER'S DECISION, MADE HERE SO IT CAN BE EXECUTED.
 *
 * `lib/papic-on-a-quote.server.ts` carries `server-only`, which a unit test
 * cannot import — a guard over it could only ever GREP. So the part that can be
 * got wrong lives in this pure sibling and is run for real, and the server file
 * keeps only the two reads.
 *
 * @param arm  whatever `public.setnayan_gift_quote_applies` returned. An arm
 *   this file does not recognise — a new one the SQL grows later — is
 *   `unreadable`, never a confident "none": we did not understand the answer,
 *   which is a read we cannot interpret, and the copy says exactly that.
 * @param basis the live schedule + ladder, or `null` when either could not be
 *   read or the ladder cannot price the cap (`giftLadderIsPriceable`). Without
 *   it no maximum can be stated, so an otherwise-eligible booking is
 *   `unreadable` rather than silently "no deal".
 */
export function standingForGiftArm(
  arm: string,
  basis: GiftQuoteBasis | null,
): PapicQuoteStanding {
  switch (arm) {
    case 'no_booking':
      return { kind: 'silent' };
    case 'not_sourced':
      return { kind: 'not_sourced' };
    case 'free_booking':
      return { kind: 'free_booking' };
    case 'applies':
      return basis ? { kind: 'included', basis } : { kind: 'unreadable' };
    case 'card_says_no':
      return basis ? { kind: 'available', basis } : { kind: 'unreadable' };
    default:
      return { kind: 'unreadable' };
  }
}

/**
 * THE WORDS ON THE QUOTE'S GIFT SWITCH — here, not in the composer, for the
 * same reason every other figure in this file is here: the share is rendered
 * from `GIFT_SHARE_OF_FEE_PCT` and never re-typed.
 *
 * 🔑 IT ALSO KEEPS THE COMPOSER CLEAN FOR ITS OWN GUARD.
 * `the-gift-is-on-the-quote-being-written.test.ts` fails if `proposal-maker.tsx`
 * so much as mentions `GIFT_SHARE_OF_FEE_PCT`, because a composer that knows
 * the rate is one keystroke from computing the gift itself. That guard caught
 * this copy on the way in (2026-09-22) and it was right to.
 */
export function quoteGiftSwitchCopy(): { label: string; detail: string } {
  return {
    label: 'Include the Setnayan gift on this quote',
    detail:
      `Free Papic photos for your couple — ${sharePct()} of your booking fee, billed to you on ` +
      'top of it. It applies when they accept this quote, and it decides the bill whatever your ' +
      'service cards say.',
  };
}

/**
 * THE QUOTE'S OWN SWITCH, APPLIED TO THE STANDING (owner 2026-09-22: "per-quote
 * switch" — migration 20271240324859).
 *
 * The database answers for the BOOKING: `included` when the card (or the
 * already-accepted quote) says yes, `available` when only the switch is off.
 * The quote being written carries its own yes/no, seeded from the cards and
 * flipped by the supplier; `setnayan_gift_offered_on` reads it once the couple
 * accepts. So while composing, the switch — not the card — decides which of the
 * two eligible sentences is true. Every other arm is untouched: no fee, no
 * client, an unreadable ladder — a switch cannot conjure a gift out of those.
 *
 * `null` (the switch says nothing) leaves the database's answer as it was.
 */
export function standingForQuoteSwitch(
  standing: PapicQuoteStanding,
  switchOn: boolean | null | undefined,
): PapicQuoteStanding {
  if (switchOn == null) return standing;
  if (standing.kind === 'included' && !switchOn) return { kind: 'available', basis: standing.basis };
  if (standing.kind === 'available' && switchOn) return { kind: 'included', basis: standing.basis };
  return standing;
}

/**
 * WHAT THE QUOTE'S SWITCH OPENS AT — the cards' answer (owner, Answer 1: ON if
 * ANY card the quote is built from has it on), else the booking's own card as
 * the database read it, else nothing.
 */
export function defaultQuoteSwitch(
  standing: PapicQuoteStanding,
  cardSwitches: readonly boolean[] = [],
): boolean | null {
  if (cardSwitches.length > 0) return cardSwitches.some(Boolean);
  if (standing.kind === 'included') return true;
  if (standing.kind === 'available') return false;
  return null;
}

/**
 * WHAT THE SWITCH OPENS AT WHEN THE SUPPLIER IS REVISING A QUOTE THEY ALREADY SENT.
 *
 * 🔑 THE ORDER OF THE TWO QUESTIONS IS THE WHOLE POINT. The CURRENT booking
 * decides whether there is a switch at all; the REPLACED quote decides its
 * value. Never the other way round.
 *
 * A naive pass-through — "reopen at whatever the old quote said" — resurrects a
 * gift on a booking that has since become waived, imported or unreadable. That
 * fails in the direction that costs the supplier money, which is why
 * `cardsAnswer === null` is answered first and returns before anything else is
 * considered.
 *
 * @param revisionAnswer `vendor_proposals.includes_setnayan_gift` of the quote
 *   being replaced. `undefined` = not a revision. `null` = that quote expressed
 *   no opinion (the column is nullable by design, so NULL is a real answer
 *   meaning "nothing was said"), and falling through to the cards is then
 *   correct rather than lazy.
 * @param cardsAnswer `defaultQuoteSwitch(...)` for the booking as it stands
 *   NOW. `null` means this booking offers no switch at all.
 *
 * With no revision this returns `cardsAnswer` unchanged, so a first-draft quote
 * behaves exactly as it did before this function existed.
 */
export function openingGiftSwitch(a: {
  revisionAnswer: boolean | null | undefined;
  cardsAnswer: boolean | null;
}): boolean | null {
  if (a.cardsAnswer === null) return null;
  return a.revisionAnswer ?? a.cardsAnswer;
}

/** "40%" — the owner's ceiling, rendered from the constant, never typed. */
function sharePct(): string {
  return `${GIFT_SHARE_OF_FEE_PCT}%`;
}

/**
 * THE MAXIMUM PAPIC THIS QUOTE CAN CARRY, as the supplier reads it.
 *
 * @param totalCentavos the figure the SERVER will re-sum to — `netPayable` in
 *   ProposalMaker, `resolveQuoteTotalCentavos` in the saved-template card.
 *   Previewing against a subtotal would quote a ceiling the bill will not match.
 *
 * Returns `null` only for `silent`, and for the one case where the surface
 * beside this one already says everything true: the gift is ON and priced, so
 * the gift block prints the photo count and the peso charge and this line would
 * be a SECOND rendering of one number.
 */
export function papicTopUpForQuote(
  standing: PapicQuoteStanding,
  totalCentavos: number,
): PapicQuoteNotice | null {
  switch (standing.kind) {
    case 'silent':
      return null;

    case 'included': {
      const gift = previewGiftForTotal(totalCentavos, standing.basis);
      // No priced gift yet (no total typed, or a total too small to reach the
      // smallest rung) ⇒ the gift block renders nothing, so a bare "that is the
      // most" would qualify a sentence that is not on the screen.
      if (!gift) return null;
      return {
        tone: 'good',
        headline: 'Papic deal · on — that is the most this booking can carry.',
        detail:
          `Your exclusive Papic deal is capped at ${sharePct()} of your booking fee` +
          (gift.capped
            ? `, and this quote is at the ceiling of ${formatGiftPhotos(GIFT_CAP_CREDITS)} photos`
            : '') +
          '. The switch above is on, so the photos above are part of this quote ' +
          'and are billed to you with the fee.',
      };
    }

    case 'available': {
      // The switch is on THIS quote now (20271240324859), so the door is the
      // switch beside this line, not the service card page.
      const cta = {
        href: '#quote-setnayan-gift-switch',
        label: 'Switch the Setnayan gift on for this quote',
      };
      if (!Number.isFinite(totalCentavos) || totalCentavos <= 0) {
        return {
          tone: 'info',
          headline: 'Papic deal · off — put your price in to size it.',
          cta,
          detail:
            `Free Papic photos for your couple, sized at ${sharePct()} of your booking fee and ` +
            'billed to you on top of it. Put your price in and we will show you exactly how many.',
        };
      }
      const gift = previewGiftForTotal(totalCentavos, standing.basis);
      if (!gift) {
        return {
          tone: 'info',
          headline: 'Papic deal · off — this quote is too small to carry one.',
          cta,
          detail:
            `The exclusive deal is ${sharePct()} of your booking fee, and at this price that does not ` +
            'reach the smallest Papic bundle. Quote higher and the number appears here.',
        };
      }
      return {
        tone: 'info',
        headline:
          `Papic deal · off — up to ${formatGiftPhotos(gift.credits)} free photos, ` +
          `${feePesos(gift.chargeCentavos / 100)} on your fee.`,
        cta,
        detail:
          `That is the most this booking can carry: ${sharePct()} of your booking fee` +
          (gift.capped ? `, stopping at ${formatGiftPhotos(GIFT_CAP_CREDITS)} photos` : '') +
          '. The switch above is off, so this quote carries none — switch it on and ' +
          'the photos reach your couple when your fee bill is paid.',
      };
    }

    case 'free_booking':
      /**
       * ⚖ OWNER REFINEMENT, 2026-09-20: *"still tell them that there should be
       * a booking fee. but this will be considered free."* So this does not say
       * there is NO fee — the fee line above states what it would be and that
       * it is waived. This says what the waiver COSTS the supplier in Papic:
       * the deal is a share of money actually charged, and a waived fee charges
       * none. The amount itself is the fee line's to print, once, and is
       * deliberately not repeated here.
       */
      return {
        tone: 'good',
        headline: 'Papic deal · none — and nothing to pay.',
        detail:
          'Your exclusive Papic deal is a share of the booking fee you actually pay, and this ' +
          `booking's fee is waived — one of your first ${FREE_BOOKING_LIMIT} on Setnayan. Your first ` +
          'billed booking can carry one.',
      };

    case 'not_sourced':
      return {
        tone: 'good',
        headline: 'Papic deal · none — and nothing to pay.',
        detail:
          'This client did not come from Setnayan, so this booking carries no booking fee — and the ' +
          'exclusive Papic deal is sized from that fee. Nothing here is billed to you.',
      };

    case 'unreadable':
      return {
        tone: 'info',
        headline: 'Papic deal — we could not work it out just now.',
        detail:
          'Rather than show you a number we have not checked, we would rather say so. ' +
          'Reopen this quote in a moment and it will be here.',
      };
  }
}

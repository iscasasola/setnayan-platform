import type { PabuyaMethodCard } from '@/app/_components/pabuya/pabuya-card-list';
import type { GiftRecordReader } from '../_components/wish-list';
import type { GuestWish, WishListShape } from '@/lib/wish-list-guest';
import type { EventWords } from '../../_lib/event-words';

/**
 * 🎁 THE E-GIFTS CONTENT, AS ONE THING — what `/[slug]/pabuya` shows, and what the Welcome page now shows in place
 * of its door (owner 2026-10-14: *"the e-gifts is only a button that opens the rest of egift. can't we just have it
 * there instead of a button?"*). ONE reader builds it (`loadGiftPage`, `gift-page.server.ts`) and ONE component
 * draws it (`GiftPageBody`), so the two places cannot show a reader different things.
 *
 * This file is PURE — no database, no cookie — so the rule that decides what a reader may see is EXECUTED by its
 * test (`an-account-number-is-not-public.test.ts`), not read as text.
 */
export type GiftPageContent = {
  eventId: string;
  words: EventWords;
  /** The event's own name when it has one — "Maria & Jose" — else this event type's word. */
  hostName: string;
  /** The event's own name, as stored — the empty state's verb reads it (`hasntAfter`). */
  displayName: string | null;
  /** "Maria & Jose’s" / "the couple’s". */
  hostPossessive: string;
  /** The couple's own words (`events.pabuya_message`) — null draws nothing. */
  message: string | null;
  /** The registry link, already through `giftRegistryHref` (http(s) only) — null draws nothing. */
  registryHref: string | null;
  /** The wish list a guest is shown (`wishListShownToGuests`) — empty: no list. */
  wishes: readonly GuestWish[];
  wishShape: WishListShape;
  /** The ways to give, identifiers ALREADY withheld from a reader the event does not recognise (`giftCardsFor`). */
  cards: PabuyaMethodCard[];
  /** Was anything withheld? Drives the sentence that stops a gate reading as a bug. */
  identifiersWithheld: boolean;
  /** The one sentence on how to send — only the ways this couple set up. Null: none to say. */
  howToSend: string | null;
  /** Who is reading, for "I sent it". */
  reader: GiftRecordReader;
};

/** The fields of an e-gift method this rule reads — `EgiftMethodView` (lib/egift.ts) has them all. */
export type GiftMethodForCard = {
  method_kind: string;
  label: string;
  account_name: string | null;
  handle: string | null;
  note: string | null;
  qrDisplayUrl: string | null;
};

/*
  ══ 🔒 AN ACCOUNT NUMBER IS NOT PUBLIC CONTENT ══════════════════════════════
  ⚖ Owner 2026-09-15, shown his own bank number readable at this URL with no
  session at all: **"gate the account number."**

  The gift page is reachable by anyone holding the link — that is deliberate and
  unchanged, because it is how a relative abroad sends a gift. What changed is
  WHO SEES THE PAYMENT IDENTIFIER. A stranger sees that the couple accept a
  bank transfer and the account's NAME; the number, and the QR that encodes
  it, are shown only to someone the event recognises.

  🔑 THE QR IS GATED WITH THE NUMBER, NOT LEFT BEHIND. A bank QR encodes the
  very account it stands for, so hiding the digits and printing the code beside
  them would be a gate with a window next to it.

  ⚖ EVERY METHOD, and it took two rulings to get here. The first — "gate the
  account number" — was about the bank, and this code gated only the bank,
  because widening a disclosure rule past what was asked is how the next person
  inherits a decision nobody made. The owner then ruled on the rest himself:
  *"gate the gcash number too."* So the shape is now one rule for every payment
  identifier, which is also one rule to reason about.

  🏠 2026-10-14 — THE RULE LEFT THE PAGE'S FILE, AND DID NOT WEAKEN. E-Gifts is
  now drawn on the Welcome page too. A second drawing that withheld by a rule
  of its own would be a second door onto the identifiers; so the rule is HERE,
  once, and the page and the Welcome both take their cards from it.
*/
export function giftCardsFor(
  methods: readonly GiftMethodForCard[],
  viewerIsRecognised: boolean,
): { cards: PabuyaMethodCard[]; identifiersWithheld: boolean; howToSend: string | null } {
  const cards: PabuyaMethodCard[] = methods.map((m) => {
    /* ⚖ EVERY method, not only the bank — owner 2026-09-15, twice: "gate the
       account number", then "gate the gcash number too". A wallet handle is a
       mobile number; that it can be changed in an app makes it recoverable, not
       public. */
    const withhold = !viewerIsRecognised;
    return {
      kind: m.method_kind,
      label: m.label,
      accountName: m.account_name,
      handle: withhold ? null : m.handle,
      note: m.note,
      qrUrl: withhold ? null : m.qrDisplayUrl,
    };
  });
  /*
    Did we withhold ANYTHING? This drives the sentence that stops a gate from
    reading as a bug.

    🔴 IT USED TO ASK ABOUT THE HANDLE ONLY. A method may legitimately be
    QR-ONLY — `saveEgiftMethod` refuses a row only when BOTH the handle and the
    QR are absent — and for such a row `handle` is null before and after
    withholding, so this returned false and the explaining sentence never
    rendered. The guest saw a card with a rail name, no number, no QR and NO
    REASON: byte-identical to a couple who filled the form in wrong.

    Now: withheld if EITHER identifier was present on the row and is absent
    from the card.
  */
  const identifiersWithheld = cards.some(
    (c, i) =>
      (c.handle === null && methods[i]?.handle != null) ||
      (c.qrUrl === null && methods[i]?.qrDisplayUrl != null),
  );
  /* 🎁 SAY ONLY WHAT IS THERE (guest text audit 2026-09-30). The line used to
     promise "Scan a QR or copy a handle" whatever the couple had set up — a
     bank-only page offered a QR that did not exist, and "handle" is nobody's
     word for an account number. It names the ways this couple actually has. */
  const howToSend = howToSendLine({
    qr: methods.some((m) => Boolean(m.qrDisplayUrl)),
    number: methods.some((m) => Boolean(m.handle)),
  });
  return { cards, identifiersWithheld, howToSend };
}

/** The one sentence on how to send — only the ways this couple set up. */
export function howToSendLine(has: { qr: boolean; number: boolean }): string | null {
  if (has.qr && has.number) return 'Scan a QR code or copy an account number, and send it straight to their own account.';
  if (has.qr) return 'Scan a QR code and send it straight to their own account.';
  if (has.number) return 'Copy an account number and send it straight to their own account.';
  return null;
}

/** The sentence a guest reads when payment details are withheld from them — on the page, in the send sheet, on Welcome. */
export const GIFT_DETAILS_WITHHELD_LINE =
  'Payment details are shown to invited guests. Open your own invitation link, or scan your QR, and the account numbers appear here.';

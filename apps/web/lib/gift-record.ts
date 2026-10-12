/**
 * apps/web/lib/gift-record.ts
 *
 * "I SENT IT" — WHAT A GUEST TELLS THE COUPLE (owner 2026-10-08: "when people
 * send gcash, they also give screenshot of their payment and the vallue and
 * their message for the couple. this will be the way to measure."; design
 * `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2 "I sent it → Show Maria & Jose";
 * prototype frames 18–20).
 *
 * Pure — the rules a record must pass and the words either side reads. The
 * write itself is `lib/gift-record.server.ts`.
 *
 * ── THE WORD IS "SENT" ─────────────────────────────────────────────────────
 * A record is what a guest SAYS they sent. Setnayan never holds or sees the
 * money, so nothing here tells anybody a gift arrived or was checked, and
 * nothing here speaks of taking money back.
 */
import { formatPhp } from '@/lib/php';
import { GIFT_GIVER_NAME_MAX, GIFT_MESSAGE_MAX } from '@/lib/wish-list';

/* ── what a refusal says (each is said to the guest, in place) ───────────── */

export const GIFT_NOT_RECOGNISED =
  'Open your own invitation link, or scan your QR, and you can show them your gift from here.';
export const GIFT_NOT_ACCEPTING = 'They are not accepting E-Gifts right now.';
export const GIFT_WISH_GONE = 'That wish isn’t on the list any more — close this and open the list again.';
export const GIFT_AMOUNT_NEEDED = 'How much did you send? Type the amount as a number.';
export const GIFT_MESSAGE_TOO_LONG = `Keep your message to ${GIFT_MESSAGE_MAX} characters.`;
export const GIFT_NAME_NEEDED = 'Add your name, so they know who it’s from.';
export const GIFT_NAME_TOO_LONG = `Keep your name to ${GIFT_GIVER_NAME_MAX} characters.`;
export const GIFT_SHOT_REFUSED = 'That screenshot could not be used — please add it again.';
export const GIFT_TOO_FAST = 'That was a lot at once — wait a few minutes and try again.';
export const GIFT_NOT_KEPT = 'That did not go through — nothing was kept. Please try again.';

/* ── the rules ───────────────────────────────────────────────────────────── */

/**
 * The amount a guest typed → whole pesos, or `undefined` when it is not an
 * amount. REQUIRED (the measure is the value they say they sent).
 *
 * ⚠ NO CAP IS INVENTED HERE. No rule in this product sets a largest gift, so
 * the only bounds are the column's own: a whole number of pesos, more than
 * zero, at most nine digits (it must fit the integer column).
 */
export function cleanGiftAmount(raw: unknown): number | undefined {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : '';
  const digits = text.replace(/[\s,₱]/g, '');
  if (!/^\d{1,9}$/.test(digits)) return undefined;
  const n = Number(digits);
  return n > 0 ? n : undefined;
}

/** Their word for the couple → trimmed, `null` for none, `undefined` when it is too long (said, never cut). */
export function cleanGiftMessage(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  if (v === '') return null;
  return v.length > GIFT_MESSAGE_MAX ? undefined : v;
}

/**
 * Who it is from. The invitation's own name always wins — a guest cannot sign a
 * gift as somebody else; the typed name is only for a guest whose invitation
 * has no name yet. `undefined` = none usable; `null` in `tooLong` position is
 * told apart by the caller through `GIFT_NAME_TOO_LONG`.
 */
export function giftGiverName(invitationName: string | null | undefined, typed: unknown): { name: string } | { refused: string } {
  const own = (invitationName ?? '').trim();
  if (own !== '') return { name: own.slice(0, GIFT_GIVER_NAME_MAX) };
  const v = typeof typed === 'string' ? typed.trim() : '';
  if (v === '') return { refused: GIFT_NAME_NEEDED };
  if (v.length > GIFT_GIVER_NAME_MAX) return { refused: GIFT_NAME_TOO_LONG };
  return { name: v };
}

/**
 * The way they used, when it can be KNOWN: with exactly one way to give
 * switched on there is only one way they could have sent it. With two or more
 * it is not guessed — the couple's list then says nothing about the way.
 */
export function onlyWayToGive(enabledKinds: readonly string[]): string | null {
  return enabledKinds.length === 1 ? enabledKinds[0]! : null;
}

/* ── what the guest's sheets say ─────────────────────────────────────────── */

/** "Show Maria & Jose" */
export const giftSheetTitle = (hostName: string) => `Show ${hostName}`;
/** "Your screenshot, the amount and your message go to Maria & Jose only." */
export const giftSheetLead = (hostName: string) => `Your screenshot, the amount and your message go to ${hostName} only.`;
export const GIFT_SHOT_LABEL = 'Your screenshot';
export const GIFT_SHOT_HINT = 'from GCash, Maya or your bank';
export const GIFT_FROM_INVITATION = 'from your invitation';
export const GIFT_NAME_PLACEHOLDER = 'So they know who it’s from';
/** "Send to Maria & Jose" */
export const giftSendLabel = (hostName: string) => `Send to ${hostName}`;
/** "Sent a gift? Show Maria & Jose" — under the ways to give, for a gift toward no wish. */
export const giftTellLabel = (hostName: string) => `Sent a gift? Show ${hostName}`;
export const GIFT_TELL_LINE = 'Your screenshot, the amount and a word — for them only.';

/**
 * After: "Maria & Jose will see your screenshot, ₱500 and your words beside the
 * Air fryer. No other guest sees them — and the wish is now marked got."
 * Says only what was handed over: no screenshot → none is mentioned.
 */
export function giftThanksLine(input: {
  hostName: string;
  amountPhp: number;
  wishName: string | null;
  hasShot: boolean;
  hasMessage: boolean;
  nowGot: boolean;
}): string {
  const seen = [input.hasShot ? 'your screenshot' : null, formatPhp(input.amountPhp), input.hasMessage ? 'your words' : null].filter(
    (x): x is string => Boolean(x),
  );
  const list = seen.length === 1 ? seen[0]! : `${seen.slice(0, -1).join(', ')} and ${seen[seen.length - 1]}`;
  const beside = input.wishName ? ` beside the ${input.wishName}` : '';
  const others = seen.length === 1 ? 'No other guest sees it' : 'No other guest sees them';
  return `${input.hostName} will see ${list}${beside}. ${others}${input.nowGot ? ' — and the wish is now marked got' : ''}.`;
}

/** "Thank you, Tita Nene." */
export const giftThanksTitle = (giverName: string) => `Thank you, ${giverName}.`;

/** The guest's OWN line on a wish they sent toward: "You sent ₱500 ✓ · ₱4,500 of ₱4,500". */
export function youSentLine(minePhp: number, wish: { pricePhp: number | null; sentPhp: number }): string {
  return `You sent ${formatPhp(minePhp)} ✓${wish.pricePhp != null ? ` · ${formatPhp(wish.sentPhp)} of ${formatPhp(wish.pricePhp)}` : ''}`;
}

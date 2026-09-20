/**
 * lib/qr-amount-truth.ts — ONE answer to "does the code on this screen carry
 * the amount?", and every sentence the product says about it.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🚨 WHY THIS MODULE EXISTS. On 2026-09-20 the owner paid a real ₱837.50
 * booking fee (reference SN9B7485DD, order S89O-DW67KBQADN) and reported:
 * *"the amount is not filled up. it only shows 0."* One screen, three
 * sentences, written by hand in three files, two of them false at the moment
 * he read them:
 *
 *   · /vendor-dashboard/booking-fees/<id> — "The code on the payment page
 *     already has the amount in it."
 *   · /pay/<ref> step 1 — "Scan the code with your GCash or bank app — the
 *     amount is already in it."
 *   · /pay/<ref> section 2, a few lines below the sentence above —
 *     "Scan this, then type ₱837.50 yourself — this code doesn't carry an
 *     amount."
 *
 * The third one was the honest one: what was painted at that moment was the
 * STATIC uploaded merchant image, which declares "reusable, no amount", so the
 * wallet opened at ₱0. The other two promised the opposite, on the same screen,
 * about the same code.
 *
 * 🔑 A PAIR OF SENTENCES WRITTEN BY HAND CAN DISAGREE; A PAIR DERIVED FROM ONE
 * VALUE CANNOT. Nothing below decides anything new — `mintOrderQr` already
 * knew the answer, and already returned null when it could not mint. What was
 * missing was that its answer never reached the words. So this module is
 * deliberately thin: one verdict, and the sentences read off it.
 *
 * ⛔ DO NOT WRITE A FOURTH SENTENCE ABOUT A QR CODE'S AMOUNT ANYWHERE ELSE.
 * `the-qr-never-promises-what-it-cannot-carry.test.ts` executes this resolver
 * against real static payloads and fails if any payment surface grows its own
 * phrasing.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { mintOrderQr, parseTlv, verifyCrc } from './emv-qr';

/**
 * The figure to name when the screen genuinely does not know one — a supplier's
 * own scan-to-pay code, shown to a couple before any amount is agreed.
 *
 * ⚠ IT IS A PHRASE, NOT A BLANK. "Type exactly" with nothing after it is worse
 * than the sentence it replaces.
 */
export const AGREED_AMOUNT = 'the amount you agreed';

/**
 * What the code a person is looking at actually carries.
 *
 * `payload` is the amount-bearing QR Ph payload to RENDER when we have one —
 * never the source. A caller that shows the source payload while claiming
 * `carriesAmount` would reproduce the exact defect this module exists to kill.
 */
export type QrAmountVerdict =
  | { carriesAmount: true; payload: string }
  | { carriesAmount: false; payload: null };

/** The static, no-amount answer. Exported so callers need not spell it. */
export const STATIC_QR: QrAmountVerdict = { carriesAmount: false, payload: null };

/**
 * Can we mint a code carrying `amountPhp` from this source, and if so, what is
 * it?
 *
 * Fails soft, exactly as `mintOrderQr` does: anything we do not fully
 * understand comes back as `STATIC_QR`, the caller shows the original uploaded
 * image, and — because of this module — SAYS SO.
 */
export function resolveQrAmount(
  sourcePayload: string | null | undefined,
  amountPhp: number,
): QrAmountVerdict {
  const minted = mintOrderQr(sourcePayload, amountPhp);
  return minted ? { carriesAmount: true, payload: minted } : STATIC_QR;
}

/**
 * Does a payload we did NOT mint already carry its own amount?
 *
 * A supplier uploads their own scan-to-pay QR and we store what it decodes to
 * (`vendor_payment_methods.decoded_destination`). Almost every one of those is
 * a personal, reusable, static code — but a merchant CAN issue a dynamic one,
 * and telling that person's customer "this carries no amount" would then be
 * the same class of false sentence pointing the other way.
 *
 * 🔑 SO IT IS MEASURED, NOT ASSUMED: tag 01 = '12' (dynamic) AND a tag 54
 * present. Both are required — EMVCo's point-of-initiation tag is what a
 * wallet reads to decide whether an amount is allowed at all (see the
 * wallet-testing note in lib/emv-qr.ts), so a 54 sitting on an '11' payload is
 * a code GCash REJECTS, not a code that pays a figure.
 *
 * Anything that is not a well-formed QR Ph payload answers false — a payment
 * link, a truncated decode, a `decoded_destination` the vendor typed by hand.
 * None of those pre-fills anything either.
 */
export function payloadCarriesOwnAmount(payload: string | null | undefined): boolean {
  if (!payload || payload.length < 20 || payload.length > 512) return false;
  if (!verifyCrc(payload).ok) return false;
  try {
    const byId = new Map(parseTlv(payload).map((f) => [f.id, f.value]));
    return byId.get('01') === '12' && (byId.get('54')?.trim().length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Does EVERY rail a payer can actually choose carry the amount?
 *
 * 🔑 THE QUESTION IS "EVERY", NOT "ANY", AND THAT IS THE WHOLE POINT OF PUTTING
 * IT HERE. Three screens say one sentence about two codes — /pay's step 1 names
 * "your GCash or bank app" in one breath, and the two pages that link to /pay
 * describe "the code on the payment page" without knowing which tab the payer
 * will land on. If one rail mints and the other does not, a promise of a
 * pre-filled amount is false for whoever taps the other tab. So the sentence
 * may only promise when both open rails carry it.
 *
 * ⚠ A CLOSED RAIL IS NOT A RAIL. `isChannelOpen` already refuses to show a
 * switched-off channel, and letting its unmintable payload drag the sentence
 * down would tell a payer to type a figure their wallet is about to fill in.
 * Callers pass the SAME open/closed answer the tabs are rendered from.
 */
export function everyOpenRailCarriesAmount(input: {
  amountPhp: number;
  rails: ReadonlyArray<{ open: boolean; payload: string | null | undefined }>;
}): boolean {
  const open = input.rails.filter((r) => r.open);
  if (open.length === 0) return false;
  return open.every((r) => resolveQrAmount(r.payload, input.amountPhp).carriesAmount);
}

export type QrWords = {
  /** The numbered instruction in a "what happens next" list. */
  scanStep: string;
  /** The caption directly beneath the code itself. */
  caption: string;
  /** One line pointing at the payment page, for a screen that links to it. */
  pointer: string;
  /**
   * What to put in the transfer note. The SAME either way — no QR Ph code we
   * emit carries the reference (GCash rejects the EMVCo tag 62 template
   * outright; see lib/emv-qr.ts), so the note is the only place it can ride.
   */
  note: string;
};

/**
 * Every sentence, from the verdict and the figure.
 *
 * `amountText` is the figure ALREADY FORMATTED by the caller — `payAmount` on
 * the payment page, whose two decimals are pinned to EMV tag 54. Formatting it
 * here would be a second money formatter, which `lib/pay-amount.ts` documents
 * at length as the thing not to grow.
 *
 * `appLabel` names the payer's app ("GCash", "your bank app") and defaults to
 * the phrase that covers both, because most surfaces do not know the rail yet.
 *
 * ⚠ THE FIRST ARGUMENT IS A BOOLEAN, NOT A VERDICT, AND THAT IS DELIBERATE.
 * Some sentences cover MORE THAN ONE code — /pay's step 1 names GCash and the
 * bank in the same breath, so it may only promise a pre-filled amount when
 * every open rail carries one. Taking a verdict here invited callers to hand
 * over whichever verdict was nearest and have the other rail's answer silently
 * ignored; a caller must now state the conclusion it reached.
 */
export function qrWords(
  carriesAmount: boolean,
  amountText: string,
  opts: { appLabel?: string; reference?: string | null } = {},
): QrWords {
  const app = opts.appLabel?.trim() || 'your GCash or bank app';
  const ref = opts.reference?.trim();
  const note = ref
    ? `Put ${ref} in the transfer note — it is how we match your payment to your account.`
    : 'Put your reference in the transfer note — it is how we match your payment to your account.';

  if (carriesAmount) {
    return {
      scanStep: `Scan the code with ${app} — ${amountText} is already in it, so there is nothing to type.`,
      caption: `This code carries ${amountText}. Your app fills the amount in for you.`,
      pointer: `The code on the payment page carries ${amountText}, so there is nothing to type.`,
      note,
    };
  }

  // 🔑 THE HONEST SENTENCE NAMES THREE THINGS, NOT ONE: that the code has no
  // amount, the exact figure to type, and that it must be typed EXACTLY. The
  // owner's instruction, 2026-09-20: *"say plainly that it has no amount, that
  // they must type ₱837.50 exactly, and that the reference goes in the note."*
  return {
    scanStep: `Scan the code with ${app}, then type ${amountText} yourself — this code carries no amount.`,
    caption: `This code carries no amount. Type ${amountText} exactly before you send.`,
    pointer: `The code on the payment page carries no amount — you type ${amountText} yourself.`,
    note,
  };
}

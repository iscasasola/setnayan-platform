/**
 * 🍎 EVERY OUTCOME AROUND APPLE'S SHEET HAS ITS OWN HONEST SENTENCE.
 *
 * Prototype `in_app_purchase_screens_2026-10-17_fable.html` frames 6–9:
 *   success   — said ONLY once our server verified Apple's transaction and
 *               switched the item on ("Event Hub Pro is on");
 *   pending   — Apple confirmed, we are still switching it on: never "success",
 *               never a spinner forever ("Switching it on…");
 *   cancelled — the person closed Apple's sheet: "Nothing was charged.";
 *   failed    — Apple could not complete it: "nothing charged, nothing changed",
 *               and the buy button STAYS (later never takes the buy away).
 *
 * Apple's own error text is never shown raw. Pure — the copy is tested here and
 * rendered by the app's sheets.
 */

export type IapStartRefusal =
  | 'unavailable'
  | 'sign_in'
  | 'not_member'
  | 'couple_only'
  | 'no_money_consent'
  | 'not_on_sale'
  | 'event_over'
  | 'owned'
  | 'try_again';

export type IapStartResult =
  | { ok: true; token: string; productId: string }
  | { ok: false; reason: IapStartRefusal; message: string };

export type IapConfirmResult =
  | { status: 'on'; eventId: string; serviceKey: string }
  | { status: 'pending' }
  | { status: 'refunded' }
  | { status: 'invalid' }
  | { status: 'refused'; reason: string };

export type IapRestoreResult =
  | { ok: true; restored: Array<{ eventId: string; eventName: string | null; serviceKey: string }>; pending: number }
  | { ok: false };

const START_COPY: Record<IapStartRefusal, string> = {
  unavailable: 'This is not available in the app right now.',
  sign_in: 'Sign in to your account to buy this.',
  not_member: 'You can only buy this for an event you are part of.',
  couple_only: 'Only the couple can add credits.',
  no_money_consent: 'The couple has not given you permission to pay for this event.',
  not_on_sale: 'This is not on sale right now.',
  event_over: 'Your day is over — this can no longer be added.',
  owned: 'Your event already has this.',
  try_again: 'We couldn’t start that. Nothing was charged — please try again.',
};

export function startRefusal(reason: IapStartRefusal): IapStartResult {
  return { ok: false, reason, message: START_COPY[reason] };
}

/** What the native sheet answered (lib/iap/native-store.ts). */
export type IapSheetResult = 'purchased' | 'cancelled' | 'pending' | 'failed';

/** The one state a buy sheet shows after Apple's sheet closes. */
export type IapScreen =
  | { kind: 'on' }
  | { kind: 'pending'; askToBuy: boolean }
  | { kind: 'cancelled' }
  | { kind: 'failed' }
  | { kind: 'refused'; message: string };

export const IAP_COPY = {
  cancelled: 'Nothing was charged.',
  failedLead: 'The App Store couldn’t complete this purchase. Nothing was charged, and nothing changed on your event.',
  failedNext: 'Check your Apple payment method, then try again.',
  pendingTitle: 'Switching it on…',
  pendingRestore: 'If it’s not here in a few minutes, open Profile › Restore purchases. You will not be charged twice.',
  askToBuy: 'Waiting for your family organiser to approve — we’ll switch it on when Apple tells us.',
  billedByApple: 'Billed by Apple to your Apple account.',
  receipt: 'Your receipt comes from Apple.',
  storeSilent: 'The App Store isn’t answering right now. Try again in a moment.',
} as const;

/** "Apple confirmed your purchase of 500 credits. We're adding them to this event now…" */
export function pendingLine(what: string, plural: boolean): string {
  return `Apple confirmed your purchase of ${what}. We’re ${plural ? 'adding them to' : 'switching it on for'} this event now — it usually takes a moment.`;
}

/**
 * Map the native sheet's answer + our server's answer to the one screen to show.
 * Success requires BOTH: Apple said purchased AND our server said on.
 */
export function screenFor(sheet: IapSheetResult, server: IapConfirmResult | null): IapScreen {
  if (sheet === 'cancelled') return { kind: 'cancelled' };
  if (sheet === 'failed') return { kind: 'failed' };
  if (sheet === 'pending') return { kind: 'pending', askToBuy: true };
  // purchased
  if (!server) return { kind: 'pending', askToBuy: false };
  switch (server.status) {
    case 'on':
      return { kind: 'on' };
    case 'pending':
      return { kind: 'pending', askToBuy: false };
    case 'refunded':
      return { kind: 'refused', message: 'Apple has refunded this purchase, so it is not on your event.' };
    case 'invalid':
      // We could not verify what the phone handed us: keep it, Apple re-delivers.
      return { kind: 'pending', askToBuy: false };
    default:
      return { kind: 'refused', message: refusedLine(server.reason) };
  }
}

/** A purchase Apple confirmed that we could not attach — said plainly, with the next step. */
export function refusedLine(reason: string): string {
  if (reason === 'not_yours') {
    return 'This purchase belongs to a different Setnayan account. Sign in as the account that started it, then open Profile › Restore purchases.';
  }
  if (reason === 'no_event') {
    return 'The event this was bought for no longer exists, so nothing was switched on. Apple can refund it from your Apple account’s purchase history.';
  }
  return 'We couldn’t match this purchase to your event. You will not be charged again — open Profile › Restore purchases, or message us from Help.';
}

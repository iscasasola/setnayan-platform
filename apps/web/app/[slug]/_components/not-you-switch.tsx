import { SIGN_OUT_ERASES_SELFIE } from '@/lib/face-selfie-lifetime';
import { DoorChoices } from './door-choices';
import { doorSignInHref } from './door-choice-words';

/** The listed, signed-in guest's line (owner 2026-11-03): "Not Maria? Switch account". */
export const SWITCH_ACCOUNT_WORDS = 'Switch account';

/**
 * "NOT YOU? SWITCH" — under the guest's name, for a phone a family shares
 * (owner 2026-09-26: *"yes"* to "Not you? Switch" on a shared phone).
 *
 * It clears THIS browser's guest pass (`/{slug}/sign-out`, a POST — a link
 * would be run by a prefetch) and lands on the event page as a stranger, where
 * the one button is "Get inside: Scan your QR, Tap NFC or Sign in" — so the
 * next person in the family opens their own key.
 *
 * ⚠ It clears the GUEST PASS, not a Setnayan account sign-in: a signed-in
 * account is a different person's own session and is signed out from the
 * account menu, never from somebody's invitation.
 *
 * 🧽 AND IT ERASES THE FACE-TAGGING SELFIE (owner 2026-09-30) — the sign-out
 * route does it. `erasesSelfie` (the guest has one) says so BEFORE the tap, in
 * the owner's words: a control that deletes something must say it first.
 *
 * 🚪 …AND FOR A SIGNED-IN GUEST ON THIS LIST, "NOT MARIA? SWITCH ACCOUNT" (owner 2026-11-03, DECISION_LOG "THE GUEST
 * DOOR IS ONE BUTTON"): their invitation shows straight away (the server answered with their seat), and under the
 * cover's button one small line opens THE SAME three choices as the signed-out door — Scan QR · Upload QR · Lost QR?
 * Login (`DoorChoices`). `account` draws that line; nothing is signed out by drawing or opening it. A `<details>`,
 * so it opens with no script.
 */
export function NotYouSwitch({
  slug,
  className = '',
  erasesSelfie = false,
  account,
}: {
  slug: string;
  className?: string;
  erasesSelfie?: boolean;
  /** A signed-in guest on this list: their first name ('' when the list has none — "Not you?"). */
  account?: { firstName: string };
}) {
  if (account) {
    return (
      <details data-not-you-switch="account" className={`group mx-auto w-full max-w-md text-sm text-ink/70 ${className}`}>
        <summary className="mx-auto flex min-h-[44px] w-fit cursor-pointer list-none items-center justify-center gap-1 [&::-webkit-details-marker]:hidden">
          Not {account.firstName || 'you'}?{' '}
          <span className="font-medium text-ink underline underline-offset-4">{SWITCH_ACCOUNT_WORDS}</span>
        </summary>
        <div className="mt-3">
          <DoorChoices slug={slug} signIn={doorSignInHref(slug)} />
        </div>
      </details>
    );
  }
  return (
    <form method="post" action={`/${slug}/sign-out`} className={`text-sm text-ink/70 ${className}`}>
      Not you?{' '}
      <button
        type="submit"
        className="min-h-[44px] min-w-[44px] font-medium text-ink underline underline-offset-4 hover:text-link"
      >
        Switch
      </button>
      {erasesSelfie ? (
        <span data-sign-out-erases-selfie="" className="block text-xs text-ink/70">
          {SIGN_OUT_ERASES_SELFIE}
        </span>
      ) : null}
    </form>
  );
}

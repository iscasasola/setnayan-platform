import Link from 'next/link';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { SubmitButton } from '@/app/_components/submit-button';
import { TERMS_FIELD } from '@/lib/terms-agreement';
import { eventConnectPath } from '@/lib/signup-landing';
import type { GuestAccountState } from '@/lib/guest-one-path';
import { claimAccountAction, linkThisSeatAction } from '../actions';

/**
 * THE ONE ACCOUNT PROMPT on a guest's invitation (owner 2026-09-25: *"The link
 * process must be easy to understand and manoeuvered."*).
 *
 * It replaced FIVE: the "Keep this on your phone" email box, the top-corner
 * "Link to account" chip, the "Keep this event for good" note, the photos and
 * vendor-save notes pointing at "the box near the top", and the host pitch that
 * sat in front of all of them. One card, in one place, that stays until the
 * invitation is linked and then says so — "Linked to <email> ✓".
 *
 * 🔑 IT NEVER ASKS FOR AN ADDRESS. The guest's email is asked ONCE on this page,
 * in the reply. With an address on file the card sends the link to it in one
 * press; without one it opens the reply, where the box is.
 *
 * Every state is decided by `guestAccountState` (lib/guest-one-path.ts) — this
 * file only draws them. Tap targets are ≥ 44px: 99% of guests are on a phone.
 */
export function GuestAccountCard({
  state,
  eventId,
  slug,
  knownEmail,
  photosClosing,
  eventWord,
}: {
  state: GuestAccountState;
  eventId: string;
  slug: string;
  /** The address this guest's reply holds (`guests.email`), or null. */
  knownEmail: string | null;
  /** The accountless photo window has closed (a day after the event). */
  photosClosing: boolean;
  eventWord: string;
}) {
  if (state.kind === 'linked') {
    return (
      <p
        id="claim-account"
        className="flex min-h-[44px] items-center gap-2 text-sm text-ink/65"
        data-account-state="linked"
      >
        <span aria-hidden className="text-success-700">
          ✓
        </span>
        <span>
          Linked to{' '}
          <span className="font-medium text-ink">{state.accountEmail ?? 'your Setnayan account'}</span>
          {' '}— open it from any phone by signing in.
        </span>
      </p>
    );
  }

  const shell = (children: React.ReactNode) => (
    <section
      id="claim-account"
      aria-label="Keep this invitation"
      data-account-state={state.kind}
      className="scroll-mt-24 border-l-2 border-terracotta/40 bg-terracotta/[0.04] px-5 py-4"
    >
      {children}
    </section>
  );

  const why = photosClosing
    ? `The guest view winds down about a day after the ${eventWord}. Keeping it in your account keeps your invitation and your photos — on any phone.`
    : 'Open it again on any phone — your reply, your table, your photos. No password needed.';

  if (state.kind === 'link_sent') {
    return shell(
      <>
        <h2 className="text-base font-semibold text-ink">Check your email</h2>
        <p className="mt-1 text-sm text-ink/70">
          We sent a sign-in link{knownEmail ? <> to <span className="font-medium text-ink">{knownEmail}</span></> : null}.
          Tap it on this phone and this invitation stays in your account.
        </p>
      </>,
    );
  }

  if (state.kind === 'sign_in') {
    return shell(
      <>
        <h2 className="text-base font-semibold text-ink">This invitation is in your account</h2>
        <p className="mt-1 text-sm text-ink/70">Sign in to see it here and on any phone.</p>
        <Link
          href={`/login?next=${encodeURIComponent(`/${slug}`)}`}
          className="button-primary mt-3 inline-flex min-h-[44px] w-full items-center justify-center sm:w-auto"
        >
          Sign in
        </Link>
      </>,
    );
  }

  if (state.kind === 'held_elsewhere') {
    return shell(
      <>
        <h2 className="text-base font-semibold text-ink">Kept in another account</h2>
        <p className="mt-1 text-sm text-ink/70">
          This invitation is linked to a different Setnayan account. Sign in with that one to see
          it there.
        </p>
      </>,
    );
  }

  if (state.kind === 'link_this_seat') {
    return shell(
      <>
        <h2 className="text-base font-semibold text-ink">This is me</h2>
        <p className="mt-1 text-sm text-ink/70">
          Keep this invitation in your Setnayan account — {why.charAt(0).toLowerCase() + why.slice(1)}
        </p>
        <form action={linkThisSeatAction.bind(null, eventId)} className="mt-3">
          <SubmitButton
            className="button-primary min-h-[44px] w-full sm:w-auto"
            pendingLabel="Linking…"
            overlay={false}
          >
            Keep it in my account
          </SubmitButton>
        </form>
      </>,
    );
  }

  // state.kind === 'offer'
  return shell(
    <>
      <h2 className="text-base font-semibold text-ink">This is me — keep this invitation in my account</h2>
      <p className="mt-1 text-sm text-ink/70">{why}</p>
      {state.failed ? (
        <p role="alert" className="mt-2 text-sm text-terracotta-700">
          We could not send the link just now. Please try again.
        </p>
      ) : null}
      {knownEmail ? (
        <form action={claimAccountAction.bind(null, eventId, slug)} className="mt-3 space-y-3">
          {/* THE AGREEMENT — the same clickwrap `/signup` uses (lib/terms-agreement.ts):
              unticked, required, above the press. This link CREATES an account. */}
          <label htmlFor="keep-terms" className="flex min-h-[44px] items-start gap-3 text-sm text-ink/75">
            <input
              id="keep-terms"
              name={TERMS_FIELD}
              type="checkbox"
              required
              className="mt-0.5 h-5 w-5 shrink-0 accent-terracotta"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" className="font-medium text-link underline-offset-2 hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-medium text-link underline-offset-2 hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <SubmitButton
            className="button-primary min-h-[44px] w-full sm:w-auto"
            pendingLabel="Sending…"
            overlay={false}
          >
            Email a sign-in link to {knownEmail}
          </SubmitButton>
        </form>
      ) : (
        <a
          href="#your-details"
          className="button-primary mt-3 inline-flex min-h-[44px] w-full items-center justify-center sm:w-auto"
        >
          Add your email to your reply
        </a>
      )}
      {ANY_OAUTH_ENABLED ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-ink/55">Or in one tap:</p>
          <OAuthButtonRow next={eventConnectPath(eventId)} />
        </div>
      ) : null}
    </>,
  );
}

import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { SubmitButton } from '@/app/_components/submit-button';
import type { GuestAccountState } from '@/lib/guest-one-path';
import { RSVP_TERMS_COOKIE, rsvpTermsCarried } from '@/lib/terms-agreement';
import { linkThisSeatAction } from '../actions';
import { SaveToAccount } from './save-to-account';

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
 * 📵 IT NEVER EMAILS AND NEVER ASKS FOR AN ADDRESS (owner 2026-09-29, DECISION_LOG
 * "NO EMAIL TO GUESTS — THE QR AND THE LINK DO EVERYTHING"). Its one press is the
 * shared `SaveToAccount` — Apple / Google by the device, or, inside Messenger,
 * "Open in your browser" (the guest's own link, copied).
 *
 * Every state is decided by `guestAccountState` (lib/guest-one-path.ts) — this
 * file only draws them. Tap targets are ≥ 44px: 99% of guests are on a phone.
 */
export async function GuestAccountCard({
  state,
  eventId,
  slug,
  personalLink,
  photosClosing,
  eventWord,
}: {
  state: GuestAccountState;
  eventId: string;
  slug: string;
  /** This guest's own invitation link (`buildInvitationUrl`). */
  personalLink: string | null;
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
  const termsCarried = rsvpTermsCarried((await cookies()).get(RSVP_TERMS_COOKIE)?.value);
  return shell(
    <>
      <h2 className="text-base font-semibold text-ink">This is me — keep this invitation in my account</h2>
      <p className="mt-1 text-sm text-ink/70">{why}</p>
      <div className="mt-3">
        <SaveToAccount
          state={state}
          eventId={eventId}
          slug={slug}
          personalLink={personalLink}
          userAgent={(await headers()).get('user-agent')}
          termsCarried={termsCarried}
        />
      </div>
    </>,
  );
}

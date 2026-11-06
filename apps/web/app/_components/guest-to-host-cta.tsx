'use client';

// Guest → host growth-loop CTA.
//
// Shown at the moments a wedding guest is most delighted (RSVP confirmation,
// "Your Photos") on the public guest landing page. A soft, tasteful nudge to
// start their OWN event on Setnayan. No persistent guest account, no DB row.
//
// 🍪 ESSENTIAL COOKIES ONLY (owner 2026-10-22): this used to send two PostHog
// events. Setnayan no longer runs optional analytics, so it is a plain link.

type GuestToHostCtaProps = {
  /** Where on the guest page this CTA rendered, e.g. 'rsvp_confirmation'. */
  surface: string;
  /** Internal event uuid (events.event_id). NOT shown to the user. */
  eventId: string;
  /** Public event id (events.public_id) — safe to carry in the signup URL. */
  eventPublicId: string;
  headline: string;
  sub: string;
};

export function GuestToHostCta({
  eventPublicId,
  headline,
  sub,
}: GuestToHostCtaProps) {
  /*
    SHOWN ONLY ONCE THE GUEST IS LINKED (owner 2026-09-25) — both mounts gate on
    `hostPitchShows` (lib/guest-one-path.ts), so the person reading this is
    SIGNED IN. It used to send them to `/signup?ref=guest`, a sign-up form for
    somebody who already has an account, which bounced them onward and never
    back to the invitation. Their account board is where their own celebration
    starts, beside the invitation they just kept. `src_event` still rides along
    for the sign-up attribution (no PII — a public id).
  */
  const href = `/dashboard?ref=guest&src_event=${encodeURIComponent(eventPublicId)}`;

  // SUBTLE, ON PURPOSE (owner 2026-09-25): one quiet line, never a second
  // coloured box competing with the guest's own invitation.
  return (
    <p className="text-sm text-ink/60">
      <span className="font-medium text-ink/75">{headline}</span> {sub}{' '}
      <a
        href={href}
        className="inline-flex min-h-[44px] items-center font-medium text-link underline-offset-2 hover:underline"
      >
        Start planning →
      </a>
    </p>
  );
}

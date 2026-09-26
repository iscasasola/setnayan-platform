'use client';

// Guest → host growth-loop CTA.
//
// Shown at the moments a wedding guest is most delighted (RSVP confirmation,
// "Your Photos") on the public guest landing page. A soft, tasteful nudge to
// start their OWN event on Setnayan. No persistent guest account, no DB row —
// this is purely a CTA + two PostHog events that let us measure the loop.
//
// Analytics contract (NO PII — only ids + surface + destination):
//   • guest_to_host_cta_shown   — fired once on mount
//   • guest_to_host_cta_clicked — fired on the "Start planning" click
//
// PostHog is lazy-imported the same way as plan-card-lock.tsx so the SDK
// chunk is shared with the rest of the app and analytics never blocks render.
// Every capture is wrapped in try/catch — telemetry MUST NOT break the page.

import { useEffect, useRef } from 'react';

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

async function capture(event: string, properties: Record<string, unknown>) {
  try {
    const ph = (await import('posthog-js')).default;
    ph.capture?.(event, properties);
  } catch {
    // Swallow — analytics is best-effort and must never break the page.
  }
}

export function GuestToHostCta({
  surface,
  eventId,
  eventPublicId,
  headline,
  sub,
}: GuestToHostCtaProps) {
  // Fire the "shown" event exactly once, even under React 19 strict-mode's
  // double-invoked effects.
  const shownRef = useRef(false);
  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    void capture('guest_to_host_cta_shown', {
      surface,
      event_id: eventId,
      event_public_id: eventPublicId,
    });
  }, [surface, eventId, eventPublicId]);

  /*
    SHOWN ONLY ONCE THE GUEST IS LINKED (owner 2026-09-25) — both mounts gate on
    `hostPitchShows` (lib/guest-one-path.ts), so the person reading this is
    SIGNED IN. It used to send them to `/signup?ref=guest`, a sign-up form for
    somebody who already has an account, which bounced them onward and never
    back to the invitation. Their account board is where their own celebration
    starts, beside the invitation they just kept. `src_event` still rides along
    for the growth-loop measurement (no PII — a public id).
  */
  const href = `/dashboard?ref=guest&src_event=${encodeURIComponent(eventPublicId)}`;

  // SUBTLE, ON PURPOSE (owner 2026-09-25): one quiet line, never a second
  // coloured box competing with the guest's own invitation.
  return (
    <p className="text-sm text-ink/60">
      <span className="font-medium text-ink/75">{headline}</span> {sub}{' '}
      <a
        href={href}
        onClick={() => {
          // Don't preventDefault — let the navigation happen normally.
          void capture('guest_to_host_cta_clicked', {
            surface,
            event_id: eventId,
            event_public_id: eventPublicId,
            destination: '/dashboard',
          });
        }}
        className="inline-flex min-h-[40px] items-center font-medium text-link underline-offset-2 hover:underline"
      >
        Start planning →
      </a>
    </p>
  );
}

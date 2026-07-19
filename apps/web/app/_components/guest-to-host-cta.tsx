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

  const href = `/signup?ref=guest&src_event=${encodeURIComponent(eventPublicId)}`;

  return (
    <div className="rounded-2xl border border-terracotta/20 bg-terracotta/5 p-5">
      <p className="text-base font-semibold tracking-tight text-ink">{headline}</p>
      <p className="mt-1 text-sm text-ink/65">{sub}</p>
      <a
        href={href}
        onClick={() => {
          // Don't preventDefault — let the navigation happen normally.
          void capture('guest_to_host_cta_clicked', {
            surface,
            event_id: eventId,
            event_public_id: eventPublicId,
            destination: '/signup',
          });
        }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-700"
      >
        Start planning →
      </a>
    </div>
  );
}

'use client';

/**
 * AnonInquiryComposer — compose-first "Inquire" for a visitor who doesn't have
 * an event yet (signed-out, or signed-in with no event). It replaces the old
 * "Already a Setnayan couple? … from your dashboard" dead-end on the public
 * vendor profile.
 *
 * Owner design (2026-07-02): the visitor writes the inquiry FIRST (email +
 * service + message), the CTA reads "Log in free to see your conversation", and
 * submitting carries the inquiry through signup + event onboarding. Nothing is
 * saved server-side until the account + event exist (no anon-leads table); the
 * composed inquiry rides localStorage (writePendingVendorInquiry) and the
 * dashboard dispatcher replays it once they land authenticated with an event.
 *
 * V1 routes to /onboarding/wedding (wedding-first; the generic /onboarding/[type]
 * flow is feature-flagged). Email isn't collected for a signed-in visitor — we
 * already have their account, so they go straight to event onboarding.
 */

import { useState, type FormEvent } from 'react';
import { MessageCircle } from 'lucide-react';
import { writePendingVendorInquiry } from '@/lib/pending-vendor-inquiry';

export type AnonComposerService = {
  vendorServiceId: string;
  label: string;
  priceLabel: string;
  categoryKey: string | null;
};

type Props = {
  vendorProfileId: string;
  vendorSlug: string;
  vendorLabel: string;
  services: AnonComposerService[];
  /**
   * true when a signed-in (non-anonymous) user with no event is viewing — skip
   * signup and go straight to event onboarding. false → signed-out or anonymous:
   * route through signup (a real account) first.
   */
  signedInNoEvent: boolean;
};

const ONBOARDING_PATH = '/onboarding/wedding';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AnonInquiryComposer({
  vendorProfileId,
  vendorSlug,
  vendorLabel,
  services,
  signedInNoEvent,
}: Props) {
  const [email, setEmail] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.vendorServiceId ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    const svc = services.find((s) => s.vendorServiceId === serviceId) ?? services[0];
    if (!svc) {
      setError('Please choose a service.');
      return;
    }
    if (!signedInNoEvent && !EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email so the vendor can reply.');
      return;
    }
    if (message.trim().length < 2) {
      setError('Add a short message so the vendor knows what you need.');
      return;
    }

    setBusy(true);
    setError(null);
    writePendingVendorInquiry({
      vendorProfileId,
      vendorSlug,
      serviceId: svc.vendorServiceId,
      categoryKey: svc.categoryKey,
      message: message.trim(),
    });

    // Signed-in-no-event → straight to event onboarding (they already have an
    // account). Otherwise route through signup (real account) with the email
    // pre-filled, then onboarding via `next`.
    window.location.href = signedInNoEvent
      ? ONBOARDING_PATH
      : `/signup?next=${encodeURIComponent(ONBOARDING_PATH)}&prefill_email=${encodeURIComponent(email.trim())}`;
  }

  const fieldClass =
    'w-full rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-mulberry focus:outline-none focus:ring-1 focus:ring-mulberry/30';

  return (
    <form onSubmit={submit} className="max-w-xl space-y-3 rounded-2xl border border-ink/10 bg-cream/60 p-5">
      {!signedInNoEvent ? (
        <div className="space-y-1">
          <label htmlFor="anon-inq-email" className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
            Your email
          </label>
          <input
            id="anon-inq-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className={fieldClass}
            disabled={busy}
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="anon-inq-service" className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
          Which service
        </label>
        <select
          id="anon-inq-service"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className={fieldClass}
          disabled={busy}
        >
          {services.map((s) => (
            <option key={s.vendorServiceId} value={s.vendorServiceId}>
              {s.label}
              {s.priceLabel ? ` — ${s.priceLabel}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="anon-inq-message" className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
          Your message
        </label>
        <textarea
          id="anon-inq-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder={`Tell ${vendorLabel} about your day — date, venue, headcount, what you're looking for.`}
          className={`${fieldClass} resize-y`}
          disabled={busy}
        />
      </div>

      {error ? <p className="text-xs text-danger-700">{error}</p> : null}

      <button
        type="submit"
        disabled={busy || services.length === 0}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-default disabled:opacity-90"
      >
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream border-t-transparent" aria-hidden />
            Taking you there…
          </>
        ) : (
          <>
            <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {signedInNoEvent ? 'Set up your event to send this' : 'Log in free to see your conversation'}
          </>
        )}
      </button>

      <p className="text-[11px] text-ink/50">
        Free to plan. We&rsquo;ll save your account and event, then send this to {vendorLabel}.
      </p>
    </form>
  );
}

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
 * ── The visitor picks their EVENT TYPE here (owner 2026-08-06) ───────────────
 * This used to hard-code /onboarding/wedding, so someone asking a caterer about
 * their mother's 60th birthday was marched into planning a WEDDING. The owner's
 * flow is explicit: "for what type of event? then onboarding." So the composer
 * asks, and hands off to the create-event picker with the type pre-selected.
 *
 * 🔑 WHY THE PICKER AND NOT /onboarding/<type> DIRECTLY: choosing the right
 * onboarding for a type is a THREE-branch rule (an explicit onboarding_href;
 * else the generic experience flow when its flag is on; else the inline name
 * form) that already lives in event-type-picker.tsx and auto-advances on mount
 * via its `preselect` prop. Re-deriving it here would be a second copy that
 * drifts — and the third branch isn't a URL at all, so a naive
 * `/onboarding/${key}` 404s for every type whenever that flag is off. Handing
 * the key to the picker reuses the live rule, including its fallback.
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

/** One creatable event type, straight from the live vocab (never hard-coded). */
export type AnonComposerEventType = {
  key: string;
  label: string;
  emoji: string | null;
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
  /**
   * Creatable event types (active AND enabled), in vocab sort order. Server-fed
   * so the picker can never offer a type the create-event page would reject.
   * Empty ⇒ the question is skipped entirely and we fall back to the wedding
   * flow, preserving the pre-2026-08-06 behaviour rather than dead-ending.
   */
  eventTypes: AnonComposerEventType[];
};

/** Fallback only — used when the vocab came back empty (see `eventTypes`). */
const WEDDING_ONBOARDING_PATH = '/onboarding/wedding';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Where to send someone once we know their event type: the create-event picker
 * with the type pre-selected, which auto-advances into that type's real
 * onboarding on mount. `wedding` keeps its direct path — it is the one type
 * whose onboarding href is guaranteed and flag-free.
 */
function destinationFor(eventTypeKey: string): string {
  if (!eventTypeKey || eventTypeKey === 'wedding') return WEDDING_ONBOARDING_PATH;
  return `/dashboard/create-event?event_type=${encodeURIComponent(eventTypeKey)}`;
}

export function AnonInquiryComposer({
  vendorProfileId,
  vendorSlug,
  vendorLabel,
  services,
  signedInNoEvent,
  eventTypes,
}: Props) {
  const [email, setEmail] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.vendorServiceId ?? '');
  // No default selection: an unanswered "what kind of event" must not silently
  // become a wedding, which is exactly the bug this screen is fixing.
  const [eventTypeKey, setEventTypeKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askEventType = eventTypes.length > 0;

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
    // Only enforced when we actually asked — an empty vocab keeps the old
    // wedding path rather than blocking the inquiry behind a question with no
    // answers in it.
    if (askEventType && !eventTypes.some((t) => t.key === eventTypeKey)) {
      setError('Please choose what kind of event this is.');
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

    // Signed-in-no-event → straight to their event's setup (they already have
    // an account). Otherwise route through signup (real account) with the email
    // pre-filled, then the same destination via `next`.
    const destination = destinationFor(askEventType ? eventTypeKey : 'wedding');
    window.location.href = signedInNoEvent
      ? destination
      : `/signup?next=${encodeURIComponent(destination)}&prefill_email=${encodeURIComponent(email.trim())}`;
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

      {askEventType ? (
        <div className="space-y-1">
          <label
            htmlFor="anon-inq-event-type"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50"
          >
            What kind of event
          </label>
          <select
            id="anon-inq-event-type"
            value={eventTypeKey}
            onChange={(e) => setEventTypeKey(e.target.value)}
            className={fieldClass}
            disabled={busy}
          >
            <option value="">Choose one…</option>
            {eventTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.emoji ? `${t.emoji} ` : ''}
                {t.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

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

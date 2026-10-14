'use client';

import { useId, useState } from 'react';
import { createPortal, useFormStatus } from 'react-dom';
import { Check, Plus, X } from 'lucide-react';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { SubmitButton } from '@/app/_components/submit-button';
import { buyService } from '../service-buy-actions';
import { SERVICE_OFFERS, type ServiceOfferKind } from '@/lib/service-offers';
import { ENCODER_BUY_NOTICE, LEAD_TIME_NOTICE, MUSIC_RIGHTS_NOTICE, YOUTUBE_READY_NOTICE } from '@/lib/live-studio-readiness';
import { POOL_CHANNEL_SHARED_STRIKE_NOTICE } from '@/lib/live-studio-pool-only';
import { setYoutubeLiveReadyAck } from '../studio/live-studio-control/actions';

/**
 * 🔒 WHAT MUST BE SAID BEFORE THE MONEY MOVES — the same facts the Live Watch buy
 * page's sheet carries (lib/live-studio-readiness.ts; lib/live-studio-pool-only.ts),
 * so Home's Add can never sell Live Watch with less warning than its own page.
 */
const NOTICES: Partial<Record<ServiceOfferKind, readonly string[]>> = {
  live: [LEAD_TIME_NOTICE, YOUTUBE_READY_NOTICE, ENCODER_BUY_NOTICE, MUSIC_RIGHTS_NOTICE],
  'more-screen': [POOL_CHANNEL_SHARED_STRIKE_NOTICE],
};
/** Live Watch asks the buyer to confirm their channel can go live — the page's own box. */
const YOUTUBE_ACK = 'I understand, and I already have a YouTube account that is ready for live streaming.';

const ERROR_COPY: Record<string, string> = {
  not_couple: 'Only the couple can add this.',
  unavailable: 'This is not on sale right now, so nothing was charged.',
  order_failed: "We couldn't start that order, so nothing was charged. Please try again.",
  event_over: 'Your day is over — this can no longer be added.',
};

/**
 * ✅ ADD / BUY MORE — ONE SHEET, FIVE SERVICES (owner "approve all", 2026-10-14 —
 * services prototype `renderSheet()`; the Papic sheet's shape, `PapicBuySheet`):
 * the title, one line, what it costs (the counter's box — one unit, no − / +,
 * `lib/service-offers.ts`), what comes with it, "After this", and Continue to
 * payment → the order is minted → /pay (`buyService`).
 *
 * 🔘 The press shows pressed at once; "Continue to payment" locks and reads
 * "Opening payment…" and the one step line says what is happening — one order,
 * never two (#6527). The price is the catalog's, handed in; the server re-reads
 * it. Portalled to <body>: the dashboard's page-enter transform would otherwise
 * pin a fixed sheet to the page, not the screen.
 */
export function ServiceBuySheet({
  eventId,
  kind,
  price,
  label = 'Add',
  tone = 'brand',
  main = false,
  wide = false,
  defaultOpen = false,
  error = null,
}: {
  eventId: string;
  kind: ServiceOfferKind;
  /** The catalog's price (PHP) — null when it could not be read: the sheet says so and does not sell. */
  price: number | null;
  label?: string;
  tone?: ActionTone;
  main?: boolean;
  wide?: boolean;
  /** Open on arrival — a refusal to read (`?buy_error=`). */
  defaultOpen?: boolean;
  error?: string | null;
}) {
  const headingId = useId();
  const [open, setOpen] = useState(defaultOpen);
  /* Starts unticked ALWAYS (the ChoosePlanSheet rule): a tick is the buyer's own claim. */
  const [acked, setAcked] = useState(false);
  const offer = SERVICE_OFFERS[kind];
  const priced = typeof price === 'number' && Number.isFinite(price) && price > 0;
  const notices = NOTICES[kind] ?? [];
  const needsAck = kind === 'live' && !acked;

  const sheet = open ? (
    <Sheet open onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-4 pb-4 pt-3.5" data-service-buy-sheet={kind}>
        <h3 id={headingId} className="text-[19px] font-semibold tracking-tight text-ink">
          {offer.title}
        </h3>
        <p className="mb-3.5 text-sm text-ink/60">{offer.sub}</p>
        {error ? (
          <p className="mb-3 text-sm font-medium" role="alert" style={{ color: 'rgb(var(--color-danger))' }}>
            {ERROR_COPY[error] ?? 'Something went wrong, and nothing was charged. Please try again.'}
          </p>
        ) : null}
        <span className="home-eyebrow block">What it costs</span>
        <div className="mt-2 flex min-h-[60px] flex-col items-center justify-center rounded-2xl border border-ink/15 bg-cream px-2.5 py-1.5 text-center"> {/* no-card-ok: the shipped CreditStepper's value box (credit-stepper.tsx), the one-unit counter of the approved sheet */}
          <span className="text-2xl font-semibold leading-tight tracking-tight tabular-nums text-ink" data-service-price="">
            {priced ? `₱${price!.toLocaleString('en-PH', { maximumFractionDigits: 0 })}` : '—'}
          </span>
          <span className="whitespace-nowrap text-[12.5px] text-ink/65">{offer.unit}</span>
        </div>
        <ul className="mt-2.5 space-y-1 text-[13.5px] text-ink/65">
          {offer.inc.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check aria-hidden className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--color-ok))' }} strokeWidth={2.2} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="sg-after">
          <span>After this</span>
          <b>{offer.after}</b>
        </div>
        {notices.length > 0 ? (
          <div className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink/80" data-service-buy-notice="">
            {notices.map((n) => (
              <p key={n} className="m-0">
                {n}
              </p>
            ))}
          </div>
        ) : null}
        {kind === 'live' ? (
          <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed text-ink/85">
            <input
              type="checkbox"
              checked={acked}
              onChange={(e) => {
                const next = e.target.checked;
                setAcked(next);
                // Fire-and-forget, like the page's sheet: a failed write only asks again next time.
                void setYoutubeLiveReadyAck(next).catch(() => {});
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-mulberry"
            />
            <span>{YOUTUBE_ACK}</span>
          </label>
        ) : null}
        {priced && needsAck ? (
          <p className="mt-3.5 text-center text-sm text-ink/60">Tick the box above to continue</p>
        ) : priced ? (
          <form action={buyService} className="mt-3.5">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="offer" value={kind} />
            {/* ONE PRESS, ONE BILL (#6527): it locks the moment it is pressed and says the
                one step until the payment page opens; the server half is lib/one-press-one-order.ts. */}
            <SubmitButton
              overlay={false}
              pendingLabel="Opening payment…"
              className="ab ab-brand ab-main sg-pay inline-flex min-h-11 w-full items-center justify-center"
            >
              Continue to payment
            </SubmitButton>
            <PayStep />
          </form>
        ) : (
          <p className="mt-3.5 text-sm" role="alert" style={{ color: 'rgb(var(--color-danger))' }}>
            The price could not be read, so nothing can be charged. Refresh and try again.
          </p>
        )}
        <div className="mt-1.5 text-center">
          <ActionButton tone="neutral" quiet icon={<X aria-hidden="true" strokeWidth={1.9} />} label="Not now" onClick={() => setOpen(false)} />
        </div>
      </div>
    </Sheet>
  ) : null;

  return (
    <>
      <ActionButton
        tone={tone}
        main={main}
        icon={<Plus aria-hidden="true" strokeWidth={1.9} />}
        label={label}
        className={wide ? 'w-full justify-center' : undefined}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid={`service-buy-${kind}`}
      />
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  );
}

/** The one line that names the step while the payment page opens. */
function PayStep() {
  const { pending } = useFormStatus();
  return (
    <p className="sg-step" aria-live="polite">
      {pending ? 'Taking you to GCash, card or bank — one order, never two.' : ''}
    </p>
  );
}

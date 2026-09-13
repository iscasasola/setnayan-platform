'use client';

/**
 * "Setnayan AI, N% off — today only" — the comeback offer for a couple who
 * didn't buy AI when they set up their event. Sibling of `PapicReadyNudge`:
 * same band geometry, same one-eyebrow/title/body/link shape, mounted in the
 * same `overlays` slot in `page.tsx` (never inside the bento's blur budget).
 *
 * Eligibility, the regular price and the discounted price are all resolved
 * SERVER-SIDE (`lib/setnayan-ai-server.ts` → `resolveSetnayanAiComebackDisplayPhp`,
 * mirrored by the charge-time check in `lib/order-charge-authority.ts`) — this
 * component only renders what it's handed and runs the countdown against the
 * server-computed `expiresAtIso`. It never decides eligibility itself.
 *
 * Benefit lines are the exact group headings from
 * `studio/setnayan-ai/_components/setnayan-ai-value-copy.ts` — reused, not
 * reworded, so the pitch here never drifts from the one on the buy page.
 */

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  InlineCheckoutDrawer,
  type InlineCheckoutDrawerProps,
} from './inline-checkout-drawer';

const SKU_CODE = 'SETNAYAN_AI';

type Remaining = { hours: number; minutes: number; seconds: number; isPast: boolean };

function compute(target: number): Remaining {
  const ms = target - Date.now();
  if (ms <= 0) return { hours: 0, minutes: 0, seconds: 0, isPast: true };
  return {
    hours: Math.floor(ms / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
    isPast: false,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The three group headings from setnayan-ai-value-copy.ts, unaltered. */
const BENEFIT_LINES = [
  'Builds your suggested team by best fit, not cheapest',
  'Tracks every deadline for you and tells you what to do next',
  'Flags a payment, a price change or a schedule clash before it costs you',
];

type Props = {
  eventId: string;
  displayName: string | null;
  regularPhp: number;
  settings: InlineCheckoutDrawerProps['settings'];
  /**
   * The discount arm. BOTH are present or BOTH are absent — absent means the
   * couple's 24h window never opened or has lapsed, and the card sells at list
   * price instead of disappearing (owner 2026-08-31).
   */
  comebackPhp?: number;
  expiresAtIso?: string;
};

export function SetnayanAiComebackOffer({
  eventId,
  displayName,
  regularPhp,
  comebackPhp,
  expiresAtIso,
  settings,
}: Props) {
  const target = expiresAtIso ? new Date(expiresAtIso).getTime() : null;
  const [remaining, setRemaining] = useState<Remaining>(() =>
    target == null ? { hours: 0, minutes: 0, seconds: 0, isPast: true } : compute(target),
  );

  /**
   * THE HEADLINE PERCENTAGE IS DERIVED FROM THE TWO PRICES ON SCREEN, NOT TYPED.
   *
   * 🔑 This is the ONLY place a percentage is allowed to exist in this feature,
   * and only because it is a rounding of numbers the money path never reads —
   * the charge is the midpoint in pesos (lib/setnayan-ai-comeback-offer.ts),
   * and `lib/order-charge-authority.ts` re-derives it server-side.
   *
   * It was three hard-coded "20% off" strings. That is subtly false TODAY: the
   * live rows imply 20.01–20.10% because the prices carry charm endings, so a
   * card promising a flat 20 already misstates the offer it is selling — and it
   * would misstate it badly the first time anybody reprices a tier. Deriving it
   * means the copy can never drift from the amount beside it.
   */
  const pctOff =
    comebackPhp != null && regularPhp > 0
      ? Math.round((1 - comebackPhp / regularPhp) * 100)
      : null;

  useEffect(() => {
    if (target == null) return;
    const id = window.setInterval(() => setRemaining(compute(target)), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  /*
    ── THE DISCOUNT EXPIRING IS NOT THE PRODUCT EXPIRING ────────────────────

    This used to `return null` the moment the countdown hit zero, so a couple
    watching the last minute run out saw the whole card — and with it the only
    route to Setnayan AI on this page — blink out of existence. Owner,
    2026-08-31: *"sai expired. should show a cta button to purchase still."*

    Now the discount arm simply drops away and the same card keeps selling at
    list price. `discounted` is the ONE switch both halves read, so the price
    shown, the strike-through, the eyebrow and the button label can never
    disagree about which offer is on screen.

    🔒 The price it falls back to is not asserted here — it is `regularPhp`,
    resolved server-side, and the charge path independently stops applying the
    discount on the same lapse. A stale tab therefore cannot buy at yesterday's
    price, and cannot be overcharged either.
  */
  const discounted = comebackPhp != null && pctOff != null && !remaining.isPast;

  return (
    <div className="mt-4 rounded-2xl border border-mulberry/30 bg-mulberry/[0.05] px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mulberry text-cream"
        >
          <Sparkles className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mulberry">
            {discounted ? `${pctOff}% off · today only` : 'Setnayan AI'}
          </p>
          <p className="mt-0.5 text-base font-semibold text-ink">
            {discounted ? (
              <>
                Setnayan AI, {pctOff}% off for the next{' '}
                <span className="font-mono tabular-nums">
                  {remaining.hours > 0 ? `${pad(remaining.hours)}:` : ''}
                  {pad(remaining.minutes)}:{pad(remaining.seconds)}
                </span>
              </>
            ) : (
              'Plan with Setnayan AI'
            )}
          </p>
          <ul className="mt-2 space-y-1">
            {BENEFIT_LINES.map((line) => (
              <li key={line} className="text-sm text-ink/65">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink/70">
          {/* The strike-through is the DISCOUNT's, so it goes with it. Showing
              a struck price beside an identical live one reads as a fake
              markdown, which is the one thing a lapsed offer must not do. */}
          {discounted ? (
            <span className="mr-1.5 text-ink/40 line-through">
              ₱{Math.round(regularPhp).toLocaleString('en-PH')}
            </span>
          ) : null}
          <span className="font-mono text-lg font-bold text-ink">
            ₱{Math.round(discounted ? comebackPhp! : regularPhp).toLocaleString('en-PH')}
          </span>
        </p>
        <InlineCheckoutDrawer
          eventId={eventId}
          serviceKey={SKU_CODE}
          displayName={`Setnayan AI${displayName ? ` · ${displayName}` : ''}`}
          originalPriceCentavos={String(
            Math.round((discounted ? comebackPhp! : regularPhp) * 100),
          )}
          settings={settings}
          triggerLabel={
            discounted ? `Unlock Setnayan AI · ${pctOff}% off` : 'Unlock Setnayan AI'
          }
          triggerClassName="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[var(--m-mulberry)] px-6 py-2.5 text-sm font-semibold text-[var(--m-paper)] transition-opacity hover:opacity-90 disabled:opacity-70"
        />
      </div>
    </div>
  );
}

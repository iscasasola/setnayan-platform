'use client';

import { useActionState, useState } from 'react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import { bookingFeePhp, bookingFeeScheduleSummary } from '@/lib/booking-fee';

/**
 * THE VENDOR BOOKING FEE — the owner's three numbers.
 *
 * ⚖ Owner-locked 2026-08-28: the 5%, the ₱100,000 threshold and the 1% are his
 * to change. Until now they were code constants in two places.
 *
 * ⚠ THIS BLOCK IS HEADED SEPARATELY FROM "Platform fee" ON PURPOSE. There are
 * TWO different 5%s on this screen and they are opposite products:
 *   • Platform fee (`setnayan_pay_fee_pct`) — a dormant gateway fee the
 *     CUSTOMER would pay.
 *   • This one — charged to the SUPPLIER, for the introduction and the in-app
 *     sync. NEVER a commission; the couple pays the supplier directly and
 *     Setnayan never touches that money.
 * Sitting them side by side under one heading is how the wrong one gets edited,
 * so each says who pays in its own first line.
 *
 * 🔑 THE SCHEDULE IS RENDERED BACK AS A SENTENCE, LIVE. Three numbers in three
 * boxes do not tell you what a supplier is billed; the sentence and the worked
 * examples underneath are computed from what is currently typed, so he reads
 * what his own numbers produce before he saves them.
 */
export function BookingFeeForm({
  action,
  ratePct,
  tailRatePct,
  tier1LimitPhp,
  minPhp,
  isFromDb,
  enabled,
}: {
  action: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
  ratePct: number;
  tailRatePct: number;
  tier1LimitPhp: number;
  minPhp: number;
  isFromDb: boolean;
  enabled: boolean;
}) {
  const [state, formAction] = useActionState<RowActionState, FormData>(action, {
    ok: false,
    message: null,
  });

  // Live, so the sentence and the examples track what is typed rather than what
  // was last saved.
  const [rate, setRate] = useState(String(ratePct));
  const [tail, setTail] = useState(String(tailRatePct));
  const [band, setBand] = useState(String(tier1LimitPhp));

  const rateN = Number(rate);
  const tailN = Number(tail);
  const bandN = Number(band);
  const usable =
    Number.isFinite(rateN) && rateN >= 0 && rateN <= 100 &&
    Number.isFinite(tailN) && tailN >= 0 && tailN <= 100 &&
    Number.isFinite(bandN) && bandN > 0;

  const schedule = usable
    ? { rate: rateN / 100, tailRate: tailN / 100, tier1LimitPhp: bandN, minPhp }
    : null;

  // ⚠ The one that protects the model: a tail ABOVE the head turns the taper
  // into a surcharge and rewards under-declaring — the exact incentive the
  // schedule exists to remove.
  const inverted = usable && tailN > rateN;

  const examples = [60_000, 300_000, 1_000_000, 10_000_000];

  return (
    <form action={formAction} className="rounded-2xl border border-ink/10 p-4">
      <h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-gold-text">
        Vendor booking fee
      </h4>
      <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-ink/60">
        Charged to the <strong className="text-ink/80">supplier</strong> when Setnayan introduces
        them to a couple — never to the couple, and never a commission. The couple pays the
        supplier directly.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Rate below the threshold
          </span>
          <div className="relative mt-1">
            <input
              name="booking_fee_rate_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="input-field w-full pr-7 text-right tabular-nums"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">
              %
            </span>
          </div>
        </label>

        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Threshold
          </span>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">
              ₱
            </span>
            <input
              name="booking_fee_tier1_limit_php"
              type="number"
              step="1"
              min="1"
              value={band}
              onChange={(e) => setBand(e.target.value)}
              className="input-field w-full pl-6 text-right tabular-nums"
            />
          </div>
        </label>

        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Rate above it
          </span>
          <div className="relative mt-1">
            <input
              name="booking_fee_tail_rate_pct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={tail}
              onChange={(e) => setTail(e.target.value)}
              className="input-field w-full pr-7 text-right tabular-nums"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">
              %
            </span>
          </div>
        </label>
      </div>

      {/* What his own numbers produce, in the supplier's own words. */}
      <div className="mt-3 rounded-xl border border-ink/10 bg-ink/[0.02] p-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          A supplier is billed
        </span>
        <p className="mt-1 text-[13.5px] font-semibold text-ink">
          {schedule ? bookingFeeScheduleSummary(schedule) : 'Fill in all three numbers.'}
        </p>
        {schedule && (
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink/60">
            {examples.map((amt) => (
              <li key={amt} className="tabular-nums">
                ₱{amt.toLocaleString('en-PH')} booking →{' '}
                <strong className="font-mono text-ink/85">
                  ₱{bookingFeePhp(amt, schedule).toLocaleString('en-PH')}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inverted && (
        <p className="mt-2 rounded-lg border border-danger-700/30 bg-danger-700/[0.06] px-3 py-2 text-[12.5px] font-semibold text-danger-700">
          The rate above the threshold is higher than the rate below it. That charges a supplier
          more for declaring a bigger booking honestly — this will not save.
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-ink/45">
        The <strong>₱{minPhp}</strong> minimum and the fact that there is <strong>no upper cap</strong>{' '}
        are fixed and not editable here.{' '}
        {isFromDb ? 'Set in platform settings.' : 'Falling back to the built-in schedule — save once to store it.'}{' '}
        {enabled
          ? 'The booking fee is switched ON — changes bill real suppliers.'
          : 'The booking fee is switched off, so nothing is being billed yet.'}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta-800"
        >
          Save booking fee
        </button>
        {state.message && (
          <span className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

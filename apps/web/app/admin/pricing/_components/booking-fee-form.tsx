'use client';

import { useActionState, useState } from 'react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import { bookingFeePhp, bookingFeeScheduleSummary } from '@/lib/booking-fee';
import { formatPhp } from '@/lib/php';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';
import { ActionButton } from '@/components/action-button';
import { TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { Save } from 'lucide-react';

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

  // 📐 Admin clean port (owner 19 Nov 2026): the card's three labelled boxes became three rows of the design template —
  // name on the left, the number on the right — over the same live sentence, examples, warning and fine print.
  const row = 'flex min-h-14 items-center gap-3 border-b border-[color:var(--sn-divider)] py-2';
  const name = 'min-w-0 flex-1 text-[15px] font-semibold leading-tight text-ink';
  return (
    <form action={formAction} className={`${ADMIN_FRAME} px-4`} data-booking-fee-form="">
      <label className={row}>
        <span className={name}>Rate below the threshold</span>
        <span className="relative w-28 flex-none">
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
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">%</span>
        </span>
      </label>

      <label className={row}>
        <span className={name}>Threshold</span>
        <span className="relative w-36 flex-none">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">₱</span>
          <input
            name="booking_fee_tier1_limit_php"
            type="number"
            step="1"
            min="1"
            value={band}
            onChange={(e) => setBand(e.target.value)}
            className="input-field w-full pl-6 text-right tabular-nums"
          />
        </span>
      </label>

      <label className={row}>
        <span className={name}>Rate above it</span>
        <span className="relative w-28 flex-none">
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
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">%</span>
        </span>
      </label>

      {/* What his own numbers produce, in the supplier's own words. */}
      <div className="border-b border-[color:var(--sn-divider)] py-2.5">
        <span className={TEMPLATE_SUBLINE}>A supplier is billed</span>
        <p className="mt-0.5 text-[14px] font-semibold text-ink">
          {schedule ? bookingFeeScheduleSummary(schedule) : 'Fill in all three numbers.'}
        </p>
        {schedule && (
          <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink/60">
            {examples.map((amt) => (
              <li key={amt} className="tabular-nums">
                ₱{amt.toLocaleString('en-PH')} booking →{' '}
                <strong className="text-ink/85">₱{bookingFeePhp(amt, schedule).toLocaleString('en-PH')}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inverted && (
        <div className="pt-2 text-[13px] font-semibold" style={{ color: 'rgb(var(--color-danger))' }} role="alert">
          <p>The rate above the threshold is higher than the rate below it.</p>
          <p>That charges a supplier more for declaring a bigger booking honestly — this will not save.</p>
        </div>
      )}

      <p className={`pt-2 ${TEMPLATE_SUBLINE}`}>
        The <strong>{formatPhp(minPhp)}</strong> minimum and <strong>no upper cap</strong> are fixed.
      </p>
      <p className={TEMPLATE_SUBLINE}>
        {isFromDb ? 'Set in platform settings.' : 'Falling back to the built-in schedule — save once to store it.'}
      </p>
      <p className={TEMPLATE_SUBLINE}>
        {enabled
          ? 'The booking fee is switched ON — changes bill real suppliers.'
          : 'The booking fee is switched off, so nothing is being billed yet.'}
      </p>

      <div className="flex flex-wrap items-center gap-2 py-3">
        <ActionButton tone="brand" main type="submit" icon={<Save aria-hidden strokeWidth={1.9} />} label="Save booking fee" />
        {state.message && (
          <span className="text-[13px]" style={{ color: state.ok ? 'rgb(var(--color-ok))' : 'rgb(var(--color-danger))' }}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

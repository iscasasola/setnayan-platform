/**
 * <Readout> — THE NUMBER IS THE INTERFACE (design brief 2026-09-24 §2: "massive
 * numerical readouts … and sharp micro-labels over sentence structures").
 * Borderless: a big `.sn-num` figure over a `.sn-eye` micro-label, optionally
 * with an `(i)` beside the label. Read build-sessions/DESIGN-FOUNDATION.md.
 *
 *     <Readout value={guestCount} label="Guests" />
 *     <Readout value={committedPhp} label="Committed" format="php" info="…" />
 *
 * 🔴 `value: number | null`, AND NULL IS NOT ZERO. A read that failed arrives
 * as `null` and renders a muted dash with "Couldn't load" — never ₱0, never 0.
 * The house has paid for this lesson more than once: a refused read `?? 0`'d
 * into "₱0 committed" against a real budget, and "Paid ₱0" billed a couple the
 * full amount again (see `app/vendor-dashboard/reads-are-honest.test.ts` and
 * `lib/guests-read-is-honest.test.ts`). So the caller must decide, at the read,
 * whether it measured a zero or failed to measure — this component will not
 * guess for it. Pass `0` only when zero was MEASURED.
 *
 * Money goes through `formatPhp` (`lib/php.ts`, the one peso formatter —
 * `lib/security/money-formatter-scan.test.ts` polices a second one).
 *
 * ⚠ Never render a Readout inside a `<header>`: its label is an `.sn-eye`, and
 * `lint:masthead` fails an `.sn-eye` inside a page header. Readouts go in the
 * body, under the title.
 */

import type { ReactNode } from 'react';
import { formatPhp } from '@/lib/php';
import { InfoTip } from './info-tip';

export type ReadoutFormat = 'count' | 'php';

const COUNT = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

/**
 * What a Readout prints for a value. Pure, so the null ≠ 0 rule is executed by
 * `readout.test.ts`. A non-finite number (NaN from a bad division, Infinity) is
 * a failed measurement too — printing "NaN" or "∞" is the same lie as "0".
 */
export function readoutDisplay(
  value: number | null,
  format: ReadoutFormat = 'count',
): { text: string; failed: boolean } {
  if (value === null || !Number.isFinite(value)) return { text: '—', failed: true };
  return { text: format === 'php' ? formatPhp(value) : COUNT.format(value), failed: false };
}

export type ReadoutProps = {
  /** The measured figure, or `null` when it could not be read. Never `?? 0`. */
  value: number | null;
  /** The micro-label: one to three words ("Guests", "Committed"). */
  label: string;
  format?: ReadoutFormat;
  /** Secondary explanation, behind an `(i)` beside the label. */
  info?: ReactNode;
  /** A short unit after the number ("of 180", "days"). */
  unit?: string;
  /** `hero` for the one number a screen is about; `sm` for its secondaries. */
  size?: 'hero' | 'sm';
  className?: string;
};

export function Readout({
  value,
  label,
  format = 'count',
  info,
  unit,
  size = 'hero',
  className,
}: ReadoutProps) {
  const { text, failed } = readoutDisplay(value, format);
  return (
    <div className={`flex flex-col gap-2${className ? ` ${className}` : ''}`}>
      {info ? (
        <InfoTip label={label} labelClassName="sn-eye" align="start">
          {info}
        </InfoTip>
      ) : (
        <span className="sn-eye">{label}</span>
      )}
      <p className="flex items-baseline gap-2">
        <span
          className="sn-num transition-colors duration-sn-elem ease-sn"
          data-size={size === 'sm' ? 'sm' : undefined}
          data-failed={failed ? 'true' : undefined}
        >
          {text}
        </span>
        {failed ? (
          <span className="text-sm font-medium text-ink/55">Couldn&rsquo;t load</span>
        ) : unit ? (
          <span className="text-sm font-semibold text-ink/55">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

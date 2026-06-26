'use client';

import { useState } from 'react';
import { purchasePapicExtras } from './actions';

/**
 * Papic UNLIMITED-extras picker. The ONLY way to add a camera for a shooter who
 * is NOT on the guest list (a videographer friend, a hired second shooter). Off
 * the list there's no guest record + no personal gallery, so extras are Unlimited
 * only — uncapped, archived to Drive. One stepper, minimum 1.
 *
 * (Limited cameras come from the guest list and are activated separately — there
 * is no manual count for them.)
 *
 * Self-contained (only the server action import) so nothing server-only leaks
 * into the client bundle.
 */
function php(amount: number): string {
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default function ExtraCamerasPicker({
  eventId,
  unlimitedRate,
  unliCapPhp,
  unliFree = false,
}: {
  eventId: string;
  unlimitedRate: number;
  unliCapPhp: number;
  /** PAPIC_UNLOCK owners get Unli free + uncapped (₱0). */
  unliFree?: boolean;
}) {
  const [count, setCount] = useState(1);

  const raw = count * unlimitedRate;
  const charge = unliFree ? 0 : Math.min(raw, unliCapPhp);
  const capped = !unliFree && raw > unliCapPhp;
  const free = charge === 0;

  return (
    <form action={purchasePapicExtras} className="flex flex-col gap-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="unlimited" value={count} readOnly />

      <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">Unlimited cameras</div>
          <div className="text-xs text-ink/55">
            {unliFree
              ? 'No limit · free with Unlock all'
              : `No limit · archived to your Drive · ${php(unlimitedRate)} / camera / day`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Remove one camera"
            onClick={() => setCount(Math.max(1, count - 1))}
            className="h-8 w-8 rounded-full border border-ink/15 text-lg leading-none text-ink"
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-medium tabular-nums text-ink">
            {count}
          </span>
          <button
            type="button"
            aria-label="Add one camera"
            onClick={() => setCount(count + 1)}
            className="h-8 w-8 rounded-full border border-ink/15 text-lg leading-none text-ink"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink/60">
          {count} extra camera{count === 1 ? '' : 's'} · 1 day
        </span>
        <span className="text-lg font-medium tabular-nums text-ink">
          {free ? 'Free' : php(charge)}
        </span>
      </div>

      {capped ? (
        <p className="text-xs text-ink/55">
          Price locked — Unlimited caps at {php(unliCapPhp)} (would be {php(raw)}).
        </p>
      ) : null}

      <button
        type="submit"
        className="w-full rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
      >
        {free
          ? `Add ${count} extra camera${count === 1 ? '' : 's'} · Free`
          : `Add ${count} extra camera${count === 1 ? '' : 's'} · ${php(charge)}`}
      </button>
      <p className="text-center text-xs text-ink/50">
        {free
          ? 'Each gets a claim link to share. Activates right away.'
          : 'Apply-then-pay — payment instructions next. Each gets a claim link to share.'}
      </p>
    </form>
  );
}

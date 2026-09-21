'use client';

/**
 * SelfAddedPrice — "you agreed a price; type it" for a supplier the couple
 * added themselves. (owner 2026-09-20)
 *
 * ── What it replaces ──────────────────────────────────────────────────────
 * The bench card's `needs_price` note: *"Ask for a price to add this to your
 * build."* Correct for a marketplace supplier, who has an inbox. For an
 * off-platform one it names an action with no recipient — nobody is on the
 * other end, no quote can arrive, and the card sits in that state for good.
 * Owner, verbatim: "manual upload can have no requesting. it can be automatic
 * uploaded. these do not need approval. so they can just list manually."
 *
 * ── NOT A SECOND WRITER ───────────────────────────────────────────────────
 * It posts to `updateVendorCosts` — the SAME action the add modal's post-save
 * panel and the workspace Costing editor already use, so `total_cost_php` has
 * one writer and the budget cannot be told two different numbers. This form
 * carries only the price; transport, food allowance and crew live in the
 * workspace Costing editor, which shows all of them together, and the link
 * below points there rather than reproducing them on a 240px card.
 *
 * ⚠ IT POSTS `price_only`, AND THE HISTORY IS WHY. `updateVendorCosts`
 * rewrites every costing column on each call, reading an absent field as null
 * or false. This control first worked around that by echoing transport and
 * food back — and did not echo crew, so every save here silently reset
 * `crew_size` and `crew_meal_covered` (found 2026-09-21). Echoing columns from
 * a caller that does not own them is the bug; `price_only` is the fix.
 */

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Check, Loader2, PencilLine } from 'lucide-react';
import { useSaveLoader } from '@/components/sd-loader';
import { updateVendorCosts } from '../actions';

export function SelfAddedPrice({
  eventId,
  vendorId,
}: {
  eventId: string;
  vendorId: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();

  function submit() {
    const n = Number.parseFloat(value.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      setErr('Enter the price you agreed, in pesos.');
      return;
    }
    setErr(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('vendor_id', vendorId);
        fd.set('total_cost_php', String(Math.round(n)));
        // PRICE ONLY. This control used to echo transport and food back so
        // updateVendorCosts would not blank them — and did NOT echo crew, so
        // every save reset crew_size and crew_meal_covered. The writer now has
        // a price-only mode, which leaves every other column alone.
        fd.set('price_only', '1');
        await save.run(() => updateVendorCosts(fd), {
          steps: ['Saving the price'],
          hint: 'Saving',
        });
        // The action revalidates /vendors, so the card re-renders with the
        // price and this control is replaced by "＋ Add to build".
      } catch {
        setErr('Could not save — try again, or add it from their page.');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="vact ghost"
        onClick={() => setOpen(true)}
        aria-label="Add the price you agreed"
      >
        <PencilLine size={12} strokeWidth={1.9} aria-hidden />
        Add the price you agreed
      </button>
    );
  }

  return (
    <div className="vact-inline-price">
      <label className="sr-only" htmlFor={`self-price-${vendorId}`}>
        Price you agreed, in pesos
      </label>
      <div className="vact-inline-price-row">
        <span aria-hidden>₱</span>
        <input
          id={`self-price-${vendorId}`}
          type="text"
          inputMode="decimal"
          autoFocus
          disabled={pending}
          value={value}
          placeholder="80,000"
          onChange={(e) => {
            setValue(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" onClick={submit} disabled={pending} aria-label="Save price">
          {pending ? (
            <Loader2 size={12} className="animate-spin" strokeWidth={2} aria-hidden />
          ) : (
            <Check size={12} strokeWidth={2.4} aria-hidden />
          )}
        </button>
      </div>
      {err ? (
        <p role="alert" className="vact-inline-price-err">
          {err}
        </p>
      ) : null}
      <Link
        href={`/dashboard/${eventId}/vendors/${vendorId}/workspace`}
        className="vact-inline-price-more"
        onClick={(e) => e.stopPropagation()}
      >
        Transport, food &amp; inclusions →
      </Link>
    </div>
  );
}

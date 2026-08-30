'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';

import { useToast } from '@/app/_components/toast/toast-provider';
import { VENDOR_VENUE_TYPES, VENDOR_VENUE_TYPE_LABEL } from '@/lib/vendor-venue-type';
import { updateVenueType } from '../venue-type-actions';

/**
 * My Shop → Business Profile → "What kind of venue are you".
 *
 * The missing writer for `vendor_profiles.venue_type` — read publicly by the
 * v1 vendor profile API and by Explore's leaf-match filter since it shipped,
 * with no form in the product that could set it. Mirrors `VenueMatchCard`
 * (the sibling "what am I a fit for" declaration), but this is a single pick,
 * not a multi-select: a venue is one kind of venue.
 *
 * Rendered for every shop, same as `VenueMatchCard` — a non-venue vendor
 * simply leaves it unset, identical to "no venue-type constraint".
 */
export function VenueTypeCard({ initialVenueType }: { initialVenueType: string | null }) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [venueType, setVenueType] = useState<string | null>(initialVenueType);
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  function pick(next: string | null) {
    setVenueType(next);
    setJustSaved(false);
    const fd = new FormData();
    if (next) fd.set('venue_type', next);
    setPending(true);
    startTransition(async () => {
      const res = await updateVenueType(null, fd);
      setPending(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setVenueType(res.venueType);
      setJustSaved(true);
    });
  }

  return (
    <section
      className="mt-3 rounded-xl border p-4"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
    >
      <h3 className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        What kind of venue are you{' '}
        <span className="font-normal" style={{ color: 'var(--m-slate)' }}>
          (optional)
        </span>
      </h3>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
        Shown on your public profile and used to match couples searching for your kind of
        venue. Leave unset and you match every reception style.
      </p>

      <fieldset className="mt-3">
        <legend className="sr-only">Venue type</legend>
        <div className="flex flex-wrap gap-1.5">
          {VENDOR_VENUE_TYPES.map((key) => {
            const on = venueType === key;
            return (
              <label
                key={key}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors"
                style={{
                  borderColor: on ? 'var(--m-accent-deep)' : 'var(--m-line)',
                  background: on ? 'var(--m-accent-soft, rgba(194,78,37,0.08))' : 'transparent',
                  color: 'var(--m-ink)',
                }}
              >
                <input
                  type="radio"
                  name="venue_type"
                  checked={on}
                  disabled={pending}
                  onChange={() => pick(key)}
                  className="h-3.5 w-3.5 accent-[var(--m-accent-deep)]"
                />
                {VENDOR_VENUE_TYPE_LABEL[key] ?? key}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => pick(null)}
          disabled={pending || venueType === null}
          className="text-xs underline disabled:opacity-40"
          style={{ color: 'var(--m-slate)' }}
        >
          Clear
        </button>
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : justSaved ? (
          <span
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--m-slate)' }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            Saved
          </span>
        ) : null}
      </div>
    </section>
  );
}

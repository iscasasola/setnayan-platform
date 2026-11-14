'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';

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
/** Rule 2's section label — small grey capitals, no box. */
const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]';

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
    <section className="mt-5" data-venue-type-card>
      <InfoTip
        label="What kind of venue are you (optional)"
        labelAs="h3"
        labelClassName={SECTION_LABEL}
        align="start"
      >
        Shown on your public profile and used to match couples searching for your kind of venue. Leave unset and you
        match every reception style.
      </InfoTip>

      <fieldset className="mt-2">
        <legend className="sr-only">Venue type</legend>
        <div className="flex flex-wrap gap-2">
          {VENDOR_VENUE_TYPES.map((key) => {
            const on = venueType === key;
            return (
              <label
                key={key}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm text-ink transition-colors duration-sn-control ease-sn ${
                  on ? 'border-[color:var(--m-accent-deep)] bg-terracotta/10' : 'border-[color:var(--m-line)]'
                }`}
              >
                <input
                  type="radio"
                  name="venue_type"
                  checked={on}
                  disabled={pending}
                  onChange={() => pick(key)}
                  className="h-4 w-4 accent-[var(--m-accent-deep)]"
                />
                {VENDOR_VENUE_TYPE_LABEL[key] ?? key}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <ActionButton
          tone="neutral"
          quiet
          icon={X}
          label="Clear"
          onClick={() => pick(null)}
          disabled={pending || venueType === null}
        />
        {pending ? (
          <span className="text-sm text-[color:var(--m-slate-2)]" role="status">
            Saving…
          </span>
        ) : justSaved ? (
          <span className="inline-flex items-center gap-1 text-sm text-[color:var(--m-slate-2)]" role="status">
            <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
            Saved
          </span>
        ) : null}
      </div>
    </section>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';

import { ActionButton } from '@/components/action-button';

import { useToast } from '@/app/_components/toast/toast-provider';
import {
  COMPATIBLE_CEREMONY_TYPES,
  COMPATIBLE_CEREMONY_TYPE_LABEL,
  COMPATIBLE_VENUE_SETTINGS,
  COMPATIBLE_VENUE_SETTING_LABEL,
} from '@/lib/vendor-compatibility';
import { updateVenueMatching } from '../venue-match-actions';

/**
 * My Shop → Business Profile → "Weddings you're a fit for".
 *
 * The missing writer for `compatible_venue_settings` /
 * `compatible_ceremony_types`. Explore has filtered on both columns since
 * iteration 0043; until this card there was no form in the product that posted
 * either one, so every shop matched on its seed row.
 *
 * ── THE COPY IS THE SAFETY MECHANISM ────────────────────────────────────────
 * "Nothing ticked" and "everything ticked" mean the SAME thing to the
 * marketplace (a NULL column matches every couple), but they read as opposites
 * on screen — a blank card looks like a shop that has excluded itself. So the
 * empty state says out loud that it means every venue, and the heading counts
 * what is ticked. Without that sentence a shop owner ticking nothing would
 * reasonably believe they had turned themselves off.
 *
 * Labels come from `lib/vendor-compatibility.ts`, which re-exports the COUPLE'S
 * own vocabulary. A vendor must be ticking the same words the couple picked, or
 * the two sides can agree and still never match.
 */
export function VenueMatchCard({
  initialVenueSettings,
  initialCeremonyTypes,
}: {
  initialVenueSettings: string[] | null;
  initialCeremonyTypes: string[] | null;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [venues, setVenues] = useState<Set<string>>(() => new Set(initialVenueSettings ?? []));
  const [ceremonies, setCeremonies] = useState<Set<string>>(
    () => new Set(initialCeremonyTypes ?? []),
  );
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  function toggle(
    set: Set<string>,
    apply: (next: Set<string>) => void,
    key: string,
    on: boolean,
  ) {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    apply(next);
    setJustSaved(false);
  }

  function save() {
    const fd = new FormData();
    // Order the payload by the canonical vocabulary rather than tick order, so
    // the stored array reads the same regardless of which box was clicked
    // first — the public badges render in array order.
    for (const v of COMPATIBLE_VENUE_SETTINGS) {
      if (venues.has(v)) fd.append('compatible_venue_settings', v);
    }
    for (const c of COMPATIBLE_CEREMONY_TYPES) {
      if (ceremonies.has(c)) fd.append('compatible_ceremony_types', c);
    }
    setPending(true);
    setJustSaved(false);
    startTransition(async () => {
      const res = await updateVenueMatching(null, fd);
      setPending(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setVenues(new Set(res.venueSettings ?? []));
      setCeremonies(new Set(res.ceremonyTypes ?? []));
      setJustSaved(true);
    });
  }

  return (
    <section className="mt-5" data-venue-match-card>
      <InfoTip
        label="Weddings you’re a fit for (optional)"
        labelAs="h3"
        labelClassName="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]"
        align="start"
      >
        Couples searching for their kind of wedding see you first. Tick nothing and you
        show up for <strong className="font-semibold text-ink">every</strong> venue and ceremony —
        ticking is how you narrow, not how you appear.
      </InfoTip>

      <CheckGroup
        legend="Venues you work"
        options={COMPATIBLE_VENUE_SETTINGS}
        labels={COMPATIBLE_VENUE_SETTING_LABEL}
        selected={venues}
        emptyNote="Any venue"
        onToggle={(key, on) => toggle(venues, setVenues, key, on)}
      />

      <CheckGroup
        legend="Ceremonies you work"
        options={COMPATIBLE_CEREMONY_TYPES}
        labels={COMPATIBLE_CEREMONY_TYPE_LABEL}
        selected={ceremonies}
        emptyNote="Any ceremony"
        onToggle={(key, on) => toggle(ceremonies, setCeremonies, key, on)}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ActionButton tone="brand" icon={Check} label={pending ? 'Saving…' : 'Save'} onClick={save} waiting={pending} />
        {justSaved && !pending ? (
          <span className="inline-flex items-center gap-1 text-sm text-[color:var(--m-slate-2)]" role="status">
            <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
            Saved
          </span>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One labelled group of checkboxes. A real `<fieldset>`/`<legend>` so a screen
 * reader announces which question each box belongs to — the two groups here ask
 * different questions with visually identical rows.
 */
function CheckGroup({
  legend,
  options,
  labels,
  selected,
  emptyNote,
  onToggle,
}: {
  legend: string;
  options: readonly string[];
  labels: Readonly<Record<string, string>>;
  selected: Set<string>;
  emptyNote: string;
  onToggle: (key: string, on: boolean) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold text-ink">
        {legend}{' '}
        <span className="font-normal text-[color:var(--m-slate-2)]">
          — {selected.size === 0 ? emptyNote : `${selected.size} chosen`}
        </span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((key) => {
          const on = selected.has(key);
          return (
            <label
              key={key}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm text-ink transition-colors duration-sn-control ease-sn ${
                on ? 'border-[color:var(--m-accent-deep)] bg-terracotta/10' : 'border-[color:var(--m-line)]'
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => onToggle(key, e.currentTarget.checked)}
                className="h-4 w-4 accent-[var(--m-accent-deep)]"
              />
              {labels[key] ?? key}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

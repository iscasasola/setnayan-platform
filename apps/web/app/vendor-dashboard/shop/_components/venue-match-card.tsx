'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';

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
    <section
      className="mt-3 rounded-xl border p-4"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
    >
      <h3 className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        Weddings you’re a fit for{' '}
        <span className="font-normal" style={{ color: 'var(--m-slate)' }}>
          (optional)
        </span>
      </h3>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
        Couples searching for their kind of wedding see you first. Tick nothing and you
        show up for <strong style={{ fontWeight: 600 }}>every</strong> venue and ceremony —
        ticking is how you narrow, not how you appear.
      </p>

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
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: 'var(--m-accent-deep)' }}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : null}
          Save
        </button>
        {justSaved && !pending ? (
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
    <fieldset className="mt-3">
      <legend className="text-xs font-medium" style={{ color: 'var(--m-ink)' }}>
        {legend}{' '}
        <span className="font-normal" style={{ color: 'var(--m-slate)' }}>
          — {selected.size === 0 ? emptyNote : `${selected.size} chosen`}
        </span>
      </legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((key) => {
          const on = selected.has(key);
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
                type="checkbox"
                checked={on}
                onChange={(e) => onToggle(key, e.currentTarget.checked)}
                className="h-3.5 w-3.5 accent-[var(--m-accent-deep)]"
              />
              {labels[key] ?? key}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

import Link from 'next/link';

import { SubmitButton } from '@/app/_components/submit-button';
import { VENUE_TYPES, CEREMONY_TYPES } from '../_constants';

/**
 * Shared form for creating + editing a `venue_directory` row.
 * Server component — the form action is passed in as a server-action ref.
 */
export type VenueFormInitial = {
  slug: string;
  name: string;
  venue_type: string;
  location_city: string;
  hq_address: string | null;
  hq_latitude: number;
  hq_longitude: number;
  compatible_ceremony_types: string[];
  source_note: string | null;
};

const VENUE_TYPE_LABEL: Record<(typeof VENUE_TYPES)[number], string> = {
  catholic_church: 'Catholic Church',
  christian_church: 'Christian Church',
  inc_chapel: 'INC Chapel',
  mosque: 'Mosque',
  cultural_site: 'Cultural Site',
  civil_registrar: 'Civil Registrar',
  hotel_ballroom: 'Hotel Ballroom',
  garden: 'Garden',
  beach: 'Beach',
  destination_resort: 'Destination Resort',
  heritage: 'Heritage',
  outdoor_tent: 'Outdoor Tent',
};

const CEREMONY_TYPE_LABEL: Record<(typeof CEREMONY_TYPES)[number], string> = {
  catholic: 'Catholic',
  christian: 'Christian',
  inc: 'INC',
  muslim: 'Muslim',
  cultural: 'Cultural',
  chinese: 'Chinese',
  jewish: 'Jewish',
  born_again: 'Born Again',
  civil: 'Civil',
};

export function VenueForm({
  action,
  initial,
  submitLabel,
  cancelHref,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Partial<VenueFormInitial>;
  submitLabel: string;
  cancelHref: string;
}) {
  return (
    <form action={action} className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Slug *
          </span>
          <input
            type="text"
            name="slug"
            defaultValue={initial?.slug ?? ''}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            minLength={2}
            maxLength={80}
            placeholder="manila-cathedral"
            className="input-field"
          />
          <span className="font-mono text-[10px] text-ink/45">
            Lowercase letters / digits / single hyphens. Unique across all venues.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Venue type *
          </span>
          <select
            name="venue_type"
            defaultValue={initial?.venue_type ?? 'catholic_church'}
            required
            className="input-field"
          >
            {VENUE_TYPES.map((t) => (
              <option key={t} value={t}>
                {VENUE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Name *
        </span>
        <input
          type="text"
          name="name"
          defaultValue={initial?.name ?? ''}
          required
          minLength={1}
          maxLength={200}
          placeholder="Manila Cathedral"
          className="input-field"
        />
      </label>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Location city *
          </span>
          <input
            type="text"
            name="location_city"
            defaultValue={initial?.location_city ?? ''}
            required
            minLength={1}
            maxLength={100}
            placeholder="Manila / Tagaytay / Cebu"
            className="input-field"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Address (optional)
          </span>
          <input
            type="text"
            name="hq_address"
            defaultValue={initial?.hq_address ?? ''}
            maxLength={500}
            placeholder="Plaza Roma, Intramuros, Manila"
            className="input-field"
          />
        </label>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Latitude *
          </span>
          <input
            type="number"
            name="hq_latitude"
            defaultValue={initial?.hq_latitude ?? ''}
            required
            step="0.0000001"
            min={-90}
            max={90}
            placeholder="14.5919"
            className="input-field"
          />
          <span className="font-mono text-[10px] text-ink/45">
            Decimal degrees. PH range: ~4 to ~21.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Longitude *
          </span>
          <input
            type="number"
            name="hq_longitude"
            defaultValue={initial?.hq_longitude ?? ''}
            required
            step="0.0000001"
            min={-180}
            max={180}
            placeholder="120.9742"
            className="input-field"
          />
          <span className="font-mono text-[10px] text-ink/45">
            Decimal degrees. PH range: ~117 to ~127.
          </span>
        </label>
      </section>

      <fieldset className="rounded-2xl border border-ink/10 bg-cream p-4">
        <legend className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Compatible ceremony types
        </legend>
        <p className="mb-3 text-xs text-ink/55">
          Which faith ceremonies this venue can host. Religious venues should be
          restricted to their faith (e.g. Catholic church → only{' '}
          <code className="font-mono">catholic</code>). Combined venues like
          garden estates that can host any ceremony should check the broad set.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CEREMONY_TYPES.map((ct) => (
            <label key={ct} className="flex items-center gap-2 text-sm text-ink/80">
              <input
                type="checkbox"
                name={`compatible_${ct}`}
                defaultChecked={initial?.compatible_ceremony_types?.includes(ct) ?? false}
                className="h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
              />
              {CEREMONY_TYPE_LABEL[ct]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Source note (optional)
        </span>
        <textarea
          name="source_note"
          defaultValue={initial?.source_note ?? ''}
          maxLength={500}
          rows={2}
          placeholder="UNESCO heritage Augustinian church / Beachfront wedding pavilion / etc."
          className="input-field h-auto py-2"
        />
      </label>

      <footer className="flex flex-wrap items-center gap-2 pt-4">
        <SubmitButton className="button-primary px-5">{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="button-secondary px-5">
          Cancel
        </Link>
      </footer>
    </form>
  );
}

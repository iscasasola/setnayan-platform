import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Trash2 } from 'lucide-react';

import { ConfirmForm } from '@/app/_components/confirm-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { VenueForm } from '../_components/venue-form';
import { deleteVenue, updateVenue } from '../actions';

export const metadata = { title: 'Edit venue · Admin' };

type Props = { params: Promise<{ id: string }> };

type VenueRow = {
  venue_directory_id: string;
  slug: string;
  name: string;
  venue_type: string;
  location_city: string;
  hq_address: string | null;
  hq_latitude: number | string;
  hq_longitude: number | string;
  compatible_ceremony_types: string[];
  source_note: string | null;
  created_at: string;
};

export default async function EditVenuePage({ params }: Props) {
  const { id } = await params;

  const admin = createAdminClient();
  const { data: rowRaw } = await admin
    .from('venue_directory')
    .select(
      'venue_directory_id,slug,name,venue_type,location_city,hq_address,hq_latitude,hq_longitude,compatible_ceremony_types,source_note,created_at',
    )
    .eq('venue_directory_id', id)
    .maybeSingle();

  if (!rowRaw) notFound();
  const row = rowRaw as VenueRow;

  const updateBound = updateVenue.bind(null, row.venue_directory_id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/admin/venues"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-ink/65 hover:text-ink"
      >
        <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
        Back to venues
      </Link>

      <header className="mb-6 space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Edit venue
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {row.name}
        </h1>
        <p className="font-mono text-[11px] text-ink/45">
          {row.slug} · created{' '}
          {new Date(row.created_at).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      </header>

      <VenueForm
        action={updateBound}
        initial={{
          slug: row.slug,
          name: row.name,
          venue_type: row.venue_type,
          location_city: row.location_city,
          hq_address: row.hq_address,
          hq_latitude: Number(row.hq_latitude),
          hq_longitude: Number(row.hq_longitude),
          compatible_ceremony_types: row.compatible_ceremony_types,
          source_note: row.source_note,
        }}
        submitLabel="Save changes"
        cancelHref="/admin/venues"
      />

      <section className="mt-10 rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-700">
          Danger zone
        </p>
        <p className="mt-1 mb-3 max-w-prose text-sm text-rose-900/80">
          Deleting a venue removes it from the marketplace Paired-Venue panel
          immediately. Couples with this venue in their saved shortlist (none
          today — V1.2 ships saving) will lose the row. Not reversible.
        </p>
        <ConfirmForm
          action={deleteVenue}
          message={`Delete ${row.name}? This cannot be undone.`}
        >
          <input
            type="hidden"
            name="venue_directory_id"
            value={row.venue_directory_id}
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-rose-500 bg-rose-500/10 px-4 text-sm font-medium text-rose-700 hover:bg-rose-500/20"
          >
            <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Delete venue
          </button>
        </ConfirmForm>
      </section>
    </div>
  );
}

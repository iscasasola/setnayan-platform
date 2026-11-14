import { notFound } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { ConfirmForm } from '@/app/_components/confirm-form';
import { ActionButton } from '@/components/action-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { VenueForm, VENUE_TYPE_LABEL } from '../_components/venue-form';
import { deleteVenue, updateVenue } from '../actions';
import { ReadFailed } from '../../_components/read-failed';
import { RecordBack, RecordHead, RecordNote, RecordSection } from '../../_components/record-kit';

import { requireAdmin } from '@/lib/admin/require-admin';
import { PageMasthead } from '@/app/_components/page-masthead';
export const metadata = { title: 'Edit venue · Admin' };

/**
 * 📇 THE VENUE RECORD (owner 14 Nov 2026, "Yes, queue the builds" — the approved 13 Nov drawing
 * `Setnayan-specs/prototypes/admin_pub/people.html`, screen `venue`): the head (what kind of venue · its name), every
 * field of the shared VenueForm, and Remove at the bottom, behind its confirm.
 *
 * ⚖ HONEST READ: a refused read used to fall through to `notFound()` — a real venue reported as missing. It now says
 * "Couldn't read this venue"; only a read that went through and found nothing is a 404.
 */

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
  await requireAdmin();
  const { id } = await params;

  const admin = createAdminClient();
  const { data: rowRaw, error: venueError } = await admin
    .from('venue_directory')
    .select(
      'venue_directory_id,slug,name,venue_type,location_city,hq_address,hq_latitude,hq_longitude,compatible_ceremony_types,source_note,created_at',
    )
    .eq('venue_directory_id', id)
    .maybeSingle();

  if (venueError) {
    logQueryError('admin/venues/[id]', venueError);
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
        <RecordBack href="/admin/venues" label="Venues" />
        <PageMasthead title="Venue" />
        <ReadFailed what="this venue" />
      </div>
    );
  }
  if (!rowRaw) notFound();
  const row = rowRaw as VenueRow;

  const updateBound = updateVenue.bind(null, row.venue_directory_id);
  const typeLabel = VENUE_TYPE_LABEL[row.venue_type as keyof typeof VENUE_TYPE_LABEL] ?? row.venue_type;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <RecordBack href="/admin/venues" label="Venues" />
      <PageMasthead titleNode={<span>{row.name}</span>} />
      <RecordHead small={`Venue · ${typeLabel}`} name={row.name} />

      <div className="mt-3">
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
      </div>

      <div className="mt-8 border-t border-[color:var(--m-line)] pt-2">
        <RecordSection label="Remove">
          <RecordNote>
            Deleting a venue removes it from the marketplace Paired-Venue panel immediately. Couples with this venue in
            their saved shortlist will lose the row. Not reversible.
          </RecordNote>
          <div className="mt-3">
            <ConfirmForm
              action={deleteVenue}
              title={`Delete ${row.name}?`}
              confirmLabel="Delete venue"
              message={`Delete ${row.name}? It leaves the marketplace Paired-Venue panel immediately, and couples with it in their saved shortlist lose the row. This cannot be undone.`}
            >
              <input type="hidden" name="venue_directory_id" value={row.venue_directory_id} />
              <ActionButton tone="danger" icon={<Trash2 aria-hidden strokeWidth={1.9} />} label="Remove the venue" type="submit" />
            </ConfirmForm>
          </div>
        </RecordSection>
      </div>
    </div>
  );
}

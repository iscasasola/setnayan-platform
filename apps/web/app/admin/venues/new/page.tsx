import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { VenueForm } from '../_components/venue-form';
import { createVenue } from '../actions';

export const metadata = { title: 'New venue · Admin' };

export default function NewVenuePage() {
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
          Add new venue
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          New venue
        </h1>
        <p className="max-w-prose text-sm text-ink/65">
          New row in <code className="font-mono">venue_directory</code>. Couples
          will see this venue in the marketplace Paired-Venue panel once it
          falls within 10 km of a reception anchor.
        </p>
      </header>

      <VenueForm
        action={createVenue}
        submitLabel="Create venue"
        cancelHref="/admin/venues"
      />
    </div>
  );
}

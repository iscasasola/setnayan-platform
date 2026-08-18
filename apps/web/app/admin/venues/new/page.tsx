import { VenueForm } from '../_components/venue-form';
import { createVenue } from '../actions';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = { title: 'New venue · Admin' };

export default function NewVenuePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        title="New venue"
        back="/admin/venues"
        backLabel="Back to venues"
        lede={
          <>
            New row in <code className="font-mono">venue_directory</code>. Couples
            will see this venue in the marketplace Paired-Venue panel once it
            falls within 10 km of a reception anchor.
          </>
        }
        className="mb-6"
      />

      <VenueForm
        action={createVenue}
        submitLabel="Create venue"
        cancelHref="/admin/venues"
      />
    </div>
  );
}

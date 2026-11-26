import { requireAdmin } from '@/lib/admin/require-admin';
import { VenueForm } from '../_components/venue-form';
import { createVenue } from '../actions';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = { title: 'New venue · Admin' };

export default async function NewVenuePage() {
  // 🔒 A8·L-2: every /admin page checks for an admin itself, not only through the layout.
  await requireAdmin();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        title="New venue"
      />

      <VenueForm
        action={createVenue}
        submitLabel="Create venue"
        cancelHref="/admin/venues"
      />
    </div>
  );
}

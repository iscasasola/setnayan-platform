import { IterationPlaceholder } from '../_components/placeholder';

export const metadata = { title: 'Guests' };

export default function GuestsPage() {
  return (
    <IterationPlaceholder
      iteration="Iteration 0001 — coming next session"
      title="Guest list"
      blurb="Couple-managed guest list with role tiers, CSV import, plus-ones, and RSVP tracking. The full surface lands in iteration 0001."
      hint="Sub-pages once 0001/0002/0008 ship: Guests · Invitation Site · Seating Chart."
    />
  );
}

import { GridPageSkeleton } from '@/components/skeletons';

/**
 * The two header links ("Invite guests" / "Arrange the room") live inside a
 * `hidden flex-col … lg:flex` shell on the page, so a phone never sees them.
 * Reserving two 44px pills at every width was right on a laptop and 44px of
 * phantom chrome on a phone — which is the very defect the 2026-08-25 sweep
 * existed to remove, one breakpoint down. `actionsAt="lg"` makes the
 * reservation follow the buttons instead of guessing one answer for both.
 */

export default function GuestsLoading() {
  return (
    <GridPageSkeleton
      tiles={15}
      cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      tileClass="h-24"
      actions={2}
      actionsAt="lg"
    />
  );
}

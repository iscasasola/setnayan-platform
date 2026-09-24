import CreateEventPage from '@/app/dashboard/(account)/create-event/page';
import { CreateEventPanel } from '../../_components/create-event-panel';

/**
 * `/dashboard/create-event`, INTERCEPTED from the board — the collection
 * template's add flow (owner-approved 2026-09-24). See `CreateEventPanel`.
 *
 * 🔑 IT RENDERS THE REAL PAGE. `CreateEventPage` is imported whole — its
 * roster, its wedding guard, its samahan and alaga reads, its error copy and
 * its `EventTypePicker` — so there is exactly one create-event step and the
 * panel can never drift from it. Only the frame differs.
 */
export default function InterceptedCreateEvent(
  props: Parameters<typeof CreateEventPage>[0],
) {
  return (
    <CreateEventPanel>
      <CreateEventPage {...props} />
    </CreateEventPanel>
  );
}

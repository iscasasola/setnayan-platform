import { HubSavedMark } from '@/app/_components/offline-ready/hub-saved-mark';
import { guestHubBase } from '@/lib/offline-copy-addresses';

import { loadEventShell } from '../_lib/loaders';
import { roomCopyViewer } from '../_lib/room-copy-viewer.server';

/**
 * 📶 R18 — A ROOM OF THE EVENT HUB WEARS THE HUB'S SAVED MARK (seat and table, E-Gifts, the guest list): the same
 * `HubSavedMark` the hub's own pages draw, for the room's OWN viewer (`roomCopyViewer` — the hub's one rule), at the
 * top of the room. It saves the guest's whole hub from here too, so a guest who arrives on a room first (a table QR,
 * a shared E-Gifts link) still leaves with every page they can open. Nobody's room (a stranger, a host) draws nothing.
 * The event's dates come from the one cached event read the rooms already share (`loadEventShell`), so a long event's
 * copy is kept to the day after its LAST day, exactly as the hub keeps it. A read that fails draws nothing.
 */
export async function RoomSavedMark({ slug }: { slug: string }) {
  const base = guestHubBase(slug);
  if (!base) return null;
  let event: Awaited<ReturnType<typeof loadEventShell>> | null = null;
  try {
    event = await loadEventShell(slug);
  } catch {
    return null;
  }
  if (!event?.event_id) return null;
  const viewer = await roomCopyViewer(event.event_id);
  if (!viewer) return null;
  return (
    <HubSavedMark
      viewer={viewer}
      base={base}
      eventDate={event.event_date ?? null}
      eventEndDate={(event as { event_end_date?: string | null }).event_end_date ?? null}
    />
  );
}

import 'server-only';
import { headers } from 'next/headers';
import { DOOR_HEADER, parseDoor, type Door } from './doors';

/**
 * The business door this request came through, or `null` — the ONE flag (lib/doors.ts). Middleware sets
 * `DOOR_HEADER` on a door host (supplier.setnayan.com, coordinator.setnayan.com) and, on any host, for an app shell
 * that asks for a door; it always overwrites the header, so a browser cannot hand in its own.
 */
export async function requestDoor(): Promise<Door | null> {
  return parseDoor((await headers()).get(DOOR_HEADER));
}

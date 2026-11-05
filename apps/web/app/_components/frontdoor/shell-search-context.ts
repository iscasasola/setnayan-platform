/**
 * shell-search-context.ts — what a SIGNED-IN search needs beyond the words, read once for the two places that answer
 * it: Discover (`/?q=`, in place — owner 2026-10-24) and `/dashboard/search` (the palette's step-out, and the store
 * app, where Discover is not a tab). Moved here from the search page so both read it the same way.
 *
 *   · people   — your people whose name matches, then people on Setnayan (`searchShellPeople`);
 *   · findSuppliers — the in-shell door to find a NEW supplier: the Suppliers page of the ONE event you host, never
 *                in the store app (it shows no marketplace). Several events: no guess;
 *   · addOwnEvent  — the same one event, which is where a supplier added from an empty search is filed.
 */
import 'server-only';
import { resolveRailStudioEvent } from './rail-data';
import type { HomeCommandItem } from './command-item';
import { isStoreShellRequest } from '@/lib/request-platform';
import { searchShellPeople } from '@/lib/shell-people-search';
import type { ShellPeopleResults } from '@/lib/shell-people-results';

export type ShellSearchContext = {
  people: ShellPeopleResults | null;
  findSuppliers: { href: string; eventName: string } | null;
  addOwnEvent: { eventId: string; eventName: string } | null;
};

export async function resolveShellSearchContext(
  query: string,
  userId: string,
  commandItems: readonly HomeCommandItem[],
): Promise<ShellSearchContext> {
  const [studioEvent, storeShell, people] = await Promise.all([
    resolveRailStudioEvent(),
    isStoreShellRequest(),
    searchShellPeople(query, userId),
  ]);
  const hosted = studioEvent.eventId ? commandItems.find((i) => i.id === `event-${studioEvent.eventId}`) : undefined;
  const event = !storeShell && studioEvent.eventId && hosted ? { eventId: studioEvent.eventId, eventName: hosted.label } : null;
  return {
    people,
    findSuppliers: event ? { href: `/dashboard/${event.eventId}/vendors`, eventName: event.eventName } : null,
    addOwnEvent: event,
  };
}

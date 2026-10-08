import type { ReactNode } from 'react';

/**
 * Handed — A SLOT A PAGE HANDS A SCREEN AS A PROP (an element made on the server: `setup`, `empty`, the card's `more` ⋯).
 *
 * Placed straight among a component's other children it is one member of an array, and React 19's dev build asks it for a
 * `key` ("Each child in a list should have a unique key … It was passed a child from GuestsLabPage / GuestCardBody", seen on the
 * lab 2026-10-09 for the Guests screen's slots and again for the Invite cell's ⋯). The real pages hand the same kind of child, so
 * the fix is at the seam, not in the lab: held as the ONE child of a fragment it is not in a list and nothing is asked of it.
 * Draws nothing of its own; no hook, no client code — usable from a server or a client file.
 */
export function Handed({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

'use client';

import { useEffect, useRef } from 'react';
import { adoptSeatSessionAction } from '../actions';

/**
 * AdoptSeatSession — renders nothing. Mounted only for a SIGNED-IN guest the
 * page recognised by their account's seat (no guest pass in this browser for
 * this event). On mount it asks the server to write that pass, so the event's
 * sub-pages (seat, camera, find-my-table) — which still read the cookie — know
 * them as well as this page already does.
 *
 * 🔒 ON MOUNT, NEVER ON RENDER OR BEHIND A LINK. A render cannot write cookies,
 * and a GET behind a `<Link>` was once run by a prefetch as a card scrolled past
 * (lib/guest-membership-session.ts). A prefetch never mounts a component, so
 * only a person actually opening their invitation reaches this. Once per mount.
 */
export function AdoptSeatSession({ eventId }: { eventId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void adoptSeatSessionAction(eventId).catch(() => {
      // Best-effort: the page itself already shows their own invitation.
    });
  }, [eventId]);
  return null;
}

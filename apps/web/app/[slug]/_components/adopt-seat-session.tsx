'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
export function AdoptSeatSession({
  eventId,
  thenRefresh = false,
}: {
  eventId: string;
  /**
   * 🔑 A4-B11 (owner, final check Add 34): the camera door mounts this for a signed-in seat holder with no pass. Once the
   * pass is written the page reloads into the camera; when it could not be written, it says so in place.
   */
  thenRefresh?: boolean;
}) {
  const done = useRef(false);
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    adoptSeatSessionAction(eventId)
      .then((held) => {
        if (!thenRefresh) return;
        // one-render: keep (no-revalidate) — adoptSeatSessionAction only writes the guest-pass cookie and revalidates
        // nothing, so this refresh is the one render that lets the camera door read the new pass.
        if (held) router.refresh();
        else setFailed(true);
      })
      .catch(() => {
        // Best-effort on the event page (it already shows their own invitation); the camera door says it failed.
        if (thenRefresh) setFailed(true);
      });
  }, [eventId, router, thenRefresh]);
  if (!failed) return null;
  return (
    <p role="alert" className="text-sm text-ink/70">
      We couldn’t open your camera just now. Open your invitation, then try the camera again.
    </p>
  );
}

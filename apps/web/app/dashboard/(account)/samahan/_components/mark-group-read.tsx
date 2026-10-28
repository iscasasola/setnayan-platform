'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * mark-group-read.tsx — 🔴 OPENING A GROUP MARKS IT READ (owner 2026-10-28, DECISION_LOG "APPROVED — RSVP ANSWERS ON
 * THE GUEST LIST + GROUP UNREAD": *"opening a group marks it read (one small write, never a live connection)"*).
 *
 * Mounted by the group route's layout (`[communityId]/layout.tsx`), so it runs only when the group is really OPEN on
 * screen — never on a link prefetch (a prefetch renders, it does not mount an effect). It calls
 * `mark_samahan_read(community_id)` once on open and once on leaving (what arrived while you were inside is read too).
 * One RPC each time; the marker is the server's NOW. A failure is logged and changes nothing — the group simply stays
 * unread, which is the honest state. 🔒 people/the-people-pinned-row.test.ts · tests/db/samahan-unread-is-yours.db.test.ts
 */
export function MarkGroupRead({ communityId }: { communityId: string }) {
  useEffect(() => {
    const mark = () => {
      void createClient()
        .rpc('mark_samahan_read', { p_community_id: communityId })
        .then(({ error }) => {
          if (error) console.error('[supabase-error] mark_samahan_read', error);
        });
    };
    mark();
    return mark;
  }, [communityId]);
  return null;
}

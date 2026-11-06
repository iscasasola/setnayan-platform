/**
 * event-team-presence-join.ts — THE CHANNEL behind `event-team-presence.tsx` (Home › Who's here, owner 2026-10-29),
 * loaded by `import()` after the event page has drawn, so it rides no page's first load.
 *
 *   · 🔒 PRIVATE (`private: true`) with the user's token on the socket — the migration's
 *     `event_team_presence_can_access` admits the event's hosts and accepted moderators only.
 *   · Presence only — no `postgres_changes`.
 *   · Let go while the tab is hidden (`pauseWhileHidden`), joined again on return.
 *   · A refused or dropped channel calls `onFailed` ("Couldn't check") — never an empty list.
 */
import type { Dispatch, SetStateAction } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pauseWhileHidden } from '@/lib/tab-return';
import { eventTeamTopic, nextTeamPeers, type TeamMeta, type TeamPeer } from '@/lib/whos-here';
import type { EventTeamPresenceState } from './event-team-presence';

/**
 * Joins the event's team channel and keeps the provider's state: the others now (`null` until the first answer), `live`
 * or `failed`, and a `pulse` bumped when someone arrives or leaves. Returns the stop.
 */
export function joinTeamPresence(
  eventId: string,
  me: { id: string } & TeamMeta,
  setValue: Dispatch<SetStateAction<EventTeamPresenceState>>,
): () => void {
  const supabase = createClient();
  // Kept across a hidden-tab rejoin, so an unchanged list is the SAME list (no render for nothing).
  let peers: readonly TeamPeer[] = [];
  return pauseWhileHidden(() => {
    let live = true;
    let first = true;
    const channel = supabase.channel(eventTeamTopic(eventId), {
      config: { private: true, presence: { key: me.id } },
    });
    channel.on('presence', { event: 'sync' }, () => {
      if (!live) return;
      // Decided OUTSIDE the state updater (an updater may run twice): the same list back = no render, unless this is
      // the first answer since (re)joining, which turns "Checking…" into the list.
      const next = nextTeamPeers(peers, channel.presenceState<TeamMeta>(), me.id);
      const changed = next !== peers;
      peers = next;
      const wasFirst = first;
      first = false;
      setValue((v) =>
        !changed && !wasFirst && v.state === 'live' && v.peers !== null
          ? v
          : { peers: next, state: 'live', pulse: changed ? v.pulse + 1 : v.pulse },
      );
    });
    // The socket must carry the user's token, or the private channel's predicate sees no one
    // (`lib/panood-webrtc.ts` primeRealtimeAuth — measured 2026-09-01).
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session?.access_token) supabase.realtime.setAuth(data.session.access_token);
      })
      .catch(() => {})
      .finally(() => {
        if (!live) return;
        channel.subscribe((status) => {
          if (!live) return;
          if (status === 'SUBSCRIBED') {
            void channel.track({ name: me.name, role: me.role, photo: me.photo } satisfies TeamMeta);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setValue((v) => ({ ...v, state: 'failed' }));
          }
        });
      });
    return () => {
      live = false;
      return supabase.removeChannel(channel);
    };
  });
}

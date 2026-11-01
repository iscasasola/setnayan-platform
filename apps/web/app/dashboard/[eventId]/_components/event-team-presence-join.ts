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
import { createClient } from '@/lib/supabase/client';
import { pauseWhileHidden } from '@/lib/tab-return';
import { eventTeamTopic, nextTeamPeers, type TeamMeta, type TeamPeer } from '@/lib/whos-here';

export function joinTeamPresence({
  eventId,
  me,
  onPeers,
  onFailed,
  peers,
}: {
  eventId: string;
  me: { id: string } & TeamMeta;
  /** The others now; `first` = the channel's first answer since (re)joining. */
  onPeers: (next: readonly TeamPeer[], first: boolean) => void;
  onFailed: () => void;
  /** The list the provider holds now — `nextTeamPeers` hands it back unchanged when nothing moved. */
  peers: () => readonly TeamPeer[];
}): () => void {
  const supabase = createClient();
  return pauseWhileHidden(() => {
    let live = true;
    let first = true;
    const channel = supabase.channel(eventTeamTopic(eventId), {
      config: { private: true, presence: { key: me.id } },
    });
    channel.on('presence', { event: 'sync' }, () => {
      if (!live) return;
      onPeers(nextTeamPeers(peers(), channel.presenceState<TeamMeta>(), me.id), first);
      first = false;
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
            onFailed();
          }
        });
      });
    return () => {
      live = false;
      return supabase.removeChannel(channel);
    };
  });
}

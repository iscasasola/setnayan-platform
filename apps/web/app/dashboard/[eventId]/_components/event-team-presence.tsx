'use client';

/**
 * event-team-presence.tsx — WHO OF THE TEAM HAS THIS EVENT'S DASHBOARD OPEN (Who's here, owner 2026-10-29: *"so when
 * 2 cohost/helper or coordinator is on the dashboard"*).
 *
 * ONE presence channel per event, joined ONCE by the event layout (`app/dashboard/[eventId]/layout.tsx`) — the layout
 * stays mounted while the person moves between the event's pages, so the channel does too; no page joins its own.
 * Whatever wants the list (the Home card) reads it from this context.
 *
 *   · 🔒 PRIVATE (`private: true`) with the user's token on the socket — the migration's
 *     `event_team_presence_can_access` admits the event's hosts and accepted moderators only. Both halves ship
 *     together; the flag without the policy refuses everyone, the policy without the flag guards nothing.
 *   · Presence only — no `postgres_changes`, so the database evaluates nothing per write (the WAL cost that made
 *     Realtime the heaviest thing on the day, 2026-10-18 audit). Each member publishes a first name, a role word and
 *     their account photo — nothing about the event or its guests.
 *   · "Here now" means LOOKING: a tab hidden for two minutes leaves (`pauseWhileHidden`), and coming back joins again.
 *     When the last channel in a tab goes, realtime-js closes the socket, so a forgotten tab holds nothing.
 *   · Honest: until the channel answers the list is `null` ("Checking…"), and a refused or dropped channel is
 *     `failed` ("Couldn't check") — never an empty list read as "just you".
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pauseWhileHidden } from '@/lib/tab-return';
import { eventTeamTopic, nextTeamPeers, type TeamMeta, type TeamPeer } from '@/lib/whos-here';

export type EventTeamPresenceState = {
  /** The others on the dashboard now; `null` until the channel has answered. */
  peers: readonly TeamPeer[] | null;
  state: 'joining' | 'live' | 'failed';
  /** Bumped whenever someone arrives or leaves — a cue for the Home card to re-read the hub's viewers. */
  pulse: number;
};

const Ctx = createContext<EventTeamPresenceState | null>(null);

/** The team on the dashboard now — `null` outside an event layout (a lab, a test render). */
export function useEventTeamPresence(): EventTeamPresenceState | null {
  return useContext(Ctx);
}

/** A tab hidden this long leaves the list ("here now" is somebody looking). */
const TEAM_HIDDEN_MS = 120_000;

export function EventTeamPresence({
  eventId,
  me,
  children,
}: {
  eventId: string;
  me: { id: string } & TeamMeta;
  children: ReactNode;
}) {
  const [value, setValue] = useState<EventTeamPresenceState>({ peers: null, state: 'joining', pulse: 0 });
  const peersRef = useRef<readonly TeamPeer[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const stop = pauseWhileHidden(
      () => {
        let live = true;
        const channel = supabase.channel(eventTeamTopic(eventId), {
          config: { private: true, presence: { key: me.id } },
        });
        channel.on('presence', { event: 'sync' }, () => {
          if (!live) return;
          // Decided OUTSIDE the state updater (an updater may run twice): the same list back = no render, unless this
          // is the first answer, which turns "Checking…" into the list.
          const next = nextTeamPeers(peersRef.current, channel.presenceState<TeamMeta>(), me.id);
          const changed = next !== peersRef.current;
          peersRef.current = next;
          setValue((v) =>
            !changed && v.state === 'live' && v.peers !== null
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
      },
      { hiddenMs: TEAM_HIDDEN_MS },
    );
    return stop;
  }, [eventId, me.id, me.name, me.role, me.photo]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

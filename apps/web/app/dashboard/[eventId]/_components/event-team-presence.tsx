'use client';

/**
 * event-team-presence.tsx — WHO OF THE TEAM HAS THIS EVENT'S DASHBOARD OPEN (Who's here, owner 2026-10-29: *"so when
 * 2 cohost/helper or coordinator is on the dashboard"*).
 *
 * ONE presence channel per event, joined ONCE by the event layout (`app/dashboard/[eventId]/layout.tsx`) — the layout
 * stays mounted while the person moves between the event's pages, so the channel does too; no page joins its own.
 * Whatever wants the list (the Home card) reads it from this context.
 *
 *   · The channel itself is `event-team-presence-join.ts`, loaded by `import()` once the page has drawn — this file is
 *     only the context, so it costs every event page's first load next to nothing.
 *   · 🔒 PRIVATE (`private: true`) with the user's token on the socket — the migration's
 *     `event_team_presence_can_access` admits the event's hosts and accepted moderators only. Both halves ship
 *     together; the flag without the policy refuses everyone, the policy without the flag guards nothing.
 *   · Presence only — no `postgres_changes`, so the database evaluates nothing per write (the WAL cost that made
 *     Realtime the heaviest thing on the day, 2026-10-18 audit). Each member publishes a first name, a role word and
 *     their account photo — nothing about the event or its guests.
 *   · "Here now" means LOOKING: a tab hidden for half a minute leaves (`pauseWhileHidden`, the house default), and
 *     coming back joins again.
 *     When the last channel in a tab goes, realtime-js closes the socket, so a forgotten tab holds nothing.
 *   · Honest: until the channel answers the list is `null` ("Checking…"), and a refused or dropped channel is
 *     `failed` ("Couldn't check") — never an empty list read as "just you".
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { TeamMeta, TeamPeer } from '@/lib/whos-here';

export type EventTeamPresenceState = {
  /** The others on the dashboard now; `null` until the channel has answered. */
  peers: readonly TeamPeer[] | null;
  state: 'joining' | 'live' | 'failed' | 'off';
  /** Bumped whenever someone arrives or leaves — a cue for the Home card to re-read the hub's viewers. */
  pulse: number;
};

const Ctx = createContext<EventTeamPresenceState | null>(null);

/** The team on the dashboard now — `null` outside an event layout (a lab, a test render). */
export function useEventTeamPresence(): EventTeamPresenceState | null {
  return useContext(Ctx);
}

export function EventTeamPresence({
  eventId,
  me,
  enabled,
  children,
}: {
  eventId: string;
  me: { id: string } & TeamMeta;
  /** `teamPresenceEnabled()` — the layout's gate (`TEAM_PRESENCE_DISABLED=1` joins nothing). */
  enabled: boolean;
  children: ReactNode;
}) {
  const [value, setValue] = useState<EventTeamPresenceState>({ peers: null, state: enabled ? 'joining' : 'off', pulse: 0 });

  useEffect(() => {
    if (!enabled) return;
    // ⚡ The channel's code loads AFTER the page has drawn (`event-team-presence-join.ts`), never in the first load of
    // every event page — the Maker's first-load budget (`scripts/check-maker-js-budget.mjs`) holds that. This file is
    // the context and nothing else.
    let gone = false;
    let stop: (() => void) | undefined;
    import('./event-team-presence-join').then(
      (m) => {
        if (!gone) stop = m.joinTeamPresence(eventId, me, setValue);
      },
      // The chunk itself did not load (offline, a deploy in between) → "Couldn't check", never "just you".
      () => {
        if (!gone) setValue((v) => ({ ...v, state: 'failed' }));
      },
    );
    return () => {
      gone = true;
      stop?.();
    };
    // `me` is read through its parts below — a new object with the same person must not rejoin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, eventId, me.id, me.name, me.role, me.photo]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** DEV-ONLY stand-in for the channel (`/dev/home-lab?whos=…` — production 404s the labs): a fixed team list. */
export function EventTeamPresenceLab({ value, children }: { value: EventTeamPresenceState; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

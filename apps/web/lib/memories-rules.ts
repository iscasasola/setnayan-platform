/**
 * apps/web/lib/memories-rules.ts — THE MEMORIES RULES: who sees what, and who may change it.
 *
 * Owner 2026-10-30 (DECISION_LOG "MEMORIES ⚙ HOLDS THE MEMORIES RULES — HOSTS + COORDINATORS MANAGE THEM; DEFAULT
 * "ONLY TAGGED""), closing the two OPEN points of the same day's "PAPIC ON = A CAMERA TAB ON EVERY STAGE" row:
 *
 *   WHO SEES WHAT  = Share all memories · Only tagged — DEFAULT ONLY TAGGED. Each guest sees the photos they are in
 *                    (and, by the 2026-08-02 rule, the shots they took themselves); hosts always see all.
 *   WHO MANAGES    = the event's hosts (the couple + every co-host) and anyone with the coordinator role on the event
 *                    (a booked coordinator supplier or one added by hand). Not guests, not other suppliers, not helpers.
 *
 * 🔑 NOT A NEW SETTING — THE SHIPPED SWITCH, NAMED BY THE RULING. "Share all memories" IS `events.pool_gallery_open`
 * (migration 20270917300000, `BOOLEAN NOT NULL DEFAULT FALSE`): the couple's "Shared gallery" that every guest read
 * already honours (`guest_pool_gallery` re-checks it on every read; the Event Hub draws "Everyone's photos" only
 * while it is TRUE). FALSE is "Only tagged" — so the column's default already IS the ruling's default, and no live
 * event changes what its guests see. A second column for the same fact would be two sources of truth (RULE 0 · 8).
 *
 * 🔑 WHO MANAGES — composed from the two facts the event layout already reads, never re-derived:
 *   · `event_members.member_type = 'couple'` — the creator AND every full co-host (a co-host seat is a `couple`
 *     member, `seat_is_full_cohost` / `lib/guest-access.ts`), and a coordinator the hosts gave FULL access (who sits
 *     on a co-host seat);
 *   · a live coordinator seat — `event_moderators.role_subtype = COORDINATOR_SEAT_ROLE` ('wedding_planner_external',
 *     the seat both the booked-coordinator grant `lib/coordinator-grant.ts` and the hand invite `hosts/actions.ts`
 *     create), accepted and not removed — the same seat the event layout calls `coordinatorSeat` — and only inside
 *     the delegate window every coordinator reader applies (`lib/delegate-access-window.ts`).
 * A limited helper is a `coordinator` MEMBER but a `viewer` SEAT, so neither fact admits them; the actions also ask
 * `limitedHelperRefusal(eventId, null)` first (null = no area: never a helper's to change), for the helper's own words.
 *
 * Pure — the reads are `memories-rules.server.ts` — so `memories-rules.test.ts` executes every row of the table.
 */

/** The two answers to "who sees what", in the order the dropdown lists them (the default first). */
export type MemoriesWhoSees = 'tagged' | 'all';

/** 🔒 THE RULING'S DEFAULT. Mirrors `events.pool_gallery_open DEFAULT FALSE` — held by `memories-rules.test.ts`. */
export const DEFAULT_MEMORIES_WHO_SEES: MemoriesWhoSees = 'tagged';

/** The stored switch → the choice. Anything but an explicit TRUE (null, absent, unread) is the default, Only tagged. */
export function whoSeesOf(poolGalleryOpen: boolean | null | undefined): MemoriesWhoSees {
  return poolGalleryOpen === true ? 'all' : DEFAULT_MEMORIES_WHO_SEES;
}

/** The choice → the stored switch. Only "Share all memories" opens it. */
export function poolGalleryOpenFor(choice: MemoriesWhoSees): boolean {
  return choice === 'all';
}

export function isMemoriesWhoSees(v: unknown): v is MemoriesWhoSees {
  return v === 'tagged' || v === 'all';
}

/** The dropdown's words — the owner's own two names (2026-10-30). */
export const WHO_SEES_OPTIONS: ReadonlyArray<{ key: MemoriesWhoSees; label: string }> = [
  { key: 'tagged', label: 'Only tagged' },
  { key: 'all', label: 'Share all memories' },
];

/** The one short line under the title (details live in the ⓘ — house rule). */
export const WHO_SEES_LINE: Readonly<Record<MemoriesWhoSees, string>> = {
  tagged: 'Each guest sees the photos they are in',
  all: 'Every guest sees every photo',
};

/** What a person who may not change the rules is told, in place. */
export const MEMORIES_RULES_FORBIDDEN = 'Only the hosts and the coordinator can change who sees your Memories.';

/** The facts the server reads about the caller on ONE event. */
export type MemoriesManagerFacts = {
  /** `event_members.member_type` for this user on this event, or null (no row). */
  memberType: string | null;
  /** A live coordinator seat (`COORDINATOR_SEAT_ROLE`, accepted, not removed) on this event. */
  coordinatorSeat: boolean;
  /**
   * The coordinator's window has closed (`delegateAccessHasExpired`: the event day + 7 days, owner 2026-09-14,
   * "coordinators will only have access until event day … grace period until 7 days after event"). The hosts' never does.
   */
  coordinatorWindowClosed: boolean;
};

export type MemoriesManagerRole = 'host' | 'coordinator';

/**
 * Who this caller is to the Memories rules: 'host' (the couple + every co-host), 'coordinator', or null (a guest,
 * another supplier, a limited helper, a stranger). Host wins when both are true (a full-access coordinator).
 */
export function memoriesManagerRoleOf(f: MemoriesManagerFacts): MemoriesManagerRole | null {
  if (f.memberType === 'couple') return 'host';
  if (f.coordinatorSeat && !f.coordinatorWindowClosed) return 'coordinator';
  return null;
}

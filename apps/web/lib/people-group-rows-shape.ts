/**
 * people-group-rows-shape.ts — WHAT A GROUP ROW ON PEOPLE READS, as plain data (owner 2026-10-28, DECISION_LOG
 * "USER DASHBOARD PART 1 — PEOPLE & GROUPS — APPROVED": *"Group rows read like chats"*; prototype
 * `prototypes/user_dash_2026-10-28/` frames B–D).
 *
 * A row is: the group's initials in a STORY RING while it has live stories (the shipped `samahan_stories`, 24 h) ·
 * its name · the LAST MESSAGE line (the shipped `samahan_messages`, "Mika: …") and its time · a NEXT-EVENT chip (the
 * group's own `events.community_id`). Tap → the group's chatroom.
 *
 * 🔴 UNREAD (owner 2026-10-28, "APPROVED — … GROUP UNREAD"): `samahan_reads` is the per-member read marker (migration
 * 20271293905043); `samahan_unread_counts()` counts other members' live messages newer than it, for every group in one
 * call. An unread row draws its last line bold and a count badge. A refused count is `null` — never a 0 — and the
 * pinned row says "Couldn't load". (NOT the `samahan_message` notices: collapsed hourly, cleared only by "Mark read".)
 *
 * Neutral module (no `server-only`): the reader (`people-group-rows.ts`), the rows and `/dev/people-lab` share it,
 * and a unit test executes it.
 */

export type GroupChatRow = {
  communityId: string;
  name: string;
  role: 'organizer' | 'member';
  /** null = not counted — never printed as "0 members". */
  memberCount: number | null;
  /** Live stories (posted in the last 24 h). 0 = no ring. */
  stories: number;
  /** The newest message. null = the group has none (said only when the read came back). */
  last: { who: string; body: string; when: string } | null;
  /** The group's next event — "15 Nov · Liga ng Barangay". */
  nextEvent: { label: string } | null;
  /** Messages from others since you last opened the group. null = the count was refused (never drawn as 0). */
  unread: number | null;
};

/** The one read's rows, as PostgREST returns the embedded resources. */
export type GroupActivityRow = {
  community_id: string;
  samahan_messages: Array<{ user_id: string; body: string; created_at: string }> | null;
  samahan_stories: Array<{ story_id: string }> | null;
  events: Array<{ event_id: string; display_name: string; event_date: string | null; archived: boolean }> | null;
};

/** The list of a person's groups, as the shipped `fetchUserCommunities` returns them. */
export type GroupBase = {
  community_id: string;
  name: string;
  role: 'organizer' | 'member';
  member_count: number;
  archived: boolean;
};

/** The badge's words — 99+ past ninety-nine. */
export function unreadBadge(n: number): string {
  return n > 99 ? '99+' : String(n);
}

/** "2m", "1h", "3d", then "15 Nov" — the notice row's own clock (`relativeTimeShort`, lib/notifications.ts), no " ago". */
export function chatWhen(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  if (ms < 7 * 86_400_000) return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Manila' });
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
}

/** An event's date (a calendar date, no clock) as "15 Nov" (day first, the drawing's order) — read in UTC so the day never shifts. */
export function eventDay(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Today in Manila, as the `YYYY-MM-DD` an event date compares against. */
export function manilaToday(now: Date): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** "Mika Santos" → "Mika". The viewer is "You". An unnamed member is "Member". */
export function speaker(userId: string, viewerId: string, names: ReadonlyMap<string, string>): string {
  if (userId === viewerId) return 'You';
  const full = (names.get(userId) ?? '').trim();
  return full ? full.split(/\s+/)[0]! : 'Member';
}

/**
 * The rows, in the person's group order. `activity` null = the one read was REFUSED: every row keeps its shipped
 * line (role · members) and none says "No messages yet" — a refusal is never drawn as a quiet group.
 */
export function shapeGroupRows(
  groups: readonly GroupBase[],
  activity: readonly GroupActivityRow[] | null,
  names: ReadonlyMap<string, string>,
  viewerId: string,
  now: Date,
  /** `samahan_unread_counts()` by group; null = the count was refused. */
  unread: ReadonlyMap<string, number> | null = null,
): GroupChatRow[] {
  const byId = new Map((activity ?? []).map((a) => [a.community_id, a] as const));
  const today = manilaToday(now);
  return groups
    .filter((g) => !g.archived)
    .map((g) => {
      const a = byId.get(g.community_id);
      const msg = a?.samahan_messages?.[0] ?? null;
      const next = (a?.events ?? [])
        .filter((e) => !e.archived && e.event_date && e.event_date.slice(0, 10) >= today)
        .sort((x, y) => (x.event_date! < y.event_date! ? -1 : 1))[0];
      return {
        communityId: g.community_id,
        name: g.name,
        role: g.role,
        // The list loader counts with a second read; a refused count leaves 0, which is never true for a group you
        // are in — so a 0 is "not counted", not a number.
        memberCount: g.member_count > 0 ? g.member_count : null,
        stories: a?.samahan_stories?.length ?? 0,
        last: msg ? { who: speaker(msg.user_id, viewerId, names), body: msg.body.replace(/\s+/g, ' ').trim(), when: chatWhen(msg.created_at, now) } : null,
        nextEvent: next ? { label: `${eventDay(next.event_date!)} · ${next.display_name}` } : null,
        unread: unread ? (unread.get(g.community_id) ?? 0) : null,
      };
    });
}

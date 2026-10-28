/**
 * lib/whos-here.ts — WHO'S HERE: the event team on the dashboard now, and the guests looking at the Event Hub
 * (owner 2026-10-29: *"on event>home page. can we add a list of who is viewing our event hub or inside the event
 * dashboard now?"* → *"so when 2 cohost/helper or coordinator is on the dashboard and which guest is viewing the
 * event hub?"*).
 *
 * Pure (no React, no Supabase, no `server-only`) — the route, the beacon, the presence provider, the Home card and
 * the node guards all read their numbers and words from here, so no two of them can disagree.
 *
 *   TEAM      Realtime presence on the PRIVATE channel `event-team:{eventId}`, joined ONCE by the event layout
 *             (`app/dashboard/[eventId]/_components/event-team-presence.tsx`). Nothing stored.
 *   GUESTS    One beacon per guest open, AFTER the hub has drawn (`app/[slug]/_components/hub-seen-beacon.tsx` →
 *             `app/api/hub/seen/route.ts` → `record_hub_view`), at most once per guest per 30 minutes — in the browser
 *             AND in the database. A guest is NAMED only through their own pass; everyone else is a count.
 *
 * Held by `lib/whos-here.test.ts` and `tests/db/who-is-viewing-the-hub.db.test.ts`.
 */
import { envFlagEnabled } from './env-flag';

/** A guest's open is written at most once per this many minutes (the browser AND `record_hub_view` both hold it). */
export const HUB_SEEN_DEBOUNCE_MIN = 30;

/**
 * 🔑 THE CARD'S WINDOW IS THE DEBOUNCE, NEVER LESS. A guest who keeps the hub open — or opens it again 10 minutes
 * later — is written ONCE per 30 minutes. A 15-minute window would drop them off the card for half of every half hour
 * while they were still looking: a list that lies. So the card shows "the last 30 minutes" (the guard pins
 * window ≥ debounce, and the database function's default is this number).
 */
export const WHOS_HERE_WINDOW_MIN = HUB_SEEN_DEBOUNCE_MIN;

/** The browser's own memory of "I already told the server this half hour" — per event, per device. Not a cookie. */
export const HUB_SEEN_STORAGE_PREFIX = 'sn_hub_seen:';

/** The beacon's address. The middleware leaves the hub's cache key alone for it (`HUB_BUST_EXEMPT_PATHS`). */
export const HUB_SEEN_PATH = '/api/hub/seen';

/** The private presence topic for an event's team. The migration's predicate parses exactly this prefix. */
export function eventTeamTopic(eventId: string): string {
  return `event-team:${eventId}`;
}

/**
 * 🛑 THE KILL SWITCH — `HUB_VIEWS_DISABLED=1` in Vercel (then redeploy) stops the guest beacon at both ends: the hub
 * draws no beacon and the route writes nothing. Default ON: the load is ONE write per guest per 30 minutes (see the
 * PR's load estimate — 500 guests opening in 2 minutes is ≤ 500 writes, ~4/s, and their refreshes are free).
 * The same shape as the hub cache's own switch (`HUB_CACHE_DISABLED`).
 */
export function hubViewsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !envFlagEnabled(env.HUB_VIEWS_DISABLED);
}

/** Should this browser tell the server about this open? `last` = what storage remembers (ms), or null. */
export function hubSeenDue(last: number | null, now: number): boolean {
  if (last === null || !Number.isFinite(last)) return true;
  if (last > now) return true; // a clock that moved backwards must not silence the beacon forever
  return now - last >= HUB_SEEN_DEBOUNCE_MIN * 60_000;
}

/* ─── The team ─────────────────────────────────────────────────────────────── */

export type TeamRole = 'Host' | 'Co-host' | 'Helper' | 'Coordinator';

/** The seat kinds that are a full co-host (`lib/guest-access.ts` FULL_COHOST_KINDS — asked, never restated). */
export type TeamRoleInput =
  | { kind: 'couple' }
  | { kind: 'seat'; coordinator: boolean; fullCohost: boolean };

/** Host (a couple member) · Coordinator (the planner's seat) · Co-host (a full co-host seat) · Helper (any other seat). */
export function teamRoleWord(input: TeamRoleInput): TeamRole {
  if (input.kind === 'couple') return 'Host';
  if (input.coordinator) return 'Coordinator';
  if (input.fullCohost) return 'Co-host';
  return 'Helper';
}

/** What each team member publishes on the presence channel — a first name, a role word and their account photo. */
export type TeamMeta = { name: string; role: TeamRole; photo: string | null };

export type TeamPeer = TeamMeta & { id: string };

const ROLES: ReadonlySet<string> = new Set(['Host', 'Co-host', 'Helper', 'Coordinator']);

/** A first name for a face: the first word of a display name; "Someone" when there is none. */
export function firstName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return first.slice(0, 40) || 'Someone';
}

/**
 * The OTHERS on the dashboard, from a presence `sync` — everyone in `state` but `meId` (the card says "You" once,
 * never as a face). Returns `prev` ITSELF when nothing about the others changed, so React skips the render (the
 * seat plan's lesson, `seating-presence-peers.ts`). Sorted by role then name, so the faces do not shuffle.
 */
export function nextTeamPeers(
  prev: readonly TeamPeer[],
  state: Record<string, ReadonlyArray<Partial<TeamMeta>> | undefined>,
  meId: string,
): readonly TeamPeer[] {
  const next: TeamPeer[] = [];
  for (const [id, metas] of Object.entries(state)) {
    if (id === meId) continue;
    const meta = metas?.[0];
    if (!meta) continue;
    next.push({
      id,
      name: firstName(meta.name),
      role: ROLES.has(meta.role ?? '') ? (meta.role as TeamRole) : 'Helper',
      photo: typeof meta.photo === 'string' && /^https?:\/\//.test(meta.photo) ? meta.photo : null,
    });
  }
  const order: Record<TeamRole, number> = { Host: 0, 'Co-host': 1, Coordinator: 2, Helper: 3 };
  next.sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (next.length === prev.length && next.every((p, i) => {
    const o = prev[i]!;
    return o.id === p.id && o.name === p.name && o.role === p.role && o.photo === p.photo;
  })) {
    return prev;
  }
  return next;
}

/** The team line under the card's title. `null` peers = the channel has not answered (never "nobody"). */
export function teamWords(peers: readonly TeamPeer[] | null, state: 'joining' | 'live' | 'failed'): string {
  if (state === 'failed') return 'Couldn’t check who else is here';
  if (state === 'joining' || peers === null) return 'Checking who else is here…';
  if (peers.length === 0) return 'Just you right now';
  return `${peers.length} other${peers.length === 1 ? '' : 's'} here now`;
}

/* ─── The guests ───────────────────────────────────────────────────────────── */

export type HubViewerGuest = {
  guest_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  photo_url: string | null;
  seen_at: string;
};

/** `event_hub_viewers` as the card reads it. */
export type HubViewers = {
  team: boolean;
  may_name: boolean;
  window_minutes: number;
  guest_total: number;
  visitors: number;
  guests: HubViewerGuest[];
};

/** The read, or `null` when it did not come back in the shape it promises — a failure, never "nobody". */
export function parseHubViewers(raw: unknown): HubViewers | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.team !== 'boolean' || typeof r.may_name !== 'boolean') return null;
  if (typeof r.guest_total !== 'number' || typeof r.visitors !== 'number' || typeof r.window_minutes !== 'number') return null;
  if (!Array.isArray(r.guests)) return null;
  const guests: HubViewerGuest[] = [];
  for (const g of r.guests) {
    if (!g || typeof g !== 'object') return null;
    const x = g as Record<string, unknown>;
    if (typeof x.guest_id !== 'string' || typeof x.seen_at !== 'string') return null;
    const s = (v: unknown) => (typeof v === 'string' ? v : null);
    guests.push({
      guest_id: x.guest_id,
      first_name: s(x.first_name),
      last_name: s(x.last_name),
      display_name: s(x.display_name),
      photo_url: s(x.photo_url),
      seen_at: x.seen_at,
    });
  }
  return {
    team: r.team,
    may_name: r.may_name,
    window_minutes: r.window_minutes,
    guest_total: r.guest_total,
    visitors: r.visitors,
    guests,
  };
}

/** A guest's face name: what the couple calls them (`display_name` — "Tito Ben"), else their first name. */
export function guestFaceName(g: Pick<HubViewerGuest, 'display_name' | 'first_name' | 'last_name'>): string {
  const shown = (g.display_name ?? '').trim();
  if (shown) return shown;
  const first = (g.first_name ?? '').trim();
  return first || 'Guest';
}

/** How many faces the card draws before "+N". */
export const WHOS_HERE_FACES = 5;

/** The guest line under the card's title. `null` = the read failed (never drawn as "nobody"). */
export function hubWords(v: HubViewers | null, enabled: boolean): string {
  if (!enabled) return 'Event Hub views are switched off';
  if (!v) return 'Couldn’t load who’s viewing';
  if (!v.team) return 'Only the event’s team sees who’s viewing';
  if (!v.may_name) {
    // The guests are not this viewer's to see — counted or named — so only the strangers are said, as "other".
    return v.visitors > 0
      ? `${v.visitors} other visitor${v.visitors === 1 ? '' : 's'} · last ${v.window_minutes} min`
      : `No other visitors in the last ${v.window_minutes} minutes`;
  }
  const parts: string[] = [];
  if (v.guest_total > 0) parts.push(`${v.guest_total} guest${v.guest_total === 1 ? '' : 's'}`);
  if (v.visitors > 0) parts.push(`${v.visitors} other visitor${v.visitors === 1 ? '' : 's'}`);
  if (parts.length === 0) return `No one opened it in the last ${v.window_minutes} minutes`;
  return `${parts.join(' · ')} · last ${v.window_minutes} min`;
}

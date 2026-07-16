import 'server-only';
import { cache } from 'react';
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isMissingRelationError,
  logQueryError,
} from '@/lib/supabase/error-detect';

// Samahan (Communities) — lib layer for the minimal cut (PR-2 of 4).
// Spec: Samahan_Minimal_Build_Plan_2026-07-15.md §3 (spec corpus). Schema:
// migration 20270808218211_samahan_communities_foundation.sql.
//
// Idioms copied from lib/events.ts: React cache() on the shared fetch,
// graceful-degrade to []/null via isMissingRelationError + logQueryError,
// typed rows, admin client ONLY where RLS is deliberately in the way
// (cross-user display names + public token redemption).

export type CommunityKind = 'barkada' | 'parish' | 'clan' | 'org' | 'other';
export type CommunityRole = 'organizer' | 'member';

export const COMMUNITY_KINDS: readonly CommunityKind[] = [
  'barkada',
  'parish',
  'clan',
  'org',
  'other',
] as const;

export const COMMUNITY_KIND_LABEL: Readonly<Record<CommunityKind, string>> = {
  barkada: 'Barkada',
  parish: 'Parish',
  clan: 'Clan',
  org: 'Org',
  other: 'Other',
};

export function isCommunityKind(value: unknown): value is CommunityKind {
  return (
    typeof value === 'string' &&
    (COMMUNITY_KINDS as readonly string[]).includes(value)
  );
}

export type CommunityRow = {
  community_id: string;
  public_id: string;
  name: string;
  kind: CommunityKind;
  description: string | null;
  archived: boolean;
  created_at: string;
};

export type CommunityWithRole = CommunityRow & {
  role: CommunityRole;
  member_count: number;
};

/**
 * Roster entry — display-safe fields ONLY (RA 10173 guardrail, plan §9).
 * `member_row_id` (the bigserial id) is the action target so organizer forms
 * never carry another user's auth UUID or email into the DOM.
 */
export type CommunityRosterEntry = {
  member_row_id: number;
  display_name: string;
  role: CommunityRole;
  joined_at: string;
  is_self: boolean;
};

export type CommunityEventRow = {
  event_id: string;
  display_name: string;
  event_type: string;
  event_date: string | null;
  archived: boolean;
};

type MembershipJoinRow = {
  role: CommunityRole;
  communities: CommunityRow | CommunityRow[] | null;
};

/**
 * Every (non-archived) community the signed-in user belongs to, with their
 * role and the member count. RLS scopes both reads to the caller's own
 * communities; `.eq('user_id', userId)` is defense-in-depth narrowing.
 * Wrapped in React cache() so the index page and any future layout consumer
 * share one round-trip per request (fetchUserEvents precedent).
 */
export const fetchUserCommunities = cache(
  async (
    supabase: SupabaseClient,
    userId: string,
  ): Promise<CommunityWithRole[]> => {
    const { data, error } = await supabase
      .from('community_members')
      .select(
        `role,
         communities:community_id (
           community_id, public_id, name, kind, description, archived, created_at
         )`,
      )
      .eq('user_id', userId);

    if (error) {
      // Graceful-degrade-always (fetchUserEvents precedent — an empty list is
      // safer than crashing the launcher/index when the migration hasn't
      // reached this environment yet).
      logQueryError(
        'fetchUserCommunities',
        error,
        { user_id: userId },
        'graceful_degrade',
      );
      return [];
    }

    const rows = (data ?? []) as unknown as MembershipJoinRow[];
    const communities = rows
      .flatMap((row) => {
        const arr = Array.isArray(row.communities)
          ? row.communities
          : row.communities
            ? [row.communities]
            : [];
        return arr.map((c) => ({ ...c, role: row.role, member_count: 0 }));
      })
      .filter((c) => !c.archived)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (communities.length === 0) return [];

    // Member counts — one grouped read over community_members. RLS lets a
    // member count only their own communities, which is exactly this set.
    const ids = communities.map((c) => c.community_id);
    const { data: memberRows, error: countError } = await supabase
      .from('community_members')
      .select('community_id')
      .in('community_id', ids);
    if (countError) {
      logQueryError(
        'fetchUserCommunities (member counts)',
        countError,
        { user_id: userId },
        'graceful_degrade',
      );
      return communities;
    }
    const counts = new Map<string, number>();
    for (const row of (memberRows ?? []) as Array<{ community_id: string }>) {
      counts.set(row.community_id, (counts.get(row.community_id) ?? 0) + 1);
    }
    return communities.map((c) => ({
      ...c,
      member_count: counts.get(c.community_id) ?? 0,
    }));
  },
);

/**
 * One community with the viewer's role + member count. Returns null when the
 * viewer is not a member (RLS hides the row) or on any read error — the space
 * page turns null into notFound(), which doubles as the membership gate.
 */
export async function fetchCommunity(
  supabase: SupabaseClient,
  communityId: string,
  userId: string,
): Promise<CommunityWithRole | null> {
  const [{ data: community, error }, { data: selfRow, error: selfError }] =
    await Promise.all([
      supabase
        .from('communities')
        .select(
          'community_id, public_id, name, kind, description, archived, created_at',
        )
        .eq('community_id', communityId)
        .maybeSingle(),
      supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

  if (error || selfError) {
    logQueryError(
      'fetchCommunity',
      error ?? selfError,
      { community_id: communityId },
      'graceful_degrade',
    );
    return null;
  }
  if (!community || !selfRow) return null;

  const { count } = await supabase
    .from('community_members')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId);

  return {
    ...(community as CommunityRow),
    role: (selfRow as { role: CommunityRole }).role,
    member_count: count ?? 0,
  };
}

/**
 * The community's events — a plain SELECT under the USER's JWT; the
 * community_member_can_read_events policy is what makes these rows visible
 * to members who have no event_members row.
 */
export async function fetchCommunityEvents(
  supabase: SupabaseClient,
  communityId: string,
): Promise<CommunityEventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('event_id, display_name, event_type, event_date, archived')
    .eq('community_id', communityId)
    .order('event_date', { ascending: true, nullsFirst: false });
  if (error) {
    if (!isMissingRelationError(error)) {
      logQueryError(
        'fetchCommunityEvents',
        error,
        { community_id: communityId },
        'graceful_degrade',
      );
    }
    return [];
  }
  return ((data ?? []) as CommunityEventRow[]).filter((e) => !e.archived);
}

/**
 * The event_ids the viewer is an event MEMBER of — decides which Events-tab
 * rows LINK into `/dashboard/[eventId]` vs render as static text ("Ask an
 * organizer to add you to this event.").
 */
export async function fetchViewerEventIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('user_id', userId);
  if (error) {
    logQueryError(
      'fetchViewerEventIds',
      error,
      { user_id: userId },
      'graceful_degrade',
    );
    return new Set();
  }
  return new Set(
    ((data ?? []) as Array<{ event_id: string }>).map((r) => r.event_id),
  );
}

/**
 * The roster with cross-user display names. `users` RLS is Pattern A
 * (owner-only) — a member can't SELECT another member's users row — so the
 * NAME read goes through the admin client (resolvePrimaryHostEvent precedent:
 * "pass the admin client … RLS would otherwise hide the rows").
 *
 * Security posture:
 *   1. The caller's membership is verified with the USER-scoped client FIRST
 *      (the roster read below returns rows only for the caller's own
 *      communities anyway — belt and suspenders).
 *   2. The admin read selects ONLY (user_id → display_name). Never email.
 *   3. The returned entries carry NO auth UUIDs — actions target the
 *      bigserial member_row_id.
 */
export async function fetchCommunityRoster(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  communityId: string,
  viewerId: string,
): Promise<CommunityRosterEntry[]> {
  const { data: memberRows, error } = await supabase
    .from('community_members')
    .select('id, user_id, role, joined_at')
    .eq('community_id', communityId)
    .order('joined_at', { ascending: true });
  if (error) {
    logQueryError(
      'fetchCommunityRoster',
      error,
      { community_id: communityId },
      'graceful_degrade',
    );
    return [];
  }
  const rows = (memberRows ?? []) as Array<{
    id: number;
    user_id: string;
    role: CommunityRole;
    joined_at: string;
  }>;
  // Membership gate: RLS already returns 0 rows for a non-member; requiring
  // the viewer's own row in the result makes the gate explicit.
  if (!rows.some((r) => r.user_id === viewerId)) return [];

  const names = new Map<string, string>();
  const { data: nameRows } = await admin
    .from('users')
    .select('user_id, display_name')
    .in('user_id', [...new Set(rows.map((r) => r.user_id))]);
  for (const r of (nameRows ?? []) as Array<{
    user_id: string;
    display_name: string | null;
  }>) {
    const label = (r.display_name ?? '').trim();
    if (label) names.set(r.user_id, label);
  }

  return rows.map((r) => ({
    member_row_id: r.id,
    display_name: names.get(r.user_id) ?? 'Member',
    role: r.role,
    joined_at: r.joined_at,
    is_self: r.user_id === viewerId,
  }));
}

/**
 * The community's standing invite token — organizer-only by RLS, so this read
 * uses the USER-scoped client and simply returns null for non-organizers.
 */
export async function fetchInviteToken(
  supabase: SupabaseClient,
  communityId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('community_invite_tokens')
    .select('token, revoked_at')
    .eq('community_id', communityId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { token: string; revoked_at: string | null };
  return row.revoked_at ? null : row.token;
}

/**
 * 32-byte URL-safe standing invite token (43-char base64url) — same recipe as
 * generateInvitationToken in lib/event-moderators.ts. Unlike host invites the
 * token is NOT cleared on accept (it's a standing group link); rotation is
 * the kill switch.
 */
export function generateCommunityInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export type PendingCommunityInvite = {
  community_id: string;
  name: string;
  kind: CommunityKind;
  member_count: number;
};

export type CommunityInviteResolution =
  | { status: 'ok'; invite: PendingCommunityInvite }
  | { status: 'not_found' | 'revoked' | 'expired' | 'archived' };

/**
 * Resolve a public invite token (admin client — the token IS the secret;
 * fetchPendingHostInvite precedent). Pre-join the page may show name + kind +
 * member COUNT only — never member names (plan §9 no-roster-scraping rule).
 */
export async function fetchPendingCommunityInvite(
  admin: SupabaseClient,
  token: string,
): Promise<CommunityInviteResolution> {
  if (!token || token.length < 32) return { status: 'not_found' };

  const { data } = await admin
    .from('community_invite_tokens')
    .select('community_id, revoked_at, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!data) return { status: 'not_found' };
  const row = data as {
    community_id: string;
    revoked_at: string | null;
    expires_at: string | null;
  };
  if (row.revoked_at) return { status: 'revoked' };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { status: 'expired' };
  }

  const [{ data: community }, { count }] = await Promise.all([
    admin
      .from('communities')
      .select('community_id, name, kind, archived')
      .eq('community_id', row.community_id)
      .maybeSingle(),
    admin
      .from('community_members')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', row.community_id),
  ]);
  if (!community) return { status: 'not_found' };
  const c = community as {
    community_id: string;
    name: string;
    kind: CommunityKind;
    archived: boolean;
  };
  if (c.archived) return { status: 'archived' };

  return {
    status: 'ok',
    invite: {
      community_id: c.community_id,
      name: c.name,
      kind: c.kind,
      member_count: count ?? 0,
    },
  };
}

export type SamahanSecondDegreeEntry = {
  display_name: string;
  /** Names of the samahan(s) the viewer shares with this person. */
  via: string[];
  /** A representative community_members bigserial id — the SAFE action handle
   *  (fetchCommunityRoster rule: actions target member_row_id, never a UUID). */
  member_row_id: number;
  /** True when the viewer already has a (pending or confirmed) connection —
   *  the section then renders no Connect affordance. */
  known: boolean;
};

/**
 * The viewer's SECOND-DEGREE people — co-members of their samahans (owner
 * degree model 2026-07-17: connections + alaga + samahan GROUPS are first
 * degree; the people INSIDE those samahans are second degree). Security
 * posture mirrors fetchCommunityRoster:
 *   1. membership rows via the USER client — community_roster_member_read RLS
 *      already scopes to the caller's own communities;
 *   2. names via the admin client, (user_id → display_name) ONLY, never email;
 *   3. returned entries carry NO auth UUIDs.
 */
export async function fetchSamahanSecondDegree(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  /** User ids the viewer is already connected to (pending or confirmed) —
   *  computed by the caller when the connections flag is on; entries matching
   *  are marked `known` so the UI skips the Connect affordance. */
  knownUserIds: ReadonlySet<string> = new Set(),
): Promise<SamahanSecondDegreeEntry[]> {
  const communities = await fetchUserCommunities(supabase, userId);
  const active = communities.filter((c) => !c.archived);
  if (active.length === 0) return [];
  const nameById = new Map(active.map((c) => [c.community_id, c.name]));

  const { data, error } = await supabase
    .from('community_members')
    .select('id, community_id, user_id')
    .in('community_id', active.map((c) => c.community_id));
  if (error) {
    logQueryError('fetchSamahanSecondDegree', error, { user_id: userId }, 'graceful_degrade');
    return [];
  }

  const viaByUser = new Map<string, Set<string>>();
  const rowIdByUser = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ id: number; community_id: string; user_id: string }>) {
    if (r.user_id === userId) continue;
    const via = viaByUser.get(r.user_id) ?? new Set<string>();
    const label = nameById.get(r.community_id);
    if (label) via.add(label);
    viaByUser.set(r.user_id, via);
    if (!rowIdByUser.has(r.user_id)) rowIdByUser.set(r.user_id, r.id);
  }
  if (viaByUser.size === 0) return [];

  const names = new Map<string, string>();
  const { data: nameRows } = await admin
    .from('users')
    .select('user_id, display_name')
    .in('user_id', [...viaByUser.keys()]);
  for (const r of (nameRows ?? []) as Array<{ user_id: string; display_name: string | null }>) {
    const label = (r.display_name ?? '').trim();
    if (label) names.set(r.user_id, label);
  }

  return [...viaByUser.entries()]
    .map(([uid, via]) => ({
      display_name: names.get(uid) ?? 'Member',
      via: [...via].sort((a, b) => a.localeCompare(b)),
      member_row_id: rowIdByUser.get(uid) ?? 0,
      known: knownUserIds.has(uid),
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

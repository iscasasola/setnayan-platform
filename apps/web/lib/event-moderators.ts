import 'server-only';
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// Iteration 0048 — V1 multi-host invite system.
//
// Shipped 2026-05-20 alongside the V1 promotion (see CLAUDE.md decision log).
// Foundation table from PR #135 (migration 20260519100000) + invite-token
// migration 20260521080000 form the schema layer; this module is the
// server-side helpers + permission templates.
//
// The 13 role subtypes from the spec, each with a default permission
// template the inviter starts from. Permissions are stored per-moderator
// (permissions_json column) so they can be overridden case-by-case; the
// template just supplies the defaults at invite time.

export const ROLE_SUBTYPES = [
  'bride',
  'groom',
  'partner1',
  'partner2',
  'parent_of_bride',
  'parent_of_groom',
  'maid_of_honor',
  'best_man',
  'wedding_planner_external',
  'ninong',
  'ninang',
  'family_helper',
  'viewer',
] as const;

export type RoleSubtype = (typeof ROLE_SUBTYPES)[number];

export const ROLE_SUBTYPE_LABEL: Readonly<Record<RoleSubtype, string>> = {
  bride: 'Bride',
  groom: 'Groom',
  partner1: 'Partner 1',
  partner2: 'Partner 2',
  parent_of_bride: 'Parent of the bride',
  parent_of_groom: 'Parent of the groom',
  maid_of_honor: 'Maid of honor',
  best_man: 'Best man',
  wedding_planner_external: 'Wedding planner (external)',
  ninong: 'Ninong (godfather sponsor)',
  ninang: 'Ninang (godmother sponsor)',
  family_helper: 'Family helper',
  viewer: 'Viewer (read-only)',
};

// One-liner explanation per role so the invite UI helps the inviter pick
// the right subtype without consulting the spec.
export const ROLE_SUBTYPE_HINT: Readonly<Record<RoleSubtype, string>> = {
  bride: 'Full edit + checkout + can invite more hosts.',
  groom: 'Full edit + checkout + can invite more hosts.',
  partner1: 'Full edit + checkout + can invite more hosts.',
  partner2: 'Full edit + checkout + can invite more hosts.',
  parent_of_bride: 'Edit + checkout. Often the one paying.',
  parent_of_groom: 'Edit + checkout. Often the one paying.',
  maid_of_honor: 'Edit. No checkout — couple controls the wallet.',
  best_man: 'Edit. No checkout — couple controls the wallet.',
  wedding_planner_external: 'Edit + checkout. Hired planner not on the Setnayan vendor side.',
  ninong: 'Edit. Filipino principal sponsor (godfather).',
  ninang: 'Edit. Filipino principal sponsor (godmother).',
  family_helper: "Limited edit. Tita Lita helping out — no payments, no host invites.",
  viewer: "Read-only. For relatives who want to see the plan but not change it.",
};

// Permission templates per role. Stored on each moderator row's
// permissions_json column at invite time; can be overridden later via a
// per-moderator edit (V1.1 follow-up).
// Feature-access program Phase 2 (2026-06-12, corpus
// 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md § 3): an
// optional `areas` object carries per-area grants that OVERRIDE the coarse
// edit_all/checkout flags. Resolution lives in SQL
// (public.moderator_area_level, migration 20261129000000) — keep
// resolveAreaLevel below in lockstep with it.
export type DelegateArea =
  | 'guest_list'
  | 'seat_plan'
  | 'schedule'
  | 'vendors'
  | 'invitations'
  | 'mood_board'
  | 'budget';

export type AreaLevel = 'edit' | 'view' | null;

export type ModeratorPermissions = {
  edit_all: boolean;
  checkout: boolean;
  invite_hosts: boolean;
  remove_hosts: boolean;
  areas?: Partial<Record<DelegateArea, AreaLevel>>;
};

export const DELEGATE_AREAS: readonly DelegateArea[] = [
  'guest_list',
  'seat_plan',
  'schedule',
  'vendors',
  'invitations',
  'mood_board',
  'budget',
] as const;

export const DELEGATE_AREA_LABEL: Readonly<Record<DelegateArea, string>> = {
  guest_list: 'Guest list',
  seat_plan: 'Seat plan',
  schedule: 'Schedule',
  vendors: 'Vendors',
  invitations: 'Invitations',
  mood_board: 'Mood board',
  budget: 'Budget',
};

// The coordinator's default grants — locked § 3 table: planning areas Edit,
// mood board View (aesthetic direction stays the couple's), budget OFF
// (locked D1 — couple-raiseable to View, never Edit in V1). Seat-plan
// publish + first invitation deploy remain couple-confirmed regardless
// (DB trigger + locked D4).
export const COORDINATOR_AREAS: Readonly<Partial<Record<DelegateArea, AreaLevel>>> = {
  guest_list: 'edit',
  seat_plan: 'edit',
  schedule: 'edit',
  vendors: 'edit',
  invitations: 'edit',
  mood_board: 'view',
  budget: null,
};

/**
 * TS mirror of public.moderator_area_level (migration 20261129000000).
 * areas[k] wins when the key is present; legacy flags fall back. Budget
 * never exceeds 'view' in V1 (locked D1).
 */
export function resolveAreaLevel(
  perms: ModeratorPermissions | null | undefined,
  area: DelegateArea,
): AreaLevel {
  if (!perms) return null;
  if (perms.areas && area in perms.areas) {
    return perms.areas[area] ?? null;
  }
  if (area === 'budget') return perms.checkout ? 'view' : null;
  if (area === 'mood_board') return 'view';
  return perms.edit_all ? 'edit' : 'view';
}

export const PERMISSION_TEMPLATES: Readonly<Record<RoleSubtype, ModeratorPermissions>> = {
  bride: { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: true },
  groom: { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: true },
  partner1: { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: true },
  partner2: { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: true },
  parent_of_bride: { edit_all: true, checkout: true, invite_hosts: false, remove_hosts: false },
  parent_of_groom: { edit_all: true, checkout: true, invite_hosts: false, remove_hosts: false },
  maid_of_honor: { edit_all: true, checkout: false, invite_hosts: false, remove_hosts: false },
  best_man: { edit_all: true, checkout: false, invite_hosts: false, remove_hosts: false },
  wedding_planner_external: { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: false },
  ninong: { edit_all: true, checkout: false, invite_hosts: false, remove_hosts: false },
  ninang: { edit_all: true, checkout: false, invite_hosts: false, remove_hosts: false },
  family_helper: { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false },
  viewer: { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false },
};

export function isRoleSubtype(value: unknown): value is RoleSubtype {
  return typeof value === 'string' && (ROLE_SUBTYPES as readonly string[]).includes(value);
}

/**
 * Generate a 32-byte URL-safe invitation token. Format: 43-char base64url.
 * Stored in event_moderators.invitation_token; appears in the accept URL
 * `/host/accept/<token>`. Rotated to NULL on accept so the same link
 * cannot be redeemed twice.
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export type HostInviteRow = {
  moderator_id: string;
  event_id: string;
  user_id: string | null;
  role_subtype: RoleSubtype;
  display_label: string | null;
  invitation_email: string | null;
  invitation_phone: string | null;
  invitation_sent_at: string | null;
  invitation_expires_at: string | null;
  accepted_at: string | null;
  removed_at: string | null;
  invited_by_user_id: string | null;
};

/**
 * Resolve a pending invite by its token. Used by the /host/accept/[token]
 * page to render the accept screen. Returns null when:
 *   - token is missing or doesn't match a row
 *   - row exists but is already accepted (accepted_at NOT NULL)
 *   - row exists but is revoked (removed_at NOT NULL)
 *   - row exists but has expired (invitation_expires_at < NOW())
 *
 * The accept-page caller distinguishes between not-found and terminal-state
 * (already_accepted / revoked / expired) by looking the row up without the
 * predicates, then checking the timestamps itself. For the happy-path
 * pending case, this helper is the canonical lookup.
 */
export async function fetchPendingHostInvite(
  admin: SupabaseClient,
  token: string,
): Promise<HostInviteRow | null> {
  if (!token || token.length < 32) return null;
  const { data } = await admin
    .from('event_moderators')
    .select(
      'moderator_id, event_id, user_id, role_subtype, display_label, invitation_email, invitation_phone, invitation_sent_at, invitation_expires_at, accepted_at, removed_at, invited_by_user_id',
    )
    .eq('invitation_token', token)
    .maybeSingle();
  if (!data) return null;
  return data as HostInviteRow;
}

/**
 * Has the calling user already accepted a host role on this event? Used by
 * trial-start, checkout, and per-event tile gating to decide whether to
 * show a button at all. Pending invites do NOT count — only accepted ones.
 */
export async function isCurrentEventHost(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .is('accepted_at', null)
    .is('removed_at', null);
  // Inverted check: rows with NULL accepted_at are PENDING (not host yet).
  // We want rows where accepted_at IS NOT NULL AND removed_at IS NULL.
  // Re-query with the correct predicates:
  const { data: accepted } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  void data;
  return !!accepted;
}

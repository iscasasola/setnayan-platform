import type { SupabaseClient } from '@supabase/supabase-js';

export type VendorTeamRole = 'owner' | 'admin' | 'agent' | 'viewer';

export const VENDOR_TEAM_ROLES: ReadonlyArray<VendorTeamRole> = [
  'owner',
  'admin',
  'agent',
  'viewer',
];

/**
 * Roles an admin may ASSIGN. `owner` is retired (multi-admin org model,
 * 2026-07-01) — a store is run by one or more peer admins, so the picker
 * never offers Owner. The `owner` enum value lingers only for legacy data.
 */
export const VENDOR_ASSIGNABLE_ROLES: ReadonlyArray<VendorTeamRole> = [
  'admin',
  'agent',
  'viewer',
];

export const VENDOR_TEAM_ROLE_LABEL: Record<VendorTeamRole, string> = {
  owner: 'Admin', // legacy rows surface as Admin
  admin: 'Admin',
  agent: 'Agent',
  viewer: 'Viewer',
};

export const VENDOR_TEAM_ROLE_BLURB: Record<VendorTeamRole, string> = {
  owner: 'Top role — manages the whole store, including team and roles.',
  admin: 'Top role — manages the whole store, including team and roles.',
  agent: 'Assigned to specific services; sees only their own work.',
  viewer: 'Read-only access to the schedule and bookings.',
};

/** Admin and the legacy `owner` value both count as the top management role. */
export function isVendorAdminRole(role: VendorTeamRole): boolean {
  return role === 'admin' || role === 'owner';
}

export type VendorTeamMemberRow = {
  vendor_team_member_id: string;
  public_id: string;
  vendor_profile_id: string;
  user_id: string;
  role: VendorTeamRole;
  team_label: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorTeamMemberWithUser = VendorTeamMemberRow & {
  email: string | null;
  display_name: string | null;
};

const SELECT =
  'vendor_team_member_id,public_id,vendor_profile_id,user_id,role,team_label,created_at,updated_at';

export async function fetchVendorTeam(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorTeamMemberRow[]> {
  const { data, error } = await supabase
    .from('vendor_team_members')
    .select(SELECT)
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchVendorTeam failed: ${error.message}`);
  return (data ?? []) as VendorTeamMemberRow[];
}

/**
 * Attach email + display_name to each team row. The membership rows live in
 * `vendor_team_members` (RLS-scoped to the team owner). The user-side
 * email/display_name live in `public.users` (Pattern A — owner-only). To
 * read another user's email we need the admin client; pass it in.
 */
export async function enrichTeamWithUsers(
  adminClient: SupabaseClient,
  members: VendorTeamMemberRow[],
): Promise<VendorTeamMemberWithUser[]> {
  if (members.length === 0) return [];
  const ids = Array.from(new Set(members.map((m) => m.user_id)));
  const { data, error } = await adminClient
    .from('users')
    .select('user_id,email,display_name')
    .in('user_id', ids);
  if (error) throw new Error(`enrichTeamWithUsers failed: ${error.message}`);
  const byId = new Map<string, { email: string | null; display_name: string | null }>();
  for (const u of data ?? []) {
    byId.set(u.user_id, { email: u.email, display_name: u.display_name });
  }
  return members.map((m) => ({
    ...m,
    email: byId.get(m.user_id)?.email ?? null,
    display_name: byId.get(m.user_id)?.display_name ?? null,
  }));
}

// ── Per-service agent assignment (Phase 2a) ───────────────────────────────

export type AssignableService = {
  vendor_service_id: string;
  category: string;
  is_active: boolean;
};

/** The vendor's own services — the assignable set for agent scoping. */
export async function fetchAssignableServices(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<AssignableService[]> {
  const { data, error } = await supabase
    .from('vendor_services')
    .select('vendor_service_id,category,is_active')
    .eq('vendor_profile_id', vendorProfileId)
    .order('category', { ascending: true });
  if (error) throw new Error(`fetchAssignableServices failed: ${error.message}`);
  return (data ?? []) as AssignableService[];
}

/**
 * Map of vendor_team_member_id → assigned vendor_service_ids, scoped to this
 * vendor's own services (so a member's assignments from another vendor never
 * leak in). Used to pre-check the assignment boxes on the Team page.
 */
export async function fetchAgentServiceAssignments(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<Record<string, string[]>> {
  const services = await fetchAssignableServices(supabase, vendorProfileId);
  const serviceIds = services.map((s) => s.vendor_service_id);
  if (serviceIds.length === 0) return {};
  const { data, error } = await supabase
    .from('vendor_service_agents')
    .select('vendor_team_member_id,vendor_service_id')
    .in('vendor_service_id', serviceIds);
  if (error) throw new Error(`fetchAgentServiceAssignments failed: ${error.message}`);
  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const memberId = (row as { vendor_team_member_id: string }).vendor_team_member_id;
    const serviceId = (row as { vendor_service_id: string }).vendor_service_id;
    (map[memberId] ??= []).push(serviceId);
  }
  return map;
}

// ── Multi-admin org governance (2026-07-01) ───────────────────────────────

export type VendorAdminContext = {
  vendorProfileId: string;
  /** vendor_profiles.user_id — the store creator (free seat; seat-cap anchor). */
  founderUserId: string;
  tierState: string | null;
};

/**
 * Resolve the store the caller manages AS AN ADMIN. Team management, the
 * subscription buy, and the demotion-vote flow are all admin-gated, so every
 * one of those surfaces resolves through here. Returns null when the caller is
 * not an admin of any store (agents/viewers/non-vendors → blocked).
 */
export async function fetchAdminVendorContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorAdminContext | null> {
  const { data: membership } = await supabase
    .from('vendor_team_members')
    .select('vendor_profile_id, role, vendor_profiles!inner(user_id, tier_state)')
    .eq('user_id', userId)
    .in('role', ['admin', 'owner'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return null;
  // Supabase types an embedded FK as an array; normalize to a single row.
  const vpRaw = (membership as {
    vendor_profiles:
      | { user_id: string; tier_state: string | null }
      | { user_id: string; tier_state: string | null }[]
      | null;
  }).vendor_profiles;
  const vp = Array.isArray(vpRaw) ? vpRaw[0] : vpRaw;
  if (!vp) return null;
  return {
    vendorProfileId: (membership as { vendor_profile_id: string }).vendor_profile_id,
    founderUserId: vp.user_id,
    tierState: vp.tier_state ?? null,
  };
}

export type VendorAdminMotion = {
  motion_id: string;
  vendor_profile_id: string;
  target_user_id: string;
  target_member_id: string;
  kind: 'demote' | 'remove';
  new_role: VendorTeamRole;
  proposed_by: string;
  status: 'open' | 'executed' | 'rejected' | 'cancelled';
  created_at: string;
  resolved_at: string | null;
};

export type VendorAdminMotionVote = {
  motion_id: string;
  voter_user_id: string;
  approve: boolean;
};

/** Open peer-admin demotion/removal motions for a store + their votes. */
export async function fetchOpenAdminMotions(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<{ motions: VendorAdminMotion[]; votes: VendorAdminMotionVote[] }> {
  const { data: motions } = await supabase
    .from('vendor_admin_motions')
    .select(
      'motion_id,vendor_profile_id,target_user_id,target_member_id,kind,new_role,proposed_by,status,created_at,resolved_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  const list = (motions ?? []) as VendorAdminMotion[];
  if (list.length === 0) return { motions: [], votes: [] };
  const { data: votes } = await supabase
    .from('vendor_admin_motion_votes')
    .select('motion_id,voter_user_id,approve')
    .in(
      'motion_id',
      list.map((m) => m.motion_id),
    );
  return { motions: list, votes: (votes ?? []) as VendorAdminMotionVote[] };
}

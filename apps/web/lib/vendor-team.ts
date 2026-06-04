import type { SupabaseClient } from '@supabase/supabase-js';

export type VendorTeamRole = 'owner' | 'admin' | 'agent' | 'viewer';

export const VENDOR_TEAM_ROLES: ReadonlyArray<VendorTeamRole> = [
  'owner',
  'admin',
  'agent',
  'viewer',
];

export const VENDOR_TEAM_ROLE_LABEL: Record<VendorTeamRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  agent: 'Agent',
  viewer: 'Viewer',
};

export const VENDOR_TEAM_ROLE_BLURB: Record<VendorTeamRole, string> = {
  owner: 'Full access; only role that can change other roles.',
  admin: 'Manages bookings, services, and team (except Owner role).',
  agent: 'Assigned to specific services; sees only their own work.',
  viewer: 'Read-only access to the schedule and bookings.',
};

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

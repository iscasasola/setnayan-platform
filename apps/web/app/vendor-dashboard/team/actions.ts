'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revokeAllSessions } from '@/lib/force-logout';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  VENDOR_TEAM_ROLES,
  isVendorAdminRole,
  fetchAdminVendorContext,
  type VendorTeamRole,
} from '@/lib/vendor-team';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';

const ROLE_SET: ReadonlySet<string> = new Set(VENDOR_TEAM_ROLES);

const TEAM = '/vendor-dashboard/team';
const err = (msg: string): never =>
  redirect(`${TEAM}?error=${encodeURIComponent(msg)}`);

function parseRole(raw: FormDataEntryValue | null): VendorTeamRole {
  if (typeof raw !== 'string' || !ROLE_SET.has(raw)) {
    throw new Error('Unknown role.');
  }
  return raw as VendorTeamRole;
}

function nullIfBlank(raw: FormDataEntryValue | null, max = 64): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/**
 * Team management is ADMIN-gated (multi-admin org model, 2026-07-01). ANY admin
 * of the store can manage the team — resolve the store the caller administers.
 * Non-admin members (agent/viewer) and non-vendors are bounced to the dashboard.
 */
async function ensureAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const ctx = await fetchAdminVendorContext(supabase, user.id);
  if (!ctx) redirect('/vendor-dashboard');
  return { supabase, ctx, currentUserId: user.id };
}

/**
 * V1 invite: only existing users by email. Looks up the user via the admin
 * client (RLS on public.users is per-user), then inserts a vendor_team_members
 * row. Any admin may add a member at admin / agent / viewer.
 */
export async function inviteVendorTeamMember(formData: FormData) {
  const { supabase, ctx } = await ensureAdmin();

  const emailRaw = formData.get('email');
  const labelRaw = formData.get('team_label');
  let role: VendorTeamRole;
  try {
    role = parseRole(formData.get('role'));
  } catch (e) {
    return err((e as Error).message);
  }
  if (typeof emailRaw !== 'string' || emailRaw.trim().length === 0) {
    return err('Email is required');
  }
  const email = emailRaw.trim().toLowerCase();
  const team_label = nullIfBlank(labelRaw);

  // `owner` is retired — admins promote each other to Admin, not Owner.
  if (role === 'owner') {
    return err('Owner role is retired — add this person as an Admin instead.');
  }

  // Tier seat cap (Vendor_Tier_Capability_Matrix): count every member beyond
  // the founding admin (vendor_profiles.user_id) against the plan's seat
  // allowance — additional admins consume a seat just like agents do.
  const seatCap = tierCaps(asVendorTier(ctx.tierState ?? 'free')).agentAccounts;
  if (seatCap !== Infinity) {
    const { count: seatCount } = await supabase
      .from('vendor_team_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', ctx.vendorProfileId)
      .neq('user_id', ctx.founderUserId);
    if ((seatCount ?? 0) >= seatCap) {
      return err(
        seatCap === 0
          ? 'Team seats need a paid plan. Get verified or upgrade to add team members.'
          : `You've reached your plan's limit of ${seatCap} team seat${seatCap === 1 ? '' : 's'}. Upgrade for more.`,
      );
    }
  }

  // Look up the target user by email via the admin client.
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from('users')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();
  if (lookupError) {
    return err(lookupError.message);
  }
  if (!existing) {
    return err('No Setnayan account with that email. Ask them to sign up first.');
  }

  const { error } = await supabase.from('vendor_team_members').insert({
    vendor_profile_id: ctx.vendorProfileId,
    user_id: existing.user_id,
    role,
    team_label,
  });
  if (error) {
    return err(
      error.code === '23505' ? 'That user is already on your team.' : error.message,
    );
  }

  revalidatePath(TEAM);
  redirect(`${TEAM}?invited=1`);
}

/**
 * Change a NON-admin member's role/label. Promotion to Admin is unilateral.
 * Changing an *admin's* role is NOT done here — it needs a team vote (see
 * proposeAdminMotion). Enforced both in the UI and defensively here.
 */
export async function updateVendorTeamMember(formData: FormData) {
  const { supabase, ctx, currentUserId } = await ensureAdmin();

  const idRaw = formData.get('vendor_team_member_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return err('Missing member id');
  }

  let role: VendorTeamRole;
  try {
    role = parseRole(formData.get('role'));
  } catch (e) {
    return err((e as Error).message);
  }
  const team_label = nullIfBlank(formData.get('team_label'));

  const { data: target, error: readErr } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id,user_id,role')
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .maybeSingle();
  if (readErr) return err(readErr.message);
  if (!target) return err('Member not found');
  if (target.user_id === currentUserId) {
    return err('Use “Step down” to change your own role.');
  }
  if (role === 'owner') {
    return err('Owner role is retired — use Admin instead.');
  }
  if (isVendorAdminRole(target.role as VendorTeamRole)) {
    return err('Changing an admin’s role needs a team vote — start one below.');
  }

  const { error } = await supabase
    .from('vendor_team_members')
    .update({ role, team_label, updated_at: new Date().toISOString() })
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', ctx.vendorProfileId);
  if (error) return err(error.message);

  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}

/**
 * Remove a NON-admin member (unilateral). Removing an admin needs a team vote
 * (proposeAdminMotion with kind='remove').
 */
export async function removeVendorTeamMember(formData: FormData) {
  const { supabase, ctx, currentUserId } = await ensureAdmin();

  const idRaw = formData.get('vendor_team_member_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return err('Missing member id');
  }

  const { data: target } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id,user_id,role')
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .maybeSingle();
  if (!target) return err('Member not found');
  if (target.user_id === currentUserId) {
    return err('You cannot remove yourself. Step down first, then have another admin remove you.');
  }
  if (isVendorAdminRole(target.role as VendorTeamRole)) {
    return err('Removing an admin needs a team vote — start one below.');
  }

  const { error } = await supabase
    .from('vendor_team_members')
    .delete()
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', ctx.vendorProfileId);
  if (error) return err(error.message);

  const removedUserId = target.user_id as string;
  after(() => revokeAllSessions(removedUserId).catch(() => {}));

  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}

// ── Peer-admin demotion/removal votes (multi-admin org model) ──────────────

const RPC_FRIENDLY: Array<[string, string]> = [
  ['MOTION_ALREADY_OPEN', 'There’s already an open vote for that admin.'],
  ['TARGET_NOT_ADMIN', 'That person isn’t an admin.'],
  ['CANNOT_TARGET_SELF', 'Use “Step down” to leave the admin role yourself.'],
  ['NOT_VENDOR_ADMIN', 'Only an admin can do that.'],
  ['TARGET_CANNOT_VOTE', 'You can’t vote on a motion about yourself.'],
  ['MOTION_CLOSED', 'That vote has already been resolved.'],
  ['MOTION_NOT_FOUND', 'That vote no longer exists.'],
  ['VENDOR_LAST_ADMIN', 'A store must keep at least one admin.'],
];
function friendlyRpcError(message: string | undefined): string {
  const up = (message ?? '').toUpperCase();
  for (const [code, friendly] of RPC_FRIENDLY) {
    if (up.includes(code)) return friendly;
  }
  return 'That action couldn’t be completed. Please try again.';
}

/** Start a vote to demote (→ agent/viewer) or remove a peer admin. */
export async function proposeAdminMotion(formData: FormData) {
  const { supabase, ctx } = await ensureAdmin();
  const targetUserId = formData.get('target_user_id');
  const kindRaw = formData.get('kind');
  const newRoleRaw = formData.get('new_role');
  if (typeof targetUserId !== 'string' || targetUserId.length === 0) {
    return err('Missing target member');
  }
  const kind = kindRaw === 'remove' ? 'remove' : 'demote';
  const newRole = newRoleRaw === 'viewer' ? 'viewer' : 'agent';

  const { data, error } = await supabase.rpc('vendor_propose_admin_motion', {
    p_vendor_profile_id: ctx.vendorProfileId,
    p_target_user_id: targetUserId,
    p_kind: kind,
    p_new_role: newRole,
  });
  if (error) return err(friendlyRpcError(error.message));

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.status === 'executed' && row?.kind === 'remove' && row?.target_user_id) {
    const removed = row.target_user_id as string;
    after(() => revokeAllSessions(removed).catch(() => {}));
  }

  revalidatePath(TEAM);
  redirect(`${TEAM}?${row?.status === 'executed' ? 'saved=1' : 'motion=started'}`);
}

/** Cast / change a vote on an open admin motion. */
export async function voteAdminMotion(formData: FormData) {
  const { supabase } = await ensureAdmin();
  const motionId = formData.get('motion_id');
  const approve = formData.get('approve') === 'true';
  if (typeof motionId !== 'string' || motionId.length === 0) {
    return err('Missing motion id');
  }
  const { data, error } = await supabase.rpc('vendor_vote_admin_motion', {
    p_motion_id: motionId,
    p_approve: approve,
  });
  if (error) return err(friendlyRpcError(error.message));

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.status === 'executed' && row?.kind === 'remove' && row?.target_user_id) {
    const removed = row.target_user_id as string;
    after(() => revokeAllSessions(removed).catch(() => {}));
  }

  revalidatePath(TEAM);
  redirect(`${TEAM}?${row?.status === 'open' ? 'voted=1' : 'saved=1'}`);
}

/** Cancel an open admin motion (any admin of the store). */
export async function cancelAdminMotion(formData: FormData) {
  const { supabase } = await ensureAdmin();
  const motionId = formData.get('motion_id');
  if (typeof motionId !== 'string' || motionId.length === 0) {
    return err('Missing motion id');
  }
  const { error } = await supabase.rpc('vendor_cancel_admin_motion', {
    p_motion_id: motionId,
  });
  if (error) return err(friendlyRpcError(error.message));

  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}

/** Step down from the admin role yourself (→ agent). Blocked if you're the last admin. */
export async function stepDownSelf() {
  const { supabase, ctx, currentUserId } = await ensureAdmin();
  const { error } = await supabase
    .from('vendor_team_members')
    .update({ role: 'agent', updated_at: new Date().toISOString() })
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .eq('user_id', currentUserId)
    .eq('role', 'admin');
  if (error) {
    return err(
      (error.message ?? '').toUpperCase().includes('VENDOR_LAST_ADMIN')
        ? 'You’re the only admin — promote someone to admin before stepping down.'
        : error.message,
    );
  }
  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}

/**
 * Phase 2a — set which services an agent is assigned to. Admin-only (enforced
 * by RLS on vendor_service_agents via current_vendor_ids('admin')); the action
 * also clamps the selection to the vendor's own services defensively.
 */
export async function setVendorAgentServices(formData: FormData) {
  const { supabase, ctx } = await ensureAdmin();

  const memberIdRaw = formData.get('vendor_team_member_id');
  if (typeof memberIdRaw !== 'string' || memberIdRaw.length === 0) {
    return err('Missing member id');
  }

  const { data: member } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id')
    .eq('vendor_team_member_id', memberIdRaw)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .maybeSingle();
  if (!member) return err('Member not found');

  const { data: services } = await supabase
    .from('vendor_services')
    .select('vendor_service_id')
    .eq('vendor_profile_id', ctx.vendorProfileId);
  const valid = new Set(
    (services ?? []).map((s) => (s as { vendor_service_id: string }).vendor_service_id),
  );
  const selected = formData
    .getAll('service_ids')
    .filter((v): v is string => typeof v === 'string' && valid.has(v));

  const { error: delErr } = await supabase
    .from('vendor_service_agents')
    .delete()
    .eq('vendor_team_member_id', memberIdRaw);
  if (delErr) return err(delErr.message);
  if (selected.length > 0) {
    const { error: insErr } = await supabase.from('vendor_service_agents').insert(
      selected.map((vendor_service_id) => ({
        vendor_service_id,
        vendor_team_member_id: memberIdRaw,
      })),
    );
    if (insErr) return err(insErr.message);
  }

  revalidatePath(TEAM);
  redirect(`${TEAM}?saved=1`);
}

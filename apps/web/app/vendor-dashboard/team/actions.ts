'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revokeAllSessions } from '@/lib/force-logout';
import { createAdminClient } from '@/lib/supabase/admin';
import { VENDOR_TEAM_ROLES, type VendorTeamRole } from '@/lib/vendor-team';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';

const ROLE_SET: ReadonlySet<string> = new Set(VENDOR_TEAM_ROLES);

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

async function ensureOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // Team management is OWNER-only in V1 (vendor_team_members write RLS is
  // owner-scoped). Resolve the OWNED profile directly — NOT the now
  // member-aware fetchOwnVendorProfile — so a non-owner member (admin/agent)
  // can't reach team management.
  const { data: profile } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, tier_state')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile, currentUserId: user.id };
}

/**
 * V1 invite: only existing users by email. Looks up the user via the admin
 * client (RLS on public.users is per-user), then inserts a vendor_team_members
 * row. If the email doesn't match any account, we error back to the form
 * with a friendly message — couples / vendors / admins can all be added.
 */
export async function inviteVendorTeamMember(formData: FormData) {
  const { supabase, profile } = await ensureOwner();

  const emailRaw = formData.get('email');
  const labelRaw = formData.get('team_label');
  let role: VendorTeamRole;
  try {
    role = parseRole(formData.get('role'));
  } catch (e) {
    return redirect(
      `/vendor-dashboard/team?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  if (typeof emailRaw !== 'string' || emailRaw.trim().length === 0) {
    return redirect('/vendor-dashboard/team?error=Email+is+required');
  }
  const email = emailRaw.trim().toLowerCase();
  const team_label = nullIfBlank(labelRaw);

  // Only Owner can promote another user to Owner. In V1 the Owner is the
  // user_id on the vendor_profiles row; we don't allow a second Owner.
  if (role === 'owner') {
    return redirect(
      '/vendor-dashboard/team?error=Owner+role+is+reserved+for+the+profile+creator',
    );
  }

  // Tier seat cap (Phase B · Vendor_Tier_Capability_Matrix_2026-06-07): agent
  // accounts = FREE 0 · VERIFIED 1 · PRO 3 · ENTERPRISE ∞. Count existing
  // non-owner seats and block when the allowance is reached.
  const seatCap = tierCaps(asVendorTier(profile.tier_state)).agentAccounts;
  if (seatCap !== Infinity) {
    const { count: seatCount } = await supabase
      .from('vendor_team_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .neq('role', 'owner');
    if ((seatCount ?? 0) >= seatCap) {
      const msg =
        seatCap === 0
          ? 'Agent accounts need a paid plan. Get verified or upgrade to add team members.'
          : `You've reached your plan's limit of ${seatCap} agent account${seatCap === 1 ? '' : 's'}. Upgrade for more seats.`;
      return redirect(`/vendor-dashboard/team?error=${encodeURIComponent(msg)}`);
    }
  }

  // Look up the target user by email via the admin client (RLS on
  // public.users restricts to self).
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from('users')
    .select('user_id')
    .eq('email', email)
    .maybeSingle();
  if (lookupError) {
    return redirect(
      `/vendor-dashboard/team?error=${encodeURIComponent(lookupError.message)}`,
    );
  }
  if (!existing) {
    return redirect(
      '/vendor-dashboard/team?error=No+Setnayan+account+with+that+email.+Ask+them+to+sign+up+first.',
    );
  }

  const { error } = await supabase.from('vendor_team_members').insert({
    vendor_profile_id: profile.vendor_profile_id,
    user_id: existing.user_id,
    role,
    team_label,
  });
  if (error) {
    const message =
      error.code === '23505'
        ? 'That user is already on your team.'
        : error.message;
    return redirect(`/vendor-dashboard/team?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/vendor-dashboard/team');
  redirect('/vendor-dashboard/team?invited=1');
}

export async function updateVendorTeamMember(formData: FormData) {
  const { supabase, profile, currentUserId } = await ensureOwner();

  const idRaw = formData.get('vendor_team_member_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect('/vendor-dashboard/team?error=Missing+member+id');
  }

  let role: VendorTeamRole;
  try {
    role = parseRole(formData.get('role'));
  } catch (e) {
    return redirect(
      `/vendor-dashboard/team?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  const team_label = nullIfBlank(formData.get('team_label'));

  // Fetch the row first so we can enforce "can't modify self" and
  // "Owner role is immutable" rules at the action layer.
  const { data: target, error: readErr } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id,user_id,role')
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (readErr) {
    return redirect(
      `/vendor-dashboard/team?error=${encodeURIComponent(readErr.message)}`,
    );
  }
  if (!target) {
    return redirect('/vendor-dashboard/team?error=Member+not+found');
  }
  if (target.user_id === currentUserId) {
    return redirect('/vendor-dashboard/team?error=You+cannot+change+your+own+role');
  }
  if (target.role === 'owner' || role === 'owner') {
    return redirect(
      '/vendor-dashboard/team?error=Owner+role+is+reserved+for+the+profile+creator',
    );
  }

  const { error } = await supabase
    .from('vendor_team_members')
    .update({ role, team_label, updated_at: new Date().toISOString() })
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `/vendor-dashboard/team?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/team');
  redirect('/vendor-dashboard/team?saved=1');
}

export async function removeVendorTeamMember(formData: FormData) {
  const { supabase, profile, currentUserId } = await ensureOwner();

  const idRaw = formData.get('vendor_team_member_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect('/vendor-dashboard/team?error=Missing+member+id');
  }

  const { data: target } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id,user_id,role')
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (!target) {
    return redirect('/vendor-dashboard/team?error=Member+not+found');
  }
  if (target.role === 'owner') {
    return redirect('/vendor-dashboard/team?error=Cannot+remove+the+Owner');
  }
  if (target.user_id === currentUserId) {
    return redirect('/vendor-dashboard/team?error=You+cannot+remove+yourself');
  }

  const { error } = await supabase
    .from('vendor_team_members')
    .delete()
    .eq('vendor_team_member_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `/vendor-dashboard/team?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Offboarding ends the login too: revoke the removed member's auth sessions
  // on every device (their vendor-data access already died via the per-request
  // current_vendor_ids check; this clears a possibly-shared shop device).
  // Best-effort in the background — removal never fails on a revoke hiccup.
  // Note: if this person is ALSO a couple/customer account, they're signed out
  // of that too and simply log back in.
  const removedUserId = target.user_id as string;
  after(() => revokeAllSessions(removedUserId).catch(() => {}));

  revalidatePath('/vendor-dashboard/team');
  redirect('/vendor-dashboard/team?saved=1');
}

/**
 * Phase 2a — set which services an agent is assigned to. Replaces the member's
 * assignment rows with the submitted selection. Owner/admin only (enforced by
 * RLS on vendor_service_agents via current_vendor_ids('admin')); the action
 * also clamps the selection to the vendor's own services defensively.
 */
export async function setVendorAgentServices(formData: FormData) {
  const { supabase, profile } = await ensureOwner();

  const memberIdRaw = formData.get('vendor_team_member_id');
  if (typeof memberIdRaw !== 'string' || memberIdRaw.length === 0) {
    return redirect('/vendor-dashboard/team?error=Missing+member+id');
  }

  // The member must belong to THIS vendor.
  const { data: member } = await supabase
    .from('vendor_team_members')
    .select('vendor_team_member_id')
    .eq('vendor_team_member_id', memberIdRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (!member) {
    return redirect('/vendor-dashboard/team?error=Member+not+found');
  }

  // Clamp the submitted ids to the vendor's own services.
  const { data: services } = await supabase
    .from('vendor_services')
    .select('vendor_service_id')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  const valid = new Set(
    (services ?? []).map((s) => (s as { vendor_service_id: string }).vendor_service_id),
  );
  const selected = formData
    .getAll('service_ids')
    .filter((v): v is string => typeof v === 'string' && valid.has(v));

  // Replace this member's assignments: clear, then insert the selection.
  const { error: delErr } = await supabase
    .from('vendor_service_agents')
    .delete()
    .eq('vendor_team_member_id', memberIdRaw);
  if (delErr) {
    return redirect(`/vendor-dashboard/team?error=${encodeURIComponent(delErr.message)}`);
  }
  if (selected.length > 0) {
    const { error: insErr } = await supabase.from('vendor_service_agents').insert(
      selected.map((vendor_service_id) => ({
        vendor_service_id,
        vendor_team_member_id: memberIdRaw,
      })),
    );
    if (insErr) {
      return redirect(`/vendor-dashboard/team?error=${encodeURIComponent(insErr.message)}`);
    }
  }

  revalidatePath('/vendor-dashboard/team');
  redirect('/vendor-dashboard/team?saved=1');
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { VENDOR_TEAM_ROLES, type VendorTeamRole } from '@/lib/vendor-team';

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
  const profile = await fetchOwnVendorProfile(supabase, user.id);
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

  revalidatePath('/vendor-dashboard/team');
  redirect('/vendor-dashboard/team?saved=1');
}

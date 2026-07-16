'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateCommunityInviteToken,
    type CommunityRole,
} from '@/lib/communities';

// Samahan (Communities) — server actions for the minimal cut (PR-2 of 4).
// Spec: Samahan_Minimal_Build_Plan_2026-07-15.md §3. Redirect-with-error-param
// validation style copied from createWeddingEvent (create-event/actions.ts).
//
// Client posture per verb:
//   • createCommunity — admin client for all three inserts (create-event
//     precedent: the user JWT can be stale at the edge; the action has
//     already authenticated the user).
//   • member/role/token/archive verbs — USER-scoped client so RLS is the
//     enforcement layer (organizer-only policies), with app-side re-checks
//     for the last-organizer guard that RLS can't express.

/** The caller's membership row in a community (id + role), or null. */
async function fetchSelfMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  communityId: string,
  userId: string,
): Promise<{ id: number; role: CommunityRole } | null> {
  const { data } = await supabase
    .from('community_members')
    .select('id, role')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { id: number; role: CommunityRole } | null) ?? null;
}

/** Organizer + total member counts for the guard checks (admin client —
 *  counts must be authoritative even mid-request). */
async function fetchMemberCounts(
  admin: ReturnType<typeof createAdminClient>,
  communityId: string,
): Promise<{ organizers: number; members: number }> {
  const { data } = await admin
    .from('community_members')
    .select('role')
    .eq('community_id', communityId);
  const rows = (data ?? []) as Array<{ role: CommunityRole }>;
  return {
    organizers: rows.filter((r) => r.role === 'organizer').length,
    members: rows.length,
  };
}

export async function createCommunity(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (name.length < 2 || name.length > 80) {
    redirect('/dashboard/samahan/new?error=missing_name');
  }
  if (description.length > 280) {
    redirect('/dashboard/samahan/new?error=description_too_long');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=%2Fdashboard%2Fsamahan%2Fnew');
  }

  // Admin client for the insert chain (create-event precedent: the user JWT
  // can be stale at the edge — RLS would reject an insert the action already
  // authorized). created_by is stamped as the authenticated caller.
  const admin = createAdminClient();
  const { data: inserted, error: insertError } = await admin
    .from('communities')
    .insert({
      name,
      description: description || null,
      created_by: user.id,
    })
    .select('community_id')
    .single();
  if (insertError || !inserted) {
    redirect(
      `/dashboard/samahan/new?error=${encodeURIComponent(insertError?.message ?? 'unknown')}`,
    );
  }
  const communityId = (inserted as { community_id: string }).community_id;

  const { error: memberError } = await admin.from('community_members').insert({
    community_id: communityId,
    user_id: user.id,
    role: 'organizer',
  });
  if (memberError) {
    redirect(
      `/dashboard/samahan/new?error=${encodeURIComponent('member_link_failed: ' + memberError.message)}`,
    );
  }

  // The standing invite link, minted at create (plan §6). Non-fatal on error —
  // the organizer panel's "Rotate link" self-heals a missing row via upsert.
  const { error: tokenError } = await admin
    .from('community_invite_tokens')
    .insert({
      community_id: communityId,
      token: generateCommunityInviteToken(),
      created_by: user.id,
    });
  if (tokenError) {
    console.error('[createCommunity] invite token insert failed', tokenError.message);
  }

  revalidatePath('/dashboard/samahan');
  redirect(`/dashboard/samahan/${communityId}?created=1`);
}

export async function leaveCommunity(formData: FormData) {
  const communityId = String(formData.get('community_id') ?? '');
  if (!communityId) redirect('/dashboard/samahan');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=%2Fdashboard%2Fsamahan');

  const self = await fetchSelfMembership(supabase, communityId, user.id);
  if (!self) redirect('/dashboard/samahan');

  const admin = createAdminClient();
  const counts = await fetchMemberCounts(admin, communityId);

  // Last-organizer guard (plan §3): a sole organizer can't abandon a samahan
  // that still has other members — promote someone first, or archive it.
  if (self.role === 'organizer' && counts.organizers === 1 && counts.members > 1) {
    redirect(
      `/dashboard/samahan/${communityId}?tab=members&error=last_organizer`,
    );
  }

  // User-scoped DELETE of own row (RLS community_member_leave_or_remove).
  const { error } = await supabase
    .from('community_members')
    .delete()
    .eq('id', self.id);
  if (error) {
    redirect(
      `/dashboard/samahan/${communityId}?tab=members&error=${encodeURIComponent(error.message)}`,
    );
  }

  // Sole member walking away: archive so the community goes quiet instead of
  // lingering as an unreachable orphan row (soft-archive-only lifecycle).
  if (counts.members === 1) {
    await admin
      .from('communities')
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq('community_id', communityId);
  }

  revalidatePath('/dashboard/samahan');
  redirect('/dashboard/samahan?left=1');
}

/** Shared organizer-verb plumbing: auth → organizer check → target row. */
async function organizerActionContext(formData: FormData) {
  const communityId = String(formData.get('community_id') ?? '');
  const memberRowId = Number(formData.get('member_row_id') ?? NaN);
  if (!communityId || !Number.isInteger(memberRowId)) {
    redirect('/dashboard/samahan');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=%2Fdashboard%2Fsamahan');

  const self = await fetchSelfMembership(supabase, communityId, user.id);
  // RLS enforces organizer-only writes regardless; this early exit gives a
  // clean redirect instead of a silent 0-row update.
  if (!self || self.role !== 'organizer') {
    redirect(`/dashboard/samahan/${communityId}?tab=members`);
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('community_members')
    .select('id, role, community_id')
    .eq('id', memberRowId)
    .eq('community_id', communityId)
    .maybeSingle();
  if (!target) {
    redirect(`/dashboard/samahan/${communityId}?tab=members&error=member_gone`);
  }

  return {
    supabase,
    admin,
    communityId,
    target: target as { id: number; role: CommunityRole; community_id: string },
  };
}

export async function promoteMember(formData: FormData) {
  const { supabase, communityId, target } = await organizerActionContext(formData);
  if (target.role !== 'organizer') {
    // User-scoped UPDATE — RLS community_member_role_update authorizes it.
    const { error } = await supabase
      .from('community_members')
      .update({ role: 'organizer' })
      .eq('id', target.id);
    if (error) {
      redirect(
        `/dashboard/samahan/${communityId}?tab=members&error=${encodeURIComponent(error.message)}`,
      );
    }
  }
  revalidatePath(`/dashboard/samahan/${communityId}`);
  redirect(`/dashboard/samahan/${communityId}?tab=members`);
}

export async function demoteMember(formData: FormData) {
  const { supabase, admin, communityId, target } =
    await organizerActionContext(formData);
  if (target.role === 'organizer') {
    const counts = await fetchMemberCounts(admin, communityId);
    // A samahan must always keep at least one organizer.
    if (counts.organizers === 1) {
      redirect(
        `/dashboard/samahan/${communityId}?tab=members&error=last_organizer`,
      );
    }
    const { error } = await supabase
      .from('community_members')
      .update({ role: 'member' })
      .eq('id', target.id);
    if (error) {
      redirect(
        `/dashboard/samahan/${communityId}?tab=members&error=${encodeURIComponent(error.message)}`,
      );
    }
  }
  revalidatePath(`/dashboard/samahan/${communityId}`);
  redirect(`/dashboard/samahan/${communityId}?tab=members`);
}

export async function removeMember(formData: FormData) {
  const { supabase, admin, communityId, target } =
    await organizerActionContext(formData);
  if (target.role === 'organizer') {
    const counts = await fetchMemberCounts(admin, communityId);
    if (counts.organizers === 1) {
      redirect(
        `/dashboard/samahan/${communityId}?tab=members&error=last_organizer`,
      );
    }
  }
  const { error } = await supabase
    .from('community_members')
    .delete()
    .eq('id', target.id);
  if (error) {
    redirect(
      `/dashboard/samahan/${communityId}?tab=members&error=${encodeURIComponent(error.message)}`,
    );
  }
  revalidatePath(`/dashboard/samahan/${communityId}`);
  redirect(`/dashboard/samahan/${communityId}?tab=members&removed=1`);
}

export async function rotateInviteToken(formData: FormData) {
  const communityId = String(formData.get('community_id') ?? '');
  if (!communityId) redirect('/dashboard/samahan');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=%2Fdashboard%2Fsamahan');

  const self = await fetchSelfMembership(supabase, communityId, user.id);
  if (!self || self.role !== 'organizer') {
    redirect(`/dashboard/samahan/${communityId}`);
  }

  // One row per community (UNIQUE community_id): overwriting `token` is what
  // kills the old link — rotation IS the kill switch (plan §6). Upsert also
  // self-heals a community whose create-time token insert failed. Organizer
  // RLS (invite_tokens_organizer_all) authorizes the user-scoped write.
  const { error } = await supabase.from('community_invite_tokens').upsert(
    {
      community_id: communityId,
      token: generateCommunityInviteToken(),
      created_by: user.id,
      revoked_at: null,
    },
    { onConflict: 'community_id' },
  );
  if (error) {
    redirect(
      `/dashboard/samahan/${communityId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/samahan/${communityId}`);
  redirect(`/dashboard/samahan/${communityId}?rotated=1`);
}

export async function archiveCommunity(formData: FormData) {
  const communityId = String(formData.get('community_id') ?? '');
  if (!communityId) redirect('/dashboard/samahan');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=%2Fdashboard%2Fsamahan');

  const self = await fetchSelfMembership(supabase, communityId, user.id);
  if (!self || self.role !== 'organizer') {
    redirect(`/dashboard/samahan/${communityId}`);
  }

  // User-scoped UPDATE — RLS organizer_can_update_community authorizes it.
  const { error } = await supabase
    .from('communities')
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq('community_id', communityId);
  if (error) {
    redirect(
      `/dashboard/samahan/${communityId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/dashboard/samahan');
  redirect('/dashboard/samahan?archived=1');
}

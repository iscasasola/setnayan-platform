'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPendingCommunityInvite } from '@/lib/communities';

// Samahan invite accept — mirrors /host/accept/[token]'s choreography
// (plan §6), with two deliberate differences:
//   • the token is NOT cleared on accept — it's a STANDING group link
//     (organizers paste one link into the group chat); rotation is the
//     kill switch.
//   • no email-match check — there is no invitee email; the token is the
//     whole secret.
// Membership INSERT goes through the admin client (community_members has no
// user INSERT policy on purpose — event_join_tokens service-role-redemption
// precedent).

export async function acceptCommunityInvite(formData: FormData) {
  const token = formData.get('token');
  if (typeof token !== 'string' || token.length < 32) {
    redirect('/');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/samahan/join/${token}`)}`);
  }

  const admin = createAdminClient();
  const resolution = await fetchPendingCommunityInvite(admin, token as string);
  if (resolution.status !== 'ok') {
    // The page re-resolves the token and renders the honest terminal card.
    redirect(`/samahan/join/${token}`);
  }
  const invite = resolution.invite;

  // Already a member? Land on the space with the ?already banner.
  const { data: existing } = await admin
    .from('community_members')
    .select('id')
    .eq('community_id', invite.community_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) {
    redirect(`/dashboard/samahan/${invite.community_id}?already=1`);
  }

  // Admin-client upsert (accept-host precedent) — ignoreDuplicates makes a
  // double-submit race land as "already a member", never an error.
  const { error } = await admin.from('community_members').upsert(
    {
      community_id: invite.community_id,
      user_id: user.id,
      role: 'member',
    },
    { onConflict: 'community_id,user_id', ignoreDuplicates: true },
  );
  if (error) {
    redirect(
      `/samahan/join/${token}?error=${encodeURIComponent(error.message.slice(0, 80))}`,
    );
  }

  revalidatePath('/dashboard/samahan');
  revalidatePath(`/dashboard/samahan/${invite.community_id}`);
  redirect(`/dashboard/samahan/${invite.community_id}?joined=1`);
}

'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPendingCommunityInvite } from '@/lib/communities';
import { notifySamahanCoMembers } from '@/lib/samahan-notify';

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

  /*
   * DAY-21 · TELL THE PEOPLE ALREADY IN THE ROOM. Until now a samahan announced
   * what was POSTED and never who ARRIVED: the whole fan-out existed, and
   * joining was not one of its kinds.
   *
   * 🔑 IT MUST SIT ABOVE THE `redirect`, AND THAT IS NOT STYLE. `redirect()`
   * throws a control-flow error — anything after it is unreachable, so an
   * `after()` registered below would never be registered at all. `after` itself
   * is still what defers the work past the response, exactly as
   * `postSamahanMessage` does it, so a slow fan-out cannot hold up the person
   * landing in their new samahan.
   *
   * 🔑 AND IT SITS BELOW THE `existing` GUARD ABOVE, WHICH IS WHAT KEEPS IT
   * HONEST. That branch redirects an already-joined member with `?already=1`
   * before reaching here, so re-opening a standing group link cannot announce
   * the same person twice. The `ignoreDuplicates` upsert would have swallowed
   * the row silently and still reported success — a "joined" notice for
   * somebody who joined last month is exactly the kind of true-shaped, wrong
   * sentence this feature exists to stop.
   *
   * Best-effort by construction: `notifySamahanCoMembers` never throws and
   * never undoes the membership that has already landed.
   */
  after(() =>
    notifySamahanCoMembers({
      communityId: invite.community_id,
      actorUserId: user.id,
      kind: 'join',
    }),
  );

  revalidatePath('/dashboard/samahan');
  revalidatePath(`/dashboard/samahan/${invite.community_id}`);
  redirect(`/dashboard/samahan/${invite.community_id}?joined=1`);
}

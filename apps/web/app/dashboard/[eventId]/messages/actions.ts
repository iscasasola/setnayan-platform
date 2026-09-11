'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { lookupExistingVendorByEmail } from '@/lib/vendor-invites';
import { fetchThreadById } from '@/lib/chat';
import { isFollowingVendor } from '@/lib/follow';
import { followVendor } from '@/lib/follow-actions';

/**
 * Withdraw a couple-side inquiry / remove a vendor (inquiry-followthrough
 * 2026-06-16). ARCHIVE, NOT DELETE (2026-07-24): the conversation is the
 * dispute/evidence record + the source of the couple-confirmed booking amount,
 * so it must never be destroyed by a user. This stamps
 * `chat_threads.archived_at` (migration 20270926679942) instead of hard-
 * deleting the thread — the thread + every message is preserved, just folded
 * out of the couple's ACTIVE list into the "Archived" section (re-openable).
 * Re-adding the vendor NULLs archived_at and resumes THIS thread (the
 * UNIQUE(event_id, vendor_profile_id) upsert in startThreadByVendorEmail /
 * submitInquiry), so no history is orphaned.
 *
 * RLS: the couple passes `chat_threads_member_update` via
 * `current_couple_event_ids()`, so the archive UPDATE is RLS-safe. As of
 * 20270926679942 there is NO DELETE policy on chat_threads — a hard delete
 * would be denied anyway; the archive is the only remove available to a user.
 * We keep the `thread.event_id === eventId` re-check as defense-in-depth so a
 * thread can only be withdrawn from its own event surface. Fail-soft: a missing
 * thread (RLS-invisible / already archived) just redirects back to the list.
 * Idempotent — re-archiving an already-archived thread is a harmless re-stamp.
 */
export async function withdrawInquiry(formData: FormData) {
  const eventId = formData.get('event_id');
  const threadId = formData.get('thread_id');
  if (typeof eventId !== 'string' || typeof threadId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Scope-check: the thread must exist (RLS-visible to this couple) and belong
  // to this event. A null thread means it's gone/invisible — fall through to
  // the list rather than erroring.
  const thread = await fetchThreadById(supabase, threadId);
  if (thread && thread.event_id === eventId) {
    const { error } = await supabase
      .from('chat_threads')
      .update({ archived_at: new Date().toISOString() })
      .eq('thread_id', threadId)
      .eq('event_id', eventId);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}/messages`);
  redirect(`/dashboard/${eventId}/messages`);
}

export async function startThreadByVendorEmail(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorEmail = formData.get('vendor_email');
  if (typeof eventId !== 'string' || typeof vendorEmail !== 'string') {
    throw new Error('Invalid input');
  }
  const email = vendorEmail.trim().toLowerCase();
  if (email.length === 0) {
    return redirect(
      `/dashboard/${eventId}/messages?error=${encodeURIComponent('Vendor email is required')}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Find the vendor profile whose CONTACT email matches. We deliberately
  // don't look up auth users by email — that requires admin privileges and
  // leaks signup status.
  //
  // 🔒 A shop's contact email is no longer readable by a browser session
  // (20271221366210) — not even as a filter, which Postgres checks exactly like
  // a projection. So the match runs on the service role through the ONE shared
  // lookup, which re-states the public-read row rule, matches the address
  // exactly (no ILIKE wildcards) and answers only the shop's id and name.
  const vendor = await lookupExistingVendorByEmail(createAdminClient(), email);
  if (!vendor) {
    return redirect(
      `/dashboard/${eventId}/messages?error=${encodeURIComponent('No Setnayan vendor with that contact email.')}`,
    );
  }

  // Iteration 0019 § Gate — a couple must FOLLOW before a thread can be
  // inserted. That gate is a restrictive INSERT policy on `chat_threads`, so it
  // is real and it is enforced in the database; nothing here removes it. An
  // existing thread (same event_id + vendor_profile_id) is exempt because the
  // upsert below resolves to UPDATE not INSERT, which the policy does not gate.
  //
  // ── WHAT CHANGED, AND WHY IT IS NOT A LOOSENING (owner 2026-09-08) ────────
  // *"message can message even if not followed."* This used to REFUSE and
  // redirect with `next_action=follow`, so a couple who pressed Message was
  // sent back to press a heart and then press Message again. On the explore
  // card that surfaced as a greyed-out button captioned "Follow to message" —
  // a puzzle whose answer was a different button, sitting next to a bookmark
  // that means something else entirely.
  //
  // 🔑 THE OTHER DOOR ALREADY DID THIS. `app/v/[slug]/inquiry-actions.ts` lists
  // its steps as "…2. follow the vendor (satisfies the iteration 0019
  // follow-gate RLS)" — the inquiry path has always followed on the couple's
  // behalf. The two doors disagreed, and this one was the odd one.
  //
  // So: pressing Message IS the couple declaring interest. We record the follow
  // the gate asks for and continue. The gate still holds — the row exists before
  // the INSERT — it just is not a riddle any more. Retiring the requirement
  // itself would need a migration against that RLS policy and a decision logged
  // against Iteration 0019; that is deliberately NOT what this does.
  const following = await isFollowingVendor(supabase, user.id, vendor.vendor_profile_id);
  if (!following) {
    const followed = await followVendor(vendor.vendor_profile_id);
    // Fail LOUD, not silently: without the follow the INSERT below is refused
    // by RLS, and a swallowed failure here would surface as an unexplained
    // "could not start the thread" one step later.
    if (!followed.ok) {
      return redirect(
        `/dashboard/${eventId}/messages?error=${encodeURIComponent(
          `Could not start a thread with ${vendor.business_name}: ${followed.message}`,
        )}`,
      );
    }
  }

  // Upsert by the (event_id, vendor_profile_id) UNIQUE pair so re-tapping
  // "Start thread" just resumes the existing one. `archived_at: null` un-
  // archives a previously-removed thread so re-adding the vendor RESUMES the
  // preserved conversation rather than leaving it stranded in "Archived"
  // (fresh INSERTs default to NULL, so this is a no-op there).
  const { data: thread, error: insertErr } = await supabase
    .from('chat_threads')
    .upsert(
      {
        event_id: eventId,
        vendor_profile_id: vendor.vendor_profile_id,
        created_by_user_id: user.id,
        archived_at: null,
      },
      { onConflict: 'event_id,vendor_profile_id' },
    )
    .select('thread_id')
    .single();

  if (insertErr || !thread) {
    return redirect(
      `/dashboard/${eventId}/messages?error=${encodeURIComponent(insertErr?.message ?? 'Could not start thread')}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/messages`);
  redirect(`/dashboard/${eventId}/messages/${thread.thread_id}`);
}

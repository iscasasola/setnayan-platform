'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchThreadById } from '@/lib/chat';
import { isFollowingVendor } from '@/lib/follow';

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
  // leaks signup status. Vendors expose contact_email publicly on their
  // profile, so couples search by that.
  const { data: vendor, error: vendorErr } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .ilike('contact_email', email)
    .maybeSingle();

  if (vendorErr) {
    return redirect(
      `/dashboard/${eventId}/messages?error=${encodeURIComponent(vendorErr.message)}`,
    );
  }
  if (!vendor) {
    return redirect(
      `/dashboard/${eventId}/messages?error=${encodeURIComponent('No Setnayan vendor with that contact email.')}`,
    );
  }

  // Iteration 0019 § Gate — couple must follow the vendor before opening a
  // new thread. An existing thread (same event_id + vendor_profile_id) is
  // exempt because the upsert below resolves to UPDATE not INSERT, which
  // the restrictive INSERT RLS policy does not gate.
  const following = await isFollowingVendor(supabase, user.id, vendor.vendor_profile_id);
  if (!following) {
    return redirect(
      `/dashboard/${eventId}/messages?error=${encodeURIComponent(
        `Follow ${vendor.business_name} first, then start the thread.`,
      )}&next_action=follow&vendor_profile_id=${vendor.vendor_profile_id}`,
    );
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

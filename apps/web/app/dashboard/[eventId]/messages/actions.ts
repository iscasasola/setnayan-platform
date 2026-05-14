'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isFollowingVendor } from '@/lib/follow';

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
  // "Start thread" just resumes the existing one.
  const { data: thread, error: insertErr } = await supabase
    .from('chat_threads')
    .upsert(
      {
        event_id: eventId,
        vendor_profile_id: vendor.vendor_profile_id,
        created_by_user_id: user.id,
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

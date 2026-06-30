'use server';

/**
 * Vendor → couple invite claim action. The couple, signed in, picks one of
 * their events and the vendor (resolved from the public business_slug in the
 * QR) is imported into that event's Explore shortlist. Owner-locked flow
 * 2026-06-30 — see lib/vendor-couple-invite.ts.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  importVendorToEventShortlist,
  listHostEvents,
} from '@/lib/vendor-couple-invite';

function backToInvite(slug: string, status: string): never {
  redirect(`/vendor-invite/${encodeURIComponent(slug)}?status=${status}`);
}

export async function claimVendorInviteToEvent(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '').trim();
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!slug) redirect('/');
  if (!eventId) backToInvite(slug, 'pick_event');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Round-trip through sign-in, then back to the invite page.
    redirect(`/signup?as=couple&next=${encodeURIComponent(`/vendor-invite/${slug}`)}`);
  }

  const admin = createAdminClient();

  // Resolve the vendor from the public slug (published profiles only).
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, is_published')
    .eq('business_slug', slug)
    .maybeSingle();
  if (!vendor || !vendor.is_published) backToInvite(slug, 'not_found');

  // Ownership: the chosen event must be one the user actually hosts.
  const hostEvents = await listHostEvents(admin, user!.id);
  if (!hostEvents.some((e) => e.event_id === eventId)) {
    backToInvite(slug, 'not_your_event');
  }

  const result = await importVendorToEventShortlist(admin, {
    eventId,
    vendorProfileId: vendor!.vendor_profile_id,
    pickedBy: user!.id,
  });

  if (result.status === 'error') backToInvite(slug, 'error');
  if (result.status === 'vendor_not_found') backToInvite(slug, 'not_found');

  // Success (new or already-saved) → land the couple on that event's vendor
  // shortlist so they immediately see the vendor they just added.
  revalidatePath(`/dashboard/${eventId}/vendors`);
  redirect(
    `/dashboard/${eventId}/vendors?invited=${result.status === 'already_saved' ? 'already' : '1'}`,
  );
}

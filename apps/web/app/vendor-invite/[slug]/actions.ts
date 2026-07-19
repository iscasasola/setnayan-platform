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

function backToInvite(slug: string, status: string, scope = ''): never {
  const sep = scope ? `&${scope}` : '';
  redirect(`/vendor-invite/${encodeURIComponent(slug)}?status=${status}${sep}`);
}

export async function claimVendorInviteToEvent(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '').trim();
  const eventId = String(formData.get('event_id') ?? '').trim();
  const cat = String(formData.get('cat') ?? '').trim();
  const et = String(formData.get('et') ?? '').trim();
  if (!slug) redirect('/');

  // Preserve the QR's event/service scope across any bounce-back redirect.
  const scopeParams = new URLSearchParams();
  if (et) scopeParams.set('et', et);
  if (cat) scopeParams.set('cat', cat);
  const scope = scopeParams.toString();

  if (!eventId) backToInvite(slug, 'pick_event', scope);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Round-trip through sign-in, then back to the (scoped) invite page.
    const next = `/vendor-invite/${slug}${scope ? `?${scope}` : ''}`;
    redirect(`/signup?as=couple&next=${encodeURIComponent(next)}`);
  }

  const admin = createAdminClient();

  // Resolve the vendor from the public slug (published profiles only).
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, is_published')
    .eq('business_slug', slug)
    .maybeSingle();
  if (!vendor || !vendor.is_published) backToInvite(slug, 'not_found', scope);

  // Ownership: the chosen event must be one the user actually hosts.
  const hostEvents = await listHostEvents(admin, user!.id);
  if (!hostEvents.some((e) => e.event_id === eventId)) {
    backToInvite(slug, 'not_your_event', scope);
  }

  const result = await importVendorToEventShortlist(admin, {
    eventId,
    vendorProfileId: vendor!.vendor_profile_id,
    pickedBy: user!.id,
    categoryOverride: cat || null,
  });

  if (result.status === 'error') backToInvite(slug, 'error', scope);
  if (result.status === 'vendor_not_found') backToInvite(slug, 'not_found', scope);

  // Success (new or already-saved) → land the couple on that event's vendor
  // shortlist so they immediately see the vendor they just added.
  revalidatePath(`/dashboard/${eventId}/vendors`);
  redirect(
    `/dashboard/${eventId}/vendors?invited=${result.status === 'already_saved' ? 'already' : '1'}`,
  );
}

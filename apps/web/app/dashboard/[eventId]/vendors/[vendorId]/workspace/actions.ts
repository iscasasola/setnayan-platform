'use server';

// ============================================================================
// /dashboard/[eventId]/vendors/[vendorId]/workspace/actions.ts
//
// Server actions for the per-service workspace page.
//
// createAutoShareInviteAction — explicitly generates the auto-share claim link
//   for a manual (off-platform) vendor the host has locked. This REPLACES the
//   prior render-time self-heal: generating an invite is a write, and a server-
//   component GET render (including Next.js prefetch) must never write. The
//   workspace page now renders a "Create a shareable invite link" button that
//   posts here instead.
//
// (The previous advanceWorkspaceStatus / advanceWorkspaceStatusForm exports were
//  removed — they had zero callers and the status stepper is driven off the
//  vendor_status enum, so workspace_status was never written.)
//
// Auth: gate on signed-in user, then rely on RLS — ensureAutoShareInvite runs
// under the host's session client, which can only touch their own event_vendors
// rows.
// ============================================================================

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureAutoShareInvite } from '@/lib/vendor-invites';

/**
 * Idempotently create (or re-read) the auto-share claim link for a locked
 * manual vendor. Form-only — returns void and revalidates so the freshly
 * created link renders on the next paint. Silently no-ops on bad input; the
 * unique index in ensureAutoShareInvite makes repeat submits safe.
 */
export async function createAutoShareInviteAction(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const businessName = formData.get('business_name');
  const category = formData.get('category');

  if (typeof eventId !== 'string' || typeof vendorId !== 'string') return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await ensureAutoShareInvite(supabase, {
    eventVendorId: vendorId,
    invitedByUserId: user.id,
    businessName:
      typeof businessName === 'string' && businessName.trim().length > 0
        ? businessName.trim()
        : 'Vendor',
    serviceCategory: typeof category === 'string' && category.length > 0 ? category : null,
  });

  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}

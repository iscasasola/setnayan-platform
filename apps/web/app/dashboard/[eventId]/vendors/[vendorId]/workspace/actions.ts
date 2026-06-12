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
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';

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

// ============================================================================
// updateHostServiceDetails (2026-06-11 · dual-path DIY parity, owner doctrine:
// "add information about their order… place… what's included on their
// service. link other services to it as well.")
//
// The host describes a MANUAL (off-platform) vendor's package: free-text
// inclusion lines + "also covers" plan-group links. Marketplace rows keep
// their vendor-authored sources (vendor_package_items / vendor_service_links)
// — the update is hard-scoped to manual rows so there are never two sources
// of truth on a connected vendor. RLS scopes the write to the host's own
// event; the extra predicates here just make the manual-only rule explicit.
// ============================================================================

const MAX_INCLUSIONS = 20;
const MAX_INCLUSION_LEN = 120;

export async function updateHostServiceDetails(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof vendorId !== 'string' ||
    vendorId.length === 0
  ) {
    throw new Error('Invalid input');
  }

  // "What's included" — one line per inclusion, trimmed, deduped, capped.
  const rawInclusions = formData.get('inclusions');
  const inclusions = [
    ...new Set(
      (typeof rawInclusions === 'string' ? rawInclusions : '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.slice(0, MAX_INCLUSION_LEN)),
    ),
  ].slice(0, MAX_INCLUSIONS);

  // "Also covers" — validated against the canonical plan groups so the column
  // never stores an off-registry id.
  const validGroups = new Set<string>(PLAN_GROUPS.map((g) => g.id as string));
  const covers = [
    ...new Set(
      formData
        .getAll('covers')
        .filter((c): c is string => typeof c === 'string' && validGroups.has(c)),
    ),
  ];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_vendors')
    .update({ host_inclusions: inclusions, covers_plan_groups: covers })
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .not('manual_vendor_id', 'is', null)
    .is('marketplace_vendor_id', null);
  if (error) throw new Error(error.message);

  // 'layout' on /vendors so the Shortlist card chips + Compare inclusions
  // pick up the new covers/inclusions on the next paint.
  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}

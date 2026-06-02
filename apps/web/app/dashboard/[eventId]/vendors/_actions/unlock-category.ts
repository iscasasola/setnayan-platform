'use server';

/**
 * unlockCategoryWithInquiry — "add a category" from the Unlock-more-categories
 * page (owner 2026-06-02).
 *
 * The customer Vendors page shows ONLY categories the couple has a vendor in
 * (active = has ≥1 pick). Adding a category here must therefore land at least
 * one vendor so the category becomes active AND so "every category they add has
 * at least 1 vendor inquired" (owner). We:
 *
 *   1. Pick the BEST-FIT vendor — the top of the locked tier ladder
 *      (Favorites → Boosted → Top-rated → Nearest), hard-scoped to the group's
 *      canonical services, via searchCategoryVendors().
 *   2. Add them to the couple's picks (event_vendors 'considering') → the
 *      category is now active and renders on the Vendors page.
 *   3. Fire a real inquiry: follow the vendor (satisfies the iteration 0019
 *      follow-gate RLS) → open the chat thread → post the first couple message
 *      (a booking inquiry that lands in the vendor's inbox).
 *
 * NOTE — the region-weighted token-burn layer on inquiries (the §7b
 * "inquiry fan-out" economics, design-locked V1.x) is NOT wired yet, so today
 * the inquiry is a chat thread + vendor_inquiry_received notification only —
 * economically inert. The token charge attaches when that economy ships.
 *
 * Best-effort on the message: a messaging hiccup (e.g. an event_moderators-only
 * host that sendChatMessage's couple-role check doesn't recognize) must NOT
 * undo the pick. We add the vendor regardless and report inquired=false.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import {
  canonicalServicesForFolder,
  canonicalServicesForTile,
} from '@/lib/vendor-counts';
import { searchCategoryVendors } from './category-search';
import { followVendor } from '@/lib/follow-actions';
import { sendChatMessage } from '@/lib/chat-actions';

export type UnlockCategoryResult =
  | { status: 'ok'; inquired: boolean; vendorName: string | null }
  | { status: 'already_active' }
  | { status: 'no_vendor' }
  | { status: 'not_signed_in' }
  | { status: 'not_a_member' }
  | { status: 'invalid_group' }
  | { status: 'error'; message: string };

const INQUIRY_BODY =
  "Hi! We're planning our wedding and would love to hear about your " +
  'availability and packages for our date. Could you share your rates and ' +
  "what's included?";

/** Group → canonical services (tightest-first), mirroring category-search.ts. */
function canonicalsForGroup(groupId: string): string[] {
  const g = PLAN_GROUPS.find((x) => x.id === groupId);
  if (!g) return [];
  if (g.subcategoryHint) return [g.subcategoryHint];
  if (g.catalogTile) return canonicalServicesForTile(g.catalogTile);
  return canonicalServicesForFolder(g.catalogFolder);
}

export async function unlockCategoryWithInquiry(input: {
  eventId: string;
  groupId: string;
}): Promise<UnlockCategoryResult> {
  const eventId = String(input.eventId ?? '').trim();
  const groupId = String(input.groupId ?? '').trim();
  if (!eventId || !groupId) return { status: 'invalid_group' };

  const canonicals = canonicalsForGroup(groupId);
  if (canonicals.length === 0) return { status: 'invalid_group' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  // Membership gate — events RLS restricts the read to members.
  const { data: ev } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!ev) return { status: 'not_a_member' };

  // Already added? Idempotent — any non-archived pick in this group's
  // canonical services means the category is already active.
  const { data: existingPicks } = await supabase
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .in('category', canonicals)
    .is('archived_at', null)
    .limit(1);
  if (existingPicks && existingPicks.length > 0) {
    return { status: 'already_active' };
  }

  // Best-fit vendor = top of the locked tier ladder, scoped to this group.
  const search = await searchCategoryVendors({ eventId, groupId });
  const best = search.results[0];
  if (!best) return { status: 'no_vendor' };
  const vendorProfileId = best.vendorProfileId;

  // Resolve the exact active service + category the vendor serves within the
  // group. adminClient bypasses vendor_services RLS (same pattern as the
  // other add actions). Without an active service we can't make a valid pick.
  const admin = createAdminClient();
  const { data: svc } = await admin
    .from('vendor_services')
    .select('vendor_service_id, category')
    .eq('vendor_profile_id', vendorProfileId)
    .in('category', canonicals)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!svc) return { status: 'no_vendor' };
  const category = svc.category as string;
  const serviceId = svc.vendor_service_id as string;

  const { data: prof } = await admin
    .from('vendor_profiles')
    .select('business_name')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const vendorName = prof?.business_name ?? best.name ?? 'Vendor';

  // 1. Add the best-fit vendor → the category is now active.
  const { error: insertErr } = await supabase.from('event_vendors').insert({
    event_id: eventId,
    category,
    vendor_name: vendorName,
    status: 'considering',
    marketplace_vendor_id: vendorProfileId,
    service_id: serviceId,
  });
  if (insertErr) return { status: 'error', message: insertErr.message };

  // 2. Auto-inquiry (best-effort). follow → thread → first couple message.
  let inquired = false;
  try {
    await followVendor(vendorProfileId);
    const { data: thread } = await supabase
      .from('chat_threads')
      .upsert(
        {
          event_id: eventId,
          vendor_profile_id: vendorProfileId,
          created_by_user_id: user.id,
        },
        { onConflict: 'event_id,vendor_profile_id' },
      )
      .select('thread_id')
      .single();
    if (thread?.thread_id) {
      const msg = new FormData();
      msg.set('thread_id', thread.thread_id);
      msg.set('body', INQUIRY_BODY);
      // sendChatMessage posts as 'couple' + fires vendor_inquiry_received on
      // the first message. No return_to → it returns without redirecting.
      await sendChatMessage(msg);
      inquired = true;
    }
  } catch {
    inquired = false;
  }

  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
  revalidatePath(`/dashboard/${eventId}`, 'layout');
  return { status: 'ok', inquired, vendorName };
}

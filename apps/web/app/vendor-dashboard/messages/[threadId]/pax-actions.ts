'use server';

/**
 * Adaptive Pax Pricing — Phase 5 vendor-confirm actions.
 *
 * The couple's guest count can move a booked vendor's cost (when the vendor set
 * a per-added-guest rate). Per the owner lock, that cost change is NEVER silent:
 * it surfaces as an Accept/Decline card in the chat thread and only moves
 * total_cost_php when the VENDOR confirms — symmetric, so a drop also needs a
 * confirm. The recompute is authoritative server-side (the client value is
 * never trusted). event_vendors is the couple's table, so the gated write goes
 * through the admin client AFTER verifying the vendor owns the booking.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveLivePax, computeAddedPaxSurcharge } from '@/lib/pax';

type Resolved = {
  admin: ReturnType<typeof createAdminClient>;
  threadId: string;
  eventVendorId: string;
  eventId: string;
  vendorProfileId: string;
  livePax: number;
  base: number;
  applied: number;
  target: number;
  currentTotal: number;
  rate: number | null;
  prevPax: number | null;
};

// Shared guard + authoritative recompute for both actions. Returns null (caller
// no-ops) when unauthorized, the booking is gone, or there's no live pax.
async function resolve(formData: FormData): Promise<Resolved | null> {
  const eventVendorId = String(formData.get('event_vendor_id') ?? '');
  const threadId = String(formData.get('thread_id') ?? '');
  if (!eventVendorId) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from('event_vendors')
    .select(
      'vendor_id, event_id, marketplace_vendor_id, service_id, total_cost_php, pax_surcharge_php, pax_quote_base, cost_basis_pax',
    )
    .eq('vendor_id', eventVendorId)
    .maybeSingle();
  // Ownership gate: the vendor may only touch a booking that is theirs.
  if (!ev || ev.marketplace_vendor_id !== profile.vendor_profile_id) return null;

  const livePax = await resolveLivePax(admin, ev.event_id);
  if (livePax == null) return null;

  // Base = the count the price covers; defaults to the inquiry snapshot.
  const { data: thread } = await admin
    .from('chat_threads')
    .select('pax_at_inquiry')
    .eq('event_id', ev.event_id)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const base = ev.pax_quote_base ?? thread?.pax_at_inquiry ?? livePax;

  let rate: number | null = null;
  let block = 1;
  if (ev.service_id) {
    const { data: svc } = await admin
      .from('vendor_services')
      .select('added_pax_price_php, added_pax_block')
      .eq('vendor_service_id', ev.service_id)
      .maybeSingle();
    rate = svc?.added_pax_price_php ?? null;
    block = svc?.added_pax_block ?? 1;
  }

  const target = computeAddedPaxSurcharge({
    livePax,
    quoteBasePax: base,
    ratePhp: rate,
    block,
  });
  return {
    admin,
    threadId,
    eventVendorId,
    eventId: ev.event_id,
    vendorProfileId: profile.vendor_profile_id,
    livePax,
    base,
    applied: ev.pax_surcharge_php ?? 0,
    target,
    currentTotal: ev.total_cost_php ?? 0,
    rate,
    prevPax: ev.cost_basis_pax ?? null,
  };
}

function revalidate(threadId: string) {
  if (threadId) revalidatePath(`/vendor-dashboard/messages/${threadId}`);
  revalidatePath('/vendor-dashboard/messages');
}

// Append-only HQ audit (Phase 6). Best-effort: a failed insert (e.g. the table
// not yet migrated) must never block the vendor's decision. The newSurcharge /
// newTotal equal the previous values on a 'decline' (price held).
async function writeAudit(
  r: Resolved,
  action: 'accept' | 'decline',
  newSurcharge: number,
  newTotal: number,
): Promise<void> {
  try {
    await r.admin.from('pax_change_audit').insert({
      event_id: r.eventId,
      event_vendor_id: r.eventVendorId,
      vendor_profile_id: r.vendorProfileId,
      action,
      live_pax: r.livePax,
      quote_base_pax: r.base,
      prev_pax: r.prevPax,
      rate_php: r.rate,
      prev_surcharge_php: r.applied,
      new_surcharge_php: newSurcharge,
      prev_total_php: r.currentTotal,
      new_total_php: newTotal,
    });
  } catch {
    /* audit is best-effort — never block the decision */
  }
}

// Notify every couple member that the vendor confirmed a guest-count-driven
// cost change (best-effort — the booking total already moved; a failed notify
// must never roll it back). The couple→vendor cost change was previously
// silent: event_vendors is the couple's table but the WRITE happens on the
// vendor side, so without this the couple's total moved with no signal.
async function notifyCoupleOfSurchargeChange(
  r: Resolved,
  newTotal: number,
): Promise<void> {
  try {
    const { data: vendor } = await r.admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', r.vendorProfileId)
      .maybeSingle();
    const vendorName = vendor?.business_name?.trim() || 'Your vendor';
    const delta = r.target - r.applied;
    const direction =
      delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'updated';
    const { data: members } = await r.admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', r.eventId)
      .eq('member_type', 'couple');
    for (const m of members ?? []) {
      if (!m.user_id) continue;
      await emitNotification({
        userId: m.user_id,
        type: 'pax_surcharge_changed',
        title: `${vendorName} ${direction} a guest-count charge`,
        body: `Based on ${r.livePax} guests, the booking total is now ₱${newTotal.toLocaleString('en-PH')}.`,
        relatedUrl: `/dashboard/${r.eventId}/budget`,
      });
    }
  } catch (e) {
    console.error('[pax] couple surcharge notify failed:', e);
  }
}

/** Apply the live-pax surcharge to the booking total (the vendor confirmed). */
export async function acceptPaxSurcharge(formData: FormData): Promise<void> {
  const r = await resolve(formData);
  if (!r) return;
  const newTotal = r.currentTotal - r.applied + r.target;
  await r.admin
    .from('event_vendors')
    .update({
      total_cost_php: newTotal,
      pax_surcharge_php: r.target,
      cost_basis_pax: r.livePax,
      pax_quote_base: r.base, // lock the base on first decision
    })
    .eq('vendor_id', r.eventVendorId);
  await writeAudit(r, 'accept', r.target, newTotal);
  await notifyCoupleOfSurchargeChange(r, newTotal);
  revalidate(r.threadId);
}

/** Acknowledge the new count but hold the price (no cost change). */
export async function declinePaxSurcharge(formData: FormData): Promise<void> {
  const r = await resolve(formData);
  if (!r) return;
  await r.admin
    .from('event_vendors')
    .update({ cost_basis_pax: r.livePax, pax_quote_base: r.base })
    .eq('vendor_id', r.eventVendorId);
  await writeAudit(r, 'decline', r.applied, r.currentTotal);
  revalidate(r.threadId);
}

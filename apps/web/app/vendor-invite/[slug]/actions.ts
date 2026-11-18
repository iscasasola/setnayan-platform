'use server';

/**
 * Vendor → couple invite claim action. The couple, signed in, picks one of
 * their events and the vendor (resolved from the public business_slug in the
 * QR) is imported into that event's Explore shortlist. Owner-locked flow
 * 2026-06-30 — see lib/vendor-couple-invite.ts.
 */

import { shopInvitePath } from '@/lib/shop-address';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  importVendorToEventShortlist,
  listHostEvents,
} from '@/lib/vendor-couple-invite';
import { isShopLive } from '@/lib/vendor-visibility';
import { CLIENT_INVITE_PARAM, clientInviteTokenOf, importIsOwnClient, shopIsVerified } from '@/lib/own-clients';
import { fetchClientInvite, giveOwnClientGift, markOwnClientRow } from '@/lib/own-clients.server';
import { isShopPaused } from '@/lib/shop-status';

function backToInvite(slug: string, status: string, scope = ''): never {
  const sep = scope ? `&${scope}` : '';
  redirect(`${shopInvitePath(encodeURIComponent(slug))}?status=${status}${sep}`);
}

export async function claimVendorInviteToEvent(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '').trim();
  const eventId = String(formData.get('event_id') ?? '').trim();
  const cat = String(formData.get('cat') ?? '').trim();
  const et = String(formData.get('et') ?? '').trim();
  const ci = clientInviteTokenOf(String(formData.get(CLIENT_INVITE_PARAM) ?? '').trim());
  if (!slug) redirect('/');

  // Preserve the QR's event/service scope across any bounce-back redirect.
  const scopeParams = new URLSearchParams();
  if (et) scopeParams.set('et', et);
  if (cat) scopeParams.set('cat', cat);
  if (ci) scopeParams.set(CLIENT_INVITE_PARAM, ci);
  const scope = scopeParams.toString();

  if (!eventId) backToInvite(slug, 'pick_event', scope);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Round-trip through sign-in, then back to the (scoped) invite page.
    const next = `${shopInvitePath(slug)}${scope ? `?${scope}` : ''}`;
    redirect(`/signup?as=couple&next=${encodeURIComponent(next)}`);
  }

  const admin = createAdminClient();

  // Resolve the vendor from the public slug (APPROVED shops only).
  //
  // ⚠ This is the SECOND half of the same gate — the page refuses first, this
  // refuses on submit. Both read `is_published` until 2026-08-11, which nothing
  // in the approval flow sets, so both refused every vendor. Keep the two in
  // step: a page that renders and an action that refuses is worse than either.
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, public_visibility, verification_state, paused_at')
    .eq('business_slug', slug)
    .maybeSingle();
  if (!vendor || !isShopLive(vendor)) backToInvite(slug, 'not_found', scope);
  // ⏸ A paused shop takes nothing new (owner 2026-11-16) — the page says so, and the writer refuses it too.
  if (isShopPaused(vendor)) backToInvite(slug, 'paused', scope);

  // Ownership: the chosen event must be one the user actually hosts.
  const hostEvents = await listHostEvents(admin, user!.id);
  if (!hostEvents.some((e) => e.event_id === eventId)) {
    backToInvite(slug, 'not_your_event', scope);
  }

  // 🎁 OWN CLIENTS v4 (owner 2026-11-16): an Add-a-client invite makes the couple the shop's OWN client — no booking
  // fee — but only with its Setnayan gift. The gift is given from the shop's bought stock FIRST, exactly once per
  // (shop, event); with too little stock (or a refused read) the couple still lands on the shortlist, as the Shortlist
  // QR does, and is not yet an own client. A couple who already has this shop on their event keeps that row as it is —
  // no gift is given to a relationship the invite did not start.
  let source: 'vendor_invite' | undefined;
  if (ci) {
    const invite = await fetchClientInvite(admin, ci, vendor!.vendor_profile_id);
    const { data: had } = await admin
      .from('event_vendors')
      .select('vendor_id')
      .eq('event_id', eventId)
      .eq('marketplace_vendor_id', vendor!.vendor_profile_id)
      .maybeSingle();
    if (invite && invite !== 'unread' && invite.status !== 'void' && invite.lines.length > 0 && !had) {
      const gave = await giveOwnClientGift(admin, {
        vendorProfileId: vendor!.vendor_profile_id,
        eventId,
        via: 'invite',
        inviteId: invite.inviteId,
        lines: invite.lines,
        userId: user!.id,
      });
      // 🎟 Owner 2026-11-16 ("A NEW ACCOUNT IS FREE FOR ONE YEAR…"): the gift is given on every import, but the couple is
      // the shop's OWN client (no fee) only when the import created their account, or this shop is the event's FIRST
      // imported supplier (a new event or one already on Setnayan — amended 9fe95ebe). Anything else stays a normal booking (the fee) — `importIsOwnClient`.
      if ((gave.status === 'given' || gave.status === 'already') && importIsOwnClient(gave.facts, shopIsVerified(vendor!.verification_state))) source = 'vendor_invite';
    }
  }

  const result = await importVendorToEventShortlist(admin, {
    eventId,
    vendorProfileId: vendor!.vendor_profile_id,
    pickedBy: user!.id,
    categoryOverride: cat || null,
  });
  // 🎁 The gift was given → this NEW row is the shop's own client (its own writer — the Shortlist QR's writer never
  // writes an own-client source, `lib/the-shortlist-qr-is-not-an-import.test.ts`).
  if (source && result.status === 'ok') await markOwnClientRow(admin, result.eventVendorId);

  if (result.status === 'error') backToInvite(slug, 'error', scope);
  if (result.status === 'vendor_not_found') backToInvite(slug, 'not_found', scope);
  if (result.status === 'paused') backToInvite(slug, 'paused', scope);

  // Success (new or already-saved) → land the couple on that event's vendor
  // shortlist so they immediately see the vendor they just added.
  revalidatePath(`/dashboard/${eventId}/vendors`);
  redirect(
    `/dashboard/${eventId}/vendors?invited=${result.status === 'already_saved' ? 'already' : '1'}`,
  );
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendVendorInviteEmail } from '@/lib/email';
import { emitNotification } from '@/lib/notification-emit';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { generateClaimToken, lookupExistingVendorByEmail } from '@/lib/vendor-invites';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type SendInviteResult =
  | { ok: true; mode: 'invited'; inviteId: string }
  | { ok: true; mode: 'connected'; vendorProfileId: string; businessName: string }
  | {
      ok: false;
      code:
        | 'NOT_AUTHENTICATED'
        | 'NOT_SECURED'
        | 'VENDOR_NOT_FOUND'
        | 'ALREADY_LINKED'
        | 'INVALID_EMAIL'
        | 'EXISTING_PENDING_INVITE'
        | 'INSERT_FAILED';
      message: string;
    };

export type SimpleResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

// ---------------------------------------------------------------------------
// Email validation
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

const TTL_DAYS = 90;
function computeExpiresAt(): string {
  return new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Couple-side: send a fresh invite (or short-circuit to Connect if the
// invited email already runs a Setnayan vendor account).
// ---------------------------------------------------------------------------

export async function sendVendorInvite(formData: FormData): Promise<SendInviteResult> {
  const vendorId = String(formData.get('vendor_id') ?? '').trim();
  const eventId = String(formData.get('event_id') ?? '').trim();
  const email = normalizeEmail(formData.get('email'));

  if (!email) {
    return { ok: false, code: 'INVALID_EMAIL', message: 'Enter a valid email address.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      code: 'NOT_AUTHENTICATED',
      message: 'Sign in to invite vendors.',
    };
  }
  // Anon-draft guard: inviting a vendor emails them and pulls them into a thread
  // where the couple identity would degrade to a placeholder. Require securing
  // the account first.
  if (user.is_anonymous) {
    return {
      ok: false,
      code: 'NOT_SECURED',
      message: 'Secure your account first to invite vendors.',
    };
  }

  // Read the parent event_vendors row (RLS scopes to current couple's events).
  const { data: parent, error: parentErr } = await supabase
    .from('event_vendors')
    .select('vendor_id,event_id,vendor_name,category,marketplace_vendor_id')
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (parentErr || !parent) {
    return {
      ok: false,
      code: 'VENDOR_NOT_FOUND',
      message: 'Vendor not found or not accessible.',
    };
  }
  if (parent.marketplace_vendor_id) {
    return {
      ok: false,
      code: 'ALREADY_LINKED',
      message: 'This vendor is already on Setnayan.',
    };
  }

  // Already-on-Setnayan short-circuit: if the email matches an existing
  // vendor account, surface the Connect path instead of creating an invite.
  const existing = await lookupExistingVendorByEmail(supabase, email);
  if (existing) {
    return {
      ok: true,
      mode: 'connected',
      vendorProfileId: existing.vendor_profile_id,
      businessName: existing.business_name,
    };
  }

  const claimToken = generateClaimToken();
  const { data: inserted, error: insertErr } = await supabase
    .from('vendor_invites')
    .insert({
      vendor_id: parent.vendor_id,
      invited_by_user_id: user.id,
      email,
      business_name: parent.vendor_name,
      service_category: parent.category,
      claim_token: claimToken,
      status: 'pending',
      expires_at: computeExpiresAt(),
    })
    .select('invite_id')
    .single();

  if (insertErr) {
    // 23505 = unique_violation on the partial index — there's already a
    // pending invite for this (vendor_id, email).
    if (insertErr.code === '23505') {
      return {
        ok: false,
        code: 'EXISTING_PENDING_INVITE',
        message:
          'A pending invite already exists for this email. Revoke it first, then re-send.',
      };
    }
    return { ok: false, code: 'INSERT_FAILED', message: insertErr.message };
  }

  // Fire the email. Best-effort: if Resend isn't configured, the row
  // already lives in the DB and the couple can still revoke / re-send.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const claimUrl = `${appUrl}/vendor/claim/${claimToken}`;
  await sendVendorInviteEmail({
    to: email,
    businessName: parent.vendor_name,
    coupleDisplayName: await resolveCoupleDisplayName(supabase, parent.event_id),
    serviceCategory: parent.category as string,
    eventDate: await resolveEventDate(supabase, parent.event_id),
    claimUrl,
  });

  if (eventId) revalidatePath(`/dashboard/${eventId}/vendors`);
  return { ok: true, mode: 'invited', inviteId: inserted.invite_id as string };
}

// ---------------------------------------------------------------------------
// Couple-side: revoke a pending invite.
// ---------------------------------------------------------------------------

// Called from a <form action> on the vendors page — returns void so it
// satisfies React's form-action signature. Errors fall through to console
// (the row just keeps its 'pending' state on failure, which is also what
// the couple sees in the UI).
export async function revokeVendorInvite(formData: FormData): Promise<void> {
  const inviteId = String(formData.get('invite_id') ?? '').trim();
  const eventId = String(formData.get('event_id') ?? '').trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('vendor_invites')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('invite_id', inviteId)
    .eq('status', 'pending');
  if (error) {
    console.error('[vendor-invite-actions] revoke failed:', error);
    return;
  }
  if (eventId) revalidatePath(`/dashboard/${eventId}/vendors`);
}

// ---------------------------------------------------------------------------
// Couple-side: confirm the Already-on-Setnayan Connect path. Atomically:
//  • write event_vendors.marketplace_vendor_id ← existing vendor_profile_id
//  • insert a vendor_follows row per 0019 § Booking-implies-follow
//  • mark no invite (Connect path skips vendor_invites entirely)
// ---------------------------------------------------------------------------

export async function connectExistingVendorProfile(
  formData: FormData,
): Promise<SimpleResult> {
  const vendorId = String(formData.get('vendor_id') ?? '').trim();
  const eventId = String(formData.get('event_id') ?? '').trim();
  const vendorProfileId = String(formData.get('vendor_profile_id') ?? '').trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: 'NOT_AUTHENTICATED', message: 'Sign in to connect vendors.' };
  }
  // Anon-draft guard: connecting links the couple to a real vendor profile
  // (follow + chat unlock) — a vendor-contact surface where the couple identity
  // would degrade to a placeholder. Require securing the account first, mirroring
  // sendVendorInvite above.
  if (user.is_anonymous) {
    return {
      ok: false,
      code: 'NOT_SECURED',
      message: 'Secure your account first to connect vendors.',
    };
  }

  const { error: linkErr } = await supabase
    .from('event_vendors')
    .update({ marketplace_vendor_id: vendorProfileId })
    .eq('vendor_id', vendorId);
  if (linkErr) return { ok: false, code: 'LINK_FAILED', message: linkErr.message };

  // Auto-insert vendor_follows per 0019 § Booking-implies-follow auto-insert.
  // Idempotent — onConflict ignoreDuplicates handles re-runs.
  await supabase.from('vendor_follows').upsert(
    {
      follower_user_id: user.id,
      vendor_profile_id: vendorProfileId,
    },
    { onConflict: 'follower_user_id,vendor_profile_id', ignoreDuplicates: true },
  );

  if (eventId) revalidatePath(`/dashboard/${eventId}/vendors`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vendor-side: decline an invite from the claim page (no auth — token IS
// the access gate, same as the read).
// ---------------------------------------------------------------------------

// Called from a <form action> on the public claim page — returns void
// via redirect(). Same-route redirect forces Next.js to re-render the
// page; the now-declined invite renders its terminal "Declined" surface.
export async function declineVendorInviteByToken(formData: FormData): Promise<void> {
  const token = String(formData.get('claim_token') ?? '').trim();
  if (!token) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from('vendor_invites')
    .update({ status: 'declined', declined_at: new Date().toISOString() })
    .eq('claim_token', token)
    .eq('status', 'pending');
  if (error) {
    console.error('[vendor-invite-actions] decline failed:', error);
  }
  redirect(`/vendor/claim/${token}`);
}

// ---------------------------------------------------------------------------
// Internal helper: atomically link a claimed invite to its parent event_vendors
// row and insert the auto-follow. Called from the signup-from-claim flow
// once the new vendor_profiles row exists. Uses the admin client because
// the signup flow runs as the freshly-created vendor (which has no read
// access to the original couple's event_vendors row).
// ---------------------------------------------------------------------------

export async function applyClaimAutoLink(args: {
  claimToken: string;
  claimedByUserId: string;
  claimedVendorProfileId: string;
}): Promise<
  | { ok: true; vendorId: string; coupleUserIds: string[] }
  | { ok: false; code: string; message: string }
> {
  const admin = createAdminClient();

  // 1. Look up the invite.
  const { data: invite, error: invErr } = await admin
    .from('vendor_invites')
    .select('invite_id,vendor_id,invited_by_user_id,status,expires_at')
    .eq('claim_token', args.claimToken)
    .maybeSingle();
  if (invErr || !invite) {
    return {
      ok: false,
      code: 'INVITE_NOT_FOUND',
      message: invErr?.message ?? 'Claim token does not match any invite.',
    };
  }
  if (invite.status !== 'pending') {
    return {
      ok: false,
      code: 'INVITE_NOT_PENDING',
      message: `Invite is ${invite.status}, can't claim.`,
    };
  }
  if (new Date(invite.expires_at as string).getTime() <= Date.now()) {
    await admin
      .from('vendor_invites')
      .update({ status: 'expired' })
      .eq('invite_id', invite.invite_id);
    return { ok: false, code: 'INVITE_EXPIRED', message: 'This invite link has expired.' };
  }

  // 2. Write marketplace_vendor_id on the parent event_vendors row.
  //    CONDITIONAL re-point guard: this multi-step sequence is non-transactional,
  //    so if a later step fails the invite stays 'pending' and a DIFFERENT second
  //    claimer could otherwise overwrite the couple's marketplace_vendor_id and
  //    re-point their vendor. Only set the bond when it's currently unset (null)
  //    or already this same profile (idempotent retry) — a re-claim by a
  //    different profile matches 0 rows and is refused. The legitimate FIRST
  //    claim has marketplace_vendor_id = null → the .or() admits it. A same-
  //    profile retry matches via the second predicate → still succeeds.
  const { error: linkErr } = await admin
    .from('event_vendors')
    .update({ marketplace_vendor_id: args.claimedVendorProfileId })
    .eq('vendor_id', invite.vendor_id)
    .or(`marketplace_vendor_id.is.null,marketplace_vendor_id.eq.${args.claimedVendorProfileId}`);
  if (linkErr) return { ok: false, code: 'LINK_FAILED', message: linkErr.message };

  // 3. Mark the invite claimed.
  const { error: inviteErr } = await admin
    .from('vendor_invites')
    .update({
      status: 'claimed',
      claimed_at: new Date().toISOString(),
      claimed_by_user_id: args.claimedByUserId,
      claimed_vendor_profile_id: args.claimedVendorProfileId,
    })
    .eq('invite_id', invite.invite_id);
  if (inviteErr) return { ok: false, code: 'MARK_CLAIMED_FAILED', message: inviteErr.message };

  // 4. Auto-insert vendor_follows for EVERY couple member of this event
  // (per 0019 § Booking-implies-follow auto-insert). Both partners get
  // the follow row so either can open the Message thread.
  const { data: parent } = await admin
    .from('event_vendors')
    .select('event_id')
    .eq('vendor_id', invite.vendor_id)
    .maybeSingle();

  let coupleUserIds: string[] = [];
  if (parent?.event_id) {
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', parent.event_id)
      .eq('member_type', 'couple');
    coupleUserIds = (members ?? [])
      .map((m) => m.user_id as string)
      .filter(Boolean);

    if (coupleUserIds.length > 0) {
      const rows = coupleUserIds.map((uid) => ({
        follower_user_id: uid,
        vendor_profile_id: args.claimedVendorProfileId,
      }));
      await admin
        .from('vendor_follows')
        .upsert(rows, {
          onConflict: 'follower_user_id,vendor_profile_id',
          ignoreDuplicates: true,
        });
    }

    // 5. Upsert a chat_thread so the vendor's /vendor-dashboard/bookings
    // surface shows the event immediately on first login. The
    // chat_threads UNIQUE (event_id, vendor_profile_id) lets us safely
    // upsert without race conditions on multi-host events. RLS allows
    // both sides to read once the row exists (chat_threads_member_read
    // in 20260513130000_iteration_0019_communications.sql); the admin
    // client used here bypasses RLS for the insert itself.
    //
    // Without this, the vendor lands on /vendor-dashboard, sees only the
    // profile-completion prompts, and has no path back to the event
    // they just claimed until the host sends them the first chat
    // message. Pre-seeding the thread closes that gap — the vendor
    // sees the booking under "Upcoming events" via fetchVendorThreads.
    //
    // The thread is created with NO messages — chat_messages.thread_id
    // is the actual conversation, which stays empty until either side
    // posts the first message. The empty thread is acceptable: vendor
    // bookings page renders a "Say hello" empty state, and the host
    // sees the thread show up in their /messages list with a "No
    // messages yet" pill. Standard 0019 communications shape.
    await admin
      .from('chat_threads')
      .upsert(
        {
          event_id: parent.event_id as string,
          vendor_profile_id: args.claimedVendorProfileId,
          created_by_user_id: args.claimedByUserId,
        },
        { onConflict: 'event_id,vendor_profile_id', ignoreDuplicates: true },
      );

    // 6. Flat 1-token claim burn (owner 2026-06-09 · "adding customer will cost
    // 1 ticket to sync"). BEST-EFFORT + idempotent: the RPC shares
    // vendor_event_unlocks with burn-on-answer, so a vendor that already
    // unlocked this event syncs free. If the vendor can't afford the token the
    // RPC raises INSUFFICIENT_WALLET_BALANCES and rolls its own tx back (no
    // phantom unlock) — we SWALLOW it here so the couple's manual add is never
    // blocked by the vendor's wallet (the link above already committed). When
    // the RPC is absent (migration not yet applied) the .rpc call errors and is
    // likewise swallowed — the link still stands. Couple-source only (admin-
    // source invites have no event, handled in the outer `if (parent?.event_id)`).
    try {
      const { error: burnErr } = await admin.rpc('claim_unlock_vendor_event', {
        p_vendor_profile_id: args.claimedVendorProfileId,
        p_event_id: parent.event_id as string,
      });
      if (burnErr) {
        // Insufficient balance / missing RPC / any DB error → link stands.
        console.warn('[claim] flat token burn skipped:', burnErr.message);
      }
    } catch (e) {
      console.warn('[claim] flat token burn threw (link kept):', e);
    }
  }

  return { ok: true, vendorId: invite.vendor_id as string, coupleUserIds };
}

// ---------------------------------------------------------------------------
// PR-C — guided first-service setup for a claimed off-platform vendor.
//
// After a manually-added (off-platform) vendor scans the couple's claim QR,
// signs up, and runs applyClaimAutoLink, we route them into the EXISTING
// services-creation wizard carrying the claim token. When they create their
// first service, registerClaimedServiceToCouple links that new service back to
// the couple's plan (event_vendors.service_id) — the same column a marketplace
// pick stamps. This closes the loop: the couple sees the vendor's real service
// card where their manual placeholder used to be.
// ---------------------------------------------------------------------------

/**
 * Resolve a CLAIMED invite by its claim_token, for the guided first-service
 * surface. Returns just the fields the banner + registration need. Uses the
 * admin client — the parent event_vendors / events rows are couple-owned and
 * the freshly-created vendor has no RLS read on them.
 *
 * Returns null on any miss (unknown token, not-claimed, admin-source with no
 * event). Never throws — the wizard must render even if the claim context is
 * stale (the vendor can still build a service, it just won't auto-register).
 */
export async function resolveClaimContextForService(claimToken: string): Promise<{
  inviteId: string;
  eventVendorId: string;
  serviceCategory: string | null;
  claimedByUserId: string | null;
  claimedVendorProfileId: string | null;
  coupleDisplayName: string;
  alreadyRegistered: boolean;
} | null> {
  if (!claimToken) return null;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from('vendor_invites')
    .select(
      'invite_id,vendor_id,source,status,service_category,claimed_by_user_id,claimed_vendor_profile_id',
    )
    .eq('claim_token', claimToken)
    .maybeSingle();
  if (!invite || invite.status !== 'claimed') return null;
  // Couple/auto_share_link invites carry a parent event_vendors row; admin-
  // source ones don't (nothing to register against).
  const eventVendorId = invite.vendor_id as string | null;
  if (!eventVendorId) return null;

  const { data: parent } = await admin
    .from('event_vendors')
    .select('vendor_id,event_id,service_id')
    .eq('vendor_id', eventVendorId)
    .maybeSingle();
  if (!parent) return null;

  let coupleDisplayName = 'the couple';
  if (parent.event_id) {
    const { data: ev } = await admin
      .from('events')
      .select('display_name')
      .eq('event_id', parent.event_id as string)
      .maybeSingle();
    const name = ((ev?.display_name as string | null) ?? '').trim();
    if (name) coupleDisplayName = name;
  }

  return {
    inviteId: invite.invite_id as string,
    eventVendorId,
    serviceCategory: (invite.service_category as string | null) ?? null,
    claimedByUserId: (invite.claimed_by_user_id as string | null) ?? null,
    claimedVendorProfileId: (invite.claimed_vendor_profile_id as string | null) ?? null,
    coupleDisplayName,
    alreadyRegistered: Boolean(parent.service_id),
  };
}

export type RegisterClaimedServiceResult =
  | { ok: true; registered: boolean; reason?: 'already_registered' | 'category_mismatch' }
  | { ok: false; code: string; message: string };

/**
 * Cross-actor link: stamp the couple's event_vendors.service_id with the
 * service the claimed vendor just created. Runs as the vendor; the target row
 * is COUPLE-owned (couple-RLS) so the write MUST use the admin client.
 *
 * IDENTITY IS DERIVED FROM THE SESSION, NOT THE CALLER. This function is
 * exported from a 'use server' module, so Next.js could expose it as a server-
 * action endpoint a client invokes with arbitrary args. We therefore resolve
 * the calling user from the auth cookie and the vendor profile from THAT user
 * (fetchOwnVendorProfile) — the caller only supplies the claim token and the
 * just-created service id, both of which are re-verified below. There is no
 * caller-supplied user/profile id to forge.
 *
 * SECURITY CHAIN (all must hold, or we refuse the write):
 *   1. There is an authenticated session → a vendor_profile for that user.
 *   2. The invite identified by claimToken is in status 'claimed'.
 *   3. invite.claimed_by_user_id === the session user's id
 *      (the signed-in user actually owns this claim).
 *   4. invite.claimed_vendor_profile_id === the session user's vendor profile
 *      (the claim resolved to THIS profile).
 *   5. event_vendors.marketplace_vendor_id === the session user's vendor profile
 *      (the couple's row is already linked to this exact vendor profile — the
 *      auto-link step established this; it's the couple↔vendor bond that proves
 *      the couple invited THIS vendor).
 *   6. The candidate vendor_service belongs to the session user's vendor profile
 *      (a vendor can only register its OWN service).
 *
 * Together these guarantee a vendor can only ever link to a couple who actually
 * invited them, with a service they actually own.
 *
 * IDEMPOTENT: if event_vendors.service_id is already set, we DO NOT clobber it
 * — we return { registered: false, reason: 'already_registered' } so a retry /
 * double-submit is a safe no-op (the couple may have hand-picked a different
 * service in the meantime).
 */
export async function registerClaimedServiceToCouple(args: {
  claimToken: string;
  vendorServiceId: string;
}): Promise<RegisterClaimedServiceResult> {
  // (1) Session-derived identity — never trust caller-supplied ids.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'NOT_AUTHENTICATED', message: 'Sign in first.' };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) {
    return { ok: false, code: 'NO_VENDOR_PROFILE', message: 'No vendor profile for this user.' };
  }
  const vendorProfileId = profile.vendor_profile_id;

  const admin = createAdminClient();

  // (2)(3)(4) Invite must be claimed BY this user TO this vendor profile.
  const { data: invite, error: invErr } = await admin
    .from('vendor_invites')
    .select('invite_id,vendor_id,status,service_category,claimed_by_user_id,claimed_vendor_profile_id')
    .eq('claim_token', args.claimToken)
    .maybeSingle();
  if (invErr) return { ok: false, code: 'INVITE_LOOKUP_FAILED', message: invErr.message };
  if (!invite) return { ok: false, code: 'INVITE_NOT_FOUND', message: 'Claim not found.' };
  if (invite.status !== 'claimed') {
    return { ok: false, code: 'INVITE_NOT_CLAIMED', message: 'This claim is not active.' };
  }
  if (invite.claimed_by_user_id !== user.id) {
    return { ok: false, code: 'NOT_CLAIM_OWNER', message: 'This claim is not yours.' };
  }
  if (invite.claimed_vendor_profile_id !== vendorProfileId) {
    return {
      ok: false,
      code: 'PROFILE_MISMATCH',
      message: 'This claim resolved to a different vendor profile.',
    };
  }
  const eventVendorId = invite.vendor_id as string | null;
  if (!eventVendorId) {
    return { ok: false, code: 'NO_PARENT_ROW', message: 'Nothing to register against.' };
  }

  // (6) The service must belong to this vendor profile.
  const { data: svc } = await admin
    .from('vendor_services')
    .select('vendor_service_id,category')
    .eq('vendor_service_id', args.vendorServiceId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!svc) {
    return { ok: false, code: 'SERVICE_NOT_OWNED', message: 'That service is not yours.' };
  }

  // (7) The service's category must match the category the couple invited this
  //     vendor for. A vendor who hand-navigates to /services/new/<other-cat>?
  //     claim=<token> can create a real, owned service in the WRONG category;
  //     linking it into the couple's plan row would silently mis-categorize the
  //     booking. We skip (best-effort, consistent with the idempotent path) the
  //     cross-actor write rather than throwing — the service still exists for the
  //     vendor; it just isn't auto-registered to this claim.
  const inviteCategory = (invite.service_category as string | null) ?? null;
  const svcCategory = (svc.category as string | null) ?? null;
  if (inviteCategory && svcCategory !== inviteCategory) {
    return { ok: true, registered: false, reason: 'category_mismatch' };
  }

  // (5) The couple's row must already be linked to THIS vendor profile, and
  //     not already carry a service_id (idempotency / don't-clobber).
  const { data: parent, error: parentErr } = await admin
    .from('event_vendors')
    .select('vendor_id,event_id,marketplace_vendor_id,service_id')
    .eq('vendor_id', eventVendorId)
    .maybeSingle();
  if (parentErr) return { ok: false, code: 'PARENT_LOOKUP_FAILED', message: parentErr.message };
  if (!parent) return { ok: false, code: 'PARENT_NOT_FOUND', message: 'Couple row not found.' };
  if (parent.marketplace_vendor_id !== vendorProfileId) {
    return {
      ok: false,
      code: 'LINK_MISMATCH',
      message: 'The couple is not linked to this vendor profile.',
    };
  }
  if (parent.service_id) {
    // Already registered (this run, a prior retry, or a couple hand-pick) —
    // never clobber an existing pick.
    return { ok: true, registered: false, reason: 'already_registered' };
  }

  // All checks pass — stamp the link. The .is('service_id', null) guard makes
  // the write itself idempotent against a concurrent register racing us, and
  // the .eq('marketplace_vendor_id', …) re-asserts the couple↔vendor bond at
  // write time (so a couple re-linking to a different vendor mid-flight can't
  // be silently overwritten).
  const { data: updated, error: updErr } = await admin
    .from('event_vendors')
    .update({ service_id: args.vendorServiceId })
    .eq('vendor_id', eventVendorId)
    .eq('marketplace_vendor_id', vendorProfileId)
    .is('service_id', null)
    .select('vendor_id')
    .maybeSingle();
  if (updErr) return { ok: false, code: 'LINK_WRITE_FAILED', message: updErr.message };
  if (!updated) {
    // A racing register won → treat as already-registered, not an error.
    return { ok: true, registered: false, reason: 'already_registered' };
  }

  // The couple's plan row just upgraded from a manual placeholder to the
  // vendor's real service card. Refresh the couple's vendors page so they see
  // the upgraded vendor instead of the stale placeholder. revalidatePath is a
  // no-op-if-nothing-to-do call and never throws in a request context (this
  // runs inside the service-create server action), so it's safe here. Best-
  // effort: wrapped so a revalidation hiccup never turns a successful link into
  // a failure the vendor sees.
  const eventId = (parent.event_id as string | null) ?? null;
  if (eventId) {
    try {
      revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
    } catch (e) {
      console.warn('[claim] revalidate couple vendors page skipped:', e);
    }

    // Notify the couple that their vendor joined + linked a service. Uses the
    // existing `vendor_joined` type ("couple: an invited vendor claimed their
    // profile" — notifications.ts §NotificationType) via emitNotification, which
    // fails soft and is NOT on the email allowlist, so this is an in-app/push
    // nudge only. Fan out to every couple member of the event (both partners),
    // mirroring the auto-follow fan-out in applyClaimAutoLink.
    try {
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      const coupleUserIds = (members ?? [])
        .map((m) => m.user_id as string)
        .filter(Boolean);
      await Promise.all(
        coupleUserIds.map((uid) =>
          emitNotification({
            userId: uid,
            type: 'vendor_joined',
            title: 'Your vendor joined Setnayan',
            body: 'A vendor you added has linked their service to your plan.',
            relatedUrl: `/dashboard/${eventId}/vendors`,
          }),
        ),
      );
    } catch (e) {
      console.warn('[claim] vendor_joined notify skipped:', e);
    }
  }

  return { ok: true, registered: true };
}

// ---------------------------------------------------------------------------
// Helpers — pull display-friendly strings for the invite email.
// ---------------------------------------------------------------------------

async function resolveCoupleDisplayName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<string> {
  const { data } = await supabase
    .from('events')
    .select('display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  const name = ((data?.display_name as string | null) ?? '').trim();
  return name || 'A Setnayan couple';
}

async function resolveEventDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('events')
    .select('event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  return (data?.event_date as string | null) ?? null;
}

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseSponsorTier,
  parseSponsorSide,
  sponsorGuestRole,
  sponsorGuestSide,
  type SponsorTier,
} from '@/lib/event-sponsors';

/**
 * Iteration · Principal + Secondary Sponsor coordination — server actions.
 * Per CLAUDE.md 2026-05-22 row "Principal Sponsor list builder".
 *
 * All form actions go through requireHostMembership() — caller must be an
 * accepted host (event_moderators) OR a legacy event_members 'couple' row.
 * Mirrors the same gate as /dashboard/[eventId]/hosts (iteration 0048 V1).
 */

async function requireHostMembership(eventId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Source 1 — event_moderators (canonical going forward).
  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();

  if (moderator) return user.id;

  // Source 2 — event_members couple row (V1 backwards-compat).
  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (legacy && (legacy as { member_type: string }).member_type === 'couple') {
    return user.id;
  }

  throw new Error('Forbidden — only current hosts can manage sponsors.');
}

function clean(value: FormDataEntryValue | null, max = 200): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function nullIfBlank(value: FormDataEntryValue | null, max = 200): string | null {
  const c = clean(value, max);
  return c.length > 0 ? c : null;
}

function parseEventId(formData: FormData): string {
  const raw = formData.get('event_id');
  if (typeof raw !== 'string' || raw.length === 0) {
    redirect('/dashboard');
  }
  return raw as string;
}

function parsePairIndex(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1 || n > 99) return null;
  return n;
}

/**
 * Add a sponsor row. Used by both Add-ninong-on-pair-N (principal) and
 * Add-cord/veil/coin/candle-sponsor flows. The tier + side are part of the
 * form so this is one action for both shapes.
 */
export async function addSponsor(formData: FormData): Promise<void> {
  const eventId = parseEventId(formData);
  let userId: string;
  try {
    userId = await requireHostMembership(eventId);

    const tier = parseSponsorTier(formData.get('sponsor_tier'));
    const side = parseSponsorSide(formData.get('side'));
    const fullName = clean(formData.get('full_name'), 200);
    if (fullName.length === 0) {
      throw new Error('Full name is required.');
    }
    const relationshipNote = nullIfBlank(formData.get('relationship_note'), 200);
    const email = nullIfBlank(formData.get('email'), 200);
    const phone = nullIfBlank(formData.get('phone'), 40);
    const pairIndex = tier === 'principal' ? parsePairIndex(formData.get('pair_index')) : null;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Email looks invalid.');
    }

    const admin = createAdminClient();
    const { error } = await admin.from('event_sponsors').insert({
      event_id: eventId,
      pair_index: pairIndex,
      sponsor_tier: tier,
      side,
      full_name: fullName,
      relationship_note: relationshipNote,
      email,
      phone,
      created_by_user_id: userId,
    });

    if (error) {
      throw new Error(error.message || 'Could not add sponsor.');
    }

    revalidatePath(`/dashboard/${eventId}/sponsors`);
    redirect(`/dashboard/${eventId}/sponsors?added=1#tier-${tier}`);
  } catch (e) {
    // redirect() throws a NEXT_REDIRECT — re-throw so Next handles it. Only
    // wrap genuine error states.
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    redirect(
      `/dashboard/${eventId}/sponsors?error=${encodeURIComponent((e as Error).message.slice(0, 120))}`,
    );
  }
}

/**
 * Update an existing sponsor row (host edits name / contact / relationship
 * note before sending the invitation). Tier + side are immutable post-
 * insert — moving a sponsor between tiers means removing + re-adding.
 */
export async function updateSponsor(formData: FormData): Promise<void> {
  const eventId = parseEventId(formData);
  const sponsorId = clean(formData.get('sponsor_id'), 40);
  if (!sponsorId) redirect(`/dashboard/${eventId}/sponsors`);

  try {
    await requireHostMembership(eventId);

    const fullName = clean(formData.get('full_name'), 200);
    if (fullName.length === 0) {
      throw new Error('Full name is required.');
    }
    const relationshipNote = nullIfBlank(formData.get('relationship_note'), 200);
    const email = nullIfBlank(formData.get('email'), 200);
    const phone = nullIfBlank(formData.get('phone'), 40);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Email looks invalid.');
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('event_sponsors')
      .update({
        full_name: fullName,
        relationship_note: relationshipNote,
        email,
        phone,
      })
      .eq('id', sponsorId)
      .eq('event_id', eventId);

    if (error) {
      throw new Error(error.message || 'Could not update sponsor.');
    }

    revalidatePath(`/dashboard/${eventId}/sponsors`);
    redirect(`/dashboard/${eventId}/sponsors?updated=1`);
  } catch (e) {
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    redirect(
      `/dashboard/${eventId}/sponsors?error=${encodeURIComponent((e as Error).message.slice(0, 120))}`,
    );
  }
}

/**
 * Remove a sponsor row entirely. Soft-delete is overkill here — sponsor
 * lists pre-invitation are draft state and hosts add/remove freely.
 *
 * If the sponsor was already accepted and has a linked_guest_id, we DO NOT
 * automatically delete the guests row (the host may want to keep them as
 * a regular guest even after declining the sponsor role). Surfaced as a
 * note in the UI.
 */
export async function removeSponsor(formData: FormData): Promise<void> {
  const eventId = parseEventId(formData);
  const sponsorId = clean(formData.get('sponsor_id'), 40);
  if (!sponsorId) redirect(`/dashboard/${eventId}/sponsors`);

  try {
    await requireHostMembership(eventId);

    const admin = createAdminClient();
    await admin.from('event_sponsors').delete().eq('id', sponsorId).eq('event_id', eventId);

    revalidatePath(`/dashboard/${eventId}/sponsors`);
    redirect(`/dashboard/${eventId}/sponsors?removed=1`);
  } catch (e) {
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    redirect(
      `/dashboard/${eventId}/sponsors?error=${encodeURIComponent((e as Error).message.slice(0, 120))}`,
    );
  }
}

/**
 * Mark invitation as sent. Sets invitation_status='invited' +
 * invitation_sent_at=NOW(). The actual message delivery is owner-side in V1
 * (host copies the template text to clipboard + pastes into Messenger/Viber/
 * email). V1.x integrates Resend per 0028 email template pattern.
 */
export async function sendInvitation(formData: FormData): Promise<void> {
  const eventId = parseEventId(formData);
  const sponsorId = clean(formData.get('sponsor_id'), 40);
  if (!sponsorId) redirect(`/dashboard/${eventId}/sponsors`);

  try {
    await requireHostMembership(eventId);

    const admin = createAdminClient();
    const { error } = await admin
      .from('event_sponsors')
      .update({
        invitation_status: 'invited',
        invitation_sent_at: new Date().toISOString(),
      })
      .eq('id', sponsorId)
      .eq('event_id', eventId);

    if (error) {
      throw new Error(error.message || 'Could not mark invitation as sent.');
    }

    revalidatePath(`/dashboard/${eventId}/sponsors`);
    redirect(`/dashboard/${eventId}/sponsors?invited=1`);
  } catch (e) {
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    redirect(
      `/dashboard/${eventId}/sponsors?error=${encodeURIComponent((e as Error).message.slice(0, 120))}`,
    );
  }
}

/**
 * Mark response (accepted / declined). On acceptance, auto-create a guests
 * row with the matching sponsor role + link via linked_guest_id.
 *
 * Skips guest creation if the sponsor already has linked_guest_id set
 * (idempotent — host can flip status without duplicating guest rows).
 */
export async function markResponse(formData: FormData): Promise<void> {
  const eventId = parseEventId(formData);
  const sponsorId = clean(formData.get('sponsor_id'), 40);
  if (!sponsorId) redirect(`/dashboard/${eventId}/sponsors`);

  const rawStatus = clean(formData.get('status'), 16);
  if (rawStatus !== 'accepted' && rawStatus !== 'declined') {
    redirect(`/dashboard/${eventId}/sponsors`);
  }
  const status = rawStatus as 'accepted' | 'declined';

  try {
    await requireHostMembership(eventId);

    const admin = createAdminClient();

    // Fetch the existing row so we know the tier + side + name for guest
    // auto-creation, and check whether it's already linked.
    const { data: existing, error: fetchErr } = await admin
      .from('event_sponsors')
      .select(
        'id, event_id, sponsor_tier, side, full_name, email, linked_guest_id, invitation_status',
      )
      .eq('id', sponsorId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (fetchErr || !existing) {
      throw new Error('Sponsor not found.');
    }

    type Existing = {
      id: string;
      event_id: string;
      sponsor_tier: SponsorTier;
      side: 'groom' | 'bride' | 'neutral';
      full_name: string;
      email: string | null;
      linked_guest_id: string | null;
      invitation_status: string;
    };

    const sponsor = existing as Existing;

    let linkedGuestId = sponsor.linked_guest_id;
    const declineNote = nullIfBlank(formData.get('decline_note'), 400);

    // On acceptance: auto-create + link guest row (idempotent — skip if
    // already linked).
    if (status === 'accepted' && !linkedGuestId) {
      const [firstName, ...rest] = sponsor.full_name.split(/\s+/).filter(Boolean);
      const lastName = rest.length > 0 ? rest.join(' ') : '—';

      const { data: insertedGuest, error: guestErr } = await admin
        .from('guests')
        .insert({
          event_id: eventId,
          first_name: firstName ?? sponsor.full_name,
          last_name: lastName,
          side: sponsorGuestSide(sponsor.side),
          group_category: 'family', // sponsors are family-tier by convention
          role: sponsorGuestRole(sponsor.sponsor_tier),
          email: sponsor.email,
          rsvp_status: 'attending', // they've accepted the sponsor invitation
          photo_consent: true,
          invited_to_blocks: ['ceremony', 'reception'],
        })
        .select('guest_id')
        .single();

      if (guestErr || !insertedGuest) {
        throw new Error(guestErr?.message ?? 'Could not auto-create guest row.');
      }

      linkedGuestId = (insertedGuest as { guest_id: string }).guest_id;
    }

    const updatePatch: {
      invitation_status: 'accepted' | 'declined';
      responded_at: string;
      linked_guest_id?: string | null;
      decline_note?: string | null;
    } = {
      invitation_status: status,
      responded_at: new Date().toISOString(),
    };
    if (status === 'accepted' && linkedGuestId) {
      updatePatch.linked_guest_id = linkedGuestId;
    }
    if (status === 'declined') {
      updatePatch.decline_note = declineNote;
    }

    const { error: updErr } = await admin
      .from('event_sponsors')
      .update(updatePatch)
      .eq('id', sponsorId)
      .eq('event_id', eventId);

    if (updErr) {
      throw new Error(updErr.message || 'Could not record response.');
    }

    revalidatePath(`/dashboard/${eventId}/sponsors`);
    revalidatePath(`/dashboard/${eventId}/guests`);
    redirect(
      `/dashboard/${eventId}/sponsors?${status === 'accepted' ? 'accepted' : 'declined'}=1`,
    );
  } catch (e) {
    if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
    redirect(
      `/dashboard/${eventId}/sponsors?error=${encodeURIComponent((e as Error).message.slice(0, 120))}`,
    );
  }
}

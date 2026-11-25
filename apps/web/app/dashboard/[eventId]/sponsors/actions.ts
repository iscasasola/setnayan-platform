'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseSponsorTier, parseSponsorSide, sponsorGuestSide } from '@/lib/event-sponsors';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SPONSOR_ROLE_BY_TIER, sponsorTierOfRole, takeSponsorRole } from '@/lib/sponsor-guests';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { generateEventConnections } from '@/app/dashboard/(account)/people/actions';
import { refuseLimitedHelper, requireHostMembershipOrThrow } from '@/lib/host-gate';

/**
 * Iteration · Principal + Secondary Sponsor coordination — server actions.
 *
 * 👥 SPONSORS ARE GUESTS (owner, brief Add 41 · final check A2-I14): every action here writes the GUEST LIST — a
 * sponsor is a guest with a sponsor role (`lib/sponsor-guests.ts`). `event_sponsors` is a read-only record since
 * migration 20271363480132; nothing here writes it. `sponsor_id` is the guest's id.
 * Per CLAUDE.md 2026-05-22 row "Principal Sponsor list builder".
 *
 * All form actions go through requireSponsorHost() — caller must be an
 * accepted host (event_moderators) OR a legacy event_members 'couple' row.
 * Mirrors the same gate as /dashboard/[eventId]/hosts (iteration 0048 V1).
 */

// The shared throwing host gate (lib/host-gate.ts) with this page's own words — this file carried a copy.
const requireSponsorHost = (eventId: string): Promise<string> =>
  requireHostMembershipOrThrow(eventId, 'Forbidden — only current hosts can manage sponsors.');

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

/** The plain sentence for a refused save — the database's own words go to the log (SW-RAWDB). */
const NOT_SAVED = 'That sponsor could not be saved. Nothing changed — please try again.';

function back(eventId: string, query: string): never {
  redirect(`/dashboard/${eventId}/sponsors?${query}`);
}

function refused(eventId: string, e: unknown): never {
  if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
  const own = e instanceof Error && (e as Error & { plain?: boolean }).plain ? e.message : NOT_SAVED;
  back(eventId, `error=${encodeURIComponent(own.slice(0, 120))}`);
}

/** Our own sentence for a person — said as is (never the database's). */
function plain(message: string): Error {
  return Object.assign(new Error(message), { plain: true });
}

function revalidateSponsors(eventId: string): void {
  revalidatePath(`/dashboard/${eventId}/sponsors`);
  revalidatePath(`/dashboard/${eventId}/guests`);
}

type GuestRoleRow = { guest_id: string; role: string; extra_roles: string[] | null };

/**
 * Add a sponsor: a NEW guest on the list with the sponsor role (one form for every tier). The tier, side and walking
 * pair come from the slot the host pressed. A principal sponsor is `principal_sponsor` — ninong or ninang is set on the
 * guest by the couple, never guessed from the side (owner ruling 2026-09-15).
 */
export async function addSponsor(formData: FormData): Promise<void> {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = parseEventId(formData);
  try {
    await requireSponsorHost(eventId);

    const tier = parseSponsorTier(formData.get('sponsor_tier'));
    const side = parseSponsorSide(formData.get('side'));
    const fullName = clean(formData.get('full_name'), 200);
    if (fullName.length === 0) throw plain('Full name is required.');
    const relationshipNote = nullIfBlank(formData.get('relationship_note'), 200);
    const email = nullIfBlank(formData.get('email'), 200);
    const phone = nullIfBlank(formData.get('phone'), 40);
    const pairIndex = tier === 'principal' ? parsePairIndex(formData.get('pair_index')) : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw plain('Email looks invalid.');

    const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
    const admin = createAdminClient();
    const { error } = await admin.from('guests').insert({
      event_id: eventId,
      first_name: firstName ?? fullName,
      last_name: rest.length > 0 ? rest.join(' ') : '—',
      side: sponsorGuestSide(side),
      group_category: 'family', // sponsors are family-tier by convention
      role: SPONSOR_ROLE_BY_TIER[tier],
      email,
      mobile: phone,
      notes: relationshipNote,
      entourage_order: pairIndex,
      photo_consent: true,
      invited_to_blocks: ['ceremony', 'reception'],
    });
    if (error) {
      logQueryError('addSponsor (guests insert)', error, { event_id: eventId });
      throw new Error('insert refused');
    }

    revalidateSponsors(eventId);
    back(eventId, `added=1#tier-${tier}`);
  } catch (e) {
    refused(eventId, e);
  }
}

/**
 * Update a sponsor's name, contact and note — on their guest row. Tier and side stay as they are; moving tiers is
 * remove + add.
 */
export async function updateSponsor(formData: FormData): Promise<void> {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = parseEventId(formData);
  const guestId = clean(formData.get('sponsor_id'), 40);
  if (!guestId) redirect(`/dashboard/${eventId}/sponsors`);
  try {
    await requireSponsorHost(eventId);

    const fullName = clean(formData.get('full_name'), 200);
    if (fullName.length === 0) throw plain('Full name is required.');
    const relationshipNote = nullIfBlank(formData.get('relationship_note'), 200);
    const email = nullIfBlank(formData.get('email'), 200);
    const phone = nullIfBlank(formData.get('phone'), 40);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw plain('Email looks invalid.');

    const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('guests')
      .update({
        first_name: firstName ?? fullName,
        last_name: rest.length > 0 ? rest.join(' ') : '—',
        notes: relationshipNote,
        email,
        mobile: phone,
      })
      .eq('guest_id', guestId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .select('guest_id');
    if (error || !data?.length) {
      if (error) logQueryError('updateSponsor (guests update)', error, { event_id: eventId });
      throw new Error('update refused');
    }

    revalidateSponsors(eventId);
    back(eventId, 'updated=1');
  } catch (e) {
    refused(eventId, e);
  }
}

/**
 * Remove a sponsor: the sponsor ROLE leaves their guest row; the person stays on the guest list (their reply, seat and
 * invitation are theirs). Removing them from the list is the guest list's own Delete.
 */
export async function removeSponsor(formData: FormData): Promise<void> {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = parseEventId(formData);
  const guestId = clean(formData.get('sponsor_id'), 40);
  if (!guestId) redirect(`/dashboard/${eventId}/sponsors`);
  try {
    await requireSponsorHost(eventId);
    const admin = createAdminClient();
    const { data: row, error: readErr } = await admin
      .from('guests')
      .select('guest_id, role, extra_roles')
      .eq('guest_id', guestId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .maybeSingle();
    if (readErr || !row) {
      if (readErr) logQueryError('removeSponsor (guests read)', readErr, { event_id: eventId });
      throw new Error('read refused');
    }
    const g = row as GuestRoleRow;
    const posted = formData.get('sponsor_tier');
    const tier = typeof posted === 'string' && posted ? parseSponsorTier(posted) : sponsorTierOfRole(g.role);
    if (!tier) throw plain('That guest is not a sponsor.');

    const { error } = await admin
      .from('guests')
      .update(takeSponsorRole(g, tier))
      .eq('guest_id', guestId)
      .eq('event_id', eventId);
    if (error) {
      logQueryError('removeSponsor (guests update)', error, { event_id: eventId });
      throw new Error('update refused');
    }

    revalidateSponsors(eventId);
    back(eventId, 'removed=1');
  } catch (e) {
    refused(eventId, e);
  }
}

/**
 * Mark the sponsor invitation as sent — on the guest row (`sponsor_asked_at`; never `invitation_sent_at`, which is the
 * formal RSVP invitation with one writer of its own). The message itself is the host's to send (they copy the template).
 */
export async function sendInvitation(formData: FormData): Promise<void> {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = parseEventId(formData);
  const guestId = clean(formData.get('sponsor_id'), 40);
  if (!guestId) redirect(`/dashboard/${eventId}/sponsors`);
  try {
    await requireSponsorHost(eventId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('guests')
      .update({ sponsor_asked_at: new Date().toISOString() })
      .eq('guest_id', guestId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .select('guest_id');
    if (error || !data?.length) {
      if (error) logQueryError('sendInvitation (guests update)', error, { event_id: eventId });
      throw new Error('update refused');
    }

    revalidateSponsors(eventId);
    back(eventId, 'invited=1');
  } catch (e) {
    refused(eventId, e);
  }
}

/**
 * Mark the sponsor's answer — the guest's own reply on their row: accepted → attending, declined → declined, set by
 * the guest (`rsvp_set_by: 'guest'`, as a sponsor's answer always was). The person was already on the guest list, so
 * nothing is created.
 */
export async function markResponse(formData: FormData): Promise<void> {
  await refuseLimitedHelper(formData.get('event_id'), null);
  const eventId = parseEventId(formData);
  const guestId = clean(formData.get('sponsor_id'), 40);
  if (!guestId) redirect(`/dashboard/${eventId}/sponsors`);
  const rawStatus = clean(formData.get('status'), 16);
  if (rawStatus !== 'accepted' && rawStatus !== 'declined') redirect(`/dashboard/${eventId}/sponsors`);
  const status = rawStatus as 'accepted' | 'declined';

  try {
    await requireSponsorHost(eventId);
    const admin = createAdminClient();
    const now = new Date().toISOString();
    // An answer means they were asked: keep the asked moment if there is one, else it is now (the consent gate for
    // naming a sponsor in public reads both — `acceptedTheNamedRole`).
    const { data: before, error: beforeErr } = await admin
      .from('guests')
      .select('sponsor_asked_at')
      .eq('guest_id', guestId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .maybeSingle();
    if (beforeErr || !before) {
      if (beforeErr) logQueryError('markResponse (guests read)', beforeErr, { event_id: eventId });
      throw new Error('read refused');
    }
    const { data, error } = await admin
      .from('guests')
      .update({
        rsvp_status: status === 'accepted' ? 'attending' : 'declined',
        rsvp_set_by: 'guest',
        rsvp_responded_at: now,
        sponsor_asked_at: (before as { sponsor_asked_at: string | null }).sponsor_asked_at ?? now,
      })
      .eq('guest_id', guestId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .select('guest_id, role, extra_roles');
    if (error || !data?.length) {
      if (error) logQueryError('markResponse (guests update)', error, { event_id: eventId });
      throw new Error('update refused');
    }

    // Phase 2 (person-graph · flag-off in prod): an accepted PRINCIPAL sponsor becomes a godparent connection
    // PROPOSAL. Idempotent + flag-guarded + host-authorized inside the action; never breaks the answer.
    const g = data[0] as GuestRoleRow;
    const principal = [g.role, ...(g.extra_roles ?? [])].some((r) => sponsorTierOfRole(r) === 'principal');
    if (status === 'accepted' && principal && peopleConnectionsEnabled()) {
      try {
        await generateEventConnections(eventId);
      } catch {
        /* non-blocking — edges regenerate idempotently on the next accept/edit */
      }
    }

    revalidateSponsors(eventId);
    back(eventId, `${status === 'accepted' ? 'accepted' : 'declined'}=1`);
  } catch (e) {
    refused(eventId, e);
  }
}

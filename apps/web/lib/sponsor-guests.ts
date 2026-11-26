import type { SupabaseClient } from '@supabase/supabase-js';
import type { GuestRole } from '@/lib/guests';
import type { SponsorInvitationStatus, SponsorSide, SponsorTier } from '@/lib/event-sponsors';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * 👥 SPONSORS ARE GUESTS — owner, brief Add 41 (25 Nov 2026, final check A2-I14): "One list; a sponsor is a guest with
 * the sponsor role." The Sponsors page reads and writes `guests` through this file; migration 20271363480132 linked or
 * copied every `event_sponsors` row into the guest list, and 20271364844438 drops that table (owner 27 Nov 2026).
 *
 *   · a guest is a sponsor of a tier when their `role` — or one of their `extra_roles` — is that tier's role;
 *   · principal is any of `principal_sponsor` (not yet specified) · `_ninong` · `_ninang`. Adding one writes
 *     `principal_sponsor`: which half of a pair is the couple's pick on the guest, never inferred from the side
 *     (owner ruling 2026-09-15, `sponsorRoleHonorific`);
 *   · the walking pair is `entourage_order`; the invitation's state is the guest's own reply (`rsvp_status`) plus
 *     whether they were asked to be a sponsor (`sponsor_asked_at` — never `invitation_sent_at`, the RSVP invitation's).
 */

export const SPONSOR_ROLE_BY_TIER: Readonly<Record<SponsorTier, GuestRole>> = {
  principal: 'principal_sponsor',
  cord: 'cord_sponsor',
  veil: 'veil_sponsor',
  coin: 'coin_sponsor',
  candle: 'candle_sponsor',
};

const TIER_BY_ROLE: Readonly<Partial<Record<GuestRole, SponsorTier>>> = {
  principal_sponsor: 'principal',
  principal_sponsor_ninong: 'principal',
  principal_sponsor_ninang: 'principal',
  cord_sponsor: 'cord',
  veil_sponsor: 'veil',
  coin_sponsor: 'coin',
  candle_sponsor: 'candle',
};

/** Every guest role that makes a guest a sponsor — the read's filter. */
export const SPONSOR_GUEST_ROLES: readonly GuestRole[] = Object.keys(TIER_BY_ROLE) as GuestRole[];

export function sponsorTierOfRole(role: string | null | undefined): SponsorTier | null {
  return (role && TIER_BY_ROLE[role as GuestRole]) || null;
}

/** The guest columns a sponsor is drawn from — a purpose-built sponsor read, NOT the guest list's canonical shape
 *  (named `…_FIELDS`, not `…_COLUMNS`, so the dup-rule guard does not take it for the guests table's one list). */
export const SPONSOR_GUEST_FIELDS =
  'guest_id, event_id, first_name, last_name, display_name, side, role, extra_roles, email, mobile, notes, rsvp_status, rsvp_set_by, rsvp_responded_at, sponsor_asked_at, entourage_order, created_at';

/** The columns a PUBLIC surface may read ("who was there"): a name, a role, a side and the reply — never an email, a
 *  phone or a private note. */
export const PUBLIC_SPONSOR_GUEST_FIELDS =
  'guest_id, event_id, first_name, last_name, display_name, side, role, extra_roles, rsvp_status, rsvp_set_by, rsvp_responded_at, sponsor_asked_at, entourage_order, created_at';

export type SponsorGuestRow = {
  guest_id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  side: string;
  role: string;
  extra_roles: string[] | null;
  email: string | null;
  mobile: string | null;
  notes: string | null;
  rsvp_status: string;
  rsvp_set_by: string | null;
  rsvp_responded_at: string | null;
  /** When the couple asked them to stand as a sponsor — not `invitation_sent_at` (the RSVP invitation's own). */
  sponsor_asked_at: string | null;
  entourage_order: number | null;
  created_at: string;
};

/** What the Sponsors page draws — the shape its cards and walks have always taken. `id` is the guest's id. */
export type GuestSponsor = {
  id: string;
  event_id: string;
  pair_index: number | null;
  sponsor_tier: SponsorTier;
  side: SponsorSide;
  full_name: string;
  relationship_note: string | null;
  email: string | null;
  phone: string | null;
  invitation_status: SponsorInvitationStatus;
  invitation_sent_at: string | null;
  responded_at: string | null;
  decline_note: string | null;
  linked_guest_id: string | null;
  /** The guest role this sponsor entry is — for a principal, the couple's own ninong / ninang / not yet specified. */
  role: GuestRole;
  /** Who set the reply: 'guest' (their own answer — a sponsor's acceptance is theirs) or 'host'; null = not said. */
  reply_set_by: string | null;
};

function invitationStatusOf(g: Pick<SponsorGuestRow, 'rsvp_status' | 'sponsor_asked_at'>): SponsorInvitationStatus {
  if (g.rsvp_status === 'attending') return 'accepted';
  if (g.rsvp_status === 'declined') return 'declined';
  return g.sponsor_asked_at ? 'invited' : 'pending';
}

function fullNameOf(g: Pick<SponsorGuestRow, 'first_name' | 'last_name' | 'display_name'>): string {
  const parts = [g.first_name, g.last_name === '—' ? '' : g.last_name].map((p) => (p ?? '').trim()).filter(Boolean);
  return parts.join(' ') || (g.display_name ?? '').trim();
}

/**
 * One guest → one sponsor per sponsor tier they hold (a guest may be a principal sponsor and carry the candle too).
 * Pure: the page's whole picture is decided here, so it is held by behaviour (`lib/sponsors-come-from-the-guest-list.test.ts`).
 */
export function sponsorsFromGuests(rows: readonly SponsorGuestRow[]): GuestSponsor[] {
  const out: GuestSponsor[] = [];
  for (const g of rows) {
    const tiers = new Map<SponsorTier, GuestRole>();
    for (const role of [g.role, ...(g.extra_roles ?? [])]) {
      const tier = sponsorTierOfRole(role);
      if (tier && !tiers.has(tier)) tiers.set(tier, role as GuestRole);
    }
    for (const [tier, role] of tiers) {
      out.push({
        id: g.guest_id,
        event_id: g.event_id,
        pair_index: tier === 'principal' ? g.entourage_order : null,
        sponsor_tier: tier,
        side: g.side === 'bride' || g.side === 'groom' ? g.side : 'neutral',
        full_name: fullNameOf(g),
        relationship_note: g.notes ?? null,
        email: g.email ?? null,
        phone: g.mobile ?? null,
        invitation_status: invitationStatusOf(g),
        invitation_sent_at: g.sponsor_asked_at,
        responded_at: g.rsvp_responded_at,
        decline_note: null,
        linked_guest_id: g.guest_id,
        role,
        reply_set_by: g.rsvp_set_by ?? null,
      });
    }
  }
  return out.sort(
    (a, b) => (a.pair_index ?? Number.MAX_SAFE_INTEGER) - (b.pair_index ?? Number.MAX_SAFE_INTEGER),
  );
}

/** The guest list's sponsors for one event, or `null` when the read was refused (the page says so — never "0 of N"). */
export async function readEventSponsorGuests(client: SupabaseClient, eventId: string): Promise<GuestSponsor[] | null> {
  const roles = SPONSOR_GUEST_ROLES.join(',');
  const { data, error } = await client
    .from('guests')
    .select(SPONSOR_GUEST_FIELDS)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .or(`role.in.(${roles}),extra_roles.ov.{${roles}}`)
    .order('created_at', { ascending: true });
  if (error) {
    logQueryError('readEventSponsorGuests', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  return sponsorsFromGuests((data ?? []) as SponsorGuestRow[]);
}

/**
 * The patch that makes an existing guest a sponsor of `tier` without taking anything away (the migration's own rule):
 * the plain 'guest' role becomes the sponsor role; any other role keeps its place and the sponsor role joins
 * `extra_roles` — unless they already hold that tier.
 */
export function giveSponsorRole(
  g: { role: string; extra_roles: string[] | null },
  tier: SponsorTier,
): { role?: GuestRole; extra_roles?: GuestRole[] } | null {
  const role = SPONSOR_ROLE_BY_TIER[tier];
  const held = [g.role, ...(g.extra_roles ?? [])].some((r) => sponsorTierOfRole(r) === tier);
  if (held) return null;
  if (g.role === 'guest') return { role };
  return { extra_roles: [...((g.extra_roles ?? []) as GuestRole[]), role] };
}

/** The patch that takes `tier` away and leaves the person on the guest list (a removed sponsor stays a guest). */
export function takeSponsorRole(
  g: { role: string; extra_roles: string[] | null },
  tier: SponsorTier,
): { role?: GuestRole; extra_roles?: GuestRole[] } {
  const extras = ((g.extra_roles ?? []) as GuestRole[]).filter((r) => sponsorTierOfRole(r) !== tier);
  const patch: { role?: GuestRole; extra_roles?: GuestRole[] } = { extra_roles: extras };
  if (sponsorTierOfRole(g.role) === tier) patch.role = 'guest';
  return patch;
}

/**
 * The sponsors of several events, in the `{ data, error }` shape a batched read expects — for the readers that used to
 * ask `event_sponsors` (Home's decision cockpit, the AI activity, "who was there"). One list: they read the guest list
 * now, so a sponsor added after the move is never missing from them. `error` is the read's own; `data` is null then.
 */
export async function querySponsorGuests(
  client: SupabaseClient,
  eventIds: readonly string[],
  opts: { publicOnly?: boolean } = {},
): Promise<{ data: GuestSponsor[] | null; error: { message: string } | null }> {
  if (eventIds.length === 0) return { data: [], error: null };
  const roles = SPONSOR_GUEST_ROLES.join(',');
  const { data, error } = await client
    .from('guests')
    .select(opts.publicOnly ? PUBLIC_SPONSOR_GUEST_FIELDS : SPONSOR_GUEST_FIELDS)
    .in('event_id', [...eventIds])
    .is('deleted_at', null)
    .or(`role.in.(${roles}),extra_roles.ov.{${roles}}`)
    .order('created_at', { ascending: true });
  if (error) return { data: null, error };
  return { data: sponsorsFromGuests((data ?? []) as unknown as SponsorGuestRow[]), error: null };
}

/**
 * 🔒 THE CONSENT GATE for naming a sponsor in public ("who was there"). A guest list is people typed in by somebody
 * else; nobody on it agreed to be named on a public page. A sponsor is named only when they were ASKED to stand in that
 * role (`sponsor_asked_at`) and ANSWERED YES THEMSELVES (attending, set by the guest) — an affirmative answer to an
 * invitation that named the role. An RSVP to the event alone is never that consent; neither is a host's mark.
 */
export function acceptedTheNamedRole(s: Pick<GuestSponsor, 'invitation_status' | 'invitation_sent_at' | 'reply_set_by'>): boolean {
  return s.invitation_status === 'accepted' && s.invitation_sent_at !== null && s.reply_set_by === 'guest';
}

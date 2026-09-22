import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { eventHasSides } from '@/lib/guest-side-question';
import {
  fetchGuestById,
  fetchSingletonRoleHolders,
  INVITED_TO_BLOCKS,
  type GuestRole,
  type GuestRow,
  type InvitedToBlock,
} from '@/lib/guests';
import { formatRecordedAt } from '@/lib/recorded-at';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';

/**
 * The base every guest's own invitation link (and NFC tag) is built from —
 * the event's public address WITHOUT the guest's token.
 *
 * It lives here rather than beside one of its two callers because BOTH the
 * roster page and the standalone guest route need it, and a second copy is a
 * second answer to "where does this guest's link point".
 */
export async function fetchInvitationBase(
  eventId: string,
  slug: string | null,
): Promise<string | null> {
  if (!slug) return null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId);
  return `${appUrl}${publicEventPath(slug, ownerSlug)}`;
}

/**
 * guest-card-data.ts — everything ONE guest card needs, loaded once.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * This is the loader that used to sit inline at the top of
 * `guests/[guestId]/page.tsx`. It moved here unchanged (same queries, same
 * degradation warnings, same derivations) the moment a SECOND frame started
 * rendering the same card: the roster's in-place panel. Two loaders for one
 * card is two places for the same fact to be wrong, so there is one.
 *
 * Every read below degrades rather than throws, and each `logQueryError` call
 * keeps the note about what a refusal would make the screen SAY — those
 * sentences are the reason the calls are there, so do not trim them.
 */

export type GroupChip = { label: string; teamSide: 'bride' | 'groom' | 'both' };

export type GuestCardData = {
  guest: GuestRow;
  /** Bride & groom: renamable, never deletable, always attending, role locked. */
  isCouple: boolean;
  /** Sides are a wedding idea — the role set decides whether we ask at all. */
  hasSides: boolean;
  /** Roles this event offers, minus the couple's and minus any already taken. */
  availableRoles: GuestRole[];
  /** INC weddings cap non-member principal sponsors at one pair (advisory). */
  isIncWedding: boolean;
  /** Chinese primary rite OR a tea ceremony over another rite. */
  showTeaCeremony: boolean;
  /** The +1 row's current state, or null when no +1 exists yet. */
  plusOneStateLabel: string | null;
  plusOneGuestId: string | null;
  /** The guest's saved invited-to blocks, filtered to values we still know. */
  initialInvited: InvitedToBlock[];
  /** Table label when this guest is seated, else null. */
  seatedAt: string | null;
  /** Custom group memberships, for the read-only Tags row. */
  customGroups: GroupChip[];
  /** When Setnayan learned the answer — already formatted, null when none. */
  recordedAt: string | null;
};

export async function loadGuestCard(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<GuestCardData | null> {
  const guest = await fetchGuestById(supabase, eventId, guestId);
  if (!guest) return null;

  // Hide bride/groom from the role dropdown if someone else already has
  // them — DB partial unique indexes enforce this regardless, but the UI
  // shouldn't offer an option that will fail on save.
  const singletonHolders = await fetchSingletonRoleHolders(supabase, eventId, guestId);
  const isCouple = guest.role === 'bride' || guest.role === 'groom';
  const roleSet = await resolveRoleSetForEvent(eventId);
  const hasSides = eventHasSides(roleSet);
  const availableRoles = roleSet.offeredRoles.filter(
    (r) => !roleSet.coupleRoles.has(r) && !(r in singletonHolders),
  );

  const { data: ceremonyRow, error: ceremonyRowError } = await supabase
    .from('events')
    // `secondary_ceremony_type` too: the common Tsinoy case is a CHURCH wedding
    // with a tea ceremony as the OVERLAY rite, and `isChineseWedding` matches
    // primary OR secondary. Reading only the primary would hide the tea-ceremony
    // field from exactly the couples who need it.
    .select('ceremony_type, secondary_ceremony_type')
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ the ceremony context this card reads against. Refused, it degrades silently.
  if (ceremonyRowError) {
    logQueryError('loadGuestCard.ceremonyRow', ceremonyRowError, { eventId, guestId }, 'graceful_degrade');
  }
  const showTeaCeremony = isChineseWedding(ceremonyRow);
  const isIncWedding = ceremonyRow?.ceremony_type === 'inc';

  const { data: plusOneRow, error: plusOneRowError } = await supabase
    .from('guests')
    .select('guest_id, first_name, last_name, plus_one_name_confirmed_at')
    .eq('event_id', eventId)
    .eq('plus_one_of_guest_id', guestId)
    .is('deleted_at', null)
    .maybeSingle();
  // ⚠ 🚨 A FALSE STATEMENT ABOUT A GUEST. Refused, this renders "Allowed but no +1
  // ⚠ has been added to the list yet" — telling the couple their guest has not named
  // ⚠ a plus-one when they may well have. Not an empty list: a claim about a person.
  if (plusOneRowError) {
    logQueryError('loadGuestCard.plusOneRow', plusOneRowError, { eventId, guestId }, 'graceful_degrade');
  }
  const plusOneStateLabel = plusOneRow
    ? plusOneRow.plus_one_name_confirmed_at
      ? `Bringing ${[plusOneRow.first_name, plusOneRow.last_name]
          .filter(Boolean)
          .join(' ')
          .trim()}`
      : 'Awaiting +1 to confirm their name'
    : null;

  // Filter to known valid InvitedToBlock values — schema column is
  // string[] so legacy data could contain stale block names.
  const initialInvited = (guest.invited_to_blocks ?? []).filter(
    (b): b is InvitedToBlock => (INVITED_TO_BLOCKS as readonly string[]).includes(b),
  );

  const { data: seatRow, error: seatRowError } = await supabase
    .from('event_seat_assignments')
    // 🔴 `table_label`, NOT `label`. There is no `label` column on
    // `event_tables` — PostgREST answers 42703 and REFUSES THE WHOLE QUERY.
    .select('table_id, event_tables(table_label)')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .maybeSingle();
  // ⚠ A SEATED GUEST READS AS UNSEATED. `seatedAt` falls to null on a refused read,
  // ⚠ so a guest the couple placed at a table shows no seat at all — and seating is
  // ⚠ some of the most laborious work in the product.
  if (seatRowError) {
    logQueryError('loadGuestCard.seatRow', seatRowError, { eventId, guestId }, 'graceful_degrade');
  }
  const seatedAt =
    seatRow && seatRow.event_tables
      ? // event_tables embed may come back as object OR array depending
        // on PostgREST's FK resolution; handle both shapes defensively.
        Array.isArray(seatRow.event_tables)
        ? ((seatRow.event_tables[0] as { table_label?: string } | undefined)?.table_label ?? null)
        : ((seatRow.event_tables as { table_label?: string }).table_label ?? null)
      : null;

  const { data: groupRows, error: groupRowsError } = await supabase
    .from('guest_group_memberships')
    .select('guest_groups(label, team_side)')
    .eq('guest_id', guestId);
  // ⚠ the guest's group memberships. Refused, they read as belonging to no group,
  // ⚠ which is how a couple loses track of who is with whom.
  if (groupRowsError) {
    logQueryError('loadGuestCard.groupRows', groupRowsError, { eventId, guestId }, 'graceful_degrade');
  }
  const customGroups: GroupChip[] = (groupRows ?? [])
    .map((row) => {
      const gg = row.guest_groups;
      const single = Array.isArray(gg) ? gg[0] : gg;
      if (!single || typeof single !== 'object') return null;
      return {
        label: (single as { label?: string }).label ?? '',
        teamSide:
          ((single as { team_side?: string }).team_side as GroupChip['teamSide']) ?? 'both',
      };
    })
    .filter((g): g is GroupChip => g !== null && g.label !== '');

  return {
    guest,
    isCouple,
    hasSides,
    availableRoles,
    isIncWedding,
    showTeaCeremony,
    plusOneStateLabel,
    plusOneGuestId: plusOneRow?.guest_id ?? null,
    initialInvited,
    seatedAt,
    customGroups,
    recordedAt: formatRecordedAt(guest.rsvp_responded_at),
  };
}

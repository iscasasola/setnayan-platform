'use server';

/**
 * inline-actions.ts — single-guest server actions for the Living Roster's
 * IN-PLACE chip editors + capture bar (P2).
 *
 * Until now, editing one guest's side / RSVP / role / plus-one / groups meant
 * either the bulk `SelectionBar` or a full navigation to the `[guestId]` detail
 * page. These actions wire those same edits to the roster row's inline popovers
 * — so a click on a chip mutates one guest and the page revalidates in place, no
 * route change.
 *
 * They return a small `{ ok } | { ok, error }` result (NOT a redirect) so the
 * client can apply the optimistic overlay + surface an inline error toast
 * without a navigation. The field logic, validation and RLS are ported VERBATIM
 * from the canonical sources so this path can never drift softer than them:
 *   • side / RSVP / plus-one  ← `[guestId]/actions.ts › updateGuest`
 *   • role                    ← `quick-add-actions.ts › setGuestPrimaryRole`
 *   • single add              ← `quick-add-actions.ts › quickAddGuest`
 * All writes use the RLS-scoped couple client (`createClient`), exactly like
 * `updateGuest`; RLS is what confines the couple to their own event's guests.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  type GuestRole,
  type GuestSide,
  type RsvpStatus,
} from '@/lib/guests';
import type { ReleasedSeat } from '@/lib/guest-optimistic';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import type { ParsedGuestDraft } from '@/lib/guest-parse';
import {
  quickAddGuest,
  quickCreateGroup,
  setGuestPrimaryRole,
  type QuickAddResult,
} from './quick-add-actions';

// Mirrors the closed sets in `[guestId]/actions.ts` — do not widen.
const SIDE_VALUES: GuestSide[] = ['bride', 'groom', 'both'];
const RSVP_VALUES: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];

export type InlineResult = { ok: true } | { ok: false; error: string };

const guestsPath = (eventId: string) => `/dashboard/${eventId}/guests`;

/** Set one guest's side (bride / groom / both). Ported from `updateGuest`. */
export async function setGuestSide(
  eventId: string,
  guestId: string,
  side: GuestSide,
): Promise<InlineResult> {
  if (!SIDE_VALUES.includes(side)) return { ok: false, error: 'Pick a valid side.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('guests')
    .update({ side, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(guestsPath(eventId));
  return { ok: true };
}

/**
 * Set one guest's RSVP. Ported from `updateGuest`:
 *  • bride & groom are coerced to `attending` (owner directive 2026-06-03 + the
 *    DB trigger) — the returned `effective` lets the caller reconcile its
 *    optimistic overlay to the coerced value.
 *  • `rsvp_responded_at` is stamped for attending/declined, cleared otherwise.
 *  • declining AUTO-FREES the guest's seat via the live `free_seat_on_decline`
 *    DB trigger (owner-locked 2026-06-22). Living Roster P3: we READ that seat
 *    BEFORE the update (the trigger deletes it as part of the decline write) and
 *    return it as `freedSeat`, so the client can offer an undo that restores BOTH
 *    the RSVP and the exact chair. `freedSeat` is null on every non-decline path
 *    (and when the guest wasn't seated).
 */
export async function setGuestRsvp(
  eventId: string,
  guestId: string,
  rsvp: RsvpStatus,
): Promise<
  | { ok: true; effective: RsvpStatus; freedSeat: ReleasedSeat | null }
  | { ok: false; error: string }
> {
  if (!RSVP_VALUES.includes(rsvp)) return { ok: false, error: 'Pick a valid RSVP.' };

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from('guests')
    .select('role')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('deleted_at', null)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row) return { ok: false, error: 'Couldn’t find that guest.' };

  const effective: RsvpStatus =
    row.role === 'bride' || row.role === 'groom' ? 'attending' : rsvp;

  // Capture the seat the impending decline will free (the trigger fires on the
  // rsvp→declined edge, so the assignment is still present until the update
  // below). Only when the EFFECTIVE rsvp is declined — the couple never decline,
  // so they never free a seat here.
  let freedSeat: ReleasedSeat | null = null;
  if (effective === 'declined') {
    const { data: seat } = await supabase
      .from('event_seat_assignments')
      .select('table_id, seat_number, locked')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .maybeSingle();
    if (seat) {
      freedSeat = {
        guest_id: guestId,
        table_id: seat.table_id as string,
        seat_number: (seat.seat_number as number | null) ?? null,
        locked: (seat.locked as boolean | null) ?? false,
      };
    }
  }

  const { error } = await supabase
    .from('guests')
    .update({
      rsvp_status: effective,
      rsvp_responded_at: ['attending', 'declined'].includes(effective)
        ? new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(guestsPath(eventId));
  return { ok: true, effective, freedSeat };
}

/**
 * Undo the reactive decline (Living Roster P3): restore the guest's PRIOR RSVP
 * and re-place the seat the decline freed. The inverse of `setGuestRsvp('declined')`.
 *
 * The `free_seat_on_decline` trigger only fires on the decline EDGE, so writing
 * the RSVP back to a non-declined value doesn't re-free anything — the seat
 * re-insert is safe. Seat restore is BEST-EFFORT, mirroring P1's
 * `restoreDeletedGuests`: a single upsert on (event_id, guest_id) so a retry is
 * idempotent, and a re-taken chair (23505 on the PARTIAL chair-unique index —
 * which `onConflict:'event_id,guest_id'` can't resolve) is treated as benign, so
 * the guest is restored UNSEATED rather than the whole undo crashing. RLS:
 * `event_seat_assignments_couple_write` is FOR ALL, so the couple may re-insert
 * (verified in P1) — the trigger is SECURITY DEFINER only because *guests* can't.
 */
export async function restoreGuestRsvpAndSeat(
  eventId: string,
  guestId: string,
  priorRsvp: RsvpStatus,
  freedSeat: ReleasedSeat | null,
): Promise<InlineResult> {
  if (!RSVP_VALUES.includes(priorRsvp)) return { ok: false, error: 'Pick a valid RSVP.' };

  const supabase = await createClient();

  // 1. Restore the RSVP. A declined guest is never the couple, so no coercion.
  const { error: rsvpErr } = await supabase
    .from('guests')
    .update({
      rsvp_status: priorRsvp,
      rsvp_responded_at: ['attending', 'declined'].includes(priorRsvp)
        ? new Date().toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (rsvpErr) return { ok: false, error: rsvpErr.message };

  // 2. Re-place the freed chair — best-effort.
  if (freedSeat && freedSeat.table_id) {
    const { error: seatErr } = await supabase
      .from('event_seat_assignments')
      .upsert(
        [
          {
            event_id: eventId,
            guest_id: guestId,
            table_id: freedSeat.table_id,
            seat_number: freedSeat.seat_number,
            locked: freedSeat.locked,
          },
        ],
        { onConflict: 'event_id,guest_id' },
      );
    // 23505 = the exact chair was re-taken during the undo window → benign, the
    // guest is restored unseated. Any other error is likewise non-fatal (the
    // RSVP is already back), but we log it so a real regression is visible.
    if (seatErr && (seatErr as { code?: string }).code !== '23505') {
      logQueryError(
        'restoreGuestRsvpAndSeat (seat re-place)',
        seatErr,
        { event_id: eventId, guest_id: guestId },
        'graceful_degrade',
      );
    }
  }

  revalidatePath(guestsPath(eventId));
  return { ok: true };
}

/**
 * Set one guest's PRIMARY role. Delegates to the canonical
 * `setGuestPrimaryRole` (quick-add-actions) so the offered-role validation,
 * the singleton bride/groom 23505 handling, and the seat-plan re-place run
 * IDENTICALLY to the quick-add path — this wrapper only normalises the result
 * shape for the inline editors.
 */
export async function setGuestRole(
  eventId: string,
  guestId: string,
  role: GuestRole,
): Promise<InlineResult> {
  const res = await setGuestPrimaryRole(eventId, guestId, role);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/**
 * Set whether a guest may bring a plus-one. Ported from `updateGuest`'s
 * `plus_one_allowed` toggle — the real schema models plus-ones as a boolean
 * permission (+ a separate name/RSVP the +1 fills on the public widget), not a
 * count, so the capture bar's parsed `plusOnes` maps to `allowed = n > 0`.
 * Toggling OFF is non-destructive (an already-linked +1 row is left intact,
 * matching `updateGuest`).
 */
export async function setGuestPlusOnes(
  eventId: string,
  guestId: string,
  plusOnes: number,
): Promise<InlineResult> {
  const allowed = Number.isFinite(plusOnes) && plusOnes > 0;

  const supabase = await createClient();
  const { error } = await supabase
    .from('guests')
    .update({ plus_one_allowed: allowed, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(guestsPath(eventId));
  return { ok: true };
}

/**
 * Add a guest to an existing custom group. Ported from `quickAddGuest`'s
 * sticky-group membership upsert: verify the group belongs to this event (RLS
 * guards too) before the idempotent membership upsert.
 */
export async function addGuestToGroup(
  eventId: string,
  guestId: string,
  groupId: string,
): Promise<InlineResult> {
  const gid = (groupId ?? '').trim();
  if (!gid) return { ok: false, error: 'Pick a group.' };

  const supabase = await createClient();
  // Gate BOTH sides on this event before writing the membership. RLS on
  // guest_group_memberships (couple_writes_membership) only scopes group_id, and
  // the table has no event_id column, so a bare guest_id from the payload would
  // otherwise let a couple attach another event's guest to their own group (the
  // FK resolves against the GLOBAL guests table). Mirror the g.event_id ===
  // eventId check the canonical single-guest role actions use.
  const [{ data: groupRow }, { data: guestRow }] = await Promise.all([
    supabase.from('guest_groups').select('event_id').eq('group_id', gid).maybeSingle(),
    supabase.from('guests').select('event_id').eq('guest_id', guestId).maybeSingle(),
  ]);
  if (!groupRow || groupRow.event_id !== eventId) {
    return { ok: false, error: 'That group isn’t part of this event.' };
  }
  if (!guestRow || guestRow.event_id !== eventId) {
    return { ok: false, error: 'Couldn’t find that guest.' };
  }

  const { error } = await supabase
    .from('guest_group_memberships')
    .upsert([{ group_id: gid, guest_id: guestId }], {
      onConflict: 'group_id,guest_id',
      ignoreDuplicates: true,
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath(guestsPath(eventId));
  return { ok: true };
}

/**
 * Capture-bar single add. The pure parser (`lib/guest-parse.ts`) has already
 * split the line into a draft; this action lands it, reusing the canonical
 * quick-add validation + insert VERBATIM and layering the capture grammar's two
 * extras on top (multiple `#groups`, a `+N` plus-one permission):
 *
 *   1. `roleHint` is mapped to a concrete primary role ONLY when it's offered
 *      for this event type (`resolveRoleSetForEvent`), else it falls back to
 *      `guest` — so a wedding typing `vip` (no such wedding role) still adds a
 *      plain guest rather than erroring, and a generic event's `vip` sticks.
 *   2. Every `#Group` is find-or-created (`quickCreateGroup`, case-insensitively
 *      idempotent); the first seeds `quickAddGuest`'s seat clustering, the rest
 *      are attached as memberships.
 *   3. `plusOnes > 0` flips `plus_one_allowed` on afterwards.
 */
export async function addSingleGuest(
  eventId: string,
  draft: ParsedGuestDraft,
): Promise<QuickAddResult> {
  // Resolve/create the parsed group names → ids up front (order preserved).
  const groupIds: string[] = [];
  for (const name of draft.groups) {
    const res = await quickCreateGroup(eventId, name);
    if (res.ok && !groupIds.includes(res.group.group_id)) {
      groupIds.push(res.group.group_id);
    }
    // A group we couldn't create/find just isn't attached — the add proceeds.
  }

  // Map the role hint to a real role only when the event offers it (else guest).
  let role: GuestRole = 'guest';
  if (draft.roleHint) {
    const roleSet = await resolveRoleSetForEvent(eventId);
    if (roleSet.offeredRoles.includes(draft.roleHint)) role = draft.roleHint;
  }

  // Core insert + validation (names required, side valid, finalize gate, the
  // bride/groom singleton 23505 message, the auto-place reconcile) — verbatim.
  const added = await quickAddGuest(eventId, {
    first_name: draft.firstName,
    last_name: draft.lastName,
    side: draft.side,
    role,
    group_id: groupIds[0] ?? null,
  });
  if (!added.ok) return added;

  const guestId = added.guest.guest_id;
  const supabase = await createClient();

  // Extra groups beyond the first (which quickAddGuest already attached).
  for (const gid of groupIds.slice(1)) {
    await supabase
      .from('guest_group_memberships')
      .upsert([{ group_id: gid, guest_id: guestId }], {
        onConflict: 'group_id,guest_id',
        ignoreDuplicates: true,
      });
  }

  // Plus-one permission from the parsed `+N`.
  if (draft.plusOnes > 0) {
    await supabase
      .from('guests')
      .update({ plus_one_allowed: true, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('guest_id', guestId);
  }

  revalidatePath(guestsPath(eventId));
  return added;
}

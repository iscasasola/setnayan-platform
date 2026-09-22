'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { redirect } from 'next/navigation';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { readKeepLine, type KeepLine } from '@/lib/unlisted-guests';
import { quickCreateGroup } from '../quick-add-actions';
import { checkExtraSeats, syncExtraSeats } from '@/lib/extra-seats-sync';

/** Back to the page with a sentence the couple can act on. */
function back(eventId: string, message: string): never {
  redirect(`/dashboard/${eventId}/guests/claims?error=${encodeURIComponent(message)}`);
}

/**
 * Invite/Join v2 reconcile actions (0000 ADDENDUM 2026-06-25).
 *
 * Unlisted joiners are optimistically admitted as `guests` rows tagged
 * `entry_source = 'self_added_unlisted'`. This surface lets the couple reconcile
 * them: KEEP (promote to a normal list member), REMOVE (soft-delete + revoke the
 * account membership), or LINK (merge into an existing guest already on the list).
 */

/** Throw unless the caller is a couple member of this event. */
async function assertCouple(eventId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');
  const supabase = await createClient();
  const { data } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!data) throw new Error('forbidden');
  return user;
}

/** Read + validate the guest_id from the form, scoped to an unlisted row. */
async function readUnlistedGuest(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  formData: FormData,
) {
  const guestId = String(formData.get('guest_id') ?? '');
  if (!guestId) return null;
  const { data } = await admin
    .from('guests')
    .select('guest_id, entry_source, deleted_at')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!data || data.deleted_at || data.entry_source !== 'self_added_unlisted') return null;
  return data.guest_id as string;
}

/**
 * KEEP: promote an unlisted joiner to a normal list member — with the name,
 * side, role and group the couple chose (owner 2026-09-21: "allow manual add to
 * list where you can choose their role, group, side, and name"). Every choice
 * is re-checked here against what this event offers (`readKeepChoice`).
 */
export async function keepGuestAction(eventId: string, formData: FormData) {
  await assertCouple(eventId);
  const admin = createAdminClient();
  const guestId = await readUnlistedGuest(admin, eventId, formData);
  if (!guestId) {
    revalidatePath(`/dashboard/${eventId}/guests/claims`);
    return;
  }

  // ⚖ Owner 2026-09-21: "a quick add text box … same function as the quick add
  // on the guestlist" — one line, the capture bar's grammar (`readKeepLine`).
  const { offeredRoles } = await resolveRoleSetForEvent(eventId);
  const choice = readKeepLine(String(formData.get('line') ?? ''), String(formData.get('role') ?? ''), offeredRoles);
  if (!choice.ok) back(eventId, choice.error);
  const chosen = (choice as { ok: true; value: KeepLine }).value;

  // 🔒 This path writes with the ADMIN client, which the database's own
  // finalized-list lock lets through (it exempts service_role). So the seat
  // rule is asked explicitly, before anything is saved (owner 2026-09-21).
  if (chosen.plusOnes > 0) {
    const seatCheck = await checkExtraSeats(admin, eventId, guestId, chosen.plusOnes);
    if (!seatCheck.ok) back(eventId, seatCheck.error);
  }

  // Promote out of the reconcile queue. Drop the legacy self_joined tag too so
  // the row reads as a clean host-list member.
  const { data: row } = await admin
    .from('guests')
    .select('custom_tags')
    .eq('guest_id', guestId)
    .maybeSingle();
  const tags = ((row?.custom_tags as string[] | null) ?? []).filter((t) => t !== 'self_joined');

  const { error: keepErr } = await admin
    .from('guests')
    .update({
      entry_source: 'host_seeded',
      custom_tags: tags,
      first_name: chosen.first_name,
      last_name: chosen.last_name,
      name_prefix: chosen.prefix || null,
      middle_name: chosen.middle_name || null,
      name_suffix: chosen.suffix || null,
      // The name they typed on joining was a display name; the couple's choice
      // replaces it, so the list shows what the couple wrote.
      display_name: null,
      side: chosen.side,
      role: chosen.role,
      updated_at: new Date().toISOString(),
    })
    .eq('guest_id', guestId)
    .eq('event_id', eventId);
  if (keepErr) {
    // 23505 = a singleton role (one Best Man, one Maid of Honour…) is taken.
    back(
      eventId,
      (keepErr as { code?: string }).code === '23505'
        ? 'Someone on your list already has that role — pick another.'
        : 'They could not be added just now — nothing was changed.',
    );
  }
  // #Groups — found or made, on this guest's side, exactly as the guest list's
  // quick add does (`quickCreateGroup` is case-insensitively idempotent).
  for (const label of chosen.groups) {
    const made = await quickCreateGroup(eventId, label, chosen.side);
    if (!made.ok) back(eventId, `Added to your list, but not to #${label}: ${made.error}`);
    const groupId = (made as { ok: true; group: { group_id: string } }).group.group_id;
    const { error: memberErr } = await admin
      .from('guest_group_memberships')
      .upsert([{ group_id: groupId, guest_id: guestId }], {
        onConflict: 'group_id,guest_id',
        ignoreDuplicates: true,
      });
    if (memberErr) back(eventId, `Added to your list, but not to #${label} — add them from the guest list.`);
  }

  // +N — the extra seats, beside them (owner 2026-09-21).
  if (chosen.plusOnes > 0) {
    const { error: plusErr } = await admin
      .from('guests')
      .update({ plus_one_count: chosen.plusOnes, updated_at: new Date().toISOString() })
      .eq('guest_id', guestId)
      .eq('event_id', eventId);
    if (plusErr) back(eventId, 'Added to your list, but their extra seats were not saved — set them from the guest list.');
    const seats = await syncExtraSeats(admin, eventId, guestId);
    if (!seats.ok) back(eventId, `Added to your list, but their seats were not made: ${seats.error}`);
  }

  // Smart seat-plan Phase 5: a kept joiner is now a real list member — gap-fill
  // them into a provisional seat if they don't have one.
  await applyReconcileForEvent(admin, eventId);

  revalidatePath(`/dashboard/${eventId}/guests/claims`);
  revalidatePath(`/dashboard/${eventId}/guests`);
}

/** REMOVE: soft-delete the unlisted guest and revoke any account membership. */
export async function removeGuestAction(eventId: string, formData: FormData) {
  await assertCouple(eventId);
  const admin = createAdminClient();
  const guestId = await readUnlistedGuest(admin, eventId, formData);
  if (!guestId) {
    revalidatePath(`/dashboard/${eventId}/guests/claims`);
    return;
  }

  // Revoke the account membership (signed-in joiner) — no-op for accountless
  // (cookie-only) joiners, who have no event_members row.
  /*
    🔇 THESE THREE WRITES DISCARDED THEIR ERRORS — C6, fixed 2026-09-22.

    A couple presses "not on our list". If any of the three fails, the guest
    stays on the list, keeps their seat, and possibly keeps account access to
    the celebration — and the screen says the removal worked. A refused write
    that renders as success is the disease this whole register is about; here
    it hands a stranger continued access.

    Each is reported with what DID and did not happen, because "removal failed"
    after two of three succeeded would send the couple looking for a guest who
    is half-gone.
  */
  const { error: memberDelErr } = await admin
    .from('event_members')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (memberDelErr) {
    back(eventId, 'We could not revoke their access — nothing was removed. Try again, or remove them from the guest list.');
  }

  // ── RELEASE THE SEAT BEFORE THE SOFT-DELETE ──────────────────────────────
  // `event_seat_assignments` has an ON DELETE CASCADE FK to `guests`, but we
  // SOFT-delete here (set `deleted_at`), so the cascade never fires. Every other
  // delete path in this app deletes the assignment explicitly for exactly this
  // reason (see "WHY THE SEAT IS DELETED EXPLICITLY" above
  // `bulkSoftDeleteGuestsForUndo` in ../groups-actions.ts);
  // these two claims paths did not, and the row was left behind.
  //
  // 🔑 AN ORPHANED ASSIGNMENT IS INVISIBLE AND STILL COUNTS. Both seat editors
  // join seats to LIVING guests, so the chair renders empty — but `computeAutoSeat`
  // and `reconcileProvisionalSeats` read `event_seat_assignments` directly, so
  // they still see it as occupied. That chair is never auto-filled again, and
  // nothing on screen says why. The unique constraint is only
  // (event_id, guest_id), so a manual drop onto it double-books the seat.
  //
  // Unlisted joiners DO get seats: `applyReconcileForEvent` gap-fills every
  // unseated non-declined guest regardless of `entry_source`, and it runs from
  // the public RSVP path — so this is reached in normal use, not an edge case.
  //
  // Best-effort and ordered first, matching the bulk path: a DELETE that affects
  // 0 rows is fine, and a guest row outliving a failed seat-DELETE is recoverable
  // (manual unassign) where the reverse is not.
  const { error: seatDelErr } = await admin
    .from('event_seat_assignments')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (seatDelErr) {
    back(eventId, 'Their access was revoked, but their seat could not be released — remove them from the seat plan.');
  }

  // Soft-delete the guest row (the list + reconcile queue both filter deleted_at).
  const { error: softDelErr } = await admin
    .from('guests')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('guest_id', guestId)
    .eq('event_id', eventId);
  if (softDelErr) {
    back(eventId, 'We could not remove them from your list — their access and seat were released, but the name is still there. Try again.');
  }

  revalidatePath(`/dashboard/${eventId}/guests/claims`);
  revalidatePath(`/dashboard/${eventId}/guests`);
}

/**
 * LINK: the unlisted joiner is actually someone already on the list (a different
 * spelling, a nickname). Merge them — move the joiner's account membership onto
 * the existing guest (inheriting that guest's host-assigned role), carry their
 * email over, then soft-delete the duplicate unlisted row.
 *
 * Guards: the target must be a real, non-deleted guest in this event, and we
 * never merge into a seat already claimed by a DIFFERENT account (the couple can
 * Remove instead). Accountless joiners have no membership to move — we still
 * carry the email + soft-delete the dupe; their device cookie pointed at the old
 * row, so they'd re-scan / use an email link to land on the merged guest.
 */
export async function linkGuestAction(eventId: string, formData: FormData) {
  await assertCouple(eventId);
  const admin = createAdminClient();
  const backTo = `/dashboard/${eventId}/guests/claims`;

  const sourceId = await readUnlistedGuest(admin, eventId, formData);
  const targetId = String(formData.get('target_guest_id') ?? '');
  if (!sourceId || !targetId || targetId === sourceId) {
    revalidatePath(backTo);
    return;
  }

  // Target must be a real, non-deleted guest in this event.
  const { data: target } = await admin
    .from('guests')
    .select('guest_id, email, role, deleted_at')
    .eq('guest_id', targetId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!target || target.deleted_at) {
    revalidatePath(backTo);
    return;
  }

  const [{ data: targetBinding }, { data: sourceMember }, { data: source }] = await Promise.all([
    admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('guest_id', targetId)
      .maybeSingle(),
    // ⚠ `id`, NOT `member_id` — public.event_members' primary key is `id`.
    // PostgREST 42703s the whole query, so `sourceMember` was ALWAYS null. Two
    // consequences, both silent:
    //   1. the "don't merge into a seat already claimed by a different account"
    //      guard below could never fire — a safety check that was never running;
    //   2. the membership hand-over never happened, so merging a duplicate guest
    //      left the joiner's account bound to the row that was merged away.
    admin
      .from('event_members')
      .select('id, user_id')
      .eq('event_id', eventId)
      .eq('guest_id', sourceId)
      .maybeSingle(),
    admin.from('guests').select('email').eq('guest_id', sourceId).maybeSingle(),
  ]);

  // Don't merge into a seat already claimed by a different account.
  if (targetBinding && sourceMember && targetBinding.user_id !== sourceMember.user_id) {
    revalidatePath(backTo);
    return;
  }

  // Carry the joiner's email onto the target if it has none.
  if (source?.email && !target.email) {
    // 🔇 C6. A lost email is a guest the couple can no longer reach — and with
    // 5 addresses across 146 guests, losing one is losing a fifth of them.
    const { error: emailErr } = await admin
      .from('guests')
      .update({ email: source.email, updated_at: new Date().toISOString() })
      .eq('guest_id', targetId)
      .eq('event_id', eventId);
    if (emailErr) {
      back(eventId, 'Merged, but their email address was not carried over — add it from the guest list.');
    }
  }

  // Move the joiner's account membership onto the target (inherit its role).
  // event_members carries the (event_id, guest_id) partial-unique backstop; the
  // target-unclaimed check above keeps this from colliding.
  if (sourceMember && !targetBinding) {
    // 🔇 C6. If this fails the account is still bound to a row about to be
    // soft-deleted, so the person silently loses access to the celebration.
    const { error: moveErr } = await admin
      .from('event_members')
      .update({ guest_id: targetId, role: (target.role as string) ?? 'guest' })
      .eq('id', sourceMember.id);
    if (moveErr) {
      back(eventId, 'We could not move their account across — they may lose access. Re-invite them from the guest list.');
    }
  }

  // Release the merged-away row's seat before soft-deleting it — same reason as
  // removeGuestAction above. A merge is MORE likely to strand one: the joiner was
  // gap-filled into a chair, and after the merge nobody is sitting in it.
  const { error: mergeSeatErr } = await admin
    .from('event_seat_assignments')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', sourceId);
  if (mergeSeatErr) {
    back(eventId, 'Merged, but the duplicate\u2019s seat was not released — check the seat plan for an empty chair.');
  }

  // Soft-delete the merged-away unlisted row.
  const { error: mergeDelErr } = await admin
    .from('guests')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('guest_id', sourceId)
    .eq('event_id', eventId);
  if (mergeDelErr) {
    back(eventId, 'Merged, but the duplicate is still on your list — remove it from the guest list.');
  }

  revalidatePath(backTo);
  revalidatePath(`/dashboard/${eventId}/guests`);
}

'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  BOOKED_VENDOR_STATUSES,
  SETTLED_ORDER_STATUSES,
  confirmationMatches,
  deletionIsBlocked,
} from '@/lib/event-deletion-gate';

/**
 * delete-actions.ts — removing a celebration for good.
 *
 * ─── WHY THIS EXISTS, AND WHY IT IS NOT A NEW MECHANISM ────────────────────
 * The database has ALWAYS permitted this. `couple_can_delete_event` (DELETE,
 * `authenticated`, `event_id IN current_couple_event_ids() OR is_admin()`) is
 * live in production, and migration `20271138150255` already moved the
 * address-hold into a BEFORE DELETE trigger precisely so that "no path present
 * or future can miss it, including one nobody has written yet".
 *
 * This is that path. Nothing here re-implements the hold, the cascade, or the
 * permission model — all three already ship. What was missing was a door.
 *
 * ─── THE GENTLE OPTION IS THE SIBLING, NOT THE ALTERNATIVE ─────────────────
 * `archive-actions.ts` calls put-away "the gentle option that delete is
 * measured against". That is a real design constraint, not a turn of phrase:
 * wherever this action is offered, PUT AWAY MUST BE OFFERED BESIDE IT AND
 * FIRST. Somebody tidying nine test events and somebody ending a wedding press
 * the same button, and only one of them can be given their answer back.
 *
 * ─── WHO ───────────────────────────────────────────────────────────────────
 * COUPLE MEMBERS ONLY — deliberately NARROWER than put-away, which admits
 * coordinators and accepted moderators. A co-host may tidy the list; a co-host
 * may not destroy somebody else's wedding. This also matches the RLS floor
 * exactly (`current_couple_event_ids()` is `member_type = 'couple'` ONLY, read
 * out of production by the object), so the app rule and the database rule say
 * the same thing rather than one silently over-promising.
 *
 * ⚠ RLS IS A FLOOR, NOT A SCOPE. `couple_can_delete_event` carries an
 * `OR is_admin()` disjunct so the admin console can share the policy, and
 * production already has a vendor who is also an admin. Leaning on RLS alone
 * would let an admin's ORDINARY session delete a stranger's wedding through a
 * couple-facing action. The explicit membership check below is the real gate.
 */


export type DeletionImpact = {
  eventName: string;
  /**
   * THREE STATES, and the third is the whole point:
   *   number → we counted it
   *   null   → we ASKED and the read FAILED
   *
   * A failed count must never reach the screen as `0`. This whole dialog is a
   * list of what a person is about to lose; a zero printed over a refused read
   * is the most expensive lie this product could tell, because it is read
   * immediately before an irreversible press. Same rule the home board learned
   * ("an empty state that lies is worse than a missing tile") and the Alaala
   * wall learned ("no photos yet" printed over a failed read).
   */
  guests: number | null;
  photos: number | null;
  bookedVendors: number | null;
  /** TRUE when money has moved and this event may not be self-deleted. */
  blocked: boolean;
  /** Why it is blocked, in the couple's words. Null when it is not. */
  blockedReason: string | null;
};

export type ImpactResult =
  | { ok: true; impact: DeletionImpact }
  | { ok: false; code: 'unauthorized' | 'not_found'; message: string };

export type DeleteResult =
  | { ok: true }
  | {
      ok: false;
      code: 'unauthorized' | 'not_found' | 'mismatch' | 'blocked' | 'failed';
      message: string;
    };

/**
 * Confirm the caller is a COUPLE member of this event and hand back the row.
 * Returns null for "not a couple member of an event that exists" — the caller
 * turns that into one message, because telling a stranger which of the two it
 * was is itself a disclosure.
 */
async function requireCoupleMember(
  eventId: string,
): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();

  /*
    🪤 SUPABASE DOES NOT THROW. An RLS refusal and "no such row" are the same
    shape here — `{ data: null, error: null }` — and a genuine transport error
    resolves with `{ error }` rather than raising. Treating an ERROR as "not a
    member" is the correct direction for a delete gate: unreadable means no.
  */
  if (error || !data) return null;
  return { userId: user.id };
}

/**
 * What disappears if this event is deleted — counted, never guessed.
 *
 * Fetched ON DEMAND when the dialog opens rather than on every board render:
 * three extra counts per card would be paid by every visit to My Events to
 * serve a dialog almost nobody opens.
 */
export async function getEventDeletionImpact(
  eventId: string,
): Promise<ImpactResult> {
  const trimmed = eventId.trim();
  if (!trimmed) {
    return { ok: false, code: 'not_found', message: 'Which celebration?' };
  }

  const member = await requireCoupleMember(trimmed);
  if (!member) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Only the people organising this celebration can remove it.',
    };
  }

  const admin = createAdminClient();

  const { data: eventRow, error: eventErr } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', trimmed)
    .maybeSingle();
  if (eventErr || !eventRow) {
    return {
      ok: false,
      code: 'not_found',
      message: 'We couldn’t find that celebration.',
    };
  }

  /*
    A count that FAILED comes back null, never 0 — see DeletionImpact. Written
    as four plain reads rather than one clever helper: each names its own table
    and filter, so what is being counted is readable at the call site.
  */
  const readCount = async (
    q: PromiseLike<{ count: number | null; error: unknown }>,
  ): Promise<number | null> => {
    try {
      const { count, error } = await q;
      if (error) return null;
      return count ?? 0;
    } catch {
      return null;
    }
  };

  const HEAD = { count: 'exact' as const, head: true };
  const [guests, photos, bookedVendors, settledOrders] = await Promise.all([
    readCount(admin.from('guests').select('*', HEAD).eq('event_id', trimmed)),
    readCount(
      admin.from('papic_photos').select('*', HEAD).eq('event_id', trimmed),
    ),
    readCount(
      admin
        .from('event_vendors')
        .select('*', HEAD)
        .eq('event_id', trimmed)
        .in('status', BOOKED_VENDOR_STATUSES),
    ),
    readCount(
      admin
        .from('orders')
        .select('*', HEAD)
        .eq('event_id', trimmed)
        .in('status', SETTLED_ORDER_STATUSES),
    ),
  ]);

  /*
    🔒 THE MONEY GATE FAILS CLOSED, AND THAT ASYMMETRY IS THE POINT.
    `settledOrders === null` means we could not check whether this couple has
    paid for anything. Every other count on this screen degrades to "we couldn't
    check" and lets the person decide; this one refuses. A paid service is the
    one thing on the list that is not theirs alone to destroy — it is a receipt,
    a BIR record and a support case — so an unmeasured answer takes the safe
    side. Same rule the admin work list learned: an UNMEASURED queue is not a
    clear one.
  */
  const blocked = deletionIsBlocked(settledOrders);
  const blockedReason = blocked
    ? settledOrders === null
      ? 'We couldn’t check whether anything has been paid for on this celebration, so we haven’t removed it. Please try again in a moment, or message us and we’ll sort it out.'
      : 'Something on this celebration has already been paid for, so it can’t be removed here. Put it away instead, or message us and we’ll help.'
    : null;

  return {
    ok: true,
    impact: {
      eventName: eventRow.display_name ?? 'this celebration',
      guests,
      photos,
      bookedVendors,
      blocked,
      blockedReason,
    },
  };
}

/**
 * Delete one event, for good.
 *
 * The typed confirmation is not decoration. This destroys the guest list, every
 * photograph, the schedule and the page guests hold a link to, and there is no
 * undo anywhere in the product. A dialog you can dismiss with one tap is the
 * wrong shape for that; typing the name is a second, deliberate act.
 */
export async function deleteOwnEvent(formData: FormData): Promise<DeleteResult> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  const typed = String(formData.get('confirm_name') ?? '').trim();
  if (!eventId) {
    return { ok: false, code: 'not_found', message: 'Which celebration?' };
  }

  const member = await requireCoupleMember(eventId);
  if (!member) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Only the people organising this celebration can remove it.',
    };
  }

  /*
    🔒 RE-CHECKED SERVER-SIDE, NOT TRUSTED FROM THE DIALOG. The impact read that
    populated the screen ran in a different request; a client that never opened
    it, or opened it an hour ago, must still meet the same gate. A guard that
    only runs where the UI chooses to call it is not a guard.
  */
  const impact = await getEventDeletionImpact(eventId);
  if (!impact.ok) return impact;
  if (impact.impact.blocked) {
    return {
      ok: false,
      code: 'blocked',
      message:
        impact.impact.blockedReason ??
        'This celebration can’t be removed here just now.',
    };
  }

  if (!confirmationMatches(typed, impact.impact.eventName)) {
    return {
      ok: false,
      code: 'mismatch',
      message: `Type ${impact.impact.eventName} exactly to remove it.`,
    };
  }

  /*
    🔒 THE ADDRESS IS HELD BY THE DATABASE, NOT HERE — and this action must NOT
    write that hold itself. `20271138150255` put it in a BEFORE DELETE trigger
    so every path holds the word; a second copy here would be a driftable
    duplicate of a rule that is already enforced where it cannot be missed.
    The admin action carries the same note for the same reason.

    The delete uses the admin client with the membership check above as the
    authorization — the house pattern named in `archive-actions.ts`.
  */
  const { data, error } = await createAdminClient()
    .from('events')
    .delete()
    .eq('event_id', eventId)
    .select('event_id');

  if (error) {
    console.error('[delete-event] delete failed', error);
    return {
      ok: false,
      code: 'failed',
      message: 'We couldn’t remove that just now. Please try again.',
    };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      code: 'not_found',
      message: 'We couldn’t find that celebration.',
    };
  }

  revalidatePath('/dashboard');
  return { ok: true };
}

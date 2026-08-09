import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdminProfile } from '@/lib/admin/admin-predicate';
import { resolveAreaLevel, type ModeratorPermissions } from '@/lib/delegate-areas';
import { isHostMemberType } from '@/app/[slug]/_lib/host-scope';
import {
  ADVANCE_REFUSED_BLOCK_NOT_ON_EVENT,
  ADVANCE_REFUSED_NOT_COORDINATOR,
} from '@/lib/run-of-show';

/**
 * WHO MAY ADVANCE THE RUN OF SHOW — the one definition, and the one place the
 * "booked coordinator" question is answered.
 *
 * Three things were wrong with the first cut of this gate, and all three are
 * repaired here:
 *
 *  (a) 🔴 THE MEMBER ARM ADMITTED GUESTS. It selected `member_type` and then
 *      never compared it (`if (memberRes.data) return true`). `event_members`
 *      is the event's PEOPLE table — a wedding guest who scanned the event QR
 *      has a row in it, readable by them — so every guest could advance the
 *      programme. This is verbatim the bug `app/[slug]/_lib/host-scope.ts` was
 *      written to kill, so its `isHostMemberType()` is what runs below rather
 *      than a thirteenth private definition of "host".
 *
 *  (b) 🔴 IT AUTHORIZED A DIFFERENT EVENT THAN THE RPC ACTED ON. The check took
 *      the caller-supplied `eventId`; `advance_schedule_block(p_block_id)`
 *      resolves the event from the BLOCK alone. Nothing bound them, so a
 *      supplier holding block ids from wedding V could create their own event W,
 *      pass the check on W, and advance V. `resolveBlockEventId` below reads the
 *      block's own `event_id` server-side; the caller authorizes on THAT.
 *
 *  (c) ⚠ TWO SURFACES DISAGREED ABOUT "BOOKED COORDINATOR". The client
 *      workspace and the floor console decided it from different tables whose
 *      lifecycles are offset — `vendor_schedule_pool_bookings` (a held date)
 *      vs `event_vendors.status IN ('contracted', …)` — so a real coordinator
 *      could pass one and fail the other, which reads as a control that does
 *      nothing. `isBookedCoordinatorOnEvent` is now the single source both use,
 *      and it is the SAME helper the server action's gate leans on, so a screen
 *      can no longer offer a button the action refuses.
 *
 * Every reader takes the Supabase client as a PARAMETER (the lib/panood-control
 * convention), so this module holds no secret, needs no `server-only`, and is
 * runnable under `tsx --test` with a stub.
 */

/**
 * The two refusal statuses, RE-EXPORTED from the pure module that also holds the
 * sentence for each. One declaration, so the status this gate writes and the
 * status the screens read can never be two hand-typed strings that drift.
 * `block_not_on_event` is kept distinct from the role refusal on purpose: they
 * mean different things to whoever reads the log.
 */
export {
  ADVANCE_REFUSED_NOT_COORDINATOR,
  ADVANCE_REFUSED_BLOCK_NOT_ON_EVENT,
} from '@/lib/run-of-show';

/**
 * The event ids returned by `current_coordinator_booked_event_ids()`.
 *
 * PostgREST returns a set-returning scalar function as a JSON array of scalars,
 * but a row-shaped result is tolerated too — WITHOUT naming a key, so this can
 * never be a guess about a column name that silently matches nothing.
 */
function toEventIds(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const row of data) {
    if (typeof row === 'string') {
      out.push(row);
    } else if (row && typeof row === 'object') {
      const first = Object.values(row as Record<string, unknown>).find(
        (v) => typeof v === 'string',
      );
      if (typeof first === 'string') out.push(first);
    }
  }
  return out;
}

/**
 * Is the caller the BOOKED COORDINATOR on this event? THE shared answer.
 *
 * Leans on the SECURITY DEFINER helper `current_coordinator_booked_event_ids()`
 * (migration 20271013100000 — `'coordinator' = ANY(vp.services)` over the booked
 * statuses) rather than re-querying `event_vendors`: a marketplace vendor cannot
 * read their own `event_vendors` row under RLS, so a hand-rolled copy would
 * silently answer "not booked" for everyone.
 *
 * Fails closed. Supabase RESOLVES with `{ error }` — it does not throw — so the
 * error is read explicitly; discarding it would make a rejected query
 * indistinguishable from an empty one.
 */
export async function isBookedCoordinatorOnEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  if (!eventId) return false;
  const { data, error } = await supabase.rpc('current_coordinator_booked_event_ids');
  if (error) return false;
  return toEventIds(data).includes(eventId);
}

/**
 * The event a timeline block actually belongs to — the value the advance RPC
 * will act on, read here so the permission can be bound to it.
 *
 * Tries the caller's own RLS client first (the couple, a delegate moderator and
 * a booked vendor all have a SELECT policy on `event_schedule_blocks`), then an
 * optional privileged client for the classes that do NOT — Setnayan admins have
 * no SELECT policy on this table at all, so a caller-only read would quietly
 * turn the admin arm of the gate into a dead branch.
 *
 * Reading the block's event id GRANTS nothing: authorization still runs against
 * whatever comes back.
 */
export async function resolveBlockEventId(
  supabase: SupabaseClient,
  privileged: SupabaseClient | null,
  blockId: string,
): Promise<string | null> {
  if (!blockId) return null;
  const read = async (client: SupabaseClient): Promise<string | null> => {
    const { data, error } = await client
      .from('event_schedule_blocks')
      .select('event_id')
      .eq('block_id', blockId)
      .maybeSingle();
    if (error) return null;
    const value = (data as { event_id?: unknown } | null)?.event_id;
    return typeof value === 'string' && value ? value : null;
  };
  const own = await read(supabase);
  if (own) return own;
  if (!privileged) return null;
  return read(privileged);
}

/**
 * May this caller advance THIS event's run of show?
 *
 * Arms, cheapest first (each is a read of the caller's OWN rows, so RLS is
 * satisfied; a read error degrades to "no", never to "yes"):
 *   1. HOST side — an `event_members` row whose `member_type` is a host one.
 *      ⚠ The row alone is not enough: `'guest'` and `'vendor'` are values of
 *      that same enum.
 *   2. delegate coordinator — accepted, non-removed `event_moderators` row whose
 *      permission grid resolves schedule:'edit'
 *   3. booked coordinator — `isBookedCoordinatorOnEvent` above
 *   4. Setnayan admin — the shared `isAdminProfile` predicate
 *
 * ⚠ Pass the event id RESOLVED FROM THE BLOCK, never a caller-supplied one.
 */
export async function mayAdvanceRunOfShow(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<boolean> {
  if (!userId || !eventId) return false;
  const [memberRes, delegateRes] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('event_moderators')
      .select('permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);

  // 1 · THE HOST SIDE. `isHostMemberType` is the shared couple/coordinator pair
  // — comparing the value is the whole fix, since a guest has a row here too.
  const memberType = (memberRes.data as { member_type?: unknown } | null)?.member_type;
  if (!memberRes.error && isHostMemberType(typeof memberType === 'string' ? memberType : null)) {
    return true;
  }

  // 2 · The delegate the owner directive admits (migration 20270917100000).
  if (
    !delegateRes.error &&
    resolveAreaLevel(
      (delegateRes.data?.permissions_json ?? null) as ModeratorPermissions | null,
      'schedule',
    ) === 'edit'
  ) {
    return true;
  }

  // 3 · THE NARROWING. `current_vendor_booked_event_ids()` (what the RPC's own
  // gate uses) is EVERY booked supplier — caterer and florist included. This is
  // the same query with the coordinator tile required.
  if (await isBookedCoordinatorOnEvent(supabase, eventId)) return true;

  // 4 · Setnayan staff.
  const { data: me, error: meError } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', userId)
    .maybeSingle();
  if (meError) return false;
  return isAdminProfile(me);
}

export type AdvanceAuthorization =
  | { ok: true; eventId: string }
  | { ok: false; status: string; message: string };

/**
 * THE WHOLE GATE, in one testable call: resolve the block's real event, refuse a
 * mismatch, then authorize against the RESOLVED event.
 *
 * `advanceScheduleBlock` is a thin wrapper over this on purpose — the ordering
 * IS the security property (resolve → compare → authorize → act), and a
 * property that lives inside a `'use server'` module cannot be exercised by a
 * unit test, which is how it came to be missing in the first place.
 */
export async function authorizeAdvance(
  supabase: SupabaseClient,
  privileged: SupabaseClient | null,
  userId: string,
  claimedEventId: string,
  blockId: string,
): Promise<AdvanceAuthorization> {
  const blockEventId = await resolveBlockEventId(supabase, privileged, blockId);
  // A block we cannot place is a block we do not touch, and a claimed event that
  // is not the block's event is the cross-event escalation itself.
  if (!blockEventId || !claimedEventId || blockEventId !== claimedEventId) {
    return {
      ok: false,
      status: ADVANCE_REFUSED_BLOCK_NOT_ON_EVENT,
      message: 'That moment is not part of this event.',
    };
  }
  if (!(await mayAdvanceRunOfShow(supabase, userId, blockEventId))) {
    return {
      ok: false,
      status: ADVANCE_REFUSED_NOT_COORDINATOR,
      message: 'Only the coordinator can advance the run of show.',
    };
  }
  return { ok: true, eventId: blockEventId };
}

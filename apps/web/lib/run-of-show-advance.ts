/**
 * run-of-show-advance.ts — the whole advance decision + call, with its clients
 * injected, so a test can drive it and watch what it does.
 *
 * ## Why this is not inline in the server action
 *
 * Two previous generations of this gate lived inside `app/_actions/run-of-show.ts`
 * and were defended only by assertions over that file's SOURCE. An adversarial
 * reviewer beat both with one sabotage: **keep the call, discard its result.**
 * Deleting the entire authorization left the suite green, because no test ever
 * ran the path and observed whether the database was touched.
 *
 * The decision now lives in a pure function (`run-of-show-advance-gate.ts`) and
 * the ORCHESTRATION lives here, taking its two clients as arguments. A test
 * passes stubs and asserts the thing that actually matters: **for a caller who
 * may not advance, `advance_schedule_block` is never called.** That cannot be
 * satisfied by a discarded result.
 *
 * The server action keeps only what a server action must: reading the session and
 * revalidating paths.
 */

import { resolveAreaLevel, type ModeratorPermissions } from '@/lib/delegate-areas';
import { isAdminProfile } from '@/lib/admin/admin-predicate';
import { decideMayAdvance } from '@/lib/run-of-show-advance-gate';

/** The status returned instead of touching the timeline when the caller may not. */
export const ADVANCE_REFUSED_NOT_COORDINATOR = 'not_the_coordinator';

export const ADVANCE_REFUSAL_MESSAGE = 'Only the coordinator can advance the run of show.';

export type AdvanceResult = {
  status: string;
  nextId?: string | null;
  message?: string;
};

/**
 * Minimal shapes we need. Deliberately structural rather than importing
 * `SupabaseClient` — the point is that a plain object can stand in.
 */
export type AdvanceClients = {
  /** The CALLER's client. Every read through it is RLS-scoped to them. */
  user: {
    from: (table: string) => any;
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  /** Service-role client, used ONLY to resolve which event a block belongs to. */
  admin: {
    from: (table: string) => any;
  };
};

/**
 * Resolve the event a block actually belongs to.
 *
 * 🔒 THE CALLER'S `eventId` IS NOT EVIDENCE. `advance_schedule_block` takes only
 * `p_block_id` and resolves the event from it, so authorizing against a
 * caller-supplied `eventId` authorizes one thing and acts on another: a supplier
 * holding block ids from wedding V who creates their own event W passes the check
 * on W and advances V, mid-ceremony. Nothing bound the two values.
 *
 * Read with the ADMIN client on purpose: under RLS the caller's own client would
 * simply see no row for a block they should not reach, which is indistinguishable
 * from a deleted block — it would hide the mismatch rather than refuse it.
 */
async function resolveBlockEventId(
  clients: AdvanceClients,
  blockId: string,
): Promise<string | null> {
  const { data, error } = await clients.admin
    .from('event_schedule_blocks')
    .select('event_id')
    .eq('block_id', blockId)
    .maybeSingle();
  if (error) return null;
  return ((data as { event_id?: string } | null)?.event_id as string | null) ?? null;
}

/** Gather the four facts, on the BLOCK's event, and decide. */
async function mayAdvance(
  clients: AdvanceClients,
  userId: string,
  eventId: string,
): Promise<boolean> {
  const [memberRes, delegateRes] = await Promise.all([
    clients.user
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle(),
    clients.user
      .from('event_moderators')
      .select('permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);

  const coordRes = await clients.user.rpc('current_coordinator_booked_event_ids');
  const meRes = await clients.user
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', userId)
    .maybeSingle();

  // FAIL CLOSED. Supabase resolves `{ error }` rather than throwing, so an
  // unchecked error turns a failed read into an EMPTY one — and empty can only
  // loosen the answer here (no guest row found, no delegate row found).
  const readFailed = Boolean(
    memberRes?.error || delegateRes?.error || coordRes?.error || meRes?.error,
  );

  return decideMayAdvance({
    memberType: (memberRes?.data?.member_type as string | null | undefined) ?? null,
    delegateScheduleLevel: resolveAreaLevel(
      (delegateRes?.data?.permissions_json ?? null) as ModeratorPermissions | null,
      'schedule',
    ),
    coordinatorBookedEventIds: (coordRes?.data as unknown[] | null) ?? null,
    eventId,
    isAdmin: isAdminProfile(meRes?.data),
    readFailed,
  }).allowed;
}

/**
 * Authorize and advance. Returns a refusal rather than throwing, and NEVER calls
 * the RPC on a refusal — that is the property the test pins.
 */
export async function runAdvance(
  clients: AdvanceClients,
  userId: string,
  eventId: string,
  blockId: string,
): Promise<AdvanceResult> {
  const refused: AdvanceResult = {
    status: ADVANCE_REFUSED_NOT_COORDINATOR,
    message: ADVANCE_REFUSAL_MESSAGE,
  };

  const blockEventId = await resolveBlockEventId(clients, blockId);
  if (!blockEventId || blockEventId !== eventId) return refused;

  if (!(await mayAdvance(clients, userId, blockEventId))) return refused;

  const { data, error } = await clients.user.rpc('advance_schedule_block', {
    p_block_id: blockId,
  });
  if (error) {
    return { status: 'error', message: (error as { message?: string }).message ?? 'error' };
  }

  const env = (data ?? {}) as { status?: string; next_id?: string | null };
  return { status: env.status ?? 'ok', nextId: env.next_id ?? null };
}

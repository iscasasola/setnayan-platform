/**
 * apps/web/lib/limited-helper-gate.ts — A LIMITED HELPER VIEWS, NEVER EDITS.
 *
 * Owner ruling 2026-09-28 (DECISION_LOG "CO-HOSTS COME FROM THE GUEST LIST"):
 * *"Limited Helper can keep. may view but may not edit"* · *"yes they cannot
 * edit"*. Live report 2026-10-25: *"when we give access as helper/limited on a
 * guest — they should be only able to view and not edit. we tried it and they
 * can change table, delete guests, and more."*
 *
 * ── WHAT WAS LIVE, MEASURED ────────────────────────────────────────────────
 * The database already refused them (migration 20271251336140: area levels are
 * all 'view', plus RESTRICTIVE `lh_ro_*` policies). The production edge log for
 * the owner's test helper shows `PATCH /rest/v1/guests` answered 200 with ZERO
 * rows — a refused UPDATE under RLS is not an error, it is an empty success. So
 * the server action carried on, returned, and the screen showed the change as
 * made. A refusal that renders identically to success. And a server action that
 * writes with the service-role client is not fenced by RLS at all.
 *
 * ── THE ONE QUESTION, ASKED OF THE ONE DEFINITION ──────────────────────────
 * "Is the caller a live limited helper on this event?" is answered by the SQL
 * function `public.is_limited_helper(event_id)` — the same predicate the
 * restrictive policies use (seat kind 'viewer', accepted, not removed, the
 * caller's own seat). This file never re-derives it in TypeScript, so the
 * server action and the database cannot disagree about who a helper is.
 *
 * Every server action under `app/dashboard/[eventId]` calls the gate first
 * (`refuseLimitedHelper` in `lib/host-gate.ts`), held by
 * `app/dashboard/[eventId]/every-action-refuses-a-limited-helper.test.ts`.
 *
 * Pure — the caller hands in the session client — so a unit test drives it.
 */

/** What a limited helper is told when they try to change something. */
export const LIMITED_HELPER_REFUSAL = 'You can view this event but not change it.';

/** The access check itself did not happen (network, 5xx). Retryable — never read as "allowed". */
export const LIMITED_HELPER_CHECK_FAILED = 'We could not confirm your access just now. Please try again.';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `v` can name an event at all. Anything else cannot reach an event's rows. */
export function isEventIdShape(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** The slice of a Supabase client the gate needs. */
export type LimitedHelperRpcClient = {
  rpc: (
    fn: 'is_limited_helper',
    args: { p_event_id: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

/**
 * Throws `LIMITED_HELPER_REFUSAL` when the signed-in caller holds a live
 * limited-helper seat on `eventId`; returns otherwise.
 *
 *   · `eventId` that is not an event id (missing, blank, not a UUID) → returns:
 *     the action's own validation answers that, and such a value cannot
 *     address any event's rows;
 *   · the check FAILED → throws `LIMITED_HELPER_CHECK_FAILED` — a write is
 *     never let through on an unanswered question (an absence denies);
 *   · signed out → `auth.uid()` is NULL, the function answers false, and the
 *     action's own sign-in handling runs as before.
 */
export async function refuseLimitedHelperWith(
  client: LimitedHelperRpcClient,
  eventId: unknown,
): Promise<void> {
  const refusal = await limitedHelperRefusalWith(client, eventId);
  if (refusal) throw new Error(refusal);
}

/**
 * The same answer as a value: the sentence to show when the caller may NOT
 * change this event (a limited helper, or the check did not answer), else null.
 * For actions that report `{ ok: false, error }` rather than throwing.
 */
export async function limitedHelperRefusalWith(
  client: LimitedHelperRpcClient,
  eventId: unknown,
): Promise<string | null> {
  if (!isEventIdShape(eventId)) return null;
  const { data, error } = await client.rpc('is_limited_helper', { p_event_id: eventId });
  if (error) return LIMITED_HELPER_CHECK_FAILED;
  return data === true ? LIMITED_HELPER_REFUSAL : null;
}

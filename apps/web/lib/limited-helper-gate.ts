/**
 * apps/web/lib/limited-helper-gate.ts — A LIMITED HELPER VIEWS; CHANGES ONLY WHAT THE HOST SET TO EDIT.
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
 * ── WHAT A HELPER MAY DO IS WHAT THE HOST SET (owner, 2026-10-26) ─────────
 * *"Limited helpers can view but not change anything. limited helpers
 * capabilities depend on the settings on their event details"*. So: by
 * default a limited helper only looks; an AREA the host set to Edit for them in
 * Event Details › Event access (`setDelegateArea` → `permissions_json.areas`)
 * they may change. Everything without an area (event details, the hub, hosts,
 * purchases…) stays the hosts' alone.
 *
 * ── TWO QUESTIONS, ASKED OF THE ONE DEFINITION ─────────────────────────────
 *   1. `public.is_limited_helper(event_id)` — a live seat of kind 'viewer'
 *      (the predicate the RESTRICTIVE `lh_ro_*` policies use);
 *   2. only if so, and only when the action belongs to an area,
 *      `public.moderator_area_level(event_id, area)` — the SAME function the
 *      19 area-gated tables' write policies ask (`= 'edit'`).
 * Never re-derived in TypeScript, so the server action and the database cannot
 * disagree about who a helper is or what they were given. A co-host, the
 * creator, a hired planner and everybody else are answered by question 1 and
 * pass through to the action's own gate unchanged.
 *
 * Every server action under `app/dashboard/[eventId]` calls the gate first,
 * naming its area (`refuseLimitedHelper(eventId, 'guest_list')`, from
 * `lib/host-gate.ts`), held — area included — by
 * `app/dashboard/[eventId]/every-action-refuses-a-limited-helper.test.ts`.
 *
 * Pure — the caller hands in the session client — so a unit test drives it.
 */

import type { DelegateArea } from './delegate-areas';

/** What a limited helper is told when they try to change something that has no area — or every area is View. */
export const LIMITED_HELPER_REFUSAL = 'You can view this event but not change it.';

/** The area's words inside the refusal: "You can view the seat plan but not change it." */
const AREA_IN_A_SENTENCE: Readonly<Record<DelegateArea, string>> = {
  guest_list: 'the guest list',
  seat_plan: 'the seat plan',
  schedule: 'the day’s schedule',
  vendors: 'the suppliers',
  invitations: 'the Event Hub',
  mood_board: 'the Mood Board',
  budget: 'the budget',
  photos: 'the photos',
};

/** The refusal for one area — the host did not set it to Edit for this helper. */
export function limitedHelperAreaRefusal(area: DelegateArea | null): string {
  return area ? `You can view ${AREA_IN_A_SENTENCE[area]} but not change it.` : LIMITED_HELPER_REFUSAL;
}

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
    fn: 'is_limited_helper' | 'moderator_area_level',
    args: { p_event_id: string; p_area?: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

/**
 * Throws the refusal when the signed-in caller holds a live limited-helper seat
 * on `eventId` and the host has NOT set `area` to Edit for them; returns
 * otherwise.
 *
 *   · `area` null → the action belongs to no area: a helper is always refused;
 *   · `eventId` that is not an event id (missing, blank, not a UUID) → returns:
 *     the action's own validation answers that, and such a value cannot
 *     address any event's rows;
 *   · a check that FAILED → throws `LIMITED_HELPER_CHECK_FAILED` — a write is
 *     never let through on an unanswered question (an absence denies);
 *   · signed out → `auth.uid()` is NULL, the function answers false, and the
 *     action's own sign-in handling runs as before.
 */
export async function refuseLimitedHelperWith(
  client: LimitedHelperRpcClient,
  eventId: unknown,
  area: DelegateArea | null,
): Promise<void> {
  const refusal = await limitedHelperRefusalWith(client, eventId, area);
  if (refusal) throw new Error(refusal);
}

/**
 * The same answer as a value: the sentence to show when the caller may NOT
 * change this (a limited helper without Edit on `area`, or the check did not
 * answer), else null. For actions that report `{ ok: false, error }`.
 */
export async function limitedHelperRefusalWith(
  client: LimitedHelperRpcClient,
  eventId: unknown,
  area: DelegateArea | null,
): Promise<string | null> {
  if (!isEventIdShape(eventId)) return null;
  const helper = await client.rpc('is_limited_helper', { p_event_id: eventId });
  if (helper.error) return LIMITED_HELPER_CHECK_FAILED;
  if (helper.data !== true) return null;
  if (area === null) return LIMITED_HELPER_REFUSAL;
  const level = await client.rpc('moderator_area_level', { p_event_id: eventId, p_area: area });
  if (level.error) return LIMITED_HELPER_CHECK_FAILED;
  return level.data === 'edit' ? null : limitedHelperAreaRefusal(area);
}

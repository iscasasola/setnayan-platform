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
 *   1. `public.is_limited_helper(event_id)` — a live seat of kind 'viewer',
 *      or (migration 20271302707661) a coordinator seat the hosts set to
 *      Limited (`permissions_json.access_level = 'limited'`) — the predicate
 *      the RESTRICTIVE `lh_ro_*` policies use;
 *   2. only if so, and only when the action belongs to an area,
 *      `public.moderator_area_level(event_id, area)` — the SAME function the
 *      19 area-gated tables' write policies ask (`= 'edit'`).
 * And a third (8 Nov 2026): `public.supplier_proposes_only(event_id)` — a booked supplier who is NOT the coordinator
 * sees and proposes; every write through the hosts' screens is refused with where to propose it
 * ({@link supplierProposesRefusal}).
 * Never re-derived in TypeScript, so the server action and the database cannot
 * disagree about who a helper is or what they were given. A co-host, the
 * creator, a hired planner and everybody else are answered by question 1 and
 * pass through to the action's own gate unchanged.
 *
 * ── AND A COORDINATOR THE HOSTS SET TO LIMITED (owner 2026-10-29) ─────────
 * `lib/coordinator-access-level.ts`: LIMITED is *"the limited helper's grant:
 * view every part, change nothing"* — but written onto the coordinator's OWN
 * seat (`wedding_planner_external`, member_type 'coordinator'), with the answer
 * recorded as `permissions_json.access_level = 'limited'`. Question 1 asks
 * `role_subtype = 'viewer'`, so it answered FALSE for her, and every action let
 * her through to its own gate — which admits a coordinator, and many of which
 * write with the service-role client (`isEventHost` → `updateVenueSetting`,
 * `updateGuestCount`, `setEventArchived`…). Audit 2026-11-02 #19. So the gate
 * ALSO reads the caller's own live seat (`ownSeatLevel`) and treats a recorded
 * 'limited' exactly like a limited helper: area-less actions refused, an area
 * open only where the hosts set it to Edit (`moderator_area_level`, the same
 * per-area answer, which reads that seat's `areas`). Full access (the co-host
 * seat) and a seat never asked are unchanged.
 *
 * Every server action under `app/dashboard/[eventId]` calls the gate first,
 * naming its area (`refuseLimitedHelper(eventId, 'guest_list')`, from
 * `lib/host-gate.ts`), held — area included — by
 * `app/dashboard/[eventId]/every-action-refuses-a-limited-helper.test.ts`.
 *
 * Pure — the caller hands in the session client — so a unit test drives it.
 */

import type { DelegateArea } from './delegate-areas';
import { levelOf, type LevelledPermissions } from './coordinator-access-level';

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

/**
 * ✋ A SUPPLIER WHO IS NOT THE COORDINATOR (owner 8 Nov 2026: *"any supplier that is not a coordinator still has to
 * request a host or coordinator to accept the change"*). The database already refuses their write (the supplier cap in
 * `moderator_area_level`, migration 20271329978605) — but a refused UPDATE under RLS is an EMPTY SUCCESS, and a
 * service-role action is not fenced by RLS at all, so the action must refuse first and SAY where the change goes.
 */
export function supplierProposesRefusal(area: DelegateArea | null): string {
  return area
    ? `You can see ${AREA_IN_A_SENTENCE[area]}. Changes go to the host or the coordinator — propose it from your client page.`
    : 'Changes to this event are the host’s and the coordinator’s. Ask them from your client page.';
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
    fn: 'is_limited_helper' | 'moderator_area_level' | 'supplier_proposes_only',
    args: { p_event_id: string; p_area?: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  /**
   * The level the hosts recorded on the CALLER'S OWN live seat on this event (`'limited'` | `'full'`), or null (no
   * seat, or a seat never asked). An error when the read did not answer. `ownSeatLevelReader` builds it from a session
   * client; a test hands one in.
   */
  ownSeatLevel: (eventId: string) => PromiseLike<{ data: unknown; error: unknown }>;
};

/** The slice of a Supabase session client `ownSeatLevelReader` reads with. */
export type OwnSeatClient = {
  auth: {
    getClaims?: () => PromiseLike<{ data: { claims?: { sub?: unknown } | null } | null; error: unknown }>;
    getUser: () => PromiseLike<{ data: { user: { id?: unknown } | null } | null; error: unknown }>;
  };
  from: (table: 'event_moderators') => {
    select: (cols: 'permissions_json') => {
      eq: (c: 'event_id', v: string) => {
        eq: (c: 'user_id', v: string) => {
          not: (c: 'accepted_at', op: 'is', v: null) => {
            is: (c: 'removed_at', v: null) => PromiseLike<{ data: unknown; error: unknown }>;
          };
        };
      };
    };
  };
};

/**
 * `ownSeatLevel` over a session client: the caller's id from their own token (`getClaims`, checked locally; `getUser`
 * when that is missing or did not answer), then THEIR live seats on the event — never anybody else's (a host can read
 * every seat of their event, so the row is pinned to the caller's id). Signed out → null: the action's own sign-in
 * handling answers. Any seat recorded 'limited' → 'limited' (an absence denies).
 */
export function ownSeatLevelReader(client: OwnSeatClient): LimitedHelperRpcClient['ownSeatLevel'] {
  return async (eventId) => {
    let uid: string | null = null;
    try {
      const claims = typeof client.auth.getClaims === 'function' ? await client.auth.getClaims() : null;
      const sub = claims && !claims.error ? claims.data?.claims?.sub : undefined;
      if (typeof sub === 'string' && sub) uid = sub;
    } catch {
      uid = null;
    }
    if (!uid) {
      const got = await client.auth.getUser();
      const id = got.data?.user?.id;
      if (typeof id === 'string' && id) uid = id;
    }
    if (!uid) return { data: null, error: null };
    const seats = await client
      .from('event_moderators')
      .select('permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', uid)
      .not('accepted_at', 'is', null)
      .is('removed_at', null);
    if (seats.error) return { data: null, error: seats.error };
    const rows = Array.isArray(seats.data) ? (seats.data as Array<{ permissions_json?: LevelledPermissions | null }>) : [];
    const levels = rows.map((r) => levelOf({ permissions_json: r.permissions_json ?? null }));
    return { data: levels.includes('limited') ? 'limited' : (levels.find((l) => l !== null) ?? null), error: null };
  };
}

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
  // The questions at once — one round trip, not three (a host's every save asks them).
  const [helper, seat, proposes] = await Promise.all([
    client.rpc('is_limited_helper', { p_event_id: eventId }),
    client.ownSeatLevel(eventId),
    client.rpc('supplier_proposes_only', { p_event_id: eventId }),
  ]);
  if (helper.error) return LIMITED_HELPER_CHECK_FAILED;
  if (helper.data !== true) {
    // 🔑 Not a 'viewer' seat — but a coordinator the hosts set to LIMITED is the same grant on her own seat.
    if (seat.error) return LIMITED_HELPER_CHECK_FAILED;
    if (seat.data !== 'limited') {
      // ✋ A booked supplier who is not the coordinator proposes; they never write through the hosts' screens. An
      // unanswered check here lets the action run (it does not widen anything: the database caps the seat itself).
      return proposes.data === true ? supplierProposesRefusal(area) : null;
    }
  }
  if (area === null) return LIMITED_HELPER_REFUSAL;
  const level = await client.rpc('moderator_area_level', { p_event_id: eventId, p_area: area });
  if (level.error) return LIMITED_HELPER_CHECK_FAILED;
  return level.data === 'edit' ? null : limitedHelperAreaRefusal(area);
}

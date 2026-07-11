/**
 * guest-optimistic.ts — the PURE optimistic-update + undo layer for the couple
 * Guests page (Living Roster · P1).
 *
 * WHY it lives in `lib/` (not a component): every rule here is a pure function
 * of (server list, local overlay) with NO React/DOM, so it is unit-tested via
 * `tsx --test` without booting the app. The client store (`guest-optimistic-
 * store.ts`) and the roster component are thin shells that call these.
 *
 * The model:
 *  1. APPLY LOCAL   — an action (delete / field-set) is reflected instantly by
 *     adding it to a small OVERLAY (`OptimisticState`) over the SSR guest list.
 *  2. SERVER ACTION — the matching server action runs and `revalidatePath`s.
 *  3. RECONCILE BY ID — when the freshly-revalidated list arrives, `reconcile`
 *     prunes overlay entries the server has caught up on. Keyed by `guest_id`
 *     and idempotent, so a double-render (optimistic + revalidate) can NEVER
 *     flip a row twice.
 *
 * Undo: `buildUndo` turns a landed mutation + the prior rows (+ the seats a
 * delete released) into an `UndoPlan`. Crucially, the undo of a soft-delete
 * carries the RELEASED SEATS so restoring a guest also re-places them — the
 * seat-release that `bulkSoftDeleteGuests` performs is not silently lost.
 */

import type { GuestSide, GuestRole, RsvpStatus } from './guests';

/**
 * A seat freed when a guest was soft-deleted, captured with enough to re-INSERT
 * it verbatim on undo. `assignment_id` is intentionally omitted — the DB mints a
 * fresh one on re-insert; only the placement (table + chair + lock) is restored.
 */
export type ReleasedSeat = {
  guest_id: string;
  table_id: string;
  seat_number: number | null;
  locked: boolean;
};

/** The mutable guest fields the optimistic overlay may patch (P1: delete only;
 *  P2 wires the inline chip editors onto `setField`). */
export type GuestFieldOverride = Partial<{
  side: GuestSide;
  role: GuestRole;
  rsvp_status: RsvpStatus;
}>;

/** A local, not-yet-confirmed change the roster applies immediately. */
export type GuestMutation =
  | { kind: 'remove'; guestIds: string[] }
  | { kind: 'setField'; guestIds: string[]; override: GuestFieldOverride };

/**
 * The optimistic overlay laid over the SSR list:
 *  - `removedIds` — guests hidden pending a soft-delete (and its undo window).
 *  - `overrides`  — per-guest field patches pending a server write.
 */
export type OptimisticState = {
  removedIds: ReadonlySet<string>;
  overrides: ReadonlyMap<string, GuestFieldOverride>;
};

export const EMPTY_OPTIMISTIC: OptimisticState = {
  removedIds: new Set(),
  overrides: new Map(),
};

/** Apply a mutation to the overlay (does NOT touch the server). Returns a fresh
 *  object so an external store sees a new reference. */
export function applyMutation(
  state: OptimisticState,
  mutation: GuestMutation,
): OptimisticState {
  if (mutation.kind === 'remove') {
    const removedIds = new Set(state.removedIds);
    for (const id of mutation.guestIds) removedIds.add(id);
    return { removedIds, overrides: state.overrides };
  }
  const overrides = new Map(state.overrides);
  for (const id of mutation.guestIds) {
    overrides.set(id, { ...overrides.get(id), ...mutation.override });
  }
  return { removedIds: state.removedIds, overrides };
}

/** Drop a mutation from the overlay — used on undo, on rollback (server error),
 *  and when a caller wants to release its optimistic claim. */
export function clearMutation(
  state: OptimisticState,
  mutation: GuestMutation,
): OptimisticState {
  if (mutation.kind === 'remove') {
    const removedIds = new Set(state.removedIds);
    for (const id of mutation.guestIds) removedIds.delete(id);
    return { removedIds, overrides: state.overrides };
  }
  const overrides = new Map(state.overrides);
  for (const id of mutation.guestIds) overrides.delete(id);
  return { removedIds: state.removedIds, overrides };
}

/**
 * Project the SSR list through the overlay: hides removed guests and patches
 * field overrides by id. Pure and idempotent — the same (serverList, state)
 * always yields the same rows, so a row can't flicker between renders.
 */
export function projectGuests<G extends { guest_id: string }>(
  serverGuests: readonly G[],
  state: OptimisticState,
): G[] {
  const out: G[] = [];
  for (const g of serverGuests) {
    if (state.removedIds.has(g.guest_id)) continue;
    const override = state.overrides.get(g.guest_id);
    out.push(override ? { ...g, ...override } : g);
  }
  return out;
}

/**
 * Reconcile the overlay against a freshly-revalidated server list — the
 * "reconcile by id" step that keeps the optimistic layer from double-rendering.
 *
 *  - A `removedId` is kept ONLY while the server list still contains it (the
 *    soft-delete hasn't propagated yet). Once the guest leaves the server list
 *    the delete has landed, so we drop it from the overlay — and because the row
 *    is simultaneously absent from the server list, it stays hidden with NO
 *    flip. (Keeping it any longer would just bloat the set.)
 *  - An `override` is kept ONLY while the server value still differs from it.
 *    Once the server row matches, the write has landed, so we drop the patch.
 *
 * Idempotent: reconciling twice against the same server list is a no-op the
 * second time.
 */
export function reconcile<G extends { guest_id: string } & GuestFieldOverride>(
  serverGuests: readonly G[],
  state: OptimisticState,
): OptimisticState {
  const byId = new Map<string, G>();
  for (const g of serverGuests) byId.set(g.guest_id, g);

  // removedIds: keep only ids the server still shows (delete not yet landed).
  let removedChanged = false;
  const nextRemoved = new Set<string>();
  for (const id of state.removedIds) {
    if (byId.has(id)) nextRemoved.add(id);
    else removedChanged = true;
  }

  // overrides: keep only patches the server hasn't caught up on yet.
  let overridesChanged = false;
  const nextOverrides = new Map<string, GuestFieldOverride>();
  for (const [id, override] of state.overrides) {
    const server = byId.get(id);
    if (!server) {
      // Guest is gone server-side (e.g. deleted elsewhere) — the patch is moot.
      overridesChanged = true;
      continue;
    }
    const stillPending = (
      Object.keys(override) as (keyof GuestFieldOverride)[]
    ).some((f) => server[f] !== override[f]);
    if (stillPending) nextOverrides.set(id, override);
    else overridesChanged = true;
  }

  if (!removedChanged && !overridesChanged) return state;
  return {
    removedIds: removedChanged ? nextRemoved : state.removedIds,
    overrides: overridesChanged ? nextOverrides : state.overrides,
  };
}

/** What an undo needs in order to reverse a landed mutation. */
export type UndoPlan =
  | { kind: 'restore'; guestIds: string[]; seats: ReleasedSeat[] }
  | { kind: 'setField'; overridesByGuestId: Record<string, GuestFieldOverride> };

/**
 * Build the plan that reverses `mutation`.
 *
 * @param priorGuests   the affected guests' rows AS THEY WERE before the
 *                       mutation (used to recover prior field values for a
 *                       field-set undo).
 * @param releasedSeats seats a delete freed — the delete's seat-release, carried
 *                       through so a restore re-places the guest on the SAME
 *                       table/chair rather than dropping them unseated.
 *
 * Delete → `restore` (guest ids + their seats). Field-set → `setField` with each
 * guest's PRIOR value of exactly the fields that were changed.
 */
export function buildUndo(
  mutation: GuestMutation,
  priorGuests: ReadonlyArray<{ guest_id: string } & GuestFieldOverride>,
  releasedSeats: readonly ReleasedSeat[],
): UndoPlan {
  if (mutation.kind === 'remove') {
    const ids = new Set(mutation.guestIds);
    return {
      kind: 'restore',
      guestIds: [...mutation.guestIds],
      // Only the seats that belong to the guests we actually removed.
      seats: releasedSeats.filter((s) => ids.has(s.guest_id)),
    };
  }

  const touchedFields = Object.keys(
    mutation.override,
  ) as (keyof GuestFieldOverride)[];
  const priorById = new Map(priorGuests.map((g) => [g.guest_id, g]));
  const overridesByGuestId: Record<string, GuestFieldOverride> = {};
  for (const id of mutation.guestIds) {
    const prior = priorById.get(id);
    if (!prior) continue;
    const patch: GuestFieldOverride = {};
    for (const f of touchedFields) {
      const v = prior[f];
      if (v !== undefined) {
        // Narrow per-field so the union stays sound without an `any` cast.
        if (f === 'side') patch.side = v as GuestSide;
        else if (f === 'role') patch.role = v as GuestRole;
        else if (f === 'rsvp_status') patch.rsvp_status = v as RsvpStatus;
      }
    }
    overridesByGuestId[id] = patch;
  }
  return { kind: 'setField', overridesByGuestId };
}

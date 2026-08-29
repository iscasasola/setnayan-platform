/**
 * ONE RULE, ONE READER — does the per-guest ceiling actually bind?
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * `papic_record_guest_capture` decides it with TWO writes to `v_unlimited`
 * (migration 20270920602517):
 *
 *   1.  SELECT EXISTS (… service_key = 'PAPIC_UNLOCK' …) INTO v_unlimited;
 *   2.  v_unlimited := v_unlimited OR COALESCE(v_pool_applies, FALSE);
 *
 * The TypeScript mirror learned only the first. The second arrived with the
 * one-pool model and never crossed over — so the browser counted a guest down
 * from a hardcoded 150, hid its own shutter and said "That's all 150 photos"
 * while the database was applying **no per-guest limit at all** and the route
 * never pre-checked the number. A guest at a large celebration was locked out
 * of a pot still holding thousands of shots, by a number nobody chose, and the
 * couple never learned it happened.
 *
 * 🔑 One rule written twice will drift, and the copy that drifts is the one
 * nobody re-read when the model changed. So the rule lives HERE, once, as a
 * list with one entry per SQL write — and `papic-guest-quota-mirrors-sql.test.ts`
 * counts the writes in the migration and calls this function to count the
 * entries. A third condition added in SQL fails that guard until this array
 * learns it too.
 *
 * ⚠ NO IMPORTS, deliberately. The guard has to be able to EXECUTE this rule
 * rather than match its text, and every richer module on this surface reaches
 * `server-only` / a Supabase client, which cannot load under `node:test`.
 */

export type GuestCapInputs = {
  /** An ACTIVE (paid/fulfilled) PAPIC_UNLOCK order on this event. */
  hasUnlock: boolean;
  /** `papic_event_pool_status(event_id).applies` — the shared pot is the
   *  authoritative ceiling for a pool event, so the per-guest number yields. */
  poolApplies: boolean;
  /**
   * The pool status could not be READ — a metering outage, never a decision.
   *
   * 🔴 IT LIFTS THE CAP, i.e. this fails OPEN, and that is on purpose. The
   * ceiling is enforced inside the capture RPC, which refuses with its own
   * `quota_exhausted` status and its own copy; the client gate is a display
   * pre-check on top of it. So failing open costs one refused shot at the very
   * end, while failing closed reproduces exactly the defect this file exists to
   * kill: a browser locking a guest out of a celebration that still has shots.
   */
  poolUnknown: boolean;
};

/**
 * One entry per write to `v_unlimited` in papic_record_guest_capture, in the
 * same order. The cap is lifted when ANY of them is true — `v_unlimited` is
 * built with OR.
 */
export function papicGuestCapLifts(i: GuestCapInputs): boolean[] {
  return [
    // 1 · SELECT EXISTS (… 'PAPIC_UNLOCK' …) INTO v_unlimited
    i.hasUnlock,
    // 2 · v_unlimited := v_unlimited OR COALESCE(v_pool_applies, FALSE)
    i.poolApplies || i.poolUnknown,
  ];
}

/** True only when the per-guest ceiling can actually refuse a shot. */
export function papicGuestCapApplies(i: GuestCapInputs): boolean {
  return !papicGuestCapLifts(i).some(Boolean);
}

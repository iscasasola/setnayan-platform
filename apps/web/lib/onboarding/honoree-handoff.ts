/**
 * honoree-handoff.ts — carrying "who it's for" across the create → onboarding hop.
 *
 * The WHO step lives on /dashboard/create-event (it is the only place a question
 * can come BEFORE the type). Picking a non-wedding type then `router.replace`s
 * into /onboarding/[type], whose wizard asks "Who are we celebrating?" — so
 * without a carry the user is asked the same question twice, one screen apart.
 *
 * ⚠ WHY NOT A QUERY PARAM: the answer is a person's first name. Personal data
 * does not go in a URL — it lands in browser history, in the Referer header of
 * every subsequent request, and in access logs. So the name rides in
 * sessionStorage instead: same tab, same origin, never transmitted.
 *
 * Deliberately fragile in the safe direction — READ ONCE and a short TTL — so a
 * name can never resurface in an unrelated onboarding an hour later. Every
 * failure mode (no window, private mode, quota, corrupt JSON) degrades to "no
 * carry", i.e. the wizard asks, exactly as it does today.
 */

const KEY = 'setnayan_create_honoree_v1';
/** Long enough to cross one route hop, far too short to leak into a later session. */
export const HONOREE_HANDOFF_TTL_MS = 10 * 60 * 1000;

/** Pure half — is a stashed timestamp still inside the window? (unit-testable) */
export function isHandoffFresh(stampedAtMs: unknown, nowMs: number): boolean {
  if (typeof stampedAtMs !== 'number' || !Number.isFinite(stampedAtMs)) return false;
  const age = nowMs - stampedAtMs;
  // A stamp from the future is a clock change, not a fresh value — refuse it.
  return age >= 0 && age < HONOREE_HANDOFF_TTL_MS;
}

/**
 * What the create step answered: the celebrant's name, and — when they picked a
 * real alaga rather than "You" / "Someone else" — WHICH record that was.
 *
 * The id rides beside the name because the name alone is a weak key: renaming
 * an alaga would otherwise change which events it caps against, and two alaga
 * called "Maria" would share one in-planning slot. It is still only a CLAIM
 * here — the server re-verifies ownership before writing it
 * (lib/honoree-dependent-link.ts).
 *
 * The id is opaque and meaningless outside this account, so it is no more
 * disclosive than the name it travels with — and it takes the same
 * sessionStorage route for the same reason: never the URL.
 */
export type HonoreeCarry = {
  name: string;
  /** `dependents.dependent_id`, or null for "You" / "Someone else". */
  dependentId: string | null;
};

/**
 * Stash the chosen celebrant. An empty name CLEARS instead of storing '' — and
 * clears the id with it, because an id with no name is a link to a person this
 * flow can no longer show the user.
 */
export function stashHonoree(name: string, dependentId?: string | null): void {
  if (typeof window === 'undefined') return;
  const trimmed = name.trim().slice(0, 80);
  const dep = typeof dependentId === 'string' ? dependentId.trim() : '';
  try {
    if (!trimmed) {
      window.sessionStorage.removeItem(KEY);
      return;
    }
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ n: trimmed, ...(dep ? { d: dep } : {}), t: Date.now() }),
    );
  } catch {
    /* private mode / quota — the wizard simply asks */
  }
}

/**
 * Read AND consume the stash. Returns null when absent, stale, or unreadable —
 * never a partial value, never twice. A payload with a name but no `d` (every
 * stash written before this field existed, and every "You" pick) returns
 * `dependentId: null`, which is exactly the pre-existing behaviour.
 */
export function takeHonoree(): HonoreeCarry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as { n?: unknown; d?: unknown; t?: unknown };
    if (typeof parsed?.n !== 'string' || !parsed.n.trim()) return null;
    if (!isHandoffFresh(parsed.t, Date.now())) return null;
    const dep = typeof parsed.d === 'string' && parsed.d.trim() ? parsed.d.trim() : null;
    return { name: parsed.n.trim().slice(0, 80), dependentId: dep };
  } catch {
    return null;
  }
}

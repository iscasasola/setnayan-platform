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

/** Stash the chosen celebrant's name. An empty name CLEARS instead of storing ''. */
export function stashHonoree(name: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = name.trim().slice(0, 80);
  try {
    if (!trimmed) {
      window.sessionStorage.removeItem(KEY);
      return;
    }
    window.sessionStorage.setItem(KEY, JSON.stringify({ n: trimmed, t: Date.now() }));
  } catch {
    /* private mode / quota — the wizard simply asks */
  }
}

/**
 * Read AND consume the stash. Returns null when absent, stale, or unreadable —
 * never a partial value, never twice.
 */
export function takeHonoree(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as { n?: unknown; t?: unknown };
    if (typeof parsed?.n !== 'string' || !parsed.n.trim()) return null;
    if (!isHandoffFresh(parsed.t, Date.now())) return null;
    return parsed.n.trim().slice(0, 80);
  } catch {
    return null;
  }
}

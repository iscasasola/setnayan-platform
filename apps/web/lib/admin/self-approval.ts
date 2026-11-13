/**
 * The owner approves his own two-admin request — typed, then 24 hours.
 * DECISION_LOG 2026-11-13, owner verbatim: "YES i should be able to handle it
 * my own."
 *
 * Pure rules, shared by the approvals page, its actions and the tests. The
 * database enforces the same rule on its own clock
 * (`guard_owner_self_approval`, migration 20271344663185), so nothing here is
 * the only thing standing between a click and an early run.
 *
 *   1. The owner raises a request (any two-admin action), as anyone would.
 *   2. On his OWN row he types the word. That starts the wait; he is emailed.
 *   3. 24 hours later the runner executes it; he is emailed again.
 *   4. Until then he can Cancel (the request closes as `withdrawn`).
 *   Meanwhile a second admin may still approve or reject it in the ordinary way.
 */

export const SELF_APPROVAL_WORD = 'APPROVE';
export const SELF_APPROVAL_WAIT_HOURS = 24;
export const SELF_APPROVAL_WAIT_MS = SELF_APPROVAL_WAIT_HOURS * 60 * 60 * 1000;

/** Case-insensitive, surrounding spaces ignored; anything else is a no. */
export function typedWordMatches(typed: unknown): boolean {
  return typeof typed === 'string' && typed.trim().toUpperCase() === SELF_APPROVAL_WORD;
}

export type SelfApprovalRow = {
  status: string;
  self_confirmed_at: string | null;
  run_after: string | null;
};

export type SelfApprovalState =
  | { kind: 'not_started' }
  | { kind: 'waiting'; msLeft: number; runAfter: string }
  | { kind: 'due'; runAfter: string }
  | { kind: 'closed' };

export function selfApprovalState(row: SelfApprovalRow, nowMs: number): SelfApprovalState {
  if (row.status !== 'pending') return { kind: 'closed' };
  if (!row.self_confirmed_at || !row.run_after) return { kind: 'not_started' };
  const at = new Date(row.run_after).getTime();
  if (!Number.isFinite(at)) return { kind: 'not_started' };
  if (nowMs < at) return { kind: 'waiting', msLeft: at - nowMs, runAfter: row.run_after };
  return { kind: 'due', runAfter: row.run_after };
}

/** "runs in 21 h 58 min" — whole minutes, never a negative or a decimal. */
export function waitWords(msLeft: number): string {
  const mins = Math.max(0, Math.ceil(msLeft / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * The expiry a confirmed request needs so it is still alive when it is due.
 * A request opened on day 6 of its 7 would otherwise expire mid-wait.
 */
export function expiryAfterConfirm(currentExpiresAt: string, confirmedAtMs: number): string {
  const keep = new Date(currentExpiresAt).getTime();
  const need = confirmedAtMs + SELF_APPROVAL_WAIT_MS + 7 * 24 * 60 * 60 * 1000;
  return new Date(Number.isFinite(keep) ? Math.max(keep, need) : need).toISOString();
}

/**
 * THE ONE REWRITE `20271281556823_rls_checks_once_per_query.sql` MAKES — as a
 * pure text function, so the migration, its generator and its proof all mean
 * the same thing by it.
 *
 * Input and output are policy predicates exactly as `pg_get_expr` prints them
 * (the same text `pg_policies.qual` / `with_check` hold, in prod and in the
 * replay — measured equal for every policy on 2026-10-20). The rewrite never
 * changes WHO a policy admits. It changes HOW OFTEN the check runs:
 *
 *   1. `auth.uid()` / `auth.jwt()` / `auth.role()` / `auth.email()`
 *        → `( SELECT auth.uid() AS uid)` …
 *      Supabase's auth_rls_initplan advisor. A bare call is re-evaluated for
 *      EVERY row the policy looks at; wrapped in a scalar sub-select the
 *      planner turns it into an InitPlan and evaluates it ONCE per statement.
 *      Identical by construction: the functions take no arguments and read a
 *      request setting that cannot change inside one statement.
 *
 *   2. `is_admin()` / `is_console_admin()` → `( SELECT is_admin() AS is_admin)`
 *      Same shape, same reason. Both are STABLE, take no arguments, and are
 *      SECURITY DEFINER lookups — a bare call is one users-table probe per ROW.
 *      A STABLE function sees the calling statement's snapshot, so once per
 *      statement and once per row return the same answer.
 *
 *   3. `moderator_area_level(event_id, '<area>'::text) <P>`
 *        → `(event_id IN ( SELECT l.event_id
 *                            FROM current_moderator_area_levels('<area>'::text) l
 *                           WHERE (l.level <P>)))`
 *      where <P> is `IS NOT NULL`, `= '<lvl>'::text` or `= ANY (ARRAY[…])`.
 *      The function takes the ROW's event_id, so it cannot be hoisted as is —
 *      this was the measured cost on `guests` (one SECURITY DEFINER call per
 *      guest, three policies deep). The rewrite asks the question the other
 *      way round: "which events is this caller a live helper on, at what
 *      level" — once — then tests membership with a hashed sub-plan.
 *      Identical because:
 *        • current_moderator_area_levels(a) returns (e, moderator_area_level(e, a))
 *          for exactly the events where moderator_area_level can return non-NULL
 *          (the same accepted / not-removed / own-user filter), computed BY
 *          moderator_area_level itself — the rule still lives in one place;
 *        • event_moderators is UNIQUE (event_id, user_id), so that LIMIT 1 is
 *          deterministic and each event appears at most once;
 *        • for every other event the old call returned NULL, and <P>(NULL) is
 *          never TRUE — exactly as "not in the set" is never TRUE;
 *        • every one of the 52 call sites sits under AND / OR only (asserted by
 *          `moderatorCallsAreMonotone`), and in an AND/OR formula a NULL and a
 *          FALSE leaf can never change whether the whole is TRUE — which is the
 *          only thing RLS asks.
 *      `NOT is_limited_helper(event_id)` is deliberately NOT rewritten: it sits
 *      under a NOT, where NULL and FALSE do differ.
 *
 * Nothing else is touched — no role, command, name, or PERMISSIVE/RESTRICTIVE.
 */

const AUTH_FNS = ['uid', 'jwt', 'role', 'email'] as const;
const SCALAR_HELPERS = ['is_admin', 'is_console_admin'] as const;

/** `moderator_area_level(event_id, '<area>'::text) <P>` — the only shapes in the tree. */
export const MODERATOR_CALL =
  /moderator_area_level\(event_id, ('[a-z_]+'::text)\) (IS NOT NULL|= '[a-z_]+'::text|= ANY \(ARRAY\['[a-z_]+'::text(?:, '[a-z_]+'::text)*\]\))/g;

export function askOnce(expr: string | null): string | null {
  if (expr === null) return null;
  let out = expr;
  for (const fn of AUTH_FNS) {
    out = out.replace(
      new RegExp(`(?<![\\w.])(?<!SELECT )auth\\.${fn}\\(\\)`, 'g'),
      `( SELECT auth.${fn}() AS ${fn})`,
    );
  }
  for (const fn of SCALAR_HELPERS) {
    out = out.replace(
      new RegExp(`(?<![\\w.])(?<!SELECT )${fn}\\(\\)`, 'g'),
      `( SELECT ${fn}() AS ${fn})`,
    );
  }
  out = out.replace(
    MODERATOR_CALL,
    (_m, area: string, pred: string) =>
      `(event_id IN ( SELECT l.event_id FROM current_moderator_area_levels(${area}) l WHERE (l.level ${pred})))`,
  );
  return out;
}

/**
 * Every `moderator_area_level(` in `expr` must be one rewritable call, and
 * every operator ENCLOSING it must be AND / OR (or the predicate's own outer
 * parentheses). Walks outward from each call through the parenthesis nesting
 * and reads what sits beside each enclosing group. Returns the offending
 * contexts — empty means safe.
 */
export function moderatorCallsAreMonotone(expr: string | null): string[] {
  if (!expr || !expr.includes('moderator_area_level(')) return [];
  const problems: string[] = [];
  const all = [...expr.matchAll(/moderator_area_level\(/g)].length;
  const calls = [...expr.matchAll(MODERATOR_CALL)];
  if (calls.length !== all) problems.push(`unrecognised moderator_area_level shape in: ${expr}`);

  // Matching parentheses, ignoring any inside string literals.
  const close = new Map<number, number>();
  const stack: number[] = [];
  let inStr = false;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "'") inStr = !inStr;
    if (inStr) continue;
    if (ch === '(') stack.push(i);
    else if (ch === ')') close.set(stack.pop()!, i);
  }
  const JOIN_BEFORE = /(^|\(|\bAND|\bOR)$/;
  const JOIN_AFTER = /^(\)|AND\b|OR\b|$)/;

  for (const m of calls) {
    const start = m.index!;
    const end = start + m[0].length;
    // The call + its predicate must be a whole operand: nothing but a join
    // or a parenthesis directly on either side.
    const groups = [...close.entries()].filter(([o, c]) => o < start && c >= end).sort((a, b) => b[0] - a[0]);
    let lo = start;
    let hi = end;
    for (const [o, c] of [[start, end - 1] as [number, number], ...groups]) {
      const before = expr.slice(0, o === start ? lo : o).trimEnd();
      const after = expr.slice(o === start ? hi : c + 1).trimStart();
      if (!JOIN_BEFORE.test(before)) problems.push(`non-monotone before: …${before.slice(-30)}`);
      if (!JOIN_AFTER.test(after)) problems.push(`non-monotone after: ${after.slice(0, 30)}…`);
      lo = o;
      hi = c + 1;
    }
  }
  return problems;
}

/**
 * plus-ones-under-bringers.ts — the Guest list's row ORDER for a +1.
 *
 * Pure (no React, no DB), so the rule is executed by its guard, not only read.
 */

/**
 * A named +1 is its own row, tucked right under the guest who brings them
 * (owner 2026-09-30, the Fable rows, frame B). Their bringer's own order is
 * kept; a +1 whose bringer is not in view (filtered out) stays where it was.
 */
export function plusOnesUnderBringers<G extends { guest_id: string; plus_one_of_guest_id?: string | null }>(
  rows: readonly G[],
): G[] {
  const inView = new Set(rows.map((r) => r.guest_id));
  const under = new Map<string, G[]>();
  for (const r of rows) {
    const b = r.plus_one_of_guest_id;
    if (b && b !== r.guest_id && inView.has(b)) under.set(b, [...(under.get(b) ?? []), r]);
  }
  const out: G[] = [];
  const placed = new Set<string>();
  const put = (r: G) => {
    if (placed.has(r.guest_id)) return;
    placed.add(r.guest_id);
    out.push(r);
    for (const p of under.get(r.guest_id) ?? []) put(p);
  };
  for (const r of rows) {
    const b = r.plus_one_of_guest_id;
    if (b && b !== r.guest_id && inView.has(b)) continue;
    put(r);
  }
  for (const r of rows) put(r);
  return out;
}

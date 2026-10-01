/**
 * ceremony-choices.ts — WHICH RITES A COUPLE MAY PICK, after the launch gate.
 *
 * The launch gate (`wedding_type_launch_status`, read by
 * `fetchActiveCeremonyTypes` in lib/religion-readiness.ts) says which rites are
 * live; the rest are "coming soon". Onboarding honoured it; Details' "Wedding
 * type" and the date finder's ceremony step listed all 18 and let a couple pick
 * a rite whose suppliers, guide and checklist are not ready (audit 2026-09-30
 * §3, P6a). ONE rule, pure, used by both:
 *
 *  · `active === null` (the read failed) → every rite — the gate never
 *    hard-blocks a couple on a transient error (`fetchActiveCeremonyTypes`'s
 *    own documented fallback);
 *  · 'mixed' always stays — it has no launch row; its rites are picked inside;
 *  · the event's CURRENT rite always stays — a couple is never shown a picker
 *    that cannot hold the value they already have.
 */
export function ceremonyChoicesFor<T extends string>(
  all: readonly T[],
  active: readonly string[] | null,
  current: string | null | undefined,
): T[] {
  if (active === null) return [...all];
  const live = new Set(active);
  return all.filter((v) => v === 'mixed' || live.has(v) || v === current);
}

/**
 * Host Papic Pool Bar feature flag (build ③ PR-1 · read-only meter).
 *
 * Gates the host-facing pool meter — the HostPoolMeterCard on the couple's
 * studio/papic page. READ-ONLY in this phase: no purchase doorway, no top-up,
 * no trust-grant machinery is behind this flag (those ship as later,
 * separately-supervised PRs). Study:
 * ~/Documents/Claude/Projects/Setnayan/OnTheDay_App_Build_Studies_2026-07-23.md § 3
 *
 * NEXT_PUBLIC_ so server pages and any future client widgets agree on one
 * value. NEXT_PUBLIC_ vars are BUILD-TIME INLINED into every bundle, so a bare
 * env flip does nothing until a redeploy (fails safe — never half-open).
 * Off by default — nothing renders until the owner sets
 * NEXT_PUBLIC_PAPIC_POOL_BAR=true and redeploys.
 */
export function papicPoolBarEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_PAPIC_POOL_BAR;
  return v === 'true' || v === '1' || v === 'TRUE';
}

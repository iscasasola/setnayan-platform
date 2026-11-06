/**
 * live-shops.ts — what counts as a shop the public may see, written ONCE.
 *
 * ── WHY THIS LEFT `frontdoor/data.ts` (2026-09-08) ────────────────────────
 * The gate lived next to the front door's shelf, private to it, with its own
 * docblock warning that *"a second hand-typed pair of `.eq()`s is how one
 * reader starts publishing what the other hides, silently and in the direction
 * that costs most."* That warning was right and the file was the wrong home
 * for it: `/explore` now needs the same rule to decide whether its landing has
 * shops to show, and importing a private const from a page component is not
 * available — so the next reader would have hand-typed the pair the warning
 * predicted.
 *
 * 🪤 THE GATE IS NOT `is_published`. That column is LEGACY and no longer
 * queried by the marketplace (`app/(shell)/explore/page.tsx` says so outright:
 * "the legacy `is_published` boolean is no longer queried here"). Measured in
 * prod 2026-09-08: both shops carry `public_visibility='verified'` while one
 * has `is_published=false` — counting the legacy way yields 1 where the
 * marketplace shows 2, which is how a page ends up apologising for emptiness
 * it does not have.
 *
 * ⚠ APPLIED WITH `.match()`, NOT A GENERIC HELPER — carried over verbatim from
 * the original site, because the reason still holds: the obvious
 * `<T extends Builder>(q: T) => T` wrapper makes `tsc` give up with "Type
 * instantiation is excessively deep and possibly infinite" on postgrest-js's
 * builder types. `.match()` takes the same object every reader shares, so the
 * rule is still written once.
 */

/**
 * Both halves, always together. Either one alone has meant a hidden shop on a
 * public shelf before.
 *
 * 🧪 DEMO SHOPS ARE PUBLIC NOW (owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO
 * EVENTS": *"these demo events, and demo suppliers will show on with the rest of
 * suppliers and events, but has a marking of (DEMO ONLY)"*). This SUPERSEDES the
 * 2026-09-30 third half (`is_demo: false`, DECISION_LOG 2026-09-29 "LANE 2 §2C"
 * (1)). A demo shop still has to be listed AND verified to appear — the two
 * halves above — and every surface that draws one wears `DemoOnlyMarker`
 * (`app/_components/sample-marker.tsx`).
 *
 * 🔢 A COUNT IS NOT A LISTING. *"demo numbers never count in real totals"* (same
 * ruling) — so any figure shown as "N suppliers" reads {@link REAL_SHOP_GATE},
 * never this one. Guard: `lib/demo-never-counts.test.ts`.
 */
export const LIVE_SHOP_GATE = {
  public_visibility: 'verified',
  verification_state: 'verified',
} as const;

/**
 * The live gate PLUS "not a demo shop" — for every TOTAL (a count shown as a
 * number, a KPI, a benchmark) and for every supplier search inside a REAL event
 * (`lib/demo-scope.ts`). The column is `NOT NULL DEFAULT false`, so the equality
 * is exact (`.match()` only does equalities).
 */
export const REAL_SHOP_GATE = {
  ...LIVE_SHOP_GATE,
  is_demo: false,
} as const;

/**
 * How many shops the public may see.
 *
 * Returns `null` on a failed read — NEVER 0. The difference is the whole point:
 * 0 makes a page say "no shops yet" to a visitor while the marketplace is fine,
 * which is the failure-renders-as-emptiness class this repo has shipped seven
 * fixes for. A caller that cannot tell the two apart must say "couldn't load".
 */
export async function countLiveShops(admin: {
  from: (t: string) => {
    select: (
      c: string,
      o: { count: 'exact'; head: true },
    ) => { match: (m: Record<string, string | boolean>) => PromiseLike<{ count: number | null; error: unknown }> };
  };
}): Promise<number | null> {
  try {
    const res = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id', { count: 'exact', head: true })
      .match(LIVE_SHOP_GATE);
    if (res.error) {
      console.error('[supabase-error] lib/live-shops.ts · from:vendor_profiles.select', res.error);
      return null;
    }
    return res.count ?? null;
  } catch (err) {
    console.error('[supabase-error] lib/live-shops.ts · from:vendor_profiles.select threw', err);
    return null;
  }
}

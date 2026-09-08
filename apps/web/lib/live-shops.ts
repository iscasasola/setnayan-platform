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
 */
export const LIVE_SHOP_GATE = {
  public_visibility: 'verified',
  verification_state: 'verified',
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
    ) => { match: (m: Record<string, string>) => PromiseLike<{ count: number | null; error: unknown }> };
  };
}): Promise<number | null> {
  try {
    const res = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id', { count: 'exact', head: true })
      .match(LIVE_SHOP_GATE);
    if (res.error) return null;
    return res.count ?? null;
  } catch {
    return null;
  }
}

/**
 * lib/nav-slot-pick.ts — HAND A CLIENT NAV ONLY THE REGISTRY SLOTS IT READS (speed, 2026-11-10).
 *
 * `getNavSlotMap()` resolves EVERY nav-registry slot (190 of them — the admin sidebar, the supplier sidebar, the
 * couple's menus …), and a server component that hands that whole map to a CLIENT component serializes all of it
 * into the page's HTML (the RSC payload). Measured on production, 10 Nov 2026: the root layout's marketing nav carried
 * ~31 KB of it on EVERY page — `/` (298 KB) and `/for-suppliers` (411 KB, the target of `/vendors`), where the
 * front-door rail carried the SAME ~31 KB a second time. The marketing nav reads four `public.site-nav.*` labels; the
 * doorway rail reads none (its registry labels apply in the signed-in `app` variant only, two slots).
 *
 * Nothing on screen changes: each nav reads its labels by key with an in-code fallback, and the keys it reads are
 * exactly the ones kept. Held by `lib/a-nav-gets-only-the-slots-it-reads.test.ts`.
 *
 * Pure (no server-only import) so a server component, a client module's sibling and a test can all use it.
 */

/** The prefix every label the marketing nav (`app/_components/marketing/site-nav.tsx`) reads starts with. */
export const SITE_NAV_SLOT_PREFIX = 'public.site-nav.';

/** The slots of `map` whose key starts with one of `prefixes` or is one of `keys`, in the map's own order. */
export function pickNavSlots<T>(
  map: Record<string, T> | null | undefined,
  want: { prefixes?: readonly string[]; keys?: readonly string[] },
): Record<string, T> {
  const out: Record<string, T> = {};
  if (!map) return out;
  const prefixes = want.prefixes ?? [];
  const keys = new Set(want.keys ?? []);
  for (const [k, v] of Object.entries(map)) {
    if (keys.has(k) || prefixes.some((p) => k.startsWith(p))) out[k] = v;
  }
  return out;
}

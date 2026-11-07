/**
 * explore-empty-grid.ts — what /explore says when its unfiltered grid is empty.
 *
 * ── THE DEFECT (live walk 2026-11-01, production 739140f) ──────────────────
 * The front door listed SetnaProd under "The first shops", `/setnaprod` was live
 * and Verified — and `/explore`, under its own heading "The first shops", said
 * **"No suppliers have published their Setnayan profile yet."**
 *
 * Measured in production the same day (read-only): exactly ONE shop passes
 * `LIVE_SHOP_GATE` (verified · verified; "not demo" too until 2026-11-06) — SetnaProd — and it has
 * **0 active services**. Both pages read the data correctly; they answer
 * different questions:
 *   · the front door's shelf and `countLiveShops` ask "may the public see this
 *     shop?" → yes, 1;
 *   · the Explore grid also asks B2's question (`vendor-inquirable-gate.ts`,
 *     2026-09-17) — "does it have a service a couple can ask about?" → no — and
 *     drops it, correctly: a card there is a dead end.
 * The lie was only the SENTENCE. "No suppliers have published" was never
 * measured — a published shop exists; it has listed nothing yet.
 *
 * So the grid keeps B2, and the empty grid now says what it measured: no
 * SERVICES are listed. Shops that are live but still have no active service are
 * named under it, linking to their page — the same shops, the same links, the
 * front door shows, so the two pages agree.
 */

export type ShopStillSettingUp = { name: string; href: string };

/**
 * Live shops (rows already read under `LIVE_SHOP_GATE`) that have no active
 * service yet — the ones the Explore grid's B2 gate leaves out.
 *
 * The link is the bare-root address, as the front door's shelf builds it. A row
 * missing its name or slug is skipped rather than drawn as a broken link.
 */
export function shopsStillSettingUp(
  liveRows: ReadonlyArray<{ vendor_profile_id: unknown; business_name: unknown; business_slug: unknown }>,
  inquirableVendorIds: Iterable<string>,
): ShopStillSettingUp[] {
  const inquirable = new Set(inquirableVendorIds);
  const out: ShopStillSettingUp[] = [];
  for (const r of liveRows) {
    if (typeof r.vendor_profile_id !== 'string' || inquirable.has(r.vendor_profile_id)) continue;
    if (typeof r.business_name !== 'string' || !r.business_name.trim()) continue;
    if (typeof r.business_slug !== 'string' || !r.business_slug.trim()) continue;
    out.push({ name: r.business_name, href: `/${r.business_slug}` });
  }
  return out;
}

/**
 * The unfiltered empty grid's two lines. Never claims nobody has published —
 * the grid lists services, so "no services listed yet" is what an empty grid
 * measured. With shops still setting up, the second line introduces them.
 */
export function unfilteredEmptyGridCopy(stillSettingUp: number): { line: string; sub: string } {
  const line = 'No services listed yet.';
  if (stillSettingUp <= 0) return { line, sub: 'Check back soon — suppliers are landing every week.' };
  return {
    line,
    sub:
      stillSettingUp === 1
        ? 'This supplier has opened their shop and is still adding services:'
        : 'These suppliers have opened their shops and are still adding services:',
  };
}

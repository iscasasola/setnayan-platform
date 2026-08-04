/**
 * vendor-ai-ladder-flag.ts — the switch for the Vendor AI Basic/Advanced ladder.
 *
 * Its OWN flag, separate from `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` (which
 * decides add-on PRICE BANDS) and from `NEXT_PUBLIC_VENDOR_AUTOREPLY_V1` (which
 * decides whether the assistant runs at all). This one decides only whether the
 * add-on has TWO RUNGS.
 *
 * ⚠ IT ALSO GATES WHETHER APP CODE NAMES `ai_addon_level` AT ALL. That is not
 * cosmetic: PostgREST answers a `select` naming an unknown column with `42703`
 * and returns `{ data: null }` for the **entire row**, not `undefined` for one
 * field. So in any environment whose database has not received migration
 * `20271003111715`, a level-aware read would blank the whole vendor profile —
 * silencing the assistant and the subscription page for every vendor at once.
 * With this flag off, no query mentions the column, so a schema/deploy skew is
 * harmless.
 *
 * NEXT_PUBLIC so the card's preview and the server's decision agree on one value.
 * Default OFF → every vendor reads as Basic, the Advanced SKU is unsellable
 * (its catalog row also ships `is_active=false`), and behaviour is byte-identical
 * to the single-rung add-on.
 */
export function isVendorAiLadderEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_AI_LADDER;
  return v === '1' || v === 'true';
}

/**
 * service-card-auto-title.ts — A SERVICE CARD IS NAMED, NEVER ASKED FOR A NAME.
 *
 * ── THE DEFECT THIS CLOSES, MEASURED IN PRODUCTION 2026-09-10 ──────────────
 * `SELECT count(*) FILTER (WHERE title IS NULL) FROM vendor_services` = **2 of
 * 2**. Both live cards are `is_active = true` and both are nameless, so a couple
 * browsing reads the bare kind — "Wedding Bands (full ensemble)" — where the
 * shop's own name for that service should be. The card is the middle of the
 * two-sided test.
 *
 * ── WHY THE FIX IS A FILL AND NOT A REQUIREMENT ────────────────────────────
 * ⛔ `title` is deliberately NOT added to `PUBLISH_REQUIREMENTS`. The owner
 * locked the opposite on 2026-07-27 — *"saving builds blank will make us
 * autocreate a name"* — so refusing a publish for a missing title would be
 * demanding the one thing the product promises to write for them. The invariant
 * is *"no live card is nameless"*, and a fill satisfies it without ever putting
 * a refusal in front of a supplier.
 *
 * ── WHY THE TWO LIVE CARDS ARE NAMELESS (established, not assumed) ─────────
 * The auto-namer already existed — and it is a CLIENT-SIDE `useEffect` in
 * `canvas-maker.tsx`, gated on `initial === null`. So it fires for a brand-new
 * card and for nothing else:
 *
 *   · Both production rows were created 2026-08-01 08:10:21.894705+00 —
 *     identical to the microsecond, i.e. seeded — before that effect could
 *     have run for them.
 *   · They were edited as recently as 2026-09-08 and the title is STILL NULL,
 *     because no edit path names a card: the legacy editor's own comment says
 *     it "does not submit or write `title`", and the maker's effect returns
 *     early whenever `initial` is present.
 *   · `new/[category]/page.tsx` — the start-from-one-of-your-cards route —
 *     mounts `<CanvasMaker>` with NO `shopName` prop at all, so even a copy
 *     that did auto-name could only ever be called after its kind.
 *
 * ⇒ **The name was never asked for and never written.** A repair that demanded
 * a title would have punished the supplier for our own missing write.
 *
 * ── WHERE THIS RULE IS ENFORCED (all of them, on purpose) ──────────────────
 *   1. The maker writes a name into the box for a NEW card (shipped; unchanged
 *      by this module — its inline expression is pinned against this file by
 *      `a-card-cannot-go-live-nameless.test.ts`).
 *   2. `commitVendorService` fills a blank title before the write, so every
 *      save through the app names the card whatever route reached it.
 *   3. `fill_blank_service_card_title()` — a BEFORE INSERT OR UPDATE trigger —
 *      is the FLOOR. It is load-bearing, not belt-and-braces: measured in
 *      production, `authenticated` holds UPDATE on both `title` and `is_active`
 *      of `vendor_services`, so a shop can PATCH a live nameless card straight
 *      through PostgREST and meet no TypeScript in this repo. `save_vendor_service`
 *      (SECURITY DEFINER, read out of prod by `pg_get_functiondef`) writes
 *      `title = NULLIF(p_fields->>'title', '')`, which BLANKS the column for any
 *      payload that omits the key — so the RPC can un-name a card too.
 *
 * 🔒 THE SHOP NAME IS ONLY EVER THE ONE THE MARKETPLACE ALREADY SHOWS. The
 * caller resolves it through the shipped hybrid-anonymity rule
 * (`isVendorNameRevealed`) and hands `null` when the name is hidden, at which
 * point the card is named after its kind alone. A stored title is rendered raw
 * (`app/v/[slug]/page.tsx`: `s.title?.trim() || displayServiceLabel(s.category)`)
 * with no anonymity filter of its own, so baking `business_name` into it
 * unconditionally would publish an unverified shop's real name and freeze it
 * there. ⛔ Never pass `business_name` to this function without that test.
 *
 * Pure and synchronous — no I/O, no React, no `server-only` — so the server
 * action and a plain `node:test` can both reach it.
 */

/**
 * The stored `title` column is `text`, but every writer clamps to 80 so the
 * name stays a card title rather than a paragraph. The maker's own inline
 * expression uses the same number; the trigger uses `left(…, 80)`.
 */
export const SERVICE_CARD_TITLE_MAX = 80;

export type AutoServiceCardTitleInput = {
  /**
   * What this card IS, already resolved to words a couple can read — the
   * shop's own coverage leaf, else the legacy label, else a humanised key
   * (`cardKindLabel`, lib/service-card-kind.ts). NEVER a raw database key:
   * "NEVER PRINT A DATABASE KEY AT A COUPLE" (lib/vendors.ts, 2026-08-09).
   */
  kindLabel: string;
  /**
   * The shop's name **as the marketplace would show it right now**, or `null`
   * when the hybrid-anonymity rule hides it. See the module header.
   */
  shopName: string | null | undefined;
};

/**
 * The name a nameless card is saved under — "Wedding Bands (full ensemble) by
 * Saysay Live Band & Hosting".
 *
 * ⚖ SHAPED TO MATCH THE MAKER BYTE FOR BYTE, deliberately. `canvas-maker.tsx`
 * has written `${label} by ${shopName}` sliced at 80 since 2026-07-27, and a
 * server that named the same card differently would show a supplier one name in
 * the maker and store another. Two copies of one rule always drift, so the
 * copies are pinned against each other by a guard rather than trusted.
 *
 * Returns `''` only when it is handed nothing to work with, which the caller
 * must treat as "leave the column NULL" — an empty string in `title` would be a
 * name that is not a name, and every reader tests `title?.trim()`.
 */
export function autoServiceCardTitle(input: AutoServiceCardTitleInput): string {
  const kind = (input.kindLabel ?? '').trim();
  const shop = (input.shopName ?? '').trim();
  if (kind.length === 0) return '';
  const joined = shop.length > 0 ? `${kind} by ${shop}` : kind;
  return joined.slice(0, SERVICE_CARD_TITLE_MAX).trim();
}

/**
 * The title this card should be written with: what the supplier typed, else the
 * name we write for them, else `null`.
 *
 * `null` rather than `''` — the column is nullable and every reader in the app
 * asks `title?.trim() || <fallback>`, so an empty string would be a stored value
 * that behaves exactly like the absence it replaced while looking like a fix.
 */
export function serviceCardTitleOrAuto(
  typed: string | null | undefined,
  auto: AutoServiceCardTitleInput,
): string | null {
  const own = (typed ?? '').trim();
  if (own.length > 0) return own.slice(0, SERVICE_CARD_TITLE_MAX);
  const named = autoServiceCardTitle(auto);
  return named.length > 0 ? named : null;
}

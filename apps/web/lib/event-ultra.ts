/**
 * apps/web/lib/event-ultra.ts — 💎 EVENT ULTRA, the third event plan (owner 2026-11-13).
 *
 * ⚖ DECISION_LOG 2026-11-13 "EVENT ULTRA APPROVED — BUILD IT": *"yes update it. including the rest of the details in
 * the app and documentation. keep those prices."* Ultra = everything in Event Pro, plus:
 *   1. Live Watch, one day — the SELF-RUN `LIVE_STUDIO`, never `LIVE_STUDIO_HOSTED_CHANNEL` (staff-operated);
 *   2. full-size originals kept 12 months after the event's last day instead of 3 — the catalogue row's
 *      `fullres_extra_keep_days`, read by `papic_events_past_fullres_clock` (migration `_event_ultra_plan`);
 *   3. canvas prints (the Our Day poster on canvas) — `canvasPrintsUnlockedFrom` below;
 *   4. Patiktok — `PATIKTOK_COMPILER`;
 *   5. Papic credits — the row's `included_papic_credits` (3,500), granted by `activateEventPlan`;
 *   6. the Thank You video ONLY if it renders with no staff step. It does (browser render, lib/thank-you-video.ts),
 *      but it is already FREE for every event (`FREE_FOR_ALL_SKUS`), so Ultra lists nothing for it — selling a free
 *      thing as an Ultra extra would be untrue.
 * Excluded, because staff make them by hand: Music Maker (`PAKANTA`) and the hosted channel.
 *
 * 🔑 NO PRICE AND NO CREDIT COUNT IS TYPED HERE — both are the `EVENT_ULTRA` catalogue row (`platform_retail_catalog_v2`).
 *
 * PURE and import-free: lib/entitlements.ts reads `EVENT_ULTRA_GRANTS` for its ownership aliases, and that module is
 * imported by nearly everything, so this one must never import back.
 */

/** The catalogue code — `orders.service_key` for an Ultra order. */
export const EVENT_ULTRA_SKU = 'EVENT_ULTRA';

/**
 * The SKUs an Ultra order confers ownership of, read side only (`SKU_OWNERSHIP_ALIASES` in lib/entitlements.ts): every
 * gate that already asks for one of these answers yes for an Ultra event, so no new gate is needed and no order row is
 * minted per part. A refund of the Ultra order takes all of them away together.
 *   · `COUPLE_WEBSITE_PRO` — Event Pro, whole (and, through the alias lists that already name Pro, the logo animation,
 *     Editorial and the premium Save-the-Date openings — aliases are not transitive, so each list names Ultra too);
 *   · `LIVE_STUDIO`        — Live Watch, self-run;
 *   · `PATIKTOK_COMPILER`  — Patiktok's save / share / post half (`patiktokSaveUnlocked`).
 */
export const EVENT_ULTRA_GRANTS: readonly string[] = Object.freeze([
  'COUPLE_WEBSITE_PRO',
  'LIVE_STUDIO',
  'PATIKTOK_COMPILER',
]);

/**
 * 🚫 Never granted by Ultra — staff make or operate them by hand (owner 2026-11-13, *"so the service is something we do
 * not need to manually generate for them"*). `event-ultra.test.ts` holds the two lists apart.
 */
export const EVENT_ULTRA_NEVER_GRANTS: readonly string[] = Object.freeze(['PAKANTA', 'LIVE_STUDIO_HOSTED_CHANNEL']);

/** One order, as the canvas gate needs it. */
export type PlanOrderFact = { service_key: string | null; status: string | null; created_at: string | null };

const PAID = new Set(['paid', 'fulfilled']);

/**
 * The moment canvas left Event Pro for NEW buyers: the end of the ruling day, 13 Nov 2026 (Manila). A date, not a
 * price. Canvas prints did not exist in the app before this (the Our Day poster is approved, not built), so no Pro
 * buyer has ever printed one — the line only decides who keeps the right when the poster ships. Moving it LATER only
 * grandfathers more events; never move it earlier.
 */
export const CANVAS_LEFT_PRO_AT = '2026-11-14T00:00:00+08:00';

/**
 * 🖼 CANVAS PRINTS — Ultra, plus a GRANDFATHER for Event Pro (owner 2026-11-13: *"Canvas + Patiktok move OUT of Pro
 * for new buyers; couples who already bought Pro keep what they paid for"*).
 *
 *   · an approved Ultra order → yes;
 *   · an approved Event Pro order placed BEFORE `CANVAS_LEFT_PRO_AT` → yes: they bought Pro while canvas was part of it;
 *   · anything else → no. An order with no readable date is grandfathered — a bad read may only ever keep a paid
 *     unlock, never take one away.
 *
 * Patiktok needs no twin of this: Pro never granted `PATIKTOK_COMPILER` in code (it was always its own order), so
 * nothing a Pro buyer holds today is removed.
 */
export function canvasPrintsUnlockedFrom(
  orders: readonly PlanOrderFact[],
  cutoverIso: string = CANVAS_LEFT_PRO_AT,
): boolean {
  const since = Date.parse(cutoverIso);
  return orders.some((o) => {
    if (!o.status || !PAID.has(o.status)) return false;
    if (o.service_key === EVENT_ULTRA_SKU) return true;
    if (o.service_key !== 'COUPLE_WEBSITE_PRO') return false;
    if (!Number.isFinite(since)) return true;
    const placed = o.created_at ? Date.parse(o.created_at) : NaN;
    // An order with no readable date is kept, for the same reason.
    return !Number.isFinite(placed) || placed < since;
  });
}

/**
 * The full-size hold for an event, in days after its last day: the standard hold plus the largest extra hold of any
 * plan it holds. Mirrors the SQL term in `papic_events_past_fullres_clock` so a screen can say the same date the sweep
 * uses. Negative / unreadable extras count as 0 — the term can only keep files longer.
 */
export function fullResKeepDays(standardDays: number, extraKeepDays: readonly (number | null | undefined)[]): number {
  const extra = extraKeepDays.reduce<number>(
    (m, n) => (typeof n === 'number' && Number.isFinite(n) && n > m ? n : m),
    0,
  );
  return standardDays + extra;
}

/* ── 💳 UPGRADE: PAY THE DIFFERENCE (owner 2026-11-13) ─────────────────────────────────────────────────────────────
 * ⚖ DECISION_LOG 2026-11-13 "EVENT ULTRA UPGRADE — PAY THE DIFFERENCE", verbatim: *"Pay the difference"*. An event that
 * already PAID for Event Plus or Event Pro pays Ultra's price minus what it paid for its current plan — every number a
 * `platform_retail_catalog_v2` read, exactly as Plus → Pro already credits Plus (`hubOwnershipFrom`'s `plusPaid`). Pure:
 * the reads live in `readUltraUpgradeCharge` (lib/order-charge-authority.ts), which both the charge and the drawer's
 * quote call, so the figure on the screen is the figure billed.
 */

/** Which plan the credit came from — the words on the screen follow it. */
export type UltraUpgradeFrom = 'pro' | 'plus' | 'parts';

export type UltraUpgradeCharge =
  | { ok: true; php: number; creditPhp: number; from: UltraUpgradeFrom }
  | { ok: false; why: 'unpriced' };

const pricedPhp = (n: number | null | undefined): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;

/**
 * What an event that already paid toward a plan pays for Ultra — or null when it paid toward none (Ultra's row price,
 * as before). 🔒 FAIL-CLOSED: a plan the event paid for whose price was not read is `unpriced` (the charge refuses);
 * it never silently counts as ₱0, which would bill the full Ultra price to someone owed a credit.
 *
 *   · `proPaid`          — an Event Pro order (its own, or a basket line) in a status that counts → Pro's row price;
 *   · otherwise          — `paidTowardProPhp` (`HubOwnership.paidPhp`: Plus at its row price + any Pro parts), the very
 *                          figure Plus → Pro already credits.
 * Never below ₱0.
 */
export function ultraUpgradeCharge(input: {
  ultraPhp: number | null;
  proPaid: boolean;
  proPhp: number | null;
  plusPaid: boolean;
  plusPhp: number | null;
  paidTowardProPhp: number;
}): UltraUpgradeCharge | null {
  const toward = Number.isFinite(input.paidTowardProPhp) && input.paidTowardProPhp > 0 ? input.paidTowardProPhp : 0;
  if (!input.proPaid && !input.plusPaid && toward === 0) return null;
  const ultra = pricedPhp(input.ultraPhp);
  if (ultra === null) return { ok: false, why: 'unpriced' };
  if (input.proPaid) {
    const pro = pricedPhp(input.proPhp);
    if (pro === null) return { ok: false, why: 'unpriced' };
    return { ok: true, php: Math.max(0, ultra - pro), creditPhp: pro, from: 'pro' };
  }
  if (input.plusPaid && pricedPhp(input.plusPhp) === null) return { ok: false, why: 'unpriced' };
  return { ok: true, php: Math.max(0, ultra - toward), creditPhp: toward, from: input.plusPaid ? 'plus' : 'parts' };
}

/** The one line the checkout shows — the amount is formatted by the caller from the figure it charges. */
export function ultraUpgradeLine(amountLabel: string, from: UltraUpgradeFrom): string {
  if (from === 'parts') return `You pay ${amountLabel} — the difference from what you paid toward Event Pro`;
  return `You pay ${amountLabel} — the difference from your ${from === 'pro' ? 'Event Pro' : 'Event Plus'}`;
}

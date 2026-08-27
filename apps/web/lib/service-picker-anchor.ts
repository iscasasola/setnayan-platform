/**
 * service-picker-anchor.ts — where "make me a service card" actually lands.
 *
 * 🔴 THE BUG. A supplier with NO service cards — exactly who the button is for —
 * pressed "+ Create service card" in their Shop bar and nothing happened. Three
 * failures stacked, and each one on its own is enough to break it:
 *
 *   1. The href pointed at `/vendor-dashboard/services`, which has been RETIRED
 *      as a destination since 2026-07-02 and `redirect()`s to My Shop. A
 *      fragment never reaches the server, and that redirect rebuilds the URL
 *      from query params only — so `#add-service-picker` was DROPPED in transit.
 *   2. My Shop's services block opens on the tab the shipped rule chooses, and
 *      for a vendor with zero cards that is **Coverage**. The picker lives in
 *      **Service cards**. Panels stay mounted but `hidden`, and a browser will
 *      not scroll to an anchor inside a hidden panel.
 *   3. The picker is a `<details>` that is only `open` when a category was
 *      requested. Even landing on the right tab, it is a shut drawer.
 *
 * So the button opened a page, scrolled nowhere, opened nothing, and reported
 * no error. ⚠ THE QUIETEST FAILURE IN THIS FAMILY: nothing is broken, nothing
 * throws, and the supplier concludes the product does not work.
 *
 * 🔑 WHY A SHARED LEAF AND NOT THREE HAND-TYPED STRINGS. This repo already has
 * `lib/admin-map/sku-anchor.ts` for exactly this, and its docblock names the
 * trap: *"a href written in one file and an `id` typed in another is the
 * two-hand-typed-things failure this repo keeps paying for, with the quietest
 * symptom of the family — the link works, the page opens, and it simply does not
 * scroll to anything."* That is this bug, word for word. The id, the query
 * param and the whole href are declared ONCE here and imported by both halves,
 * so they cannot drift.
 *
 * ⚖ FOUR CALL SITES, FOUND BY GREPPING THE TARGET RATHER THAN REMEMBERING THE
 * CALLERS. The brief named one; the shop's own first-run checklist ("Put up
 * your first service") was a second and is arguably worse, because it renders
 * ONLY while the supplier has zero cards — the exact state that lands on
 * Coverage. The music-repertoire and empty-earnings prompts were the other two.
 */

/** The picker's DOM id. Both the `<details>` element and every link to it. */
export const SERVICE_PICKER_ANCHOR_ID = 'add-service-picker';

/**
 * The query param that survives a redirect, because a `#fragment` does not.
 * It carries the INTENT ("I came here to make a card") which the server needs
 * before it can choose a tab or open a drawer.
 */
export const SERVICE_PICKER_PARAM = 'newcard';

/**
 * The one href for "take me somewhere I can make a service card".
 *
 * ⚠ IT POINTS AT MY SHOP DIRECTLY, NOT AT THE RETIRED `/services` STUB. Going
 * through the stub costs a redirect that silently eats the fragment; there is no
 * reason to keep the hop now that the editor lives here. The param survives
 * either way, so a stale bookmark of the old address still opens the picker —
 * it just does not scroll.
 */
export const SERVICE_PICKER_HREF =
  `/vendor-dashboard/shop?${SERVICE_PICKER_PARAM}=1#${SERVICE_PICKER_ANCHOR_ID}` as const;

/**
 * ⛔ `SERVICE_PICKER_HASH` IS RETIRED (2026-08-28) AND MUST NOT COME BACK AS A
 * "CREATE" LINK. It was the in-page jump to the drawer, and when the shop's own
 * *Add a service* controls started opening the maker it was left with zero
 * callers. A constant nothing links to is a door nobody opens — the shape this
 * repo keeps paying for — so it is gone rather than kept "just in case".
 *
 * The drawer itself SURVIVES on its own anchor id: it is how coverage is added,
 * and it is where `/services/new` sends a shop whose canvas maker is switched
 * off. What was deleted is the LINK, not the target.
 */

/**
 * Did this request ask for the picker?
 *
 * Deliberately strict about what counts as yes, and silent about anything else:
 * an unrecognised value must not open a drawer nobody asked for, and must not
 * throw either. Same shape as the picker's own `readFilters`.
 */
export function servicePickerRequested(raw: unknown): boolean {
  return raw === '1' || raw === 'true';
}

/**
 * ─── WHERE "+ CREATE SERVICE CARD" GOES NOW (owner 2026-08-28) ─────────────
 *
 * Owner, on pressing it: *"i just bounces to a page for a link to service card.
 * we want it to directly go to a page to create a service card."* He is right —
 * everything below fixed the button LANDING somewhere, and where it landed was
 * still My Shop with a drawer full of links. The press should open the maker.
 *
 * So the create links point HERE, at the maker itself, and the kind of service
 * is chosen ON the card instead of on the way to it — which is the owner-locked
 * shape of that screen ("THE MAKER IS ZERO STEPS — THE CARD IS THE FORM").
 *
 * ⚠ THE PICKER CONSTANTS ABOVE ARE NOT DEAD AND MUST NOT BE DELETED. The
 * drawer on My Shop still exists, still opens on `?newcard=1`, and is where
 * `/services/new` sends a shop when the canvas maker is switched off — the
 * 6-step wizard takes its category from the ROUTE and cannot ask for one.
 */
export const SERVICE_MAKER_HREF = '/vendor-dashboard/services/new' as const;

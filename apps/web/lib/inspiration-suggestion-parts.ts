import { libraryPhotoParts, type PhotoPart } from './inspiration-slots';
import { slotUploadVerdict } from './moodboard-gallery-upload';
import { tradeLabelForCredit } from './moodboard-gallery';

/**
 * lib/inspiration-suggestion-parts.ts — 🤝🖼 WHICH OF THE COUPLE'S PARTS A BOOKED SUPPLIER MAY SUGGEST PHOTOS TO
 * (owner 2026-10-19, DECISION_LOG "SUPPLIERS ADD INSPIRATION BY THEIR CATEGORY — EVERY PART, ATTIRE INCLUDED":
 * *"suppliers for those categories can upload photos for that"* · *"so does the other parts"*).
 *
 * 🔑 ONE MAP, NO SECOND LIST. The couple's parts are `libraryPhotoParts()` (the Palette's Venue & decor · the room ·
 * the flowers · Cake, then the Attire boards — the same list the couple's "Which part?" and the supplier's library
 * read), and a part is this shop's when `slotUploadVerdict` allows it — the shop's own `services[]` against the slot's
 * trades (`MOODBOARD_SLOT_TRADES`). Bouquets are the florist's alone; the attire boards go to the attire trades; Stage
 * is never a florist's. The database asks the same question (`inspiration_suggestion_services`, migration
 * 20271279311294) and `a-supplier-suggests-only-to-its-own-parts.db.test.ts` fails when the two disagree.
 *
 * Server-side (it reads the taxonomy); the board receives the answer as keys.
 */

/** Every couple part this shop may suggest a photo to, in the couple's order. */
export function suggestablePartsForShop(services: readonly string[] | null | undefined): PhotoPart[] {
  return libraryPhotoParts().filter((p) => slotUploadVerdict(p.key, services).allowed);
}

/**
 * The shop's trade in one word, as the role line says it ("You are their florist …"): the trade of the part it dresses
 * that the board draws FIRST (`firstOwnPart`), from the shop's own services (`tradeLabelForCredit` — never the slot's
 * first tile as a stand-in), "Stylist / Decorator" said as "Stylist". `null` when no part is this shop's.
 */
export function supplierTradeWord(services: readonly string[] | null | undefined, slotKey: string | null): string | null {
  if (!slotKey) return null;
  const label = tradeLabelForCredit(slotKey, services);
  return label ? (label.split(' / ')[0] ?? label) : null;
}

/**
 * dangling-trade-keys.ts — WHO IS HOLDING A KEY THAT POINTS AT NOTHING.
 *
 * 🚨 NO FOREIGN KEY WILL EVER TELL US THIS. Ten of the twelve columns that
 * store a canonical trade key have NO foreign key to the taxonomy at all —
 * `vendor_coverages.canonical_service`, `vendor_services.category` and
 * `vendor_profiles.services[]` (a TEXT[], which cannot have one) included. Only
 * `vendor_service_attributes` and `event_vendor_preferences` hold a RESTRICT FK,
 * so a trade removed out from under the others is refused ONLY IF one of those
 * two rows happens to exist. That is protection by coincidence.
 *
 * A dangling key has no symptom. The shop's page still renders, the chip just
 * humanises the raw key; the marketplace filter matches nothing, which looks
 * like an unpopular category. So it has to be ASKED FOR, and this is the ask.
 *
 * 🔑 A MERGED trade is NOT dangling. Its row is still there carrying
 * `merged_into`, which is the whole point of the tombstone — it resolves.
 * Only a key with no row at all is a defect.
 *
 * The pure half takes rows and returns findings so a guard can seed a dangling
 * key and prove the report actually fires.
 */
import { CANONICAL_KEY_HOLDERS, type CanonicalKeyHolder } from './taxonomy-merge-holders';

export type DanglingFinding = {
  /** `table.column` */
  holder: string;
  /** The key that resolves to no trade. */
  key: string;
  /** How many rows of that holder carry it. */
  rows: number;
};

/** One holder's observed keys, as read from the database. */
export type HolderKeyCount = {
  table: string;
  column: string;
  key: string;
  rows: number;
};

/**
 * Compare what is HELD against what EXISTS. `liveKeys` must be every row of
 * `canonical_service_taxonomy` — merged-away trades INCLUDED, because their
 * rows still exist and still resolve.
 *
 * ⚠ Fails toward reporting nothing when handed nothing: an empty `liveKeys`
 * means the taxonomy read failed, and calling all 288 trades dangling would be
 * a false alarm big enough that nobody would ever read this report again.
 */
export function findDanglingKeys(
  held: readonly HolderKeyCount[],
  liveKeys: ReadonlySet<string>,
): DanglingFinding[] {
  if (liveKeys.size === 0) return [];
  const out: DanglingFinding[] = [];
  for (const h of held) {
    if (!h.key) continue;
    if (liveKeys.has(h.key)) continue;
    out.push({ holder: `${h.table}.${h.column}`, key: h.key, rows: h.rows });
  }
  return out.sort((a, b) => b.rows - a.rows || a.holder.localeCompare(b.holder));
}

/** The holders this report walks — the same registry the merge moves. */
export function reportedHolders(): readonly CanonicalKeyHolder[] {
  return CANONICAL_KEY_HOLDERS;
}

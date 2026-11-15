/**
 * marketplace-faith-options.ts — the marketplace's faith narrow: URL value ⇄ key ⇄ label, in the drawer's order.
 *
 * ─── MOVED HERE 2026-11-12, UNCHANGED, FROM `app/(shell)/explore/page.tsx` ─────────────────────────────────
 * The filter drawer opens from Discover's Shops shelf too (DECISION_LOG 2026-11-12 "DISCOVER WITH SUPPLIERS —
 * PROTOTYPE APPROVED"), and that shelf must not load the server-only marketplace view to learn the faiths. One list,
 * so the shelf's drawer and the supplier view's drawer offer the same faiths in the same words.
 *
 * Pure: no I/O, no React.
 */
import type { WeddingFaithKey } from '@/lib/taxonomy';

/**
 * 2026-05-30 — Ceremony Faith pill canonical lookups. The TaxonomyEntry
 * uses TitleCase faith keys ('Catholic' / 'Christian' / 'INC' / 'Muslim'
 * / 'Cultural') because they were authored as display labels. The URL
 * carries lowercase so /vendors?folder=ceremony&faith=catholic stays
 * scannable + matches the existing param style (?venue=garden, etc.).
 * The pill UI reads `FAITH_KEY_TO_LABEL` for the chip caption.
 *
 * INC stays uppercase as the label (it's an organization name —
 * Iglesia Ni Cristo) but the URL param is `inc` for consistency.
 */
// Derived from the canonical lib vocabulary (minus Civil — civil couples have
// no faith pill; they simply see the universal set). Adding a faith to
// WEDDING_FAITH_KEYS forces the URL/label maps below to be extended here.
export type FaithKey = Exclude<WeddingFaithKey, 'Civil'>;
export const FAITH_URL_TO_KEY: Record<string, FaithKey> = {
  catholic: 'Catholic',
  christian: 'Christian',
  inc: 'INC',
  muslim: 'Muslim',
  cultural: 'Cultural',
  chinese: 'Chinese',
  jewish: 'Jewish',
  born_again: 'Born Again',
  aglipayan: 'Aglipayan',
  lds: 'LDS',
  sda: 'SDA',
  jw: 'JW',
  hindu: 'Hindu',
  sikh: 'Sikh',
  buddhist: 'Buddhist',
  orthodox: 'Orthodox',
};
export const FAITH_KEY_TO_URL: Record<FaithKey, string> = {
  Catholic: 'catholic',
  Christian: 'christian',
  INC: 'inc',
  Muslim: 'muslim',
  Cultural: 'cultural',
  Chinese: 'chinese',
  Jewish: 'jewish',
  'Born Again': 'born_again',
  Aglipayan: 'aglipayan',
  LDS: 'lds',
  SDA: 'sda',
  JW: 'jw',
  Hindu: 'hindu',
  Sikh: 'sikh',
  Buddhist: 'buddhist',
  Orthodox: 'orthodox',
};
export const FAITH_KEY_TO_LABEL: Record<FaithKey, string> = {
  Catholic: 'Catholic',
  Christian: 'Christian',
  INC: 'INC',
  Muslim: 'Muslim',
  Cultural: 'Cultural',
  Chinese: 'Chinese',
  Jewish: 'Jewish',
  'Born Again': 'Born Again',
  Aglipayan: 'Aglipayan (IFI)',
  LDS: 'LDS (Latter-day Saints)',
  SDA: 'Seventh-day Adventist',
  JW: "Jehovah's Witnesses",
  Hindu: 'Hindu',
  Sikh: 'Sikh',
  Buddhist: 'Buddhist',
  Orthodox: 'Orthodox Christian',
};
export const FAITH_KEYS_ORDER: ReadonlyArray<FaithKey> = [
  'Catholic',
  'Muslim',
  'INC',
  'Chinese',
  'Born Again',
  'Christian',
  'Cultural',
  'Jewish',
  'Aglipayan',
  'LDS',
  'SDA',
  'JW',
  'Hindu',
  'Sikh',
  'Buddhist',
  'Orthodox',
];

/** The drawer's faith options (`FilterDrawerProps['faithOptions']`): every faith, in the drawer's order. */
export function marketplaceFaithOptions(): Array<{ value: string; label: string }> {
  return FAITH_KEYS_ORDER.map((k) => ({ value: FAITH_KEY_TO_URL[k], label: FAITH_KEY_TO_LABEL[k] }));
}

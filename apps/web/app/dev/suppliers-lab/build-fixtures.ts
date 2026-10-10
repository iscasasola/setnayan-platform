/**
 * /dev/suppliers-lab — fixtures for the BUILD body (Suppliers PR3), shaped
 * like the approved prototype's "mid" seed: Reception and Ceremony booked (the
 * ceremony with no price), Catering holding a priced shortlist, Cake and
 * Bridal Car with nobody priced yet, and two saved builds — "Garden build" and
 * "Simple". Mesa Kusina is taken on the date, so it is not in the dropdown and
 * "Simple" shares no free date. Nothing here is read from a database; the
 * figures are sample data, not prices of anything Setnayan sells.
 */
import type { BuildCardFree, BuildLineInputVendor, BuildSnapshotPick } from '@/lib/suppliers-build';

export const LAB_BUILD_BUDGET_PHP = 2_250_000;
export const LAB_BUILD_DAY = 'Dec 12';

const v = (vendorId: string, name: string, planGroupId: string, status: BuildLineInputVendor['status'] = 'considering'): BuildLineInputVendor => ({
  vendorId,
  name,
  status,
  planGroupId,
});

export const LAB_BUILD_TILES: ReadonlyArray<{ tile: string; label: string; vendors: BuildLineInputVendor[] }> = [
  { tile: 'reception', label: 'Reception', vendors: [v('v-seda', 'Seda Vertis North', 'reception_venue', 'locked')] },
  { tile: 'ceremony_venue', label: 'Ceremony', vendors: [v('v-santuario', 'Santuario de San Vicente de Paul', 'ceremony_venue', 'locked')] },
  { tile: 'cake', label: 'Cake', vendors: [v('v-asukal', 'Asukal Cakes', 'cake'), v('v-bibingka', 'Bibingka Bakehouse', 'cake')] },
  {
    tile: 'catering',
    label: 'Catering',
    vendors: [
      v('v-bituin', 'Bituin Catering', 'catering'),
      v('v-hiraya', 'Hiraya Table', 'catering'),
      v('v-lola', 'Kusina ni Lola', 'catering'),
      v('v-luntian', 'Luntian Buffet', 'catering'),
      v('v-mesa', 'Mesa Kusina', 'catering'),
    ],
  },
  { tile: 'bridal_car', label: 'Bridal Car', vendors: [] },
];

export const LAB_BUILD_PRICES: Readonly<Record<string, number>> = {
  'v-seda': 1_056_000,
  'v-bituin': 171_000,
  'v-hiraya': 216_000,
  'v-lola': 198_000,
  'v-luntian': 270_000,
  'v-mesa': 153_000,
};

/** Cannot be booked, and the words that say why (the card's own). */
export const LAB_BUILD_BLOCKED: ReadonlyMap<string, string> = new Map([['v-mesa', 'Not available on your date']]);

export const LAB_BUILD_DATE_FIT: ReadonlyMap<string, 'free' | 'booked'> = new Map([
  ['v-bituin', 'free'],
  ['v-hiraya', 'free'],
  ['v-lola', 'free'],
  ['v-luntian', 'free'],
  ['v-mesa', 'booked'],
]);

const p = (groupId: string, label: string, vendorId: string, vendorName: string, locked = false): BuildSnapshotPick => ({
  groupId,
  label,
  vendorName,
  costPhp: LAB_BUILD_PRICES[vendorId] ?? null,
  locked,
  vendorId,
  inclusions: [],
});

const BOOKED: BuildSnapshotPick[] = [
  p('reception_venue', 'Reception', 'v-seda', 'Seda Vertis North', true),
  p('ceremony_venue', 'Ceremony', 'v-santuario', 'Santuario de San Vicente de Paul', true),
];

export type LabSavedBuild = { id: string; title: string | null; budgetPhp: number | null; created: number; picks: BuildSnapshotPick[] };

export const LAB_SAVED_BUILDS: LabSavedBuild[] = [
  { id: 'b-garden', title: 'Garden build', budgetPhp: LAB_BUILD_BUDGET_PHP, created: 1, picks: [...BOOKED, p('catering', 'Catering', 'v-luntian', 'Luntian Buffet')] },
  { id: 'b-simple', title: 'Simple', budgetPhp: LAB_BUILD_BUDGET_PHP, created: 2, picks: [...BOOKED, p('catering', 'Catering', 'v-mesa', 'Mesa Kusina')] },
];

/** Each build's "Free:" line — what the page reads off the calendars. */
export function labBuildFree(picks: ReadonlyArray<BuildSnapshotPick>): BuildCardFree {
  const taken = picks.filter((x) => x.vendorId && LAB_BUILD_DATE_FIT.get(x.vendorId) === 'booked').map((x) => x.vendorName);
  const read = picks.some((x) => x.vendorId && LAB_BUILD_DATE_FIT.has(x.vendorId));
  if (!read) return null;
  return taken.length > 0 ? { kind: 'none', who: taken } : { kind: 'dates', labels: [LAB_BUILD_DAY], more: 0 };
}

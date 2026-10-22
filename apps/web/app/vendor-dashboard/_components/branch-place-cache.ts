/**
 * branch-place-cache — the add-a-branch form's city lookup, asked once per spot.
 *
 * The form reverse-geocodes the pin (server action → Nominatim) to pre-fill the
 * branch city. A supplier nudging the map back and forth, or reopening the form
 * after a cancelled add, used to ask again for a spot already answered. This
 * keeps one answer per spot for the life of the page.
 *
 * A "spot" is the pin rounded to 5 decimals (~1 m) — closer than any two pins a
 * finger can drop, so two keys never share a different city.
 *
 * Only a USEFUL answer is kept: a refusal (no session → `{ city: '', … }`) or a
 * failed call is dropped, so the next move asks again rather than repeating a
 * blank forever.
 *
 * Pure (the lookup is passed in), so `branch-place-is-looked-up-on-a-move.test.ts`
 * can count the calls.
 */

export type BranchPlace = { city: string; address: string };
type LatLng = { lat: number; lng: number };
type Lookup = (lat: number, lng: number) => Promise<BranchPlace>;

const SPOT_DECIMALS = 5;

export function branchSpotKey(v: LatLng): string {
  return `${v.lat.toFixed(SPOT_DECIMALS)},${v.lng.toFixed(SPOT_DECIMALS)}`;
}

/** Make a cache — exported for tests; the form uses the page-wide one below. */
export function makeBranchPlaceCache() {
  const answers = new Map<string, Promise<BranchPlace>>();
  return function lookUp(v: LatLng, lookup: Lookup): Promise<BranchPlace> {
    const key = branchSpotKey(v);
    const known = answers.get(key);
    if (known) return known;
    const asked = lookup(v.lat, v.lng).then(
      (res) => {
        if (!res.city && !res.address) answers.delete(key);
        return res;
      },
      (e: unknown) => {
        answers.delete(key);
        throw e;
      },
    );
    answers.set(key, asked);
    return asked;
  };
}

export const lookUpBranchPlace = makeBranchPlaceCache();

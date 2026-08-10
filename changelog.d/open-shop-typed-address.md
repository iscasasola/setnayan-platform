## 2026-08-10 · feat(open-shop): type your address, the pin follows

Owner: *"for the address. we want them to just type their address so it will show on the pin."*

**This flips the entry point, and it is the right way round.** The step shipped this morning as pin-first: pan the map, drop a pin, get a city. Finding your own shop by panning at 375px is fiddly — and a vendor knows their address by heart. So the **address box is now the primary control**: they type it, the map catches up, and the city comes out of the same lookup. The pin stays draggable, because a geocoder lands on the street and not the unit.

### One request, not two

The obvious composition was `geocodeNominatim` (address → coordinates) then `reverseGeocodeNominatim` (coordinates → city). Both already exist and it would have worked — but it is **two round trips to a free community service with a 1 req/sec usage policy**, for one thing the vendor typed, to fetch a field the first response can already carry.

`lib/geo.ts` gains `geocodeAddressWithCity`: same endpoint, same User-Agent, same 5-second cap, `addressdetails=1`. One call returns the point *and* the municipality, using the same widening ladder as the reverse lookup (`city → town → municipality → village → county → state`) so a pin dropped by hand and an address typed by hand name the place the same way.

⚠ **`geocodeNominatim` is deliberately untouched.** Its callers — the admin vendor save, corrections — want coordinates only, and its contract says so. Widening a shared function to suit one new caller is how a shared function stops being predictable.

### Honesty in the failure cases, which are common here

- **A miss is not an error.** Plenty of real Philippine addresses do not resolve. The copy says *"Couldn't find that — drop your pin on the map instead"*, and the pin and the city both remain available. A vendor whose address does not geocode must still be able to finish.
- **An empty city is a MISS, not an answer.** Nominatim resolves rural addresses to a point without naming a municipality often enough that overwriting a city the vendor already typed would take away their work. The lookup only ever fills a city, never clears one.
- **The city stays a real, editable field** — it is what the marketplace actually filters on. Filled by the lookup, never locked by it.

🪤 **Debounced at 700ms with a stale-response guard.** Every keystroke would otherwise be a request to a rate-limited service; and without the `live` flag, typing "Banawe" then "Banawe Street QC" can settle on the pin for **"Banawe"** — a slower earlier answer landing after a newer one. Same trap the address-availability check carries, same fix.

The typed address is stored in `hq_address` (guarded like everything else on this action — a blank never clobbers a value already set), alongside the coordinates and the city.

Verified: **7300/7300** unit · all 20 `lint-*.mjs` · `tsc` clean · eslint clean.

SPEC IMPACT: None — no new field, no new stored value. `hq_address` already existed and was previously only reachable from My Shop.

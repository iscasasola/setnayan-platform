'use server';

import { headers } from 'next/headers';
import { geocodeAddressWithCity, reverseGeocodeNominatim } from '@/lib/geo';
import { clientIp } from '@/lib/client-ip';
import { enforceRateLimit } from '@/lib/with-rate-limit';

/**
 * 🔒 THE GATE IS A PER-IP BUDGET, NOT A SESSION (2026-11-05).
 *
 * These two actions used to open with `if (!user) return empty`. But the
 * `/open-shop` wizard is SIGNED OUT until its last step creates the account —
 * the page renders it to anonymous visitors on purpose — so every NEW supplier
 * got the empty answer and read *"Couldn't find that — drop your pin"* /
 * *"Couldn't name that spot"* for a perfectly good address. The only vendors
 * the lookup ever worked for were the ones who already had an account.
 *
 * What the session check was really for is protecting Nominatim (a free
 * community service, 1 req/sec policy) from being used as an open proxy. A
 * per-IP budget does that job without needing an account: one shared bucket for
 * both actions, generous enough for a vendor typing and dragging a pin
 * (the address box is debounced at 700 ms), far below a scraper.
 * `enforceRateLimit` is the repo's two-layer limiter (in-memory + durable
 * Postgres), and it fails OPEN on a limiter outage so a real vendor is never
 * refused because the limiter broke. A refused call returns the same empty
 * answer as a miss, whose copy already offers the honest fallback (drop the
 * pin / type the city) — the city field stays the vendor's to type.
 */
const GEOCODE_BUCKET = 'open_shop_geocode';
const GEOCODE_LIMIT = { limit: 40, windowSecs: 600 } as const;

async function geocodeAllowed(): Promise<boolean> {
  const rl = await enforceRateLimit(GEOCODE_BUCKET, clientIp(await headers()), GEOCODE_LIMIT);
  return rl.ok;
}

/**
 * Drop a pin → get the city.
 *
 * Owner 2026-08-10: *"city should be the exact map location. which will provide
 * their city."*
 *
 * RULE 0 — none of the machinery here is new. `reverseGeocodeNominatim`
 * (`lib/geo.ts`) already exists and its own docblock describes exactly this
 * flow: *"Powers the branch 'drop a pin → detect city automatically' flow: the
 * vendor places a pin, we resolve the municipality server-side."* It powers
 * `detectBranchLocation` for vendor branches today. This is the same call with a
 * different door.
 *
 * 🔑 WHY A SEPARATE ACTION INSTEAD OF REUSING `detectBranchLocation`. That one
 * opens with `requireBranchManager()` — and a vendor filling in `/open-shop`
 * has no shop yet, so no branch, so no branch role. Reusing it would return
 * `{ city: '', address: '' }` for **every** vendor in the flow: a silent empty
 * answer that looks exactly like a geocode miss. The gate is right for branches
 * and wrong here; the gate is the only difference.
 *
 * 🔒 STILL GATED, JUST DIFFERENTLY. Nominatim is a free community service with
 * a 1 req/sec policy and an ungated server action is an open geocoding proxy
 * anyone can point at it — which is how a project gets its User-Agent banned.
 * The gate is the per-IP budget above (`geocodeAllowed`), NOT a session:
 * `/open-shop` shows the wizard to signed-out visitors, and a session gate here
 * silently broke the lookup for every new supplier.
 *
 * ⚠ BEST-EFFORT, AND THE CITY STAYS EDITABLE. Nominatim's Philippine coverage is
 * good but not perfect, and its `city` can come back as a province or a barangay
 * for a rural pin. It returns an empty string rather than a guess, and the field
 * it fills is a normal text input the vendor can correct. A pin must never be
 * able to LOCK a vendor out of naming the city they actually serve.
 */
export type DetectedCity = { city: string; address: string; country: string };

export async function detectShopCity(lat: number, lng: number): Promise<DetectedCity> {
  if (!(await geocodeAllowed())) return { city: '', address: '', country: '' };

  const r = await reverseGeocodeNominatim(lat, lng);
  return { city: r?.city ?? '', address: r?.displayName ?? '', country: r?.country ?? '' };
}

/**
 * Type an address → get the pin and the city.
 *
 * Owner 2026-08-10: *"for the address. we want them to just type their address
 * so it will show on the pin."* This is the primary path now; dragging the pin
 * (`detectShopCity` above) became the fine-tune rather than the way in.
 *
 * 🔑 TYPING IS THE RIGHT DEFAULT FOR A PHONE. Finding your own shop by panning a
 * map at 375px is fiddly and slow, and a vendor already knows their address by
 * heart — they type it once and the map catches up. The pin stays draggable
 * because a geocoder lands on the street, not the unit.
 *
 * Same gate and the same honesty as its sibling: the per-IP budget (an ungated
 * action is an open geocoding proxy pointed at a free community service), and a
 * miss returns nulls rather than a guess. A vendor whose address does not
 * resolve must still be able to finish — the city field stays theirs to type.
 */
export type LocatedAddress = {
  lat: number | null;
  lng: number | null;
  city: string;
  address: string;
  /** ISO-3166 alpha-2 of the match — recorded rather than assumed. */
  country: string;
};

export async function locateShopAddress(query: string): Promise<LocatedAddress> {
  const empty: LocatedAddress = { lat: null, lng: null, city: '', address: '', country: '' };
  if (!(await geocodeAllowed())) return empty;

  const r = await geocodeAddressWithCity(query);
  if (!r) return empty;
  return { lat: r.latitude, lng: r.longitude, city: r.city, address: r.displayName, country: r.country };
}

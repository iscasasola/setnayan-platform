'use server';

import { createClient } from '@/lib/supabase/server';
import { geocodeAddressWithCity, reverseGeocodeNominatim } from '@/lib/geo';

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
 * 🔒 STILL GATED, JUST DIFFERENTLY. It requires a signed-in user, because
 * Nominatim is a free community service with a 1 req/sec policy and an ungated
 * server action is an open geocoding proxy anyone can point at it — which is how
 * a project gets its User-Agent banned. `/open-shop` already redirects a logged
 * out visitor to sign in first, so this costs a real vendor nothing.
 *
 * ⚠ BEST-EFFORT, AND THE CITY STAYS EDITABLE. Nominatim's Philippine coverage is
 * good but not perfect, and its `city` can come back as a province or a barangay
 * for a rural pin. It returns an empty string rather than a guess, and the field
 * it fills is a normal text input the vendor can correct. A pin must never be
 * able to LOCK a vendor out of naming the city they actually serve.
 */
export type DetectedCity = { city: string; address: string };

export async function detectShopCity(lat: number, lng: number): Promise<DetectedCity> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { city: '', address: '' };

  const r = await reverseGeocodeNominatim(lat, lng);
  return { city: r?.city ?? '', address: r?.displayName ?? '' };
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
 * Same gate and the same honesty as its sibling: signed-in only (an ungated
 * action is an open geocoding proxy pointed at a free community service), and a
 * miss returns nulls rather than a guess. A vendor whose address does not
 * resolve must still be able to finish — the city field stays theirs to type.
 */
export type LocatedAddress = {
  lat: number | null;
  lng: number | null;
  city: string;
  address: string;
};

export async function locateShopAddress(query: string): Promise<LocatedAddress> {
  const empty: LocatedAddress = { lat: null, lng: null, city: '', address: '' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const r = await geocodeAddressWithCity(query);
  if (!r) return empty;
  return { lat: r.latitude, lng: r.longitude, city: r.city, address: r.displayName };
}

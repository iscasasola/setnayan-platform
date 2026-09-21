'use client';

/**
 * AddressPinField — the address, and the point on the map it means.
 * (owner 2026-09-20: the Add-manually sheet carries an **"Address Pin"**.)
 *
 * He wrote *pin*, not *address*. Text is what a human reads on a printed
 * brief; the pin is what opens a map app on a guest's phone. Neither replaces
 * the other, so this field carries both and keeps them together.
 *
 * ── ALL THREE PARTS ALREADY SHIPPED ───────────────────────────────────────
 * Nothing here is a new capability:
 *   · `BranchPinMap` — the dependency-free Grab/Uber crosshair a vendor
 *     already uses to place a branch. OSM raster tiles as <img>, no Leaflet,
 *     already allowed by the CSP.
 *   · `locateAddressPin` → `geocodeAddressWithCity` — the Nominatim proxy,
 *     which owns the PH filter and the courtesy rate limit.
 *   · `lib/manual-venue-address` — the rule for whether an address is owed.
 * This component is the wiring.
 *
 * ── THE PIN IS OPTIONAL EVEN WHERE THE ADDRESS IS NOT ─────────────────────
 * A couple who knows the street but cannot find the building on a map must
 * still be able to save: a wrong pin routes guests somewhere real and
 * incorrect, which is worse than none. So the address is what the app
 * demands, and the map is an offer. The geocoder is likewise best-effort —
 * `lib/geo.ts` says its own PH coverage "degrades at barangay level", so a
 * miss leaves the text alone and invites a drag instead of erroring.
 */

import { useState, useTransition } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { BranchPinMap, type LatLng } from '@/app/vendor-dashboard/_components/branch-pin-map';
import {
  MANUAL_VENUE_ADDRESS_HINT,
  MANUAL_VENUE_ADDRESS_MAX,
  MANUAL_VENUE_ADDRESS_PLACEHOLDER,
} from '@/lib/manual-venue-address';
import { locateAddressPin } from '../vendors/actions';

/** Metro Manila, so an unplaced map opens somewhere recognisable. */
const PH_FALLBACK: LatLng = { lat: 14.5995, lng: 120.9842 };

export function AddressPinField({
  id = 'manual-vendor-address',
  required,
  disabled,
  initialAddress,
  initialPin,
}: {
  id?: string;
  required?: boolean;
  disabled?: boolean;
  initialAddress?: string;
  initialPin?: LatLng | null;
}) {
  const [address, setAddress] = useState(initialAddress ?? '');
  const [pin, setPin] = useState<LatLng | null>(initialPin ?? null);
  const [locating, startLocating] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function locate() {
    if (address.trim().length < 3) {
      setNote('Type the address first.');
      return;
    }
    setNote(null);
    startLocating(async () => {
      const r = await locateAddressPin(address);
      if (r) {
        setPin({ lat: r.lat, lng: r.lng });
        setNote(null);
      } else {
        // Not an error. A miss is expected at barangay level, and the map is
        // open below for the couple to place it by hand.
        setNote('Could not find that automatically — drag the pin instead.');
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium uppercase tracking-[0.08em] text-ink/65"
      >
        {required ? 'Exact address' : 'Address'}
        {required ? <span className="ml-0.5 text-terracotta-700">*</span> : null}
      </label>

      <div className="flex items-start gap-1.5">
        <input
          id={id}
          name="address"
          type="text"
          required={required}
          maxLength={MANUAL_VENUE_ADDRESS_MAX}
          disabled={disabled}
          value={address}
          autoComplete="street-address"
          placeholder={MANUAL_VENUE_ADDRESS_PLACEHOLDER}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={locate}
          disabled={disabled || locating}
          aria-label="Find this address on the map"
          className="inline-flex h-[38px] shrink-0 items-center gap-1 rounded-md border border-ink/15 bg-cream px-2.5 text-xs font-medium text-ink/75 transition-colors hover:border-terracotta/40 hover:text-ink disabled:opacity-60"
        >
          {locating ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Search aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Find
        </button>
      </div>

      <p className="text-[10px] text-ink/45">
        {required ? MANUAL_VENUE_ADDRESS_HINT : 'Optional — handy for a commissary or studio.'}
      </p>

      <div className="sn-addman-field overflow-hidden rounded-md border border-ink/15">
        <BranchPinMap
          value={pin}
          onChange={(v) => {
            setPin(v);
            setNote(null);
          }}
          initialCenter={pin ?? PH_FALLBACK}
        />
      </div>

      {/* Both or neither — the DB enforces the pair with a CHECK, and sending
          half of one would be refused rather than stored as half a location. */}
      {pin ? (
        <>
          <input type="hidden" name="address_latitude" value={pin.lat} />
          <input type="hidden" name="address_longitude" value={pin.lng} />
        </>
      ) : null}

      <p className="flex items-center gap-1 text-[10px] text-ink/45">
        <MapPin aria-hidden className="h-3 w-3" strokeWidth={1.9} />
        {pin
          ? `Pinned at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} — drag the map to adjust.`
          : 'Drag the map so the crosshair sits on the entrance. Optional.'}
      </p>

      {note ? <p className="text-[11px] text-warn-800">{note}</p> : null}
    </div>
  );
}

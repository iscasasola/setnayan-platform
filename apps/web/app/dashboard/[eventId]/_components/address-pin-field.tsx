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
import { ActionButton } from '@/components/action-button';
import { FormRows, TypedRow } from '@/app/_components/form-row';
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
  hideHints = false,
  onChange,
}: {
  id?: string;
  required?: boolean;
  disabled?: boolean;
  initialAddress?: string;
  initialPin?: LatLng | null;
  /**
   * 🧭 THE MAKER DRAWS NO CAPTIONS UNDER ITS CONTROLS (the approved B4 design,
   * `maker_venues_pin_and_time_2026-10-04_fable.html`): the field's two small
   * hint lines — the one under the address and the unpinned "Drag the map…"
   * line — are not drawn, and the label is kept for screen readers only. The
   * "Pinned at …" line stays: it IS the pin. Default (every other caller): shown.
   */
  hideHints?: boolean;
  /** The address and the pin, every time either changes — for a caller with no form (the Maker's draft). */
  onChange?: (next: { address: string; pin: LatLng | null }) => void;
}) {
  const [address, setAddressState] = useState(initialAddress ?? '');
  const [pin, setPinState] = useState<LatLng | null>(initialPin ?? null);
  const setAddress = (next: string) => {
    setAddressState(next);
    onChange?.({ address: next, pin });
  };
  const setPin = (next: LatLng | null) => {
    setPinState(next);
    onChange?.({ address, pin: next });
  };
  const [locating, startLocating] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function locate() {
    if (address.trim().length < 3) {
      setNote('Type the address first.');
      return;
    }
    setNote(null);
    startLocating(async () => {
      /* 📵 A lookup that never answered (no signal, a 5xx) is a miss like any other — the map is open below. Thrown
         into this transition it replaced the whole page (in the Maker, the whole Maker) with the app's error screen. */
      const r = await locateAddressPin(address).catch(() => null);
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
      {/* The address is a Form row (INTERACTION_RULES § 9 — "a field IS a Form
          row") that posts under `address`; Find is the one ActionButton. The map
          itself has no template yet (§ 9: "the map pin field" has no drawing) —
          it stays the shipped BranchPinMap. */}
      <div className="flex items-center gap-1.5" data-address-row={id}>
        <div className="min-w-0 flex-1">
          <FormRows width="wide" data={`address-${id}`}>
            <TypedRow
              name={required ? 'Exact address' : 'Address'}
              fieldName="address"
              value={address}
              required={required}
              maxLength={MANUAL_VENUE_ADDRESS_MAX}
              placeholder={MANUAL_VENUE_ADDRESS_PLACEHOLDER}
              attrs={{ 'data-address-field': id }}
              onType={(t) => setAddress(t)}
              onKeep={(t) => {
                setAddress(t);
              }}
            />
          </FormRows>
        </div>
        <ActionButton
          tone="neutral"
          icon={locating ? Loader2 : Search}
          label="Find"
          name="Find this address on the map"
          onClick={locate}
          disabled={disabled || locating}
        />
      </div>

      {hideHints ? null : (
        <p className="text-[10px] text-ink/45">
          {required ? MANUAL_VENUE_ADDRESS_HINT : 'Optional — handy for a commissary or studio.'}
        </p>
      )}

      {/* The map is pressable (drag it) — its frame is the control's own. */}
      <div className="overflow-hidden rounded-md border border-ink/15">
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

      {pin || !hideHints ? (
        <p className="flex items-center gap-1 text-[10px] text-ink/45" data-pin-line="">
          <MapPin aria-hidden className="h-3 w-3" strokeWidth={1.9} />
          {pin
            ? `Pinned at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} — drag the map to adjust.`
            : 'Drag the map so the crosshair sits on the entrance. Optional.'}
        </p>
      ) : null}

      {note ? <p className="text-[11px] text-warn-800">{note}</p> : null}
    </div>
  );
}

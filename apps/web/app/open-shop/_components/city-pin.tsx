'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { Check, Crosshair, Loader2, MapPin } from 'lucide-react';

import { detectShopCity, locateShopAddress } from '../city-actions';

type LeafletModule = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;
type LeafletMarker = import('leaflet').Marker;

/** L.divIcon sidesteps Leaflet's default marker-icon URL breaking under bundlers —
 *  the same reason My Shop's pin picker uses one. */
function pinIcon(L: LeafletModule) {
  return L.divIcon({
    className: '',
    html:
      '<div style="width:16px;height:16px;border-radius:50%;background:#C24E25;' +
      'border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25),0 1px 4px rgba(0,0,0,.35)"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Metro Manila. Only the opening view — never submitted as the vendor's pin. */
const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842];

/**
 * "Where are you?" — TYPE the address, the pin follows, the city fills itself in.
 *
 * Owner 2026-08-10, in two passes. First: *"city should be the exact map
 * location. which will provide their city."* — free text alone is how a
 * marketplace ends up with "QC", "Quezon city" and "Q.C." as three places. Then:
 * *"for the address. we want them to just type their address so it will show on
 * the pin."*
 *
 * 🔑 THE SECOND INSTRUCTION FLIPPED THE ENTRY POINT, AND IT IS THE RIGHT WAY
 * ROUND. Finding your own shop by panning a map at 375px is fiddly; a vendor
 * knows their address by heart. So the ADDRESS BOX IS THE PRIMARY CONTROL — type
 * it, the map catches up, and the city comes out of the same lookup. The pin
 * stays draggable because a geocoder lands on the street, not the unit.
 *
 * RULE 0 — the grammar here is lifted from the shipped `HqAddressControl`
 * (`vendor-dashboard/shop/_components/editable-row.tsx`): the same Leaflet
 * dynamic import so it never runs during SSR, the same `divIcon` (Leaflet's
 * default marker URL breaks under bundlers), the same drag-and-click-to-move
 * marker. What is NOT reused is the component: it reads `data.hq_latitude` off
 * an existing profile row and calls the My Shop save action — and a vendor here
 * has no row yet. Copying the mechanics is the reuse; importing it would have
 * meant inventing a profile to feed it.
 *
 * ── THE CITY IS AUTHORITATIVE, THE PIN IS A CONVENIENCE ─────────────────────
 * `location_city` is what the marketplace actually filters on; the coordinates
 * are extra precision. So the text input keeps `name="location_city"` and stays
 * editable, and the pin only ever WRITES INTO it. A vendor can:
 *   • drop a pin and accept what comes back,
 *   • drop a pin and correct the wording,
 *   • or ignore the map entirely and type their city.
 * All three submit the same field. The map cannot lock anyone out of naming the
 * city they serve — Nominatim's rural Philippine coverage returns a province or
 * a barangay often enough that making the pin mandatory would refuse real
 * businesses.
 */
export function CityPin({
  defaultCity,
  defaultAddress = '',
}: {
  defaultCity: string;
  defaultAddress?: string;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const [address, setAddress] = useState(defaultAddress);
  const [city, setCity] = useState(defaultCity);
  const [locating, setLocating] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  /**
   * What the lookup PROPOSED, and whether the vendor has agreed to it.
   *
   * Owner 2026-08-10: *"once i place the map, maybe we can ask if they are
   * located in x city and to accept."* — after they pressed Enter, the form
   * submitted and the shop was created before they could see whether the
   * address was even right.
   *
   * So a machine guess is now a PROPOSAL, not a decision. `proposed` holds what
   * the geocoder found; `confirmed` is the vendor saying yes. Any new lookup or
   * pin drag clears the confirmation, because it is a different place.
   */
  const [proposed, setProposed] = useState<{ city: string; address: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [missed, setMissed] = useState(false);

  const setCityValue = (next: string) => setCity(next);

  /** Move the map to a resolved point without re-asking the geocoder. */
  const showOnMap = (lat: number, lng: number) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    map.setView([lat, lng], 16);
    if (!markerRef.current) {
      const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon(L) });
      marker.on('dragend', () => {
        const q = marker.getLatLng();
        void resolve(q.lat, q.lng);
      });
      marker.addTo(map);
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    setPin({ lat, lng });
  };

  /** Move the marker and, when the vendor placed it, resolve the city. */
  const placePin = (lat: number, lng: number) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!markerRef.current) {
      const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon(L) });
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        void resolve(p.lat, p.lng);
      });
      marker.addTo(map);
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    void resolve(lat, lng);
  };

  const resolve = async (lat: number, lng: number) => {
    setPin({ lat, lng });
    setDetecting(true);
    setMissed(false);
    try {
      const r = await detectShopCity(lat, lng);
      // An empty city is a MISS, not an answer. Blanking a city the vendor
      // already typed because a rural pin resolved to nothing would take away
      // work they did — so on a miss the existing value stands and we say so.
      if (r.city) setCityValue(r.city);
      else setMissed(true);
      // Dragging the pin is choosing a different place; the previous
      // confirmation was about the previous spot.
      setConfirmed(false);
      setProposed(r.city || r.address ? { city: r.city, address: r.address } : null);
    } catch {
      setMissed(true);
    } finally {
      setDetecting(false);
    }
  };

  // ── TYPE → PIN ─────────────────────────────────────────────────────────────
  // Debounced, because every keystroke would be a request to a free service with
  // a 1 req/sec policy. Guarded by `live` so a slower answer for an earlier
  // address cannot overwrite a newer one — otherwise typing "Banawe" then
  // "Banawe Street QC" can settle on the pin for "Banawe".
  useEffect(() => {
    const q = address.trim();
    if (q.length < 3) {
      setNoMatch(false);
      return;
    }
    let live = true;
    setLocating(true);
    setNoMatch(false);
    const t = setTimeout(() => {
      locateShopAddress(q)
        .then((r) => {
          if (!live) return;
          if (r.lat != null && r.lng != null) {
            showOnMap(r.lat, r.lng);
            // An empty city is a MISS, not an answer — blanking one the vendor
            // already typed because a rural address resolved without a
            // municipality would take away their work.
            if (r.city) setCityValue(r.city);
            // A new place means the old agreement no longer applies.
            setConfirmed(false);
            setProposed({ city: r.city, address: r.address });
          } else {
            setNoMatch(true);
          }
        })
        .catch(() => {
          if (live) setNoMatch(true);
        })
        .finally(() => {
          if (live) setLocating(false);
        });
    }, 700);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // `showOnMap` and `setCityValue` are stable for this component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const mod = await import('leaflet');
      const L: LeafletModule = (mod as unknown as { default?: LeafletModule }).default ?? mod;
      if (cancelled || !mapDivRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapDivRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
        // A form is a scrolling surface. Scroll-zoom would hijack the page the
        // moment a thumb passes over the map — the single most common complaint
        // about an embedded map inside a form.
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        placePin(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = map;

      // ── 🔴 A MAP BORN INSIDE A HIDDEN PANEL HAS NO SIZE ────────────────────
      // All four steps are always mounted; step 4 is `display:none` until the
      // vendor reaches it. Leaflet measures its container ONCE at creation, so a
      // map created at 0×0 keeps believing it is 0×0 — tiles never paint, the
      // pin never appears, and moving the view does nothing visible. To the
      // vendor that is "the map does not update as I type", with no error to
      // explain it.
      //
      // The shipped My Shop picker already solves this with a ResizeObserver
      // (`vendor-dashboard/shop/_components/editable-row.tsx`); this copies that
      // fix rather than inventing one. It fires when the panel stops being
      // hidden, which is the exact moment the size becomes real.
      if (typeof ResizeObserver !== 'undefined' && mapDivRef.current) {
        ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
        ro.observe(mapDivRef.current);
      }
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Mount-only: Leaflet owns the DOM node from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setView([latitude, longitude], 15);
        placePin(latitude, longitude);
      },
      // Denied or unavailable: silently fall back to tapping the map. A refused
      // permission is a choice, not an error to report back at the vendor.
      () => setDetecting(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="space-y-2">
      {/* THE ADDRESS IS THE PRIMARY CONTROL (owner 2026-08-10). It leads because
          a vendor knows their address by heart and panning a map at 375px to
          find their own shop is fiddly. The map below is confirmation, not the
          way in. */}
      <input
        name="hq_address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        maxLength={200}
        placeholder="Type your address"
        className="input-field"
        aria-label="Your address"
        autoComplete="street-address"
      />

      {locating ? (
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }} aria-live="polite">
          <Loader2 aria-hidden className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2} />
          Finding it on the map…
        </span>
      ) : noMatch ? (
        <span className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--m-slate)' }} aria-live="polite">
          <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {/* Not an error. Plenty of real Philippine addresses do not resolve —
              the vendor can drop the pin themselves and type the city. */}
          Couldn&rsquo;t find that — drop your pin on the map instead.
        </span>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border" style={{ borderColor: 'var(--m-line)' }}>
        <div ref={mapDivRef} className="h-[180px] w-full" />
        <button
          type="button"
          onClick={useMyLocation}
          className="absolute right-2 top-2 z-[400] inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-sm"
          style={{ background: 'var(--m-paper)', color: 'var(--m-ink)' }}
        >
          <Crosshair className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Use my location
        </button>
        {!pin ? (
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[400] flex items-center justify-center gap-1.5 py-2 text-xs font-medium"
            style={{ background: 'color-mix(in srgb, var(--m-paper) 92%, transparent)', color: 'var(--m-slate)' }}
          >
            <MapPin className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Type your address above, or tap to place the pin
          </span>
        ) : null}
      </div>

      {/* The city is what the marketplace actually filters on, so it stays a
          real, editable field — filled by the lookup, never locked by it. */}
      <input
        name="location_city"
        value={city}
        onChange={(e) => setCityValue(e.target.value)}
        maxLength={64}
        placeholder="City"
        className="input-field"
        aria-label="City"
      />

      {/* ── CONFIRM THE PLACE (owner 2026-08-10) ───────────────────────────────
          A geocoder's answer is a guess, and this one is about where the
          vendor's business physically is. Shown as a question with the matched
          address in full, because "Quezon City" alone cannot tell you whether it
          found YOUR street. The step cannot be passed until this is answered —
          `location_confirmed` is what `validateStep(4)` reads. */}
      {proposed && !confirmed ? (
        <div
          className="space-y-2 rounded-xl border p-3"
          style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)' }}
        >
          <p className="text-xs" style={{ color: 'var(--m-ink)' }}>
            {proposed.city ? (
              <>
                Are you in <strong>{proposed.city}</strong>?
              </>
            ) : (
              <>Is this the right spot?</>
            )}
          </p>
          {proposed.address ? (
            <p className="text-xs leading-snug" style={{ color: 'var(--m-slate)' }}>
              {proposed.address}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setConfirmed(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'var(--m-orange-deep)', color: 'white' }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            Yes, that&rsquo;s right
          </button>
          <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
            Not quite? Edit the address above or drag the pin.
          </p>
        </div>
      ) : null}

      {confirmed ? (
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--m-sage-deep)' }}>
          <Check aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          Location confirmed
        </span>
      ) : null}

      {/* Read by the step gate. Present ONLY once the vendor has agreed — a
          geocode that nobody looked at must not be able to pass the step, which
          is exactly how a shop got created at an unverified address. */}
      {confirmed ? <input type="hidden" name="location_confirmed" value="yes" /> : null}

      {pin ? (
        <>
          <input type="hidden" name="hq_latitude" value={pin.lat} />
          <input type="hidden" name="hq_longitude" value={pin.lng} />
        </>
      ) : null}

      {detecting ? (
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }} aria-live="polite">
          <Loader2 aria-hidden className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2} />
          Naming that spot…
        </span>
      ) : missed ? (
        <span className="text-xs" style={{ color: 'var(--m-slate)' }} aria-live="polite">
          Couldn&rsquo;t name that spot — type your city above.
        </span>
      ) : null}
    </div>
  );
}

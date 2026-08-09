'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, MapPin } from 'lucide-react';

import { detectShopCity } from '../city-actions';

type LeafletModule = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;
type LeafletMarker = import('leaflet').Marker;

/** Metro Manila. Only the opening view — never submitted as the vendor's pin. */
const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842];

/**
 * "Where are you?" — drop a pin, the city fills itself in.
 *
 * Owner 2026-08-10: *"city should be the exact map location. which will provide
 * their city."* The field was free text, which is how a marketplace ends up with
 * "QC", "Quezon city" and "Q.C." as three different places.
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
  onCityChange,
}: {
  defaultCity: string;
  onCityChange?: (city: string) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const [city, setCity] = useState(defaultCity);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [missed, setMissed] = useState(false);

  const setCityValue = (next: string) => {
    setCity(next);
    onCityChange?.(next);
  };

  /** Move the marker and, when the vendor placed it, resolve the city. */
  const placePin = (lat: number, lng: number) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!markerRef.current) {
      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: L.divIcon({
          className: '',
          html:
            '<div style="width:16px;height:16px;border-radius:50%;background:#C24E25;' +
            'border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25),0 1px 4px rgba(0,0,0,.35)"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      });
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
    } catch {
      setMissed(true);
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
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
    })();
    return () => {
      cancelled = true;
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
            Tap the map to drop your pin
          </span>
        ) : null}
      </div>

      {/* The authoritative field. Always present, always editable — the pin
          writes into it, never over the vendor's ability to correct it. */}
      <input
        name="location_city"
        value={city}
        onChange={(e) => setCityValue(e.target.value)}
        maxLength={64}
        placeholder="Quezon City"
        className="input-field"
        aria-label="City"
      />
      {pin ? (
        <>
          <input type="hidden" name="hq_latitude" value={pin.lat} />
          <input type="hidden" name="hq_longitude" value={pin.lng} />
        </>
      ) : null}

      {detecting ? (
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }} aria-live="polite">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2} aria-hidden />
          Finding your city…
        </span>
      ) : missed ? (
        <span className="text-xs" style={{ color: 'var(--m-slate)' }} aria-live="polite">
          Couldn&rsquo;t name that spot — type your city above.
        </span>
      ) : null}
    </div>
  );
}

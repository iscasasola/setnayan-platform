/**
 * 🧭 GET DIRECTIONS — WHICH MAP APPS A DEVICE IS OFFERED, AND IN WHAT ORDER (map card + one "Get directions" sheet,
 * owner-approved 2026-11-14 on `prototypes/map_card_open_in_maps_2026-11-14_fable.html`).
 *
 * A web page cannot see which apps are on a phone, so the sheet never pretends to. Per device:
 *   · Android        — "Open in your map app" (a `geo:` link: the phone shows its OWN list of the map apps it really
 *                      has), then Google Maps and Waze by name.
 *   · iPhone / iPad  — Apple Maps (on every iPhone), then Google Maps and Waze (universal links: the app if installed,
 *                      its website if not — nobody lands on an error).
 *   · Computer       — Google Maps in a new tab; Apple Maps on a Mac only.
 *   · No pin         — one Google Maps search for the address, whatever the device.
 *
 * Pure and client-safe: no URL is BUILT here — the links arrive ready from `DirectionsMenu` (nav-links.tsx), the one
 * place the map-app links are built (`every-hub-press-is-44px.test.ts`). This file only picks and orders them.
 * The device is read at the moment the sheet opens (`mapDeviceFrom(navigator…)`), never during render, so the
 * server's HTML and the first client render are the same button.
 */

export type MapDevice = 'android' | 'iphone' | 'mac' | 'computer';

/**
 * The device, from the user agent and the touch points. iPadOS 13+ says "Macintosh" — a "Mac" with more than one touch
 * point is an iPad. This is the SEAM a screenshot or a test fakes (pass any UA).
 */
export function mapDeviceFrom(userAgent: string, maxTouchPoints = 0): MapDevice {
  const ua = userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iphone';
  if (/Macintosh|Mac OS X/i.test(ua)) return maxTouchPoints > 1 ? 'iphone' : 'mac';
  return 'computer';
}

/** The ready-made links for one place. A pinned place has the app links; an address-only place has `search`. */
export type DirectionLinks =
  | { pinned: true; geo: string; google: string; waze: string; apple: string; mapLink: string }
  | { pinned: false; search: string; mapLink: string };

export type DirectionApp = {
  key: 'geo' | 'google' | 'waze' | 'apple' | 'search';
  name: string;
  /** The small line under the name. */
  sub: string;
  href: string;
  /** What the row says while the app opens. */
  loading: string;
  /** `_blank` for a web link; a `geo:` link opens in place (the phone's chooser). */
  newTab: boolean;
  /** The first row on a phone carries "Best on this phone". */
  best: boolean;
};

const APP_SUB = 'Opens the app if you have it, or its website';

/** The "Open in" rows for this device, in order. */
export function directionApps(device: MapDevice, links: DirectionLinks): DirectionApp[] {
  if (!links.pinned) {
    return [
      { key: 'search', name: 'Google Maps', sub: 'Searches for this address', href: links.search, loading: 'Opening Google Maps…', newTab: true, best: false },
    ];
  }
  const google = (sub: string, best = false): DirectionApp => ({
    key: 'google', name: 'Google Maps', sub, href: links.google, loading: 'Opening Google Maps…', newTab: true, best,
  });
  const waze: DirectionApp = { key: 'waze', name: 'Waze', sub: APP_SUB, href: links.waze, loading: 'Opening Waze…', newTab: true, best: false };
  const apple = (sub: string, best = false): DirectionApp => ({
    key: 'apple', name: 'Apple Maps', sub, href: links.apple, loading: 'Opening Apple Maps…', newTab: true, best,
  });
  switch (device) {
    case 'android':
      return [
        {
          key: 'geo',
          name: 'Open in your map app',
          sub: 'Your phone shows the map apps you have',
          href: links.geo,
          loading: 'Opening your phone’s map apps…',
          newTab: false,
          best: true,
        },
        google(APP_SUB),
        waze,
      ];
    case 'iphone':
      return [apple('Already on your iPhone', true), google(APP_SUB), waze];
    case 'mac':
      return [google('Opens in a new tab'), apple('Opens the Maps app on this Mac')];
    default:
      return [google('Opens in a new tab')];
  }
}

/** "About 7 km apart" — straight-line distance between two pins, said plainly (never a drive time). */
export function apartLine(km: number): string | null {
  if (!Number.isFinite(km) || km < 0.05) return null;
  if (km < 1) return `About ${Math.round(km * 10) * 100} m apart`;
  return `About ${Math.round(km)} km apart`;
}

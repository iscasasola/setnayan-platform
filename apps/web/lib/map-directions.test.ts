/**
 * 🧭 GET DIRECTIONS OFFERS EACH DEVICE THE MAP APPS IT MOST LIKELY HAS (map card + Get directions, owner-approved
 * 2026-11-14, `prototypes/map_card_open_in_maps_2026-11-14_fable.html`):
 *   Android → "Open in your map app" (geo:) · Google Maps · Waze
 *   iPhone / iPad → Apple Maps · Google Maps · Waze
 *   Computer → Google Maps (· Apple Maps on a Mac only)
 *   No pin → one Google Maps search, any device.
 * The device seam (`mapDeviceFrom`) is what a screenshot fakes; iPadOS says "Macintosh" with touch points.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { apartLine, directionApps, mapDeviceFrom, type DirectionLinks } from './map-directions';
import { geoUri } from './geo';

const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ipadOs: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
};

const PINNED: DirectionLinks = {
  pinned: true,
  geo: 'geo:14.5,121?q=14.5%2C121(Church)',
  google: 'https://www.google.com/maps/dir/?api=1&destination=14.5%2C121',
  waze: 'https://waze.com/ul?ll=14.5%2C121&navigate=yes',
  apple: 'https://maps.apple.com/?ll=14.5%2C121',
  mapLink: 'https://www.google.com/maps/search/?api=1&query=14.5%2C121',
};

test('the device, from the user agent — iPadOS’s "Macintosh" with touch is an iPad', () => {
  assert.equal(mapDeviceFrom(UA.android, 5), 'android');
  assert.equal(mapDeviceFrom(UA.iphone, 5), 'iphone');
  assert.equal(mapDeviceFrom(UA.ipadOs, 5), 'iphone', 'an iPad that says Macintosh');
  assert.equal(mapDeviceFrom(UA.ipadOs, 0), 'mac');
  assert.equal(mapDeviceFrom(UA.windows, 0), 'computer');
  assert.equal(mapDeviceFrom('', 0), 'computer');
});

test('each device gets its own list, in the approved order', () => {
  const names = (d: Parameters<typeof directionApps>[0]) => directionApps(d, PINNED).map((a) => a.name);
  assert.deepEqual(names('android'), ['Open in your map app', 'Google Maps', 'Waze']);
  assert.deepEqual(names('iphone'), ['Apple Maps', 'Google Maps', 'Waze']);
  assert.deepEqual(names('mac'), ['Google Maps', 'Apple Maps']);
  assert.deepEqual(names('computer'), ['Google Maps'], 'Apple Maps on a Mac only');
});

test('the phone’s own chooser opens in place; the web links open a new tab; only phones say "Best on this phone"', () => {
  const android = directionApps('android', PINNED);
  assert.equal(android[0]!.href, PINNED.geo);
  assert.equal(android[0]!.newTab, false);
  assert.ok(android.slice(1).every((a) => a.newTab));
  assert.equal(directionApps('iphone', PINNED)[0]!.best, true);
  assert.ok(directionApps('computer', PINNED).every((a) => !a.best));
  assert.equal(directionApps('android', PINNED).find((a) => a.key === 'waze')!.loading, 'Opening Waze…');
});

test('no pin: one Google Maps search for the address, on every device', () => {
  const addressOnly: DirectionLinks = { pinned: false, search: 'https://www.google.com/maps/search/?api=1&query=Tagaytay', mapLink: 'x' };
  for (const d of ['android', 'iphone', 'mac', 'computer'] as const) {
    const apps = directionApps(d, addressOnly);
    assert.deepEqual(apps.map((a) => [a.name, a.href]), [['Google Maps', addressOnly.search]]);
    assert.equal(apps[0]!.sub, 'Searches for this address');
  }
});

test('geo: — the pin, and the place’s name for the chooser (no parentheses smuggled in)', () => {
  assert.equal(geoUri(14.5, 121, 'Manila Cathedral'), 'geo:14.5,121?q=14.5%2C121(Manila%20Cathedral)');
  assert.equal(geoUri(14.5, 121, null), 'geo:14.5,121?q=14.5%2C121');
  assert.equal(geoUri(14.5, 121, 'A (B)'), 'geo:14.5,121?q=14.5%2C121(A%20B)');
});

test('"About N km apart" — a straight line, rounded; nothing for one spot', () => {
  assert.equal(apartLine(6.8), 'About 7 km apart');
  assert.equal(apartLine(0.62), 'About 600 m apart');
  assert.equal(apartLine(0.01), null);
  assert.equal(apartLine(Number.NaN), null);
});

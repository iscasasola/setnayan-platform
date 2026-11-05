/**
 * 🗺 THE VENUE MAP WAITS UNTIL IT IS NEAR — the Invitation's landing asks no third party for anything (Batch 9 walk W2,
 * 2026-10-16).
 *
 * With the Invitation on one page the venue map sits ~1,500 px below the cover. `loading="lazy"` lets Chromium fetch
 * within its OWN native distance (1,250–2,500 px), so every guest's landing fetched 4 OpenStreetMap tiles — 21 requests
 * against main's 17 (`controller-2026-10-12/test-b9/WALK.md` W2, `requests-batch-invitation.txt`).
 *
 * The landing's request count is held here as what the server-drawn page asks a browser to fetch before anything
 * hydrates: on the fixture invitation (Maria & Jose, two located venues → the pinned map) that is ZERO third-party
 * URLs — the map's box is drawn, its tiles are not. After hydration the tiles come only through `NearViewport` (one
 * IntersectionObserver, 300 px margin), which is held from source below. The same holds for a one-venue event's
 * embed. (The browser count itself — 17 on landing, as main — was walked; see the PR body.)
 *
 * Sabotage (2026-10-16): the tiles drawn outside `NearViewport` → 2 red; the embed without `deferUntilNear` → 2 red.
 */
/* FIRST, before anything that draws the guest page: this import installs the fixture's seam. */
import { renderSiteBodyFixture } from '@/lib/site-body-fixture-render';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_EVENT } from '@/lib/site-body-fixture';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const src = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

/** Every URL on another host the server-drawn markup makes a browser fetch as it parses. */
function thirdPartyFetches(html: string): string[] {
  return [...html.matchAll(/<(img|iframe|video|audio|source|script|link|embed|object)\b[^>]*?\s(?:src|href|srcset|data)="(https?:\/\/[^"]+)"/g)]
    .filter((m) => !(m[1] === 'link' && !/rel="(?:stylesheet|preload|modulepreload|icon)"/.test(m[0])))
    .map((m) => `${m[1]} ${m[2]}`);
}

test('the Invitation’s landing asks no third party for anything — the map is drawn, its tiles wait', async () => {
  const html = await renderSiteBodyFixture({});
  assert.match(html, /data-venue-map-pins="2"/, 'anti-vacuity: the fixture’s two-venue map is not on the landing');
  assert.deepEqual(thirdPartyFetches(html), [], 'the landing makes the browser fetch from another host');
  assert.doesNotMatch(html, /tile\.openstreetmap\.org/, 'a map tile is fetched on landing');
  assert.match(html, /data-venue-map-pins="2"[^>]*>(?:(?!<\/figure>)[\s\S])*data-near-viewport="far"/, 'the tiles do not wait inside the map’s box');
});

test('a one-venue event’s map embed waits too', async () => {
  const one = { ...FIXTURE_EVENT, venues: FIXTURE_EVENT.venues?.slice(0, 1) } as typeof FIXTURE_EVENT;
  const html = await renderSiteBodyFixture({ event: one });
  if (one.venues?.[0]?.latitude == null) assert.fail('anti-vacuity: the fixture’s first venue has no pin');
  assert.match(html, /data-osm-embed=""/, 'anti-vacuity: the one venue’s own map is not drawn');
  assert.doesNotMatch(html, /openstreetmap\.org\/export\/embed/, 'the embed loads on landing');
  assert.deepEqual(thirdPartyFetches(html), []);
});

test('NearViewport: one observer, a 300 px margin, the tiles and the guest’s embed go through it', () => {
  const NEAR = src('app', '_components', 'near-viewport.tsx');
  assert.match(NEAR, /export const NEAR_VIEWPORT_MARGIN = '300px';/);
  assert.match(NEAR, /rootMargin: `\$\{NEAR_VIEWPORT_MARGIN\} 0px`/);
  assert.match(NEAR, /\{near \? children : null\}/, 'the children are drawn before they are near');
  const STYLES = src('app', '[slug]', '_components', 'venue-styles.tsx');
  assert.match(STYLES, /<NearViewport className="absolute inset-0">\s*\{frame\.tiles\.map\(/, 'the tiles are not inside NearViewport');
  const WIDGET = src('app', '[slug]', '_components', 'venue-widget.tsx');
  assert.match(WIDGET, /<VendorLocationMap[^>]*\bdeferUntilNear\b/, 'the guest’s embed does not wait');
  const MAP = src('app', '_components', 'vendor-location-map.tsx');
  assert.match(MAP, /deferUntilNear \? \(\s*<NearViewport className="h-\[220px\] w-full">\{iframe\}<\/NearViewport>/);
});

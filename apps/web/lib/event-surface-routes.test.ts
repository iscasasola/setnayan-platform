/**
 * A HIDDEN LINK IS NOT A CLOSED URL — route-level event-type backstops.
 *
 * The couple's nav, the Studio/Suite grid and the free-tools strip all filter on
 * the event-type profile. None of that closes a URL. A bookmark, a stale link,
 * a search result or a typed address reaches the page directly, and on
 * 2026-07-31 these opened in full on event types that do not have the surface:
 *
 *   • /budget    — offered to track vendor payments on `simple_event`, the
 *                  vendor-free type, whose profile does not enable `budget`.
 *   • /vendors   — rendered the whole vendor bench on the same type, INCLUDING a
 *                  Setnayan AI upsell, on the one type where the assistant is
 *                  not offered at all (owner lock 2026-07-27).
 *   • /studio/save-the-date (+ /stamp) — a WEDDING surface, open on all 15
 *                  non-wedding types.
 *
 * `monogram` already had this guard and is the template every fix copied.
 *
 * ── WHY A MAP AND NOT A SCAN ─────────────────────────────────────────────────
 * Only THREE of the nine surfaces are ever disabled by a live profile row
 * (`monogram`, `save_the_date`, `budget` — verified against prod
 * `event_type_profiles`). The other six are enabled for all 16 types, so gating
 * them would be dead code that reads like diligence. This map lists exactly the
 * routes where a gate does real work; add a row when a new route serves a
 * surface, or when a profile row starts disabling one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** route → the profile check it must perform before rendering. */
const GUARDED_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['app/dashboard/[eventId]/monogram/page.tsx', "surfaceEnabled(profile, 'monogram')"],
  ['app/dashboard/[eventId]/budget/page.tsx', "surfaceEnabled(profile, 'budget')"],
  [
    'app/dashboard/[eventId]/studio/save-the-date/page.tsx',
    "surfaceEnabled(profile, 'save_the_date')",
  ],
  [
    'app/dashboard/[eventId]/studio/save-the-date/stamp/page.tsx',
    "surfaceEnabled(profile, 'save_the_date')",
  ],
];

for (const [route, check] of GUARDED_ROUTES) {
  test(`${route} guards the direct URL`, () => {
    const src = read(route);
    assert.match(
      src,
      /resolveProfileByEvent\(eventId\)/,
      `${route} must resolve the event-type profile before rendering.`,
    );
    assert.ok(
      src.includes(check),
      `${route} must check \`${check}\` and redirect. The nav/grid filter hides ` +
        `the LINK; only this closes the URL.`,
    );
  });
}

test('the vendor bench is gated on the marketplace column', () => {
  const route = 'app/dashboard/[eventId]/vendors/page.tsx';
  const src = read(route);
  assert.match(src, /resolveProfileByEvent\(eventId\)/, `${route} must resolve the profile`);
  assert.match(
    src,
    /profile\.marketplaceEnabled !== true/,
    `${route} must gate on the marketplace COLUMN, not on a type name — the ` +
      `column is what encodes vendor-free, so a future vendor-free type is ` +
      `covered without editing this file.`,
  );
});

test('every guarded route redirects rather than rendering', () => {
  // The house pattern (set by monogram) is redirect-to-event-home, not
  // notFound(): the couple asked for something their event type does not have,
  // and their own dashboard is the honest place to land.
  for (const [route] of GUARDED_ROUTES) {
    assert.match(
      read(route),
      /redirect\(`\/dashboard\/\$\{eventId\}`\)/,
      `${route} must redirect to the event home`,
    );
  }
});

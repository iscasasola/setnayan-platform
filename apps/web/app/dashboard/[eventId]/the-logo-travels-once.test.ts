/**
 * the-logo-travels-once.test.ts — ⚡ ONE COPY OF THE COUPLE'S LOGO PER EVENT PAGE.
 *
 * Measured 2026-10-16 (production build, cale-ice replayed): every event page's RSC payload
 * carried the couple's 12,991-character logo SVG TWICE — once in the top bar's switcher list,
 * once as the rail's mark — because React's payload dedupes OBJECTS by identity, never strings.
 * The rail now gets the switcher's own entry for this event (the same object), so the payload
 * sends it once and points at it.
 *
 * Holds:
 *   1. the rail's mark IS the switcher's entry for this event, with the layout's own gated build
 *      only as the fallback (a switcher that could not read the events);
 *   2. the switcher's entry passes the read-time SVG gate (SEC-3) — so the rail's mark is still
 *      never a raw column;
 *   3. whether it plays is handed beside it (a shared object cannot carry a rail-only flag).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test("the rail's mark is the switcher's own entry for this event", () => {
  const layout = read('app/dashboard/[eventId]/layout.tsx');
  assert.match(layout, /eventMonogram=\{\s*switcherData\.events\.find\(\(e\) => e\.event_id === eventId\) \?\? \{/);
  assert.match(layout, /eventMonogramPlays=\{railMarkPlays\}/);
});

test('the switcher entry is gated (SEC-3), so the shared mark is never a raw column', () => {
  const sw = read('app/_components/account-switcher/get-switcher-data.ts');
  assert.match(sw, /monogram_custom_svg: resolveEventMonogramSvg\(ev,/);
  assert.doesNotMatch(sw, /monogram_custom_svg: ev\.monogram_custom_svg/);
});

test('the rail plays it from the flag handed beside it', () => {
  const rail = read('app/dashboard/[eventId]/_components/event-rail-context.tsx');
  assert.match(rail, /plays=\{eventMonogramPlays \?\? eventMonogram\.plays\}/);
});

/**
 * create-event-opens-from-every-page.test.ts — a tap on "Plan an event" from a page that is NOT Home opens the
 * create-event sheet, never "This page doesn't exist" (walk 13 Nov 2026, F-W3-13).
 *
 * The route tree, asserted: `(launcher)/@modal/(.)create-event` intercepts client navigations to
 * /dashboard/create-event from every page under /dashboard; the launcher layout then needs a fallback for its MAIN
 * slot when the page under the sheet is not Home (`(launcher)/default.tsx`), and one for `@modal` on a hard load.
 * The real page stays at `(account)/create-event/page.tsx` for a hard load, with or without `?samahan=`.
 *
 * SABOTAGE: delete `(launcher)/default.tsx` → RED (the live soft 404 of 13 Nov).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const DASH = join(import.meta.dirname, '..');
const has = (rel: string) => existsSync(join(DASH, rel));
const code = (rel: string) => stripComments(readFileSync(join(DASH, rel), 'utf8'));

test('the intercept that draws the sheet still exists, and renders the real page', () => {
  assert.ok(has('(launcher)/@modal/(.)create-event/page.tsx'), 'the create-event sheet route moved — re-read this guard');
  assert.match(code('(launcher)/@modal/(.)create-event/page.tsx'), /import CreateEventPage from '@\/app\/dashboard\/\(account\)\/create-event\/page'/);
});

test('every slot of the launcher layout has a fallback, so an intercept from another page is never not-found', () => {
  assert.ok(has('(launcher)/@modal/default.tsx'), '@modal has no default — a hard load of /dashboard 404s the slot');
  assert.ok(has('(launcher)/default.tsx'), 'the main slot has no default — "Plan an event" from a Group is a soft 404');
  assert.match(code('(launcher)/default.tsx'), /return null;/, 'the fallback must draw nothing — the sheet is the content');
});

test('the full page is still reachable by a hard load, with and without ?samahan=', () => {
  assert.ok(has('(account)/create-event/page.tsx'));
  const page = code('(account)/create-event/page.tsx');
  assert.match(page, /samahan/, 'the page no longer reads ?samahan= — "Plan an event" from a Group loses its group');
  assert.doesNotMatch(page, /\bnotFound\(\)/, 'the create-event page answers not-found for someone');
  // The Group's own door still points at the create-event URL the sheet intercepts.
  const group = code('(account)/samahan/[communityId]/page.tsx');
  assert.match(group, /\/dashboard\/create-event\?samahan=\$\{communityId\}/);
});

/**
 * A CATEGORY PICK ADDS ONLY THAT CATEGORY, AND "CLEAR ALL FILTERS" CLEARS EVERY ONE — walk EB-062 / EB-069 / EB-073
 * (owner 2026-11-16, "Fix them too").
 *
 * Measured live: a couple whose newest event is a Get-together picked "Accommodation" and the page read
 * "Accommodation · Get-together", with "Filters · 1 applied" she never chose. "Clear all filters" went to
 * `/?browse=1` and the Get-together stayed, so searching "flower" found no florists although two were listed.
 * Cause: `resolveExploreScope` auto-applied the couple's own event type whenever `?event_type=` was absent, and
 * clearing the parameter IS the absent state.
 *
 * Held with the real builders: `categoryPickHref` and `discoverSupplierHref` (what Clear all lands on) produce the
 * address, and `resolveExploreScope` turns that address into the event-type filter. The couple's event type is not
 * an input any more, so no couple can be scoped by it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { categoryPickHref, discoverSupplierHref, opensSupplierView } from './discover-suppliers';
import { resolveExploreScope } from './explore-event-type-scope';
import { stripComments } from './strip-comments';

const KNOWN = new Set(['wedding', 'get_together', 'debut', 'birthday']);

/** The event-type filter Discover applies on this address. */
const eventTypeOn = (href: string) =>
  resolveExploreScope(new URL(href, 'https://x').searchParams.get('event_type'), KNOWN).eventType;

test('picking a category from Discover adds that category and nothing else', () => {
  for (const from of ['', '?browse=1', '?q=flower', '?browse=1&city=Manila']) {
    const href = categoryPickHref(from, 'accommodation');
    const p = new URL(href, 'https://x').searchParams;
    assert.equal(p.get('category'), 'accommodation');
    assert.equal(p.get('event_type'), null, `${from} → ${href} carries an event type nobody chose`);
    assert.equal(eventTypeOn(href), null, `${from} → ${href} is scoped to an event type nobody chose`);
  }
});

test('"Clear all filters" lands on an address with no filter at all — and none is applied there', () => {
  const href = discoverSupplierHref(new URLSearchParams());
  assert.equal(href, '/?browse=1');
  assert.ok(opensSupplierView(new URL(href, 'https://x').searchParams), 'Clear all fell out of the supplier view');
  assert.equal(eventTypeOn(href), null, 'Clear all left an event-type filter on');
});

test('a filter applies only when the address names it', () => {
  assert.equal(eventTypeOn('/?browse=1&event_type=debut'), 'debut');
  assert.equal(eventTypeOn('/?browse=1&q=flower'), null, '"flower" is narrowed by an event type nobody chose');
});

test('the page does not hand the couple’s event type to the scope', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'app/(shell)/explore/_lib/marketplace-view.tsx'), 'utf8'));
  const call = src.match(/resolveExploreScope\(([^)]*)\)/);
  assert.ok(call, 'the page stopped using resolveExploreScope');
  assert.doesNotMatch(call![1]!, /couple/i, `the couple's event type scopes Discover again: ${call![0]}`);
});

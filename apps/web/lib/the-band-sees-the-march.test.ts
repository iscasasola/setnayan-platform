/**
 * the-band-sees-the-march.test.ts — owner, tracker 2026-10-23: YES. "The band and the coordinator (suppliers booked
 * in those categories) see the Wedding March read-only in their event Hub, the same data the couple's march uses."
 *
 *   ⓵ WHO: a booking in a music category or the coordinator trade — asked of what they were booked FOR on this
 *      event, never of the shop's whole service list. A caterer or a photographer does not get the guests' names.
 *   ⓶ WHAT: the couple's own loader (`loadMarch` → `marchSections`) — the march as applied, the same one the Maker
 *      draws; a march that could not be read is said, and an event where nobody walks draws nothing.
 *   ⓷ READ-ONLY: nothing in it moves a name — no button, form, drag or handler; the walk numbers run on across
 *      sections exactly as the couple's maker numbers them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { supplierSeesMarch } from '@/lib/supplier-march';
import type { MarchSection } from '@/lib/march-drag';
import { MarchRead } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/march-read';

// The view is JSX under the classic runtime here (as `a-list-only-event-takes-no-requests.test.ts` does).
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const HUB = 'app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx';
const VIEW = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/march-read.tsx';

test('⓵ the band and the coordinator — booked FOR it on this event — and nobody else', () => {
  for (const c of ['band_dj', 'string_quartet', 'coordinator', 'day_of_coordinator']) assert.equal(supplierSeesMarch([c]), true, c);
  for (const c of ['catering', 'photographer', 'hmua', 'florist']) assert.equal(supplierSeesMarch([c]), false, c);
  assert.equal(supplierSeesMarch([]), false);
  const hub = read(HUB);
  assert.match(hub, /supplierSeesMarch\(\[\.\.\.\(brief\?\.booked_categories \?\? \[\]\), \.\.\.bookedServiceCategories\]\)/, 'the gate reads something other than this booking');
  assert.doesNotMatch(hub, /supplierSeesMarch\(profile\.services/, 'a shop that ALSO does music would see every couple’s march');
  assert.match(hub, /seesMarch \? await loadMarch\(/, 'the march is read for bookings that may not see it');
});

test('⓶ the couple’s own march, as applied; unread said; nothing when nobody walks', () => {
  const hub = read(HUB);
  assert.match(hub, /import \{ loadMarch \} from '@\/app\/\[slug\]\/_lib\/loaders'/);
  assert.match(hub, /marchSections\(march\.walking\)/);
  assert.doesNotMatch(hub, /hub_drafts|marchAsDrafted|replayMarch/, 'the supplier would read the couple’s unapplied draft');
  assert.match(hub, /march && \(march\.unread \|\| marchWalkCount\(marchShown\) > 0\)/);
  const unread = renderToStaticMarkup(React.createElement(MarchRead, { sections: [], unread: true }));
  assert.match(unread, /data-supplier-march="unread"/);
  assert.match(unread, /couldn.t load/);
});

test('⓷ read-only, numbered on across sections like the maker', () => {
  const sections: MarchSection[] = [
    { key: 'groom', label: 'The Groom & his parents', rows: [[{ id: 'a', name: 'Mr. Peregrino Dela Cruz', role: 'parent' }, { id: 'b', name: 'Mrs. Milagros Dela Cruz', role: 'parent' }], [{ id: 'c', name: 'Jose Dela Cruz', role: 'groom', tag: 'Groom' }, null]] },
    { key: 'sponsors', label: 'Principal sponsors', rows: [[{ id: 'd', name: 'Hon. Ricardo Villahermosa', role: 'sponsor' }, { id: 'e', name: 'Mrs. Jessica Villahermosa', role: 'sponsor' }]] },
  ];
  const html = renderToStaticMarkup(React.createElement(MarchRead, { sections, unread: false }));
  assert.match(html, /3 walks · read-only/);
  for (const n of ['Mr. Peregrino Dela Cruz', 'Jose Dela Cruz', 'Hon. Ricardo Villahermosa']) assert.ok(html.includes(n), n);
  assert.match(html, /walks alone/);
  const steps = [...html.matchAll(/<li[^>]*><span[^>]*>(\d+)<\/span>/g)].map((m) => Number(m[1]));
  assert.deepEqual(steps, [1, 2, 3], 'the walk numbers restart per section — the band cues by the couple’s numbers');
  assert.doesNotMatch(html, /<button|<form|<input|draggable/, 'the read-only march can move a name');
  const src = read(VIEW);
  assert.doesNotMatch(src, /'use client'|onClick|onPointer|onDrag|useState|action=/, 'the read-only march grew a way to change it');
});

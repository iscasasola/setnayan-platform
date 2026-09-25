/**
 * the-strip-does-not-repeat-overview.test.ts — 2026-09-25.
 *
 * iOS app, Galleries: the moment strip read "Overview · Papic · Galleries"
 * directly above a bar whose first tab is Overview. Now that the strip is
 * DOCKED to the bar (one unit), the repeat sits a finger's width apart.
 *
 * The binding drawing (`build-sessions/prototypes/event_menu_by_moment_2026-09-24.html`)
 * draws the spine strip as Papic · Galleries · Editorial — no Overview chip —
 * so Overview comes out. ⚠ ONLY Overview: the same drawing KEEPS the other bar
 * twins in their strips (Your Team in Book, Guests and the Event Hub Controller
 * in Invite), because there they are the next step of the moment. So "Your
 * Team" still appears in the Book strip on Budget — by design, not oversight.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEventMenuSections,
  eventMomentChildren,
  eventMomentForPath,
  type EventStudioRow,
} from './customer-menu';

const EVENT_ID = 'S89E-TESTEVENT';
const BASE = `/dashboard/${EVENT_ID}`;
const STUDIO: EventStudioRow[] = [{ key: 'papic', href: `${BASE}/studio/papic`, name: 'Papic' }];

const strip = (at: string, phase: 'plan' | 'after' = 'plan', storeShell = false) => {
  const sections = buildEventMenuSections(EVENT_ID, { phase, websiteEnabled: true, studioRows: STUDIO, storeShell });
  return eventMomentChildren(at, eventMomentForPath(at, sections)).map((c) => c.label);
};

test('the spine strip on Galleries is Papic · Galleries — the drawing, with no Overview chip', () => {
  assert.deepEqual(strip(`${BASE}/galleries`), ['Papic', 'Galleries']);
  /* ✏️ 2026-09-25 (Event Hub Maker, Phase 1): Editorial's door moved into the
     Maker bar's "Post Event" — its own row left the tree (owner: one sidebar
     row "Event Hub Maker" holding Logo Maker · Editorial · Love Story). */
  assert.deepEqual(strip(`${BASE}/galleries`, 'after'), ['Papic', 'Galleries']);
});

test('the other bar twins stay in their strips, as the drawing draws them', () => {
  assert.ok(strip(`${BASE}/budget`).includes('Your Team'), 'Book lost Your Team');
  const invite = strip(`${BASE}/hosts`);
  assert.ok(invite.includes('Guests') && invite.includes('Event Hub Maker'), `Invite reads ${invite.join(' · ')}`);
});

test('a moment left with one chip once Overview is out is not a strip (store shell: Papic is gone too)', () => {
  // In the app the spine is Overview + Galleries; without Overview that is one
  // chip, and a one-chip strip is a label, not a menu.
  assert.deepEqual(strip(`${BASE}/galleries`, 'plan', true), []);
});

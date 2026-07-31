/**
 * addOnOfferedForEvent — the ONE event-type gate for in-app services.
 *
 * Extracted 2026-07-31 because the two surfaces that need it had drifted apart:
 * the Suite grid ran the full two-layer gate, and `studio/about/[addon]` — the
 * page every "learn more" link in the product points at — ran **nothing**. So
 * `/dashboard/<id>/studio/about/papic-guest` rendered the Papic Pool pitch on a
 * `travel` event, the one type on the permanent V1 deny list.
 *
 * A grid that hides a card does not close the URL behind it. The deep link is
 * not exotic; it is the ordinary path with the grid skipped.
 *
 * These tests pin the predicate itself. The source-level assertion that BOTH
 * surfaces call it lives at the bottom.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { addOnOfferedForEvent } from './add-on-event-scope';
import {
  GENERIC_PROFILE,
  WEDDING_PROFILE,
  type EventTypeProfile,
} from './event-type-profile';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** A profile shaped like a real prod row — every type carries `rsvp`. */
const profileFor = (eventType: string): EventTypeProfile =>
  eventType === 'wedding' ? WEDDING_PROFILE : { ...GENERIC_PROFILE, eventType };

const POOL = { key: 'papic-guest', surface: 'rsvp' } as const;

test('Papic Pool is offered on an in-scope type', () => {
  assert.equal(addOnOfferedForEvent(POOL, profileFor('wedding')), true);
  assert.equal(addOnOfferedForEvent(POOL, profileFor('birthday')), true);
  assert.equal(addOnOfferedForEvent(POOL, profileFor('simple_event')), true);
});

test('Papic Pool is DENIED on travel — the bug this gate exists to stop', () => {
  const travel = profileFor('travel');
  // Precondition: the surface check alone would let travel through. If this
  // ever stops holding, the deny is still correct — travel is roaming and
  // multi-day, so a pass metered per event-day is the wrong unit at any
  // surface configuration.
  assert.ok(
    travel.enabledSurfaces.includes('rsvp'),
    'fixture must mirror prod (20270804110223 added rsvp to every non-wedding row)',
  );
  assert.equal(addOnOfferedForEvent(POOL, travel), false);
});

test('Papic Pool fails CLOSED for an unscoped type', () => {
  assert.equal(addOnOfferedForEvent(POOL, profileFor('pet_adoption_party')), false);
});

test('the anniversary controller split is carried through', () => {
  const anniversary = profileFor('anniversary');
  assert.equal(addOnOfferedForEvent(POOL, anniversary, null), true, 'personally owned');
  assert.equal(
    addOnOfferedForEvent(POOL, anniversary, 'S89C-0000000001'),
    false,
    'Samahan-owned is Phase 2',
  );
});

test('the generic surface gate still governs non-Papic add-ons', () => {
  const noWebsite: EventTypeProfile = {
    ...GENERIC_PROFILE,
    eventType: 'birthday',
    enabledSurfaces: GENERIC_PROFILE.enabledSurfaces.filter((s) => s !== 'website'),
  };
  const websiteAddOn = { key: 'editorial', surface: 'website' } as const;
  assert.equal(addOnOfferedForEvent(websiteAddOn, noWebsite), false);
  assert.equal(addOnOfferedForEvent(websiteAddOn, WEDDING_PROFILE), true);
});

test('an add-on with no surface is universal', () => {
  const universal = { key: 'orders', surface: undefined } as const;
  for (const t of ['wedding', 'travel', 'simple_event', 'brand_new_type']) {
    assert.equal(addOnOfferedForEvent(universal, profileFor(t)), true, t);
  }
});

test('add-ons-catalog imports event-type-profile TYPE-ONLY', () => {
  // 🪤 This predicate lived in `add-ons-catalog.ts` for one CI run and broke the
  // production build. That module is imported by CLIENT components and had only
  // ever imported `type ProfileSurface` — erased at compile. Adding
  // `surfaceEnabled` (a VALUE) made it a runtime import, dragging
  // event-type-profile's Supabase server client, and therefore `next/headers`,
  // into every client bundle touching the catalog.
  //
  // `tsc --noEmit` was clean and 5752 unit tests passed. ONLY the production
  // build catches this class — and `npm run build` OOMs on the owner's machine,
  // so CI is the sole detector. This assertion moves the catch to a test that
  // runs anywhere.
  const src = read('lib/add-ons-catalog.ts');
  const serverModules = ['event-type-profile', 'papic-event-access', 'supabase/'];
  for (const mod of serverModules) {
    const valueImport = new RegExp(
      `import\\s+(?!type\\s)\\{[^}]*\\}\\s+from\\s+'@/lib/${mod.replace('/', '\\/')}`,
    );
    assert.doesNotMatch(
      src,
      valueImport,
      `lib/add-ons-catalog.ts must not VALUE-import @/lib/${mod} — it is bundled ` +
        `into client components, and that pulls next/headers into the browser ` +
        `bundle. Type-only imports are fine; put runtime logic in ` +
        `lib/add-on-event-scope.ts (server-side) instead.`,
    );
  }
});

test('BOTH surfaces call the shared predicate', () => {
  // The split is what let the About route go ungated for as long as it did.
  for (const rel of [
    'app/dashboard/[eventId]/suite/page.tsx',
    'app/dashboard/[eventId]/studio/about/[addon]/page.tsx',
  ]) {
    assert.match(
      read(rel),
      /addOnOfferedForEvent\(/,
      `${rel} must gate on the shared predicate — a second hand-rolled copy is ` +
        `how these two drifted apart in the first place`,
    );
  }
});

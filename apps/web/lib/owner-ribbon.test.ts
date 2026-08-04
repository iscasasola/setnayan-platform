/**
 * Owner ribbon — the first surface of the owner layer (owner-locked 2026-07-26).
 *
 * `buildOwnerRibbon()` is the whole decision surface behind the ribbon: the
 * component is `if (!model) return null` plus markup. So this suite carries the
 * two claims the PR is accountable for.
 *
 *   1. VISIBILITY. A ribbon exists for exactly one viewer — the one holding a
 *      server-verified `OwnerCapability` for THIS event. No capability, no
 *      model, and therefore no ribbon in the DOM. There is no other way in:
 *      the capability is the only input that can turn the model on, so a guest
 *      or an anonymous visitor cannot reach it by any prop, param or cookie.
 *   2. THE PHASE LINKS. They must point at the four literal `?phase=` values
 *      `app/[slug]/page.tsx` accepts, and the active flag must track the phase
 *      the page ACTUALLY rendered — including when `?phase=` overrode the
 *      date-derived one.
 *
 * Gate-neutralisation check (2026-07-26): forcing `ownerCapability` to null in
 * `buildOwnerRibbon` makes the four "renders for the owner" tests below fail,
 * which is the proof that they are testing the gate and not merely coexisting
 * with it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOwnerRibbon,
  OWNER_RIBBON_PHASES,
  type OwnerRibbonModel,
} from './owner-ribbon';
import type { OwnerCapability } from '../app/[slug]/_lib/site-identity';
import type { LifecyclePhase } from './invitation-widgets';

const EVENT_ID = 'S89E-ABCDEFGHJK';
const SLUG = 'maria-and-jose';
const HOST_USER_ID = 'user-host';

/** A capability shaped exactly as `resolveOwnerCapability` produces one. */
const ownerOf = (eventId: string): OwnerCapability => ({
  capability: 'owner',
  ownerUserId: HOST_USER_ID,
  ownerEventId: eventId,
});

function build(overrides: Partial<Parameters<typeof buildOwnerRibbon>[0]> = {}) {
  return buildOwnerRibbon({
    ownerCapability: ownerOf(EVENT_ID),
    eventId: EVENT_ID,
    slug: SLUG,
    phasesEnabled: true,
    lifecyclePhase: 'rsvp',
    ...overrides,
  });
}

/** Non-null narrowing helper so each test reads as one assertion chain. */
function must(model: OwnerRibbonModel | null): OwnerRibbonModel {
  assert.ok(model, 'expected a ribbon model');
  return model;
}

// ── 1. Visibility: the capability is the only door ─────────────────────────

test('owner ribbon: a null capability yields NO model (guest + anonymous)', () => {
  assert.equal(build({ ownerCapability: null }), null);
});

test('owner ribbon: a null capability stays null in every lifecycle phase', () => {
  for (const phase of OWNER_RIBBON_PHASES) {
    assert.equal(
      build({ ownerCapability: null, lifecyclePhase: phase }),
      null,
      `phase ${phase} must not leak a ribbon to a non-owner`,
    );
  }
});

test('owner ribbon: a verified capability for THIS event yields a model', () => {
  const model = must(build());
  assert.equal(model.phaseLinks.length, 4);
});

test("owner ribbon: a capability for ANOTHER event is not honoured here", () => {
  assert.equal(
    build({ ownerCapability: ownerOf('S89E-OTHEREVENT') }),
    null,
  );
});

test('owner ribbon: no slug means no ribbon (nothing to link phases on)', () => {
  assert.equal(build({ slug: null }), null);
});

// ── 2. The doorway back to editing ─────────────────────────────────────────

test('owner ribbon: editor link points at the event website editor', () => {
  const model = must(build());
  assert.equal(model.editorHref, `/dashboard/${EVENT_ID}/website/editor`);
});

// ── 3. Phase links: the four real values, correctly marked ─────────────────

test('owner ribbon: phase links cover the four real ?phase= values in order', () => {
  const model = must(build());
  assert.deepEqual(
    model.phaseLinks.map((l) => l.phase),
    ['save_the_date', 'rsvp', 'event', 'editorial'],
  );
  assert.deepEqual(
    model.phaseLinks.map((l) => l.href),
    [
      `/${SLUG}?phase=save_the_date`,
      `/${SLUG}?phase=rsvp`,
      `/${SLUG}?phase=event`,
      `/${SLUG}?phase=editorial`,
    ],
  );
});

test('owner ribbon: every phase link carries a non-empty label', () => {
  const model = must(build());
  for (const link of model.phaseLinks) {
    assert.ok(link.label.trim().length > 0, `${link.phase} needs a label`);
  }
});

test('owner ribbon: exactly ONE phase is active, and it is the rendered one', () => {
  for (const phase of OWNER_RIBBON_PHASES) {
    const model = must(build({ lifecyclePhase: phase }));
    const active = model.phaseLinks.filter((l) => l.active);
    assert.equal(active.length, 1, `phase ${phase}: expected one active link`);
    assert.equal(active[0]?.phase, phase);
  }
});

test('owner ribbon: active state follows a ?phase= OVERRIDE, not the date', () => {
  // page.tsx computes `lifecyclePhase = phaseOverride ?? getLifecyclePhase(date)`
  // and hands SiteBody the RESULT. So a host whose date-derived phase is `rsvp`
  // but who opened `?phase=editorial` is passed `editorial` — and the ribbon
  // must mark editorial, matching what the body actually rendered.
  const dateDerived: LifecyclePhase = 'rsvp';
  const overridden: LifecyclePhase = 'editorial';
  assert.notEqual(dateDerived, overridden);

  const model = must(build({ lifecyclePhase: overridden }));
  const activePhases = model.phaseLinks.filter((l) => l.active).map((l) => l.phase);
  assert.deepEqual(activePhases, ['editorial']);
  assert.equal(
    model.phaseLinks.find((l) => l.phase === dateDerived)?.active,
    false,
  );
});

test('owner ribbon: phase links are withheld when the lifecycle engine is off', () => {
  const model = must(build({ phasesEnabled: false }));
  assert.deepEqual(model.phaseLinks, []);
  // The doorway back to editing survives — that is the wayfinding duty.
  assert.equal(model.editorHref, `/dashboard/${EVENT_ID}/website/editor`);
});

// ── 4. Read-only by construction ───────────────────────────────────────────

test('owner ribbon: the model is links and labels only — no action surface', () => {
  const model = must(build());
  assert.deepEqual(Object.keys(model).sort(), ['editorHref', 'phaseLinks']);
  for (const link of model.phaseLinks) {
    assert.deepEqual(Object.keys(link).sort(), ['active', 'href', 'label', 'phase']);
    assert.equal(typeof link.href, 'string');
  }
});

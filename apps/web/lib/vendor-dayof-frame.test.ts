/**
 * Vendor day-of console frame — the structure tests.
 *
 * `buildDayOfFrame()` is the whole decision surface behind the restyled live
 * console: the page is `model.specialization ? <section/> : null` plus markup.
 * So this suite carries the claims the PR is accountable for.
 *
 *   1. THE GENERIC KIT IS UNTOUCHABLE. Free-during-launch is active and every
 *      production vendor is on a free tier, so a frame that removed even one
 *      existing tool would be a regression. `genericModuleIds` must come back
 *      IDENTICAL — same ids, same order — on every access path, including the
 *      below-floor one. This is asserted against every `VendorSpecializationReason`
 *      below, which is the mechanical guarantee that the gate governs the new
 *      specialization section and nothing else.
 *   2. THE SLOT TRACKS THE ENTITLEMENT. A held set gets a section; a locked set
 *      gets no section and a quiet upsell; an unmapped category gets neither.
 *   3. NO BROKEN SECTION, EVER. A held-but-unbuilt set renders `coming_soon`
 *      rather than an error or a dead tab, and every nav href points at a
 *      section this same model renders.
 *
 * The access values are built by the REAL gate (`resolveVendorSpecializationAccess`)
 * from real taxonomy tiles and real tier strings, not by hand-written literals —
 * so these tests break if the gate's meaning changes underneath the frame.
 *
 * Gate-neutralisation check (2026-07-27): forcing `access.unlockedSet` to null
 * at the top of `buildDayOfFrame` fails the four "held set gets its section"
 * tests while every "generic kit intact" test still passes — the proof that the
 * slot is driven by the entitlement and that the generic kit is not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDayOfFrame, SPECIALIZATION_UPGRADE_HREF } from './vendor-dayof-frame';
import {
  resolveVendorSpecializationAccess,
  type VendorSpecializationAccess,
  type VendorSpecializationReason,
  type VendorSpecializationSet,
} from './vendor-specialization-gate';
import type { DayOfModuleId } from './vendor-dayof-modules';

/** A realistic enabled-module list, in the console's own order. The exact
 *  contents do not matter — the point is that it comes back unchanged. */
const GENERIC: readonly DayOfModuleId[] = [
  'run_of_show',
  'pax_headcount',
  'delivery_handover',
  'review_qr',
  'live_reviews',
  'issues_log',
];

/** Build access the way production does: real tiles through the real gate. */
function accessFor(
  services: readonly string[],
  tier: string | null,
  expiry: string | null = null,
): VendorSpecializationAccess {
  return resolveVendorSpecializationAccess({
    subscription: tier === null ? null : { tier_state: tier, tier_expires_at: expiry },
    services,
  });
}

function frame(
  access: VendorSpecializationAccess,
  registeredSets?: ReadonlySet<VendorSpecializationSet>,
) {
  return buildDayOfFrame({ access, genericModuleIds: GENERIC, registeredSets });
}

/** One access value per reason, so the invariant below is exhaustive. */
const ONE_PER_REASON: Record<VendorSpecializationReason, VendorSpecializationAccess> = {
  unlocked: accessFor(['live_band'], 'solo'),
  below_tier_floor: accessFor(['live_band'], 'free'),
  subscription_lapsed: accessFor(['live_band'], 'pro', '2020-01-01T00:00:00Z'),
  no_specialization_for_category: accessFor(['florist'], 'pro'),
};

// ─── 1. The generic kit is untouchable ──────────────────────────────────────

test('THE INVARIANT — the generic kit comes back verbatim for EVERY reason', () => {
  for (const [reason, access] of Object.entries(ONE_PER_REASON)) {
    assert.equal(access.reason, reason, `fixture for ${reason} drifted`);
    const model = frame(access);
    assert.deepEqual(
      model.genericModuleIds,
      GENERIC,
      `${reason} altered the generic kit — the gate must govern the specialization section ONLY`,
    );
  }
});

test('the generic kit is the SAME REFERENCE, not a filtered copy', () => {
  // Stronger than deepEqual: proves no filter/map ran over it at all, so a
  // future "just one small exclusion" cannot slip in unnoticed.
  for (const access of Object.values(ONE_PER_REASON)) {
    assert.equal(frame(access).genericModuleIds, GENERIC);
  }
});

test('a below-floor vendor keeps every tool a free vendor has today', () => {
  const model = frame(accessFor(['live_band'], 'free'));
  assert.deepEqual(model.genericModuleIds, GENERIC);
  assert.equal(model.genericModuleIds.length, GENERIC.length);
  // ...and gets no specialization section.
  assert.equal(model.specialization?.state, 'locked');
});

test('an empty generic kit stays empty rather than being invented into', () => {
  const model = buildDayOfFrame({
    access: accessFor(['live_band'], 'solo'),
    genericModuleIds: [],
  });
  assert.deepEqual(model.genericModuleIds, []);
});

// ─── 2. The slot tracks the entitlement ─────────────────────────────────────

test('UNLOCKED + REGISTERED → the section renders ready, no upsell', () => {
  const model = frame(accessFor(['live_band'], 'solo'), new Set(['song_desk']));
  assert.equal(model.specialization?.set, 'song_desk');
  assert.equal(model.specialization?.state, 'ready');
  assert.equal(model.upsell, null);
});

test('every set unlocks its own section for a subscribed vendor', () => {
  const cases: [string, VendorSpecializationSet][] = [
    ['live_band', 'song_desk'],
    ['choir', 'song_desk'],
    ['host_mc', 'stage_script'],
    ['coordinator', 'floor_command'],
  ];
  for (const [tile, expected] of cases) {
    const model = frame(accessFor([tile], 'solo'), new Set([expected]));
    assert.equal(model.specialization?.set, expected, `${tile} → ${expected}`);
    assert.equal(model.specialization?.state, 'ready');
  }
});

test('BELOW FLOOR → no section state other than locked, and a quiet upsell', () => {
  const model = frame(accessFor(['host_mc'], 'free'), new Set(['stage_script']));
  assert.equal(model.specialization?.state, 'locked');
  assert.equal(model.upsell?.set, 'stage_script');
  assert.equal(model.upsell?.lapsed, false);
  assert.equal(model.upsell?.href, SPECIALIZATION_UPGRADE_HREF);
});

test('being REGISTERED does not unlock — only the entitlement does', () => {
  // The registry is a presentation input. A free vendor with every surface
  // built still gets `locked`.
  const model = frame(
    accessFor(['coordinator'], 'free'),
    new Set(['floor_command', 'song_desk', 'stage_script']),
  );
  assert.equal(model.specialization?.state, 'locked');
  assert.notEqual(model.specialization?.state, 'ready');
});

test('LAPSED mid-event → locked + a renew-flavoured upsell, kit intact', () => {
  const model = frame(accessFor(['coordinator'], 'pro', '2020-01-01T00:00:00Z'));
  assert.equal(model.specialization?.state, 'locked');
  assert.equal(model.upsell?.lapsed, true);
  assert.deepEqual(model.genericModuleIds, GENERIC);
});

test('the upsell quotes the floor from the gate constant, not a literal', () => {
  const model = frame(accessFor(['live_band'], 'free'));
  assert.equal(model.upsell?.minTierLabel, 'Solo');
});

test('the upsell wording comes from the gate registry — one source of truth', () => {
  const model = frame(accessFor(['coordinator'], 'free'));
  assert.equal(model.upsell?.label, 'Run the floor');
  assert.equal(model.upsell?.label, model.specialization?.label);
  assert.equal(model.upsell?.blurb, model.specialization?.blurb);
});

// ─── 3. Unknown category, and no broken section ever ────────────────────────

test('UNKNOWN / UNMAPPED CATEGORY → generic only: no section, no upsell, no nav', () => {
  for (const services of [['florist'], ['caterer', 'photographer'], [], ['not_a_real_tile']]) {
    const model = frame(accessFor(services, 'pro'));
    assert.equal(model.specialization, null, JSON.stringify(services));
    assert.equal(model.upsell, null);
    assert.deepEqual(model.nav, []);
    assert.deepEqual(model.genericModuleIds, GENERIC);
  }
});

test('HELD BUT UNBUILT → coming_soon, named, never an error or a dead section', () => {
  const model = frame(accessFor(['host_mc'], 'pro')); // registry empty
  assert.equal(model.specialization?.state, 'coming_soon');
  assert.equal(model.specialization?.label, 'Script & cues');
  assert.ok(model.specialization!.blurb.length > 0, 'placeholder must name what is coming');
  assert.equal(model.upsell, null, 'they already hold it — nothing to sell');
});

test('a registry holding OTHER sets leaves this one coming_soon', () => {
  const model = frame(accessFor(['host_mc'], 'pro'), new Set(['song_desk', 'floor_command']));
  assert.equal(model.specialization?.state, 'coming_soon');
});

test('NO DEAD LINKS — every nav href targets a section this model renders', () => {
  for (const access of Object.values(ONE_PER_REASON)) {
    const model = frame(access);
    const ids = new Set([model.genericDomId]);
    if (model.specialization) ids.add(model.specialization.domId);
    for (const item of model.nav) {
      assert.equal(item.href, `#${item.id}`, 'nav href must be its own anchor');
      assert.ok(ids.has(item.id), `nav points at a section that does not render: ${item.id}`);
    }
  }
});

test('the nav is empty with one section and two-up with two — never one-item chrome', () => {
  assert.deepEqual(frame(accessFor(['florist'], 'pro')).nav, []);
  assert.equal(frame(accessFor(['live_band'], 'solo')).nav.length, 2);
  // Locked vendors still get the nav: the section exists, it just carries the
  // upsell instead of the desk.
  assert.equal(frame(accessFor(['live_band'], 'free')).nav.length, 2);
});

test('section DOM ids are stable and distinct', () => {
  const model = frame(accessFor(['live_band'], 'solo'));
  assert.equal(model.genericDomId, 'day-of-generic');
  assert.equal(model.specialization?.domId, 'day-of-specialization');
  assert.notEqual(model.genericDomId, model.specialization?.domId);
});

test('never throws, and always yields a generic section, on any input', () => {
  const wild = [
    accessFor([], null),
    accessFor(['live_band'], 'not-a-tier'),
    accessFor(['live_band'], 'solo', 'not-a-date'),
    accessFor(['coordinator', 'live_band', 'host_mc'], 'enterprise'),
  ];
  for (const access of wild) {
    const model = frame(access);
    assert.ok(model.genericDomId);
    assert.deepEqual(model.genericModuleIds, GENERIC);
  }
});

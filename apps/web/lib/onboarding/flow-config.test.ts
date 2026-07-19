/**
 * Unit suite for resolveOnboardingFlow (0053 Phase 3 generic onboarding seam).
 * Invariant: the manifest carries the 5 event-agnostic experience-quiz axes + the
 * universal essentials, and the persona pack key follows the profile's
 * onboarding_flow_key (PR3 registers per-type packs under it).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERIC_PROFILE, WEDDING_PROFILE, type EventTypeProfile } from '@/lib/event-type-profile';
import { resolveOnboardingFlow, GENERIC_ONBOARDING_SCREENS } from './flow-config';

test('generic profile (no flow key) → flowKey + personaPackKey both "generic"', () => {
  const flow = resolveOnboardingFlow({ ...GENERIC_PROFILE, eventType: 'birthday' });
  assert.equal(flow.flowKey, 'generic');
  assert.equal(flow.personaPackKey, 'generic');
  assert.equal(flow.eventType, 'birthday');
  assert.deepEqual(flow.screens, [...GENERIC_ONBOARDING_SCREENS]);
});

test('a profile with an explicit onboarding_flow_key drives the persona pack key', () => {
  const profile: EventTypeProfile = { ...GENERIC_PROFILE, eventType: 'debut', onboardingFlowKey: 'debut' };
  const flow = resolveOnboardingFlow(profile);
  assert.equal(flow.flowKey, 'debut');
  assert.equal(flow.personaPackKey, 'debut');
  assert.equal(flow.eventType, 'debut');
});

test('manifest includes the 5 experience axes + the universal essentials', () => {
  const flow = resolveOnboardingFlow({ ...GENERIC_PROFILE, eventType: 'celebration' });
  for (const id of ['exp_for_whom', 'exp_feel', 'exp_energy', 'exp_roots', 'exp_effort']) {
    assert.ok(flow.screens.includes(id as (typeof GENERIC_ONBOARDING_SCREENS)[number]), `missing ${id}`);
  }
  for (const id of ['name', 'date', 'pax', 'region', 'plan', 'congrats']) {
    assert.ok(flow.screens.includes(id as (typeof GENERIC_ONBOARDING_SCREENS)[number]), `missing ${id}`);
  }
});

test('manifest carries NO wedding-only screens (faith / monogram / love story)', () => {
  const flow = resolveOnboardingFlow({ ...GENERIC_PROFILE, eventType: 'corporate' });
  for (const weddingOnly of ['kind', 'faith', 'name_mono', 'love_intro', 'songs', 'mood']) {
    assert.ok(!flow.screens.includes(weddingOnly as (typeof GENERIC_ONBOARDING_SCREENS)[number]), `should not have ${weddingOnly}`);
  }
});

test('wedding profile (if ever passed) surfaces flowKey "wedding" — routing is the caller\'s job', () => {
  const flow = resolveOnboardingFlow(WEDDING_PROFILE);
  assert.equal(flow.flowKey, 'wedding');
  assert.equal(flow.personaPackKey, 'wedding');
});

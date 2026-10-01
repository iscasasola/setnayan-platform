/**
 * The event onboarding engine's SEED (G1, migration 20271258536791), read from
 * the replayed migrations — the rows the engine actually runs on in prod.
 *
 * lib/onboarding/setup-engine.test.ts pins the step lists against hand rows that
 * MIRROR this seed; this file proves the mirror is true. Together: change the
 * seed and the per-type lists are re-checked against the real thing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { toProfile, type ProfileRow } from '../../lib/event-type-profile';
import { setupViewForProfile } from '../../lib/onboarding/setup-view';
import { CREATION_ASKS, resolveSetupSteps } from '../../lib/onboarding/flow-config';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay?.db?.close();
});

const ADMITTED = ['birthday', 'date', 'hangout', 'simple_event', 'wedding'];
const CARDS = ['setup_where', 'setup_photo', 'setup_look', 'setup_entry', 'setup_guests', 'setup_more'];

async function rows(): Promise<ProfileRow[]> {
  const r = await replay.db.query<ProfileRow>(`SELECT * FROM public.event_type_profiles ORDER BY event_type`);
  return r.rows;
}

test('exactly the five first-build types are admitted to the engine (a seeded look set)', async () => {
  const all = await rows();
  assert.ok(all.length >= 10, `expected the full profile roster, got ${all.length}`);
  const admitted = all.map(toProfile).filter((p) => p.onboardingEngine).map((p) => p.eventType).sort();
  assert.deepEqual(admitted, ADMITTED);
});

test('each admitted type resolves to the six cards after its creation flow', async () => {
  for (const row of (await rows()).filter((r) => ADMITTED.includes(r.event_type))) {
    const p = toProfile(row);
    const flow = p.eventType === 'wedding' ? 'wedding' : p.eventType === 'simple_event' ? 'simple' : 'generic';
    const view = setupViewForProfile(p);
    assert.deepEqual(resolveSetupSteps(view, CREATION_ASKS[flow]), CARDS, p.eventType);
    assert.equal(view.replyDefault, p.eventType === 'wedding' ? 'yes' : 'no', p.eventType);
    assert.ok(view.looks.length > 0, `${p.eventType} has no look to offer`);
  }
});

test('the seeded setup matches the mirror in setup-engine.test.ts', async () => {
  const byType = new Map((await rows()).map((r) => [r.event_type, toProfile(r)]));
  const expect: Record<string, { gifts: string; looks: string[]; roleSet: string | null }> = {
    wedding: { gifts: 'gifts', looks: ['velvet', 'vintage', 'regency', 'cinderella'], roleSet: 'wedding' },
    birthday: { gifts: 'gifts', looks: ['whimsical', 'abaca', 'house', 'galeriya'], roleSet: 'birthday' },
    hangout: { gifts: 'none', looks: ['house', 'galeriya', 'cyber'], roleSet: 'hangout' },
    date: { gifts: 'none', looks: ['house', 'galeriya', 'cyber'], roleSet: 'hangout' },
    simple_event: { gifts: 'none', looks: ['house', 'galeriya', 'cyber'], roleSet: 'simple' },
  };
  for (const [type, e] of Object.entries(expect)) {
    const p = byType.get(type);
    assert.ok(p, `${type} has no profile row`);
    assert.equal(p.setup?.giftsMode, e.gifts, type);
    assert.deepEqual(p.setup?.lookSet, e.looks, type);
    assert.equal(p.setup?.cameraDefault, 'on', type);
    assert.equal(p.roleSetKey, e.roleSet, type);
    assert.equal(p.terminology.register, 'celebratory', type);
  }
});

test('"Get-together" is the simple_event label', async () => {
  const r = await replay.db.query<{ label_en: string }>(
    `SELECT label_en FROM public.event_type_vocab WHERE event_type = 'simple_event'`,
  );
  assert.equal(r.rows[0]?.label_en, 'Get-together');
});

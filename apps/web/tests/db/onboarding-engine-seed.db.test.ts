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

// 🚪 Level 1 (owner 2026-10-08, migration 20271276545380): every type that ships is admitted — the
// fifteen that still walked yesterday's quiz joined the five of the first build.
const ADMITTED = [
  'anniversary', 'birthday', 'celebration', 'christening', 'concert', 'corporate', 'date', 'debut',
  'gala_night', 'gender_reveal', 'grand_opening', 'graduation', 'hangout', 'open_house', 'reunion',
  'simple_event', 'tournament', 'travel', 'wake', 'wedding',
];
// Owner d24 (2026-10-02): sign-up no longer asks "How do guests get in?" — five cards. Level 1: the
// generic wizard and the Get-together form ask the place on "What do you need?", so its card is gone there.
const CARDS = ['setup_where', 'setup_photo', 'setup_look', 'setup_guests', 'setup_more'];
const AFTER_NEEDS = ['setup_photo', 'setup_look', 'setup_guests', 'setup_more'];

async function rows(): Promise<ProfileRow[]> {
  const r = await replay.db.query<ProfileRow>(`SELECT * FROM public.event_type_profiles ORDER BY event_type`);
  return r.rows;
}

test('every shipping type is admitted to the engine (a seeded look set)', async () => {
  const all = await rows();
  assert.ok(all.length >= 10, `expected the full profile roster, got ${all.length}`);
  const admitted = all.map(toProfile).filter((p) => p.onboardingEngine).map((p) => p.eventType).sort();
  for (const t of ADMITTED) assert.ok(admitted.includes(t), `${t} still walks yesterday's quiz`);
  // …and every ENABLED type in the vocabulary is among them — none is left behind.
  const vocab = await replay.db.query<{ event_type: string }>(
    `SELECT event_type FROM public.event_type_vocab WHERE enabled`,
  );
  for (const r of vocab.rows) assert.ok(admitted.includes(r.event_type), `${r.event_type} is enabled but not admitted`);
});

test('each admitted type resolves to its cards after its creation flow', async () => {
  for (const row of (await rows()).filter((r) => ADMITTED.includes(r.event_type))) {
    const p = toProfile(row);
    const flow = p.eventType === 'wedding' ? 'wedding' : p.eventType === 'simple_event' ? 'simple' : 'generic';
    const view = setupViewForProfile(p);
    const expected = (flow === 'wedding' ? CARDS : AFTER_NEEDS).filter((c) => view.guestList || c !== 'setup_guests');
    assert.deepEqual(resolveSetupSteps(view, CREATION_ASKS[flow]), expected, p.eventType);
    assert.equal(view.replyDefault, ['wedding', 'debut', 'gala_night', 'corporate'].includes(p.eventType) ? 'yes' : 'no', p.eventType);
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

test('the fifteen that joined match the mirror in setup-engine.test.ts (JOINED)', async () => {
  const byType = new Map((await rows()).map((r) => [r.event_type, toProfile(r)]));
  const expect: Record<string, { word: string; gifts: string; looks: string[]; camera: string }> = {
    debut: { word: 'guests', gifts: 'gifts', looks: ['cinderella', 'regency', 'velvet', 'house', 'galeriya'], camera: 'on' },
    gender_reveal: { word: 'guests', gifts: 'gifts', looks: ['whimsical', 'house', 'galeriya'], camera: 'on' },
    celebration: { word: 'guests', gifts: 'gifts', looks: ['house', 'galeriya', 'whimsical', 'cyber'], camera: 'on' },
    travel: { word: 'travellers', gifts: 'ambag', looks: ['house', 'galeriya'], camera: 'on' },
    corporate: { word: 'attendees', gifts: 'none', looks: ['galeriya', 'house', 'gatsby'], camera: 'on' },
    tournament: { word: 'players', gifts: 'none', looks: ['cyber', 'galeriya', 'house'], camera: 'on' },
    christening: { word: 'guests', gifts: 'gifts', looks: ['house', 'whimsical', 'vintage'], camera: 'on' },
    anniversary: { word: 'guests', gifts: 'gifts', looks: ['vintage', 'velvet', 'house', 'galeriya'], camera: 'on' },
    graduation: { word: 'guests', gifts: 'gifts', looks: ['galeriya', 'house', 'regency'], camera: 'on' },
    reunion: { word: 'guests', gifts: 'ambag', looks: ['house', 'galeriya', 'vintage'], camera: 'on' },
    gala_night: { word: 'guests', gifts: 'donations', looks: ['gatsby', 'velvet', 'regency', 'house'], camera: 'on' },
    wake: { word: 'family & friends', gifts: 'abuloy', looks: ['vintage', 'galeriya', 'house'], camera: 'quiet' },
    concert: { word: 'guests', gifts: 'none', looks: ['cyber', 'galeriya', 'house'], camera: 'on' },
    open_house: { word: 'guests', gifts: 'none', looks: ['house', 'galeriya', 'cyber'], camera: 'on' },
    grand_opening: { word: 'guests', gifts: 'none', looks: ['galeriya', 'house', 'cyber'], camera: 'on' },
  };
  for (const [type, e] of Object.entries(expect)) {
    const p = byType.get(type);
    assert.ok(p, `${type} has no profile row`);
    assert.equal(p.onboardingEngine, true, type);
    assert.equal(p.setup?.guestWord, e.word, type);
    assert.equal(p.setup?.giftsMode, e.gifts, type);
    assert.deepEqual(p.setup?.lookSet, e.looks, type);
    assert.equal(p.setup?.cameraDefault, e.camera, type);
  }
});

test('"Get-together" is the simple_event label', async () => {
  const r = await replay.db.query<{ label_en: string }>(
    `SELECT label_en FROM public.event_type_vocab WHERE event_type = 'simple_event'`,
  );
  assert.equal(r.rows[0]?.label_en, 'Get-together');
});

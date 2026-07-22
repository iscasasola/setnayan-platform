import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boothMissionPrompt,
  isMissionLive,
  MISSION_TYPE_LABELS,
  missionProgress,
  sortGuestMissions,
} from './papic-missions';
import type { GuestMissionRow, PapicMissionType } from './papic-missions';

function guestMission(over: Partial<GuestMissionRow>): GuestMissionRow {
  return {
    mission_id: 'm',
    mission_type: 'prompt',
    prompt: 'do a thing',
    vendor_id: null,
    target_guest_id: null,
    target_role: null,
    completed: false,
    ...over,
  };
}

test('boothMissionPrompt matches the auto-gen wording', () => {
  assert.equal(boothMissionPrompt('Salt & Lime'), "Get a photo at Salt & Lime's booth");
});

test('isMissionLive requires active AND approved', () => {
  assert.equal(isMissionLive({ is_active: true, approved: true }), true);
  assert.equal(isMissionLive({ is_active: true, approved: false }), false);
  assert.equal(isMissionLive({ is_active: false, approved: true }), false);
});

test('every mission type has a label', () => {
  const types: PapicMissionType[] = [
    'prompt',
    'roster',
    'video_greeting',
    'toast_or_dance',
    'vendor_booth',
    'face_verified',
  ];
  for (const t of types) assert.ok(MISSION_TYPE_LABELS[t], `missing label for ${t}`);
});

test('missionProgress counts completed and flags all-done', () => {
  assert.deepEqual(missionProgress([]), { done: 0, total: 0, allDone: false });
  assert.deepEqual(
    missionProgress([{ completed: true }, { completed: false }, { completed: true }]),
    { done: 2, total: 3, allDone: false },
  );
  assert.deepEqual(missionProgress([{ completed: true }, { completed: true }]), {
    done: 2,
    total: 2,
    allDone: true,
  });
  // an empty set is not "all done" — nothing to celebrate.
  assert.equal(missionProgress([]).allDone, false);
});

test('sortGuestMissions puts not-yet-done first, stable within group', () => {
  const a = guestMission({ mission_id: 'a', completed: false });
  const b = guestMission({ mission_id: 'b', completed: true });
  const c = guestMission({ mission_id: 'c', completed: false });
  const d = guestMission({ mission_id: 'd', completed: true });
  const sorted = sortGuestMissions([b, a, d, c]);
  assert.deepEqual(
    sorted.map((m) => m.mission_id),
    ['a', 'c', 'b', 'd'],
  );
  // pure — input is not mutated.
  assert.deepEqual([b, a, d, c].map((m) => m.mission_id), ['b', 'a', 'd', 'c']);
});

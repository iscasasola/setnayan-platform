import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boothMissionPrompt, isMissionLive, MISSION_TYPE_LABELS } from './papic-missions';
import type { PapicMissionType } from './papic-missions';

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

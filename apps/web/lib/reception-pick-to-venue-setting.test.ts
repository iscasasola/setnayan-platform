/** EXECUTES lib/reception-pick-to-venue-setting.ts and READS the onboarding writer. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECEPTION_PICK_TO_VENUE_SETTING, venueSettingForReceptionPicks } from './reception-pick-to-venue-setting';
import { VENUE_SETTINGS } from './venue-settings';
import { stripComments } from './strip-comments';

test('🔴 an events place is stored as an events place, and a restaurant as a restaurant', () => {
  assert.equal(venueSettingForReceptionPicks(['setting_events_place']), 'events_place');
  assert.equal(venueSettingForReceptionPicks(['setting_restaurant']), 'restaurant');
  assert.notEqual(venueSettingForReceptionPicks(['setting_events_place']), 'banquet_hall');
});

test('no two picks share a value — the collapse that destroyed the data cannot come back', () => {
  const targets = Object.values(RECEPTION_PICK_TO_VENUE_SETTING);
  assert.equal(new Set(targets).size, targets.length, `duplicate targets: ${targets.join(', ')}`);
  for (const t of targets) assert.ok((VENUE_SETTINGS as readonly string[]).includes(t), `${t} is not a legal venue_setting`);
});

test('the first recognised pick wins; no pick, or only unknown picks, falls to the documented ambiguous default', () => {
  assert.equal(venueSettingForReceptionPicks(['setting_beach', 'setting_garden']), 'beach');
  assert.equal(venueSettingForReceptionPicks(['bogus', 'setting_heritage']), 'heritage');
  assert.equal(venueSettingForReceptionPicks([]), 'banquet_hall');
  assert.equal(venueSettingForReceptionPicks(['bogus']), 'banquet_hall');
});

test('🔴 the onboarding writer uses this table and keeps no map of its own', () => {
  const src = stripComments(readFileSync('app/onboarding/wedding/actions.ts', 'utf8'));
  assert.match(src, /venueSettingForReceptionPicks\(/, 'the writer must go through the pure rule');
  assert.doesNotMatch(src, /setting_(events_place|restaurant)\s*:\s*'banquet_hall'/, 'the collapse is back: an events place or a restaurant stored as a hotel ballroom');
  assert.doesNotMatch(src, /RECEPTION_TO_VENUE_SETTING/, 'the old collapsing map is still there');
});

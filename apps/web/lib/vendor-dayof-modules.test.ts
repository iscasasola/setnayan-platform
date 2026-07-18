/**
 * Unit suite for the vendor On-the-Day module registry. Invariants: taxonomy
 * families cover every tile (the ~40 tiles the old resolver dumped into a dead
 * 'general' fallback now resolve), family priority is deterministic, and module
 * resolution respects code defaults + per-booking overrides + availability.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveDayOfFamily,
  familiesForServices,
  resolveModules,
  anyGrantModuleEnabled,
  DAY_OF_MODULES,
} from './vendor-dayof-modules';

test('maps documentary tiles to capture', () => {
  assert.equal(resolveDayOfFamily(['photo_video']), 'capture');
  assert.equal(resolveDayOfFamily(['editorial']), 'capture');
  assert.equal(resolveDayOfFamily(['livestream']), 'capture');
});

test('maps planning tiles to coordinate, program tiles to perform', () => {
  assert.equal(resolveDayOfFamily(['coordinator']), 'coordinate');
  assert.equal(resolveDayOfFamily(['dj']), 'perform');
  assert.equal(resolveDayOfFamily(['live_band']), 'perform');
  assert.equal(resolveDayOfFamily(['host_mc']), 'perform');
});

test('maps feast / booths / prints tiles to serve', () => {
  assert.equal(resolveDayOfFamily(['catering']), 'serve');
  assert.equal(resolveDayOfFamily(['photo_booth']), 'serve');
  assert.equal(resolveDayOfFamily(['souvenir_giveaways']), 'serve');
  assert.equal(resolveDayOfFamily(['mobile_bar']), 'serve');
});

test('the old dead-fallback tiles (venue/design/look/transport) now resolve to setup', () => {
  assert.equal(resolveDayOfFamily(['florist']), 'setup');
  assert.equal(resolveDayOfFamily(['hmua']), 'setup');
  assert.equal(resolveDayOfFamily(['stylist_decorator']), 'setup');
  assert.equal(resolveDayOfFamily(['led_wall']), 'setup');
  assert.equal(resolveDayOfFamily(['bridal_car']), 'setup');
  assert.equal(resolveDayOfFamily(['fireworks']), 'setup');
});

test('applies priority coordinate > capture > serve > perform > setup', () => {
  assert.equal(resolveDayOfFamily(['photo_video', 'coordinator']), 'coordinate');
  assert.equal(resolveDayOfFamily(['dj', 'catering']), 'serve');
  assert.equal(resolveDayOfFamily(['catering', 'photo_video']), 'capture');
});

test('defaults to setup for empty / unknown services', () => {
  assert.equal(resolveDayOfFamily([]), 'setup');
  assert.equal(resolveDayOfFamily(null), 'setup');
  assert.equal(resolveDayOfFamily(['not_a_real_tile']), 'setup');
});

test('narrows to the tiles booked on this event when eventTiles given', () => {
  assert.equal(resolveDayOfFamily(['photo_video', 'florist'], ['florist']), 'setup');
  assert.equal(resolveDayOfFamily(['photo_video', 'florist'], ['photo_video']), 'capture');
});

test('familiesForServices collects every family a multi-tile vendor touches', () => {
  const fams = familiesForServices(['photo_video', 'catering', 'coordinator']);
  assert.equal(fams.has('capture'), true);
  assert.equal(fams.has('serve'), true);
  assert.equal(fams.has('coordinate'), true);
  assert.equal(fams.has('perform'), false);
});

test('resolveModules turns on the capture defaults for a photographer with no override', () => {
  const mods = resolveModules(['photo_video'], null, null);
  const byId = Object.fromEntries(mods.map((m) => [m.id, m]));
  assert.equal(byId.shot_list?.enabled, true);
  assert.equal(byId.run_of_show?.enabled, true);
  assert.equal(byId.vendor_papic?.enabled, true);
  assert.equal(byId.production_sheet?.enabled ?? false, false);
});

test('resolveModules only returns available modules (default-on OR always-available)', () => {
  const mods = resolveModules(['florist'], null, null);
  const ids = mods.map((m) => m.id);
  assert.equal(ids.includes('run_of_show'), true);
  assert.equal(ids.includes('delivery_handover'), true);
  assert.equal(ids.includes('shot_list'), false); // capture-only, not always-available
  assert.equal(ids.includes('production_sheet'), false); // serve-only, not always-available
});

test('an override can switch a default-on module off and an available one on', () => {
  const mods = resolveModules(['photo_video'], null, ['run_of_show', 'shot_list', 'qr_scanner']);
  const byId = Object.fromEntries(mods.map((m) => [m.id, m]));
  assert.equal(byId.shot_list?.enabled, true);
  assert.equal(byId.qr_scanner?.enabled, true);
  assert.equal(byId.vendor_papic?.enabled, false); // not named in override
  assert.equal(byId.pax_headcount?.enabled, false); // omitted from override
});

test('never enables an unavailable module even if the override names it', () => {
  const mods = resolveModules(['florist'], null, ['run_of_show', 'shot_list']);
  const byId = Object.fromEntries(mods.map((m) => [m.id, m]));
  assert.equal(byId.shot_list, undefined);
  assert.equal(byId.run_of_show?.enabled, true);
});

test('anyGrantModuleEnabled drives the access step', () => {
  const coordinator = resolveModules(['coordinator'], null, null);
  assert.equal(anyGrantModuleEnabled(coordinator), true); // issues_log / qr_scanner on
  const djNoGrant = resolveModules(['dj'], null, ['run_of_show', 'setlist', 'review_qr']);
  assert.equal(anyGrantModuleEnabled(djNoGrant), false);
});

test('registry integrity: unique ids, counsel-gated set is exactly papic + guest_delivery', () => {
  const ids = DAY_OF_MODULES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  const gated = DAY_OF_MODULES.filter((m) => m.counselGated)
    .map((m) => m.id)
    .sort();
  assert.deepEqual(gated, ['guest_delivery', 'vendor_papic']);
});

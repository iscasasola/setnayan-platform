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
  // NOT Papic — see the owner ruling pinned below. A photographer gets their
  // shot list and the run of show, not a second camera.
  assert.equal(byId.vendor_papic?.enabled ?? false, false);
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
  // `vendor_papic` is the available-but-off case now: offered to everyone,
  // default-on for nobody. (This test used `qr_scanner` for that role until
  // 2026-08-04, when that module became coordinator-only — a photo/video vendor
  // can no longer switch it on, because the panel behind it never renders for
  // them.)
  const mods = resolveModules(['photo_video'], null, ['run_of_show', 'vendor_papic']);
  const byId = Object.fromEntries(mods.map((m) => [m.id, m]));
  assert.equal(byId.vendor_papic?.enabled, true, 'named in the override → on');
  assert.equal(byId.shot_list?.enabled, false, 'default-on but omitted → off');
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

// ── Papic is not a photographer's tool (owner, 2026-08-04) ──────────────────
test('a photographer does NOT get Papic capture switched on for them', () => {
  // Verbatim: "papic is not used by photographers… it is not a photographer's
  // tool." It used to default ON for the capture family, so a photographer's
  // console arrived with a second camera already running.
  const mods = resolveModules(['photo_video'], null, null);
  const papic = mods.find((m) => m.id === 'vendor_papic');
  assert.ok(papic, 'the module must still be OFFERED — this is opt-in, not removed');
  assert.equal(papic.defaultOn, false, 'it must not be on by default for a photographer');
  assert.equal(papic.enabled, false, 'and it must not arrive enabled');
});

test('Papic capture stays available to any vendor who wants it', () => {
  for (const services of [['photo_video'], ['documentary']]) {
    const papic = resolveModules(services, null, null).find((m) => m.id === 'vendor_papic');
    assert.ok(papic, `must remain offered for ${services[0]}`);
    assert.equal(papic.available, true);
  }
});

test('a vendor who switched Papic on keeps it on', () => {
  // The opt-in has to survive. An override that names the module is authoritative.
  const papic = resolveModules(['photo_video'], null, ['vendor_papic']).find(
    (m) => m.id === 'vendor_papic',
  );
  assert.equal(papic?.enabled, true);
});

// ── A tile must not promise something it cannot do (2026-08-04) ─────────────
// This one was labelled "QR scanner", promised "scan a guest's QR to look them
// up or mark a hand-off", was ON by default for coordinators AND caterers, and
// linked to the generic client page — which has no scanner. Both halves of the
// promise were false for a caterer, and half of it is false for everyone (there
// is no hand-off scan anywhere).

test('the seat scanner is offered only to coordinators — the panel exists for nobody else', () => {
  const forCoordinator = resolveModules(['coordinator'], null, null).find((m) => m.id === 'qr_scanner');
  assert.ok(forCoordinator, 'a coordinator must still be offered it');
  assert.equal(forCoordinator.defaultOn, true);

  for (const services of [['catering'], ['photo_video'], ['florist'], ['music']]) {
    const m = resolveModules(services, null, null).find((x) => x.id === 'qr_scanner');
    assert.equal(m, undefined, `${services[0]} must not be offered a scanner it cannot reach`);
  }
});

test('an override cannot hand the scanner to a family whose panel never renders', () => {
  // resolveModules already refuses to enable an unavailable module; pinned here
  // because `alwaysAvailable: false` is the only thing enforcing it.
  const m = resolveModules(['catering'], null, ['qr_scanner']).find((x) => x.id === 'qr_scanner');
  assert.equal(m, undefined);
});

test('the scanner tile makes no promise the product cannot keep', () => {
  const mod = DAY_OF_MODULES.find((m) => m.id === 'qr_scanner');
  assert.ok(mod);
  assert.ok(
    !/hand-?off/i.test(mod.blurb),
    'no hand-off scan exists for any vendor — do not advertise one',
  );
});

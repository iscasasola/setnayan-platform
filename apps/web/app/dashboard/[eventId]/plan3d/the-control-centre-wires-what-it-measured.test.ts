/**
 * the-control-centre-wires-what-it-measured.test.ts — the last link.
 * The resolvers are honest (lib/plan3d-control.test.ts); an honest resolver
 * reaches the pixels (plan3d-stage-renders.test.ts). Both stay green while the
 * PAGE hands them a lie — `measured: true` typed in place of `!gateRes.error`.
 * SOURCE, because this is a wiring claim.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const page = () => stripComments(readFileSync(resolve(HERE, 'page.tsx'), 'utf8'));
const actions = () => stripComments(readFileSync(resolve(HERE, 'actions.ts'), 'utf8'));

test('each `measured` is the READ\'s own verdict, never a typed-in true', () => {
  const src = page();
  assert.match(src, /const eventRead: Plan3dEventRead = \{\s*measured: !eventRes\.error,/);
  assert.match(src, /const planRead: Plan3dPlanRead = \{\s*measured: !gateRes\.error,/);
  assert.match(src, /const guestRead: Plan3dGuestRead = \{\s*shared: mayReadGuestList,\s*measured: mayReadGuestList && !guestCountRes\?\.error && !avatarCountRes\?\.error,/);
  // the viewer gate, asked BEFORE the reads, and the reads conditioned on it
  assert.match(src, /const mayReadGuestList = !isDelegateWithoutArea\(viewer, 'guest_list'\)/);
  assert.match(src, /const guestCountsPromise = mayReadGuestList\s*\? Promise\.all\(/);
  assert.doesNotMatch(src, /measured:\s*true\b/, 'no measured: true anywhere in the page');
});

test('the published gate is read AGAIN with error awareness, not taken from fetchFloorPlan', () => {
  const src = page();
  assert.match(src, /from\('event_floor_plan'\)\.select\('published_at'\)\.eq\('event_id', eventId\)\.maybeSingle\(\)/);
  assert.match(src, /published: publishedAt != null/);
  assert.doesNotMatch(src, /floorPlan\.published/, 'fetchFloorPlan cannot say it was refused');
});

test('the switch posts the SHIPPED actions — one pair of writers for one column', () => {
  const a = actions();
  assert.match(a, /import \{ publishSeating, unpublishSeating \} from '\.\.\/seating\/actions'/);
  assert.match(a, /await publishSeating\(formData\)/);
  assert.match(a, /await unpublishSeating\(formData\)/);
  assert.doesNotMatch(a, /from\('event_floor_plan'\)/, 'the wrapper must not write the gate itself');
  const src = page();
  assert.match(src, /<form action=\{unpublishFromControlCentre\}/);
  assert.match(src, /<form action=\{publishFromControlCentre\}/);
  assert.match(src, /Taking it down hides the 3D walk\. Printed table signs keep working\./);
});

test('booths are read with the admin brandedReader, and the host gate is the one definition', () => {
  const src = page();
  assert.match(src, /fetchBooths\(supabase, eventId, \{ brandedReader: createAdminClient\(\) \}\)/);
  assert.match(src, /isHostMemberType\(/);
  assert.match(src, /redirect\(`\/dashboard\/\$\{eventId\}`\)/);
});

test('auto-seating is READ from the event, with the editor\'s own default', () => {
  const src = page();
  assert.match(src, /seating_autoplace_enabled'\)/, 'the column is selected');
  assert.match(src, /autoplace: eventRow\?\.seating_autoplace_enabled \?\? true,/);
  assert.doesNotMatch(src, /autoplace:\s*(true|false),/, 'never a typed-in value');
});

test('no finalize gate, no wait, and no promise of "live" updates', () => {
  const src = page();
  assert.doesNotMatch(src, /guestListIsClosed|finalized\b.*publish|publishSeating.*closed/i, 'Publish is never conditioned on the guest list');
  assert.doesNotMatch(src, /updates live|in real time|real-time/i, 'the scene is fetched per request — say "latest", not "live"');
  assert.match(src, /right up to and during the day/, 'the owner\'s rule is on the page');
});

test('no money card: the 3D Plan is free for couples', () => {
  const src = page();
  assert.doesNotMatch(src, /SEATING_3D|InlineCheckoutDrawer|₱|peso\(/);
});

/**
 * live-and-hub-writes-are-honest.test.ts — final check, area 3, batch 4.
 *
 *   E-01 · Hero photo, invitation backdrop, open browsing and the story's last word landed as saved after a refused write.
 *   L-01 · The live controller showed its success banner after a failed write (cut, ★ default, delete channel, …),
 *          and deleting a channel revoked its camera link even when the channel stayed.
 *   L-02 · The live controller read "Off air" when its air reads failed.
 *   L-05 · Live Watch setup said "Saved — guests see Watch Live" after a refused write.
 *
 * RLS refuses an UPDATE or DELETE by matching ZERO rows with no error, so each write now asks for its rows back.
 * 🔒 Source assertions on the comment-stripped files; each was seen red against the old line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const APP = join(process.cwd(), 'app');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

/** The body of `export async function <name>(` up to the next top-level export. */
function fn(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is missing`);
  const next = src.indexOf('\nexport ', start + 1);
  return src.slice(start, next < 0 ? undefined : next);
}

test('E-01 · hero photo: both writes count their rows and go back with the failure line', () => {
  const src = read('dashboard/[eventId]/website/hero-photo/actions.ts');
  assert.match(fn(src, 'uploadHeroPhoto'), /if \(saveError \|\| !savedRows\?\.length\) heroNotSaved\(eventId\);/);
  assert.match(fn(src, 'removeHeroPhoto'), /if \(clearError \|\| !clearedRows\?\.length\) throw new Error\(/);
  assert.match(read('dashboard/[eventId]/website/hero-photo/page.tsx'), /hero === 'not-saved'/);
});

test('E-01 · backdrop and open browsing throw on a refused write; the last word says it did not save', () => {
  const src = read('dashboard/[eventId]/website/editor/actions.ts');
  for (const name of ['saveRsvpBackdrop', 'clearRsvpBackdrop']) {
    assert.match(fn(src, name), /if \([a-zA-Z]+Error \|\| ![a-zA-Z]+Rows\?\.length\) throw new Error\(NOT_SAVED\);/, name);
  }
  assert.match(fn(src, 'setOpenBrowse'), /if \(browseError \|\| !event\) throw new Error\(NOT_SAVED\);/);
  assert.match(read('dashboard/[eventId]/story/actions.ts'), /if \(wordError \|\| !wordRows\?\.length\) \{\s*return \{ ok: false,/);
});

test('L-05 · Live Watch setup: every link write counts its rows; go-live and end say when the Event Hub did not follow', () => {
  const src = read('dashboard/[eventId]/studio/panood/setup/actions.ts');
  for (const name of ['savePanoodWatchUrl', 'savePanoodFacebookUrl', 'clearPanoodFacebookUrl', 'clearPanoodWatchUrl']) {
    assert.match(fn(src, name), /if \(saveError \|\| !savedRows\?\.length\) linkNotSaved\(eventId\);/, name);
  }
  assert.match(fn(src, 'goLivePanood'), /mirrorFailed = Boolean\(mirrorError\) \|\| !mirrored\?\.length;/);
  assert.match(fn(src, 'endPanoodBroadcast'), /if \(clearError \|\| !clearedRows\?\.length\) \{\s*console\.error\([^;]*\);\s*return \{ ok: true, notice:/);
  assert.match(read('dashboard/[eventId]/studio/panood/setup/page.tsx'), /link_not_saved: linkNotSaved/);
});

test('L-01 · the live controller: no success banner after a failed write', () => {
  const src = read('panood/control/[eventId]/actions.ts');
  const checked: Array<[string, RegExp]> = [
    ['cutToMainStage', /if \(cutError \|\| !cutRows\?\.length\)/],
    ['clearMainStage', /if \(clearError\) writeFailed\(eventId\);/],
    ['setFeaturedRoamZone', /if \(featureError \|\| !featuredRows\?\.length\)/],
    ['deleteHighlight', /if \(removeError \|\| !removedMoments\?\.length\) writeFailed\(eventId\);/],
    ['saveControlWatchUrl', /if \(saveError \|\| !savedRows\?\.length\) writeFailed\(eventId\);/],
    ['clearControlWatchUrl', /if \(clearError \|\| !clearedRows\?\.length\) writeFailed\(eventId\);/],
    ['removeEventFilm', /if \(filmError \|\| !removedFilms\?\.length\) writeFailed\(eventId\);/],
    ['saveControlFacebookUrl', /if \(fbError \|\| !fbRows\?\.length\) writeFailed\(eventId\);/],
    ['clearControlFacebookUrl', /if \(fbError \|\| !fbRows\?\.length\) writeFailed\(eventId\);/],
    ['setControlManualAir', /if \(airError \|\| !airRows\?\.length\) writeFailed\(eventId\);/],
    ['clearControlManualAir', /if \(offError \|\| !offRows\?\.length\) writeFailed\(eventId\);/],
    ['endManualOnAir', /if \(offError \|\| !offRows\?\.length\) \{\s*return \{ error:/],
  ];
  for (const [name, re] of checked) assert.match(fn(src, name), re, name);
  // A channel that stays keeps its camera link: the revoke comes only after the delete is proven.
  const del = fn(src, 'deleteRoamZone');
  const proven = del.search(/if \(deleteError \|\| !deletedZones\?\.length\) writeFailed\(eventId\);/);
  const revoke = del.indexOf('revokeChannelCamera(');
  assert.ok(proven > 0 && revoke > proven, 'deleteRoamZone must prove the delete before revoking the camera');
  assert.match(read('panood/control/[eventId]/page.tsx'), /write_error \? <Banner tone="error"/);
});

test('L-02 · a failed air read is never drawn as "Off air"', () => {
  const src = read('panood/control/[eventId]/page.tsx');
  assert.match(src, /const airUnknown = airReadFailed && !isLive;/);
  assert.match(src, /\{isLive \? 'On air' : airUnknown \? 'Not checked' : 'Off air'\}/);
  assert.equal((src.match(/airReadFailed = true;/g) ?? []).length, 2, 'both air reads mark a failure');
});

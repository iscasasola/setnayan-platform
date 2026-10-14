/**
 * GUARD — a guest is told AT CAMERA-OPEN that the credits have run out, so no
 * photo is taken and lost (owner 2026-10-13, "Add all" — tester item 2).
 *
 * Before: the camera learned the pot was empty only from a REFUSED shot (a bare
 * 409), so the guest's first photo after zero was thrown away, under a header
 * that still said "Running low for everyone" over a live shutter.
 *
 * Now: the server reads the pot's STATE once (`GuestQuota.poolEmpty` — a
 * boolean, never a figure: PRIV-1), both camera mounts hand it over, and the
 * camera STARTS in its run-out state: the overlay says so, the shutter rests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

const CAMERA = read('app', 'papic', 'guest', '_components', 'papic-guest-capture.tsx');
const QUOTA = read('lib', 'papic-guest.ts');

test('the server says whether the pot is ALREADY empty — a state, never a figure', () => {
  assert.match(QUOTA, /const poolEmpty = poolApplies && poolRead\.ok && poolRead\.status\.remainingPoints <= 0;/);
  assert.match(QUOTA, /\n\s+poolEmpty,\n/, 'GuestQuota stopped returning poolEmpty');
  // An unread pool is not "empty": it fails open like the rest of the guest gate.
  assert.doesNotMatch(QUOTA, /poolEmpty = [^;]*!poolRead\.ok/);
});

test('both camera mounts hand it over', () => {
  assert.match(read('app', 'papic', 'guest', 'page.tsx'), /poolEmpty=\{quota\.poolEmpty\}/);
  assert.match(read('app', '[slug]', '_lib', 'loaders.ts'), /poolEmpty: quota\.poolEmpty,/);
  assert.match(read('app', '[slug]', '_components', 'site-body.tsx'), /poolEmpty=\{papicGuest\.poolEmpty\}/);
});

test('the camera STARTS run out — before a shot, not after a refused one', () => {
  assert.match(CAMERA, /useState\(poolEmptyAtOpen\)/, 'the camera no longer starts from the server\'s answer');
  // …and run out means the shutter rests: every capture guard reads `exhausted`,
  // which `poolEmpty` feeds.
  assert.match(CAMERA, /const exhausted = capExhausted \|\| poolEmpty;/);
  assert.match(CAMERA, /if \(busy \|\| !ready \|\| switching \|\| exhausted/);
});

test('the guest is told in the owner\'s words, in credits, and "running low" stays quiet', () => {
  // Said ONCE — over the viewfinder; the caption under it no longer repeats it (walk-b6 guest F2).
  assert.equal((CAMERA.match(/credits have run out — the hosts can add more/g) ?? []).length, 1, 'the run-out sentence is said twice again');
  assert.match(CAMERA, /\{exhausted && poolEmpty \? null : \(/, 'the caption speaks over the run-out sentence again');
  assert.match(CAMERA, /: poolEmpty \? null\s*: poolLow \? \(/, 'at zero the "Running low for everyone" pill would be false');
});

/**
 * THE FACE STEP WAITS FOR THE CAMERA — owner, 2026-09-21:
 *   "so many text. we want the event hub to be minimalist"
 *   "should be a pop up on their first click on the camera"
 *   "not a static widget on event hub"
 *
 * Three properties, each executed against the source:
 *   1. no guest page mounts the face card as a static block;
 *   2. the camera opens it ONCE, right after its terms are accepted;
 *   3. it stays SKIPPABLE and is never a condition of the camera — biometric
 *      consent under RA 10173 must be freely given.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CAMERA = 'app/papic/guest/_components/papic-guest-capture.tsx';

test('no guest page mounts the face card as a static block', () => {
  const root = join(WEB, 'app', '[slug]');
  const offenders: string[] = [];
  let scanned = 0;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx$/.test(name) && !/\.test\./.test(name) && name !== 'day-of-face-enroll.tsx') {
        scanned += 1;
        if (/<DayOfFaceEnroll\b/.test(stripComments(readFileSync(full, 'utf8')))) {
          offenders.push(full.slice(WEB.length + 1));
        }
      }
    }
  };
  walk(root);
  assert.ok(scanned >= 100, `the sweep read only ${scanned} files — it is not sweeping`);
  assert.deepEqual(offenders, [], 'a guest page mounts the face card as a static widget');
});

test('the camera opens the face step once, right after its terms are accepted', () => {
  const src = read(CAMERA);
  const accepted = src.indexOf('setAccepted(true)');
  assert.ok(accepted > 0, 'precondition: found the terms acceptance');
  // Bounded by the NEXT statement block (`} catch`), not a character count: the
  // shared stripper blanks comments to whitespace, so a fixed-width window
  // lands in the blank where the explanation used to be.
  const end = src.indexOf('} catch', accepted);
  assert.ok(end > accepted, 'precondition: found the end of the accept block');
  const after = src.slice(accepted, end);
  assert.match(
    after,
    /if \(needsFaceEnroll && !enrolled\) setEnrolling\(true\)/,
    'the face step opens on the first click, and only for a guest who still needs it',
  );
});

test('the terms land FIRST — the face step is never a condition of the camera', () => {
  const src = read(CAMERA);
  const accepted = src.indexOf('setAccepted(true)');
  const enrolling = src.indexOf('setEnrolling(true)', accepted);
  assert.ok(accepted > 0 && enrolling > accepted, 'acceptance is recorded before the face step opens');
});

test('the camera’s face step stays skippable', () => {
  const src = read(CAMERA);
  const mount = src.slice(src.indexOf('<DayOfFaceEnroll'));
  const props = mount.slice(0, mount.indexOf('/>'));
  assert.match(props, /onSkip=/, 'a guest can decline and still shoot — freely given');
});

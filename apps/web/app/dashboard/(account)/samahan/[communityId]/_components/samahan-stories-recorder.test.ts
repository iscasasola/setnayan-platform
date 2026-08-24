/**
 * samahan-stories-recorder.test.ts — the story composer is a CAMERA, not an
 * upload (owner 2026-08-24: "it should be record your 3 seconds. then
 * compress it"). Source-shape pins, comments stripped first so a note naming
 * a rule cannot satisfy it:
 *
 *   1. Three seconds, hard: RECORD_MS is 3000 and the recorder schedules its
 *      own auto-stop from it.
 *   2. The share button OPENS THE CAMERA — the file picker survives only as
 *      the fallback inside openCamera, never as the button's own action.
 *   3. Closing mid-record ABANDONS the take (onstop detached before stop) —
 *      without that, dismissing the sheet would post a clip the person just
 *      decided not to share.
 *   4. What posts is the COMPRESSED copy: the recording goes through
 *      compressVideoForWeb before the form is built.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const src = fs
  .readFileSync(path.join(__dirname, 'samahan-stories.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

test('three seconds, hard — RECORD_MS = 3000 wired to the auto-stop', () => {
  assert.match(src, /const RECORD_MS = 3000/, 'the three-second constant');
  assert.match(
    src,
    /setTimeout\(stopRecording, RECORD_MS\)/,
    'the recorder must stop ITSELF at RECORD_MS',
  );
});

test('the share button opens the camera; the picker is only the inside-fallback', () => {
  const buttonOpens = [...src.matchAll(/onClick=\{\(\) => void openCamera\(\)\}/g)];
  assert.equal(buttonOpens.length, 1, 'exactly one share button, and it opens the camera');
  const pickerClicks = [...src.matchAll(/fallbackInputRef\.current\?\.click\(\)/g)];
  assert.equal(
    pickerClicks.length,
    2,
    'the picker fires only from openCamera (no-API + refused arms)',
  );
});

test('closing mid-record abandons the take', () => {
  const close = src.slice(src.indexOf('const closeCamera'), src.indexOf('const openCamera'));
  const detach = close.indexOf('rec.onstop = null');
  const stop = close.indexOf('rec.stop()');
  assert.ok(detach !== -1 && stop !== -1 && detach < stop, 'onstop detached BEFORE stop');
});

test('the compressed copy is what posts', () => {
  const post = src.slice(src.indexOf('const postClip'), src.indexOf('const stopRecording'));
  const compress = post.indexOf('compressVideoForWeb');
  const append = post.indexOf("form.append('clip'");
  assert.ok(compress !== -1 && append !== -1 && compress < append, 'compress before the form');
  assert.match(post, /form\.append\('clip', web/, 'the WEB copy is appended, not the raw take');
});

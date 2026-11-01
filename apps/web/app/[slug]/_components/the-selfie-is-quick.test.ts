/**
 * ⚡ THE SELFIE AND THE FIRST PHOTO DO NOT WAIT FOR A DOWNLOAD (owner 2026-10-30: *"take selfie face circle is too small
 * and registering the selfie is taking too long … almost 2 minutes"* · *"sending photos after taking picture takes so
 * long"*).
 *
 * The face detector and face-api.js (~12 MB of weights) used to start downloading on the press — under the selfie, and
 * under the first Papic photo's face pass on a mode_a event. They now load when the screen opens; the press works on a
 * copy at most `SELFIE_MAX_SIDE` long; the oval is the size of a face held at arm's length.
 *
 * SABOTAGE, each seen red before this shipped:
 *   1  drop the selfie screen's warm-up effect         → "the selfie screen does not load the models early"
 *   2  work on the full camera frame again             → "the selfie is read at full size"
 *   3  shrink the oval back to 58% / 13.5rem            → "the oval is small again"
 *   4  drop the guest camera's mode_a warm-up           → "the guest camera's first photo waits for the models"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const SELFIE = code('app/[slug]/_components/selfie-capture.tsx');
const GUEST = code('app/papic/guest/_components/papic-guest-capture.tsx');
const SEAT = code('app/papic/seat/[token]/_components/papic-seat-capture.tsx');

test('the selfie screen loads the detector (and, on mode_a, face-api) when it opens', () => {
  assert.match(
    SELFIE,
    /useEffect\(\(\) => \{\s*void import\('@\/lib\/face-gate'\)\.then\(\(m\) => m\.warmFaceGate\(\)\)\.catch\(\(\) => \{\}\);\s*if \(faceMode === 'mode_a'\) void import\('@\/lib\/face-embed'\)\.then\(\(m\) => m\.warmFaceEmbed\(\)\)\.catch\(\(\) => \{\}\);\s*\}, \[faceMode\]\);/,
    'the selfie screen does not load the models early',
  );
  // The camera still waits for the tick — warming is a download, not a photo.
  assert.equal((SELFIE.match(/getUserMedia\(/g) ?? []).length, 1);
});

test('the press works on a copy at most SELFIE_MAX_SIDE long', async () => {
  const { SELFIE_MAX_SIDE } = await import('./selfie-capture');
  assert.ok(SELFIE_MAX_SIDE <= 800 && SELFIE_MAX_SIDE >= 480, `SELFIE_MAX_SIDE is ${SELFIE_MAX_SIDE}`);
  assert.match(SELFIE, /const scale = Math\.min\(1, SELFIE_MAX_SIDE \/ Math\.max\(video\.videoWidth, video\.videoHeight\)\);/);
  assert.match(SELFIE, /canvas\.width = Math\.round\(video\.videoWidth \* scale\);/, 'the selfie is read at full size');
  assert.doesNotMatch(SELFIE, /canvas\.width = video\.videoWidth;/, 'the selfie is read at full size');
});

test('the oval is the size of a face held at arm’s length', () => {
  const m = SELFIE.match(/aspect-\[3\/4\] w-\[(\d+)%\] max-w-\[([\d.]+)rem\] rounded-\[50%\]/);
  assert.ok(m, 'the oval was not found');
  assert.ok(Number(m[1]) >= 70 && Number(m[2]) >= 17, `the oval is small again (${m[1]}% · ${m[2]}rem)`);
});

test('both Papic cameras load face-api while they open on a mode_a event', () => {
  const warm = /useEffect\(\(\) => \{\s*if \(faceMode !== 'mode_a'\) return;\s*void import\('@\/lib\/face-embed'\)\.then\(\(m\) => m\.warmFaceEmbed\(\)\)\.catch\(\(\) => \{\}\);\s*\}, \[faceMode\]\);/;
  assert.match(GUEST, warm, 'the guest camera’s first photo waits for the models');
  assert.match(SEAT, warm, 'the seat camera’s first photo waits for the models');
});

// ── 🔒 a selfie that cannot be read is never saved · 👥 a background face does not refuse · 📐 a photo keeps the box ──
const ENROLL = code('app/papic/face-enroll-actions.ts');
const GATE = code('lib/face-gate.ts');

test('a mode_a selfie with no fingerprint is refused — on the phone AND on the server, before the old one is retired', () => {
  assert.match(
    SELFIE,
    /if \(!vector && isFaceModelConfigured\(\)\) \{\s*onFail\(faceStepFailureWords\(unloaded \? 'save' : 'face_unread'\)\);\s*return;\s*\}/,
    'the phone saves a selfie it could not read',
  );
  // The small copy misses a face held further off → the full frame is read once more before giving up — unless the
  // reader never downloaded, which is "connection lost", never "your face wasn't clear".
  assert.match(SELFIE, /if \(faceMode === 'mode_a' && !r && scale < 1 && !unloaded\) \{/);
  assert.match(SELFIE, /unloaded = faceEmbedDidNotLoad\(\);/, 'a reader that never loaded is blamed on the guest’s face');
  const guard = ENROLL.indexOf("return { ok: false, reason: 'face_unread' };");
  const retire = ENROLL.indexOf(".update({ revoked_at: new Date().toISOString() })");
  assert.ok(guard > 0, 'the server saves a mode_a selfie with no fingerprint');
  assert.ok(retire > guard, 'the old enrolment is retired before the new one is known to match');
  assert.match(ENROLL, /faceTagging\.mode === 'mode_a' &&\s*isFaceModelConfigured\(\) &&\s*shots\.every\(\(s\) => s\.vector == null\)/);
});

test('a save that fails after the old enrolment was retired puts the old one back', () => {
  // The unique index forces retire-then-insert; the retired ids are kept and restored when the insert errors.
  assert.match(ENROLL, /\.is\('revoked_at', null\)\s*\.select\('id'\);/, 'the retired rows are not remembered');
  const restore = ENROLL.search(/if \(error && retiredIds\.length > 0\) \{\s*const \{ error: restoreErr \} = await admin\s*\.from\('guest_face_enrollments'\)\s*\.update\(\{ revoked_at: null \}\)\s*\.in\('id', retiredIds\);/);
  assert.ok(restore > 0, 'a failed save leaves the guest with no fingerprint at all');
  assert.ok(restore < ENROLL.indexOf("return error ? { ok: false, reason: 'save' } : { ok: true };"), 'the restore runs after the answer is sent');
});

test('a face in the background does not refuse a selfie; two people in the oval still do', () => {
  assert.match(GATE, /const crowded = faceCount > 1 && secondArea >= largestArea \* SECOND_FACE_RATIO;/);
  assert.match(GATE, /\} else if \(crowded\) \{\s*ok = false;\s*reasonCode = 'many_faces';/);
  assert.doesNotMatch(GATE, /\} else if \(faceCount > 1\) \{/, 'any second face refuses the selfie again');
});

test('both cameras keep the one 9:16 frame the viewfinder shows; a clip shows the whole frame it records', () => {
  // The photo: the 9:16 centre of the frame (at the guest camera's digital 2× too) — lib/papic-viewfinder-crop.ts.
  assert.match(GUEST, /papicFrameCrop\(\{ width: w, height: h \}, crop\)/);
  assert.match(GUEST, /ctx\.drawImage\(video, sx, sy, sw, sh, 0, 0, sw, sh\);/);
  assert.match(SEAT, /styled \? papicFrameCrop\(\{ width: w, height: h \}\) : \{ sx: 0, sy: 0, sw: w, sh: h \}/);
  assert.doesNotMatch(GUEST + SEAT, /viewfinderCrop|getBoundingClientRect\(\)[^;]*\bcrop\b/, 'a photo is cut to the screen box again');
  // The picture: a 9:16 box (16:9 sideways), the camera object-cover inside it — the same region.
  for (const [name, src] of [['guest', GUEST], ['seat', SEAT]] as const) {
    assert.match(src, /aspectRatio: frameSideways \? '16 \/ 9' : '9 \/ 16'/, `${name}: the picture is not the 9:16 frame`);
    assert.match(src, /data-camera-frame=\{frameSideways \? '16:9' : '9:16'\}/);
  }
  assert.match(GUEST, /mode === 'snippet' \|\| recording \? 'object-contain' : 'object-cover'/);
  assert.match(SEAT, /recording \? 'object-contain' : 'object-cover'/);
});

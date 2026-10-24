/**
 * GUARD — Papic's window is AUTOMATIC, and no screen asks for dates (owner
 * 2026-10-13, DECISION_LOG 📸: "automatic 6 months prior to the event").
 *
 * The 6-month default already existed (`resolveStoredWindow`), yet the Papic
 * page opened on "Do this first · When can your cameras shoot? — Nothing can be
 * captured until you pick the days", the library said "Cameras — set the dates",
 * the crew row "Waiting for dates" and the picker "1 day of capture" — all false
 * for a couple who never opened the sheet (tester 2026-10-13, shots 01/05/12).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const PAPIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'dashboard', '[eventId]', 'studio', 'papic');
const read = (...p: string[]) => stripComments(readFileSync(join(PAPIC, ...p), 'utf8'));
const SURFACES = {
  page: read('page.tsx'),
  // 📷 The dates live in the camera settings since 2026-10-23 — the one component the Papic page and Home's Papic
  // card both draw (`PapicCameraSettings`).
  settings: read('_components', 'papic-camera-settings.tsx'),
  // (the dark stage, `papic-stage.tsx`, deleted 2026-10-24 — unmounted once the library moved to Memories; Home's
  // Papic card says the window in `lib/papic-home-card.ts`)
  card: stripComments(readFileSync(join(PAPIC, '..', '..', '..', '..', '..', 'lib', 'papic-home-card.ts'), 'utf8')),
  picker: read('papic-window-picker.tsx'),
};

const FALSE_WORDS = [
  /Do this first/,
  /When can your cameras shoot\?/,
  /Nothing can be captured until you pick/,
  /set the dates/i,
  /Waiting for dates/,
];

for (const [name, src] of Object.entries(SURFACES)) {
  test(`${name}: never asks for dates the cameras already have`, () => {
    for (const w of FALSE_WORDS) assert.doesNotMatch(src, w, `${name} says "${w.source}" again`);
  });
}

test('the window is said in words, from the saved window or the automatic one', () => {
  assert.match(SURFACES.settings, /formatPapicDayInWords\(win\.startDate\)/);
  assert.match(SURFACES.settings, /`Papic turns on \$\{on\}` : 'Open now'/);
  assert.match(SURFACES.settings, /papicSpanWords\(/, 'the dates are not said from the window (saved or automatic)');
  assert.match(SURFACES.settings, /sheetTitle="Change dates"/, 'the dates open the shipped picker behind a quiet "Change dates"');
});

test('the picker opens on the automatic window — never on "1 day of capture"', () => {
  assert.match(SURFACES.picker, /anchor \? earliestCaptureDate\(anchor\) : ''/);
});

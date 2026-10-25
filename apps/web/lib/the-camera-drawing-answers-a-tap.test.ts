import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 📷 A tap on the Camera page's drawing picks the Camera, as a tap on the Reveal's does (the stand-in carries no Maker marker, so it sent nothing). */
const SRC = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'stage-tools.tsx'), 'utf8');

test('stage-tools binds the Camera stand-in to pick the camera', () => {
  assert.match(SRC, /\[data-maker-page-stand-in="camera"\]/);
  assert.match(SRC, /pickRef\.current\('camera'\)/);
});

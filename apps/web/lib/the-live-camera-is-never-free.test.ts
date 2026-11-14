/**
 * the-live-camera-is-never-free.test.ts — 🔒 no live-stream line calls the camera "free".
 *
 * Owner ruling (flagged 10 Nov 2026 on "Live stream says '1 camera free'"): never print "free" for the live-stream
 * camera. The single camera is INCLUDED; the multicam control room is the add-on. Papic is a different product —
 * its credits and cameras are not held here.
 *
 * Reads every file that prints a Live Watch / livestream line (comments stripped — a comment is not printed) and
 * fails on "one / 1 / single camera … free" or "free … single / one / 1 camera" within one sentence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PUBLIC_HELP_SOURCES } from '@/lib/help-sources.test-helper';

const WEB = join(__dirname, '..');
const FILES = [
  'app/page.tsx',
  'app/_components/iap/iap-live-watch-sheet.tsx',
  'app/dashboard/[eventId]/studio/live-studio-control/page.tsx',
  'app/dashboard/[eventId]/studio/panood/setup/page.tsx',
  'app/(shell)/about/page.tsx',
  'app/(shell)/privacy/page.tsx',
  'app/panood/control/[eventId]/page.tsx',
  'app/dev/home-lab/page.tsx',
  'lib/home-first-screen.ts',
  'lib/iap/where-bought.ts',
  'lib/add-ons-catalog.ts',
  'lib/encoder/program-strings.ts',
  ...PUBLIC_HELP_SOURCES, // help split 2026-11-14: lib/help.ts + every lib/help/*.ts
  'lib/llms-txt.ts',
];

const FREE_CAMERA = [
  /\b(?:1|one|single)[- ]camera[^.;'"`\n]{0,40}\bfree\b/,
  /\bfree\b[^.;'"`\n]{0,40}\b(?:1|one|single)[- ]camera\b/,
  /\bcameras? (?:is |are )?free\b/,
];

for (const rel of FILES) {
  test(`${rel}: the live-stream camera is never called free`, () => {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8')).replace(/\s+/g, ' ');
    for (const re of FREE_CAMERA) {
      for (const m of src.matchAll(new RegExp(re.source, 'gi'))) {
        // Papic is a different product, and "Cameras are free and unlimited" is its own line (help.ts, the Papic
        // page; "Cameras are free and you can make as many as you like") — the guest phones that shoot from credits, not the live-stream camera.
        if (/^cameras are free$/i.test(m[0]) && /^ and (?:unlimited|you can make)/i.test(src.slice((m.index ?? 0) + m[0].length))) continue;
        assert.fail(`${rel} prints "${m[0]}" — say "included", never "free", for the live-stream camera`);
      }
    }
  });
}

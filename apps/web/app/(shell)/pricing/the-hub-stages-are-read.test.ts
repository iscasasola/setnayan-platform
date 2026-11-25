/**
 * the-hub-stages-are-read.test.ts: /pricing names the Event Hub's stages from the Maker's own list, never typed.
 *
 * The typed line said "all five stages: Save-the-Date, RSVP, the day, Memories, Post Event". Memories is not a stage,
 * and the Invitation was missing. The stages are `MAKER_PAGE_STAGES` (Save the Date · RSVP · Invitation · The Day ·
 * Post Event), so the page reads them from there.
 *
 * SABOTAGE (run 2026-11-24): the old typed line restored → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { MAKER_PAGE_STAGES, makerStageLabel } from '@/app/dashboard/[eventId]/launch/_components/maker-bar';

const PAGE = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

test('/pricing reads the stage count and names from MAKER_PAGE_STAGES', () => {
  assert.match(PAGE, /MAKER_PAGE_STAGES\.length\} stages/, 'the stage count is read');
  assert.match(PAGE, /MAKER_PAGE_STAGES\.map\(makerStageLabel\)/, 'the stage names are read');
  assert.doesNotMatch(PAGE, /\b(?:four|five|six|[3-6]) stages\b/i, 'a typed stage count');
  assert.doesNotMatch(PAGE, /the day, Memories/i, 'Memories is not a stage');
});

test('the stage list /pricing reads names the Invitation and never Memories', () => {
  const names = MAKER_PAGE_STAGES.map(makerStageLabel);
  assert.ok(names.includes('Invitation'));
  assert.ok(!names.some((n) => /memories/i.test(n)));
});

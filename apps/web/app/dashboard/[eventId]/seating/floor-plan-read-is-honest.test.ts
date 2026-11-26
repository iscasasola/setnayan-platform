/**
 * A7-10 (final check 25 Nov): the couple's 2D seat plan never draws a REFUSED floor-plan or signs read as their room.
 * It reads the measured forms (`fetchFloorPlanMeasured`, `fetchSignsMeasured`) and stops on `measured: false` with the
 * refused-read notice — the same rule the guest read already follows. The plain forms return the defaults / [] on an
 * error, so they are banned here. (`seating/lab/page.tsx` is lane R5 in the final check: not edited, not held here.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

for (const [name, rel, reads] of [['the 2D seat plan', 'page.tsx', ['floorPlanRead', 'signsRead']]] as const) {
  test(`${name} reads the floor plan measured and stops on a refusal`, () => {
    const src = read(rel);
    assert.doesNotMatch(src, /\bfetchFloorPlan\(/, 'the plain floor-plan read returns the default room on an error');
    assert.doesNotMatch(src, /\bfetchSigns\(/, 'the plain signs read returns [] on an error');
    for (const r of reads) assert.match(src, new RegExp(`!${r}\\.measured`), `${r} is never checked`);
    assert.match(src, /<ReadRefusedNotice what="your floor plan" \/>/);
  });
}

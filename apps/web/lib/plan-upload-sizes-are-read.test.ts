import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { coupleMediaCapBytes, formatMakerMediaMB } from '@/lib/maker-media-limits';
import { stripComments } from '@/lib/strip-comments';

/**
 * 📦 THE PLAN PAGES NEVER TYPE AN UPLOAD SIZE (review of #7978, 19 Nov 2026).
 *
 * The couple's upload allowance per plan lives in ONE place — `MAKER_EVENT_MEDIA_BYTES_CAP` read through
 * `coupleMediaCapBytes(plan)` — and the upload reservation enforces that number. The plan cards, the /pricing rows and the
 * plan quiz used to type "500 MB / 1 GB / 2 GB" by hand: the day the cap moves, the pages would sell one size while the
 * upload enforces another. So every size these files show is `formatMakerMediaMB(coupleMediaCapBytes(plan))`.
 *
 * SABOTAGE (each turns this red): type "1 GB of uploads" back into a Pro line · type "500 MB" into the quiz's Plus tip ·
 * drop the read from one of the files below.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, '..', rel), 'utf8');

/** Every file that tells a buyer how much a plan uploads. Add a file here when it starts saying a plan's size. */
const PLAN_COPY = [
  'lib/features-page.ts',
  'app/_components/frontdoor/front-door-landing-data.ts',
  'app/(shell)/pricing/page.tsx',
  'app/(shell)/pricing/plan/_plan-steps.ts',
] as const;

/** The code without its comments — a comment may cite the ruling ("Plus 500 MB · Pro 1 GB"); copy may not type it. */
const code = (src: string): string => stripComments(src);

const TYPED_SIZE = /\b\d[\d,.]*\s?(?:KB|MB|GB|TB)\b/g;

test('no plan page types an upload size by hand', () => {
  for (const rel of PLAN_COPY) {
    const typed = code(read(rel)).match(TYPED_SIZE) ?? [];
    assert.deepEqual(typed, [], `${rel} types an upload size — use formatMakerMediaMB(coupleMediaCapBytes(plan))`);
  }
});

test('each plan page reads the size from the one cap function', () => {
  for (const rel of PLAN_COPY) {
    assert.match(
      code(read(rel)),
      /formatMakerMediaMB\(coupleMediaCapBytes\('(?:plus|pro|ultra)'\)\)/,
      `${rel} no longer reads the plan's upload size`,
    );
  }
});

test('the read gives the ruled sizes (owner 2026-11-18): Plus 500 MB · Pro 1 GB · Ultra 2 GB', () => {
  assert.equal(formatMakerMediaMB(coupleMediaCapBytes('plus')), '500 MB');
  assert.equal(formatMakerMediaMB(coupleMediaCapBytes('pro')), '1 GB');
  assert.equal(formatMakerMediaMB(coupleMediaCapBytes('ultra')), '2 GB');
});

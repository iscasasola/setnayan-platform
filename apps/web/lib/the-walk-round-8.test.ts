/**
 * 🚶 ROUND 8 — W1's re-walk at d03399f (14 Nov 2026). Each test names the walk row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { coverMoment } from './guests-arrive';
import { DEFAULT_CHAPTER_LABELS } from './schedule';

const code = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

const block = (o: Partial<Parameters<typeof coverMoment>[0][number]> & { block_id: string; label: string; start_at: string }) => ({
  block_type: 'ceremony',
  end_at: null,
  is_public: true,
  sort_order: 10,
  parent_block_id: null,
  audience: null,
  visibility: null,
  time_tba: false,
  ...o,
});

test('F-W2-40 · the cover shows the event’s own first moment, never the Prep chapter', () => {
  const prep = block({ block_id: 'p', label: DEFAULT_CHAPTER_LABELS.prep, block_type: 'pre_ceremony', start_at: '2026-12-19T07:00:00+08:00', sort_order: 50 });
  const ceremony = block({ block_id: 'c', label: 'Ceremony', start_at: '2026-12-19T13:30:00+08:00', sort_order: 60 });
  assert.equal(coverMoment([prep, ceremony])?.label, 'Ceremony');
  // A private block and a crew-only block are never the cover's either.
  const privateEarly = block({ block_id: 'x', label: 'Hair and make-up', is_public: false, start_at: '2026-12-19T06:00:00+08:00' });
  const crew = block({ block_id: 'y', label: 'Load-in', visibility: 'coordinator_only', start_at: '2026-12-19T06:30:00+08:00' });
  assert.equal(coverMoment([privateEarly, crew, prep, ceremony])?.label, 'Ceremony');
  // A moment INSIDE a chapter that happens to be called Prep is not the chapter — only the top-level one is skipped.
  const arrive = block({ block_id: 'a', label: 'Guests arrive', block_type: 'pre_ceremony', start_at: '2026-12-19T13:00:00+08:00' });
  assert.equal(coverMoment([prep, arrive, ceremony])?.label, 'Guests arrive');
  // Only a Prep chapter on the programme: no time on the cover (never the prep hour).
  assert.equal(coverMoment([prep]), null);
  // The Hub's cover reads it.
  const body = code('app/[slug]/_components/site-body.tsx');
  assert.match(body, /const coverAt = coverMoment\(scheduleBlocks\);/);
  assert.match(body, /firstStartAt: coverAt\?\.start_at \?\? null,\s*firstLabel: coverAt\?\.label \?\? null,/);
  assert.doesNotMatch(body, /firstLabel: scheduleBlocks\[0\]/);
});

test('F-W1-61 · admin prints a stored moment in Manila time, never the server’s UTC', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(process.cwd(), dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(process.cwd(), rel)).isDirectory()) walk(rel);
      else if (rel.endsWith('.tsx') && !rel.endsWith('.test.tsx')) {
        const src = code(rel);
        for (const m of src.matchAll(/new Date\((?:[^()]|\([^()]*\))*\)\.toLocale(?:String|DateString|TimeString)\(([^)]*)\)/g)) {
          // A call that names its zone on purpose (`timeZone: 'UTC'` on a bare day key) is left as it is.
          if (!/timeZone:/.test(m[1]!)) offenders.push(`${rel}: ${m[0].slice(0, 80)}`);
        }
      }
    }
  };
  walk('app/admin');
  assert.deepEqual(offenders, [], 'an admin page prints a stored time without Manila');
  assert.match(code('app/admin/verify/page.tsx'), /Submitted\{' '\}\s*\{new Date\(application\.submitted_at\)\.toLocaleString\('en-PH', \{ timeZone: 'Asia\/Manila' \}\)\}/);
});

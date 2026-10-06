import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEntourage } from '@/lib/entourage';
import { marchSections, printedSectionOrder } from '@/lib/march-sections';
import { keyTarget, leadOf, planMove, type MarchSource, type MarchTarget } from '@/lib/march-drag';
import { ownerShapedMarch } from '@/lib/march-owner-shape.fixture';

const groups = () => buildEntourage(ownerShapedMarch(), null, {}, 'surname-first', { march: true });

test('the owner-shaped march: ~80 walking, names in Surname-first style', () => {
  const sections = marchSections(groups());
  const people = sections.reduce((n, s) => n + s.rows.reduce((k, r) => k + (r[0] ? 1 : 0) + (r[1] ? 1 : 0), 0), 0);
  const walks = sections.reduce((n, s) => n + s.rows.length, 0);
  assert.ok(people >= 75 && people <= 85, `people ${people}`);
  assert.ok(walks >= 40 && walks <= 60, `walks ${walks}`);
  assert.ok(sections.flatMap((s) => s.rows.flat()).some((p) => p?.name.includes('Sacdalan-Casasola,')), 'a hyphenated surname-first name');
});

test('every drag the maker can draw on that march plans without throwing', () => {
  const sections = marchSections(groups());
  const printed = printedSectionOrder(groups(), null);
  const sources: MarchSource[] = [];
  const targets: MarchTarget[] = [];
  for (const s of sections) {
    sources.push({ kind: 'section', key: s.key });
    targets.push({ kind: 'section', key: s.key });
    for (let i = 0; i <= s.rows.length; i++) targets.push({ kind: 'gap', section: s.key, index: i });
    for (const row of s.rows) {
      sources.push({ kind: 'walk', section: s.key, lead: leadOf(row) });
      for (const p of row) {
        if (!p) continue;
        sources.push({ kind: 'name', id: p.id });
        targets.push({ kind: 'name', id: p.id });
        if (!row[0] || !row[1]) targets.push({ kind: 'beside', anchor: p.id });
      }
    }
  }
  let planned = 0;
  for (const src of sources) {
    for (const dir of [-1, 1] as const) keyTarget(sections, src, dir);
    for (const t of targets) {
      const plan = planMove(sections, printed, src, t);
      if (plan?.ok) {
        planned++;
        // What the drop draws at once must itself be a march the maker can draw again.
        for (const sec of plan.sections) for (const row of sec.rows) assert.ok(row[0] || row[1], 'never an empty walk');
      }
    }
  }
  assert.ok(planned > 1000, `planned ${planned}`);
});

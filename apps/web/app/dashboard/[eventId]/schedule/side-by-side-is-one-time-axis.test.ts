/**
 * side-by-side-is-one-time-axis.test.ts — 🧭 event chapters slice 9, SIDE BY SIDE (owner-approved brief
 * SCHEDULE_SLICES_8_10_BRIEF_2026-11-05; the plan's "People by time").
 *
 *   1 · "Suppliers by time" IS Side by side — renamed in View as, one view, never a second;
 *   2 · one shared axis: a column per supplier, then the Host/MC and the couple; chapter bands behind every column;
 *       one day only (a chapter on another day is not stretched onto it);
 *   3 · a backstage block is dashed; a clash (one column, two places, one time) is flagged "Two places at once";
 *   4 · By person · By chapter · By role regroup the columns; any ONE person can be shown alone;
 *   5 · the screen: times pinned left, heads pinned on top, "Now" across every column, phone ≈ 2.5 columns, tablet ≈ 5,
 *       desktop every column; a Time-TBA chapter's suppliers are listed, never hidden.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { LAB_SCHEDULE_CHAPTERS } from '@/app/dev/chapters-lab/lab-chapters';
import { labViewAs } from '@/app/dev/chapters-lab/lab-view-as';
import { lensWords, viewAsOptions } from '@/lib/schedule-view-as';
import { sideBySide } from '@/lib/side-by-side';
import { columnWidth } from './_components/side-by-side';

const DIR = dirname(fileURLToPath(import.meta.url));
const code = (f: string) => stripComments(readFileSync(join(DIR, f), 'utf8'));
const DATA = labViewAs(true).data;
const host = new Set(DATA.suppliers.filter((s) => s.host).map((s) => s.vendor_id));

test('1 · Suppliers by time is Side by side — one view', () => {
  const labels = viewAsOptions(DATA).map((o) => o.label);
  assert.ok(labels.includes('Side by side'));
  assert.ok(!labels.includes('Suppliers by time'), 'the old name is still a view of its own');
  assert.equal(lensWords(DATA, { kind: 'suptime' }), 'Side by side');
});

test('2 · one axis: suppliers, then the Host/MC, then the couple; bands; one day', () => {
  const s = sideBySide({ chapters: LAB_SCHEDULE_CHAPTERS, data: DATA, grouping: 'person', hostIds: host });
  const kinds = s.columns.map((c) => c.kind);
  assert.ok(kinds.includes('supplier') && kinds.includes('host') && kinds.includes('couple'), `columns: ${kinds.join(',')}`);
  const order = { supplier: 0, coordinator: 1, host: 2, couple: 3, role: 4 } as const;
  for (let i = 1; i < kinds.length; i++) assert.ok(order[kinds[i - 1]!] <= order[kinds[i]!], 'the columns are out of order');
  assert.ok(s.bands.length >= 3, 'no chapter bands behind the columns');
  assert.ok(s.endMs - s.startMs <= 24 * 3_600_000, 'the axis spans more than one day');
  assert.ok(s.otherDays.length > 0, 'the lab’s chapter on another day was stretched onto the axis');
  // No column holds a block outside the axis.
  for (const c of s.columns) for (const b of c.blocks) assert.ok(b.startMs >= s.startMs && b.endMs <= s.endMs);
});

test('3 · backstage is dashed and a clash is flagged', () => {
  const s = sideBySide({ chapters: LAB_SCHEDULE_CHAPTERS, data: DATA, grouping: 'person', hostIds: host });
  const blocks = s.columns.flatMap((c) => c.blocks);
  assert.ok(blocks.some((b) => b.backstage), 'no backstage block');
  assert.ok(s.clashes > 0 && blocks.some((b) => b.clash), 'the lab’s two crews in two rooms at once are not flagged');
  const view = code('_components/side-by-side.tsx');
  assert.match(view, /b\.backstage \? 'border border-dashed/, 'a backstage block is not dashed');
  assert.match(view, /Two places at once/);
});

test('4 · By person · By chapter · By role, and one person alone', () => {
  const role = sideBySide({ chapters: LAB_SCHEDULE_CHAPTERS, data: DATA, grouping: 'role' });
  assert.ok(role.columns.length > 0 && role.columns.every((c) => c.kind === 'role'), 'By role draws people, not roles');
  const byChapter = sideBySide({ chapters: LAB_SCHEDULE_CHAPTERS, data: DATA, grouping: 'chapter', hostIds: host });
  assert.ok(byChapter.columns.every((c) => c.group), 'By chapter leaves a column without its chapter');
  const view = code('_components/side-by-side.tsx');
  assert.match(view, /dataAttr="data-sbs-grouping"/);
  assert.match(view, /dataAttr="data-sbs-focus"/, 'one person cannot be shown alone');
  assert.match(view, /const shown = focus === ALL_COLUMNS \? sbs\.columns : sbs\.columns\.filter\(\(c\) => c\.key === focus\);/);
  assert.match(view, /data-sbs-search=""/, 'the people cannot be searched');
});

test('5 · pinned times and heads, Now across every column, columns that fit the screen, TBA listed', () => {
  const view = code('_components/side-by-side.tsx');
  assert.match(view, /className="sticky top-0 z-\[4\] flex bg-cream"/, 'the heads are not pinned');
  assert.match(view, /className="sticky left-0 z-\[3\] h-full bg-cream"/, 'the times are not pinned');
  assert.match(view, /data-sbs-now=""[^>]*style=\{\{ top: y\(sbs\.nowMs\), left: 0, right: 0 \}\}/, '"Now" does not cross every column');
  assert.match(view, /data-view-as-stretch="tba"/, 'a Time-TBA chapter’s suppliers are hidden');
  const room = (w: number) => w - 56;
  assert.equal(columnWidth(390, 390, 7), Math.round(room(390) / 2.5), 'a phone does not show about 2.5 columns');
  assert.equal(columnWidth(820, 820, 7), Math.round(room(820) / 5), 'a tablet does not show about 5 columns');
  assert.equal(columnWidth(1440, 1440, 7) * 7 <= room(1440), true, 'a desktop does not show every column');
});

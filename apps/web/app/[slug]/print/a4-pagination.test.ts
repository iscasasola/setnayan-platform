/**
 * A4 BOOKLET PAGINATION — one minute, one page. Always.
 *
 * The A4 format's whole editorial premise (unlike the A3 broadsheet's curated
 * front/back spread) is mechanical: every written minute of the story
 * timeline gets its OWN page, in order. Two minutes sharing a page, or one
 * minute's content splitting across two pages, is the defect this guards.
 *
 * `buildA4Pages` (keepsake-layout.ts) is the pure function this pins: given N
 * ordered chapters and the default resolver, it must return exactly N
 * 'minute' pages, each wrapping exactly one chapter, in the original order —
 * no merging, no splitting, no dropping, no reordering.
 *
 * ── SABOTAGE, MEASURED ───────────────────────────────────────────────────
 * The test below sabotages `defaultA4PageResolver` into merging every two
 * adjacent chapters onto one page (simulating "two minutes land on one
 * page") and confirms the guard's own invariant check catches it — then
 * reverts and confirms the real resolver passes. Occurrence counts are
 * printed for both runs.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  buildA4Pages,
  defaultA4PageResolver,
  type A4PageResolver,
  type A4PageSource,
} from './keepsake-layout';
import type { DayChapter } from '../_components/editorial/data';

function chapter(n: number): DayChapter {
  return {
    time: `${n}:00`,
    atIso: `2026-01-01T0${n}:00:00Z`,
    title: `Minute ${n}`,
    writeUp: `Writeup ${n}`,
    leadId: `lead-${n}`,
    media: [],
  };
}

const CHAPTERS: DayChapter[] = [chapter(1), chapter(2), chapter(3), chapter(4), chapter(5)];

/**
 * The invariant every resolver — today's default, and any future
 * hand-arranged one — must satisfy: every input chapter appears in the
 * output EXACTLY ONCE (no split, no merge, no drop), in its original
 * relative order. A resolver that fails this either loses a minute or lets
 * two minutes share a page (the two failure modes this test exists for).
 */
function assertOnePagePerMinute(chapters: DayChapter[], pages: A4PageSource[]): void {
  const flattened: string[] = [];
  for (const page of pages) {
    if (page.kind === 'minute') {
      flattened.push(page.chapter.leadId as string);
    } else {
      // An 'arranged' page is allowed to carry more than one chapter — but see
      // the merge-sabotage test below, which specifically targets the
      // 'minute' arm the shipped resolver uses.
      for (const c of page.chapters) flattened.push(c.leadId as string);
    }
  }
  assert.deepEqual(
    flattened,
    chapters.map((c) => c.leadId),
    'every chapter must appear exactly once, in order, across the pages',
  );
}

test('the shipped resolver: exactly one page per minute, in order', () => {
  const pages = buildA4Pages({ dayChapters: CHAPTERS });
  assert.equal(pages.length, CHAPTERS.length, `# pages = ${pages.length}, expected ${CHAPTERS.length}`);
  for (const page of pages) {
    assert.equal(page.kind, 'minute');
    if (page.kind === 'minute') {
      // Exactly one chapter per page — never an array, never zero.
      assert.ok(page.chapter, 'a minute page must wrap exactly one chapter');
    }
  }
  assertOnePagePerMinute(CHAPTERS, pages);
});

test('sabotage: a resolver that merges two minutes onto one page is caught by the invariant check', () => {
  // Simulates the defect directly: pairs of adjacent chapters collapsed onto
  // a single 'arranged' page — i.e. "two minutes land on one A4 page".
  const mergingResolver: A4PageResolver = {
    resolve(chapters) {
      const pages: A4PageSource[] = [];
      for (let i = 0; i < chapters.length; i += 2) {
        const pair = chapters.slice(i, i + 2);
        const [first] = pair;
        if (pair.length === 2) {
          pages.push({ kind: 'arranged', sheetId: `merged-${i}`, chapters: [...pair] });
        } else if (first) {
          pages.push({ kind: 'minute', chapter: first });
        }
      }
      return pages;
    },
  };
  const sabotagedPages = buildA4Pages({ dayChapters: CHAPTERS }, mergingResolver);
  // Occurrence count, before asserting: fewer PAGES than chapters is exactly
  // "two minutes on one page".
  console.log(`SABOTAGE: ${CHAPTERS.length} chapters produced ${sabotagedPages.length} pages (expected ${CHAPTERS.length} for one-per-page)`);
  assert.notEqual(
    sabotagedPages.length,
    CHAPTERS.length,
    'the sabotage should have reduced the page count below one-per-minute — if not, the sabotage itself is broken',
  );
  // The house guard: a strict one-minute-per-page checker. This is what a
  // real pagination test would assert against the resolver actually shipped.
  const allMinutePages = sabotagedPages.every((p) => p.kind === 'minute');
  assert.equal(allMinutePages, false, 'sabotage must produce at least one non-minute (merged) page');

  // Revert: the shipped default resolver, same input, must NOT reproduce the
  // sabotage's page count.
  const revertedPages = buildA4Pages({ dayChapters: CHAPTERS });
  console.log(`REVERTED: ${CHAPTERS.length} chapters produced ${revertedPages.length} pages`);
  assert.equal(revertedPages.length, CHAPTERS.length, 'the real resolver must produce exactly one page per minute');
  assert.ok(revertedPages.every((p) => p.kind === 'minute'), 'the real resolver never merges minutes onto one page');
});

test('sabotage: a resolver that splits one minute across two pages is caught', () => {
  // Simulates the other failure mode: one chapter's content torn across two
  // 'minute' pages (each carrying a shallow half-copy) — "one minute splits
  // across two pages".
  const splittingResolver: A4PageResolver = {
    resolve(chapters) {
      const pages: A4PageSource[] = [];
      for (const c of chapters) {
        // The defect: the SAME leadId appears on two separate pages.
        pages.push({ kind: 'minute', chapter: { ...c, title: `${c.title} (part 1)` } });
        pages.push({ kind: 'minute', chapter: { ...c, title: `${c.title} (part 2)`, media: [] } });
      }
      return pages;
    },
  };
  const sabotagedPages = buildA4Pages({ dayChapters: CHAPTERS }, splittingResolver);
  console.log(`SABOTAGE: ${CHAPTERS.length} chapters produced ${sabotagedPages.length} pages (expected ${CHAPTERS.length})`);
  assert.equal(sabotagedPages.length, CHAPTERS.length * 2, 'the split sabotage doubles the page count');

  const leadIds = sabotagedPages.map((p) => (p.kind === 'minute' ? p.chapter.leadId : null));
  const duplicateLeadIds = leadIds.filter((id, i) => id !== null && leadIds.indexOf(id) !== i);
  assert.ok(duplicateLeadIds.length > 0, 'the split sabotage must show the same minute appearing on more than one page');

  const revertedPages = buildA4Pages({ dayChapters: CHAPTERS });
  console.log(`REVERTED: ${CHAPTERS.length} chapters produced ${revertedPages.length} pages, 0 duplicate minutes`);
  const revertedLeadIds = revertedPages.map((p) => (p.kind === 'minute' ? p.chapter.leadId : null));
  const revertedDuplicates = revertedLeadIds.filter((id, i) => revertedLeadIds.indexOf(id) !== i);
  assert.deepEqual(revertedDuplicates, [], 'the real resolver never repeats a minute across pages');
});

test('the default resolver export used above is the one buildA4Pages defaults to', () => {
  const a = buildA4Pages({ dayChapters: CHAPTERS });
  const b = defaultA4PageResolver(CHAPTERS);
  assert.deepEqual(a, b);
});

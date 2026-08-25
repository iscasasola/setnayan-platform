/**
 * Guard: two shipped features that a person could not reach keep their door.
 *
 * WHAT WAS WRONG, measured on `origin/main` a8f8601 by scanning the whole tree
 * for importers — not by reading a brief:
 *
 *   · `lib/funnel-benchmark.ts` — "how does my funnel rank against anonymised
 *     peers" — had **ZERO importers anywhere in the repo**. The SQL bands, the
 *     min-N privacy floor and the percentile math all ship (the RPC
 *     `funnel_benchmark_for_vendor` is live in production, verified by the
 *     object), and its own docblock names a caller — `vendor-stats-panel.tsx` —
 *     **which does not exist**. Sixth "gate with no handle" in this project.
 *
 *   · `app/_components/vendor-event-day-prep-cta.tsx` — the supplier's "have the
 *     day ready offline" card — had **ZERO mount sites**. Its couple-side twin
 *     `<EventDayPrepCta>` is mounted on the event home; the supplier's was
 *     written and never given a home.
 *
 * NEITHER FEATURE WAS REBUILT. Both were mounted where the data already sat.
 *
 * The importer scan is DERIVED — it walks `app/` and `lib/` — so a future
 * refactor that quietly drops the last caller fails here rather than shipping a
 * second silent orphan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

const strip = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const root of ['app', 'lib']) {
    (function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next') continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if ((p.endsWith('.ts') || p.endsWith('.tsx')) && !p.includes('.test.')) out.push(p);
      }
    })(join(WEB, root));
  }
  return out;
}

const FILES = sourceFiles();

/** Files that import `spec`, excluding the module itself. Comments stripped, so
 *  a docblock MENTIONING a module never counts as reaching it — which is exactly
 *  how the benchmark's phantom caller read as real for months. */
function importersOf(spec: string, selfSuffix: string): string[] {
  return FILES.filter(
    (f) => !f.endsWith(selfSuffix) && strip(readFileSync(f, 'utf8')).includes(spec),
  ).map((f) => f.slice(WEB.length + 1));
}

test('📈 the peer-comparison numbers have a reader', () => {
  assert.ok(FILES.length >= 500, `floor: source scan found only ${FILES.length} files`);
  /* 🪤 REV 1 ASKED FOR AN IMPORTER AND WAS DECORATIVE — the mutation run said so.
     Deleting the page's read left the guard GREEN at 1 → 0, because the CARD
     also imports the module (for its types). An import is not a read. What makes
     the feature reachable is somebody CALLING the fetch, so that is what is
     asserted. */
  const readers = importersOf('getVendorFunnelBenchmark(', 'lib/funnel-benchmark.ts');
  assert.ok(
    readers.length >= 1,
    'nothing calls getVendorFunnelBenchmark — the SQL bands, the min-N privacy ' +
      'floor and the percentile math all ship and no vendor can reach a line of it.',
  );
});

test('📈 …and it is rendered, not merely imported', () => {
  const page = strip(readFileSync(join(WEB, 'app/vendor-dashboard/performance/page.tsx'), 'utf8'));
  assert.match(
    page,
    /<FunnelBenchmarkCard benchmark=\{funnelBenchmark\}/,
    'the benchmark is read but never drawn — an import is not a doorway',
  );
  /* It must stay inside the Pro-and-up market-intel gate the module's own
     docblock names, never become an ungated read. */
  assert.match(
    page,
    /canMarket\s*\n?\s*\?\s*safeRead\(\s*\n?\s*getVendorFunnelBenchmark/,
    'the benchmark read lost its Pro-and-up gate',
  );
});

test('📦 the supplier’s day-preload card has a home', () => {
  const mounts = importersOf('vendor-event-day-prep-cta', 'app/_components/vendor-event-day-prep-cta.tsx');
  assert.ok(
    mounts.length >= 1,
    'nothing mounts <VendorEventDayPrepCta> — it is written, tested by nothing, ' +
      'and unreachable, exactly as it was before 2026-08-25',
  );
});

test('🔒 …and only a BOOKED supplier is offered it', () => {
  /* An asked-but-unanswered supplier must not be nudged to pull down a
     run-of-show they have not earned — the boundary PR-H draws. */
  const page = strip(
    readFileSync(join(WEB, 'app/vendor-dashboard/messages/[threadId]/page.tsx'), 'utf8'),
  );
  assert.match(
    page,
    /const showDayPrep = railStage === 'booked'/,
    'the supplier day-prep card lost its booked-only gate',
  );
  assert.match(
    page,
    /\{showDayPrep \? \(/,
    'the gate exists but nothing reads it — the card renders for every thread',
  );
});

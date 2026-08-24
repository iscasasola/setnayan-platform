/**
 * kit-convergence.test.ts — a supplier screen does not hand-roll the kit.
 *
 * ── What this pins ──────────────────────────────────────────────────────────
 * The supplier tree converged its repeated shapes into `_components/kit.tsx`
 * (W4-B, 2026-08-24). Two of those shapes are EXACT class strings that used to
 * be hand-typed per file:
 *
 *   · the section card  `rounded-2xl border border-ink/10 bg-white`
 *   · the form control  `rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm`
 *
 * This test counts, per file, comment-stripped occurrences of those strings
 * OUTSIDE kit.tsx and compares them against a GENERATED baseline
 * (kit-convergence.baseline.json). The comparison is EXACT in both directions:
 *
 *   · a count ABOVE baseline = a new hand-rolled copy → fail, use the kit;
 *   · a count BELOW baseline = a conversion happened → fail with instructions
 *     to regenerate, so the convergence lands in the diff as readable baseline
 *     lines in the SAME PR (the port-control-baseline philosophy: a baseline
 *     is generated, never hand-typed, and every deliberate change to it is a
 *     line a reviewer sees).
 *
 * Regenerate: KIT_BASELINE_WRITE=1 npx tsx --test app/vendor-dashboard/kit-convergence.test.ts
 *
 * ── Deliberately NOT pinned ────────────────────────────────────────────────
 * Bare `text-terracotta` (the decorative gold, 3.37:1 — an AA fail as TEXT) is
 * NOT ratcheted here: gold on an ICON legitimately clears the 3:1 non-text
 * bar, this tree holds ~213 mixed icon/text sites, and a lexical rule cannot
 * tell them apart — a guard that cries wolf teaches you to skim past the one
 * time it is right. Gold-as-text is corrected per file during the sweeps.
 *
 * 🛡 Mutation-checked by occurrence count (printed before → after) at build
 * time: a hand-rolled card added to a converted file went RED; the kit's own
 * card recipe gutted went RED via the pin below; a sabotage that did not land
 * was caught by the printed count not moving.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = join(HERE, '_components', 'kit.tsx');
const BASELINE_PATH = join(HERE, 'kit-convergence.baseline.json');

/** The two converged spellings. The RULE and the FLOOR below share this
 * object, so the pattern source cannot drift from what the floor measures.
 *
 * The card pattern ends with a lookahead: `bg-white/60` and `bg-white/70` are
 * the tree's deliberate TRANSLUCENT glass variant (a different surface, kept),
 * and a bare-substring count was claiming them as hand-rolled solid cards. */
const RECIPES = {
  card: /rounded-2xl border border-ink\/10 bg-white(?![/\-\w])/g,
  input: /rounded-lg border border-ink\/20 bg-white px-3 py-1\.5 text-sm/g,
} as const;

/** Strip /* *​/ and // comments (incl. JSX {/* *​/}) so a note NAMING a recipe
 * — every converted file carries one — cannot count as an occurrence. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function countOccurrences(haystack: string, pattern: RegExp): number {
  // Fresh lastIndex per call — the shared /g regexes are stateful.
  const re = new RegExp(pattern.source, pattern.flags);
  let n = 0;
  while (re.exec(haystack) !== null) n += 1;
  return n;
}

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsx(p));
    else if (entry.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

type Baseline = Record<string, { card?: number; input?: number }>;

function measure(): { counts: Baseline; filesScanned: number } {
  const counts: Baseline = {};
  const files = walkTsx(HERE).filter((f) => f !== KIT);
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const card = countOccurrences(src, RECIPES.card);
    const input = countOccurrences(src, RECIPES.input);
    if (card || input) {
      const key = relative(HERE, f);
      counts[key] = {};
      if (card) counts[key].card = card;
      if (input) counts[key].input = input;
    }
  }
  return { counts, filesScanned: files.length };
}

test('the kit itself carries each recipe exactly once', () => {
  const src = stripComments(readFileSync(KIT, 'utf8'));
  assert.equal(
    countOccurrences(src, RECIPES.card),
    1,
    'kit.tsx must render the section-card recipe exactly once — gutting or forking it orphans every consumer',
  );
  assert.equal(
    countOccurrences(src, RECIPES.input),
    1,
    'kit.tsx must export the input recipe exactly once',
  );
});

test('no supplier screen hand-rolls a converged recipe (generated baseline, exact both ways)', () => {
  const { counts, filesScanned } = measure();

  // Non-vacuity floor, derived from the SAME walk the rule uses: the supplier
  // tree holds 63 routes / ~230 tsx files. A refactor that moves this test or
  // breaks the walk must fail loudly, not scan an empty directory to green.
  assert.ok(
    filesScanned >= 60,
    `the walk found only ${filesScanned} .tsx files under app/vendor-dashboard — the scan itself is broken`,
  );

  if (process.env.KIT_BASELINE_WRITE === '1') {
    writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n');
    console.log(`baseline written: ${Object.keys(counts).length} files carry hand-rolled recipes`);
    return;
  }

  assert.ok(existsSync(BASELINE_PATH), 'kit-convergence.baseline.json is missing — regenerate it');
  const baseline: Baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

  const problems: string[] = [];
  const keys = new Set([...Object.keys(counts), ...Object.keys(baseline)]);
  for (const key of keys) {
    for (const recipe of ['card', 'input'] as const) {
      const now = counts[key]?.[recipe] ?? 0;
      const was = baseline[key]?.[recipe] ?? 0;
      if (now > was) {
        problems.push(
          `${key}: ${recipe} recipe hand-rolled ${now}× (baseline ${was}) — import it from _components/kit.tsx instead`,
        );
      } else if (now < was) {
        problems.push(
          `${key}: ${recipe} count fell ${was} → ${now} — good, now regenerate the baseline in this same PR: ` +
            'KIT_BASELINE_WRITE=1 npx tsx --test app/vendor-dashboard/kit-convergence.test.ts',
        );
      }
    }
  }
  assert.equal(problems.length, 0, '\n' + problems.join('\n'));
});

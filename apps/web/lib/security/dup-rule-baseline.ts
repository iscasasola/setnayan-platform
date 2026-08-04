/**
 * The baseline half of the duplicated-rule guards.
 *
 * Both guards find real hits in today's tree, and a guard that fails CI on the
 * day it lands gets deleted in week two. So they follow the pattern this repo
 * already proved with `supabase/security/exposure-surface.baseline.txt`:
 *
 *   ADDING A LINE IS A WIDENING AND FAILS.
 *   REMOVING A LINE IS A NARROWING AND PASSES.
 *
 * The debt can only shrink; no NEW instance of the class can land. That
 * asymmetry is the entire design. Making the safe direction free is what keeps
 * the dangerous direction expensive — a guard that goes red when you FIX
 * something teaches people to stop fixing things.
 *
 * WHY THE KEYS ARE NOT LINE NUMBERS. `page-masthead-baseline.json` keys on the
 * file path; the exposure baseline keys on the object's identity. Neither uses
 * a line number, and this must not either: a baseline keyed on `file:line`
 * re-shuffles every time somebody adds an import, so an unrelated pull request
 * arrives with 40 baseline edits, nobody reads them, and the file stops being a
 * review surface. These keys are made of the FACTS instead —
 *
 *   shadow  file · shadowed name · module that owns the name
 *   omit    file · table · canonical constant · the omitted column
 *
 * — so moving code within a file changes nothing, and every line that DOES
 * change in a diff is a real change in what the repo does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib/security
/** apps/web/lib/security → apps/web is two levels up. */
export const APP_ROOT = path.resolve(HERE, '..', '..');

export const BASELINE_PATH = path.join(APP_ROOT, 'scripts', 'dup-rule.baseline.txt');

/** The two fact kinds, in canonical file order. */
export const DUP_RULE_KINDS = ['shadow', 'omit'] as const;
export type DupRuleKind = (typeof DUP_RULE_KINDS)[number];

export type DupRuleFact = {
  kind: DupRuleKind;
  /** tab-separated fields, kind-specific — see the header of the baseline file */
  key: string;
};

/** `kind\tkey`, the exact text of one baseline line. */
export function factLine(f: DupRuleFact): string {
  return `${f.kind}\t${f.key}`;
}

/**
 * Collapse repeats of the SAME fact.
 *
 * A fact is "this file writes this rule down a second time", not "this line
 * does". `app/[slug]/_components/editorial/data.ts` reads `events` twice, 17
 * lines apart, and both copies drop `what_to_bring` — that is one duplication
 * to fix, and it must be one line in the file, or the baseline could never be
 * reproduced from a scan.
 */
export function dedupeFacts(facts: readonly DupRuleFact[]): DupRuleFact[] {
  const seen = new Set<string>();
  const out: DupRuleFact[] = [];
  for (const f of facts) {
    const l = factLine(f);
    if (seen.has(l)) continue;
    seen.add(l);
    out.push(f);
  }
  return out;
}

/** Canonical order: kind first (file order), then the key, lexicographically. */
export function sortFacts(facts: readonly DupRuleFact[]): DupRuleFact[] {
  const rank = new Map<string, number>(DUP_RULE_KINDS.map((k, i) => [k, i]));
  return [...facts].sort((a, b) => {
    const ka = rank.get(a.kind) ?? 99;
    const kb = rank.get(b.kind) ?? 99;
    if (ka !== kb) return ka - kb;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}

export const BASELINE_HEADER = `# SETNAYAN DUPLICATED-RULE BASELINE — GENERATED FILE, DO NOT HAND-EDIT
#
# Every line below is one place where THIS REPO WRITES THE SAME RULE DOWN TWICE.
# That is not a style complaint. It is the bug class that cost a full day on
# 2026-07-27: a fee rate typed into eleven files (one of them a vendor's BILL)
# that stayed at the old flat rate for three days after the maths changed; a
# page whose local \`keptItems\` shadowed the exported \`keptItems\`, so the
# receipt and the lock path disagreed about what a couple had bought; two pages
# hand-typing a column list, one of them missing \`item_id\` (a removal filter
# that could never match) and \`is_required\` (a mandatory line that could
# silently vanish). None of those was a typo. Each was a second copy of a rule
# that then drifted from the first.
#
# ADDING A LINE IS A WIDENING AND FAILS CI.
#   A new line means somebody wrote an existing rule down a second time. Do not
#   regenerate the file to make the build green — go and USE the definition
#   that already exists. Regenerating without reading your own diff turns this
#   from a control into a rubber stamp, which is worse than deleting it,
#   because it still looks like protection.
#
# REMOVING A LINE IS A NARROWING AND PASSES, SILENTLY.
#   Delete the duplicate, import the real one, and regenerate whenever suits
#   you. Fixing something must never turn the build red.
#
# Regenerate:
#
#   pnpm --filter @setnayan/web dup-rule:baseline
#
# ── LINE FORMAT ────────────────────────────────────────────────────────────
#
# shadow <TAB> file <TAB> name <TAB> owning-module
#   \`file\` declares a local \`name\`, and \`owning-module\` — a module \`file\`
#   ALREADY IMPORTS FROM — exports something of that same name. The author had
#   the real one in reach and wrote a second one anyway. That qualifier is the
#   whole rule: without it the same scan reports thousands of coincidental
#   name collisions and is useless.
#
# omit <TAB> file <TAB> table <TAB> canonical-constant <TAB> omitted-column
#   \`file\` hand-types a \`.select()\` on \`table\` that is a near-copy of
#   \`canonical-constant\` and leaves \`omitted-column\` out. Every name in the
#   list is real, so the phantom-column guard sees nothing: PostgREST returns
#   rows, the query "works", and the page is quietly wrong. One line per
#   omitted column, so dropping one MORE column adds a line (fails) and
#   restoring one removes a line (passes).
#
# See the docblocks in lib/security/shadowed-export-scan.ts and
# lib/security/select-column-scan.ts (PART 2) for each guard's honest limits.
`;

export type ParsedBaseline = {
  facts: DupRuleFact[];
  /** counts declared in the header, for the anti-truncation check */
  declared: Record<string, number>;
  declaredTotal: number | null;
  problems: string[];
};

/** Read and structurally validate the committed baseline. */
export function readBaseline(file: string = BASELINE_PATH): ParsedBaseline {
  const problems: string[] = [];
  if (!fs.existsSync(file)) {
    return {
      facts: [],
      declared: {},
      declaredTotal: null,
      problems: [
        `MISSING: ${path.relative(APP_ROOT, file)} — generate it with ` +
          '`pnpm --filter @setnayan/web dup-rule:baseline`',
      ],
    };
  }

  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const kinds = new Set<string>(DUP_RULE_KINDS);

  const totalMatch = /^#\s*facts:\s*(\d+)\s*$/m.exec(text);
  const declaredTotal = totalMatch?.[1] ? Number(totalMatch[1]) : null;
  if (declaredTotal === null) {
    problems.push('baseline header has no `# facts: N` line — regenerate it, do not hand-edit');
  }
  const declared: Record<string, number> = {};
  for (const m of text.matchAll(/^#\s{3}(shadow|omit)\s+(\d+)\s*$/gm)) {
    if (m[1]) declared[m[1]] = Number(m[2]);
  }

  const facts: DupRuleFact[] = [];
  lines.forEach((line, i) => {
    if (line.startsWith('#') || line.trim() === '') return;
    const tab = line.indexOf('\t');
    const kind = tab === -1 ? line : line.slice(0, tab);
    if (!kinds.has(kind)) {
      problems.push(`line ${i + 1}: unknown fact kind "${kind}"`);
      return;
    }
    facts.push({ kind: kind as DupRuleKind, key: line.slice(tab + 1) });
  });

  if (declaredTotal !== null && facts.length !== declaredTotal) {
    problems.push(
      `TRUNCATED OR EDITED: header declares ${declaredTotal} facts but the body holds ${facts.length}.\n` +
        '  Regenerate: pnpm --filter @setnayan/web dup-rule:baseline',
    );
  }
  for (const [kind, n] of Object.entries(declared)) {
    const actual = facts.filter((f) => f.kind === kind).length;
    if (actual !== n) {
      problems.push(`header declares ${n} "${kind}" facts but the body holds ${actual}`);
    }
  }

  // Canonical ordering — an unsorted file makes every diff noisy, which trains
  // reviewers to stop reading it.
  const sorted = sortFacts(facts);
  for (let i = 0; i < facts.length; i++) {
    if (factLine(facts[i]!) !== factLine(sorted[i]!)) {
      problems.push(
        `OUT OF ORDER at fact ${i + 1}: expected "${factLine(sorted[i]!).replace(/\t/g, ' · ')}".\n` +
          '  Regenerate: pnpm --filter @setnayan/web dup-rule:baseline',
      );
      break;
    }
  }

  const seen = new Set<string>();
  for (const f of facts) {
    const l = factLine(f);
    if (seen.has(l)) problems.push(`DUPLICATE baseline line: ${l.replace(/\t/g, ' · ')}`);
    seen.add(l);
  }

  return { facts, declared, declaredTotal, problems };
}

/** Render the full baseline file text for a set of facts. */
export function renderBaseline(facts: readonly DupRuleFact[]): string {
  const sorted = sortFacts(dedupeFacts(facts));
  const counts = DUP_RULE_KINDS.map(
    (k) => `#   ${k.padEnd(8)}${sorted.filter((f) => f.kind === k).length}`,
  ).join('\n');
  return (
    BASELINE_HEADER +
    `#\n# facts: ${sorted.length}\n${counts}\n` +
    sorted.map(factLine).join('\n') +
    '\n'
  );
}

export type BaselineDiff = {
  /** facts present now and NOT baselined — a widening; these fail */
  added: DupRuleFact[];
  /** baselined facts no longer present — a narrowing; these pass */
  removed: DupRuleFact[];
};

export function diffAgainstBaseline(
  current: readonly DupRuleFact[],
  baseline: readonly DupRuleFact[],
): BaselineDiff {
  const base = new Set(baseline.map(factLine));
  const now = new Set(current.map(factLine));
  return {
    added: sortFacts(dedupeFacts(current.filter((f) => !base.has(factLine(f))))),
    removed: sortFacts(baseline.filter((f) => !now.has(factLine(f)))),
  };
}

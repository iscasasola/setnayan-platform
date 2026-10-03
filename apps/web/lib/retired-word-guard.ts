/**
 * retired-word-guard.ts — the shared walk behind the "simplicity fixes 2" word guards.
 *
 * ⚖ Owner tracker d19–d25 (2026-10-02): couples read "book" never "lock" · "bench"
 * → "Save/Saved" · "quote" never "proposal" · one money word "payment" (deposit /
 * downpayment / installment retire) · "The Day" never "On the Day". Each rule has
 * its own small test (`lib/the-*.test.ts`); this file is the part they share.
 *
 * 🔑 WHAT IT READS. Words a person reads — judged by AST position, never by a grep
 * (`retired-names-scan.ts`: JSX text, prose literals, Title-case labels; never
 * identifiers, routes, columns, SKU codes, log lines or comments). Comments are
 * removed first with the repo's one stripper (`strip-comments.ts`), so prose ABOUT
 * the old word cannot convict the file explaining the fix.
 *
 * 🔑 THE ALLOWLIST IS REASONED, AND CANNOT ROT QUIETLY. An entry names a path
 * prefix (and optionally a pattern the offending text must match), and says WHY the
 * word is right there. `allowlistProblems()` fails an entry with no reason, one
 * whose path no longer exists, and one that no longer matches anything — so an
 * allowlist can only shrink as the words are fixed, never silently widen.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { scanRetiredNames, type RetiredName } from './retired-names-scan';

export const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'lib', 'components'];

export type WordAllow = {
  /** A path prefix under apps/web — a directory (ends with "/"), a file, or a file-name stem. */
  prefix: string;
  /** Why the retired word is correct here. Required. */
  why: string;
  /** Only the offending text matching this is excused (default: every hit under the prefix). */
  text?: RegExp;
};

export function* sources(dir: string): Generator<string> {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e === '.tmp') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith('.d.ts')) yield p;
  }
}

/** Every scanned source file, as paths relative to apps/web. */
export function allSources(): string[] {
  return ROOTS.flatMap((r) => [...sources(join(WEB, r))]).map((f) => relative(WEB, f));
}

/** Findings on one piece of source, comments removed first. */
export function scanSource(file: string, source: string, names: readonly RetiredName[]) {
  return scanRetiredNames(file, stripComments(source), names);
}

export type TreeScan = { findings: string[]; scanned: number; used: boolean[]; excused: number };

/**
 * Walk the tree. `self` files carry the old word on purpose (the scanner's own list).
 * Returns what is NOT excused, plus which allowlist rows fired.
 */
export function scanTree(
  names: readonly RetiredName[],
  allow: readonly WordAllow[],
  self: ReadonlySet<string> = new Set(),
): TreeScan {
  const used = allow.map(() => false);
  const findings: string[] = [];
  let scanned = 0;
  let excused = 0;
  for (const rel of allSources()) {
    if (self.has(rel) || rel.endsWith('.generated.ts')) continue;
    scanned += 1;
    for (const h of scanSource(rel, readFileSync(join(WEB, rel), 'utf8'), names)) {
      const i = allow.findIndex(
        (a) => rel.startsWith(a.prefix) && (!a.text || a.text.test(h.context)),
      );
      if (i >= 0) {
        used[i] = true;
        excused += 1;
        continue;
      }
      findings.push(`${rel}:${h.line}  "${h.was}" → say "${h.now}"  ·  ${h.text}`);
    }
  }
  return { findings, scanned, used, excused };
}

/** Problems with the allowlist itself: no reason · a path that is gone · a row that matches nothing. */
export function allowlistProblems(allow: readonly WordAllow[], used: readonly boolean[]): string[] {
  const out: string[] = [];
  const files = allSources();
  allow.forEach((a, i) => {
    if (a.why.trim().length < 15) out.push(`${a.prefix} has no real reason`);
    const exists = files.some((f) => f.startsWith(a.prefix));
    if (!exists) out.push(`${a.prefix} no longer exists — drop the row`);
    else if (!used[i]) out.push(`${a.prefix}${a.text ? ` /${a.text.source}/` : ''} matches nothing any more — drop the row`);
  });
  return out;
}

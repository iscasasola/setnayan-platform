/**
 * admin-gold-is-not-text.test.ts — the admin console stops painting text gold.
 *
 * In this repo the Tailwind slot named `terracotta` is the atelier GOLD
 * #A9834B — 3.37:1 on the white admin ground, an AA failure at any text size.
 * The real action colour lives in the slot named `mulberry` (#C24E25,
 * 4.61:1), or `text-link` (8.22:1) for an inline link. The names are
 * inherited and backwards, which is exactly why `text-terracotta` keeps
 * getting reached for: it LOOKS like the safe brand colour and is the unsafe
 * one. Measured across `app/admin/**` on 2026-08-24: 106 raw occurrences
 * across 51 files (word-boundary match on the raw, uncommented source —
 * a separate, looser `grep -rho "text-terracotta" app/admin` returns 207
 * across 82 files because it also counts every `-700`/`-100`/… deep-shade
 * variant as a substring; that number is not what this guard tracks).
 *
 * A gold ICON is allowed to stay — non-text contrast only needs 3:1 and
 * 3.37 clears it. Only TEXT moves. Two shapes read as "icon" here: the class
 * sits directly on a Lucide icon element (self-closing, `strokeWidth` on the
 * same element), or it sits on a container `<span>`/`<div>` whose only
 * child is an icon component or an `{icon}` prop, with no text sibling.
 *
 * 🛡 MUTATION-CHECKED BY OCCURRENCE COUNT (see the script transcript in the
 * PR description): the offender count was verified to jump from 0 to a
 * positive number when `text-mulberry` was sabotaged back to
 * `text-terracotta` on a real text node, and the icon-exemption was verified
 * to still admit an unmodified icon-only line. An unmeasured mutation proves
 * nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN = resolve(HERE, '..');

/** Every .tsx under app/admin, excluding tests. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/**
 * Strip comments before matching — the fix for this exact defect is
 * documented inline in referrals-surface.tsx with a comment that names
 * `text-terracotta` as the string it removed. A guard reading raw source
 * reports the defect it just fixed. Blank comments out, keep line numbers,
 * so an offender still points at the right line.
 */
function codeLines(src: string): string[] {
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, ' '));
  return stripped.split('\n').map((l) => (l.trimStart().startsWith('//') ? '' : l));
}

/**
 * A line carries the icon exemption in three shapes:
 *  1. A capitalized element self-closes on one line with the gold class
 *     inside it and no other tag boundary before the `/>` — a Lucide icon,
 *     whether or not it also carries `strokeWidth`, whether or not a JSX
 *     text sibling follows the tag on the same line.
 *  2. The gold sits alone on its own `className="..."` prop line, no other
 *     JSX on that line — walk backward past sibling prop lines (aria-hidden,
 *     name={…}, fallback={…}) to the element's own still-open capitalized
 *     opening tag. Stops early on a lowercase opening tag (a <span>/<div>
 *     wrapping the icon, not the icon itself) so it never over-claims.
 *  3. A container `<span>`/`<div>` whose only rendered child is an icon
 *     component or an `{icon}` prop, with no visible text sibling.
 */
function isIconLine(lines: string[], i: number): boolean {
  const line = lines[i]!;
  const trimmed = line.trim();

  if (/^<[A-Z]\w*\b[^>]*\btext-terracotta\b(?!-)[^>]*\/>/.test(trimmed)) return true;

  if (/^className=(?:\{[^}]*\}|"[^"]*")$/.test(trimmed) && /\btext-terracotta\b(?!-)/.test(trimmed)) {
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      const t = lines[j]!.trim();
      if (!t) continue;
      if (/^<[A-Z]\w*\b/.test(t)) return true;
      if (/^<[a-z]/.test(t)) return false;
    }
    return false;
  }

  if (/text-terracotta">\{icon\}<\//.test(line)) return true;
  if (/text-terracotta">\s*$/.test(line)) {
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j]!.trim();
      if (!next) continue;
      return /^<[A-Z]\w*[\s/]/.test(next) || /^\{icon\}/.test(next);
    }
  }
  return false;
}

test('no admin screen paints TEXT in the 3.37:1 gold', () => {
  const files = walk(ADMIN);
  const offenders: string[] = [];
  for (const full of files) {
    const rel = full.slice(ADMIN.length + 1);
    const lines = codeLines(readFileSync(full, 'utf8'));
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]!;
      if (!/\btext-terracotta\b(?!-)/.test(l)) continue;
      if (isIconLine(lines, i)) continue;
      offenders.push(`${rel}:${i + 1}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'Use text-mulberry (#C24E25, 4.61:1) for admin text/labels/checkboxes, or ' +
      `text-link (8.22:1) for an inline link. Offenders: ${offenders.join(', ')}`,
  );
});

/**
 * The positive half — without it, deleting every `text-mulberry` admin fix
 * would also pass. Floored at the 67 lines actually converted in the sweep
 * that retired the last text-terracotta text use in app/admin, so an empty
 * or partial future edit re-reads this guard instead of quietly degrading
 * it into a test of nothing.
 */
test('the swept admin surfaces really carry the readable colour', () => {
  const files = walk(ADMIN);
  let mulberryText = 0;
  for (const full of files) {
    const src = readFileSync(full, 'utf8');
    mulberryText += (src.match(/\btext-mulberry\b(?!-)/g) ?? []).length;
  }
  assert.ok(
    mulberryText >= 67,
    `only ${mulberryText} text-mulberry admin occurrences — expected the full swept set (>= 67).`,
  );
});

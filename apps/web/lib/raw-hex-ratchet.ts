/**
 * raw-hex-ratchet.ts — count raw hex colour literals per area of a route tree, for the down-only ratchets that keep
 * a dark-ready area painting from tokens (`app/dashboard/raw-hex-only-goes-down.test.ts`,
 * `app/vendor-dashboard/raw-hex-only-goes-down.test.ts`). Test-only by use: it reads files from disk.
 *
 * WHAT IT COUNTS. Every hex colour literal (`#rgb`, `#rrggbb`, `#rrggbbaa`) in the non-test `.ts` / `.tsx` / `.css`
 * files under a root, comments removed with the repo's one stripper, summed PER AREA (the first folder — or, under a
 * dynamic or grouping folder such as `[eventId]` / `(account)`, the folder below it).
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

/** `[eventId]/budget/page.tsx` → `[eventId]/budget` · `(account)/billing/x.tsx` → `(account)/billing` · `page.tsx` → `(root)`. */
export function areaOf(rel: string): string {
  const parts = rel.split('/');
  if (parts.length === 1) return '(root)';
  if (/^[[(]/.test(parts[0]!) && parts.length > 2) return `${parts[0]}/${parts[1]}`;
  return parts[0]!;
}

/** A hex colour, not an id: `#7098` inside a word such as `PR #7098` is prose, and prose lives in comments (stripped). */
export function countHex(source: string, _isCss?: boolean): number {
  // The repo's ONE stripper for both (`scripts/lint-one-comment-stripper.mjs`): it lexes strings, so `/*` inside a
  // string never opens a comment. The second argument is kept for the callers' readability; a stylesheet goes through the same door.
  const code = stripComments(source);
  return (code.match(HEX) ?? []).length;
}

export function scanHex(root: string): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.(tsx?|css)$/.test(name) || /\.test\.tsx?$/.test(name) || /\.harness\.tsx?$/.test(name)) continue;
      const n = countHex(readFileSync(abs, 'utf8'), name.endsWith('.css'));
      if (n === 0) continue;
      const area = areaOf(relative(root, abs));
      out[area] = (out[area] ?? 0) + n;
    }
  };
  walk(root);
  return out;
}

type Baseline = { _about: string; total: number; areas: Record<string, number> };

/** The ratchet: every area at or under its baseline; `WRITE_HEX_BASELINE=1` rewrites it and refuses to raise a count. */
export function assertHexOnlyGoesDown(root: string, baselinePath: string, since: string, minAreas = 10): void {
  const now = scanHex(root);
  const base = JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline;
  if (process.env.WRITE_HEX_BASELINE === '1') {
    const raised = Object.entries(now).filter(([a, n]) => a in base.areas && n > base.areas[a]!);
    assert.deepEqual(raised, [], 'refusing to RAISE a count — remove the hex, do not record it');
    const areas = Object.fromEntries(Object.entries(now).sort(([a], [b]) => a.localeCompare(b)));
    const next: Baseline = { _about: base._about, total: Object.values(areas).reduce((s, n) => s + n, 0), areas };
    writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
    return;
  }
  assert.ok(Object.keys(now).length >= minAreas, `anti-vacuity: the scan read only ${Object.keys(now).length} area(s) with a hex — it has gone blind`);
  const over: string[] = [];
  for (const [area, n] of Object.entries(now)) {
    const allowed = base.areas[area];
    if (allowed === undefined) over.push(`${area}: ${n} raw hex in an area with no baseline — paint from a token (bg-raised, text-ink, var(--m-…), rgb(var(--color-…)))`);
    else if (n > allowed) over.push(`${area}: ${n} raw hex, the baseline is ${allowed} — a colour was typed as a hex; read a token instead`);
  }
  assert.deepEqual(over, [], `a raw hex colour does not follow dark mode — this area paints dark since ${since}`);
  assert.equal(base.total, Object.values(base.areas).reduce((s, n) => s + n, 0), 'the baseline total does not match its rows — it was edited by hand');
}

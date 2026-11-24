#!/usr/bin/env node
// dropped-read-errors — READ-ONLY audit helper for MAPS-CONNECTIONS-AUDIT-2026-11-24.
//
// The "honest states" rule (CLAUDE.md §5 rule 4): a refused Supabase read resolves
// with `{ error }`, not a throw. When a RENDERING file binds only `data` and then
// writes `?? []` / `?? 0`, a refused read reaches the screen as "none" / "0".
//
// This lists, per file, every Supabase read in a render file whose destructure binds
// `data` but no `error`:
//     const { data } = await supabase.from(...)
//     const { data: rows } = await admin.from(...)
// It skips `actions.ts` (failing closed there is correct — see
// app/vendor-dashboard/reads-are-honest.test.ts), API routes, tests, labs and /dev,
// and the session read `const { data: { user } } = await supabase.auth.getUser()`.
//
// A hit is a CANDIDATE, not a defect: some reads are optional decoration where an
// empty answer states nothing. The audit doc lists only the ones confirmed by
// reading what the page then SAYS.
//
// USAGE  node scripts/audit/dropped-read-errors.mjs [--area app/vendor-dashboard] [--json]

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { stripComments } from '../../apps/web/scripts/port-controls.mjs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const WEB = join(ROOT, 'apps', 'web');
const areaIdx = process.argv.indexOf('--area');
const AREA = areaIdx > -1 ? process.argv[areaIdx + 1] : 'app';

function skip(rel) {
  return (
    /\.test\.tsx?$/.test(rel) ||
    /\.lab\.tsx$/.test(rel) ||
    /(^|\/)actions\.ts$/.test(rel) ||
    /-actions\.ts$/.test(rel) ||
    /-writes\.ts$/.test(rel) ||
    rel.includes('/_actions/') ||
    /(^|\/)route\.ts$/.test(rel) ||
    rel.startsWith('app/dev/') ||
    rel.startsWith('app/api/') ||
    rel.endsWith('.harness.ts')
  );
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) {
      const rel = relative(WEB, p);
      if (!skip(rel)) out.push(rel);
    }
  }
  return out;
}

// The repo's ONE comment stripper (lint-one-comment-stripper.mjs): never a private two-replace regex.
const strip = stripComments;
// `{ data }` or `{ data: name }` — no `error`, no `count` — followed by an awaited from()/rpc().
const DROPPED = /const\s*\{\s*data(?:\s*:\s*[A-Za-z_$][\w$]*)?\s*\}\s*=\s*await\s+([A-Za-z_$][\w$.]*?)\s*\.\s*(from|rpc)\s*\(\s*['"`]([\w-]+)['"`]/g;

const hits = [];
for (const rel of walk(join(WEB, AREA))) {
  const s = strip(readFileSync(join(WEB, rel), 'utf8'));
  for (const m of s.matchAll(DROPPED)) {
    const after = s.slice(m.index, m.index + 600);
    const fallback = /\?\?\s*(\[\]|0\b|''|null)|\|\|\s*(\[\]|0\b)/.exec(after)?.[0] ?? '';
    hits.push({ file: rel, kind: m[2], target: m[3], fallback });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(hits, null, 2));
} else {
  const byFile = new Map();
  for (const h of hits) byFile.set(h.file, [...(byFile.get(h.file) ?? []), h]);
  const sorted = [...byFile].sort((a, b) => b[1].length - a[1].length);
  console.log(`DROPPED READ ERRORS in render files under apps/web/${AREA}: ${hits.length} reads in ${byFile.size} files\n`);
  for (const [file, hs] of sorted) {
    console.log(`${hs.length}  ${file}`);
    for (const h of hs) console.log(`     ${h.kind}('${h.target}')${h.fallback ? `  then ${h.fallback}` : ''}`);
  }
}

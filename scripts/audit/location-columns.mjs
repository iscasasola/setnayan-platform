#!/usr/bin/env node
// location-columns — READ-ONLY audit helper for MAPS-CONNECTIONS-AUDIT-2026-11-24.
//
// Lists every location-shaped column in the production schema snapshot
// (supabase/security/prod-schema.snapshot.txt) and, for each, the app files that
// name it, split into files that look like they WRITE it (the column appears as an
// object key next to .insert/.update/.upsert, or as a form field name) and files
// that only READ it. A column no app file names is printed as UNREAD.
//
// It also lists every hand-typed fallback map centre (a literal Metro Manila
// coordinate) outside the canonical region table, so the "one source" fix can be
// checked by re-running this.
//
// Heuristic, not a proof: it narrows where to look; the audit doc says what was
// confirmed by reading the code. Touches no database, no network, no app file.
//
// USAGE  node scripts/audit/location-columns.mjs [--json]

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const WEB = join(ROOT, 'apps', 'web');
const SNAPSHOT = join(ROOT, 'supabase', 'security', 'prod-schema.snapshot.txt');

const LOCATION = /(^|_)(lat|lng|lon|latitude|longitude|radius_km|centroid_lat|centroid_lon|geo_lat|geo_lon|entrance_x|entrance_y|timezone)$/;

/** Production code only: no tests, no labs, no /dev, no generated maps. */
function skip(rel) {
  return (
    /\.test\.tsx?$/.test(rel) ||
    /\.lab\.tsx$/.test(rel) ||
    rel.startsWith('app/dev/') ||
    rel.includes('/node_modules/') ||
    rel.includes('.generated.') ||
    rel.endsWith('.harness.ts')
  );
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) {
      const rel = relative(WEB, p);
      if (!skip(rel)) out.push(rel);
    }
  }
  return out;
}

const columns = [
  ...new Set(
    readFileSync(SNAPSHOT, 'utf8')
      .split('\n')
      .filter((l) => /^[a-z0-9_]+\.[a-z0-9_]+$/.test(l))
      .filter((l) => LOCATION.test(l.split('.')[1])),
  ),
].sort();

const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
const src = new Map(files.map((f) => [f, readFileSync(join(WEB, f), 'utf8')]));

const rows = columns.map((tc) => {
  const [table, col] = tc.split('.');
  const named = [];
  const writers = [];
  for (const [f, s] of src) {
    if (!new RegExp(`\\b${col}\\b`).test(s)) continue;
    // Narrow to files that also name the table, unless the column name is unique to it.
    if (!s.includes(table) && !s.includes(`'${col}`) && !s.includes(`${col}:`)) continue;
    named.push(f);
    const writes =
      new RegExp(`\\.(insert|update|upsert)\\([^)]*\\b${col}\\b`, 's').test(s) ||
      new RegExp(`\\b${col}\\s*:\\s*[^,}\\n]+[,}\\n][\\s\\S]{0,400}\\.(insert|update|upsert)\\(`).test(s) ||
      new RegExp(`\\.(insert|update|upsert)\\([\\s\\S]{0,600}\\b${col}\\s*:`).test(s) ||
      new RegExp(`name=["']${col}["']|formData\\.(get|has)\\(['"]${col}['"]\\)`).test(s);
    if (writes) writers.push(f);
  }
  return { column: tc, files: named.length, writers, readers: named.filter((f) => !writers.includes(f)) };
});

const MANILA = /\b14\.(5995|58|599)\b/;
const fallbacks = [];
for (const [f, s] of src) {
  if (f === 'lib/region-source.ts' || f.endsWith('_data/wedding-cities.ts')) continue;
  s.split('\n').forEach((line, i) => {
    if (MANILA.test(line) && /(1[12][01]\.\d)/.test(line)) fallbacks.push({ file: f, text: line.trim() });
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rows, fallbacks }, null, 2));
} else {
  console.log('LOCATION COLUMNS (prod snapshot) — files naming each, writers first\n');
  for (const r of rows) {
    const tag = r.files === 0 ? 'UNREAD' : r.writers.length === 0 ? 'NO WRITER SEEN' : '';
    console.log(`${r.column}  ${tag}`);
    for (const w of r.writers) console.log(`   W ${w}`);
    for (const x of r.readers.slice(0, 12)) console.log(`   r ${x}`);
    if (r.readers.length > 12) console.log(`   … ${r.readers.length - 12} more readers`);
  }
  console.log('\nHAND-TYPED MAP CENTRES (outside lib/region-source.ts and wedding-cities.ts)\n');
  for (const f of fallbacks) console.log(`   ${f.file}: ${f.text}`);
}

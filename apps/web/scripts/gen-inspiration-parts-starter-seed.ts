/**
 * gen-inspiration-parts-starter-seed.ts — emits the GENERATED SEED block of
 * `supabase/migrations/20271296836679_seed_the_starter_inspiration_parts.sql` from the owner-approved
 * review set's `parts.csv` (owner 2026-10-29, verbatim: "proposed inspiration starter yes."), so the
 * 272 NEW parts and their service links are copied, not typed.
 *
 *   Print:  pnpm -s tsx scripts/gen-inspiration-parts-starter-seed.ts <path/to/parts.csv>          (from apps/web)
 *   Check:  pnpm -s tsx scripts/gen-inspiration-parts-starter-seed.ts <path/to/parts.csv> --check  (exit 1 when
 *           the migration's block between the BEGIN/END GENERATED SEED markers differs from the CSV)
 *
 * The CSV is NOT in the repo (it is the owner's review set, `setnayan-handoff-src/carry-2026-10-29/
 * inspiration-parts-starter/parts.csv`); its sha256 is printed into the block so the source is pinned.
 *
 * What it reads: only `status = NEW` rows. A part is one `part_key_suggested`; its label is `part_label`
 * exactly as written (Filipino terms included); its order is the CSV's first appearance; its services
 * are its rows' `service_key`s in CSV order (the first one decides the home, in SQL, at apply time).
 * EXISTING rows are ignored — existing parts and their links are never touched by the seed.
 *
 * ⚠ An APPLIED migration is never edited. `--check` exists for the PR that adds the file; after it
 * merges, `tests/db/the-starter-inspiration-parts-seed-once.db.test.ts` is the guard.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION = join(
  __dirname,
  '../../../supabase/migrations/20271296836679_seed_the_starter_inspiration_parts.sql',
);
const BEGIN = '-- BEGIN GENERATED SEED (scripts/gen-inspiration-parts-starter-seed.ts)';
const END = '-- END GENERATED SEED';
const KEY = /^[a-z][a-z0-9_]{1,39}$/;

/** RFC 4180: quoted fields, doubled quotes, commas and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      out.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    out.push(row);
  }
  return out.filter((r) => r.length > 1 || r[0] !== '');
}

const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;

export function starterSeedSql(csvText: string): string {
  const [header, ...body] = parseCsv(csvText.replace(/^﻿/, ''));
  const col = (name: string) => {
    const i = header!.indexOf(name);
    if (i < 0) throw new Error(`parts.csv has no column ${name}`);
    return i;
  };
  const [cKey, cLabel, cSvc, cStatus] = [col('part_key_suggested'), col('part_label'), col('service_key'), col('status')];

  const parts = new Map<string, { label: string; services: string[] }>();
  for (const r of body) {
    if (r[cStatus] !== 'NEW') continue;
    const key = r[cKey]!;
    const label = r[cLabel]!;
    const svc = r[cSvc]!;
    if (!KEY.test(key)) throw new Error(`bad part key: ${key}`);
    if (!/^[a-z][a-z0-9_]*$/.test(svc)) throw new Error(`bad service key: ${svc}`);
    const p = parts.get(key) ?? { label, services: [] };
    if (p.label !== label) throw new Error(`${key} carries two labels: ${p.label} · ${label}`);
    if (!p.services.includes(svc)) p.services.push(svc);
    parts.set(key, p);
  }

  const sha = createHash('sha256').update(csvText).digest('hex');
  const partRows = [...parts].map(([k, p], i) => `  (${q(k)}, ${q(p.label)}, ${i + 1})`).join(',\n');
  const linkRows = [...parts]
    .flatMap(([k, p]) => p.services.map((s, i) => `  (${q(k)}, ${q(s)}, ${i + 1})`))
    .join(',\n');
  const links = [...parts.values()].reduce((n, p) => n + p.services.length, 0);
  return [
    BEGIN,
    `-- parts.csv sha256 ${sha} · ${parts.size} parts · ${links} links`,
    'INSERT INTO _starter_parts (slot_key, label_en, ord) VALUES',
    `${partRows};`,
    '',
    'INSERT INTO _starter_links (slot_key, canonical_service, ord) VALUES',
    `${linkRows};`,
    END,
  ].join('\n');
}

const csvPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!csvPath) {
  console.error('usage: gen-inspiration-parts-starter-seed.ts <path/to/parts.csv> [--check]');
  process.exit(2);
}
const block = starterSeedSql(readFileSync(csvPath, 'utf8'));
if (process.argv.includes('--check')) {
  const sql = readFileSync(MIGRATION, 'utf8');
  const a = sql.indexOf(BEGIN);
  const b = sql.indexOf(END);
  const have = a >= 0 && b > a ? sql.slice(a, b + END.length) : '';
  if (have !== block) {
    console.error('✗ the migration seed block differs from parts.csv — re-run and splice the output');
    process.exit(1);
  }
  console.log('✓ the migration seed block equals parts.csv');
} else {
  console.log(block);
}

/**
 * 📄 THE INSPIRATION PARTS ARE READ TO THE END (2026-10-30).
 *
 * PR #7058 put `inspiration_part_services` at ~2,769 rows. Every reader selected the whole relation in one request,
 * PostgREST capped it at 1,000 with `error: null`, and Admin › Categories › Reception › Events Place showed only its
 * 2 old parts — a truncated read drawn as "links nothing". Two halves keep it fixed:
 *
 *   A · THE HELPER (`readEveryPartRow`, over the house's one paging helper `readAllPages`) returns EVERY row from a
 *       server that hands out 1,000 a page — and any cap below that — ordered by a unique key, proved against the
 *       server's count; a failed page, a missing count, or a read that stops short is an ERROR, never a partial list.
 *   B · THE SOURCE GUARD: no reader of `inspiration_parts`, `inspiration_part_services`,
 *       `inspiration_part_categories_derived` (or the legacy `inspiration_part_categories`) selects the relation
 *       unbounded. The PROPERTY, not a phrasing: a `.from('<relation>')` chain that SELECTs must be narrowed to one
 *       part (`slot_key` / `home_category_id` filter, `.single()`/`.maybeSingle()`), a head count, or ranged with an
 *       exact count; and the relation's name may not be held anywhere a `.from()` scan cannot see it (a constant
 *       passed to `.from(T)`), except the helper's own table, whose one chain is held to the same property.
 *
 *       (A schema map that runs no query — the Ugat graph's `table:` / `references:` entries — names them as data.)
 *
 * 🛡 Sabotaged 2026-10-30 (builder): (1) the old one-request select put back into `getInspirationParts` → B red;
 * (2) `const T = 'inspiration_part_services'; sb.from(T).select(…)` → B red ("held outside a .from()");
 * (3) the helper's `if (!read.complete)` branch removed → A red ("a read with no count…"). All restored.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { readEveryPartRow, readInspirationPartTables, type PartPageQuery, type PartTablesClient } from './inspiration-parts-read';

// ── A · the helper ─────────────────────────────────────────────────────────────────────────────────────────────

type Call = { table: string; columns: string; count: unknown; order: string[]; from: number; to: number };

/** A fake PostgREST: `rows` per table, at most `cap` per request, an exact count unless `noCount`. */
function fakeServer(tables: Record<string, Array<Record<string, unknown>>>, opts: { cap?: number; noCount?: boolean; failAtPage?: number } = {}) {
  const calls: Call[] = [];
  const client: PartTablesClient = {
    from(table) {
      return {
        select(columns, options) {
          const order: string[] = [];
          const q: PartPageQuery = {
            order(col) {
              order.push(col);
              return q;
            },
            range(from, to) {
              calls.push({ table, columns, count: options?.count, order: [...order], from, to });
              const all = tables[table] ?? [];
              if (opts.failAtPage !== undefined && calls.filter((c) => c.table === table).length === opts.failAtPage + 1) {
                return Promise.resolve({ data: null, error: { message: 'boom' }, count: null });
              }
              const n = Math.min(to - from + 1, opts.cap ?? 1000);
              return Promise.resolve({ data: all.slice(from, from + n), error: null, count: opts.noCount ? null : all.length });
            },
          };
          return q;
        },
      };
    },
  };
  return { client, calls };
}

const links = (n: number) => Array.from({ length: n }, (_, i) => ({ slot_key: `p${String(i).padStart(5, '0')}`, canonical_service: 'events_place', sort_order: i }));

test('A1 · all 2,769 link rows come back from a server that serves 1,000 a page', async () => {
  const { client, calls } = fakeServer({ inspiration_part_services: links(2769) });
  const got = await readEveryPartRow<{ slot_key: string }>(client, 'services');
  assert.equal(got.error, null);
  assert.equal(got.rows.length, 2769);
  assert.deepEqual(got.rows.map((r) => r.slot_key), links(2769).map((r) => r.slot_key), 'a row skipped or repeated');
  assert.deepEqual(calls.map((c) => [c.from, c.to]), [[0, 999], [1000, 1999], [2000, 2999]]);
  for (const c of calls) {
    assert.equal(c.count, 'exact', 'completeness must be proved against the exact count');
    assert.deepEqual(c.order, ['slot_key', 'canonical_service'], 'not ordered by the unique key');
  }
});

test('A2 · a server cap BELOW the page size still reaches every row (the next window starts at what arrived)', async () => {
  const { client } = fakeServer({ inspiration_part_services: links(2769) }, { cap: 250 });
  const got = await readEveryPartRow(client, 'services');
  assert.equal(got.error, null);
  assert.equal(got.rows.length, 2769);
});

test('A3 · a read with no count cannot prove it finished → an error, no rows', async () => {
  const { client } = fakeServer({ inspiration_part_services: links(1500) }, { noCount: true });
  const got = await readEveryPartRow(client, 'services');
  assert.ok(got.error, 'a read that could not prove completeness came back as a whole list');
  assert.equal(got.rows.length, 0, 'a partial list was handed back beside the error');
});

test('A4 · a page that fails mid-read → an error naming the relation, no rows', async () => {
  const { client } = fakeServer({ inspiration_part_services: links(2769) }, { failAtPage: 1 });
  const got = await readEveryPartRow(client, 'services');
  assert.match(String(got.error), /inspiration_part_services: boom/);
  assert.equal(got.rows.length, 0);
});

test('A5 · the snapshot read pages all three relations and fails as one', async () => {
  const tables = {
    inspiration_parts: [{ slot_key: 'a' }],
    inspiration_part_categories_derived: Array.from({ length: 1200 }, (_, i) => ({ slot_key: 'a', category_id: `c${i}`, sort_order: i })),
    inspiration_part_services: links(2769),
  };
  const ok = await readInspirationPartTables(fakeServer(tables).client);
  assert.equal(ok.error, null);
  assert.deepEqual([ok.parts.length, ok.categories.length, ok.services.length], [1, 1200, 2769]);
  const bad = await readInspirationPartTables(fakeServer(tables, { noCount: true }).client);
  assert.ok(bad.error, 'one relation that could not finish must fail the whole snapshot');
});

// ── B · the source guard ───────────────────────────────────────────────────────────────────────────────────────

const RELATIONS = ['inspiration_parts', 'inspiration_part_services', 'inspiration_part_categories_derived', 'inspiration_part_categories'];
const HELPER = 'lib/inspiration-parts-read.ts';
const WEB = join(__dirname, '..');
const ROOTS = ['app', 'lib', 'components', 'models', 'types'];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
    }
  };
  for (const r of ROOTS) {
    try {
      walk(join(WEB, r));
    } catch {
      /* a root that does not exist */
    }
  }
  return out;
}

/** The query expression starting at `start` (a `.from(`), up to the `;` / `,` / closing bracket that ends it. Strings skipped. */
function chainFrom(src: string, start: number): string {
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i]!;
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      for (i += 1; i < src.length && src[i] !== q; i += 1) if (src[i] === '\\') i += 1;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth < 0) return src.slice(start, i);
    } else if ((ch === ';' || ch === ',') && depth === 0) return src.slice(start, i);
  }
  return src.slice(start);
}

/** null = bounded; else why the chain is an unbounded read. */
function unboundedReason(chain: string): string | null {
  if (/\.(insert|update|delete|upsert)\(/.test(chain)) return null; // a write (a RETURNING select is its own rows)
  if (!/\.select\(/.test(chain)) return null;
  if (/head:\s*true/.test(chain)) return null;
  if (/\.(eq|in)\(\s*['"](slot_key|home_category_id)['"]/.test(chain) || /\.(maybeSingle|single)\(/.test(chain)) return null;
  if (/\.range\(/.test(chain) && /count:\s*['"]exact['"]/.test(chain)) return null;
  return 'selects the whole relation in one request — PostgREST returns at most 1,000 rows with error: null';
}

type Finding = { file: string; relation: string; why: string };

function scan(): { findings: Finding[]; fromChains: number; files: Set<string> } {
  const findings: Finding[] = [];
  const files = new Set<string>();
  let fromChains = 0;
  const lit = new RegExp(`(['"\`])(${RELATIONS.join('|')})\\1`, 'g');
  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, 'utf8');
    const file = relative(WEB, abs);
    for (const m of src.matchAll(lit)) {
      const at = m.index!;
      const before = src.slice(Math.max(0, at - 80), at);
      const relation = m[2]!;
      files.add(file);
      const fromAt = before.match(/\.from\(\s*$/);
      if (fromAt) {
        fromChains += 1;
        const why = unboundedReason(chainFrom(src, at - fromAt[0].length));
        if (why) findings.push({ file, relation, why });
        continue;
      }
      if (/target_table:\s*$/.test(before)) continue; // an audit label, not a read
      if (/headCount\([^,()]+,\s*$/.test(before)) continue; // a head count
      if (file === HELPER) continue; // PART_RELATIONS — its one chain is held below
      // A schema map (the Ugat graph) names the relation as DATA about the schema — `table:` / `references:` /
      // `name:` / `joint:` — in a file that runs no query at all. Only there; a constant in a file that queries, or a
      // bare `const T = '…'`, is still a reader this guard cannot see.
      if (/\b(table|references|name|joint):\s*$/.test(before) && !/\.from\(|\.rpc\(|create(Admin)?Client\(/.test(src)) continue;
      // A backtick-quoted name inside a comment (`inspiration_part_services`) is prose, not a value.
      const lineStart = src.lastIndexOf('\n', at) + 1;
      const line = src.slice(lineStart, at);
      if (m[1] === '`' && (/^\s*(\*|\/\/|\/\*)/.test(line) || /\/\/|\/\*/.test(line))) continue;
      if (m[1] === '`' && isInsideBlockComment(src, at)) continue;
      findings.push({ file, relation, why: 'the name is held outside a .from() — a reader this guard cannot see (use lib/inspiration-parts-read.ts)' });
    }
  }
  return { findings, fromChains, files };
}

function isInsideBlockComment(src: string, at: number): boolean {
  const open = src.lastIndexOf('/*', at);
  return open !== -1 && src.lastIndexOf('*/', at) < open;
}

test('B0 · the classifier: unbounded is caught, bounded passes (the property, on synthetic chains)', () => {
  const bad = [
    `sb.from('inspiration_part_services').select('slot_key,canonical_service,sort_order'),`,
    `await admin.from('inspiration_parts').select('slot_key, sort_order');`,
    `admin.from('inspiration_parts').select('*').order('slot_key').limit(5000)`,
    `admin.from('inspiration_parts').select('*').range(0, 999)`,
  ];
  const good = [
    `admin.from('inspiration_parts').select('slot_key').eq('slot_key', k).maybeSingle();`,
    `admin.from('inspiration_part_services').select('canonical_service').eq('slot_key', slotKey);`,
    `admin.from('inspiration_parts').select('slot_key').eq('home_category_id', homeId);`,
    `admin.from('inspiration_part_services').insert({ slot_key: k });`,
    `admin.from('inspiration_parts').select('*', { count: 'exact', head: true });`,
    `c.from('inspiration_parts').select('a', { count: 'exact' }).order('slot_key').range(from, to);`,
  ];
  for (const s of bad) assert.ok(unboundedReason(chainFrom(s, s.indexOf('.from('))), `not caught: ${s}`);
  for (const s of good) assert.equal(unboundedReason(chainFrom(s, s.indexOf('.from('))), null, `flagged: ${s}`);
  // A Promise.all element ends at its comma — the next element's .range() must not excuse it.
  const pair = `Promise.all([sb.from('inspiration_parts').select('a'), sb.from('x').select('b', { count: 'exact' }).range(0, 9)])`;
  assert.ok(unboundedReason(chainFrom(pair, pair.indexOf('.from('))), 'a sibling chain excused an unbounded one');
});

test('B1 · no reader of the inspiration-part relations selects them unbounded', () => {
  const { findings, fromChains, files } = scan();
  // Non-vacuity: the scan reaches the readers it is about (the admin writes hold bounded `.from('inspiration_…')` chains).
  assert.ok(fromChains >= 10, `only ${fromChains} .from('inspiration_…') chains seen — the scan is not reaching the source`);
  assert.ok(files.has('app/admin/categories/_components/taxonomy-writes.ts'), 'the scan missed taxonomy-writes.ts');
  assert.ok(files.has(HELPER), 'the scan missed the helper');
  assert.deepEqual(
    findings.map((f) => `${f.file} · ${f.relation} · ${f.why}`),
    [],
    'read these relations through lib/inspiration-parts-read.ts (readEveryPartRow / readInspirationPartTables)',
  );
});

test("B2 · the helper's own one chain is ranged, counted, ordered and paged by readAllPages", () => {
  const src = readFileSync(join(WEB, HELPER), 'utf8');
  const chains = [...src.matchAll(/\.from\(/g)];
  assert.equal(chains.length, 1, 'the helper grew a second .from() — hold it to the same property');
  assert.match(src, /\.from\(spec\.table\)\.select\([^)]*\{ count: 'exact' \}\)/);
  assert.match(src, /q\.order\(col, \{ ascending: true \}\)/);
  assert.match(src, /q\.range\(from, to\)/);
  assert.match(src, /import \{ readAllPages \} from '\.\/read-all-pages'/);
});

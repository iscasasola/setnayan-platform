/**
 * Generate `supabase/security/prod-schema.snapshot.txt` — the committed record
 * of what production's `public` schema ACTUALLY holds, plus the migration
 * ledger that produced it.
 *
 * The snapshot is the prod half of the drift check in
 * `apps/web/tests/db/schema-drift.db.test.ts`. That test replays the migrations
 * into PGlite and compares; committing the prod half is what lets the
 * comparison run in CI on a pull request with NO production credentials.
 *
 * It records which columns EXIST and which are NOT NULL. Nullability was added
 * on 2026-09-06 after two defects shipped past a guard that compared names
 * only — see the `[notnull]` note on the column query below.
 *
 * WHY BOTH HALVES ARE NEEDED, AND WHY THE LEDGER IS IN THE FILE
 * -------------------------------------------------------------
 * `CREATE TABLE IF NOT EXISTS` silently no-ops when the table already exists in
 * a different shape. The columns inside never land, the statement succeeds,
 * `supabase db push` reports success, and the version is written to
 * `schema_migrations`. The ledger says applied; the schema disagrees.
 *
 * Recording the ledger alongside the columns is what makes the check precise
 * rather than noisy. The test replays ONLY the migrations this snapshot says
 * prod has applied, so a migration added in an open PR (correctly absent from
 * prod) is skipped instead of reported as drift. Once that migration is applied
 * and the snapshot refreshed, the same comparison becomes the thing that
 * catches it if it silently no-opped.
 *
 * USAGE (needs prod credentials — run locally, never from a PR):
 *   export SUPABASE_DB_URL='postgresql://...'
 *   pnpm --filter @setnayan/web schema:snapshot
 *   git add supabase/security/prod-schema.snapshot.txt && git commit
 *
 * Refresh it whenever migrations are applied to prod. A stale snapshot does not
 * make the check unsafe — it makes it complain — and the complaint names the
 * refresh command.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SNAPSHOT_PATH_FROM_REPO_ROOT,
  renderSnapshot,
  type ProdSnapshot,
} from '../tests/db/schema-snapshot';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/scripts
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = path.join(REPO_ROOT, SNAPSHOT_PATH_FROM_REPO_ROOT);

/**
 * `supabase db query` output shape varies by connection mode: `--db-url` prints
 * ONE envelope object ({boundary, rows, warning}); `--linked` prints the
 * boundary and rows as SEPARATE top-level JSON values. Both are preceded by a
 * CLI upgrade notice. Scan for every balanced top-level JSON value and collect
 * rows from an array, an envelope's `.rows`, or a bare row object.
 *
 * Deliberately a copy of the same idea as scripts/migration-doctor.mjs
 * `extractLedgerRows` rather than an import: that file is `.mjs` and untyped,
 * and this generator is not on any hot path where a second 30-line parser is a
 * real cost.
 */
function extractRows<T>(raw: string): T[] {
  const values: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}' || c === ']') {
      if (depth > 0 && --depth === 0 && start >= 0) {
        try {
          values.push(JSON.parse(raw.slice(start, i + 1)));
        } catch {
          /* not a complete JSON value — skip */
        }
        start = -1;
      }
    }
  }
  const out: T[] = [];
  for (const v of values) {
    const env = v as { rows?: unknown };
    const arr = Array.isArray(v) ? v : Array.isArray(env?.rows) ? env.rows : null;
    if (arr) out.push(...(arr as T[]));
  }
  return out;
}

function query<T>(sql: string): T[] {
  // TWO WAYS IN, and the linked one exists so nobody has to handle a raw
  // production password to refresh a snapshot.
  //
  //   1. `supabase link` (preferred) — the CLI holds the credential in the OS
  //      keychain. Nothing is pasted into a shell, so nothing reaches shell
  //      history, and no human ever copies the password around.
  //   2. SUPABASE_DB_URL — still honoured, and still wins when both are
  //      available, because CI and one-off recovery need an explicit target.
  //
  // `extractRows` above already parses BOTH output shapes: --db-url prints one
  // envelope object, --linked prints the boundary and rows as separate
  // top-level values. That was written before this branch existed, so the
  // parser has always been ready; only the invocation was not.
  const dbUrl = process.env.SUPABASE_DB_URL;
  const linked = fs.existsSync(path.join(REPO_ROOT, 'supabase', '.temp', 'project-ref'));

  if (!dbUrl && !linked) {
    console.error(
      '✗ No way to reach production. This generator reads PRODUCTION and cannot run without one.\n' +
        '\n  EITHER link the project once (no password pasted into a shell):\n' +
        '    supabase login                 # opens your browser\n' +
        '    supabase link --project-ref njrupjnvkjkitfctetvi\n' +
        '\n  OR pass the URL explicitly, keeping it out of shell history:\n' +
        "    read -rs 'SUPABASE_DB_URL?Connection string: ' && export SUPABASE_DB_URL",
    );
    process.exit(1);
  }

  const args = dbUrl
    ? ['db', 'query', '--db-url', dbUrl, '-o', 'json', sql]
    : ['db', 'query', '--linked', '-o', 'json', sql];
  const raw = execFileSync('supabase', args, {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return extractRows<T>(raw);
}

async function main(): Promise<void> {
  // 1. The ledger: which migrations does prod claim to have applied?
  const ledgerRows = query<{ version: string }>(
    'select version from supabase_migrations.schema_migrations order by version',
  );
  const ledger = ledgerRows.map((r) => String(r.version)).sort();

  // 2. The columns of every `public` BASE TABLE. `information_schema` rather
  //    than pg_catalog so the definition of "a table" matches what the test's
  //    own docblock claims, and dropped columns are excluded for free.
  //    `n` carries whether prod ENFORCES NOT NULL. Recorded because the guard
  //    compared column NAMES only until 2026-09-06, and that blind spot let two
  //    defects through in one day: a SET NULL foreign key on a column prod had
  //    marked NOT NULL (which would have made admin accounts undeletable), and a
  //    feature whose every insert wrote `user_id: null` into a column prod had
  //    marked NOT NULL (so it could not have run once). Both were caught by hand
  //    against prod's catalog; neither was visible to any test.
  const colRows = query<{ t: string; c: string; n: string }>(`
    select c.table_name as t, c.column_name as c, c.is_nullable as n
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = c.table_schema
       and tb.table_name = c.table_name
       and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'public'
     order by c.table_name, c.column_name
  `);
  const columns = colRows.map((r) => `${r.t}.${r.c}`).sort();
  // information_schema spells it 'NO' / 'YES', never a boolean.
  const notnull = colRows
    .filter((r) => String(r.n).toUpperCase() === 'NO')
    .map((r) => `${r.t}.${r.c}`)
    .sort();

  if (ledger.length === 0) throw new Error('ledger query returned nothing — refusing to write an empty snapshot');
  if (columns.length === 0) throw new Error('column query returned nothing — refusing to write an empty snapshot');

  if (notnull.length === 0) {
    throw new Error(
      'no NOT NULL columns found — refusing to write a snapshot that would turn the ' +
        'nullability half of the drift guard into a comparison against nothing',
    );
  }

  const snapshot: ProdSnapshot = { ledger, columns, notnull };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, renderSnapshot(snapshot), 'utf8');

  const tables = new Set(columns.map((c) => c.slice(0, c.indexOf('.')))).size;
  console.log(
    `✓ wrote ${SNAPSHOT_PATH_FROM_REPO_ROOT}\n` +
      `    ledger:  ${ledger.length} migrations (head ${ledger[ledger.length - 1]})\n` +
      `    schema:  ${tables} tables, ${columns.length} columns (${notnull.length} NOT NULL)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
// Diagnose (and explain how to fix) Supabase migration drift between the prod
// ledger (`supabase_migrations.schema_migrations`) and the migration FILES.
//
// Why this exists: ~every migration incident in this repo is one class — a
// migration reaches prod's ledger BEFORE its PR merges (a local `db push` from
// a feature worktree, an MCP apply, or a raw `db query`). That creates an
// "orphan" (ledger row, no file on `main`), which makes `supabase db push`
// refuse for EVERYONE ("Remote migration versions not found in local migrations
// directory") — and later-merged migrations then silently strand (shipped in
// code via Vercel, never applied to the DB) until a user hits a broken feature.
// Diagnosing it by hand each time meant re-deriving a 30-step playbook. This is
// that playbook as one command.
//
// Two drift kinds:
//   ORPHAN    version in the prod ledger, NO file on main  -> JAMS `db push`.
//   STRANDED  file on main, NOT in the prod ledger         -> merged but never
//             applied -> the feature it gates errors in prod.
//
// Usage:
//   pnpm migration:doctor                 # compare prod ledger vs origin/main
//   pnpm migration:doctor --worktree      # ...vs your current working tree
//   node scripts/migration-doctor.mjs --linked   # CI: use the linked project
//   node scripts/migration-doctor.mjs --json     # machine-readable
//
// Connection (first that applies):
//   --linked                use the linked Supabase project (CI, post `supabase link`)
//   --db-url <url>          explicit connection string
//   $SUPABASE_DB_URL        default
//
// Exit code: 0 = healthy (or only within-grace freshly-merged files); 1 = drift
// that needs action (any orphan, or a stranded file older than the grace window).

import { readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── pure, unit-tested core ────────────────────────────────────────────────
const VERSION_RE = /^(\d{14})_.+\.sql$/;
const versionOf = (filename) => VERSION_RE.exec(filename)?.[1] ?? null;

/**
 * Split migrations into drift buckets.
 * @param {string[]} localVersions   14-digit versions present as FILES (main or worktree)
 * @param {{version:string,name:string}[]} ledgerRows  rows from schema_migrations
 * @returns {{orphans:{version:string,name:string}[], stranded:string[], okCount:number}}
 */
export function classifyDrift(localVersions, ledgerRows) {
  const localSet = new Set(localVersions);
  const ledgerSet = new Set(ledgerRows.map((r) => r.version));
  const orphans = ledgerRows
    .filter((r) => !localSet.has(r.version))
    .sort((a, b) => a.version.localeCompare(b.version));
  const stranded = localVersions
    .filter((v) => !ledgerSet.has(v))
    .sort();
  const okCount = localVersions.filter((v) => ledgerSet.has(v)).length;
  return { orphans, stranded, okCount };
}

// ── IO helpers (not unit-tested) ──────────────────────────────────────────
function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000, ...opts })
    .toString()
    .trim();
}
function shSafe(cmd) {
  try {
    return sh(cmd);
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const a = { worktree: false, linked: false, dbUrl: process.env.SUPABASE_DB_URL || '', json: false, graceMin: 20 };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--worktree') a.worktree = true;
    else if (t === '--linked') a.linked = true;
    else if (t === '--json') a.json = true;
    else if (t === '--db-url') a.dbUrl = argv[++i] || '';
    else if (t === '--grace-min') a.graceMin = Number(argv[++i]) || 0;
  }
  return a;
}

/** Read the prod ledger via the Supabase CLI (`db query`, JSON output). */
function readLedger(args) {
  const conn = args.linked ? '--linked' : args.dbUrl ? `--db-url ${JSON.stringify(args.dbUrl)}` : '';
  if (!conn) {
    console.error('✗ No database connection. Pass --linked (CI), --db-url <url>, or set $SUPABASE_DB_URL.');
    process.exit(2);
  }
  const sql = 'select version, name from supabase_migrations.schema_migrations order by version';
  let raw;
  try {
    raw = execSync(`supabase db query ${conn} -o json ${JSON.stringify(sql)}`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
      env: { ...process.env, DO_NOT_TRACK: '1' },
    }).toString();
  } catch (e) {
    console.error('✗ Could not read the migration ledger from the database.');
    console.error(String(e.stderr || e.message || e).split('\n').slice(-3).join('\n'));
    process.exit(2);
  }
  // The CLI prints an upgrade notice before the JSON; slice from the first "{".
  const jsonStart = raw.indexOf('{');
  const parsed = JSON.parse(raw.slice(jsonStart));
  return (parsed.rows || []).map((r) => ({ version: String(r.version), name: String(r.name ?? '') }));
}

/** Local migration versions — origin/main (default) or the working tree. */
function readLocalVersions(args) {
  if (args.worktree) {
    return readdirSync(join(repoRoot, 'supabase', 'migrations'))
      .map(versionOf)
      .filter(Boolean);
  }
  shSafe('git fetch --quiet origin main');
  return shSafe('git ls-tree -r --name-only origin/main -- supabase/migrations')
    .split('\n')
    .map((p) => versionOf(p.replace(/.*\//, '')))
    .filter(Boolean);
}

/** Best-effort: which remote branch still carries an orphan's file? */
function findOwningBranch(version) {
  shSafe('git fetch --quiet origin');
  const branches = shSafe("git for-each-ref --format=%(refname:short) refs/remotes/origin")
    .split('\n')
    .filter((b) => b && b !== 'origin/HEAD' && b !== 'origin/main');
  for (const b of branches) {
    const hit = shSafe(`git ls-tree -r --name-only ${b} -- supabase/migrations`)
      .split('\n')
      .find((p) => p.includes(`${version}_`));
    if (hit) return { branch: b, file: hit };
  }
  return null;
}

/** Commit age (seconds) of a stranded file on origin/main; null if unknown. */
function fileAgeSeconds(version) {
  const path = shSafe(`git ls-tree -r --name-only origin/main -- supabase/migrations`)
    .split('\n')
    .find((p) => p.includes(`${version}_`));
  if (!path) return null;
  const ct = shSafe(`git log -1 --format=%ct origin/main -- ${JSON.stringify(path)}`);
  if (!ct) return null;
  const now = Number(shSafe('git log -1 --format=%ct origin/main')) || Math.floor(Date.now() / 1000);
  return now - Number(ct);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseline = args.worktree ? 'working tree' : 'origin/main';

  const localVersions = readLocalVersions(args);
  const ledger = readLedger(args);
  const { orphans, stranded, okCount } = classifyDrift(localVersions, ledger);

  // Split stranded into "freshly merged (grace)" vs "real" using commit age.
  const graceSec = args.graceMin * 60;
  const strandedDetailed = stranded.map((v) => {
    const age = args.worktree ? null : fileAgeSeconds(v);
    const fresh = age !== null && age < graceSec;
    return { version: v, ageSec: age, fresh };
  });
  const realStranded = strandedDetailed.filter((s) => !s.fresh);
  const freshStranded = strandedDetailed.filter((s) => s.fresh);

  const orphansDetailed = orphans.map((o) => ({ ...o, owner: findOwningBranch(o.version) }));

  if (args.json) {
    console.log(JSON.stringify({ baseline, okCount, orphans: orphansDetailed, stranded: strandedDetailed }, null, 2));
  } else {
    console.log(`\nMigration doctor — prod ledger vs ${baseline}`);
    console.log(`  ${ledger.length} ledger rows · ${localVersions.length} files · ${okCount} in sync\n`);

    if (orphansDetailed.length) {
      console.log(`✗ ${orphansDetailed.length} ORPHAN(S) — in the prod ledger, NO file on ${baseline}.`);
      console.log('  These JAM `supabase db push` for every branch until reconciled.');
      for (const o of orphansDetailed) {
        console.log(`    • ${o.version}  ${o.name || '(name unknown)'}`);
        if (o.owner) {
          console.log(`        applied ahead of merge from ${o.owner.branch}`);
          console.log(`        FIX (surgical unjam — land only the file onto main, byte-identical):`);
          console.log(`          git show ${o.owner.branch}:${o.owner.file} > ${o.owner.file}`);
          console.log(`          # then commit that one file, PR it, auto-merge`);
        } else {
          console.log(`        owning branch not found locally. If its PR is abandoned, revert the ledger row:`);
          console.log(`          supabase migration repair --status reverted ${o.version} --db-url "$SUPABASE_DB_URL"`);
          console.log(`        Otherwise land its file onto main (find it: gh pr list ; git log --all -- '*${o.version}_*').`);
        }
      }
      console.log('');
    }

    if (realStranded.length) {
      console.log(`✗ ${realStranded.length} STRANDED — merged to main, NOT applied to prod.`);
      console.log('  The feature each gates errors in prod until applied.');
      for (const s of realStranded) {
        const mins = s.ageSec != null ? ` (merged ${Math.round(s.ageSec / 60)} min ago)` : '';
        console.log(`    • ${s.version}${mins}`);
      }
      console.log('  FIX: apply via CI —  gh workflow run supabase-migrations.yml --ref main');
      console.log('       (or, from a clean up-to-date main worktree:  pnpm db:push)\n');
    }

    if (freshStranded.length) {
      console.log(`… ${freshStranded.length} freshly-merged file(s) not yet applied (within ${args.graceMin}-min grace — normal post-merge latency, not drift).\n`);
    }

    if (!orphansDetailed.length && !realStranded.length) {
      console.log('✓ Healthy — no orphans, nothing stranded. `db push` will run clean.\n');
    }
  }

  process.exit(orphansDetailed.length || realStranded.length ? 1 : 0);
}

// Run only when invoked directly (so the test file can import the pure fn).
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

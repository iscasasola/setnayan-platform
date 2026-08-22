#!/usr/bin/env node
/**
 * lint-migrations-never-deleted.mjs
 *
 * Fails when a migration that this repo has previously carried is GONE.
 *
 * ─── WHY THIS EXISTS: PRODUCTION STOPPED DEPLOYING FOR AN HOUR ──────────────
 * On 2026-08-21 PR #4700 merged from a branch cut days earlier. A merge from a
 * stale branch does not just miss new work — it DELETES what landed while the
 * branch was open. That one merge removed 24 files and reverted 43 more, wiping
 * most of four already-merged PRs (#4686 #4695 #4696 #4699), including three
 * migrations that were ALREADY APPLIED IN PRODUCTION.
 *
 * `supabase db push` then refused to run: three versions sat in prod's
 * `schema_migrations` with no file in the repo. `deploy-prod.yml` applies
 * migrations BEFORE firing the Vercel deploy hook, so the hook never fired and
 * the site simply stopped updating — six merges built green and reached nobody.
 *
 * 🔑 CI COULD NOT SEE ANY OF IT, AND THAT IS THE WHOLE POINT OF THIS FILE.
 * The clobber took the CALLING CODE with the feature, so the repo was left
 * internally consistent: no dangling import, no type error, no failing test,
 * nothing to grep for. Every check on that PR passed. The only symptom was a
 * deploy that stopped, four features away from the cause.
 *
 * ─── WHAT IT CHECKS ────────────────────────────────────────────────────────
 * `supabase/migrations.manifest.txt` lists every migration version this repo has
 * ever carried. A version in the manifest with no matching file is a DELETION
 * and fails. That is the only direction that is ever wrong: an applied migration
 * is immutable — the repo's own CLAUDE.md says applied migrations are never
 * edited — so a file disappearing is always either a stale-branch clobber or a
 * hand-revert of history, and both need a human.
 *
 * ⚖ A NEW migration that is not yet in the manifest is NOT a failure. It only
 * prints a note asking for a regenerate. That asymmetry is deliberate: making
 * "unlisted" fatal would block every open PR in a repo where several sessions
 * merge in parallel, to catch a case (add-then-delete inside one day) far rarer
 * than the one that actually cost production an hour. A guard that halts honest
 * work gets weakened; one that only fires on real loss survives.
 *
 * Regenerate after adding migrations:
 *   node apps/web/scripts/lint-migrations-never-deleted.mjs --write
 *
 * 🪤 THE MANIFEST IS A LEDGER, NOT A WISH LIST. Never delete a line to make this
 * pass. A red line here means a migration this repo used to have is missing, and
 * the fix is to restore the FILE — from `git log --all --diff-filter=A -- <path>`
 * if it is not on main any more. If a migration was genuinely, deliberately
 * reverted in production too, say so on its line after a `#`.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');
const MANIFEST = join(REPO_ROOT, 'supabase', 'migrations.manifest.txt');

const WRITE = process.argv.includes('--write');

/** Every migration on disk, as version -> filename. */
function onDisk() {
  const out = new Map();
  for (const f of readdirSync(MIGRATIONS_DIR)) {
    if (!f.endsWith('.sql')) continue;
    const version = f.split('_')[0];
    if (!/^\d{14}$/.test(version)) continue;
    out.set(version, f);
  }
  return out;
}

const disk = onDisk();

if (WRITE) {
  const header = [
    '# MIGRATION LEDGER — GENERATED, APPEND-ONLY IN SPIRIT.',
    '#',
    '# Every migration version this repo has carried. `lint:migrations-kept` fails',
    '# when a line here has no file — which is how a merge from a stale branch',
    '# silently deleting an APPLIED migration gets caught, instead of being found',
    '# an hour later in a production deploy that stopped firing.',
    '#',
    '# Regenerate: node apps/web/scripts/lint-migrations-never-deleted.mjs --write',
    '# NEVER delete a line to go green — restore the migration file instead.',
    '#',
    `# versions: ${disk.size}`,
    '',
  ].join('\n');
  const body = [...disk.keys()].sort().map((v) => `${v}\t${disk.get(v)}`).join('\n');
  writeFileSync(MANIFEST, `${header}${body}\n`);
  console.log(`✓ migrations.manifest.txt written — ${disk.size} versions.`);
  process.exit(0);
}

if (!existsSync(MANIFEST)) {
  console.error('✗ supabase/migrations.manifest.txt is missing. Generate it with --write.');
  process.exit(1);
}

const listed = new Map();
for (const raw of readFileSync(MANIFEST, 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const [version, name] = line.split('\t');
  if (/^\d{14}$/.test(version ?? '')) listed.set(version, (name ?? '').split('#')[0].trim());
}

const missing = [...listed.keys()].filter((v) => !disk.has(v)).sort();
const unlisted = [...disk.keys()].filter((v) => !listed.has(v)).sort();

if (unlisted.length) {
  console.log(
    `note: ${unlisted.length} migration(s) not yet in the ledger — run with --write to record them.`,
  );
}

if (missing.length) {
  console.error(
    `\n✗ ${missing.length} migration(s) this repo used to carry are GONE:\n` +
      missing.map((v) => `    ${v}  ${listed.get(v) ?? ''}`).join('\n') +
      '\n\n  A migration file does not disappear on purpose. The usual cause is a merge\n' +
      '  from a branch cut before it landed, which deletes it with no other symptom —\n' +
      '  that is what stopped production deploying on 2026-08-21.\n\n' +
      '  If it is applied in production, `supabase db push` will now REFUSE to run\n' +
      '  and the site will stop updating.\n\n' +
      '  Recover the file, do not edit this ledger:\n' +
      `    git log --all --oneline --diff-filter=A -- 'supabase/migrations/${missing[0]}_*.sql'\n` +
      `    git checkout <that-commit> -- supabase/migrations/${missing[0]}_*.sql\n`,
  );
  process.exit(1);
}

console.log(`✓ migration ledger: all ${listed.size} recorded migrations still present.`);

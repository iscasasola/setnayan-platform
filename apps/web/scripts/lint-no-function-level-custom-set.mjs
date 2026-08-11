#!/usr/bin/env node
/**
 * GUARD — a migration must not declare a FUNCTION-LEVEL `SET` on a custom
 * `setnayan.*` parameter. Production refuses to create such a function.
 *
 * ── WHY THIS IS A LINT AND NOT A DB TEST ────────────────────────────────────
 * Because no db test CAN catch it. The PGlite replay every `*.db.test.ts` runs
 * against executes as a SUPERUSER, and a superuser may set any parameter. The
 * one environment that would notice is the one that permits it.
 *
 * Measured, 2026-08-11 — migration `20271132819490` did exactly this:
 *
 *     CREATE FUNCTION admin_correct_business_slug(...)
 *       SET setnayan.allow_slug_change TO 'on'
 *
 * 8 db tests green · typecheck green · 18 CI checks green · PR merged — and
 * `supabase db push` was REJECTED on the way into prod:
 *
 *     ERROR: permission denied to set parameter "setnayan.allow_slug_change"
 *            (SQLSTATE 42501)
 *
 * A function-level `SET` is validated AT CREATE TIME and requires `SET`
 * privilege on the parameter. Supabase's `postgres` role is not a superuser and
 * does not hold it for a custom placeholder. The deploy is migrate-then-deploy,
 * so the app half was correctly held back too — the feature simply did not
 * exist, in either half, while every signal said it had shipped.
 *
 * ✅ THE SUPPORTED SHAPE, verified against prod: set it AT RUNTIME with
 * `set_config('setnayan.x', 'on', true)` and RESTORE THE CALLER'S PRIOR VALUE on
 * every exit path, including from an exception handler. `SET LOCAL` in the body
 * is NOT the answer either — it lasts to the end of the TRANSACTION, so the
 * hatch stays open for whatever the caller does next.
 *
 * Scope is deliberately narrow — `setnayan.*` only. `SET search_path` and
 * `SET row_security` are ordinary, supported, and used across this repo; a
 * guard that cried wolf on those would teach everyone to skim past it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '../../../supabase/migrations');

/**
 * A function-level SET appears BETWEEN the signature and the `AS $body$`, so it
 * is always on its own line at statement level. Matching `^\s*SET\s+setnayan\.`
 * finds those without reaching inside a body, where the same words appear in an
 * ordinary `SET LOCAL` statement (which this guard does not police) — and
 * without matching an `UPDATE ... SET` clause, which never starts a line with
 * `SET setnayan.`.
 */
const FUNCTION_LEVEL_SET = /^[ \t]*SET[ \t]+setnayan\.[a-z_]+[ \t]*(TO|=)/gim;

/**
 * ⚠ THE SAME REJECTION HAS MORE THAN ONE SPELLING, AND THE FIRST CUT OF THIS
 * GUARD KNEW ONLY ONE. `CREATE FUNCTION … SET setnayan.x` starts a line, but
 * `ALTER FUNCTION f() SET setnayan.x TO 'on'` does not — and it is rejected by
 * prod for exactly the same reason (the clause is validated against the role's
 * privilege on the parameter). So are the `ALTER ROLE` / `ALTER DATABASE`
 * forms, which additionally require ownership nobody here has.
 *
 * A guard that catches one spelling of a trap teaches you that the trap is
 * handled. `[^;]*?` keeps the match inside a single statement so an unrelated
 * later `SET` cannot be dragged in.
 */
const ALTER_LEVEL_SET =
  /\bALTER[ \t]+(FUNCTION|PROCEDURE|ROUTINE|ROLE|USER|DATABASE)\b[^;]*?\bSET[ \t]+setnayan\.[a-z_]+/gis;

/** `SET LOCAL setnayan.x` inside a body — legal, but reported as a WARNING. */
const SET_LOCAL_IN_BODY = /^[ \t]*SET[ \t]+LOCAL[ \t]+setnayan\.[a-z_]+/gim;

let failures = 0;
let warnings = 0;

const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();

for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

  // Comments describing the trap (like the ones in 20271132819490 and this
  // file's own sibling docs) must not trip it. Strip line comments first.
  const code = sql
    .split('\n')
    .map((line) => (line.trimStart().startsWith('--') ? '' : line))
    .join('\n');

  const rejected = [
    ...code.matchAll(FUNCTION_LEVEL_SET),
    ...code.matchAll(ALTER_LEVEL_SET),
  ].sort((a, b) => a.index - b.index);

  for (const m of rejected) {
    const line = code.slice(0, m.index).split('\n').length;
    const shown = m[0].trim().replace(/\s+/g, ' ').slice(0, 90);
    console.error(
      `✗ ${file}:${line} — \`${shown}\` will be REJECTED by prod ` +
        `(42501: permission denied to set parameter). The PGlite replay runs as a ` +
        `superuser and will NOT catch this.\n` +
        `  Use set_config('<param>', 'on', true) at runtime around the smallest ` +
        `possible statement, and restore the caller's prior value on every exit ` +
        `path including an exception handler.`,
    );
    failures += 1;
  }

  for (const m of code.matchAll(SET_LOCAL_IN_BODY)) {
    const line = code.slice(0, m.index).split('\n').length;
    console.error(
      `⚠ ${file}:${line} — \`${m[0].trim()}\` lasts until the end of the ` +
        `TRANSACTION, not the end of the function. Whatever the caller does next ` +
        `is still exempt. Prefer set_config(..., true) + restore.`,
    );
    warnings += 1;
  }
}

if (failures > 0) {
  console.error(
    `\n✗ lint-no-function-level-custom-set: ${failures} migration(s) would be ` +
      `rejected by production.`,
  );
  process.exit(1);
}

console.log(
  `✓ lint-no-function-level-custom-set: ${files.length} migrations, no function-level ` +
    `SET on a setnayan.* parameter${warnings ? ` (${warnings} SET LOCAL warning(s))` : ''}.`,
);

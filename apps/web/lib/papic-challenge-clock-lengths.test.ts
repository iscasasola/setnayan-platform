/**
 * THE THREE LENGTHS AGREE WITH THE DATABASE.
 *
 * The couple picks 30 minutes, an hour, or two (owner 2026-09-01). That set
 * lives in two places by necessity — a CHECK constraint, so a fourth value can
 * never reach a wall, and a TypeScript list, so the picker has labels and the
 * compiler can refuse one. **Two places holding one fact is a defect unless
 * something fails when they disagree**, and this is that something.
 *
 * 🔑 IT READS THE MIGRATION, NOT A COPY OF IT. The precedent is
 * `lib/papic-fullres-clock.test.ts`, which regex-matches its migration as text
 * for exactly this reason. A test that compared the TypeScript list to another
 * TypeScript list would pass while the database refused every arming.
 *
 * ⚠ WHAT THIS CANNOT DO is tell you the SQL is valid or that the constraint is
 * attached — text is text. `tests/db/a-challenge-stops-being-asked.db.test.ts`
 * replays the real schema and tries to write 45 minutes; that is the executing
 * half. This half catches the cheaper, likelier mistake: someone adding a
 * fourth choice to the picker and forgetting the constraint.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHALLENGE_DURATION_CHOICES,
  CHALLENGE_DURATION_DEFAULT,
  CHALLENGE_DURATION_LABELS,
} from '@/lib/papic-challenge-clock';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', '..', 'supabase', 'migrations');

/** The migration that owns the constraint, found by name rather than pinned by
 *  prefix — a prefix in a test is the kind of number RULE 0.7 warns about. */
function durationMigration(): string {
  const file = readdirSync(MIGRATIONS).find((f) => f.endsWith('_papic_timed_challenge_duration.sql'));
  assert.ok(file, 'the duration migration must exist');
  return readFileSync(join(MIGRATIONS, file!), 'utf8');
}

test('the CHECK constraint allows exactly the lengths the picker offers', () => {
  const sql = durationMigration();
  const m = sql.match(/CHECK\s*\(armed_duration_minutes IN \(([^)]*)\)\)/);
  assert.ok(m, 'the constraint must exist and be findable');

  const inSql = m![1]!.split(',').map((x) => Number(x.trim())).sort((a, b) => a - b);
  const inTs = [...CHALLENGE_DURATION_CHOICES].sort((a, b) => a - b);

  assert.deepEqual(
    inSql,
    inTs,
    'the picker and the database must offer the same three lengths — a value in one and not the other is either a choice that always errors, or one the wall can show but nobody chose',
  );
});

test('the default the database falls back to is the default the code names', () => {
  const sql = durationMigration();
  assert.match(
    sql,
    new RegExp(`ADD COLUMN IF NOT EXISTS armed_duration_minutes SMALLINT NOT NULL DEFAULT ${CHALLENGE_DURATION_DEFAULT}\\b`),
    'the column default must be the owner’s default',
  );
  assert.match(
    sql,
    new RegExp(`p_duration_minutes SMALLINT DEFAULT ${CHALLENGE_DURATION_DEFAULT}\\b`),
    'and so must the arming function’s, or a one-argument call gets a different length than the docs claim',
  );
});

test('every offered length has a label — no raw number reaches a screen', () => {
  for (const m of CHALLENGE_DURATION_CHOICES) {
    const label = CHALLENGE_DURATION_LABELS[m];
    assert.ok(label && label.trim().length > 0, `${m} minutes needs wording a person can read`);
    assert.equal(label, label.trim(), 'no stray whitespace in a label that renders');
  }
  assert.equal(
    Object.keys(CHALLENGE_DURATION_LABELS).length,
    CHALLENGE_DURATION_CHOICES.length,
    'a label with no choice behind it is a button that cannot exist',
  );
});

test('the default is one of the choices', () => {
  // Obvious, and it has been wrong elsewhere: a default outside the allowed set
  // makes every unspecified arming fail the CHECK.
  assert.ok(
    (CHALLENGE_DURATION_CHOICES as readonly number[]).includes(CHALLENGE_DURATION_DEFAULT),
    'the fallback must itself be writable',
  );
});

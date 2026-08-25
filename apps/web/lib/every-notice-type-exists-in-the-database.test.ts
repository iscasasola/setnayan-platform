/**
 * every-notice-type-exists-in-the-database.test.ts — a notification type the
 * database has never heard of is REFUSED, NOT THROWN, and the only symptom is a
 * person who is never told.
 *
 * 🔴 WHY THIS FILE EXISTS. `notification_type` is a Postgres ENUM. Adding a
 * member to the TypeScript union costs one line and typechecks instantly; the
 * matching `ALTER TYPE … ADD VALUE` lives in a migration nobody is forced to
 * write. When the two drift, the INSERT naming the missing label is rejected by
 * Postgres, `emitNotification` console.errors it by design so the action it
 * follows still completes, and everything downstream looks calm: no crash, no
 * failing test, green CI, and a notification that silently reaches nobody.
 *
 * Measured the day this was written — three values had drifted, across four
 * live emit sites, and nothing had noticed:
 *   · connection_request   (×2 sites) — "<name> added you to their people"
 *   · connection_confirmed — the answer, back to the person who asked
 *   · order_cancelled      — "the celebration was removed, so the bill is cancelled"
 * Two independent counts agreed: 70 labels in the migrations, the same 70 in
 * production, 72 in the union. Fixed by 20271168385546.
 *
 * 🔑 BOTH SIDES ARE DERIVED FROM THE CODE, NEVER HAND-LISTED. A hand-written
 * list of types is a list of the types somebody thought of, and this guard's
 * whole job is to catch the one nobody thought of. The union is parsed out of
 * lib/notifications.ts; the labels are parsed out of every .sql in
 * supabase/migrations (the CREATE TYPE body plus every ADD VALUE aimed at THIS
 * enum — an ADD VALUE on some other enum must not count).
 *
 * 🔑 AND BOTH SIDES ARE FLOORED. A parser that silently matches nothing reports
 * a perfectly clean sweep: 0 ⊆ 0. The floors below are far under today's real
 * counts and exist only so an empty parse fails loudly instead of passing
 * quietly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const REPO = join(WEB, '..', '..');
const MIGRATIONS = join(REPO, 'supabase', 'migrations');

/** Values the app declares it can emit. */
function unionValues(): string[] {
  const lines = readFileSync(join(WEB, 'lib', 'notifications.ts'), 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith('export type NotificationType'));
  assert.ok(start >= 0, 'NotificationType union not found — did the export move?');
  let end = start;
  // The union ends on the first member line terminated by a semicolon.
  while (end < lines.length && !/^\s*\|\s*'[a-z0-9_]+';\s*$/.test(lines[end] ?? '')) end += 1;
  assert.ok(end < lines.length, 'NotificationType union has no terminating member');
  const block = lines
    .slice(start, end + 1)
    .join('\n')
    .replace(/\/\/[^\n]*/g, ''); // comments name types too — strip before matching
  const found = [...block.matchAll(/\|\s*'([a-z0-9_]+)'/g)]
    .map((m) => m[1])
    .filter((v): v is string => Boolean(v));
  return [...new Set(found)].sort();
}

/** Labels the database will actually accept, according to the migrations. */
function migrationLabels(): string[] {
  const labels = new Set<string>();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*--/.test(l)) // a commented-out ADD VALUE adds nothing
      .join('\n');
    for (const created of sql.matchAll(
      /CREATE\s+TYPE\s+(?:public\.)?notification_type\s+AS\s+ENUM\s*\(([\s\S]*?)\)/gi,
    )) {
      for (const q of (created[1] ?? '').matchAll(/'([a-z0-9_]+)'/g)) {
        if (q[1]) labels.add(q[1]);
      }
    }
    // Scoped to statements that name THIS enum, so an ADD VALUE on any other
    // type cannot be counted as one of ours.
    for (const altered of sql.matchAll(/ALTER\s+TYPE\s+(?:public\.)?notification_type[\s\S]*?;/gi)) {
      for (const q of altered[0].matchAll(
        /ADD\s+VALUE(?:\s+IF\s+NOT\s+EXISTS)?\s+'([a-z0-9_]+)'/gi,
      )) {
        if (q[1]) labels.add(q[1]);
      }
    }
  }
  return [...labels].sort();
}

test('every notification type the app can emit exists as an enum label', () => {
  const union = unionValues();
  const labels = migrationLabels();

  // Floors: an empty parse must fail, not pass silently.
  assert.ok(union.length >= 60, `union parse floor: found only ${union.length} types`);
  assert.ok(labels.length >= 60, `migration parse floor: found only ${labels.length} labels`);

  const orphans = union.filter((t) => !labels.includes(t));
  assert.deepEqual(
    orphans,
    [],
    `These notification types are declared in lib/notifications.ts and have NO enum ` +
      `label in supabase/migrations, so every attempt to send one is refused by ` +
      `Postgres and reaches nobody: ${orphans.join(', ')}. Add an ALTER TYPE ` +
      `public.notification_type ADD VALUE for each, ALONE in its own migration file.`,
  );
});

test('the samahan can reach its own members', () => {
  // The samahan surface had NO notification type at all until 2026-08-25: a
  // 3-second story expires in 24 hours whether or not anyone was told.
  const labels = migrationLabels();
  for (const value of ['samahan_story', 'samahan_message']) {
    assert.ok(labels.includes(value), `${value} has no enum label — the samahan goes quiet again`);
  }
});

test('a samahan notice is never a booking email in disguise', () => {
  // Both allowlists in notification-emit.ts are deliberately minimal. The
  // samahan types stay OFF both: the tray rings, nobody's phone buzzes at 2am,
  // and no barkada small talk is emailed as a transactional booking signal —
  // until the owner has ruled on quiet hours.
  const src = readFileSync(join(WEB, 'lib', 'notification-emit.ts'), 'utf8');
  for (const setName of ['PUSH_ENABLED_TYPES', 'EMAIL_ENABLED_TYPES']) {
    const at = src.indexOf(`const ${setName}`);
    assert.ok(at >= 0, `${setName} not found`);
    const body = src
      .slice(at, src.indexOf(']);', at))
      .replace(/\/\/[^\n]*/g, ''); // the comments discuss types they do not enable
    const members = [...body.matchAll(/'([a-z0-9_]+)'/g)]
      .map((m) => m[1])
      .filter((v): v is string => Boolean(v));
    assert.ok(members.length >= 3, `${setName} parse floor: found ${members.length} members`);
    for (const value of ['samahan_story', 'samahan_message']) {
      assert.ok(
        !members.includes(value),
        `${value} is on ${setName} — that is an owner decision (quiet hours), not a code change`,
      );
    }
  }
});

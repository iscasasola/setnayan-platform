/**
 * live-empty-query-fixes.test.ts — two production queries that failed outright
 * and rendered as "nothing here".
 *
 * Both were found in Vercel's runtime errors on 2026-08-06, both still firing
 * that day, and both share the disease this codebase keeps paying for: a failed
 * Supabase query returns `{ data: null, error }`, and `?? []` downstream turns
 * that into an empty list. Nothing throws. The screen looks fine.
 *
 * 1 · `event_vendors → events` embed was AMBIGUOUS (PGRST201). Two paths exist
 *     between those tables — the direct FK and a many-to-many through
 *     `event_build_picks` — so PostgREST refused the whole query. `confirmed`
 *     was always null, and the T-7-days "confirm you're ready" email sent to
 *     NOBODY.
 *
 *     🔑 THIS IS THE SECOND TIME THIS ONE QUERY HAS BEEN KILLED THIS WAY. The
 *     comment above it already records a 42703 from naming a column that does
 *     not exist on the table. Same query, same silence, different error code.
 *
 * 2 · `papic_one_tiers` shipped with RLS ENABLED and zero policies and zero
 *     grants — readable by nobody but service_role — while the couple's Papic
 *     page reads it with the signed-in client. Every read 403'd, so the page
 *     quoted a price from an empty tier list.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
/**
 * Every migration's SQL with `--` comments STRIPPED.
 *
 * ⚠ Stripping is not tidiness, it is correctness. A comment contains no `;`, so
 * a `GRANT[^;]*` pattern happily runs THROUGH one and joins fragments of two
 * unrelated statements. The write-grant guard below matched this very file's own
 * explanatory prose the first time it ran — the third time in one session that a
 * guard has matched a comment instead of code. Scan the statements, not the
 * story about them.
 */
const allMigrations = () =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

// ── 1 · the ambiguous embed ─────────────────────────────────────────────────

test('every events embed from event_vendors names its foreign key', () => {
  const src = read('lib/ghosting.ts');
  const embeds = src.match(/events![a-z_!]*\(/g) ?? [];
  assert.ok(embeds.length > 0, 'the confirmed-booking query lost its events embed entirely');
  for (const e of embeds) {
    assert.ok(
      e.includes('event_vendors_event_id_fkey'),
      `Ambiguous embed ${e} — PostgREST finds TWO paths from event_vendors to ` +
        `events (the direct FK, and many-to-many via event_build_picks) and ` +
        `refuses the whole query with PGRST201. The result is null, "?? []" makes ` +
        `it an empty list, and the T-7-days vendor warning email silently stops.`,
    );
  }
});

test('the query still filters on the column that actually exists', () => {
  // The FIRST time this query died it was because it named `vendor_profile_id`,
  // which `event_vendors` does not have. Pin the real one so a "tidy-up" cannot
  // reintroduce it.
  const src = read('lib/ghosting.ts');
  assert.ok(
    /\.in\('marketplace_vendor_id'/.test(src),
    'The confirmed-booking query stopped filtering on marketplace_vendor_id. ' +
      'event_vendors has no vendor_profile_id — naming it 42703s the whole query.',
  );
});

test('the failure is still logged rather than swallowed', () => {
  const src = read('lib/ghosting.ts');
  assert.ok(
    /logQueryError\('ghosting:upcomingConfirmedBookings'/.test(src),
    'The error log is gone. It is the only reason either of these two failures ' +
      'was ever discovered — the feature itself fails completely silently.',
  );
});

// ── 2 · the unreadable catalogue ────────────────────────────────────────────

test('papic_one_tiers is granted to the client that reads it', () => {
  const sql = allMigrations();
  assert.ok(
    /GRANT SELECT ON public\.papic_one_tiers TO[^;]*authenticated/.test(sql),
    'papic_one_tiers has no SELECT grant for signed-in users, but the couple\'s ' +
      'Papic page reads it with the signed-in client. Every read 403s and the ' +
      'page quotes a price from an empty tier list.',
  );
  assert.ok(
    /CREATE POLICY papic_one_tiers_read[\s\S]{0,200}FOR SELECT/.test(sql),
    'The grant is there but no RLS policy is. RLS is ENABLED on this table, so a ' +
      'grant without a policy still denies every row — the grant alone reads as ' +
      'fixed and changes nothing.',
  );
});

test('the catalogue stays read-only to clients', () => {
  const sql = allMigrations();
  assert.ok(
    !/GRANT[^;]*\b(INSERT|UPDATE|DELETE)\b[^;]*ON public\.papic_one_tiers[^;]*TO[^;]*(anon|authenticated)/i.test(
      sql,
    ),
    'A write grant on papic_one_tiers reached anon or authenticated. This table ' +
      'sets what a camera rung is worth — only the admin editor may write it.',
  );
});

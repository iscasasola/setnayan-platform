/**
 * ⭐ The admin gate has THREE clauses — an admin surface may not drop two of
 * them.
 *
 * The defect this pins (found 2026-07-27, live on origin/main @ 8af306bf3):
 * `lib/admin/require-admin.ts` is canonical — it reads
 * `is_internal, is_team_member, account_type` and admits
 * `is_internal || is_team_member || account_type === 'admin'`.
 *
 * `app/admin/editorial-review/[editorialId]/actions.ts` declared its OWN
 * `requireAdmin` that selected `is_internal` ONLY and threw otherwise — the
 * single outlier among ~43 local copies; the other 42 carry the 3-clause
 * predicate. Worse, it ran that authorization lookup through
 * `createAdminClient()` — the RLS-bypassing service-role client — rather than
 * the caller's own client.
 *
 * Harm today: a Setnayan team member (`is_team_member = true`,
 * `is_internal = false`) can approve payouts and verify vendors, but gets a
 * hard "Unauthorized" on the editorial moderation queue — unreachable for
 * exactly the staff hired to work it.
 *
 * NEUTRALISATION: restore the `is_internal`-only local check and
 *   · "the editorial review actions delegate to the canonical gate" fails.
 * Narrow the canonical predicate itself and
 *   · "a Team Pool member (is_team_member) is an admin" fails.
 *
 * Run: `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Imported from the pure leaf (`require-admin.ts` re-exports it, but that
// module pulls `server-only` and cannot load under `node --test`).
import { isAdminProfile } from './admin-predicate';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', '..', p), 'utf8');

const EDITORIAL_ACTIONS = 'app/admin/editorial-review/[editorialId]/actions.ts';
const CANONICAL = 'lib/admin/require-admin.ts';

/* ── 1 · The predicate admits all three classes, and nobody else ──────────── */

test('a Team Pool member (is_team_member) is an admin — the clause that was dropped', () => {
  assert.equal(
    isAdminProfile({ is_internal: false, is_team_member: true, account_type: 'customer' }),
    true,
    'is_team_member staff must reach every admin surface',
  );
});

test('an account_type=admin user is an admin — the other dropped clause', () => {
  assert.equal(
    isAdminProfile({ is_internal: false, is_team_member: false, account_type: 'admin' }),
    true,
  );
});

test('an internal Setnayan account is an admin', () => {
  assert.equal(
    isAdminProfile({ is_internal: true, is_team_member: false, account_type: 'customer' }),
    true,
  );
});

test('a plain user is still rejected — the gate did not get looser', () => {
  for (const row of [
    { is_internal: false, is_team_member: false, account_type: 'customer' },
    { is_internal: false, is_team_member: false, account_type: 'vendor' },
    { is_internal: null, is_team_member: null, account_type: null },
    {},
    null,
    undefined,
  ]) {
    assert.equal(isAdminProfile(row), false, `${JSON.stringify(row)} must NOT be an admin`);
  }
  // 'admin' is matched exactly — no case-folding, no prefix match.
  assert.equal(isAdminProfile({ account_type: 'Admin' }), false);
  assert.equal(isAdminProfile({ account_type: 'admin_readonly' }), false);
});

/* ── 2 · The editorial queue is behind THAT gate, not a private copy ──────── */

test('the editorial review actions delegate to the canonical gate', () => {
  const src = repoFile(EDITORIAL_ACTIONS);

  assert.match(
    src,
    /import \{ requireAdminAction \} from '@\/lib\/admin\/require-admin';/,
    'editorial-review actions do not import the canonical admin gate',
  );
  assert.match(
    src,
    /await requireAdminAction\(\)/,
    'editorial-review actions never call the canonical gate',
  );
  // The outlier's signature: its own users-table lookup selecting is_internal.
  assert.doesNotMatch(
    src,
    /\.select\(\s*'is_internal'\s*\)/,
    'editorial-review actions are back to an is_internal-ONLY admin check',
  );
  assert.doesNotMatch(
    src,
    /\.from\(\s*'users'\s*\)/,
    'editorial-review actions are hand-rolling a users-table authorization lookup again',
  );
});

test('authorization is decided by the USER client, not the service-role client', () => {
  // The service-role client is still fetched here — the event_editorial and
  // event_members work genuinely needs to bypass RLS. What it must never do
  // again is decide WHO the caller is.
  const editorial = repoFile(EDITORIAL_ACTIONS);
  assert.match(
    editorial,
    /createAdminClient\(\)/,
    'the service-role client is still needed for the RLS-bypassing writes',
  );

  const canonical = repoFile(CANONICAL);
  assert.match(
    canonical,
    /import \{ createClient \} from '@\/lib\/supabase\/server';/,
    'the canonical gate must resolve the caller through the USER client',
  );
  // (matched on the IMPORT, not the word — the file's own doc comment explains
  // why service-role pages need the gate, and mentions createAdminClient.)
  assert.doesNotMatch(
    canonical,
    /from '@\/lib\/supabase\/admin'/,
    'the canonical gate must not authorize through the service-role client',
  );
});

test('the canonical gate still reads all three columns off the profile', () => {
  const src = repoFile(CANONICAL);
  assert.match(
    src,
    /\.select\('is_internal, is_team_member, account_type'\)/,
    'the canonical gate stopped selecting one of its three clauses',
  );
  assert.match(
    src,
    /isAdmin: isAdminProfile\(me\)/,
    'the canonical gate no longer runs the shared predicate',
  );
});

test('the predicate leaf stays dependency-free so the rule remains testable', () => {
  const src = repoFile('lib/admin/admin-predicate.ts');
  assert.doesNotMatch(
    src,
    /^\s*import\s/m,
    'admin-predicate.ts grew an import — it must stay loadable under node --test',
  );
});

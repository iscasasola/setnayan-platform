/**
 * a-couple-can-report-a-shop.test.ts — CTRL-B3 build 9.
 *
 * ── THE GAP, measured 2026-09-22 ───────────────────────────────────────────
 * `ReportPageButton` accepted `event | user_profile | chapter`,
 * `PublicPageActions` is mounted on `app/[slug]` and `/u/*` and **never under
 * `app/v/`**, and prod's `user_reports_target_type_check` allowed **no vendor
 * value**. So the marketplace — the one public surface where strangers meet
 * strangers and money changes hands — was the only one with no report route.
 *
 * 🔑 BOTH ENDS, OR NEITHER. A filing path with no desk is a tray badge reaching
 * nobody; a desk with no filing path is furniture. Every test below pairs them.
 *
 * 🛡 Mutation-checked; every sabotage verified to apply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) ?? []).length;

/** The live constraint, read from production 2026-09-22 with pg_get_constraintdef. */
const LIVE_TARGETS_BEFORE = ['photo', 'comment', 'user', 'ai_output', 'event', 'user_profile', 'chapter'];

function migrationSql(): string {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const f = readdirSync(dir).find((n) => n.includes('a_couple_can_report_a_shop'));
  assert.ok(f, 'the migration is missing');
  return readFileSync(join(dir, f), 'utf8');
}

// SABOTAGE: drop any pre-existing value from the re-listed CHECK → RED.
test('the re-listed CHECK keeps every value it already had, and adds exactly one', () => {
  const sql = migrationSql();
  for (const t of LIVE_TARGETS_BEFORE) {
    assert.ok(
      sql.includes(`'${t}'::text`),
      `the re-listed CHECK dropped '${t}' — retyping a vocabulary from an older migration silently loses whatever was added since, and it only fails against real rows`,
    );
  }
  assert.ok(sql.includes("'vendor'::text"), 'vendor is the whole point of the migration');
  assert.equal(
    count(sql, /'[a-z_]+'::text/),
    LIVE_TARGETS_BEFORE.length + 1,
    'exactly the live list plus one — anything else means a value was invented or lost',
  );
});

// SABOTAGE: remove 'vendor' from PUBLIC_TARGETS → RED.
// SABOTAGE: accept any vendor id without checking it is live → RED.
test('a shop report is accepted, and only for a shop a couple could have met', () => {
  const src = readCode('lib/reports.ts');
  assert.match(src, /PUBLIC_TARGETS = \['event', 'user_profile', 'chapter', 'vendor'\]/, 'the filing path must accept it');
  // 🪤 SIZE THESE WINDOWS TO THE BRANCH, NOT TO A GUESS. `stripComments`
  // replaces a comment with WHITESPACE rather than removing it, so a
  // well-documented branch pushes its own code hundreds of characters apart —
  // this gap measured 845. A window sized by eye fails against correct code,
  // which is a guard crying wolf at its own documentation. Twice in this
  // session; measure the gap before choosing the number.
  assert.match(
    src,
    /=== 'vendor'[\s\S]{0,1400}isShopLive\(data\)/,
    'a hidden or unverified profile id is a forged target, not a grievance — the same posture the chapter branch takes about a draft',
  );
  assert.equal(
    count(src, /=== 'vendor'[\s\S]{0,1400}is_published/),
    0,
    '`is_published` is vestigial and reads FALSE on a live verified shop — using it here would refuse reports about exactly the shops that are findable',
  );
});

// SABOTAGE: unmount the button from the shop page → RED.
test('the button is ON the shop page, with the id the filing path resolves', () => {
  const shop = readCode('app/v/[slug]/page.tsx');
  assert.equal(
    count(shop, /<ReportPageButton/),
    1,
    'the marketplace was the only public surface with no report route',
  );
  assert.match(shop, /targetType="vendor"/, 'and it must file as a vendor');
  assert.match(
    shop,
    /targetId=\{vendor\.vendor_profile_id\}/,
    'the filing path resolves `vendor_profiles.vendor_profile_id` — any other id is an invalid_target',
  );
});

// SABOTAGE: drop the admin desk's phrase for the new type → RED.
test('a filed shop report lands somewhere a human already looks', () => {
  const desk = readCode('app/admin/user-reports/page.tsx');
  assert.match(desk, /\| 'vendor'/, 'the desk must know the type exists, or the row renders untyped');
  // 🪤 THE DESK HAS TWO EXHAUSTIVE RECORDS, NOT ONE — `TARGET_PHRASE` and
  // `TARGET_SHORT`. The first version of this assertion matched either, so it
  // passed with only one filled in and typecheck caught the other. Count BOTH,
  // so a third Record added later fails here rather than in CI.
  assert.equal(
    count(desk, /\n  vendor: '[^']+',/),
    2,
    'a report the desk cannot name is a row an admin cannot action — and this page names its targets in two places, so filling one is half a fix',
  );
});

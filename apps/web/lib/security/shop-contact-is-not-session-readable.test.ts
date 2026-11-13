/**
 * A SHOP'S EMAIL AND PHONE ARE READ ONLY ON THE SERVICE ROLE — or by the shop
 * itself through `vendor_profiles_self`. Source half of migration 20271221366210.
 *
 * Owner, 2026-09-10: "our goal is to let them integrate their event with the
 * vendor they find. not to let them communicate outside the app."
 *
 * WHY A SOURCE GUARD AS WELL AS THE DB TEST
 * -----------------------------------------
 * After 20271221366210 neither `anon` nor `authenticated` holds SELECT on
 * `vendor_profiles.contact_email` / `contact_phone`. A browser-session read that
 * names either column — in the projection OR in a filter (Postgres checks the
 * column privilege for a WHERE exactly as for a SELECT list) — is not blanked:
 * PostgREST refuses the WHOLE statement with 42501. supabase-js hands that back
 * as `{ data: null, error }`, and the screen goes quietly empty. The replay
 * harness cannot see that class (it tests the database, not the app's clients),
 * so this file reads every read site and demands its client be the service role.
 *
 * 🔑 IT TESTS THE CLAIM, NOT A NAME. "The receiver is called `admin`" is a proxy
 * that a renamed session client walks straight through. A receiver is accepted
 * only when it is PROVABLY the service role:
 *   · `createAdminClient()` / `createMoneyWriterClient()` inline, or
 *   · an identifier bound to one of those in the SAME file, or
 *   · a function PARAMETER — and then EVERY call site of that function, in
 *     every source file, must pass one of the above in that position.
 * Anything else is a session read and fails, with its file:line.
 *
 * WHAT IT DOES NOT SEE (stated so green is not over-read): a select string
 * built by interpolation (`${…}`) is unknowable statically and is skipped by the
 * shared scanner, exactly as for the phantom-column guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_ROOT,
  collectSourceFiles,
  extractSelectSites,
  scanAllSelectSites,
  type SelectSite,
} from './select-column-scan';
import { extractFilterSites, scanFilterSites } from './query-column-scan';
import { stripComments } from '../strip-comments';
import { classifySite, type Site } from './service-role-receiver';

const CONTACT = new Set(['contact_email', 'contact_phone']);
/**
 * The shop's TAX IDENTITY — off `authenticated`'s SELECT allowlist since
 * migration 20271217955839 (read out of prod with has_column_privilege on
 * 2026-09-19, not remembered). Same failure class as the contact pair: a
 * browser-session read naming ANY of these is refused whole (42501). The shop
 * reads its own through `vendor_profiles_self`; admin surfaces use the service
 * role. `loadVerificationIdentityFields` read five of them off the TABLE on the
 * session and every verification line read "Not filled in yet" (prod,
 * 2026-09-19) — nothing scanned for this set until then.
 */
const TAX_IDENTITY = new Set([
  'bir_service_category',
  'business_owner_name',
  'next_renewal_due_at',
  'registered_address',
  'registered_business_name',
  'registered_zip',
  'registration_number_needs_review',
  'registration_number_normalized',
  'registration_number_raw',
  'registration_number_submitted_at',
  'tin_number',
  'tin_type',
]);
/** Relations whose invoker-privileged read would reach the two columns. */
const RELATIONS = new Set(['vendor_profiles', 'vendor_market_stats']);

function contactSites(
  select: SelectSite[],
  filter: SelectSite[],
  deny: ReadonlySet<string> = CONTACT,
): Site[] {
  const out: Site[] = [];
  for (const [kind, list] of [['select', select], ['filter', filter]] as const) {
    for (const s of list) {
      if (!RELATIONS.has(s.table)) continue;
      const cols = s.columns.filter((c) => deny.has(c));
      if (cols.length) out.push({ ...s, columns: cols, kind });
    }
  }
  return out;
}

/** `.or('…contact_email.ilike…')` — a filter STRING the method scanner does not parse. */
function orStringSites(files: string[]): Site[] {
  const out: Site[] = [];
  for (const abs of files) {
    const src = fs.readFileSync(abs, 'utf8');
    const re = /\.from\(\s*'(vendor_profiles|vendor_market_stats)'\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const chain = src.slice(re.lastIndex, re.lastIndex + 900);
      const next = chain.search(/\.from\(/);
      const scope = next === -1 ? chain : chain.slice(0, next);
      if (/\.or\([^)]*contact_(email|phone)\./.test(scope)) {
        out.push({
          file: path.relative(APP_ROOT, abs),
          line: src.slice(0, m.index).split('\n').length,
          table: m[1]!,
          columns: ['(or-string)'],
          kind: 'or',
        });
      }
    }
  }
  return out;
}

/** `vendor_profiles(… contact_email …)` embedded in ANOTHER table's select. */
function embedSites(files: string[]): Site[] {
  const out: Site[] = [];
  for (const abs of files) {
    const src = stripComments(fs.readFileSync(abs, 'utf8'));
    const re = /vendor_profiles(?:![a-z_]+)?\s*\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      if (/contact_(email|phone)/.test(m[1]!)) {
        out.push({
          file: path.relative(APP_ROOT, abs),
          line: src.slice(0, m.index).split('\n').length,
          table: 'vendor_profiles(embed)',
          columns: ['embed'],
          kind: 'embed',
        });
      }
    }
  }
  return out;
}


const FILES = collectSourceFiles(APP_ROOT);
const scan = scanAllSelectSites();
const SITES: Site[] = [
  ...contactSites(scan.sites, scanFilterSites()),
  ...orStringSites(FILES),
  ...embedSites(FILES),
];

test('ANTI-VACUITY: the scan finds the known service-role readers (it is measuring something)', () => {
  // 17 select sites + 3 filter sites + 1 or-string on 2026-09-11. The floor is
  // well under that so ordinary refactors do not trip it, but a scanner that
  // silently matched nothing would.
  assert.ok(SITES.length >= 12, `only ${SITES.length} contact-column read sites found — the scanner is blind`);
  const files = new Set(SITES.map((s) => s.file));
  for (const f of ['app/admin/verify/page.tsx', 'lib/vendor-invites.ts', 'lib/personal-data-export.ts']) {
    assert.ok(files.has(f), `the scan no longer sees ${f}, a known reader — it is not measuring what it claims`);
  }
  console.log(`# contact-column read sites scanned: ${SITES.length}`);
});

test('ANTI-VACUITY: a session read IS caught and a service read is NOT (fixtures, independent of the repo)', () => {
  const fixture = [
    "import { createClient } from '@/lib/supabase/server';",
    "import { createAdminClient } from '@/lib/supabase/admin';",
    'export async function bad() {',
    '  const supabase = await createClient();',
    "  return supabase.from('vendor_profiles').select('vendor_profile_id, contact_phone');",
    '}',
    'export async function good() {',
    '  const admin = createAdminClient();',
    "  return admin.from('vendor_profiles').select('vendor_profile_id, contact_phone');",
    '}',
    'export async function viaParam(db: unknown) {',
    "  return (db as any).from('vendor_profiles').select('contact_email');",
    '}',
    "export async function filterBad() { const s = await createClient(); return s.from('vendor_profiles').select('vendor_profile_id').ilike('contact_email', 'x'); }",
  ].join('\n');
  // Classified from the STRING — never written into the tree, where a
  // concurrently running scanner in another test process could pick it up.
  {
    const rel = 'lib/security/__contact_fixture__.ts';
    const sites = contactSites(extractSelectSites(fixture, rel), extractFilterSites(fixture, rel));
    assert.equal(sites.length, 4, `the fixture should yield 4 sites, got ${sites.length} — the scanner changed shape`);
    const verdict = sites.map((s) => ({ line: s.line, ...classifySite([], s, fixture) }));
    const byLine = new Map(verdict.map((v) => [v.line, v.service]));
    assert.equal(byLine.get(5), false, 'a `supabase` session read was ACCEPTED — the guard is blind');
    assert.equal(byLine.get(9), true, 'a createAdminClient() read was REFUSED — the guard cries wolf');
    // `(db as any)` is not an identifier: refused, never waved through.
    assert.equal(verdict.find((v) => v.line === 12)?.service, false, 'an unprovable receiver was accepted');
    assert.equal(byLine.get(14), false, 'a session FILTER on contact_email was accepted');
  }
});

test('every read of a shop’s contact_email / contact_phone runs on the SERVICE ROLE', () => {
  const bad: string[] = [];
  for (const s of SITES) {
    const v = classifySite(FILES, s);
    if (process.env.N4_DEBUG) console.log(`# ${s.file}:${s.line} ${v.service ? 'service' : 'SESSION'} — ${v.why}`);
    if (!v.service) bad.push(`${s.file}:${s.line} (${s.kind} ${s.table}: ${s.columns.join(',')}) — ${v.why}`);
  }
  assert.deepEqual(
    bad,
    [],
    'These reads name a shop’s contact column on a BROWSER SESSION. Since 20271221366210 neither ' +
      'anon nor authenticated may read either column, so PostgREST refuses the WHOLE statement ' +
      '(42501) and the screen goes quietly empty. Read it on createAdminClient() scoped by a ' +
      'session-proved id — or, for the shop itself, through vendor_profiles_self:\n  ' +
      bad.join('\n  '),
  );
});

test('the shop’s OWN dashboard reads its contact details through vendor_profiles_self', () => {
  const src = stripComments(fs.readFileSync(path.join(APP_ROOT, 'lib', 'vendor-profile.ts'), 'utf8'));
  assert.match(src, /const SELF_SOURCE = 'vendor_profiles_self'/, 'the own-shop read no longer targets the definer view');
  const full = src.match(/const FULL_VENDOR_PROFILE_SELECT\s*=\s*'([^']+)'/)?.[1] ?? '';
  const legacy = src.match(/const LEGACY_VENDOR_PROFILE_SELECT\s*=\s*'([^']+)'/)?.[1] ?? '';
  for (const [name, list] of [['FULL', full], ['LEGACY', legacy]] as const) {
    const cols = list.split(',').map((c) => c.trim());
    assert.ok(cols.includes('contact_email') && cols.includes('contact_phone'), `${name} own-shop select lost a contact column`);
  }
  assert.match(src, /\.from\(SELF_SOURCE\)\s*\.select\(FULL_VENDOR_PROFILE_SELECT\)/, 'the FULL projection is not read from SELF_SOURCE');
  assert.match(src, /\.from\(SELF_SOURCE\)\s*\.select\(LEGACY_VENDOR_PROFILE_SELECT\)/, 'the LEGACY fallback is not read from SELF_SOURCE');
  // Since step 5 (2026-10-14) the contact fields are Your details › Contact (they were My Shop's Profile tile).
  const route = stripComments(fs.readFileSync(path.join(APP_ROOT, 'app', 'vendor-dashboard', 'profile', 'page.tsx'), 'utf8'));
  assert.match(route, /fetchOwnVendorProfile\(/, 'Your details no longer loads the shop through fetchOwnVendorProfile');
  const page = stripComments(fs.readFileSync(path.join(APP_ROOT, 'app', 'vendor-dashboard', 'profile', 'details-data.ts'), 'utf8'));
  assert.match(page, /contact_phone:\s*profile\.contact_phone/, 'Your details no longer shows the shop its phone');
  assert.match(page, /contact_email:\s*profile\.contact_email/, 'Your details no longer shows the shop its email');
});

test('no later migration hands either column (or the whole table) back to a browser role', () => {
  const dir = path.join(APP_ROOT, '..', '..', 'supabase', 'migrations');
  const LOCK = '20271221366210';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.some((f) => f.startsWith(LOCK)), `the lockdown migration ${LOCK} is missing`);
  const lock = fs.readFileSync(path.join(dir, files.find((f) => f.startsWith(LOCK))!), 'utf8').replace(/--[^\n]*/g, '');
  assert.match(lock, /REVOKE\s+SELECT\s*\(\s*contact_email\s*,\s*contact_phone\s*\)\s+ON\s+public\.vendor_profiles\s+FROM\s+anon/i);
  assert.match(lock, /REVOKE\s+SELECT\s*\(\s*contact_email\s*,\s*contact_phone\s*\)\s+ON\s+public\.vendor_profiles\s+FROM\s+authenticated/i);
  const problems: string[] = [];
  // No prefix cutoff for the RE-GRANT check: prod pushes --include-all, so a
  // NEW file sorting below the lock can still apply after it. The only files
  // below the lock allowed to grant a contact column are the two that were
  // already applied in production BEFORE it (read from the migration history):
  // the anon allowlist and the authenticated allowlist this migration narrows.
  const APPLIED_BEFORE_THE_LOCK = new Set([
    '20271014385411_vendor_profiles_anon_column_scope.sql',
    '20271217955839_vendor_profiles_authenticated_tax_identity_scope.sql',
  ]);
  for (const f of APPLIED_BEFORE_THE_LOCK) {
    assert.ok(files.includes(f), `${f} is gone — this exemption list is stale`);
  }
  for (const f of files) {
    if (f.startsWith(LOCK) || APPLIED_BEFORE_THE_LOCK.has(f)) continue;
    const code = fs.readFileSync(path.join(dir, f), 'utf8').replace(/--[^\n]*/g, '');
    const after = f > LOCK;
    for (const m of code.matchAll(/GRANT\s+SELECT\s*(\([^)]*\))?\s+ON\s+(?:TABLE\s+)?(?:public\.)?vendor_profiles\b[^;]*TO\s+([^;]+);/gi)) {
      const cols = m[1] ?? '';
      const to = m[2]!;
      if (!/\b(anon|authenticated|public)\b/i.test(to)) continue;
      if (/contact_(email|phone)/i.test(cols)) problems.push(`${f}: re-grants a contact column to ${to.trim()}`);
      if (!cols && after) problems.push(`${f}: table-level SELECT to ${to.trim()} — makes the column revoke inert`);
    }
    // A computed allowlist re-grant (the 20271217955839 shape) written AFTER the
    // lock must exclude both columns, or it silently re-opens them.
    if (after && /GRANT\s+SELECT\s*\(%s\)\s+ON\s+public\.vendor_profiles/i.test(code) && !/contact_email/.test(code)) {
      problems.push(`${f}: recomputes the vendor_profiles SELECT allowlist without excluding contact_email/contact_phone`);
    }
    if (after && /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:public\.)?vendor_market_stats\b[\s\S]*?;/i.test(code)) {
      const body = code.match(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:public\.)?vendor_market_stats\b[\s\S]*?;/i)![0];
      if (/contact_(email|phone)/.test(body)) problems.push(`${f}: vendor_market_stats projects a contact column again`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

// ── TAX IDENTITY (20271217955839) ─────────────────────────────────────────
// Same classifier, second column set. Embeds and `.or()` strings are not
// scanned for this set (none exist today; stated so green is not over-read).
const TAX_SITES: Site[] = contactSites(scan.sites, scanFilterSites(), TAX_IDENTITY);

test('ANTI-VACUITY: the tax-identity scan sees the known readers', () => {
  // Measured 2026-09-19: the service-role admin/verify surface and the
  // explore catalogue's next_renewal_due_at read are both on vendor_profiles.
  assert.ok(TAX_SITES.length >= 3, `only ${TAX_SITES.length} tax-identity read sites found — the scanner is blind`);
  const files = new Set(TAX_SITES.map((s) => s.file));
  assert.ok(files.has('app/(shell)/explore/_lib/marketplace-view.tsx'), 'the scan no longer sees the explore catalogue read'); // 2026-11-12: the marketplace pipeline moved from explore/page.tsx to _lib/marketplace-view.tsx (shared with Discover)
  const fixture = [
    "import { createClient } from '@/lib/supabase/server';",
    'export async function bad() {',
    '  const supabase = await createClient();',
    "  return supabase.from('vendor_profiles').select('vendor_profile_id, tin_number');",
    '}',
    'export async function own() {',
    '  const supabase = await createClient();',
    "  return supabase.from('vendor_profiles_self').select('vendor_profile_id, tin_number');",
    '}',
    'export function Page() {',
    '  const admin = createAdminClient();',
    '  const x = <View admin={admin} />;',
    "  return admin.from('vendor_profiles').select('tin_type');",
    '}',
  ].join('\n');
  const rel = 'lib/security/__tax_fixture__.ts';
  const sites = contactSites(extractSelectSites(fixture, rel), extractFilterSites(fixture, rel), TAX_IDENTITY);
  assert.equal(sites.length, 2, `the fixture should yield 2 table sites (the _self read is not one), got ${sites.length}`);
  const byLine = new Map(sites.map((s) => [s.line, classifySite([], s, fixture).service]));
  assert.equal(byLine.get(4), false, 'a session read of tin_number on the TABLE was accepted — the guard is blind');
  assert.equal(byLine.get(13), true, 'a JSX attribute `admin={admin}` was taken as the binding — the guard cries wolf');
});

test('every read of a shop’s tax identity off the TABLE runs on the SERVICE ROLE (the shop uses vendor_profiles_self)', () => {
  const bad: string[] = [];
  for (const s of TAX_SITES) {
    const v = classifySite(FILES, s);
    if (!v.service) bad.push(`${s.file}:${s.line} (${s.kind} ${s.table}: ${s.columns.join(',')}) — ${v.why}`);
  }
  assert.deepEqual(
    bad,
    [],
    'These reads name a shop’s tax-identity column on vendor_profiles with a BROWSER SESSION. Since ' +
      '20271217955839 authenticated may not SELECT them, so PostgREST refuses the WHOLE statement (42501) ' +
      'and the screen reads "not filled in". For the shop’s own row read `vendor_profiles_self`; ' +
      'otherwise createAdminClient() scoped by a session-proved id:\n  ' +
      bad.join('\n  '),
  );
});

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

const CONTACT = new Set(['contact_email', 'contact_phone']);
/** Relations whose invoker-privileged read would reach the two columns. */
const RELATIONS = new Set(['vendor_profiles', 'vendor_market_stats']);
const SERVICE_FACTORIES = ['createAdminClient', 'createMoneyWriterClient'];

type Site = { file: string; line: number; table: string; columns: string[]; kind: string };

function contactSites(select: SelectSite[], filter: SelectSite[]): Site[] {
  const out: Site[] = [];
  for (const [kind, list] of [['select', select], ['filter', filter]] as const) {
    for (const s of list) {
      if (!RELATIONS.has(s.table)) continue;
      const cols = s.columns.filter((c) => CONTACT.has(c));
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

/** The expression a `.from(` at `fromIdx` is called on: `admin`, `createAdminClient()`, `supabase`… */
export function receiverBefore(src: string, fromIdx: number): string {
  let i = fromIdx - 1;
  while (i >= 0 && /\s/.test(src[i]!)) i--;
  if (src[i] === ')') {
    let depth = 0;
    let j = i;
    for (; j >= 0; j--) {
      if (src[j] === ')') depth++;
      else if (src[j] === '(') {
        depth--;
        if (depth === 0) break;
      }
    }
    let k = j - 1;
    while (k >= 0 && /[\w$.]/.test(src[k]!)) k--;
    const inner = src.slice(j + 1, i).trim();
    const callee = src.slice(k + 1, j).trim();
    // `(await createClient())` — a parenthesised expression, not a call.
    return callee ? `${callee}()` : inner.replace(/^await\s+/, '');
  }
  let k = i;
  while (k >= 0 && /[\w$.]/.test(src[k]!)) k--;
  return src.slice(k + 1, i + 1);
}

function isServiceCall(expr: string): boolean {
  return SERVICE_FACTORIES.some((f) => new RegExp(`^(?:await\\s+)?${f}\\(\\)$`).test(expr.trim()));
}

/**
 * The NEAREST binding of `ident` before `at` (a file can bind `supabase` to the
 * session in one function and to the service role in another — "somewhere in
 * the file" would wave the session one through). Returns the bound expression
 * with its offset, or null when the nearest binding is not an assignment.
 */
function nearestAssignment(src: string, ident: string, at: number): { expr: string; index: number } | null {
  const re = new RegExp(`(?<![\\w$.])${ident}\\s*(?::[^=;(){}]+)?=(?!=|>)\\s*([^;\\n]+)`, 'g');
  let best: { expr: string; index: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) && m.index < at) {
    const expr = m[1]!.trim();
    // `admin = null` (the export route's catch arm) cannot read anything — a
    // null receiver throws. Only a binding that yields a CLIENT counts.
    if (/^(null|undefined)\b/.test(expr)) continue;
    best = { expr, index: m.index };
  }
  return best;
}

function boundToService(src: string, ident: string, at: number = src.length): boolean {
  const b = nearestAssignment(src, ident, at);
  return !!b && SERVICE_FACTORIES.some((f) => new RegExp(`^(?:await\\s+)?${f}\\s*\\(\\s*\\)`).test(b.expr));
}

/** Index of `ident` among the parameters of the function whose body holds `at`, and its name. */
function enclosingParam(src: string, at: number, ident: string): { fn: string; index: number; at: number } | null {
  const head = src.slice(0, at);
  const re = /(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?)\s*\(([^)]*)\)/g;
  let best: { fn: string; index: number; at: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(head))) {
    const params = m[3]!.split(',').map((p) => p.trim().split(/[\s:=?]/)[0]);
    const index = params.indexOf(ident);
    if (index !== -1) best = { fn: (m[1] ?? m[2])!, index, at: m.index };
  }
  return best;
}

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((a) => a.trim());
}

/** Every call of `fn(` in the app, with the argument at `index` and whether it is the service role. */
function callersPassService(files: string[], fn: string, index: number): { ok: boolean; calls: string[] } {
  const calls: string[] = [];
  let ok = true;
  for (const abs of files) {
    const src = stripComments(fs.readFileSync(abs, 'utf8'));
    const re = new RegExp(`(?<![\\w$.])${fn}\\(`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      // the declaration itself
      if (/function\s+$/.test(src.slice(Math.max(0, m.index - 12), m.index))) continue;
      let depth = 1;
      let j = re.lastIndex;
      for (; j < src.length && depth > 0; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')') depth--;
      }
      const arg = splitArgs(src.slice(re.lastIndex, j - 1))[index] ?? '';
      const good = isServiceCall(arg) || (/^[\w$]+$/.test(arg) && boundToService(src, arg, m.index));
      calls.push(`${path.relative(APP_ROOT, abs)}:${src.slice(0, m.index).split('\n').length} ${fn}(${arg}, …) ${good ? 'service' : 'SESSION'}`);
      if (!good) ok = false;
    }
  }
  return { ok: ok && calls.length > 0, calls };
}

export function classifySite(
  files: string[],
  site: Site,
  rawSource?: string,
): { service: boolean; why: string } {
  const src = stripComments(rawSource ?? fs.readFileSync(path.join(APP_ROOT, site.file), 'utf8'));
  const lines = src.split('\n');
  const lineStart = lines.slice(0, site.line - 1).join('\n').length + (site.line > 1 ? 1 : 0);
  const fromIdx = src.indexOf('.from(', lineStart);
  if (site.kind === 'embed') return { service: false, why: 'an embed naming a contact column (none may exist)' };
  if (fromIdx === -1) return { service: false, why: 'could not find the .from( of this site' };
  const recv = receiverBefore(src, fromIdx);
  if (isServiceCall(recv)) return { service: true, why: `inline ${recv}` };
  if (!/^[\w$]+$/.test(recv)) return { service: false, why: `receiver \`${recv}\` is not provably the service role` };
  const assigned = nearestAssignment(src, recv, fromIdx);
  const param = enclosingParam(src, fromIdx, recv);
  // Whichever binding is CLOSER to the read wins.
  if (assigned && (!param || assigned.index > param.at)) {
    return boundToService(src, recv, fromIdx)
      ? { service: true, why: `\`${recv}\` = ${assigned.expr.slice(0, 40)}` }
      : { service: false, why: `receiver \`${recv}\` = ${assigned.expr.slice(0, 60)} — a browser-session client` };
  }
  if (param) {
    const { ok, calls } = callersPassService(files, param.fn, param.index);
    return {
      service: ok,
      why: `\`${recv}\` is parameter ${param.index} of ${param.fn}; callers:\n      ${calls.join('\n      ') || '(none found)'}`,
    };
  }
  return { service: false, why: `receiver \`${recv}\` is a browser-session client` };
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
  for (const f of ['app/admin/verify/page.tsx', 'lib/vendor-invites.ts', 'app/api/profile/export/route.ts']) {
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
  const page = stripComments(fs.readFileSync(path.join(APP_ROOT, 'app', 'vendor-dashboard', 'shop', 'page.tsx'), 'utf8'));
  assert.match(page, /fetchOwnVendorProfile\(/, 'My Shop no longer loads the shop through fetchOwnVendorProfile');
  assert.match(page, /contact_phone:\s*profile\.contact_phone/, 'My Shop no longer shows the shop its phone');
  assert.match(page, /contact_email:\s*profile\.contact_email/, 'My Shop no longer shows the shop its email');
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

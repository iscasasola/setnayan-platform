/**
 * A BOOKING'S FIVE AMOUNTS ARE READ ONLY ON THE SERVICE ROLE — or through `event_vendor_money_read` (#5936).
 * Source half of migration 20271343340931 (migration B); the database half is
 * tests/db/a-suppliers-only-delegate-reads-no-booking-amount.db.test.ts.
 *
 * WHY A SOURCE GUARD AS WELL AS THE DB TEST
 * -----------------------------------------
 * Since migration B neither `anon` nor `authenticated` holds SELECT on `event_vendors.total_cost_php ·
 * deposit_paid_php · transport_php · food_allowance_php · pax_surcharge_php`. A browser-session query that names
 * one — in the select list, a filter, an order, an embed, or as `*` — is not blanked: PostgREST refuses the WHOLE
 * statement with 42501, supabase-js hands back `{ data: null, error }`, and the page goes quietly empty FOR THE HOST
 * TOO. The replay cannot see the app's clients, so this reads every query site and demands its client be the
 * service role. Read the amounts on a session with `readBookingMoney` / `withBookingMoney`
 * (lib/event-vendor-money.ts) instead.
 *
 * A WRITE IS NOT A READ. Migration B keeps INSERT/UPDATE on the five (lib/booking-cost-write.ts decides what a caller
 * may write), and `.update({ total_cost_php }).select('vendor_id')` reads only vendor_id — so the payload of
 * `.update(` / `.insert(` / `.upsert(` is cut out before the chain is searched. A returning `.select()` with no list
 * is `*` and IS caught.
 *
 * 🔑 IT TESTS THE CLAIM, NOT A NAME — the receiver proof is lib/security/service-role-receiver.ts, shared with
 * shop-contact-is-not-session-readable.test.ts. A receiver the proof cannot follow (a destructured option, a field
 * of a gate's result, a parameter passed down two functions) must be listed in PROVEN_BY_HAND with its reason —
 * per function, not per file, so a NEW session read in the same file still fails.
 *
 * WHAT IT DOES NOT SEE (so green is not over-read): a select built from a variable that is neither a same-file
 * SCREAMING_CASE constant nor resolved by select-column-scan, and a dynamic `.from(tableName)`.
 *
 * Run (from apps/web): tsx --test lib/security/booking-money-is-not-session-readable.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP_ROOT, collectSourceFiles, scanAllSelectSites } from './select-column-scan';
import { classifySite, type Site } from './service-role-receiver';
import { stripComments } from '../strip-comments';
import { BOOKING_MONEY_COLUMNS } from '../event-vendor-money';

const MONEY = new RegExp(`\\b(${BOOKING_MONEY_COLUMNS.join('|')})\\b`, 'g');
const TABLE = 'event_vendors';

/**
 * Reads of an amount whose client IS the service role, but by a route the receiver proof cannot follow.
 * Key: `<file>::<enclosing function>`. Each one checked by hand on 2026-11-13 (#5936 migration B).
 */
const PROVEN_BY_HAND: Record<string, string> = {
  'lib/booking-fee-disclosure.server.ts::feeBaseTotalPhp':
    'called only by forecastForBooking(admin) — whose callers pass `admin` / `paxAdmin` = createAdminClient() ' +
    '(vendor clients page, vendor thread page) — and by forecastsForBookings, which has no caller',
  'lib/booking-payment-plan.server.ts::freezePaymentPlanAtBooking':
    'callers: vendors/actions.ts (planAdmin = createAdminClient()) and freezePaymentPlanAfterSupplierAgreed, whose ' +
    'one caller passes createAdminClient() inline',
  'lib/claimed-per-guest-shop.server.ts::readShopPerGuest':
    'RW-08 — callers: vendor-dashboard/customers/page.tsx (rosterAdmin = createAdminClient()) and ' +
    'readSupplierEventLines, whose `admin` every caller builds with createAdminClient(); scoped to the session-proved shop',
  'lib/setnayan-ai-snapshot.ts::buildPlanningSnapshot':
    'callers: setnayan-ai-notify.ts (admin = createAdminClient()) and computeUserAiDigest, which has no caller',
  'lib/thread-decision-sources.server.ts::fetchThreadPayments':
    '`opts.adminClient` — both callers pass decisionAdmin / paxAdmin = createAdminClient()',
};

type MoneySite = Site & { fn: string };

/** The balanced-paren argument starting at `open` (index of the `(`), or the rest of the text. */
function balanced(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return text.length;
}

/** The chain after a `.from('event_vendors')`, with every write payload cut out. */
function readPartOfChain(src: string, after: number): string {
  const rest = src.slice(after, after + 2500);
  const stop = rest.search(/\.from\(|;\s*\n/);
  let chain = stop > 0 ? rest.slice(0, stop) : rest;
  for (;;) {
    const w = /\.(update|insert|upsert)\(/.exec(chain);
    if (!w) break;
    const open = w.index + w[0].length - 1;
    chain = chain.slice(0, w.index) + chain.slice(balanced(chain, open) + 1);
  }
  return chain;
}

/** Same-file constants a select names (`.select(COLS)`, `${COLS}`), appended so their columns are searched too. */
function withConstants(src: string, text: string): string {
  let out = text;
  for (const c of new Set(text.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) ?? [])) {
    const d = new RegExp(`\\b${c}\\s*(?::[^=]+)?=\\s*([\\s\\S]{0,1500}?);`).exec(src);
    if (d) out += ` ${d[1]}`;
  }
  return out;
}

function enclosingFunction(src: string, at: number): string {
  const re = /(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>)/g;
  let name = '(module)';
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) && m.index < at) name = (m[1] ?? m[2])!;
  return name;
}

const lineOf = (src: string, i: number) => src.slice(0, i).split('\n').length;

/** Every query site in ONE source that reads an amount off event_vendors (pure — the fixtures use it too). */
export function moneySitesIn(raw: string, file: string): MoneySite[] {
  if (!raw.includes(TABLE)) return [];
  const src = stripComments(raw);
  const out: MoneySite[] = [];
  const re = new RegExp(`\\.from\\(\\s*['"\`]${TABLE}['"\`]\\s*\\)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const chain = readPartOfChain(src, m.index + m[0].length);
    const cols = [...new Set(withConstants(src, chain).match(MONEY) ?? [])];
    const star = /\.select\(\s*\)|\.select\(\s*['"`]\s*\*\s*['"`]/.test(chain);
    if (cols.length || star) {
      out.push({ file, line: lineOf(src, m.index), table: TABLE, columns: star ? [...cols, '*'] : cols,
                 kind: star ? 'star' : 'select', fn: enclosingFunction(src, m.index) });
    }
  }
  // An embed — `event_vendors(…)`, `ev:event_vendors!fk(…)` — inside ANOTHER table's select, checked against the
  // receiver of the `.from(` it hangs off.
  const em = new RegExp(`\\b${TABLE}(?:![\\w]+)?\\s*\\(([^)]*)\\)`, 'g');
  while ((m = em.exec(src))) {
    const inner = m[1]!;
    const cols = [...new Set(inner.match(MONEY) ?? [])];
    if (!cols.length && !/\*/.test(inner)) continue;
    const from = src.lastIndexOf('.from(', m.index);
    if (from === -1) continue;
    out.push({ file, line: lineOf(src, from), table: `${TABLE}(embed)`, columns: cols.length ? cols : ['*'],
               kind: 'select', fn: enclosingFunction(src, from) });
  }
  return out;
}

const ALL_FILES = collectSourceFiles(APP_ROOT);
const IN_SCOPE = ALL_FILES.filter((f) => /^(app|lib|components)\//.test(path.relative(APP_ROOT, f).split(path.sep).join('/')));

function scan(): MoneySite[] {
  const sites: MoneySite[] = [];
  const seen = new Set<string>();
  for (const abs of IN_SCOPE) {
    const rel = path.relative(APP_ROOT, abs).split(path.sep).join('/');
    for (const s of moneySitesIn(fs.readFileSync(abs, 'utf8'), rel)) {
      seen.add(`${s.file}:${s.line}`);
      sites.push(s);
    }
  }
  // Selects whose list is an IMPORTED constant — resolved by the shared select scanner.
  for (const s of scanAllSelectSites().sites) {
    if (s.table !== TABLE || !/^(app|lib|components)\//.test(s.file)) continue;
    const cols = s.columns.filter((c) => (BOOKING_MONEY_COLUMNS as readonly string[]).includes(c));
    if (!cols.length || seen.has(`${s.file}:${s.line}`)) continue;
    const src = stripComments(fs.readFileSync(path.join(APP_ROOT, s.file), 'utf8'));
    const lineStart = src.split('\n').slice(0, s.line - 1).join('\n').length;
    seen.add(`${s.file}:${s.line}`);
    sites.push({ ...s, columns: cols, kind: 'select', fn: enclosingFunction(src, lineStart) });
  }
  return sites;
}

const SITES = scan();

test('ANTI-VACUITY: the scan finds the known service-role readers (it is measuring something)', () => {
  // 17 sites on 2026-11-13. The floor is under that so a refactor does not trip it; a blind scanner would.
  assert.ok(SITES.length >= 12, `only ${SITES.length} booking-amount read sites found — the scanner is blind`);
  const files = new Set(SITES.map((s) => s.file));
  for (const f of ['app/admin/disputes/actions.ts', 'lib/verified-median-read.ts', 'lib/claim-door.server.ts']) {
    assert.ok(files.has(f), `the scan no longer sees ${f}, a known service-role reader — it is not measuring what it claims`);
  }
  console.log(`# booking-amount read sites scanned: ${SITES.length}`);
});

test('ANTI-VACUITY: a session read IS caught, a service read and a session WRITE are not (fixtures, not the repo)', () => {
  const fixture = [
    "import { createClient } from '@/lib/supabase/server';",
    "import { createAdminClient } from '@/lib/supabase/admin';",
    "const COLS = 'vendor_id, food_allowance_php';",
    'export async function bad() {',
    '  const supabase = await createClient();',
    "  await supabase.from('event_vendors').select('vendor_id, total_cost_php').eq('event_id', 'e');",
    "  await supabase.from('event_vendors').select('vendor_id').gt('deposit_paid_php', 0);",
    "  await supabase.from('event_vendors').select('*').eq('event_id', 'e');",
    "  await supabase.from('event_vendors').insert({ event_id: 'e', total_cost_php: 1 }).select();",
    "  await supabase.from('event_vendors').select(COLS);",
    "  await supabase.from('event_vendors').select(`vendor_id, transport_php, ${'x'}`);",
    "  await supabase.from('vendor_payments').select('payment_id, ev:event_vendors!fk(pax_surcharge_php)');",
    '}',
    'export async function write() {',
    '  const supabase = await createClient();',
    "  await supabase.from('event_vendors').update({ total_cost_php: 1, transport_php: 2 }).eq('vendor_id', 'v').select('vendor_id');",
    '}',
    'export async function good() {',
    '  const admin = createAdminClient();',
    "  return admin.from('event_vendors').select('vendor_id, total_cost_php');",
    '}',
  ].join('\n');
  // Classified from the STRING — never written into the tree, where a concurrent scanner could pick it up.
  const rel = 'lib/security/__booking_money_fixture__.ts';
  const sites = moneySitesIn(fixture, rel);
  const byLine = new Map(sites.map((s) => [s.line, classifySite([], s, fixture).service]));
  for (const [line, what] of [
    [6, 'a session select of total_cost_php'],
    [7, 'a session FILTER on deposit_paid_php'],
    [8, "a session select('*')"],
    [9, 'a session insert(...).select() with no list (= *)'],
    [10, 'a session select of a same-file constant naming food_allowance_php'],
    [11, 'a session template select naming transport_php'],
    [12, 'a session EMBED naming pax_surcharge_php'],
  ] as const) {
    assert.equal(byLine.get(line), false, `${what} was not caught — the guard is blind (line ${line})`);
  }
  assert.ok(!byLine.has(16), 'a session WRITE of an amount, returning vendor_id, was taken for a read — the guard cries wolf');
  assert.equal(byLine.get(20), true, 'a createAdminClient() read was refused — the guard cries wolf');
});

test('no browser-session query names one of the five booking amounts (or *) on event_vendors', () => {
  const bad: string[] = [];
  for (const s of SITES) {
    if (`${s.file}::${s.fn}` in PROVEN_BY_HAND) continue;
    const v = classifySite(ALL_FILES, s);
    if (process.env.MONEY_DEBUG) console.log(`# ${s.file}:${s.line} ${s.fn} ${v.service ? 'service' : 'SESSION'} — ${v.why}`);
    if (!v.service) bad.push(`${s.file}:${s.line} in ${s.fn} (${s.table}: ${s.columns.join(',')}) — ${v.why}`);
  }
  assert.deepEqual(
    bad,
    [],
    `These name ${BOOKING_MONEY_COLUMNS.join(' · ')} (or *) on event_vendors on a BROWSER SESSION. Since migration ` +
      '20271343340931 neither anon nor authenticated may read them, so PostgREST refuses the WHOLE statement (42501) ' +
      'and the page goes quietly empty — for the host too. Select without the amounts and merge them back with ' +
      'readBookingMoney / withBookingMoney (lib/event-vendor-money.ts), or read on createAdminClient() scoped by a ' +
      'session-proved id. If the client IS the service role by a route the proof cannot follow, add ' +
      '`<file>::<function>` to PROVEN_BY_HAND with why:\n  ' +
      bad.join('\n  '),
  );
});

test('every PROVEN_BY_HAND entry still reads an amount and still names a service-role client (no stale allowance)', () => {
  const live = new Set(SITES.map((s) => `${s.file}::${s.fn}`));
  const stale = Object.keys(PROVEN_BY_HAND).filter((k) => !live.has(k));
  assert.deepEqual(stale, [], 'remove these from PROVEN_BY_HAND — they no longer read a booking amount');
  const noAdmin = Object.keys(PROVEN_BY_HAND).filter((k) => {
    const src = fs.readFileSync(path.join(APP_ROOT, k.split('::')[0]!), 'utf8');
    return !/createAdminClient|adminClient|\badmin\b|planAdmin/.test(src);
  });
  assert.deepEqual(noAdmin, [], 'these name no admin client at all — they read on a user session');
});

test('no later migration hands a booking amount (or the whole of event_vendors) back to a browser role', () => {
  const dir = path.join(APP_ROOT, '..', '..', 'supabase', 'migrations');
  const LOCK = '20271343340931';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const lockFile = files.find((f) => f.startsWith(LOCK));
  assert.ok(lockFile, `the close migration ${LOCK} is missing`);
  const lock = fs.readFileSync(path.join(dir, lockFile), 'utf8').replace(/--[^\n]*/g, '');
  assert.match(
    lock,
    /REVOKE\s+SELECT\s*\(\s*total_cost_php\s*,\s*deposit_paid_php\s*,\s*transport_php\s*,\s*food_allowance_php\s*,\s*pax_surcharge_php\s*\)\s+ON\s+public\.event_vendors\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i,
  );
  const problems: string[] = [];
  for (const f of files.filter((x) => x > lockFile)) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8').replace(/--[^\n]*/g, '');
    const re = /GRANT\s+([^;]*?)\s+ON\s+(?:TABLE\s+)?(?:public\.)?event_vendors\s+TO\s+([^;]+);/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) {
      if (!/\b(anon|authenticated|PUBLIC)\b/i.test(m[2]!)) continue;
      const privs = m[1]!;
      const tableWide = /\b(SELECT|ALL)\b(?!\s*\()/i.test(privs);
      if (tableWide || new RegExp(`\\b(${BOOKING_MONEY_COLUMNS.join('|')})\\b`).test(privs)) {
        problems.push(`${f}: GRANT ${privs.replace(/\s+/g, ' ').slice(0, 120)} … TO ${m[2]!.trim()}`);
      }
    }
  }
  assert.deepEqual(problems, [], 'a later migration re-opens a booking amount to a browser role (#5936)');
});

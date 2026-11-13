/**
 * BOOKING MONEY READS THROUGH THE READER — the code half of #5936 (migration 20271342818285).
 *
 * The database half (tests/db/a-suppliers-only-delegate-reads-no-booking-amount.db.test.ts) proves a Suppliers
 * delegate without Budget & payments reads none of the five amounts through `event_vendor_money_read`, and that the
 * hosts do. What the database cannot see is the app: the reader is the one path today, and once migration B (a later
 * PR) closes the five columns per column, a user-session select that still names one of them (or `*`) will be
 * refused outright and the page will break for the HOST too. So this walks every `.from('event_vendors')` select in app/, lib/ and components/ and fails on any
 * that names an amount or `*` — unless the file is listed below as reading on the SERVICE ROLE (the admin client
 * keeps every column; a Suppliers-only delegate never reaches it).
 *
 * Read the amounts with `readBookingMoney` / `withBookingMoney` from lib/event-vendor-money.ts instead.
 *
 * Run (from apps/web): tsx --test lib/booking-money-reads-through-the-reader.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { BOOKING_MONEY_COLUMNS } from './event-vendor-money';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MONEY = new RegExp(`\\b(${BOOKING_MONEY_COLUMNS.join('|')})\\b`);

/** Files whose event_vendors selects of an amount run on the SERVICE ROLE — each one checked by hand (#5936). */
const SERVICE_ROLE_READS: Record<string, string> = {
  'app/admin/disputes/actions.ts': 'admin console — createAdminClient',
  'app/admin/disputes/_components/deposit-disputes-section.tsx': 'admin console — createAdminClient',
  'app/admin/events/actions.ts': 'admin console — createAdminClient (select *)',
  'app/dashboard/[eventId]/delete-actions.ts': 'createAdminClient after the host gate',
  'app/vendor-dashboard/messages/[threadId]/pax-actions.ts': 'the shop side — createAdminClient',
  'lib/admin/app-performance-stats.ts': 'admin console — createAdminClient (select *)',
  'lib/booking-fee-disclosure.server.ts': 'createAdminClient',
  'lib/booking-payment-plan.server.ts': 'planAdmin — every caller passes createAdminClient()',
  'lib/claim-door.server.ts': 'createAdminClient',
  'lib/plausibility-scanner.ts': 'createAdminClient',
  'lib/setnayan-ai-snapshot.ts': 'admin — every caller passes the admin client',
  'lib/thread-decision-sources.server.ts': 'fetchThreadPayments({ adminClient }) — both callers pass the admin client',
  'lib/vendor-card-from-couple.ts': 'admin — the one caller passes createAdminClient()',
  'lib/verified-median-read.ts': 'createAdminClient',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** The argument of the first `.select(` after `from`, up to its matching paren. */
function selectArg(src: string, from: number): string | null {
  const rest = src.slice(from);
  const stop = rest.search(/\.from\(|;\s*\n/);
  const chain = stop > 0 ? rest.slice(0, stop) : rest;
  const at = chain.indexOf('.select(');
  if (at < 0) return null;
  let depth = 0;
  for (let i = at + '.select'.length; i < chain.length; i++) {
    if (chain[i] === '(') depth++;
    else if (chain[i] === ')' && --depth === 0) return chain.slice(at + '.select('.length, i);
  }
  return chain.slice(at + '.select('.length);
}

function moneySelects(): Map<string, number[]> {
  const found = new Map<string, number[]>();
  for (const abs of ['app', 'lib', 'components'].flatMap((d) =>
    fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : [],
  )) {
    const raw = fs.readFileSync(abs, 'utf8');
    if (!raw.includes('event_vendors')) continue;
    const src = stripComments(raw);
    const re = /\.from\(\s*['"]event_vendors['"]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const arg = selectArg(src, m.index + m[0].length);
      if (arg === null) continue;
      // Resolve a SCREAMING_CASE constant named in the select, when it is declared in the same file.
      let text = arg;
      for (const c of arg.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) ?? []) {
        const d = new RegExp(`\\b${c}\\s*=\\s*([\\s\\S]{0,1500}?);`).exec(src);
        if (d) text += ` ${d[1]}`;
      }
      const star = /^\s*$/.test(arg) || /['"`]\s*\*\s*['"`]/.test(arg);
      if (star || MONEY.test(text)) {
        const rel = path.relative(ROOT, abs).split(path.sep).join('/');
        const line = src.slice(0, m.index).split('\n').length;
        found.set(rel, [...(found.get(rel) ?? []), line]);
      }
    }
  }
  return found;
}

test('no user-session event_vendors select names a booking amount or *', () => {
  const found = moneySelects();
  const bad = [...found.entries()]
    .filter(([f]) => !(f in SERVICE_ROLE_READS))
    .map(([f, lines]) => `${f} (from() near line ${lines.join(', ')})`);
  assert.deepEqual(
    bad,
    [],
    `These select one of ${BOOKING_MONEY_COLUMNS.join(' · ')} (or *) from event_vendors. On a user session that is ` +
      'refused once migration B closes the columns (#5936); the reader is the one path today. Read the amounts with readBookingMoney / withBookingMoney ' +
      '(lib/event-vendor-money.ts) — or, if this read is on the admin client, add the file to SERVICE_ROLE_READS with why.',
  );
});

test('every SERVICE_ROLE_READS entry still exists and still reads an amount (no stale allowance)', () => {
  const found = moneySelects();
  const stale = Object.keys(SERVICE_ROLE_READS).filter((f) => !found.has(f));
  assert.deepEqual(stale, [], 'remove these from SERVICE_ROLE_READS — they no longer select a booking amount');
});

test('the service-role allowances really use a service-role client', () => {
  const noAdmin = Object.keys(SERVICE_ROLE_READS).filter((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return !/createAdminClient|adminClient|\badmin\b|planAdmin/.test(src);
  });
  assert.deepEqual(noAdmin, [], 'these name no admin client at all — they read on a user session');
});

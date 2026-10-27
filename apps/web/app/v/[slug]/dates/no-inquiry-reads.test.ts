/**
 * 🔒 CHECK A DATE NEVER READS AN INQUIRY (owner 2026-10-28, verbatim: *"it will only show dates not bookable and
 * available dates. and will not show if there are current inquiries on that day."* → DECISION_LOG "✅📅 CHECK A DATE —
 * APPROVED": "a guard that no query on this page touches the inquiry or thread tables").
 *
 * WHAT IT WALKS. Every module the route can reach at run time (a type-only import is erased, so it is not followed) — `page.tsx`, then each import it names (`@/…` and relative),
 * transitively, through the server read (`lib/check-a-date.server.ts`), the pure answer, the client calendar and
 * every shared component they load. A `'use server'` module is a DOOR, not a read the page makes: it runs only when
 * the couple presses Send. The walk stops at each door and records it.
 *
 * WHAT IT REFUSES (comments stripped first, so a docblock may still NAME a table to explain itself):
 *   · any reachable module that is not a door naming a conversation / ask table as a string — `chat_threads`,
 *     `chat_messages`, `chat_thread_reads`, `chat_message_flags`, `thread_service_interests`, `thread_calls`,
 *     `inquiry_outcomes`, `inquiry_outcome_reason_codes`, `vendor_payment_asks` — or calling an RPC whose name
 *     says chat / thread / inquir;
 *   · any door that names one of those tables, other than the ONE shipped send — `app/v/[slug]/inquiry-actions.ts`
 *     (`startServiceInquiry`), which WRITES the couple's ask and is the whole point of the Send button;
 *   · the answer builder (`lib/check-a-date.ts`) ever handing the month builder its optional list of asks (an eighth
 *     argument to `buildCustomerCalendarMonth`).
 * And it proves it can see: the walk must reach the server read, the pure answer and the client, or it fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = path.resolve(__dirname, '../../../..');
const ROUTE = 'app/v/[slug]/dates/page.tsx';
const THE_SEND = 'app/v/[slug]/inquiry-actions.ts';

export const INQUIRY_TABLES = [
  'chat_threads',
  'chat_messages',
  'chat_thread_reads',
  'chat_message_flags',
  'thread_service_interests',
  'thread_calls',
  'inquiry_outcomes',
  'inquiry_outcome_reason_codes',
  'vendor_payment_asks',
] as const;
const TABLE_LITERAL = new RegExp(`['"\`](?:${INQUIRY_TABLES.join('|')})['"\`]`);
const ASK_RPC = /\.rpc\(\s*['"`][^'"`]*(?:chat|thread|inquir)[^'"`]*['"`]/i;

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(WEB, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

/** `import … from 'x'` · `export … from 'x'` · `import 'x'` · `import('x')`. A type-only import is erased at build — no code. */
const SPEC = /(?:import|export)\s+(type\s+)?(?:[^'"`;]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

export function walkRoute(entry: string): { reached: string[]; doors: string[]; bad: string[]; doorsNamingAsks: string[] } {
  const seen = new Set<string>();
  const doors: string[] = [];
  const bad: string[] = [];
  const doorsNamingAsks: string[] = [];
  const queue = [path.join(WEB, entry)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const raw = fs.readFileSync(file, 'utf8');
    const code = stripComments(raw);
    const rel = path.relative(WEB, file);
    const names = TABLE_LITERAL.test(code) || ASK_RPC.test(code);
    if (/^\s*['"]use server['"]/.test(code)) {
      doors.push(rel);
      if (names) doorsNamingAsks.push(rel);
      continue;
    }
    if (names) bad.push(rel);
    for (const m of code.matchAll(SPEC)) {
      if (m[1]) continue;
      const spec = m[2] ?? m[3];
      if (!spec) continue;
      const hit = resolve(file, spec);
      if (hit && !/\.test\.tsx?$/.test(hit)) queue.push(hit);
    }
  }
  return { reached: [...seen].map((f) => path.relative(WEB, f)).sort(), doors: doors.sort(), bad: bad.sort(), doorsNamingAsks: doorsNamingAsks.sort() };
}

const walk = walkRoute(ROUTE);

test('the walk sees the route: page, server read, pure answer and the client calendar are all reached', () => {
  for (const must of [ROUTE, 'lib/check-a-date.server.ts', 'lib/check-a-date.ts', 'app/v/[slug]/dates/_components/check-a-date-calendar.tsx', 'lib/vendor-customers.ts']) {
    assert.ok(walk.reached.includes(must), `the walk did not reach ${must} — it cannot vouch for what it never read`);
  }
  assert.ok(walk.reached.length >= 10, `only ${walk.reached.length} modules reached — the import walk is broken`);
  console.log(`[no-inquiry-reads] ${walk.reached.length} modules walked · ${walk.doors.length} server-action doors`);
});

test('no module the page reaches names a conversation or ask table, or an ask RPC', () => {
  assert.deepEqual(walk.bad, [], `these modules reachable from ${ROUTE} name an inquiry/chat table:\n${walk.bad.join('\n')}`);
});

test('the only door that touches a conversation is the shipped Send (startServiceInquiry)', () => {
  assert.deepEqual(walk.doorsNamingAsks, [THE_SEND]);
  assert.ok(walk.doors.includes(THE_SEND), 'the Send no longer goes through the shipped inquiry action');
});

test('the answer builder never hands the month builder a list of asks', () => {
  const src = stripComments(fs.readFileSync(path.join(WEB, 'lib/check-a-date.ts'), 'utf8'));
  const calls = [...src.matchAll(/buildCustomerCalendarMonth\(([^;]*?)\);/gs)].map((m) => m[1] ?? '');
  assert.ok(calls.length > 0, 'lib/check-a-date.ts no longer calls the shipped month builder — re-point this guard');
  for (const args of calls) {
    const count = args.split(',').filter((a) => a.trim().length > 0).length;
    assert.equal(count, 7, `buildCustomerCalendarMonth is called with ${count} arguments — the 8th is the asks list`);
  }
  assert.doesNotMatch(src, /inquir|ask(?:s|ing)\b/i, 'lib/check-a-date.ts mentions asks/inquiries in code');
});

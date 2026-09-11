/**
 * THE SHOP'S HOLD LIMIT COUNTS EVERY COUPLE — LOCK-PATH 2, migration
 * 20271223386305.
 *
 * The couple's Lock is refused with `soft_hold_limit_reached` once the shop
 * already has `max_soft_holds_per_date` other couples holding that date at
 * `contracted` (Rule 3, owner 2026-05-24). That gate used to count through the
 * COUPLE'S session — RLS shows a couple only their own events — so it counted 0
 * and never refused. It now asks ONE server-only definer count,
 * `vendor_soft_holds_on`, with the admin client.
 *
 * The behaviour is proven as real sessions in
 * tests/db/the-suppliers-yes-and-the-hold-limit-really-refuse.db.test.ts. THIS
 * file pins the TypeScript half, which no replay can see: that the gate asks the
 * definer count (and not the couple's session), only on a day-precise event,
 * with the shop and the date it read off the couple's own rows, and refuses AT
 * the limit. Every needle is mutation-checked below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { stripSqlComments } from '@/lib/security/events-column-privileges';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const MIGRATIONS = join(WEB, '../../supabase/migrations');
const ACTIONS = 'app/dashboard/[eventId]/vendors/actions.ts';
const COUNT_FN = 'vendor_soft_holds_on';

const squash = (s: string) => s.replace(/\s+/g, ' ');

/** finalizeVendor's hold-limit gate: from the limit read to the refusal. */
function holdGate(src: string): string {
  const start = src.search(/export async function finalizeVendor\(/);
  assert.ok(start >= 0, 'finalizeVendor is gone — re-derive where the hold limit is enforced');
  const from = src.indexOf(".select('max_soft_holds_per_date')", start);
  assert.ok(from > start, 'the hold gate no longer reads max_soft_holds_per_date — re-derive it');
  const to = src.indexOf("'soft_hold_limit_reached'", from);
  assert.ok(to > from, 'the hold gate no longer refuses with soft_hold_limit_reached — re-derive it');
  // …and the event read just above it, which carries the date and its precision.
  const eventRead = src.lastIndexOf(".from('events')", from);
  assert.ok(eventRead > start, 'the hold gate no longer reads the couple’s own event');
  return squash(src.slice(eventRead, to));
}

const gate = holdGate(stripComments(readFileSync(join(WEB, ACTIONS), 'utf8')));

/** Every needle the gate must carry; the audit returns the ones missing. */
const NEEDLES: Array<[string, RegExp]> = [
  ['asks the definer count with the admin client', /await createAdminClient\(\)\.rpc\( 'vendor_soft_holds_on', \{ p_vendor_profile_id: targetVendor\.marketplace_vendor_id, p_day: weddingDate, p_exclude_event_id: eventId, \}, \)/],
  ['reads the date and its precision off the couple’s own event', /\.from\('events'\) \.select\('event_date, event_date_precision'\) \.eq\('event_id', eventId\)/],
  ['asks only on a day-precise event', /eventRow\?\.event_date_precision === 'day'/],
  ['refuses AT the limit, not past it', /typeof held === 'number' && held >= limit/],
  ['a failed count degrades open but is never silent', /if \(heldErr\) \{ console\.error\('\[finalizeVendor\] hold limit: count failed', heldErr\.message\);/],
];
/** What the gate must NOT do: count through the couple's own session. */
const FORBIDDEN: Array<[string, RegExp]> = [
  ['counts bookings through the couple’s session', /supabase \.from\('event_vendors'\)/],
  ['lists same-date events through the couple’s session', /\.eq\('event_date', weddingDate\)/],
];

function audit(g: string): string[] {
  const out: string[] = [];
  for (const [name, re] of NEEDLES) if (!re.test(g)) out.push(`lost: ${name}`);
  for (const [name, re] of FORBIDDEN) if (re.test(g)) out.push(`back: ${name}`);
  return out;
}

test('the hold gate asks the definer count, on a day-precise date, and refuses at the limit', () => {
  assert.deepEqual(audit(gate), []);
});

test('MUTATION · every needle fails the audit when removed, and the old session count fails it when put back', () => {
  for (const [name, re] of NEEDLES) {
    const before = (gate.match(new RegExp(re.source, 'g')) ?? []).length;
    const sabotaged = gate.replace(new RegExp(re.source, 'g'), 'TRUE');
    const after = (sabotaged.match(new RegExp(re.source, 'g')) ?? []).length;
    assert.ok(before >= 1 && after === 0, `sabotage of "${name}" did not land (${before} → ${after})`);
    assert.ok(audit(sabotaged).includes(`lost: ${name}`), `removing "${name}" went unseen`);
  }
  const oldCount = `${gate} const { count } = await supabase .from('event_vendors') .select('vendor_id') .eq('event_date', weddingDate)`;
  const back = audit(oldCount);
  for (const [name] of FORBIDDEN) assert.ok(back.includes(`back: ${name}`), `restoring the old count went unseen: ${name}`);
});

/** The body in force: the LAST migration (filename order) that defines it. */
function latest(fn: string): { file: string; sql: string; body: string } {
  const create = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${fn}\\s*\\(`);
  const defining = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: stripSqlComments(readFileSync(join(MIGRATIONS, file), 'utf8')) }))
    .filter((m) => create.test(m.sql));
  assert.ok(defining.length > 0, `no migration defines public.${fn}`);
  const { file, sql } = defining[defining.length - 1]!;
  const start = sql.search(create);
  const open = /\$([A-Za-z_]*)\$/.exec(sql.slice(start));
  assert.ok(open, `${file}: no dollar-quoted body for ${fn}`);
  const bodyStart = start + open.index + open[0].length;
  const bodyEnd = sql.indexOf(open[0], bodyStart);
  return { file, sql, body: squash(sql.slice(bodyStart, bodyEnd)) };
}

test('the count is the gate’s own rule: contracted only, not archived, day-precise, one per couple, never the asker', () => {
  const { file, body } = latest(COUNT_FN);
  // The status set is the gate's own definition since Rule 3 (2026-05-24):
  // `contracted` — agreed, not yet paid. A paid booking is not a "hold".
  const statuses = [...body.matchAll(/ev\.status\s*(?:=|IN)\s*\(?([^)\n]*?)(?:\)|\sAND)/g)].flatMap((m) =>
    [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]),
  );
  assert.deepEqual(statuses, ['contracted'], `${file}: the hold count counts ${statuses.join(', ')}`);
  assert.match(body, /count\(DISTINCT ev\.event_id\)/, 'a package couple (anchor + covered lines) must be ONE hold');
  assert.match(body, /AND ev\.archived_at IS NULL/);
  assert.match(body, /AND e\.event_date = p_day AND e\.event_date_precision = 'day'/, 'a month-only event is no hold on the 1st');
  assert.match(body, /ev\.event_id <> p_exclude_event_id/, 'the asking couple must never count against themselves');
  assert.doesNotMatch(body, /\b(INSERT|UPDATE|DELETE)\b/);
});

test('only the server may call it, and only the lock’s gate does', () => {
  const { file, sql } = latest(COUNT_FN);
  assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${COUNT_FN}\\([\\s\\S]*?\\bSTABLE\\b[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path`));
  const sig = `public\\.${COUNT_FN}\\([^)]*\\)`;
  assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC, anon, authenticated;`));
  const grants = [...sql.matchAll(new RegExp(`GRANT [^;]* ON FUNCTION ${sig} TO ([^;]+);`, 'g'))].map((m) => m[1]!.trim());
  assert.deepEqual(grants, ['service_role'], `${file}: a signed-in browser must never count another shop’s holds`);

  const callers: string[] = [];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
      const p = join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
    });
  for (const f of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    if (stripComments(readFileSync(f, 'utf8')).includes(`'${COUNT_FN}'`)) callers.push(relative(WEB, f));
  }
  assert.deepEqual(callers, [ACTIONS]);
  assert.equal((gate.match(/'vendor_soft_holds_on'/g) ?? []).length, 1);
});

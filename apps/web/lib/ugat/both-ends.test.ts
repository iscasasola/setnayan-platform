/**
 * lib/ugat/both-ends.test.ts — each orphan detector is RUN over fixtures and
 * sabotaged, so a green sweep in tests/db/ugat-both-ends.db.test.ts means
 * something. Every "must fire" case here is the cheapest off-switch a careless
 * edit would actually make — a constant condition, a type-only import, a bare
 * `return null` — never a deletion, which is the one mutation every guard
 * survives being wrong about.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  findComponentOrphans,
  findNoticeOrphans,
  findRpcOrphans,
  findSilentDrops,
  findTableOrphans,
  indexLiterals,
  indexWriters,
  parseAllowlist,
  parseNotificationUnion,
  rankFindings,
  formatBaseline,
  parseBaseline,
  diffBaseline,
  runtimeImports,
  tierOf,
  tierOfComponent,
  type Catalog,
  type SourceFile,
} from './both-ends';
import { scanSource } from '../supabase-unread-error-scan';

const src = (path: string, text: string): SourceFile => ({ path, text });

const CATALOG: Catalog = {
  functions: [
    { name: 'called_from_app', src: 'begin return 1; end' },
    { name: 'called_by_policy', src: 'select true' },
    { name: 'called_by_other_fn', src: 'select 1' },
    { name: 'caller_fn', src: 'select called_by_other_fn()' },
    { name: 'trg_bound', src: 'begin return new; end', returnsTrigger: true },
    { name: 'trg_unbound', src: 'begin return new; end', returnsTrigger: true },
    { name: 'named_only_in_a_comment', src: 'select 1' },
    { name: 'commenter', src: '-- calls named_only_in_a_comment() nowhere\nselect 2' },
    { name: 'called_by_default', src: 'select 3' },
    { name: 'called_via_url', src: 'select 4' },
    { name: 'writes_ledger', src: "begin insert into public.fee_ledger(a) values (1); update orders set x = 1; end" },
    { name: 'nobody_calls_me', src: 'select 5' },
  ],
  policies: [{ table: 'events', name: 'events_read', qual: 'called_by_policy(id)', withCheck: null }],
  triggers: [{ table: 'events', name: 'trg_events', fn: 'trg_bound' }],
  expressions: [{ owner: 'default events.public_id', def: 'called_by_default()' }],
  tables: ['events', 'orders', 'fee_ledger', 'seeded_vocab', 'written_by_app', 'written_dynamically', 'nobody_writes_me', 'written_only_in_test'],
  rowCounts: { seeded_vocab: 12 },
};

const SOURCES: SourceFile[] = [
  src('app/x/actions.ts', `
    export async function f(sb) {
      await sb.rpc('called_from_app', {});
      const { error } = await sb.from('written_by_app').insert({ a: 1 });
      if (error) throw error;
    }`),
  src('lib/url.ts', 'const u = `https://x.supabase.co/rest/v1/rpc/called_via_url`;'),
  src('lib/more.ts', `export const RPCS = { a: "caller_fn", b: "commenter", c: "writes_ledger" };`),
  src('lib/purge.ts', `export async function purge(admin) { for (const table of ['written_dynamically']) { await admin.from(table).delete().eq('id', 1); } }`),
  src('lib/comment-only.ts', `// .rpc('nobody_calls_me') — prose, not a call\nexport const x = 1;`),
  src('lib/x.test.ts', `await sb.from('written_only_in_test').insert({}); sb.rpc('nobody_calls_me');`),
  src('lib/ugat/graph.ts', `export const claims = [{ fn: 'nobody_calls_me' }];`),
];

test('rpc-no-caller: only the function nothing names is an orphan, and the trigger function with no trigger', () => {
  const { findings, stats } = findRpcOrphans(CATALOG, indexLiterals(SOURCES));
  assert.deepEqual(findings.map((f) => f.key).sort(), ['named_only_in_a_comment', 'nobody_calls_me', 'trg_unbound']);
  assert.equal(stats.candidates, 12);
  assert.match(findings.find((f) => f.key === 'trg_unbound')!.evidence, /no trigger is bound/);
  // A test file and the map's own claims do not vouch for a caller.
  assert.ok(findings.some((f) => f.key === 'nobody_calls_me'));
});

test('table-no-writer: seeded, app-written, dynamically-written and SQL-written tables are not orphans', () => {
  const writers = indexWriters(SOURCES, CATALOG);
  const { findings, stats } = findTableOrphans(CATALOG, writers);
  assert.deepEqual(findings.map((f) => f.key), ['events', 'nobody_writes_me', 'written_only_in_test']);
  assert.equal(stats.seeded, 1);
  assert.ok(writers.sql.get('fee_ledger')?.has('writes_ledger'));
  assert.ok(writers.sql.get('orders')?.has('writes_ledger'));
  assert.ok(writers.app.get('written_dynamically'));
  assert.equal(writers.literalSites, 1);
});

test('notice-no-emitter: parses the union and allowlists, and finds the type nobody passes', () => {
  const notificationsTs = `
export type NotificationType =
  | 'chat_message'
  // | 'commented_out_type'
  | 'payment_refunded'
  | 'ghost_type';
export const X = 1;`;
  const emitTs = `
const PUSH_ENABLED_TYPES: ReadonlySet<NotificationType> = new Set([
  'chat_message',
]);
const EMAIL_ENABLED_TYPES: ReadonlySet<NotificationType> = new Set([
  'chat_message', // ringing
  'ghost_type',
]);`;
  const union = parseNotificationUnion(notificationsTs);
  assert.deepEqual(union, ['chat_message', 'payment_refunded', 'ghost_type']);
  const email = parseAllowlist(emitTs, 'EMAIL_ENABLED_TYPES');
  assert.deepEqual([...email], ['chat_message', 'ghost_type']);
  const sources = [
    src('lib/notifications.ts', notificationsTs),
    src('lib/notification-emit.ts', emitTs),
    src('lib/chat.ts', `await emitNotification({ userId, type: 'chat_message', title: 'x' });`),
    src('app/admin/pay.ts', `const type = refunded ? 'payment_refunded' : 'payment_matched'; await emitNotification({ userId, type, title });`),
  ];
  const { findings, stats } = findNoticeOrphans(
    { union, emailAllowlist: email, pushAllowlist: parseAllowlist(emitTs, 'PUSH_ENABLED_TYPES'), enumLabels: ['chat_message', 'payment_refunded', 'ghost_type', 'db_only_label'], registryPaths: ['lib/notifications.ts', 'lib/notification-emit.ts'] },
    indexLiterals(sources),
  );
  assert.deepEqual(findings.map((f) => f.key), ['ghost_type', 'db_only_label']);
  assert.match(findings[0]!.evidence, /EMAIL allowlist/);
  assert.match(findings[1]!.evidence, /enum label with no member/);
  assert.deepEqual(stats.emittedNotAllowlisted, ['payment_refunded']);
});

test('component-no-mount: every way a component can exist and not be reachable', () => {
  const files = new Map<string, string>([
    ['app/dashboard/page.tsx', `import { Mounted } from './_components/mounted';\nimport Gated from './_components/gated';\nimport { Inert } from './_components/inert';\nimport type { Props } from './_components/type-only';\nimport { AliasMounted as AM } from '@/app/dashboard/_components/alias-mounted';\nexport default function Page(){ return <><Mounted/><AM/>{false ? (<Gated/>) : null}</>; }`],
    ['app/dashboard/_components/mounted.tsx', 'export function Mounted(){ return null; }'],
    ['app/dashboard/_components/alias-mounted.tsx', 'export function AliasMounted(){ return null; }'],
    ['app/dashboard/_components/gated.tsx', 'export default function Gated(){ return null; }'],
    ['app/dashboard/_components/inert.tsx', 'export function Inert(){ return null; }'],
    ['app/dashboard/_components/type-only.tsx', 'export type Props = {}; export function TypeOnly(){ return null; }'],
    ['app/dashboard/_components/orphan.tsx', 'export function Orphan(){ return null; }'],
    ['app/dashboard/_components/island.tsx', `import { Orphan } from './orphan';\nexport function Island(){ return <Orphan/>; }`],
    ['app/dashboard/_components/barrel.tsx', `export { Mounted } from './mounted';`],
    ['app/dashboard/_components/lazy.tsx', 'export default function Lazy(){ return null; }'],
    ['app/dashboard/layout.tsx', `import dynamic from 'next/dynamic';\nconst Lazy = dynamic(() => import('./_components/lazy'));\nexport default function L(){ return <Lazy/>; }`],
  ]);
  const testFiles = new Map([['app/dashboard/_components/orphan.test.tsx', `import { Orphan } from './orphan';`]]);
  const candidates = [...files.keys()].filter((p) => p.includes('/_components/'));
  const { findings, stats } = findComponentOrphans({ files, testFiles, candidates });
  const byKey = new Map(findings.map((f) => [f.key, f.evidence]));
  assert.deepEqual(
    [...byKey.keys()].sort(),
    ['app/dashboard/_components/barrel.tsx', 'app/dashboard/_components/gated.tsx', 'app/dashboard/_components/inert.tsx', 'app/dashboard/_components/island.tsx', 'app/dashboard/_components/orphan.tsx', 'app/dashboard/_components/type-only.tsx'],
  );
  assert.match(byKey.get('app/dashboard/_components/gated.tsx')!, /only behind a constant/);
  assert.match(byKey.get('app/dashboard/_components/inert.tsx')!, /imported but never referenced/);
  assert.match(byKey.get('app/dashboard/_components/orphan.tsx')!, /imported only by files no entry reaches/);
  assert.match(byKey.get('app/dashboard/_components/type-only.tsx')!, /no runtime importer/);
  assert.equal(stats.entries, 2);
  assert.equal(stats.constantGated, 1);
  assert.equal(stats.inert, 1);
  // The mount a lazy dynamic() import reaches, and the alias import, are real mounts.
  assert.ok(!byKey.has('app/dashboard/_components/lazy.tsx'));
  assert.ok(!byKey.has('app/dashboard/_components/alias-mounted.tsx'));
});

test('runtimeImports: type-only shapes are not edges; mixed and re-export shapes are', () => {
  const edges = runtimeImports(`
    import type { A } from './a';
    import { type B, type C } from './bc';
    import { type D, E } from './de';
    import F, { type G } from './fg';
    export type { H } from './h';
    export { type I } from './i';
    export { J } from './j';
    export * from './k';
  `);
  assert.deepEqual(edges.map((e) => [e.spec, e.locals, e.reexport]), [
    ['./de', ['E'], false],
    ['./fg', ['F'], false],
    ['./j', [], true],
    ['./k', [], true],
  ]);
});

test('result-dropped-silently: the booking-fee shape fires; a recorded reason does not', () => {
  const fires = [
    `async function f(sb){ const { data, error } = await sb.rpc('booking_fee_open_lock_charge', { id: 1 }); if (error) return { status: 'skipped' }; return data; }`,
    `async function f(sb){ const { data, error } = await sb.from('orders').select('id'); if (error) return null; return data; }`,
    `async function f(sb){ const { data, error } = await sb.from('orders').select('id'); if (error || !data) return []; return data; }`,
    `async function f(sb){ const res = await sb.from('orders').update({ a: 1 }).eq('id', 1); if (res.error) return; }`,
    `async function f(sb){ const res = await sb.from('orders').select('id'); if (res?.error) return null; return res.data; }`,
    `async function f(sb, set){ const { data, error } = await sb.from('orders').select('id'); if (!error) set(data); }`,
    `async function f(sb){ const { data, error } = await sb.from('orders').select('id'); if (!error) return data; return null; }`,
    `async function f(sb){ const { data, error } = await sb.from('orders').select('id'); return error ? null : data; }`,
  ];
  for (const s of fires) {
    assert.deepEqual(scanSource(s, 'f.ts', { silentDrops: true }).map((f) => f.kind), ['error-dropped-silently'], s);
    // OFF by default — S16's own sweep and baseline are untouched by this kind.
    assert.ok(!scanSource(s).some((f) => f.kind === 'error-dropped-silently'), `default scan must not report silent drops: ${s}`);
  }
  const quiet = [
    `async function f(sb){ const { data, error } = await sb.from('orders').select('id'); if (error) { console.error('[orders]', error.message); return null; } return data; }`,
    `async function f(sb){ const { data, error } = await sb.from('orders').select('id'); if (error) return { ok: false, message: error.message }; return data; }`,
    `async function f(sb){ const { error } = await sb.from('orders').insert({ a: 1 }); if (error) throw error; }`,
    `async function f(sb){ const { error } = await sb.from('orders').insert({ a: 1 }); if (error) return fail('Could not save'); }`,
    `async function f(sb){ const { data, error } = await sb.from('orders').select('id'); if (!error) return data; throw new Error('orders read failed'); }`,
    `async function f(sb){ const { data, error } = await sb.from('orders').select('id'); if (!error) return data; else captureException(error); }`,
    `async function f(sb){ const res = await sb.from('orders').select('id'); if (res.error) { log(res.error); return null; } return res.data; }`,
    `async function f(sb){ const { data, error } = await sb.from('orders').select('id'); const ok = !error; return { ok, data }; }`,
    `async function f(sb){ const { data, error } = await sb.from('orders').select('id'); if (error?.code === 'PGRST116') return null; return data; }`,
    `async function f(sb){
       // supabase-error-ignored: a view counter — a lost increment changes nothing a person sees
       const { error } = await sb.rpc('bump_views', { id: 1 }); if (error) return;
     }`,
  ];
  for (const s of quiet) assert.deepEqual(scanSource(s, 'f.ts', { silentDrops: true }), [], s);

  const { findings, stats } = findSilentDrops([src('app/vendor-dashboard/booking-fees/x.ts', fires[0]!), src('lib/x.test.ts', fires[0]!)]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.tier, 'money');
  assert.equal(stats.files, 1);
});

test('tiers: money outranks everything, and a component reads its route root', () => {
  assert.equal(tierOf('admin_payment_reconcile'), 'money');
  assert.equal(tierOf('vendor_lock_proposals'), 'booking');
  assert.equal(tierOf('guest_face_enrollments'), 'couple');
  assert.equal(tierOf('vendor_activities'), 'supplier');
  assert.equal(tierOf('seo_health_runs'), 'admin');
  assert.equal(tierOf('zzz'), 'other');
  assert.equal(tierOfComponent('app/vendor-dashboard/x/_components/thing.tsx'), 'supplier');
  assert.equal(tierOfComponent('app/vendor-dashboard/x/_components/payment-card.tsx'), 'money');
  assert.equal(tierOfComponent('app/dashboard/[eventId]/_components/thing.tsx'), 'couple');
  assert.equal(tierOfComponent('app/admin/x/_components/thing.tsx'), 'admin');
});

test('baseline: ranked by tier, round-trips, and a new orphan or a raised count is the only failure', () => {
  const findings = rankFindings([
    { cls: 'component-no-mount', key: 'app/admin/_components/a.tsx', count: 1, tier: 'admin', evidence: 'e' },
    { cls: 'rpc-no-caller', key: 'booking_fee_x', count: 1, tier: 'money', evidence: 'e' },
    { cls: 'result-dropped-silently', key: 'lib/x.ts · rpc:y', count: 2, tier: 'booking', evidence: 'e' },
  ]);
  assert.deepEqual(findings.map((f) => f.tier), ['money', 'booking', 'admin']);
  const text = formatBaseline(findings, ['# header']);
  assert.match(text, /# ══ MONEY/);
  const parsed = parseBaseline(text);
  assert.equal(parsed.size, 3);
  assert.equal(parsed.get('result-dropped-silently\tlib/x.ts · rpc:y')?.count, 2);
  // Same findings → nothing grown, nothing paid.
  assert.deepEqual(diffBaseline(findings, parsed), { grown: [], paidDown: [] });
  // A new orphan and a raised count fail; a vanished one is paid down.
  const next = [
    { ...findings[1]!, count: 3 },
    { cls: 'table-no-writer' as const, key: 'new_table', count: 1, tier: 'couple' as const, evidence: 'e' },
    findings[0]!,
  ];
  const d = diffBaseline(next, parsed);
  assert.deepEqual(d.grown.map((f) => f.key), ['lib/x.ts · rpc:y', 'new_table']);
  assert.deepEqual(d.paidDown, ['component-no-mount app/admin/_components/a.tsx']);
});

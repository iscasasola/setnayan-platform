// Unit tests for the feature-register check and the price printout (Build 6
// Lane M). Run: node --test scripts/feature-register-check.test.mjs
//
// Install-free on purpose (no node_modules, no database, no corpus), so it
// rides the required migration-guard job in CI. The corpus (FEATURE_REGISTER.md)
// is a private repo CI cannot read; the LAST test runs the real check when the
// corpus is on disk (the controller's Mac, a sibling clone) and says loudly
// that it was skipped otherwise.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  routeForPage, normaliseRoute, isExcludedRoute, censusRoutes, registerRoutes, routeIsCovered,
  flagNamesIn, pointerTokens, markdownLinks, typedPrices, checkRegister, formatReport, findCorpus, pricesIndex,
} from './lib/feature-register-core.mjs';
import { assertSelectOnly, scrub, readRows, dbUrlVar } from './lib/read-only-db.mjs';
import { formatPrices } from './print-prices.mjs';
import { readSkuFile, run } from './feature-register-check.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── the route census ─────────────────────────────────────────────────────*/

test('a page file becomes the address it serves', () => {
  assert.equal(routeForPage('page.tsx'), '/');
  assert.equal(routeForPage('(shell)/pricing/page.tsx'), '/pricing');
  assert.equal(routeForPage('dashboard/(account)/people/[dependentId]/page.tsx'), '/dashboard/people/[dependentId]');
  assert.equal(routeForPage('vendor-dashboard/@client/(..)clients/[eventId]/page.tsx'), null, 'an intercepting route has no address');
  assert.equal(routeForPage('dashboard/(launcher)/@modal/(.)create-event/page.tsx'), null);
  assert.equal(routeForPage('features/_feature-page.tsx'), null);
  assert.equal(routeForPage('_lib/x/page.tsx'), null, 'a private folder is not routed');
});

test('params of any name compare equal; queries and anchors drop', () => {
  assert.equal(normaliseRoute('/dashboard/[eventId]/guests'), '/dashboard/[*]/guests');
  assert.equal(normaliseRoute('/dashboard/[id]/guests/'), '/dashboard/[*]/guests');
  assert.equal(normaliseRoute('/sample/[...rest]'), '/sample/[*]');
  assert.equal(normaliseRoute('/x/[[...slug]]'), '/x/[*]');
  assert.equal(normaliseRoute('/admin/ugat?tab=brain'), '/admin/ugat');
  assert.equal(normaliseRoute('/website#reviews'), '/website');
});

test('the /dev labs and /api are plumbing, not features', () => {
  assert.ok(isExcludedRoute('/dev'));
  assert.ok(isExcludedRoute('/dev/shop-card-lab'));
  assert.ok(isExcludedRoute('/api/cron/x'));
  assert.ok(!isExcludedRoute('/developer'));
});

test('the census walks a tree and keeps only real pages', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-'));
  const mk = (p) => { fs.mkdirSync(path.join(root, path.dirname(p)), { recursive: true }); fs.writeFileSync(path.join(root, p), ''); };
  mk('page.tsx'); mk('(shell)/pricing/page.tsx'); mk('dev/lab/page.tsx'); mk('api/x/route.ts');
  mk('a/[id]/page.tsx'); mk('a/[slug]/page.tsx'); mk('a/@m/(.)b/page.tsx'); mk('a/layout.tsx');
  assert.deepEqual(censusRoutes(root), ['/', '/a/[*]', '/pricing']);
});

test('register routes: exact, prefix /*, and several in one cell', () => {
  const md = 'x | `/pricing` | `/dashboard/[eventId]/website/*` | `/a` · `/b` | `/c?tab=1` | `apps/x.ts` | `//not`';
  const cov = registerRoutes(md);
  assert.ok(routeIsCovered('/pricing', cov));
  assert.ok(routeIsCovered('/dashboard/[*]/website', cov));
  assert.ok(routeIsCovered('/dashboard/[*]/website/colors', cov));
  assert.ok(!routeIsCovered('/dashboard/[*]/websites', cov), 'a prefix covers its own folder, not a longer word');
  assert.ok(routeIsCovered('/a', cov) && routeIsCovered('/b', cov) && routeIsCovered('/c', cov));
  assert.ok(!routeIsCovered('/d', cov));
});

/* ── flags ─────────────────────────────────────────────────────────────────*/

test('NEXT_PUBLIC_* names: full names kept, template prefixes dropped', () => {
  const src = "process.env.NEXT_PUBLIC_CHAT_LIVE_ENABLED; env[`NEXT_PUBLIC_OAUTH_${p}`]; 'NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_' + x; NEXT_PUBLIC_A${b}";
  assert.deepEqual([...flagNamesIn(src)].sort(), ['NEXT_PUBLIC_CHAT_LIVE_ENABLED']);
});

/* ── pointers, links, typed prices ─────────────────────────────────────────*/

test('pointer tokens: paths and corpus docs, never routes, globs, URLs or placeholders', () => {
  const md = '`app/pricing/page.tsx` `lib/x.ts`<br>`prototypes/a_2026-11-10` `DECISION_LOG.md` `/pricing` `lib/*.ts` `~/x/y.md` `https://a.b/c.md` `<doc>.md` `vendor_deep_search` `20271308555594_the_final_price_sheet.sql` `0012_papic/0012_papic.md` `apps/web/lib/a.ts`, `lib/b.ts`';
  assert.deepEqual(pointerTokens(md), [
    '0012_papic/0012_papic.md', '20271308555594_the_final_price_sheet.sql', 'DECISION_LOG.md',
    'app/pricing/page.tsx', 'apps/web/lib/a.ts', 'lib/b.ts', 'lib/x.ts', 'prototypes/a_2026-11-10',
  ]);
});

test('markdown links: relative files only, anchors stripped', () => {
  assert.deepEqual(markdownLinks('[a](A.md) [b](plans/x/y.md#top) [c](https://x.y) [d](#here) [e](mailto:a@b)'), ['A.md', 'plans/x/y.md']);
});

test('a typed peso figure is caught; a key or a pack size is not', () => {
  assert.deepEqual(typedPrices('| `EVENT_PLUS` | 1,000 credits |\n| x | ₱2,990 |\n| y | ₱ 99 |'), ['line 2: | x | ₱2,990 |', 'line 3: | y | ₱ 99 |']);
});

/* ── the verdict ──────────────────────────────────────────────────────────*/

const REGISTER = [
  '| Feature | Route | Code |', '|---|---|---|',
  '| Pricing | `/pricing` | `app/(shell)/pricing/page.tsx` |',
  '| Guests | `/dashboard/[eventId]/guests/*` | `lib/guests.ts` |',
  '## 7. PRICES', '| SKU key | What it unlocks (canon name) | Who pays |', '|---|---|---|',
  '| `EVENT_PLUS` | Event Plus | host |', '| `solo_vendor_monthly` · `solo_vendor_annual` | Supplier Plus plan | supplier |',
  '## 9d', '| `NEXT_PUBLIC_CHAT_LIVE_ENABLED` | chat |',
].join('\n');

function verdict(over = {}) {
  return checkRegister({
    register: REGISTER,
    startHere: '[reg](FEATURE_REGISTER.md) `plans/x/`',
    routes: ['/pricing', '/dashboard/[*]/guests', '/dashboard/[*]/guests/import'],
    flags: new Map([['NEXT_PUBLIC_CHAT_LIVE_ENABLED', ['lib/chat-live-flag.ts']]]),
    skus: ['EVENT_PLUS', 'solo_vendor_monthly', 'solo_vendor_annual'],
    pointerOk: () => true,
    ...over,
  });
}

test('a register that names everything passes', () => {
  const r = verdict();
  assert.equal(r.failed, false, formatReport(r));
});

test('SABOTAGE: a new page with no row fails, and is named', () => {
  const r = verdict({ routes: ['/pricing', '/dashboard/[*]/guests', '/new-feature'] });
  assert.equal(r.failed, true);
  assert.deepEqual(r.rows.find((x) => x.check.startsWith('routes')).misses, ['/new-feature']);
  assert.match(formatReport(r), /\/new-feature/);
});

test('SABOTAGE: a new SKU key with no row fails', () => {
  const r = verdict({ skus: ['EVENT_PLUS', 'PAPIC_GUEST_150'] });
  assert.deepEqual(r.rows.find((x) => x.check.startsWith('catalogue')).misses, ['PAPIC_GUEST_150']);
  assert.equal(r.failed, true);
});

test('SABOTAGE: a new NEXT_PUBLIC_* flag with no row fails', () => {
  const r = verdict({ flags: new Map([['NEXT_PUBLIC_CHAT_LIVE_ENABLED', ['a']], ['NEXT_PUBLIC_NEW_THING', ['b']]]) });
  assert.deepEqual(r.rows.find((x) => x.check.startsWith('NEXT_PUBLIC')).misses, ['NEXT_PUBLIC_NEW_THING']);
});

test('SABOTAGE: a row pointing at a deleted file fails', () => {
  const r = verdict({ pointerOk: (t) => t !== 'lib/guests.ts' });
  assert.deepEqual(r.rows.find((x) => x.check.startsWith('register pointers')).misses, ['lib/guests.ts']);
});

test('SABOTAGE: a dead START_HERE link fails', () => {
  const r = verdict({ startHere: '[gone](GONE.md)', linkOk: () => false });
  assert.deepEqual(r.rows.find((x) => x.check.startsWith('START_HERE')).misses, ['GONE.md']);
});

test('SABOTAGE: a typed price fails', () => {
  const r = verdict({ register: REGISTER + '\n| `EVENT_PLUS` | ₱2,990 |' });
  assert.equal(r.rows.find((x) => x.check.startsWith('no price')).misses.length, 1);
  assert.equal(r.failed, true);
});

test('unread SKU keys print SKIPPED, never ok, and do not fake a pass', () => {
  const r = verdict({ skus: null });
  const row = r.rows.find((x) => x.check.startsWith('catalogue'));
  assert.equal(row.misses, null);
  assert.match(formatReport(r), /catalogue SKU keys have a row\s+SKIPPED/);
});

test('SKU key files: newline list with comments, JSON strings, JSON rows', () => {
  assert.deepEqual(readSkuFile('A\n# note\nB # x\n\n'), ['A', 'B']);
  assert.deepEqual(readSkuFile('["A","B"]'), ['A', 'B']);
  assert.deepEqual(readSkuFile('[{"key":"A"},{"service_code":"B"},{"sku_code":"c"}]'), ['A', 'B', 'c']);
});

test('the corpus is found in order, and a miss is null', () => {
  const has = (set) => (p) => set.has(p);
  const want = path.join('/r/../setnayan-specs', 'FEATURE_REGISTER.md');
  assert.equal(findCorpus({ repoRoot: '/r', env: {}, home: '/h', exists: has(new Set([path.resolve(want)])) }), path.resolve('/r/../setnayan-specs'));
  assert.equal(findCorpus({ flag: '/c', repoRoot: '/r', env: {}, home: '/h', exists: has(new Set(['/c/FEATURE_REGISTER.md'])) }), '/c');
  assert.equal(findCorpus({ repoRoot: '/r', env: {}, home: '/h', exists: () => false }), null);
});

/* ── read-only database door ──────────────────────────────────────────────*/

test('only one SELECT gets through', () => {
  assert.doesNotThrow(() => assertSelectOnly('select a from t'));
  assert.doesNotThrow(() => assertSelectOnly("with x as (select 1) select * from x where y = 'update'"), 'a write word inside a string literal is data');
  assert.throws(() => assertSelectOnly('update t set a = 1'));
  assert.throws(() => assertSelectOnly('select 1; delete from t'));
  assert.throws(() => assertSelectOnly('select * from t for update'));
  assert.throws(() => assertSelectOnly('delete from t'));
});

test('the DB URL is never echoed', () => {
  const env = { SUPABASE_DB_URL: 'postgresql://u:secret@h:5432/db' };
  assert.equal(dbUrlVar(env), 'SUPABASE_DB_URL');
  assert.equal(scrub('could not connect to postgresql://u:secret@h:5432/db now', env), 'could not connect to <SUPABASE_DB_URL> now');
  assert.equal(scrub('x postgres://a:b@c/d y', {}), 'x <db-url> y');
});

test('readRows: no URL is a reason, not a crash; psql runs read-only; output is parsed', () => {
  assert.equal(readRows('select 1', { env: {} }).ok, false);
  let seen;
  const spawn = (cmd, args, opts) => { seen = { cmd, args, opts }; return { status: 0, stdout: '\n [{"key":"A"}]\n', stderr: '' }; };
  const r = readRows('select key from t', { env: { DATABASE_URL: 'postgres://x' }, spawn });
  assert.deepEqual(r, { ok: true, rows: [{ key: 'A' }], via: 'DATABASE_URL' });
  const sql = seen.args[seen.args.indexOf('-c') + 1];
  assert.match(sql, /^begin transaction read only;/);
  assert.match(sql, /rollback;$/);
  assert.match(seen.opts.env.PGOPTIONS, /default_transaction_read_only=on/);
  const fail = readRows('select 1', { env: { DATABASE_URL: 'postgres://u:pw@h/d' }, spawn: () => ({ status: 2, stdout: '', stderr: 'FATAL: password failed for postgres://u:pw@h/d' }) });
  assert.equal(fail.ok, false);
  assert.ok(!fail.reason.includes('pw@'), fail.reason);
  const missing = readRows('select 1', { env: { DATABASE_URL: 'postgres://x' }, spawn: () => ({ error: Object.assign(new Error('x'), { code: 'ENOENT' }) }) });
  assert.match(missing.reason, /psql is not installed/);
});

/* ── the price printout ───────────────────────────────────────────────────*/

test('the printout names each key\'s feature from the register and flags keys with no row', () => {
  const idx = pricesIndex(REGISTER);
  assert.equal(idx.get('EVENT_PLUS').feature, 'Event Plus');
  assert.equal(idx.get('solo_vendor_annual').feature, 'Supplier Plus plan');
  const rows = [
    { catalogue: 'platform_retail_catalog_v2', key: 'EVENT_PLUS', title: 'Event Plus', price_php: 100, gift_price_php: 90, included_papic_credits: 5, billing: 'one_time', is_active: true },
    { catalogue: 'vendor_billing_catalog', key: 'mystery_sku', title: 'M', price_php: 7, billing: 'x', is_active: false, retired_on: '2026-11-05' },
  ];
  const md = formatPrices(rows, { index: idx, printedAt: 'T', via: '$X' });
  assert.match(md, /\| `EVENT_PLUS` \| Event Plus \| Event Plus \| ₱100 \| ₱90 \| 5 \| one_time \| yes \| — \|/);
  assert.match(md, /`mystery_sku` \| M \| ⚠ no register row/);
  assert.match(md, /1 key\(s\) have no row/);
  assert.match(md, /Do not copy these numbers/);
});

/* ── the real register, when the corpus is here ──────────────────────────*/

test('the real FEATURE_REGISTER.md names every route, flag and pointer (corpus on disk only)', (t) => {
  const { result, corpus, skuSource } = run({ argv: [], env: process.env, repoRoot: REPO });
  if (!corpus) {
    t.skip('NOT CHECKED: FEATURE_REGISTER.md is not on this machine (private corpus). Run `node scripts/feature-register-check.mjs --corpus <dir>` where it is.');
    return;
  }
  t.diagnostic(`corpus ${corpus} · SKU keys: ${skuSource}`);
  assert.equal(result.failed, false, '\n' + formatReport(result, { maxList: 60 }));
});

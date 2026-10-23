/**
 * Guard: "WHICH SHOP AM I IN" HAS ONE ANSWER — `resolveActiveShop` (lib/active-shop.ts).
 *
 * Owner 2026-10-22: every account switches between all of its shops from the avatar sheet. That is only safe if
 * every server read and write that needs "the shop I am standing in" asks the same resolver. Before this, an owner of
 * shop A who also helps shop B could not be offered the switch: dozens of reads found "my shop" as
 * `vendor_profiles.user_id = auth.uid()` directly, so switching would have shown B while the shop editors, Instagram,
 * manpower, the plan page and the Pro check answered for — and saved to — A.
 *
 * THE PROPERTY, read from the source (comments stripped):
 *   A query on `vendor_profiles`, `vendor_profiles_self` or `vendor_team_members` that filters by the login's own
 *   `user_id` and NOT by a `vendor_profile_id` RESOLVES "MY SHOP(S)" BY IDENTITY. (`vendor_profiles_self` is a view
 *   that already filters to the caller's own shops, so on it ANY read without a `vendor_profile_id` filter resolves.)
 *     1. In a SHOP-SCOPED server file — `app/vendor-dashboard/**`, `app/api/vendor/**` — there are NONE. Those files
 *        take the shop from `fetchOwnVendorProfile` / `resolveActiveShop` / `resolveOwnedActiveShop`.
 *     2. Everywhere else each one is a NAMED ENUMERATION below — a read of EVERY shop the account has (erasure, data
 *        export, support SLA, booked-on-this-event, the role list the sheet draws) or the provisioning of the shop
 *        they OWN (open-shop, a claim). Count per file is exact, so a new resolve in a listed file fails too.
 *     3. A query that ALSO names `vendor_profile_id` is a check on ONE named shop ("do I own this one?") and is fine.
 *   Plus: no `selectVendorProfileBy(…, 'user_id', …)` anywhere (the old owner path of `fetchOwnVendorProfile`), and
 *   no shop-scoped file asks `isVendorProActive` ("is ANY shop this login owns Pro") — it asks `isShopProActive`.
 *
 * The behaviour half — a write after switching lands on the switched shop — runs for real against the replayed
 * schema in `tests/db/an-owner-picks-which-shop.db.test.ts`.
 *
 * Run: `node --import tsx --test lib/the-active-shop-is-resolved-once.test.ts` from apps/web.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pickActiveShop, reachableShops } from '@/lib/active-shop';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/** Shop-scoped server files: every read here is about the shop on screen. */
const SHOP_SCOPED = ['app/vendor-dashboard/', 'app/api/vendor/'];

/**
 * Every read OUTSIDE the shop-scoped files that finds shops by the login's own id — and why it is not "the shop I am
 * standing in". Exact counts. Adding a line here is a decision; say why in the same words a reviewer would accept.
 */
const ENUMERATIONS: Record<string, { count: number; why: string }> = {
  'lib/active-shop.ts': { count: 2, why: 'THE resolver — owned shops + helper seats, the two lists the rule picks from.' },
  'lib/roles.ts': { count: 2, why: 'the role summary: every shop the account owns or helps in (the avatar sheet rows, the switch route allow-list).' },
  'app/help/actions.ts': { count: 2, why: 'support priority: the best-paying of ALL the account\'s shops.' },
  'app/admin/users/[userId]/page.tsx': { count: 1, why: 'HQ\'s view of ANOTHER person: every seat they hold.' },
  'app/open-shop/actions.ts': { count: 1, why: 'provisioning: find-or-create the shop this login OWNS (count-checked against the cap).' },
  'app/open-shop/page.tsx': { count: 1, why: 'the open-shop wizard resumes the shop this login OWNS.' },
  'app/vendor/claim/[token]/finalize/page.tsx': { count: 1, why: 'a claim attaches to (or opens) the shop this login OWNS.' },
  'lib/booked-supplier.ts': { count: 2, why: 'is this account booked on THIS event through ANY of its shops (owner ruling 2026-08-27).' },
  'lib/booking-fee-mint.server.ts': { count: 1, why: 'catch-up sweep over EVERY shop the account owns.' },
  'lib/deposit-acknowledged-effects.server.ts': { count: 1, why: 'catch-up sweep over EVERY shop the account owns.' },
  'lib/chapter-event-participation.ts': { count: 1, why: 'every event any of the account\'s shops was booked on.' },
  'lib/ghosting.ts': { count: 1, why: 'stale inquiries across EVERY shop the account owns.' },
  'lib/enterprise-vendor-gate.ts': { count: 2, why: 'the public API key path (no session, no cookie): any owned Enterprise shop.' },
  'lib/erasure/purge.ts': { count: 5, why: 'account erasure: EVERY shop and seat of the person being erased.' },
  'lib/personal-data-export.ts': { count: 1, why: 'data export: EVERY shop of the person asking.' },
  'lib/self-purchase.ts': { count: 1, why: 'checkout\'s "is this your own shop?" warning: every shop the account sits on.' },
  'lib/vendor-payment-methods.ts': { count: 1, why: 'isVendorProActive: the MARKETPLACE side, called with the shop\'s owner id read from the shop row — not the signed-in supplier\'s pages (those call isShopProActive).' },
};

const TABLE = /\.from\(\s*['"](vendor_profiles_self|vendor_profiles|vendor_team_members)['"]\s*\)/g;
const BY_OWN_ID = /\.eq\(\s*['"]user_id['"]|\.match\(\s*\{[^}]*\buser_id\b/;
const BY_SHOP = /\.(eq|in)\(\s*['"]vendor_profile_id['"]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec|render)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** The text of one query, from its `.from(` to the end of the statement (or the next query). */
function chainAt(src: string, at: number): string {
  const rest = src.slice(at, at + 1200);
  const tail = rest.slice(6).search(/;|\.from\(/);
  return tail < 0 ? rest : rest.slice(0, tail + 6);
}

type Hit = { file: string; table: string; snippet: string };

/** Every query that resolves "my shop(s)" by the login's own id, in source order. */
function shopResolvesByIdentity(rel: string, source: string): Hit[] {
  const src = stripComments(source);
  const hits: Hit[] = [];
  for (const m of src.matchAll(TABLE)) {
    const table = m[1]!;
    const chain = chainAt(src, m.index ?? 0);
    if (BY_SHOP.test(chain)) continue; // a check on one named shop
    const resolves = table === 'vendor_profiles_self' ? true : BY_OWN_ID.test(chain);
    if (resolves) hits.push({ file: rel, table, snippet: chain.replace(/\s+/g, ' ').slice(0, 140) });
  }
  return hits;
}

function scanAll(): Hit[] {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
  return files.flatMap((abs) => {
    const rel = relative(WEB, abs).split(sep).join('/');
    return shopResolvesByIdentity(rel, readFileSync(abs, 'utf8'));
  });
}

const HITS = scanAll();

test('the scan can hit: a query by the login\'s own id is caught, one that names the shop is not', () => {
  const caught = shopResolvesByIdentity(
    'x.ts',
    `await supabase.from('vendor_profiles').select('tier_state').eq('user_id', user.id).maybeSingle();`,
  );
  assert.equal(caught.length, 1, 'the scanner missed the exact shape it exists to catch');
  const view = shopResolvesByIdentity('x.ts', `await s.from('vendor_profiles_self').select('tin_number').maybeSingle();`);
  assert.equal(view.length, 1, 'a read of the self view with no shop id resolves "my shop" too');
  const named = shopResolvesByIdentity(
    'x.ts',
    `await s.from('vendor_profiles').select('vendor_profile_id').eq('vendor_profile_id', id).eq('user_id', uid).maybeSingle();`,
  );
  assert.equal(named.length, 0, 'a check on one named shop was counted as a resolve');
  const commented = shopResolvesByIdentity('x.ts', `// .from('vendor_profiles').eq('user_id', user.id)\nconst a = 1;`);
  assert.equal(commented.length, 0, 'a comment was read as code');
  assert.ok(HITS.length > 0, 'the tree scan found nothing at all — it is reading the wrong folder');
});

test('no shop-scoped server file finds the shop by the login\'s own id — it asks the resolver', () => {
  const bad = HITS.filter((h) => SHOP_SCOPED.some((z) => h.file.startsWith(z)));
  assert.deepEqual(
    bad.map((h) => `${h.file} · ${h.table} · ${h.snippet}`),
    [],
    'a supplier page or action resolves "my shop" by user_id — after a switch it would read or WRITE the wrong shop. ' +
      'Use fetchOwnVendorProfile / resolveActiveShop / resolveOwnedActiveShop (lib/active-shop.ts).',
  );
});

test('everywhere else, every by-identity shop read is a named enumeration — exact count per file', () => {
  const counts = new Map<string, number>();
  for (const h of HITS) {
    if (SHOP_SCOPED.some((z) => h.file.startsWith(z))) continue;
    counts.set(h.file, (counts.get(h.file) ?? 0) + 1);
  }
  const unlisted = [...counts.keys()].filter((f) => !(f in ENUMERATIONS));
  assert.deepEqual(
    unlisted.map((f) => `${f} (${counts.get(f)})`),
    [],
    'a new read finds shops by the login\'s own id. If it means "the shop I am in", use the resolver; if it truly ' +
      'means EVERY shop of the account, add it to ENUMERATIONS with the reason.',
  );
  for (const [file, { count }] of Object.entries(ENUMERATIONS)) {
    assert.equal(counts.get(file) ?? 0, count, `${file}: expected ${count} by-identity shop read(s), found ${counts.get(file) ?? 0}`);
  }
  console.log(`[active-shop] ${HITS.length} by-identity shop reads, all in ${Object.keys(ENUMERATIONS).length} named files`);
});

test('the old owner path is gone, and shop pages ask THIS shop\'s plan, not any shop\'s', () => {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
  for (const abs of files) {
    const rel = relative(WEB, abs).split(sep).join('/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    assert.doesNotMatch(src, /selectVendorProfileBy\(\s*\w+\s*,\s*['"]user_id['"]/, `${rel} loads the shop by its owner's id`);
    if (SHOP_SCOPED.some((z) => rel.startsWith(z))) {
      assert.doesNotMatch(src, /\bisVendorProActive\(/, `${rel} asks whether ANY of the login's shops is Pro — use isShopProActive`);
    }
  }
});

test('the helpers the supplier pages lean on all take the shop from the resolver', () => {
  const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
  const body = (src: string, name: string) => {
    const at = src.indexOf(name);
    assert.ok(at >= 0, `${name} moved`);
    return src.slice(at, at + 2500);
  };
  assert.match(body(read('lib/vendor-profile.ts'), 'export const fetchOwnVendorProfile'), /await resolveActiveShop\(supabase, userId\)/);
  // ⚡ 2026-10-23: the role is read for the resolver's shop AND told the resolver's own proof of ownership (its
  // `vendor_profiles … user_id = <login>` read) — so the founding-owner fallback asks nothing twice. Both halves held.
  assert.match(body(read('lib/vendor-role.ts'), 'export const resolveVendorRole'), /resolveActiveShop\(supabase, userId\)[\s\S]*resolveVendorRoleForProfile\(supabase, userId, active\.vendorProfileId, \{ ownsIt: active\.owned \}\)/);
  assert.match(body(read('lib/vendor-team.ts'), 'export async function fetchAdminVendorContext'), /resolveActiveShopId\(supabase, userId\)[\s\S]*\.eq\('vendor_profile_id', activeShopId\)/);
  assert.match(body(read('lib/vendor-corrections.ts'), 'export async function fetchVerifiedLock'), /vendorProfileId: string/);
});

/* ─── the rule ───────────────────────────────────────────────────────────── */

test('the active shop: chosen when owned or a seat; else the owned shop; else the first seat; a foreign id never', () => {
  assert.deepEqual(pickActiveShop(['A'], ['A', 'B'], 'B'), { vendorProfileId: 'B', owned: false }, 'an owner could not switch into the shop they help');
  assert.deepEqual(pickActiveShop(['A'], ['A', 'B'], 'A'), { vendorProfileId: 'A', owned: true });
  assert.deepEqual(pickActiveShop(['A'], ['A', 'B'], null), { vendorProfileId: 'A', owned: true }, 'no choice must open the shop they own');
  assert.deepEqual(pickActiveShop(['A'], ['B'], 'Z'), { vendorProfileId: 'A', owned: true }, 'a foreign id was opened');
  assert.deepEqual(pickActiveShop([], ['B', 'C'], 'C'), { vendorProfileId: 'C', owned: false });
  assert.deepEqual(pickActiveShop([], ['B', 'C'], 'Z'), { vendorProfileId: 'B', owned: false });
  assert.equal(pickActiveShop([], [], 'B'), null, 'an id with no shop behind it was opened');
  // A seat row for the shop they own still reads as OWNED (the founding owner has an owner seat too).
  assert.deepEqual(pickActiveShop(['A'], ['A'], 'A'), { vendorProfileId: 'A', owned: true });
});

test('the sheet offers every shop — an owner sees the shops they help in too', () => {
  const own = { id: 'A', owned: true };
  const seatB = { id: 'B', owned: false };
  assert.deepEqual(reachableShops([own, seatB]), [own, seatB], 'an owner was not offered the shop they help in');
  assert.deepEqual(reachableShops([seatB]), [seatB]);
  assert.deepEqual(reachableShops([]), []);
});

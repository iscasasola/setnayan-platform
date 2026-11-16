/**
 * shop-view-count.test.ts — 👁 "N couples opened your page" counts COUPLES (walker W1-B15, 16 Nov 2026).
 *
 * The walker's finding: Shop › Analytics counted the shop's own account, signed-out bots/curl and the same device
 * opening the page again. Held as behaviour, on a stand-in client (no mocking framework):
 *   1 · a bot or curl is never recorded; a real browser is;
 *   2 · the shop's owner and its team are never recorded — and a refused seat read does not count them either;
 *   3 · the readers count distinct visitors, never rows; one device with no cookie is one visitor, not one per open;
 *   4 · the live render reads who is looking BEFORE `after()` (Next refuses request reads inside a render's after()).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  countDistinctViewers,
  readCouplesWhoOpened,
  recordShopViewWith,
  shopViewerHash,
  type ShopViewAdmin,
  type ShopViewContext,
} from '@/lib/shop-view-count';

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const SHOP = 'vp-1';
const OWNER = 'u-owner';
const HELPER = 'u-helper';

/** A service-role stand-in: the owner owns SHOP, HELPER holds a seat, every insert is kept. */
function admin(opts: { refuseSeats?: boolean } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const client: ShopViewAdmin = {
    from: (table: string) => {
      if (table === 'vendor_profile_views') return { insert: async (row: Record<string, unknown>) => (inserts.push(row), { error: null }) };
      const filters: Record<string, string> = {};
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (col: string, v: string) => ((filters[col] = v), q);
      q.then = (resolve: (v: unknown) => unknown) => {
        if (opts.refuseSeats) return Promise.resolve({ count: null, error: { message: 'permission denied' } }).then(resolve);
        const hit =
          filters.vendor_profile_id === SHOP &&
          ((table === 'vendor_profiles' && filters.user_id === OWNER) || (table === 'vendor_team_members' && filters.user_id === HELPER));
        return Promise.resolve({ count: hit ? 1 : 0, error: null }).then(resolve);
      };
      return q;
    },
  };
  return { client, inserts };
}

const stranger = (over: Partial<ShopViewContext> = {}): ShopViewContext => ({ userId: null, anonCookie: null, userAgent: PHONE, ip: '203.0.113.7', ...over });

test('1 · a bot or curl is never recorded; a real phone is', async () => {
  for (const ua of ['curl/8.4.0', 'Googlebot/2.1 (+http://www.google.com/bot.html)', 'facebookexternalhit/1.1', '', null]) {
    const { client, inserts } = admin();
    assert.equal(await recordShopViewWith(client, { vendorProfileId: SHOP }, stranger({ userAgent: ua })), false, `${ua} was counted`);
    assert.equal(inserts.length, 0, `${String(ua)} wrote a view`);
  }
  const { client, inserts } = admin();
  assert.equal(await recordShopViewWith(client, { vendorProfileId: SHOP, source: 'profile_direct' }, stranger()), true);
  assert.equal(inserts.length, 1, 'anti-vacuity: a real visitor is no longer counted at all');
  assert.equal(typeof inserts[0]!.viewer_hash, 'string', 'a view with no visitor cannot be deduped');
});

test('2 · the shop’s own account and its team are never recorded; a couple is', async () => {
  for (const who of [OWNER, HELPER]) {
    const { client, inserts } = admin();
    assert.equal(await recordShopViewWith(client, { vendorProfileId: SHOP }, stranger({ userId: who })), false, `${who} counted`);
    assert.equal(inserts.length, 0);
  }
  // A refused seat read must not count the shop's own people as a couple — here an absence must not COUNT.
  const refused = admin({ refuseSeats: true });
  await recordShopViewWith(refused.client, { vendorProfileId: SHOP }, stranger({ userId: OWNER }));
  assert.equal(refused.inserts.length, 0, 'a refused seat read counted the owner');
  const couple = admin();
  assert.equal(await recordShopViewWith(couple.client, { vendorProfileId: SHOP }, stranger({ userId: 'u-couple' })), true);
  assert.equal(couple.inserts.length, 1);
});

test('3 · one device is one couple: distinct visitors, never rows', async () => {
  // The same phone, no cookie, opening twice → the same visitor (it used to be a fresh random id per open).
  assert.equal(shopViewerHash(stranger()), shopViewerHash(stranger()));
  assert.notEqual(shopViewerHash(stranger()), shopViewerHash(stranger({ ip: '198.51.100.2' })), 'two devices merged');
  assert.equal(countDistinctViewers([{ viewer_hash: 'a' }, { viewer_hash: 'a' }, { viewer_hash: 'b' }, { viewer_hash: null }]), 3);

  // The reader pages the window's rows and counts distinct hashes.
  const rows = [...Array(1500)].map((_, n) => ({ view_id: `r${n}`, viewer_hash: `h${n % 3}` }));
  const client = {
    from: () => ({
      select: () => {
        let lo = 0;
        let hi = 0;
        const q: Record<string, unknown> = {};
        q.eq = () => q;
        q.gte = () => q;
        q.order = () => q;
        q.range = (a: number, b: number) => ((lo = a), (hi = b), q);
        q.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows.slice(lo, hi + 1), error: null }).then(resolve);
        return q;
      },
    }),
  };
  assert.deepEqual(await readCouplesWhoOpened(client, SHOP, '2026-01-01'), { count: 3, error: null }, '1,500 opens by 3 devices is 3 couples');
  const refused = {
    from: () => ({
      select: () => {
        const q: Record<string, unknown> = {};
        for (const k of ['eq', 'gte', 'order', 'range']) q[k] = () => q;
        q.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'nope' } }).then(resolve);
        return q;
      },
    }),
  };
  assert.equal((await readCouplesWhoOpened(refused, SHOP, '2026-01-01')).count, null, 'a refused read became a number');
});

test('4 · every "opened your page" reader counts couples; the live render reads who is looking before after()', () => {
  const src = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));
  for (const p of ['lib/vendor-funnel.ts', 'app/vendor-dashboard/website/page-data.ts', 'lib/supplier-today.server.ts']) {
    assert.match(src(p), /readCouplesWhoOpened\(/, `${p} no longer counts distinct couples`);
    assert.doesNotMatch(
      src(p),
      /from\('vendor_profile_views'\)\s*\.select\('view_id', \{ count: 'exact', head: true \}\)/,
      `${p} counts view ROWS again — every reload and every curl is a couple`,
    );
  }
  const page = src('app/v/[slug]/page.tsx');
  assert.match(page, /const viewCtx = await readShopViewContext\(\);\s*after\(\(\) =>\s*recordShopViewWith\(/);
  assert.doesNotMatch(page, /after\(\(\) =>\s*recordVendorProfileView\(/, 'the render reads the request inside after() again');
  assert.match(src('lib/record-vendor-view.ts'), /recordShopViewWith\(createAdminClient\(\), input, await readShopViewContext\(\{ mint: true \}\)\)/);
});

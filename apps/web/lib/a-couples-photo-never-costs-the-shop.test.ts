/**
 * a-couples-photo-never-costs-the-shop.test.ts — 📸💸 NO CASH PATH, AND THE PAGE-PHOTO ROOM IS NOT CONSUMED (owner
 * 2026-10-30, DECISION_LOG "A CUSTOMER'S PHOTO SHARED TO A SUPPLIER'S INSPIRATION … NEVER CASH").
 *
 *   1 · NO CASH. The shares table carries no money column; no share door calls a wallet / payment door; the share and
 *       answer actions import nothing that moves money. The thank-you is the credit line (and the SHOP'S own Gift).
 *   2 · THE ROOM (🔓 OPEN owner question) — as built an approved couple photo does NOT use the shop's paid page-photo
 *       room: `COUPLE_PHOTOS_USE_PAGE_ROOM` is false, and neither room function (`file_supplier_page_notice`,
 *       `shop_portfolio_commit`) — in any migration — reads `couple_photo_shares`. If the owner rules "yes", this file
 *       changes WITH that ruling; it is not to be loosened to make an unrelated PR green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { COUPLE_PHOTOS_USE_PAGE_ROOM } from './couple-photo-share';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const noSqlComments = (s: string) =>
  s
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .map((l) => l.replace(/\s--.*$/, ''))
    .join('\n');
const MIG = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'));
const SHARE_SQL = noSqlComments(readFileSync(join(MIGRATIONS, MIG.find((f) => f.endsWith('_a_couples_photo_on_a_suppliers_card.sql'))!), 'utf8'));

const MONEY = /\b(shop_papic_wallet_spend|shop_papic_wallet_entries|orders|order_id|payout|commission|price|centavos|_php\b|credits?_spent)/i;

test('1 · the shares table and its doors carry no money', () => {
  const table = SHARE_SQL.slice(SHARE_SQL.indexOf('CREATE TABLE IF NOT EXISTS public.couple_photo_shares'), SHARE_SQL.indexOf('COMMENT ON TABLE public.couple_photo_shares'));
  assert.ok(table.length > 200, 'the table definition could not be read');
  assert.doesNotMatch(table, MONEY, 'a money column joined couple_photo_shares');
  assert.doesNotMatch(SHARE_SQL, MONEY, 'a share door reaches a wallet, an order or a price');
  for (const f of ['app/_actions/couple-photo-share-actions.ts', 'lib/couple-photo-share.ts']) {
    const src = read(f);
    assert.doesNotMatch(src, /wallet|payout|commission|from '@\/lib\/(payments?|orders?|paymongo|checkout)[^']*'|\.rpc\('shop_papic_wallet/i, `${f} reaches a money path`);
  }
});

test('2 · 🔓 OPEN — an approved couple photo does not use the page-photo room (as built)', () => {
  assert.equal(COUPLE_PHOTOS_USE_PAGE_ROOM, false, 'the room question was answered in code without an owner ruling');
  const roomFns = ['file_supplier_page_notice', 'shop_portfolio_commit'];
  let seen = 0;
  for (const f of MIG) {
    const s = noSqlComments(readFileSync(join(MIGRATIONS, f), 'utf8'));
    for (const name of roomFns) {
      const head = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\(`, 'g');
      for (const m of s.matchAll(head)) {
        /* The body is dollar-quoted with ANY tag ($$, $function$, $fn$ …) — read the tag, then its closing twin. */
        const tag = /AS\s+(\$\w*\$)/.exec(s.slice(m.index!));
        assert.ok(tag, `${name} (${f}) has a body this check cannot read`);
        const open = m.index! + tag.index + tag[0].length;
        const close = s.indexOf(tag[1], open);
        assert.ok(close > open, `${name} (${f}) has a body this check cannot read`);
        seen += 1;
        assert.doesNotMatch(s.slice(open, close), /couple_photo_shares/, `${name} (${f}) counts couple photos toward the room`);
      }
    }
  }
  assert.ok(seen >= 2, 'the room functions could not be found — the check would pass on nothing');
});

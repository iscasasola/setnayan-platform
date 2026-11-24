/**
 * shop-portfolio-credits.test.ts — the portfolio has NO count and NO price (owner 2026-11-23: *"Yes, drop it"* — the
 * every-plan free 50, the personal invite's 100 and "then 1 Papic credit a photo" are gone; storage is the only limit).
 * Pinned here:
 *   1 · the uploader's words: "12 photos" · "No limit" · "Save 3" · "Portfolio saved. 3 added." — never a credit;
 *   2 · the LATEST SQL definitions of both portfolio writers charge nothing (no wallet row, no free room);
 *   3 · BOTH portfolio writers still go through their one-step function — no bare `portfolio_r2_keys` write;
 *   4 · the form draws no wallet, no free room and no count limit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { PORTFOLIO_RULE, portfolioAdded, portfolioCounter, portfolioSaveLabel, portfolioSavedText } from './shop-portfolio-credits';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const r = (k: string) => `r2://setnayan-media/vendors/v/portfolio/${k}.jpg`;
const many = (p: string, n: number) => Array.from({ length: n }, (_, i) => r(`${p}${i}`));

test('1 · the words: a count, "No limit", and never a credit', () => {
  assert.deepEqual(portfolioCounter(48), { left: '48 photos', right: 'No limit' });
  assert.deepEqual(portfolioCounter(1), { left: '1 photo', right: 'No limit' });
  assert.equal(portfolioAdded(many('a', 80), [...many('a', 80), r('n'), r('n'), '']), 1, 'a repeat or a blank was counted');
  assert.equal(portfolioAdded(many('a', 80), many('a', 60)), 0, 'a removal counted as an addition');
  assert.equal(portfolioSaveLabel(3), 'Save 3');
  assert.equal(portfolioSaveLabel(0), 'Save');
  assert.equal(portfolioSavedText(3), 'Portfolio saved. 3 added.');
  assert.doesNotMatch(`${PORTFOLIO_RULE} ${portfolioSaveLabel(500)} ${portfolioSavedText(500)}`, /credit|wallet|\bfree\b/i);
});

/** The body of the LATEST migration that (re)defines `fn` — the one prod runs. */
function latestBody(fn: string): string {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  let body = '';
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8').replace(/--.*$/gm, '');
    const at = sql.indexOf(`FUNCTION public.${fn}(`);
    if (at < 0 || !/CREATE OR REPLACE/.test(sql.slice(Math.max(0, at - 40), at))) continue;
    const ends = [sql.indexOf('$$;', at), sql.indexOf('$function$;', at)].filter((i) => i > 0);
    const end = Math.min(...ends);
    body = sql.slice(at, end);
  }
  return body;
}

test('2 · the latest SQL of both portfolio writers charges nothing', () => {
  for (const fn of ['shop_portfolio_commit', 'file_supplier_page_notice']) {
    const body = latestBody(fn);
    assert.ok(body.length > 300, `${fn}: no definition found — re-point this guard`);
    assert.doesNotMatch(body, /shop_papic_wallet_entries|shop_papic_wallet_spend|v_charge|v_free|portfolio_photo_allowance/, `${fn} prices the portfolio again`);
    assert.match(body, /auth\.uid\(\)/, `${fn} lost its owner check`);
  }
});

test('3 · 🚨 both portfolio writers go through their one-step function — never a bare column write', () => {
  const a = src('app/vendor-dashboard/actions.ts');
  const portfolioCase = a.slice(a.indexOf("case 'portfolio':"), a.indexOf("case 'gallery_videos':"));
  assert.ok(portfolioCase.length > 100, 'the portfolio case of updateVendorProfileField moved — re-point this guard');
  assert.match(portfolioCase, /\.rpc\('shop_portfolio_commit'/, 'the gallery save no longer goes through the commit');
  assert.doesNotMatch(portfolioCase, /patch = \{ portfolio_r2_keys/, 'the gallery save writes the column past the commit');
  const c = src('app/vendor-dashboard/collections/actions.ts');
  assert.match(c, /\.rpc\('file_supplier_page_notice'/, '"Put on my page" no longer files a notice');
  assert.doesNotMatch(c, /\.update\(\{ portfolio_r2_keys|portfolio_r2_keys:/, '"Put on my page" writes the column directly');
  assert.doesNotMatch(c, /r2Copy\(/, '"Put on my page" copies the photo before the guests were told');
});

test('4 · the form draws no wallet, no free room and no count limit', () => {
  const form = src('app/vendor-dashboard/shop/_components/portfolio-form.tsx');
  assert.match(src('app/vendor-dashboard/shop/_components/gallery-media.tsx'), /import \{ PortfolioForm \} from '\.\/portfolio-form';/, 'Portfolio no longer draws the one PortfolioForm');
  const body = form.slice(form.indexOf('function PortfolioForm('));
  assert.ok(body.length > 200, 'PortfolioForm moved — re-point this guard');
  assert.doesNotMatch(body, /SHOP_WALLET_HREF|data-portfolio-wallet|walletBalance ==|portfolioMaxFiles/, 'the form prices photos again');
  assert.match(body, /maxFiles=\{Infinity\}/, 'the uploader is sized by a count again');
  assert.match(body, /\{PORTFOLIO_RULE\}/, 'the ⓘ no longer says the rule');
});

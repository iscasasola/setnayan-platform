/**
 * shop-portfolio-credits.test.ts — the portfolio's price, said once in SQL and once in TS, and the two kept equal.
 *
 * Owner 2026-10-23 (option A): 50 free credits per shop, then 1 credit a photo (a clip 8) from the SHOP wallet.
 * The save is charged by `shop_portfolio_commit`; the uploader only QUOTES it. Pinned here:
 *   1 · the quote's formula, case by case (the db test runs the same cases against the SQL);
 *   2 · the SQL holds the same base (50), the same clip rule and the same weights as this file;
 *   3 · BOTH portfolio writers go through the commit — no bare `portfolio_r2_keys` write is left in either;
 *   4 · an UNREAD wallet pays for nothing: the button is blocked with its reason, the uploader holds only the free
 *       room, and the form renders the "couldn't be read" sentence instead of a number.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { PAPIC_POINTS_PER_PHOTO, PAPIC_POINTS_PER_SNIPPET } from './papic-cameras-pure';
import { PORTFOLIO_FREE_BASE } from './vendor-tier-caps';
import {
  PORTFOLIO_FREE_CREDITS,
  portfolioCounter,
  portfolioMaxFiles,
  portfolioQuote,
  portfolioRefCredits,
  portfolioSaveLabel,
  portfolioSavedText,
} from './shop-portfolio-credits';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const r = (k: string) => `r2://setnayan-media/vendors/v/portfolio/${k}.jpg`;
const many = (p: string, n: number) => Array.from({ length: n }, (_, i) => r(`${p}${i}`));

test('1 · the quote: free room first, then one credit per NEW photo; removals free spots, never credits', () => {
  assert.equal(PORTFOLIO_FREE_CREDITS, PORTFOLIO_FREE_BASE, 'the free credits drifted from the every-plan base');
  assert.equal(portfolioQuote([], many('a', 10), 50).charge, 0);
  assert.equal(portfolioQuote([], many('a', 53), 50).charge, 3);
  const full = many('a', 50);
  assert.equal(portfolioQuote(full, [...full].reverse(), 50).charge, 0, 'a reorder is charged');
  assert.equal(portfolioQuote(full, [...full, ...many('b', 3)], 50).charge, 3);
  assert.equal(portfolioQuote(full, [...full, ...many('b', 3)], 50).added, 3);
  // 53 on the page, 5 off (48 kept) + 5 new → 2 free spots reopen, 3 paid.
  const over = [...full, ...many('b', 3)];
  assert.equal(portfolioQuote(over, [...over.slice(0, 48), ...many('d', 5)], 50).charge, 3);
  // Grandfathered 80: removals free, one more costs one.
  const eighty = many('g', 80);
  assert.equal(portfolioQuote(eighty, eighty.slice(0, 60), 50).charge, 0);
  assert.equal(portfolioQuote(eighty, [...eighty, r('h')], 50).charge, 1);
  // A personal invite's 100 is the room.
  assert.equal(portfolioQuote([], many('p', 60), 100).charge, 0);
  // Duplicates in the list count once (the SQL de-duplicates too).
  assert.equal(portfolioQuote([], [...many('a', 50), r('a0')], 50).charge, 0);
  // A clip is 8, and uses 8 of the free room.
  assert.equal(portfolioRefCredits('x/y.MP4'), PAPIC_POINTS_PER_SNIPPET);
  assert.equal(portfolioRefCredits('x/y.webp'), PAPIC_POINTS_PER_PHOTO);
  assert.equal(portfolioQuote([], [...many('q', 46), 'x/clip.mov'], 50).charge, 4);
});

test('2 · the SQL charges with the same base, the same clip rule and the same weights', () => {
  const file = readdirSync(MIGRATIONS).filter((f) => f.endsWith('_the_portfolio_saves_and_spends_in_one_step.sql'));
  assert.equal(file.length, 1, 'the portfolio commit migration is gone or doubled — re-point this guard');
  const sql = readFileSync(join(MIGRATIONS, file[0]!), 'utf8');
  const base = /v_base\s+CONSTANT INTEGER := (\d+);/.exec(sql);
  assert.ok(base, 'the free base is no longer a constant inside the function — a parameter would be a price a caller sets');
  assert.equal(Number(base[1]), PORTFOLIO_FREE_CREDITS, 'the SQL free base and PORTFOLIO_FREE_CREDITS disagree');
  assert.doesNotMatch(sql, /p_free|p_base/i, 'the free room became an argument');
  assert.match(sql, /GREATEST\(v_base, COALESCE\(v_allow, 0\)\)/, 'the personal-invite allowance no longer lifts the free room');
  const rule = /p_ref ~\* '([^']+)' THEN (\d+) ELSE (\d+) END/.exec(sql);
  assert.ok(rule, 'shop_portfolio_ref_credits changed shape — re-point this guard');
  assert.equal(Number(rule[2]), PAPIC_POINTS_PER_SNIPPET, 'a clip costs a different number in SQL');
  assert.equal(Number(rule[3]), PAPIC_POINTS_PER_PHOTO, 'a photo costs a different number in SQL');
  for (const ext of ['mp4', 'mov', 'm4v', 'webm']) {
    assert.ok(rule[1]!.includes(ext), `the SQL clip rule forgot .${ext}`);
    assert.equal(portfolioRefCredits(`a.${ext}`), PAPIC_POINTS_PER_SNIPPET, `the TS clip rule forgot .${ext}`);
  }
  assert.match(sql, /v_charge := GREATEST\(0, v_after - GREATEST\(v_free, v_kept\)\);/, 'the SQL formula changed');
  assert.match(sql, /pg_advisory_xact_lock\(\s*hashtextextended\('shop_papic_wallet:'/, 'the commit no longer takes the wallet lock');
});

test('3 · 🚨 both portfolio writers go through shop_portfolio_commit — never a bare column write', () => {
  const a = src('app/vendor-dashboard/actions.ts');
  const portfolioCase = a.slice(a.indexOf("case 'portfolio':"), a.indexOf("case 'gallery_videos':"));
  assert.ok(portfolioCase.length > 100, 'the portfolio case of updateVendorProfileField moved — re-point this guard');
  assert.match(portfolioCase, /\.rpc\('shop_portfolio_commit'/, 'the gallery save no longer charges the wallet');
  assert.doesNotMatch(portfolioCase, /patch = \{ portfolio_r2_keys/, 'the gallery save writes the column past the wallet');
  assert.match(portfolioCase, /status === 'insufficient'/, 'a short wallet is not refused out loud');
  // "Put on my page" (2026-10-28, the 7-day guest notice): the tap is priced by `file_supplier_page_notice` — the same
  // free room and the wallet's one spend door, waiting photos counted — and NEVER writes the column; the photo
  // reaches the list only through `publish_supplier_page_photo` after the guests' 7 days (already paid).
  const c = src('app/vendor-dashboard/collections/actions.ts');
  assert.match(c, /\.rpc\('file_supplier_page_notice'/, '"Put on my page" no longer charges the wallet');
  assert.doesNotMatch(c, /\.update\(\{ portfolio_r2_keys|portfolio_r2_keys:/, '"Put on my page" writes the column past the wallet');
  assert.doesNotMatch(c, /r2Copy\(/, '"Put on my page" copies the photo before the guests were told');
});

test('4 · an unread wallet pays for nothing — and says so instead of a number', () => {
  const q = portfolioQuote(many('a', 50), [...many('a', 50), r('n')], 50);
  const blocked = portfolioSaveLabel(q, null);
  assert.equal(blocked.blocked, true, 'an unread wallet let a paid save through');
  assert.doesNotMatch(blocked.label, /\d/, 'an unread wallet printed a number');
  assert.equal(portfolioMaxFiles(48, 50, null), 50, 'an unread wallet widened the uploader past the free room');
  assert.equal(portfolioMaxFiles(80, 50, null), 80, 'a grandfathered shop lost photos from the uploader');
  assert.equal(portfolioMaxFiles(48, 50, 128), 178);
  const short = portfolioSaveLabel(q, 0);
  assert.equal(short.blocked, true, 'an empty wallet let a paid save through');
  assert.equal(portfolioSaveLabel(q, 128).label, 'Save 1 · 1 credit · wallet 128 → 127');
  assert.equal(portfolioSaveLabel(portfolioQuote([], many('a', 3), 50), null).blocked, false, 'free photos were blocked by an unread wallet');
  assert.equal(portfolioCounter(portfolioQuote([], many('a', 48), 50), 50).left, '48 of 50 free');
  assert.equal(portfolioCounter(portfolioQuote([], many('a', 50), 50), 50).right, 'Next photo · 1 credit');
  assert.equal(portfolioSavedText(3, 3, 125), 'Portfolio saved. 3 added · 3 credits · shop wallet 128 → 125.');

  const form = src('app/vendor-dashboard/shop/_components/gallery-media.tsx');
  const body = form.slice(form.indexOf('function PortfolioForm('), form.indexOf('function GalleryForm('));
  assert.ok(body.length > 200, 'PortfolioForm moved — re-point this guard');
  assert.match(body, /walletBalance == null \?/, 'the form no longer branches on an unread wallet');
  assert.match(body, /data-portfolio-wallet="unread"/, 'the unread wallet has no sentence of its own');
  assert.match(body, /maxFiles=\{portfolioMaxFiles\(storedRefs\.length, free, walletBalance\)\}/, 'the uploader is sized by something else');
  assert.match(body, /href=\{SHOP_WALLET_HREF\}/, 'the wallet is not a door to its one home');
});

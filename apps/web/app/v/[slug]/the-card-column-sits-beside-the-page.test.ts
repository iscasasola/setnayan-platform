/**
 * Supplier website by plan (owner-approved 2026-10-30) — slice 4: on a tablet and up, EVERY plan's shop card is a
 * sticky column beside the page, and the page uses the whole screen (owner 2026-10-29 "always maximize the screen").
 * It replaces the Pro-only sticky Inquire rail, so the action row is never hidden on a computer any more.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
import {
  SHOP_ARTICLE_WIDTH,
  SHOP_CARD_COLUMN_CLASS,
  SHOP_COLUMNS_CLASS,
} from './_components/shop-columns';

// v16 S6 (owner 15 Nov, DECISION_LOG "AN UNVERIFIED SHOP HAS THE SAME WEBSITE AS A VERIFIED ONE", superseding the
// 13 Nov "two looks"): the two columns are EVERY shop's — never a plan gate, never a verification gate.
test('the two columns are drawn for every shop — never a plan gate, never a verification gate', () => {
  const at = PAGE.indexOf('data-shop-columns=""');
  assert.ok(at > 0, 'the column grid is gone');
  const tag = PAGE.slice(at, PAGE.indexOf('>', at));
  assert.match(tag, /className=\{SHOP_COLUMNS_CLASS\}/);
  assert.doesNotMatch(PAGE, /SHOP_CALM_COLUMN_CLASS|cinematicHero/, 'the unverified page went back to the calm column');
  // v16 S4 (owner-approved 15 Nov 2026): the card is the side card on the RIGHT — 300 px on a tablet, 360 on a computer.
  assert.match(SHOP_COLUMNS_CLASS, /md:grid md:grid-cols-\[minmax\(0,1fr\)_300px\]/);
  assert.match(SHOP_COLUMNS_CLASS, /lg:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.doesNotMatch(tag, /premiumLayout/, 'the columns went back behind the Pro plan');
});

test('the card column is sticky and holds the identity section; the page body sits beside it', () => {
  const card = PAGE.indexOf('data-shop-card-column=""');
  const body = PAGE.indexOf('data-shop-body-column=""');
  assert.ok(card > 0 && body > card);
  assert.match(PAGE.slice(card, card + 200), /className=\{`\$\{SHOP_CARD_COLUMN_CLASS\} \$\{SHOP_CALLING_CARD_CLASS\}/);
  assert.match(SHOP_CARD_COLUMN_CLASS, /md:sticky/);
  assert.ok(PAGE.slice(card, body).includes('<ShareButton'), 'the action row left the card column');
});

test('every plan maximizes the width, and the action row is never hidden on a computer', () => {
  assert.doesNotMatch(PAGE, /'max-w-3xl'/, 'a plan went back to the narrow reading width');
  assert.equal(SHOP_ARTICLE_WIDTH, 'max-w-screen-2xl');
  assert.match(PAGE, /mx-auto w-full px-4[\s\S]{0,400}SHOP_ARTICLE_WIDTH/);
  assert.doesNotMatch(PAGE, /premiumLayout \? 'lg:hidden'/, 'the action row hides on desktop again');
  assert.doesNotMatch(PAGE, /<aside className="hidden lg:block">/, 'a second desktop rail came back beside the card');
});

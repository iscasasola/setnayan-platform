/**
 * the-supplier-sheet-order.test.ts — 🪪 THE SUPPLIER SHEET'S ORDER (THE ONE BUILD S3 / guard G10, 8 Nov 2026).
 *
 * Owner rulings (DECISION_LOG 2026-11-07, "Account sheet tiles" + supplier round 2; prototype v113/v114):
 *   - the tiles are Help · Show me around · Sign out on EVERY sheet (no Your Story / Refer a couple tile — "NO NEED");
 *   - on the supplier sheet the shop you are in is not listed under "Switch to" — it heads a "You are in" card that
 *     holds the shop, View page and its rows (Your details · Your page · Helpers · Plan · Settings);
 *   - OWNER RULING 8 Nov 2026 (S3): *"this menu pop up from the upper right already has a design and i like the
 *     design. only the content is what you change."* So Sign out stays the shipped red tile (one POST) and the quiet
 *     "Sign out of all accounts" line stays on EVERY sheet, the supplier's included — the spec's "Sign out of…" choice
 *     card is NOT drawn;
 *   - the couple's Help tile names the event when its Refer programme is on (`/help?refer=<event>`) — Refer a couple's
 *     door lives inside Help now.
 *
 * It RENDERS the shipped `SwitcherPanelBody` (with the shop rows the vendor layout passes) and reads the marks in the
 * order they are drawn — a source-order check could not see a section moved by a conditional.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): the shop you are in no longer skipped in "Switch to" (red: test 2,
 * drawn twice); the `!supplierSheet` condition dropped from the quiet "Sign out of all accounts" line (red: test 4).
 * 🔁 Test 4 UPDATED ON PURPOSE (owner ruling above), NOT WEAKENED: it now pins the shipped sign-out on both sheets, and
 * re-sabotaged 2026-11-08 — `!supplierSheet` put back on the quiet line → red ("the supplier sheet lost …").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { createElement } from 'react';
import { stripComments } from '@/lib/strip-comments';

/* `"jsx": "preserve"` compiles to the classic runtime (a bare `React.createElement`); the sheet's Appearance row
   imports a server action whose module says `server-only` — stubbed, as in `every-plus-one-is-named.test.ts`. */
(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..', '..', '..');
const SHOP = { id: 'S89V-LAB0000001', name: 'SetnaProd', logoUrl: null, publicHref: '/v/setnaprod', owned: true };
const CLAIRE = { uid: '22222222-2222-4222-8222-222222222222', email: 'claire@example.com', name: 'Claire' };

function person(otherAccounts: (typeof CLAIRE)[]) {
  return {
    userId: 'lab-user',
    displayName: 'Ice Casasola',
    email: 'ice@example.com',
    isAnonymous: false,
    photoUrl: null,
    events: [],
    eventsMeasured: true,
    context: { hasVendor: true, vendorName: SHOP.name, isAdmin: false, canOpenShop: false, shops: [SHOP] },
    otherAccounts,
    canAddAccount: true,
  };
}

async function sheet(here: 'shop' | 'events', others = [CLAIRE], referHref: string | null = null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ThemeProvider } = await import('@/app/_components/theme-provider');
  const { SwitcherPanelBody } = await import('./account-switcher');
  const { supplierAvatarRows } = await import('@/app/vendor-dashboard/_components/supplier-avatar-rows');
  return renderToStaticMarkup(
    createElement(
      ThemeProvider,
      null,
      createElement(SwitcherPanelBody, {
        data: person(others) as never,
        close: () => {},
        here,
        activeShopId: SHOP.id,
        shopRows: here === 'shop' ? supplierAvatarRows() : null,
        referHref,
      }),
    ),
  );
}

/** The sheet's marks, in drawn order, folded to the names the order rule uses. */
function marks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/data-(sheet-[a-z-]+|switcher-shop-row|setting-appearance)(?:="([^"]*)")?/g)) {
    const [, name, value] = m;
    if (name === 'sheet-cover') out.push('cover');
    else if (name === 'sheet-switch') out.push('switch');
    else if (name === 'sheet-you-are-in') out.push('you-are-in');
    else if (name === 'switcher-shop-row') out.push(`row:${value}`);
    else if (name === 'sheet-row') out.push(`row:${value}`);
    else if (name === 'setting-appearance') out.push('row:appearance');
    else if (name === 'sheet-tiles') out.push('tiles');
    else if (name === 'sheet-tile') out.push(`tile:${value}`);
    else if (name === 'sheet-sign-out-all') out.push('sign-out-all-line');
  }
  return out;
}

const before = (list: string[], a: string, b: string) => {
  const i = list.indexOf(a);
  const j = list.indexOf(b);
  assert.ok(i >= 0, `${a} is not drawn — ${list.join(' → ')}`);
  assert.ok(j >= 0, `${b} is not drawn — ${list.join(' → ')}`);
  assert.ok(i < j, `${a} must come before ${b} — drawn: ${list.join(' → ')}`);
};

test('the supplier sheet reads cover → switch → you are in → the shop rows → billing/appearance → tiles', async () => {
  const m = marks(await sheet('shop'));
  before(m, 'cover', 'switch');
  before(m, 'switch', 'you-are-in');
  for (const row of ['details', 'helpers', 'plan', 'settings']) before(m, 'you-are-in', `row:${row}`);
  before(m, 'row:details', 'row:helpers');
  before(m, 'row:helpers', 'row:plan');
  before(m, 'row:plan', 'row:settings');
  before(m, 'row:settings', 'row:billing');
  before(m, 'row:billing', 'row:appearance');
  before(m, 'row:appearance', 'tiles');
  before(m, 'tiles', 'tile:help');
  assert.equal(m.filter((x) => x === 'you-are-in').length, 1, 'one "You are in" card');
});

test('the shop you are in is not listed under Switch to — it heads the You are in card', async () => {
  const html = await sheet('shop');
  const youAreIn = html.indexOf('data-sheet-you-are-in');
  const shopRows = [...html.matchAll(/data-sheet-shop="S89V-LAB0000001"/g)].map((x) => x.index!);
  assert.equal(shopRows.length, 1, `the shop you are in is drawn ${shopRows.length} times`);
  assert.ok(shopRows[0]! > youAreIn, 'the shop you are in sits under Switch to, not in the You are in card');
});

test('tiles are Help · Show me around · Sign out — on the supplier sheet AND the couple sheet', async () => {
  for (const here of ['shop', 'events'] as const) {
    const html = await sheet(here);
    const tiles = html.slice(html.indexOf('data-sheet-tiles'));
    const words = [...tiles.matchAll(/<\/span>(Help|Show me around|Sign out|Your Story|Refer a couple)<\/(?:a|button)>/g)].map((x) => x[1]);
    assert.deepEqual(words, ['Help', 'Show me around', 'Sign out'], `${here} sheet tiles: ${words.join(' · ')}`);
  }
});

test('Sign out is the shipped tile + quiet "Sign out of all accounts" line on BOTH sheets (owner ruling 8 Nov)', async () => {
  for (const here of ['shop', 'events'] as const) {
    for (const others of [[CLAIRE], []]) {
      const html = await sheet(here, others);
      assert.doesNotMatch(html, /data-sheet-sign-out-(?:ask|choice)|data-sheet-sign-out="/, `${here}: a "Sign out of…" choice is drawn — the owner kept the shipped sheet`);
      assert.match(html, /<form [^>]*action="\/auth\/sign-out" method="post"/, `${here}: Sign out is not the straight POST`);
      assert.match(html, /data-sheet-sign-out-all=""/, `${here}: the supplier sheet lost the quiet "Sign out of all accounts" line`);
    }
  }
});

test('Refer a couple is reached inside Help: the couple Help tile names the event; bad input falls back', async () => {
  const on = await sheet('events', [CLAIRE], '/dashboard/S89E-ABCDEFGHJK/refer');
  assert.match(on, /data-sheet-tile="help"[^>]* href="\/help\?refer=S89E-ABCDEFGHJK"/);
  assert.doesNotMatch(on, /Refer a couple/, 'the Refer a couple tile is back ("NO NEED")');
  const odd = await sheet('events', [CLAIRE], 'https://evil.example/dashboard/x/refer');
  assert.match(odd, /data-sheet-tile="help"[^>]* href="\/help"/);
  const supplier = await sheet('shop', [CLAIRE], '/dashboard/S89E-ABCDEFGHJK/refer');
  assert.match(supplier, /data-sheet-tile="help"[^>]* href="\/vendor-dashboard\/help"/);
  const help = stripComments(readFileSync(join(WEB, 'app/(shell)/help/page.tsx'), 'utf8'));
  assert.match(help, /referEvent && \(await isReferralProgramEnabled\(\)[\s\S]*?href=\{`\/dashboard\/\$\{referEvent\}\/refer`\}[\s\S]*?Refer a couple/, 'the help centre does not draw the Refer a couple door');
});

test('the couple sheet is unchanged: no You are in card, the quiet "Sign out of all accounts" line still drawn', async () => {
  const html = await sheet('events');
  assert.doesNotMatch(html, /data-sheet-you-are-in/);
  assert.match(html, /data-sheet-sign-out-all=""/);
  assert.match(html, /data-sheet-tile="help"[^>]* href="\/help"/, 'the couple’s Help tile opens the help centre');
  const supplier = await sheet('shop');
  assert.match(supplier, /data-sheet-tile="help"[^>]* href="\/vendor-dashboard\/help"/, 'the supplier’s Help tile opens supplier help');
});

/**
 * 🚪 FROM 701px EVERY SHOP DOOR OPENS AS THE 440px RIGHT PANEL (owner 2026-11-16, DECISION_LOG "FROM 701px THE SHOP
 * DOORS OPEN AS THE 440px RIGHT PANEL"; W1 tablet/desktop walk RW-352 — Shop → Share filled the whole screen at 768
 * and 1280 while every other supplier sheet is the right panel).
 *
 * Held here:
 *   1 · THE LINE — the door decides at the supplier dashboard's 701 (`BREAKPOINTS.tab`), never a hand-typed number.
 *   2 · THE PANEL — from that line a door is the shared `Sheet` (its own backdrop dims the Shop page behind it), in the
 *       `tab` boundary's 440px drawer (the supplier dashboard mounts `boundary="tab"`), headed by the door's title and
 *       carrying its action and its thumb button.
 *   3 · EVERY DOOR — Share · Logo · Promote · QR · Cover · View shop · each Badge · each Analytics tile opens through
 *       `ShopDoorScreen`, so none can stay full screen on a laptop.
 * The phone half (below 701 the door IS `RiseScreen`, unchanged) is held by
 * `app/_components/rise/the-rise-screen-is-one-full-screen.test.ts` § 5.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { BREAKPOINTS } from '@/lib/use-responsive';
import { ShellBoundaryProvider } from '@/app/_components/shell-boundary';
import { SHOP_DOOR_PANEL_QUERY, ShopDoorPanel } from '@/app/vendor-dashboard/_components/shop-door-screen';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const fn = (src: string, name: string) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));

test('1 · the door switches at the supplier dashboard’s own 701 line', () => {
  assert.equal(BREAKPOINTS.tab, 701);
  assert.equal(SHOP_DOOR_PANEL_QUERY, '(min-width: 701px)');
  const door = code('app/vendor-dashboard/_components/shop-door-screen.tsx');
  assert.match(door, /return <ShopDoorPanel \{\.\.\.props\} \/>;/, 'from 701 a door does not become the panel');
});

test('2 · from 701 a door is the 440px right panel over a dimmed Shop page', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      ShellBoundaryProvider,
      { value: 'tab' },
      React.createElement(
        ShopDoorPanel,
        {
          title: 'Share your shop',
          line: 'setnayan.com/shop',
          actions: React.createElement('a', { href: '/x', 'data-door-action': '' }, 'Open in browser'),
          thumb: React.createElement('a', { href: '/y', 'data-door-thumb': '' }, 'Go'),
          onClose: () => {},
          data: 'shop-share',
        },
        React.createElement('p', null, 'rows'),
      ),
    ),
  );
  assert.match(html, /data-sheet=""/, 'not the shared Sheet');
  assert.doesNotMatch(html, /data-rise-screen=/, 'still the full-screen rise');
  assert.match(html, /data-overlay-backdrop=""[^>]*class="sn-popup-dark fixed inset-0/, 'no backdrop dims the Shop page');
  const panel = html.match(/<div data-sheet-panel=""[^>]*class="([^"]+)"/)?.[1] ?? '';
  assert.match(panel, /tab:w-\[min\(27\.5rem,calc\(100vw-3\.5rem\)\)\]/, 'not the 440px drawer');
  assert.match(panel, /tab:rounded-l-3xl/, 'not pinned to the right edge');
  assert.match(html, /Share your shop/);
  assert.match(html, /setnayan\.com\/shop/);
  assert.match(html, /data-door-action=""/, 'the door lost its own action');
  assert.match(html, /data-sheet-foot=""[\s\S]*data-door-thumb=""/, 'the thumb button is not pinned at the foot');
  assert.match(html, /data-shop-door-panel="shop-share"[\s\S]*>rows</);
});

test('3 · every Shop door opens through the door, none past it', () => {
  const cover = code('app/vendor-dashboard/shop/_components/shop-cover.tsx');
  const badges = code('app/vendor-dashboard/shop/_components/shop-badge-row.tsx');
  const tiles = code('app/vendor-dashboard/performance/_components/graph-tile.tsx');
  const doors: Array<[string, string]> = [
    ['Share · ShareSheet', fn(cover, 'ShareSheet')],
    ['Logo · Promote · QR · Cover · ParamSheet', fn(cover, 'ParamSheet')],
    ['View shop · ViewShopScreen', fn(cover, 'ViewShopScreen')],
    ['each Badge · BadgeSheet', fn(badges, 'BadgeSheet')],
    ['each Analytics tile · GraphCard', fn(tiles, 'GraphCard')],
  ];
  for (const [name, body] of doors) {
    assert.ok(body.length > 0, `${name} not found`);
    assert.match(body, /<ShopDoorScreen\b/, `${name} does not open through the Shop door`);
  }
  for (const id of ['promote', 'qr', 'logo', 'cover']) assert.match(cover, new RegExp(`<ParamSheet open=\\{sheet === '${id}'\\}`), `the ${id} door lost its screen`);
  for (const src of [cover, badges, tiles]) assert.doesNotMatch(src, /<RiseScreen\b/, 'a door rises past the Shop door');
});

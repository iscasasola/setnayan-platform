/**
 * 🔒 RISE FULL SCREEN IS ONE SCREEN, AND THE SHOP TAB OPENS INTO IT (Build 5 · Lane A slice 1; owner 2026-11-10
 * *"risefull screen is what we call it"* · *"fullscreen everything"* · on the Shop screenshot *"Most of these will be the
 * fullscreen grow design"*; HOUSE_TEMPLATES T4 "NO GUARD — needs one for … no popup sheet where a Rise belongs").
 *
 * Held here:
 *   1 · WHERE IT COMES FROM — only a fresh press on something pressable, still on the page; a deep link / a reload has
 *       none and the screen simply appears (the picked client's hard-load rule).
 *   2 · HOW IT MOVES — a clip from the tapped rect to the whole screen on THE ONE rise (`RISE_MS` · `RISE_EASE`, never a
 *       number of its own); reduced motion = the short fade; no origin = no motion.
 *   3 · WHAT IT IS — a full-screen modal on the pop layer token, drawn on <body>; the bars step away (`useChromeAway`);
 *       the house modal contract (`useModalA11y`: focus, Esc, the page held and put back on the same pixel); the phone's
 *       Back closes it (`useBackCloses`); the close plays the SAME frames in reverse; a tab re-tap still reaches the top.
 *   4 · ONE PART — no other file draws a `data-rise-screen`; a ⚙ rises through `MenuSettingsButton` (rendered: the risen
 *       frame, never the sheet). Since 13 Nov `rise` is the DEFAULT — every ⚙ rises; only the picked client's own ⚙
 *       (inside a risen view, one level) passes `rise={false}` and keeps its sheet.
 *   5 · THE SHOP TAB MAP — ⚙ · Logo · Share · Promote · QR · Cover · View shop · each Analytics card · each Badge open the
 *       ONE `RiseScreen`; none of those files draws a popup `<Sheet` any more; View shop stays in the app (the only new
 *       tab left is the risen page's own "Open in browser ↗").
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-10): `<RiseScreen` → `<Sheet open` in shop-badge-row.tsx (red: 5);
 * `rise` dropped from `ShopSettings`' ⚙ (red: 5); `direction: 'reverse'` removed from the close (red: 3);
 * `RISE_ORIGIN_FRESH_MS` check `>` → `<` (red: 1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { RISE_EASE, RISE_MS, RISE_REDUCED_MS } from '@/lib/rise-motion';
import { RISE_FULL_CLIP, RISE_ORIGIN_FRESH_MS, pickRiseOrigin, riseClip, riseScreenMotion } from '@/lib/rise-screen';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SCREEN = code('app/_components/rise/rise-screen.tsx');

test('1 · a rise comes from a fresh press on something still on the page — else it simply appears', () => {
  const el = { id: 'promote' };
  const live = () => true;
  assert.equal(pickRiseOrigin({ el, at: 1000 }, 1000 + 300, live), el, 'a fresh press is not the origin');
  assert.equal(pickRiseOrigin({ el, at: 1000 }, 1000 + RISE_ORIGIN_FRESH_MS, live), el, 'the edge of the window is lost');
  assert.equal(pickRiseOrigin({ el, at: 1000 }, 1000 + RISE_ORIGIN_FRESH_MS + 1, live), null, 'a stale press still rises a deep link');
  assert.equal(pickRiseOrigin({ el, at: 1000 }, 999, live), null, 'a press from the future');
  assert.equal(pickRiseOrigin({ el, at: 1000 }, 1100, () => false), null, 'an origin that left the page is still used');
  assert.equal(pickRiseOrigin(null, 1100, live), null);
  assert.ok(RISE_ORIGIN_FRESH_MS > 0 && RISE_ORIGIN_FRESH_MS <= 2000, 'the window is not a short one');
});

test('2 · the rise: a clip from the tapped rect on THE ONE rise; the short fade when reduced; nothing without an origin', () => {
  const vp = { width: 375, height: 812 };
  const m = riseScreenMotion({ top: 300, left: 16, width: 80, height: 40 }, vp, false);
  assert.ok(m);
  assert.equal(m.frames.length, 2);
  assert.equal(m.frames[0]!.clipPath, 'inset(300px 279px 472px 16px round 14px)', 'the first frame is not the tapped rect');
  assert.equal(m.frames[1]!.clipPath, RISE_FULL_CLIP, 'the last frame is not the whole screen');
  assert.equal(m.timing.duration, RISE_MS, 'the rise keeps a length of its own');
  assert.equal(m.timing.easing, RISE_EASE);
  // A rect partly off screen clips at the screen's edge (never a negative inset).
  assert.equal(riseClip({ top: -20, left: -4, width: 400, height: 60 }, vp), 'inset(0px 0px 772px 0px round 14px)');
  const r = riseScreenMotion({ top: 300, left: 16, width: 80, height: 40 }, vp, true);
  assert.deepEqual(r?.frames, [{ opacity: 0 }, { opacity: 1 }], 'reduced motion still moves');
  assert.equal(r?.timing.duration, RISE_REDUCED_MS);
  assert.equal(riseScreenMotion(null, vp, false), null, 'a deep link animates from nowhere');
  assert.doesNotMatch(code('lib/rise-screen.ts'), /duration:\s*\d/, 'a typed duration in place of the tokens');
  assert.doesNotMatch(SCREEN, /duration:\s*\d/, 'a typed duration in place of the tokens');
});

test('3 · a full-screen modal on the pop layer; bars away; the house modal contract; Back; the exact reverse; tab re-tap', () => {
  assert.match(SCREEN, /className="fixed inset-0 z-sn-pop /, 'not a full screen on the pop layer token');
  assert.doesNotMatch(SCREEN, /\bz-\[?\d+\]?\b|zIndex:/, 'a raw z-index — use the layer tokens');
  assert.match(SCREEN, /role="dialog"\s+aria-modal="true"/);
  assert.match(SCREEN, /host \? createPortal\(screen, host\) : screen/, 'not drawn on <body>');
  assert.match(SCREEN, /useChromeAway\(true\);/, 'the bars stay while the screen is up');
  assert.match(SCREEN, /useModalA11y\(\{ open: Boolean\(host\), onClose: close, containerRef: rootRef \}\)/, 'not the house modal contract (or the page is not held)');
  assert.doesNotMatch(SCREEN, /lockScroll: false/, 'the page under it is not held — ✕ would not return to the same scroll');
  assert.match(SCREEN, /const backClose = useBackCloses\(true, playClose\);/, 'the phone’s Back leaves the page');
  // ⤵ An inner Done / Not now steps out through the SAME close (the reverse, the Back entry), and a purchase in flight holds
  // every way out (13 Nov rollout).
  assert.match(SCREEN, /<RiseCloseContext\.Provider value=\{close\}>/, 'an inner close skips the reverse');
  assert.match(SCREEN, /if \(closingRef\.current \|\| busyRef\.current\) return;/, 'a busy screen still closes');
  assert.match(SCREEN, /riseOriginNow\(\)/, 'the screen does not rise out of what was tapped');
  assert.equal([...SCREEN.matchAll(/riseScreenMotion\(rectOf\(originRef\.current\), viewport\(\), prefersReducedMotion\(\)\)/g)].length, 2, 'the open and the close are not the same motion');
  assert.match(SCREEN, /el\.animate\(m\.frames, \{ \.\.\.m\.timing, direction: 'reverse', fill: 'forwards' \}\)/, 'the close is not the open played backwards');
  assert.match(SCREEN, /window\.addEventListener\(TAB_RESELECT_EVENT, on\)/, 'a tab re-tap no longer gets past an open screen');
  // The head: ✕ first (left), the title over its one line, the ⓘ last (the settings prototype's `.fs-head`).
  const head = SCREEN.slice(SCREEN.indexOf('data-rise-head'), SCREEN.indexOf('data-rise-body'));
  assert.ok(head.indexOf('data-rise-close') < head.indexOf('{title ?'), '✕ is not at the head’s left');
  assert.ok(head.indexOf('{title ?') < head.indexOf('data-rise-info-button'), 'ⓘ is not at the head’s right');
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

test('4 · ONE part: nobody else draws a risen screen; a ⚙ rises through the shared door, the rest keep their sheet', async () => {
  const drawers = walk(join(WEB, 'app'))
    .filter((p) => /data-rise-screen=/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => relative(WEB, p));
  assert.deepEqual(drawers, ['app/_components/rise/rise-screen.tsx'], 'a second full-screen shell');

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MenuSettingsButton } = await import('@/app/_components/menu-settings-button');
  const draw = (rise: boolean) =>
    renderToStaticMarkup(
      React.createElement(MenuSettingsButton, { menu: 'shop', open: true, onOpenChange: () => {}, rise }, React.createElement('p', null, 'rows')),
    );
  const risen = draw(true);
  assert.match(risen, /data-rise-screen="settings-shop"/, 'the ⚙ with `rise` does not open the risen screen');
  assert.match(risen, /data-menu-settings-sheet="shop"/, 'the risen ⚙ lost its rows’ hook');
  assert.match(risen, />rows</);
  assert.match(risen, /Shop settings/, 'the risen ⚙ is not headed by the menu’s own name');
  assert.doesNotMatch(risen, /data-sheet=""/, 'the risen ⚙ still opens the popup sheet');
  // Every other ⚙ is as it was — the popup sheet frame, no risen screen.
  const sheet = draw(false);
  assert.doesNotMatch(sheet, /data-rise-screen/);
  // ⤴ 13 Nov — "fullscreen everything": a ⚙ with no `rise` prop RISES (the default), and the ONE ⚙ that keeps its sheet is
  // the picked client's own, which already sits inside a risen view (one level only).
  const byDefault = renderToStaticMarkup(
    React.createElement(MenuSettingsButton, { menu: 'guests', open: true, onOpenChange: () => {} }, React.createElement('p', null, 'rows')),
  );
  assert.match(byDefault, /data-rise-screen="settings-guests"/, 'a ⚙ with no `rise` prop opens the popup sheet again');
  const optOuts = walk(join(WEB, 'app'))
    .filter((p) => /<MenuSettingsButton\b[^>]*rise=\{false\}/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => relative(WEB, p));
  assert.deepEqual(optOuts, ['app/_components/picked/picked-shell.tsx'], 'a ⚙ outside a risen view still opens a popup sheet');
});

test('5 · the Shop tab map: every door rises into the ONE screen — no popup sheet left; View shop stays in the app', () => {
  const files = {
    cover: code('app/vendor-dashboard/shop/_components/shop-cover.tsx'),
    badges: code('app/vendor-dashboard/shop/_components/shop-badge-row.tsx'),
    // 🔁 Build 6 Lane I: the five-card carousel is gone (no fact twice). Its graphs are tiles of ONE Analytics (Shop ›
    // Analytics), and each tile rises through the same ONE screen.
    analytics: code('app/vendor-dashboard/performance/_components/graph-tile.tsx'),
  };
  for (const [name, src] of Object.entries(files)) {
    assert.match(src, /import \{ RiseScreen \} from '@\/app\/_components\/rise\/rise-screen';/, `${name} does not open the ONE risen screen`);
    assert.doesNotMatch(src, /<Sheet\b/, `${name} still opens a popup sheet where a Rise belongs`);
  }
  // The cover's doors: Logo · Promote · QR · Cover (ParamSheet) · Share · View shop — each a RiseScreen.
  const fn = (src: string, name: string) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));
  for (const f of ['ParamSheet', 'ShareSheet', 'ViewShopScreen']) assert.match(fn(files.cover, f), /<RiseScreen\b/, `${f} does not rise`);
  for (const id of ['promote', 'qr', 'logo', 'cover']) assert.match(files.cover, new RegExp(`<ParamSheet open=\\{sheet === '${id}'\\}`), `the ${id} door lost its screen`);
  assert.match(fn(files.badges, 'BadgeSheet'), /<RiseScreen\b/, 'a badge does not rise');
  assert.match(fn(files.analytics, 'GraphCard'), /<RiseScreen\b/, 'an analytics card does not rise');
  // ⚙ — the pinned row's and the cover's (`?gear=1`) — through the ONE door, risen.
  assert.match(code('app/vendor-dashboard/shop/_components/shop-settings.tsx'), /<MenuSettingsButton menu="shop" rise\b/, 'the Shop ⚙ opens a popup sheet');
  // View shop: both doors are buttons that rise the page in the app; the only new tab is "Open in browser ↗" inside it.
  assert.match(files.cover, /onClick=\{\(\) => setViewOpen\(true\)\}[\s\S]{0,260}data-view-shop=""/, 'View shop does not rise');
  assert.match(files.cover, /onClick=\{\(\) => setViewOpen\(true\)\}[\s\S]{0,260}data-view-shop-pin=""/, 'the pinned row’s View shop does not rise');
  assert.equal([...files.cover.matchAll(/target="_blank"/g)].length, 1, 'View shop opens a new tab again');
  assert.match(fn(files.cover, 'ViewShopScreen'), /target="_blank"[\s\S]{0,200}data-view-shop-browser=""/, 'the risen page lost its "Open in browser ↗"');
});

// ⤴ 13 Nov rollout, batch 2 (build-sessions/RISE-AUDIT-2026-11-13.md § B): the lock and upsell explainers that were still a
// popup sheet or a drawer of their own rise through the ONE screen. 🛡 SABOTAGE (seen RED, then restored): `<RiseScreen` →
// `<Sheet open` in iap-papic-sheet.tsx.
test('6 · every lock / upsell explainer rises — no popup sheet, no drawer of its own', () => {
  const explainers = [
    'app/_components/iap/iap-unlock-sheet.tsx',
    'app/_components/iap/iap-papic-sheet.tsx',
    'app/_components/iap/iap-live-watch-sheet.tsx',
    'app/_components/app-store/choose-plan-sheet.tsx',
    'app/_components/lock/locked-feature.tsx',
    'app/_components/lock/limit-sheet.tsx',
  ];
  for (const rel of explainers) {
    const src = code(rel);
    assert.match(src, /import \{ RiseScreen\b[^}]*\} from '@\/app\/_components\/rise\/rise-screen';/, `${rel} does not open the ONE risen screen`);
    assert.match(src, /<RiseScreen\b/, `${rel} does not rise`);
    assert.doesNotMatch(src, /<Sheet\b|role="dialog"/, `${rel} still opens a popup where a Rise belongs`);
  }
  // A purchase in flight holds every way out; the inner Done / Not now fall back the same way ✕ does.
  for (const rel of explainers.slice(0, 3)) {
    assert.match(code(rel), /busy=\{buying\}/, `${rel}: ✕ closes mid-purchase`);
    assert.match(code(rel), /<WithRiseClose fallback=\{closed\}>/, `${rel}: an inner close skips the fall`);
  }
});

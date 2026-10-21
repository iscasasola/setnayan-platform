/**
 * lib/every-print-wears-the-hub.test.ts — owner 2026-10-21, on Studio › Prints: *"shouldn't this mimic the event hub
 * design? and so does the other prints?"* (`lib/print-hub-look.ts`).
 *
 *   1 · the paper and inks are the guest page's own bag (`guestLookFrom`), read back by the page's own reader;
 *   2 · the couple's four faces reach the paper in the page's roles — and every Hub face prints real letters;
 *   3 · a picture background is print-safe: never less veil than the Hub's scrim or the floor, every ink ≥ 4.5 : 1
 *       on the picture's lightest and darkest measured colours;
 *   4 · nothing of the couple's on the page → the print's colours are exactly today's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { HUB_FONT_KEYS } from './hub-fonts';
import { printFont } from './print-layout';
import { hexRgb, legibleInk, MIN_CONTRAST, over, worstContrast } from './print-ground';
import { FRAME_INSET_PT, PANEL_FLOOR, printHubFonts, printLookForEvent, printLookFromHub, type WornHub } from './print-hub-look';
import { stripComments } from './strip-comments';
import { hubPrintFont, printLookFor } from './print-pieces';
import { boardColours, dressedTheme, themeColours } from './theme-colours';
import { buildCustomSiteColorVars } from './site-palette';

const BOARD = { reception: ['#6B7F5E', '#E9E4D4', '#B08D57', '#FBF8F1', '#C9A9A6'] };
const base = printLookFor('house', themeColours('house', BOARD));
const NO_FONTS = printHubFonts(null, null);

test('1 · the paper is the page’s own — a couple’s page colour reaches the card', () => {
  const vars = buildCustomSiteColorVars('#2E3B4E', null)!;
  const look = printLookFromHub(base, { theme: 'house', rolePalette: BOARD, vars, fonts: NO_FONTS, picture: null, wearsThemeLoop: true });
  assert.equal(look.paper, boardColours(vars, dressedTheme('house', BOARD)).canvas);
  assert.equal(look.paper, '#2e3b4e');
  for (const ink of [look.ink, look.muted, look.accent, look.heading]) {
    assert.ok(worstContrast(hexRgb(ink), 1, [hexRgb(look.paper)]) >= MIN_CONTRAST, `${ink} does not read on ${look.paper}`);
  }
});

test('2 · Names · Headings · Text · Labels reach the paper in the page’s roles; Headings follow Names', () => {
  const look = printLookFromHub(base, {
    theme: 'house',
    rolePalette: BOARD,
    vars: null,
    fonts: printHubFonts('cinzel', { body: { font: 'lora' }, highlight: { font: 'marcellus' } }),
    picture: null,
    wearsThemeLoop: true,
  });
  assert.equal(look.headFont, 'hub-cinzel');
  assert.equal(look.headingFont, 'hub-cinzel');
  assert.equal(look.bodyFont, 'hub-lora');
  assert.equal(look.labelFont, 'hub-marcellus');
  const none = printLookFromHub(base, { theme: 'house', rolePalette: BOARD, vars: null, fonts: NO_FONTS, picture: null, wearsThemeLoop: true });
  assert.equal(none.headFont, base.headFont);
  assert.equal(none.headingFont, undefined);
  assert.equal(none.labelFont, undefined);
});

test('2b · every Hub face prints real letters (a broken outline falls back, never reaches paper)', () => {
  assert.ok(HUB_FONT_KEYS.length >= 40);
  for (const k of HUB_FONT_KEYS) {
    const f = printFont(hubPrintFont(k));
    for (const ch of 'OAEg') {
      const b = f.getPath(ch, 0, 0, 100).getBoundingBox();
      assert.ok(b.y2 - b.y1 < 200, `${k} draws "${ch}" ${Math.round(b.y2 - b.y1)} units tall at 100`);
    }
  }
});

test('3 · a picture is print-safe: the Hub’s scrim at the edge, a panel that reads, every ink ≥ 4.5', () => {
  const samples = ['#595607', '#484707', '#383907', '#756b08', '#f8d8a1', '#282a0e'];
  const look = printLookFromHub(base, { theme: 'house', rolePalette: BOARD, vars: null, fonts: NO_FONTS, picture: { samples, scrim: 0.45 }, wearsThemeLoop: true });
  assert.equal(look.still, 'full');
  assert.ok(look.frame, 'a picture with no panel');
  assert.equal(look.frame!.outer, 0.45, 'the edge does not wear the Hub’s own scrim');
  assert.equal(look.frame!.inset, FRAME_INSET_PT);
  assert.ok(look.frame!.inner >= Math.max(0.45, PANEL_FLOOR), `panel ${look.frame!.inner} below the floor`);
  const grounds = samples.map((s) => over(hexRgb(look.paper), hexRgb(s), look.frame!.inner));
  for (const ink of [look.ink, look.muted, look.accent, look.heading]) {
    assert.ok(worstContrast(hexRgb(ink), 1, grounds) >= MIN_CONTRAST, `${ink} does not read on the panel`);
  }
});

test('4 · nothing of the couple’s on the page: today’s paper and still; an ink moves only if it did not read', () => {
  const look = printLookFromHub(base, { theme: 'house', rolePalette: BOARD, vars: null, fonts: NO_FONTS, picture: null, wearsThemeLoop: true });
  assert.equal(look.paper, base.paper);
  assert.equal(look.still, base.still);
  assert.equal(look.frame, null);
  const paper = [hexRgb(base.paper)];
  for (const k of ['ink', 'muted', 'accent', 'heading'] as const) {
    const was = worstContrast(hexRgb(base[k]), 1, paper);
    if (was >= MIN_CONTRAST + 0.05) assert.equal(look[k], base[k], `${k} read already and was still changed`);
    else assert.equal(look[k], legibleInk(base[k], paper), `${k} (${was.toFixed(2)} : 1) did not take the least change that reads`);
  }
});

/* ── 5 · 🔒 the Pro door ──────────────────────────────────────────────────────────────────────────────────────────── */

const WORN: WornHub = {
  hub: {
    theme: 'house',
    rolePalette: BOARD,
    vars: buildCustomSiteColorVars('#2E3B4E', null)!,
    fonts: printHubFonts('cinzel', { body: { font: 'cormorant' } }),
    picture: { samples: ['#595607', '#f8d8a1', '#282a0e'], scrim: 0.45 },
    wearsThemeLoop: true,
  },
  picture: new Uint8Array([0xff, 0xd8, 0xff]),
};

test('5 · a NON-Pro event prints the classic look — the very object — and its Hub is never read', async () => {
  let reads = 0;
  const wear = async () => {
    reads += 1;
    return WORN;
  };
  for (const ownsPro of [false, undefined as unknown as boolean, 0 as unknown as boolean, 'yes' as unknown as boolean]) {
    const r = await printLookForEvent(base, ownsPro, wear);
    assert.equal(r.look, base, `ownsPro=${String(ownsPro)} reached a look other than the classic one`);
    assert.equal(r.picture, null, `ownsPro=${String(ownsPro)} carried the Hub's picture`);
    assert.equal(r.wearsHub, false);
  }
  assert.equal(reads, 0, 'the Hub was read for an event without Pro');
});

test('5b · a Pro event wears its Hub: the Hub’s paper, fonts and picture', async () => {
  const r = await printLookForEvent(base, true, async () => WORN);
  assert.equal(r.wearsHub, true);
  assert.notEqual(r.look, base);
  assert.equal(r.look.paper, '#2e3b4e');
  assert.equal(r.look.headFont, 'hub-cinzel');
  assert.equal(r.look.still, 'full');
  assert.equal(r.picture, WORN.picture);
});

test('5c · a Pro event whose Hub cannot be read prints classic; a picture that did not arrive draws no panel over nothing', async () => {
  const failed = await printLookForEvent(base, true, async () => {
    throw new Error('refused');
  });
  assert.equal(failed.look, base);
  assert.equal(failed.wearsHub, false);
  const noBytes = await printLookForEvent(base, true, async () => ({ ...WORN, picture: null }));
  assert.equal(noBytes.wearsHub, true);
  assert.equal(noBytes.look.frame, null);
  assert.notEqual(noBytes.look.still, 'full');
});

/* ── 6 · no way around the door ───────────────────────────────────────────────────────────────────────────────────── */

const WEB = resolve(__dirname, '..');
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const SHIPPED = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))].map((p) => ({ rel: relative(WEB, p), src: stripComments(readFileSync(p, 'utf8')) }));

test('6 · nothing but the door makes a Hub look — every `printLookFromHub(` call is inside lib/print-hub-look.ts', () => {
  assert.ok(SHIPPED.length > 500, `only ${SHIPPED.length} shipped files were read — the walk is broken`);
  const callers = SHIPPED.filter((f) => /\bprintLookFromHub\s*\(/.test(f.src)).map((f) => f.rel);
  assert.deepEqual(callers, ['lib/print-hub-look.ts'], `a Hub look is made around the Pro door in: ${callers.join(', ')}`);
});

test('6b · every door call is handed the MEASURED entitlement — an `ownsPro` read from `printOwnsPro`, never a constant', () => {
  const calls = SHIPPED.flatMap((f) => [...f.src.matchAll(/\bprintLookForEvent\s*\(([^,]+),([^,]+),/g)].map((m) => ({ rel: f.rel, src: f.src, arg: m[2]!.trim() })));
  const sites = calls.filter((c) => c.rel !== 'lib/print-hub-look.ts');
  assert.ok(sites.length >= 1, 'no print reaches the Hub look at all — the wiring is gone');
  for (const c of sites) {
    const ids = [...c.arg.matchAll(/\b[a-zA-Z_]\w*\b/g)].map((m) => m[0]).filter((id) => !['opts', 'samplePalette', 'undefined'].includes(id));
    const measured = ids.filter((id) => new RegExp(`\\bconst\\s+${id}\\s*=\\s*await\\s+printOwnsPro\\(`).test(c.src));
    assert.ok(measured.length >= 1, `${c.rel}: the door is handed \`${c.arg}\`, not an entitlement read from printOwnsPro`);
    assert.ok(!/\btrue\b/.test(c.arg), `${c.rel}: the door is handed a constant true (\`${c.arg}\`)`);
  }
});

/* ── 7 · the row on Studio › Prints ──────────────────────────────────────────────────────────────────────────────── */

(globalThis as unknown as { React: unknown }).React = React;
/* The prints' Pro door sits beside server actions (`studio-prints-six.tsx`) — the repo's `server-only` shim (as in
   `a-background-pick-shows-at-once.test.ts`), so the row renders here as it does on the page. */
{
  const Mod = createRequire(__filename)('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

test('7 · Studio › Prints: owned says the Hub look; a free event on the web meets the ◆ door, never a padlock; the app shell shows nothing to buy', async () => {
  const { StudioHubLookRow } = await import('@/app/dashboard/[eventId]/launch/_components/studio-prints-settings');
  const E = '00000000-0000-4000-8000-000000000000';
  const draw = (ownsPro: boolean, storeShell: boolean) => renderToStaticMarkup(React.createElement(StudioHubLookRow, { eventId: E, ownsPro, storeShell }));
  const owned = draw(true, false);
  assert.match(owned, /data-print-hub-look="worn"/);
  assert.doesNotMatch(owned, /data-print-hub-look-door/);
  const free = draw(false, false);
  assert.match(free, /data-print-hub-look="classic"/);
  assert.match(free, /data-print-hub-look-door/);
  assert.match(free, /studio\/website-pro/);
  assert.doesNotMatch(free, /Locked —/, 'a free event meets a padlock on the Event Hub (owner 2026-09-29: "there are no padlocks")');
  assert.equal(draw(false, true), '', 'the app-store shell shows a free event a door to buy');
  const shellOwned = draw(true, true);
  assert.match(shellOwned, /data-print-hub-look="worn"/);
  assert.doesNotMatch(shellOwned, /Event Hub Pro/, 'the app-store shell names the paid extra');
});

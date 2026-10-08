/**
 * studio-pages-have-no-title-row.test.ts — NO "INFO ▾" ROW UNDER THE TOP BAR; "STUDIO ▾" CHOOSES THE PAGE.
 *
 * Owner, 2026-10-08, with a picture of the "INFO ▾" pill row under the top bar on Studio › Info: *"we will not have
 * these."* — and, on how to reach another page then: *"Tapping studio will open a popup instead for us to choose
 * which one?"* (controller: yes). Earlier, on Look: *"there is no more look title there. make this same to the other
 * studio pages"*.
 *
 *   (1) NO ROW IS DRAWN — the shell draws no title row for a Studio page; the page starts right under the top nav
 *       (no 52-px offset, no strip); ✓ Done ALONE stays on the two pages that hide the top nav — it was the only way
 *       out of them.
 *   (2) INSIDE A PAGE THE PILL'S STUDIO HALF OPENS THE CHOICES — "Studio ▾", the house dropdown, the picked half of
 *       the pill; at the Studio home and on the Stages side it is the plain segment, with no ▾.
 *   (3) EVERY DESTINATION THE ROW HAD IS IN IT, AND NOTHING ELSE — exactly the pages this event draws, in the home's
 *       order, each with its mark, its line and Ready / Missing; the current one is the dropdown's value (ticked).
 *       No "All pages" row (owner 2026-10-08, on the first build: *"pop up looks good. remove the all pages."*) —
 *       the home is Stages, then Studio.
 *   (4) A PICK COSTS WHAT THE ROW'S DID — the same call (`openStudio`); nothing here asks the server or renders the
 *       Maker.
 *   (5) THE LAB'S SAVE STAND-IN IS HANDED ONLY BY THE LAB — Info's draft door is the real action everywhere else.
 *
 * Mutations seen RED (2026-10-08), each restored: the title row drawn again for every full page → (1); the 52-px
 * offset back on every page → (1); the chooser dropped (a plain segment inside a page) → (2); an "All pages" row
 * put back → (3); a page left out of the list → (3); a pick that also re-renders the Maker (`router.refresh`) → (4); the
 * real dashboard handed the lab's stand-in → (5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { studioFullScreenCss } from './studio-details';
import { STUDIO_TILE_KEYS, STUDIO_TILES, type StudioTileModel } from './studio-tiles';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const PARTS = `${L}/stages-studio-parts.tsx`;
const SHELL = `${L}/maker-shell.tsx`;
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const h = React.createElement;

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
const tiles: StudioTileModel[] = STUDIO_TILE_KEYS.map((key) => ({
  key,
  label: STUDIO_TILES[key].label,
  short: STUDIO_TILES[key].short,
  item: STUDIO_TILES[key].item,
  immersive: STUDIO_TILES[key].immersive === true,
  done: key === 'logo' ? false : key === 'rsvp' ? undefined : true,
  status: STUDIO_TILES[key].sub,
}));

test('(1) no row is drawn: a Studio page starts right under the top nav — ✓ Done alone stays on the two full-screen pages', async () => {
  const shell = read(SHELL);
  // THE CLAIM: the only thing the shell draws over a Studio page is ✓ Done, and only where the top nav is hidden.
  assert.doesNotMatch(shell, /StudioToolRow/, 'the title row is drawn again');
  assert.equal(count(shell, /<StudioDoneBar\b/g), 1);
  assert.match(shell, /\) : studioImmersive \? \(\s*<StudioDoneBar onDone=\{\(\) => \(studioFrom \? backToPart\(\) : pickSide\('studio'\)\)\} \/>\s*\) : null\}/, '✓ Done is drawn on a page that has its top nav (a row again), or lost its way home');
  assert.match(shell, /const studioImmersive = studioFull && studioTile!\.immersive;/);
  // The page takes the height the row had: the 52-px offset is only for the two pages that still carry ✓ Done.
  assert.match(shell, /\$\{studioImmersive \? ' max-lg:top-\[52px\]' : ''\}`\} data-maker-details-layer=""/, 'every Studio page is still pushed down by a row that is gone');
  assert.equal(count(shell, /max-lg:top-\[52px\]/g), 1);
  const css = studioFullScreenCss();
  assert.ok(css.includes('{--maker-lt-h:calc(100dvh - 44px)}'), 'a form page still leaves room for the row (52 px of nothing)');
  assert.doesNotMatch(css, /100dvh - 96px/);
  assert.ok(css.includes('div:has(> [data-details-form-field]){padding-top:0}'), 'a strip of empty page is left over the form');
  // What is left of the row, rendered: ONE button, ✓ Done — no pill, no ▾, no name.
  const parts = await import(`../${PARTS}`);
  assert.equal((parts as Record<string, unknown>).StudioToolRow, undefined);
  const bar = await paint(h(parts.StudioDoneBar, { onDone: () => {} }));
  assert.equal(count(bar, /<button/g), 1);
  assert.match(bar, /<button type="button" data-maker-studio-done=""[^>]*>[\s\S]*Done<\/button>/);
  assert.doesNotMatch(bar, /aria-haspopup|uppercase|INFO|Wedding March/);
  // The two pages that hide the top nav are still exactly the two the owner named.
  assert.deepEqual(tiles.filter((t) => t.immersive).map((t) => t.key), ['march', 'seats']);
});

test('(2) inside a page the pill’s Studio half is "Studio ▾" and opens the choices; at the home and on Stages it is the plain segment', async () => {
  const { StudioSideSwitch } = await import(`../${PARTS}`);
  const draw = (props: Record<string, unknown>) => paint(h(StudioSideSwitch as React.FC<Record<string, unknown>>, { onPick: () => {}, tiles, onOpen: () => {}, ...props }));
  const inside = await draw({ side: 'studio', at: tiles[0] });
  // THE CLAIM: a dropdown (it opens its choices; it never cycles), named Studio, with its ▾ — as the picked half.
  assert.match(inside, /<span aria-current="page" data-seg="studio" data-studio-chooser=""/, 'the Studio half is not the picked half of the pill (the thumb would leave it)');
  assert.match(inside, /<button type="button" aria-label="Studio pages: Studio" aria-haspopup="listbox" aria-expanded="false" data-studio-chooser-pick=""/, 'inside a page the Studio half does not open the choices');
  assert.match(inside, /data-studio-chooser-pick=""[^>]*>[\s\S]*?>Studio<\/span><svg[^>]*lucide-chevron-down/, 'there is no ▾ beside "Studio"');
  assert.equal(count(inside, /aria-pressed="true"/g), 0);
  assert.match(inside, /<button type="button" aria-pressed="false" data-seg="stages"[^>]*>Stages<\/button>/, 'Stages is no longer one tap away');
  // The ink on the accent: the label and the ▾ both read on the pill (never the accent on the accent).
  assert.match(inside, /data-studio-chooser-pick="" class="[^"]*!text-sn-on-accent[^"]*\[&amp;&gt;svg\]:!text-sn-on-accent/);
  // At the Studio home: where you are — the plain segment, no ▾, nothing to open.
  const home = await draw({ side: 'studio', at: null });
  assert.match(home, /<button type="button" aria-pressed="true" data-seg="studio"[^>]*>Studio<\/button>/);
  assert.doesNotMatch(home, /aria-haspopup|chevron|data-studio-chooser/);
  // On the Stages side: Studio is one tap to the home — no ▾ (even if a page is remembered).
  const stages = await draw({ side: 'stages', at: tiles[0] });
  assert.match(stages, /<button type="button" aria-pressed="false" data-seg="studio"[^>]*>Studio<\/button>/);
  assert.doesNotMatch(stages, /aria-haspopup|chevron|data-studio-chooser/);
  // The shell hands it the page that is open, the event's pages, and its own `openStudio`.
  assert.match(read(SHELL), /<StudioSideSwitch side=\{side\} onPick=\{pickSide\} at=\{studioTile\} tiles=\{studio\?\.tiles\} onOpen=\{openStudio\} \/>/);
  // It is the house dropdown — so on a phone it is the Maker's one sheet (dark, blurred, locked), a list on a computer.
  const src = read(PARTS);
  const sw = src.slice(src.indexOf('export function StudioSideSwitch('), src.indexOf('const STUDIO_CHOOSER_SEG'));
  assert.equal(count(sw, /<PickMenu\b/g), 1);
  assert.doesNotMatch(sw, /role="listbox"|<select|createPortal/, 'the chooser is a hand-made list');
  assert.match(sw, /value=\{at\.key\}/, 'the current page is not the one ticked');
});

test('(3) every destination the row had is in it and nothing else: this event’s pages in the home’s order, with mark, line and Ready / Missing', async () => {
  const { studioChooserOptions } = await import(`../${PARTS}`);
  const opts = studioChooserOptions(tiles) as Array<{ key: string; label: string; hint?: string; icon?: unknown; trail?: unknown }>;
  // THE CLAIM: exactly the home's eleven — no page missing, none out of order, and NO extra row ("All pages").
  assert.deepEqual(opts.map((o) => o.key), [...STUDIO_TILE_KEYS], 'the chooser is not exactly the home’s pages (a page is missing, out of order — or an extra row is back)');
  assert.ok(!opts.some((o) => /all pages/i.test(o.label)), '"All pages" is back in the chooser');
  for (const [i, t] of tiles.entries()) {
    const o = opts[i]!;
    assert.equal(o.label, t.label);
    assert.equal(o.hint, t.status);
    assert.ok(o.icon, `${t.key} has no mark`);
  }
  const trail = (k: string) => opts.find((o) => o.key === k)!.trail;
  assert.deepEqual(trail('info'), { text: '✓', tone: 'ok', label: 'Ready' });
  assert.deepEqual(trail('logo'), { text: 'Missing', tone: 'left' });
  assert.equal(trail('rsvp'), undefined, 'a page nobody measured is marked');
  // An event that draws fewer pages lists fewer — never a page it cannot open.
  assert.deepEqual(studioChooserOptions(tiles.filter((t) => t.key !== 'story' && t.key !== 'march')).map((o: { key: string }) => o.key), ['info', 'look', 'logo', 'mood', 'schedule', 'seats', 'gifts', 'rsvp', 'prints']);
  // ONE source for the pages: the same models the home's cards are drawn from — no second list here.
  const src = read(PARTS);
  assert.doesNotMatch(src, /STUDIO_TILE_KEYS|STUDIO_TILES\b/, 'the chooser keeps a second list of the pages');
  // …and Look's own lower-third ▾ is the same rows (without marks).
  assert.match(src, /options=\{tiles\.map\(\(t\) => tileOption\(t, false\)\)\}/);
  // The home is still reached: Stages, then Studio (`pickSide('studio')` always lands on the home).
  const shell = read(SHELL);
  assert.match(shell, /if \(next === 'studio'\) setStudioAt\('home'\);/, 'from Stages, Studio no longer lands on the Studio home');
});

test('(4) a pick costs what the row’s did: the same `openStudio` — no request, no render of the Maker', () => {
  const src = read(PARTS);
  /* The switch's OWN source (Look's lower-third ▾ further down has the same line — it must not stand in for this one). */
  const sw = src.slice(src.indexOf('export function StudioSideSwitch('), src.indexOf('const STUDIO_CHOOSER_SEG'));
  assert.ok(sw.length > 400, 'anti-vacuity: the switch was not found');
  assert.match(sw, /onPick=\{\(k\) => onOpen\(k as StudioTileKey\)\}/, 'a pick does not open the page the way the row did');
  assert.doesNotMatch(sw, /fetch\(|router|useRouter|refresh|makerSave|revalidate|href=|location\.|useEffect/, 'choosing a page asks the server, or renders the Maker');
  // `openStudio` itself: state on the phone only — it sets the side and the page, and opens the item already mounted.
  const shell = read(SHELL);
  const open = shell.slice(shell.indexOf('const openStudio = ('), shell.indexOf('useEffect(', shell.indexOf('const openStudio = (')));
  assert.ok(open.length > 200, 'anti-vacuity: openStudio was not found');
  assert.doesNotMatch(open, /fetch\(|router\.refresh|requestMakerRefresh|makerSave/, 'opening a Studio page asks for a render');
});

test('(5) the lab’s save stand-in is handed only by the lab — Info’s draft door is the real action everywhere else', () => {
  const callers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && /setStudioDraftDoor\(/.test(stripComments(readFileSync(full, 'utf8')))) callers.push(full.slice(WEB.length + 1));
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.deepEqual(callers.sort(), [`${L}/studio-info.tsx`, 'app/dev/maker-lab/maker-lab-shell.tsx'], 'something other than the dev lab hands Info a draft door');
  const lab = read('app/dev/maker-lab/maker-lab-shell.tsx');
  assert.match(lab, /useEffect\(\(\) => \{\s*setStudioDraftDoor\(labDraft as never\);\s*return \(\) => setStudioDraftDoor\(null\);\s*\}, \[\]\);/, 'leaving the lab does not put the real door back');
});

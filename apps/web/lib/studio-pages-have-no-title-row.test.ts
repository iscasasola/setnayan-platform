/**
 * studio-pages-have-no-title-row.test.ts — A STUDIO PAGE'S HEAD IS IN THE TOP BAR'S OWN PLACE: ‹ · NAME ▾ · ↺ · ✓.
 *
 * Owner, 2026-10-08, in order. On the "INFO ▾" pill row under the top bar: *"we will not have these."* Then, with the
 * row gone: *"removing the header actually made me not know where we are at.. how can we identify it without adding a
 * row?"* → *"i think we are better off making all stages go full screen?"* · *"and make the top nav show where we are
 * at"* · *"with a go back button?"* And on the chooser: *"pop up looks good. remove the all pages."*
 *
 *   (1) NO ROW IS ADDED — the shell draws nothing over a Studio page (no title row, no ✓ Done band, no offset): the
 *       page starts right under the top bar, on all eleven pages, and the bar is never hidden.
 *   (2) THE HEAD, PAINTED FOR ALL ELEVEN — ‹ "Back to Studio" (the bar's round 44-px control, its mark the accent),
 *       then the page's mark + its FULL name + ▾ as a dropdown's button, named "<page> — choose another Studio
 *       page". No Stages | Studio pill and no ✕ Exit inside a page. A name never truncates or wraps: it steps down
 *       to its short name, then drops its mark.
 *   (3) THE HOME AND THE STAGES SIDE ARE UNCHANGED — ✕ and the plain Stages | Studio pill (no ▾); the shell draws the
 *       head only while a Studio page is open.
 *   (4) ↺ AND ✓ STAY — the top bar's own draft controls are drawn on every page exactly as on the home.
 *   (5) THE CHOOSER — the Maker's one sheet with the dropdown's own rows: exactly the pages this event draws, in the
 *       home's order, each with its mark, its line and Ready / Missing, the current one ticked; no "All pages".
 *   (6) IT COSTS NOTHING — a pick is the shell's `openStudio`, ‹ is its `pickSide('studio')` (the home): state on the
 *       phone, no request, no render of the Maker.
 *   (7) THE LAB'S SAVE STAND-IN IS HANDED ONLY BY THE LAB — Info's draft door is the real action everywhere else.
 *
 * Mutations seen RED (2026-10-08), each restored: a ✓ Done band exported again → (1); the 52-px offset back → (1);
 * the bar hidden on a page → (1); the name given `truncate` → (2); the ‹ mark not the accent → (2); the head drawn
 * with the pill beside it → (3); ✕ Exit drawn inside a page → (3); ↺ ✓ dropped inside a page → (4); an "All pages"
 * row put back → (5); a page left out of the chooser → (5); ‹ opening a page instead of the home → (6); a dashboard
 * file calling the lab's seam → (7).
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
/** Draw a component with a test's props. */
const h = (C: unknown, props: Record<string, unknown> | null = null) => React.createElement(C as React.FC<Record<string, unknown>>, props);

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
/** The top bar's own source in the shell: from `<header data-maker-toolbar` to its `</header>`. */
function bar(shell: string): string {
  const at = shell.indexOf('data-maker-toolbar=""');
  assert.ok(at > 0, 'anti-vacuity: the top bar was not found');
  return shell.slice(at, shell.indexOf('</header>', at));
}

test('(1) no row is added: nothing is drawn over a Studio page — no title row, no ✓ Done band, no offset, and the bar is never hidden', async () => {
  const shell = read(SHELL);
  assert.doesNotMatch(shell, /StudioToolRow|StudioDoneBar|studioImmersive/, 'a row or a Done band is drawn over a Studio page again');
  // The page layer fills the work area on every page: no 52-px offset for anything.
  assert.match(shell, /<div className="absolute inset-0 z-30 flex bg-cream" data-maker-details-layer="">/, 'a Studio page is pushed down by a band that is gone');
  assert.doesNotMatch(shell, /top-\[52px\]/);
  // The bar is the bar on every page (it was hidden on Wedding March and Seat plan).
  assert.match(shell, /className="sn-glass-bare relative z-20 flex shrink-0 flex-nowrap items-center gap-x-1 px-2 py-1 max-lg:h-\[52px\] lg:gap-1\.5 lg:px-2\.5"/, 'the top bar’s shape changed, or it is hidden on some page');
  // Over the work area the Studio draws its home of cards, and nothing else.
  assert.match(shell, /\{studioHomeOn \? \(\s*<StudioCover tiles=\{studio\?\.tiles \?\? null\} onOpen=\{openStudio\} \/>\s*\) : null\}/);
  const css = studioFullScreenCss();
  assert.ok(css.includes('{--maker-lt-h:calc(100dvh - 44px)}'), 'a form page still leaves room for a row (52 px of nothing)');
  assert.doesNotMatch(css, /100dvh - 96px/);
  assert.ok(css.includes('div:has(> [data-details-form-field]){padding-top:0}'), 'a strip of empty page is left over the form');
  const parts = (await import(`../${PARTS}`)) as Record<string, unknown>;
  assert.equal(parts.StudioToolRow, undefined);
  assert.equal(parts.StudioDoneBar, undefined, 'the ✓ Done band is exported again');
});

test('(2) the head, painted for all eleven: ‹ Back to Studio, then the page’s mark + full name + ▾ — no pill, no ✕; a name never truncates', async () => {
  const { StudioPageHead, studioHeadName, studioHeadShrink, studioHeadLabel, STUDIO_HEAD_FITS } = await import(`../${PARTS}`);
  assert.equal(tiles.length, 11);
  for (const tile of tiles) {
    const html = await paint(h(StudioPageHead, { tile, tiles, onOpen: () => {}, onBack: () => {} }));
    // ‹ — first, the bar's own round 44-px control, its mark the accent.
    assert.match(html, /^<span data-icon-pill="back"[^>]*><button type="button" aria-label="Back to Studio" title="Back to Studio" data-maker-tool="studio-back" data-bar-item="Back to Studio" class="([^"]*)">/, `${tile.key}: ‹ is not the head’s first control`);
    const back = /data-maker-tool="studio-back"[^>]*class="([^"]*)"/.exec(html)![1]!.split(' ');
    for (const cls of ['h-11', 'w-11', 'rounded-full', 'sn-press', 'sn-press-ring', 'text-sn-accent']) assert.ok(back.includes(cls), `${tile.key}: ‹ lost ${cls}`);
    assert.match(html, /lucide-chevron-left/);
    // The page's name: a dropdown's button, named for where you are and what a tap does.
    const label = tile.label.replace(/&/g, '&amp;');
    assert.match(html, new RegExp(`<button type="button" aria-label="${label} — choose another Studio page" aria-haspopup="listbox" aria-expanded="false" data-studio-page-name="${tile.key}" data-studio-page-fit="full"`), `${tile.key}: the name button is not named for its page`);
    // …painting its mark, its FULL name, and ▾ — in that order.
    assert.match(html, new RegExp(`data-studio-page-name="${tile.key}"[^>]*><svg[^>]*text-sn-accent[^>]*>[\\s\\S]*?</svg><span data-studio-page-name-words="" class="whitespace-nowrap">${label}</span><svg[^>]*lucide-chevron-down`), `${tile.key}: the head does not paint mark · name · ▾`);
    // THE CLAIM: inside a page there is no pill and no ✕ — and exactly two controls in the head.
    assert.equal(count(html, /<button/g), 2, `${tile.key}: the head holds more than ‹ and the name`);
    assert.doesNotMatch(html, /aria-pressed|>Stages<|aria-label="Exit"|data-maker-studio-done/, `${tile.key}: the pill, ✕ or a Done band is in the head`);
    // The name is never cut and never wraps.
    assert.doesNotMatch(/data-studio-page-name-words=""[^>]*class="([^"]*)"/.exec(html)![1]!, /truncate|ellipsis|line-clamp|break-/, `${tile.key}: the name can be cut`);
    assert.equal(studioHeadLabel(tile), `${tile.label} — choose another Studio page`);
  }
  // How a name steps down when it does not fit: the full name → the short one → the short one without its mark.
  assert.deepEqual([...STUDIO_HEAD_FITS], ['full', 'short', 'bare']);
  const mood = tiles.find((t) => t.key === 'mood')!;
  assert.deepEqual(STUDIO_HEAD_FITS.map((f: string) => studioHeadName(mood, f as never)), [{ name: 'Mood Board & Dress Code', mark: true }, { name: 'Mood Board', mark: true }, { name: 'Mood Board', mark: false }]);
  assert.deepEqual(tiles.map((t) => studioHeadName(t, 'short' as never).name), ['Info', 'Look', 'Logo', 'Mood Board', 'Schedule', 'Love Story', 'March', 'Seat plan', 'E-Gifts', 'RSVP', 'Prints']);
  assert.deepEqual(['full', 'short', 'bare'].map((f) => studioHeadShrink(f as never)), ['short', 'bare', null]);
  // It is measured, before paint, and again on a resize; a new page starts from its full name.
  const src = read(PARTS);
  assert.match(src, /if \(!el \|\| el\.scrollWidth <= el\.clientWidth \+ 1\) return;\s*const next = studioHeadShrink\(fit\);\s*if \(next\) setFit\(next\);/);
  assert.match(src, /<StudioPageName key=\{tile\.key\} tile=\{tile\} tiles=\{tiles\} onOpen=\{onOpen\} \/>/);
  // ONE list: the mark is the card's and the chooser's.
  assert.match(src, /const Icon = TILE_ICON\[tile\.key\];/);
});

test('(3) the home and the Stages side are unchanged: ✕ and the plain Stages | Studio pill — the head is drawn only inside a page', async () => {
  const { StudioSideSwitch } = await import(`../${PARTS}`);
  for (const side of ['stages', 'studio'] as const) {
    const html = await paint(h(StudioSideSwitch, { side, onPick: () => {} }));
    assert.equal(count(html, /<button/g), 2);
    assert.match(html, new RegExp(`<button type="button" aria-pressed="${side === 'stages'}" data-seg="stages"[^>]*>Stages</button>`));
    assert.match(html, new RegExp(`<button type="button" aria-pressed="${side === 'studio'}" data-seg="studio"[^>]*>Studio</button>`));
    assert.doesNotMatch(html, /aria-haspopup|chevron|Back to Studio/, 'the pill grew a ▾ or a back');
  }
  // The shell: inside a page the head takes the place of ✕ AND of the pill; everywhere else both are drawn as before.
  const top = bar(read(SHELL));
  assert.match(top, /\{studioTile \? \(\s*<StudioPageHead tile=\{studioTile\} tiles=\{studio\?\.tiles\} onOpen=\{openStudio\} onBack=\{\(\) => pickSide\('studio'\)\} \/>\s*\) : \(\s*<IconPill tone="exit">/, 'inside a page ✕ Exit is still drawn — or the head is not');
  assert.match(top, /\{studioTile \? null : stagesStudio \? \(/, 'inside a page the Stages | Studio pill is still drawn');
  assert.match(top, /<StudioSideSwitch side=\{side\} onPick=\{pickSide\} \/>/);
  assert.equal(count(top, /<StudioPageHead\b/g), 1);
  assert.equal(count(top, /aria-label="Exit"/g), 1);
});

test('(4) ↺ and ✓ stay: the bar’s own draft controls are drawn on every page, exactly as on the home', () => {
  const top = bar(read(SHELL));
  const slot = top.indexOf('{applySlot ? (');
  assert.ok(slot > top.indexOf('<StudioPageHead'), 'anti-vacuity: the draft controls were not found after the head');
  const drawn = top.slice(slot, slot + 260);
  assert.match(drawn, /\{applySlot \? \(\s*<div className="contents" data-maker-apply-slot="">\s*\{applySlot\}\s*<\/div>\s*\) : \(/, '↺ ✓ are no longer the bar’s own, on every page');
  assert.doesNotMatch(drawn, /studioTile|studioFull|studioOn/, '↺ ✓ are dropped (or changed) inside a Studio page');
});

test('(5) the chooser: the Maker’s one sheet, the dropdown’s own rows — exactly this event’s pages, the current one ticked, no "All pages"', async () => {
  const { studioChooserOptions } = await import(`../${PARTS}`);
  const opts = studioChooserOptions(tiles) as Array<{ key: string; label: string; hint?: string; icon?: unknown; trail?: unknown }>;
  assert.deepEqual(opts.map((o) => o.key), [...STUDIO_TILE_KEYS], 'the chooser is not exactly the home’s pages (a page is missing, out of order — or an extra row is back)');
  assert.ok(!opts.some((o) => /all pages/i.test(o.label)), '"All pages" is back in the chooser');
  for (const [i, t] of tiles.entries()) {
    assert.equal(opts[i]!.label, t.label);
    assert.equal(opts[i]!.hint, t.status);
    assert.ok(opts[i]!.icon, `${t.key} has no mark`);
  }
  const trail = (k: string) => opts.find((o) => o.key === k)!.trail;
  assert.deepEqual(trail('info'), { text: '✓', tone: 'ok', label: 'Ready' });
  assert.deepEqual(trail('logo'), { text: 'Missing', tone: 'left' });
  assert.equal(trail('rsvp'), undefined, 'a page nobody measured is marked');
  assert.deepEqual(studioChooserOptions(tiles.filter((t) => t.key !== 'story' && t.key !== 'march')).map((o: { key: string }) => o.key), ['info', 'look', 'logo', 'mood', 'schedule', 'seats', 'gifts', 'rsvp', 'prints']);
  const src = read(PARTS);
  assert.doesNotMatch(src, /STUDIO_TILE_KEYS|STUDIO_TILES\b/, 'the chooser keeps a second list of the pages');
  const name = src.slice(src.indexOf('function StudioPageName('), src.indexOf('function tileOption('));
  assert.ok(src.indexOf('function tileOption(') > src.indexOf('function StudioPageName('), 'anti-vacuity: the name button’s end was not found');
  assert.ok(name.length > 800, 'anti-vacuity: the name button was not found');
  // The pop-up rule: the Maker's ONE sheet (dark, blurred, nothing behind works), over everything.
  assert.match(name, /createPortal\(\s*<MakerSheet label="Studio pages" onClose=\{close\}>/);
  // The dropdown's own looks — never a second look for a list of choices.
  for (const fn of ['pickButtonClass(false)', 'pickArrowClass(open)', 'pickOptionClass(Boolean(o.hint), here)', 'pickTickClass(false, Boolean(o.trail))', 'pickTrailClass(o.trail.tone, false)']) assert.ok(name.includes(fn), `the chooser does not wear the dropdown’s ${fn}`);
  assert.match(name, /\{studioChooserOptions\(tiles\)\.map\(\(o\) => \{\s*const here = o\.key === tile\.key;/);
  assert.match(name, /role="option"\s*aria-selected=\{here\}/, 'the current page is not the one ticked');
  assert.match(name, /useOneOpen\(open, setOpen\);/);
});

test('(6) it costs nothing: a pick is `openStudio`, ‹ is the home — no request, no render of the Maker', () => {
  const src = read(PARTS);
  const head = src.slice(src.indexOf('export function StudioPageHead('), src.indexOf('function tileOption('));
  assert.ok(head.length > 1200, 'anti-vacuity: the head was not found');
  assert.match(head, /data-bar-item="Back to Studio" onClick=\{onBack\}/, '‹ does not go back');
  assert.match(head, /onClick=\{\(\) => \{\s*close\(\);\s*if \(!here\) onOpen\(o\.key as StudioTileKey\);\s*\}\}/, 'a pick does not open its page (or re-opens the one you are on)');
  assert.doesNotMatch(head, /fetch\(|router|useRouter|refresh|makerSave|revalidate|href=|location\./, 'the head asks the server, or renders the Maker');
  const shell = read(SHELL);
  // ‹ is the same call the Studio pill made: it always lands on the home.
  assert.match(shell, /if \(next === 'studio'\) setStudioAt\('home'\);/);
  const open = shell.slice(shell.indexOf('const openStudio = ('), shell.indexOf('useEffect(', shell.indexOf('const openStudio = (')));
  assert.ok(open.length > 200, 'anti-vacuity: openStudio was not found');
  assert.doesNotMatch(open, /fetch\(|router\.refresh|requestMakerRefresh|makerSave/, 'opening a Studio page asks for a render');
});

test('(7) the lab’s save stand-in is handed only by the lab — Info’s draft door is the real action everywhere else', () => {
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

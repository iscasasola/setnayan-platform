/**
 * studio-pages-have-no-title-row.test.ts — WHERE YOU ARE IS SAID IN THE TOP BAR'S PILL. BOTH HALVES ARE DROPDOWNS. NO ROW.
 *
 * Owner, 2026-10-08, in order. On the "INFO ▾" pill row under the top bar: *"we will not have these."* With the row
 * gone: *"removing the header actually made me not know where we are at.. how can we identify it without adding a
 * row?"* → *"make the top nav show where we are at"*. Then *"what if we just replace the Studio with a chevron? since
 * that is a drop down"* · *"and we just change that name of the studio"*. On the prototype of that
 * (`public/review/studio-head-prototype.html`): *"studio is not showing drop down"* · *"Stages and Studio both has
 * dropdown"* · *"keep selector always balanced in width no matter what is pressed?"*. On the chooser: *"pop up looks
 * good. remove the all pages."*
 *
 *     in a stage          [ ✕ ]  [ Invitation ▾ | Studio ▾ ]      [ ↺ ] [ ✓ ]
 *     in a Studio page    [ ✕ ]  [ Stages ▾ | Love Story ▾ ]      [ ↺ ] [ ✓ ]
 *
 *   (1) NO ROW IS ADDED — the shell draws nothing over a Studio page (no title row, no ✓ Done band, no offset), on all
 *       eleven pages, and the bar is never hidden.
 *   (2) IN A STUDIO PAGE, PAINTED FOR ALL ELEVEN — "Stages ▾" (the plain word) and the page's FULL name ▾ as the
 *       picked half, each named for what a tap does; two ▾, no mark; the two halves the same width; a name never
 *       truncates or wraps — it tightens, then writes its short name.
 *   (3) IN A STAGE, PAINTED FOR ALL FIVE — the stage's name ▾ as the picked half and "Studio ▾" (the plain word).
 *       The list of stages is the Stages panel's OWN list and sheet (`StageItemMenu`), drawn with no button — one
 *       list of the five stages, and the stage on screen is HERE only on the Stages side.
 *   (4) A ▾ OPENS ITS LIST AND NEVER CHANGES SIDE — only a pick does. The left control is ✕ Exit everywhere (no ‹).
 *   (5) ↺ AND ✓ STAY — the bar's own draft controls, on every screen.
 *   (6) THE PAGE LIST — the Maker's one sheet with the dropdown's own rows: exactly this event's pages, in order,
 *       each with its mark, its line and Ready / Missing; the page on screen ticked only on the Studio side; no "All
 *       pages".
 *   (7) IT COSTS NOTHING — a page pick is the shell's `openStudio`, a stage pick its `pickPage` (after `pickSide`
 *       from the Studio side): state on the phone, no request, no render of the Maker.
 *   (8) THE LAB'S SAVE STAND-IN IS HANDED ONLY BY THE LAB.
 *
 * Mutations seen RED (2026-10-09), each restored: a ✓ Done band exported again → (1); the 52-px offset back → (1);
 * the bar hidden on a page → (1); a page's name given `truncate` → (2); a mark put inside the pill → (2); the page's
 * half no longer the picked one → (2); the plain half made only as wide as its word (`!flex-none`) → (2); the ▾ taken
 * off the plain half → (2); the stage half writing "Stages" instead of the stage → (3); a second list of stages
 * written for the bar → (3); the stage on screen ticked from the Studio side → (3); the bar's list drawing a second
 * stage button → (2)(3); a tap on the plain half changing side → (4); a stage picked from Studio not changing side →
 * (4); something drawn in ✕'s place inside a page → (4); ↺ ✓ dropped inside a page → (5); an "All pages" row put back
 * → (6); a page left out of the list → (6); the page ticked from the Stages side → (6); a dashboard file calling the
 * lab's seam → (8).
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

/** One half of a painted pill: its attributes, its class, its words' class, its words. */
function halfOf(html: string, kind: 'stage' | 'page') {
  const m = new RegExp(`<button type="button" aria-pressed="(true|false)" aria-haspopup="dialog" aria-expanded="false" aria-label="([^"]*)" data-seg="(stages|studio)" data-studio-half="${kind}" class="([^"]*)"><span data-studio-half-words="" class="([^"]*)">([^<]*)</span><svg[^>]*lucide-chevron-down[^>]*>[\\s\\S]*?</svg></button>`).exec(html);
  assert.ok(m, `the ${kind} half is not: a button that says whether it is picked, opens a list, is named, and paints words · ▾\n${html}`);
  return { on: m[1] === 'true', label: m[2]!, seg: m[3]!, cls: m[4]!.split(' '), wordsCls: m[5]!, words: m[6]! };
}
/** The two halves are the same width: both take an equal share (`flex-1`), neither can be widened by its words. */
function sameWidth(a: string[], b: string[], who: string): void {
  for (const cls of [a, b]) {
    for (const c of ['flex-1', 'min-w-0', '!px-[3px]', '!gap-0.5']) assert.ok(cls.includes(c), `${who}: a half lost ${c}`);
    assert.ok(!cls.some((c) => /flex-none|shrink-0|basis-|grow-0|^!?w-|^!?min-w-\[|^!?max-w-/.test(c)), `${who}: a half has a width of its own — the two are no longer equal`);
  }
  const room = (cls: string[]) => cls.filter((c) => /px-|gap-|flex|min-w|text-\[|group-has/.test(c)).sort().join(' ');
  assert.equal(room(a), room(b), `${who}: the two halves do not have the same room`);
}

test('(2) in a Studio page, painted for all eleven: "Stages ▾" plain, the page’s full name ▾ picked — equal halves, never truncated, no mark', async () => {
  const { StudioSideSwitch, studioHalfSteps, studioHalfLabel } = await import(`../${PARTS}`);
  assert.equal(tiles.length, 11);
  for (const page of tiles) {
    const html = await paint(h(StudioSideSwitch, { side: 'studio', onPick: () => {}, stage: 'details', options: [], onStage: () => {}, page, tiles, onOpen: () => {} }));
    const stages = halfOf(html, 'stage');
    const studio = halfOf(html, 'page');
    // The other side: its plain word, not picked — and still a dropdown.
    assert.deepEqual([stages.on, stages.words, stages.label, stages.seg], [false, 'Stages', 'Stages — choose a stage', 'stages'], `${page.key}: the Stages half`);
    // THE CLAIM: the half you are on names where you are — the picked segment, with its ▾.
    assert.deepEqual([studio.on, studio.words, studio.label, studio.seg], [true, page.label.replace(/&/g, '&amp;'), `Studio page: ${page.label.replace(/&/g, '&amp;')} — choose a page`, 'studio'], `${page.key}: the Studio half does not name its page as the picked half`);
    // Two halves, two ▾, and no mark inside the pill.
    assert.equal(count(html, /<button/g), 2);
    assert.equal(count(html, /<svg/g), 2, `${page.key}: a mark is drawn inside the pill, or a half lost its ▾`);
    assert.equal(count(html, /lucide-chevron-down/g), 2);
    // A name is never cut or wrapped.
    for (const w of [stages.wordsCls, studio.wordsCls]) {
      assert.match(w, /whitespace-nowrap/);
      assert.doesNotMatch(w, /truncate|ellipsis|line-clamp|break-/, `${page.key}: a name can be cut`);
    }
    // One colour, one thumb: the picked half wears the segment's own picked look; the other does not.
    assert.ok(studio.cls.includes('bg-sn-accent') && studio.cls.includes('text-sn-on-accent'));
    assert.ok(!stages.cls.includes('bg-sn-accent'));
    sameWidth(stages.cls, studio.cls, page.key);
    assert.equal(studioHalfLabel('page', page.label), `Studio page: ${page.label} — choose a page`);
  }
  assert.equal(studioHalfLabel('page', null), 'Studio pages — choose a page');
  // How a name steps down when it does not fit: tighter first — a word is shortened only after that; never cut.
  const mood = tiles.find((t) => t.key === 'mood')!;
  assert.deepEqual(studioHalfSteps(mood.label, mood.short, 'Studio'), [
    { words: 'Mood Board & Dress Code', tight: false },
    { words: 'Mood Board & Dress Code', tight: true },
    { words: 'Mood Board', tight: false },
    { words: 'Mood Board', tight: true },
    { words: 'Studio', tight: false },
  ]);
  assert.deepEqual(studioHalfSteps('Info', 'Info', 'Studio'), [{ words: 'Info', tight: false }, { words: 'Info', tight: true }, { words: 'Studio', tight: false }]);
  assert.deepEqual(tiles.filter((t) => t.short !== t.label).map((t) => [t.label, t.short]), [['Mood Board & Dress Code', 'Mood Board'], ['Wedding March', 'March']], 'a third page has a short name (or one of the two lost its own)');
  // Measured before paint; another name in the half starts from its full name again; a resize measures again.
  const src = read(PARTS);
  assert.match(src, /if \(!el \|\| el\.scrollWidth <= el\.clientWidth \|\| step >= steps\.length - 1\) return;\s*setAt\(\(a\) => \(\{ of, step: step \+ 1, tried: a\.tried \}\)\);/);
  assert.match(src, /const step = at\.of === of \? Math\.min\(at\.step, steps\.length - 1\) : 0;/);
  assert.match(src, /const again = \(\) => setAt\(\(a\) => \(\{ of: a\.of, step: 0, tried: a\.tried \+ 1 \}\)\);\s*window\.addEventListener\('resize', again\);/);
  // Both halves tighten TOGETHER (the track is asked), so the two never look different.
  assert.match(src, /'min-w-0 !gap-0\.5 !px-\[3px\] group-has-\[\[data-studio-half-tight\]\]\/seg:!px-0\.5 group-has-\[\[data-studio-half-tight\]\]\/seg:!text-\[12px\]'/);
  assert.match(src, /data-studio-half-tight=\{now\.tight \? '' : undefined\}/);
  // The pill fills its place in the bar, edge to edge — the room the names are measured in.
  assert.match(read(SHELL), /<div data-maker-tool="side" data-bar-item="Stages or Studio" data-bar-fill="" className=\{`flex min-w-0 flex-1 lg:hidden \$\{MAKER_BAR_PHONE\.side\}`\}>/);
});

test('(3) in a stage, painted for all five: the stage’s name ▾ picked, "Studio ▾" plain — and the list of stages is the Stages panel’s own', async () => {
  const { StudioSideSwitch, studioHalfSteps, studioHalfLabel } = await import(`../${PARTS}`);
  const { MAKER_STAGE_KEYS } = await import('./maker-parts');
  const { makerStageLabel } = await import(`../${L}/maker-bar`);
  assert.equal(MAKER_STAGE_KEYS.length, 5, 'anti-vacuity: the five stages were not found');
  const names: string[] = [];
  for (const key of MAKER_STAGE_KEYS) {
    const name = makerStageLabel(key as never) as string;
    names.push(name);
    const html = await paint(h(StudioSideSwitch, { side: 'stages', onPick: () => {}, stage: key, options: [], onStage: () => {}, page: null, tiles, onOpen: () => {} }));
    const stages = halfOf(html, 'stage');
    const studio = halfOf(html, 'page');
    assert.deepEqual([stages.on, stages.words, stages.label, stages.seg], [true, name, `Stage: ${name} — choose a stage`, 'stages'], `${key}: the Stages half does not name the stage as the picked half`);
    assert.deepEqual([studio.on, studio.words, studio.label, studio.seg], [false, 'Studio', 'Studio pages — choose a page', 'studio'], `${key}: the Studio half`);
    assert.equal(count(html, /<button/g), 2);
    assert.equal(count(html, /<svg/g), 2);
    assert.ok(stages.cls.includes('bg-sn-accent') && !studio.cls.includes('bg-sn-accent'));
    sameWidth(stages.cls, studio.cls, key);
    // A stage has no short name: it tightens, and only a screen narrower than any phone falls to the plain word.
    assert.deepEqual(studioHalfSteps(name, undefined, 'Stages'), [{ words: name, tight: false }, { words: name, tight: true }, { words: 'Stages', tight: false }]);
  }
  assert.deepEqual(names, ['Save the Date', 'RSVP', 'Invitation', 'The Day', 'Post Event']);
  assert.equal(studioHalfLabel('stage', null), 'Stages — choose a stage');
  // THE CLAIM — ONE list of the five stages: the bar draws the Stages panel's own `StageItemMenu` (its list, its
  // sheet), with no button; nothing here lists a stage.
  const src = read(PARTS);
  assert.match(src, /<StageItemMenu\s+bar=\{\{ open: list === 'stages', onClose: \(\) => shut\('stages'\), here: onStages \}\}\s+options=\{options\}/, 'the bar does not draw the Stages panel’s own list');
  assert.equal(count(src, /<StageItemMenu\b/g), 1);
  assert.doesNotMatch(src, /MAKER_STAGE_KEYS\.(?:map|forEach|filter)|PUBLIC_STAGE_LABELS|MAKER_PAGE_STAGES/, 'a second list of the stages is written for the top bar');
  const menu = read(`${L}/stage-item-menu.tsx`);
  assert.equal(count(menu, /\{MAKER_STAGE_KEYS\.map\(\(s\) => \{/g), 1);
  assert.match(menu, /const open = bar \? bar\.open : own;/);
  assert.match(menu, /\{bar \? null : \(\s*<button\s+type="button"\s+aria-haspopup="dialog"\s+aria-expanded=\{open\}\s+data-stage-item-menu=""/, 'the bar’s list draws a second stage button');
  // HERE ✓ only on the side you are on: from Studio no stage is "here".
  assert.match(menu, /const on = s === stage && \(bar\?\.here \?\? true\);/, 'the stage is ticked in the list opened from the Studio side');
  // The shell hands the bar what the panel is handed: its pick, its pages, its own page door.
  assert.match(read(SHELL), /<StudioSideSwitch side=\{side\} onPick=\{pickSide\} stage=\{ltPick\} options=\{page\.options\} onStage=\{pickPage\} page=\{studioTile\} tiles=\{studio\?\.tiles\} onOpen=\{openStudio\} \/>/);
});

test('(4) a ▾ opens its list and never changes side — only a pick does; the left control is ✕ Exit everywhere', async () => {
  const src = read(PARTS);
  const sw = src.slice(src.indexOf('export function StudioSideSwitch('), src.indexOf('const HALF_ROOM ='));
  const half = src.slice(src.indexOf('function StudioHalf('), src.indexOf('function tileOption('));
  assert.ok(sw.length > 3000 && half.length > 1200, 'anti-vacuity: the pill or its half was not found');
  // Each half's tap opens (or shuts) ITS list — on whichever side you are.
  assert.match(sw, /kind="stage"\s+on=\{onStages\}[\s\S]*?expanded=\{list === 'stages'\}\s+onPress=\{\(\) => setList\(\(l\) => \(l === 'stages' \? null : 'stages'\)\)\}/);
  assert.match(sw, /kind="page" on=\{!onStages\}[^\n]*expanded=\{list === 'pages'\} onPress=\{\(\) => setList\(\(l\) => \(l === 'pages' \? null : 'pages'\)\)\}/);
  assert.match(half, /aria-pressed=\{on\}\s+aria-haspopup="dialog"\s+aria-expanded=\{expanded\}\s+aria-label=\{studioHalfLabel\(kind, name\)\}[\s\S]*?onClick=\{onPress\}/);
  assert.doesNotMatch(half, /onPick|onOpen|onStage/, 'a half changes side or opens a page by itself');
  // The side changes in ONE place: a stage picked from the Studio side.
  assert.equal(count(sw, /\bonPick\(/g), 1, 'the side is changed somewhere other than a stage picked from Studio');
  assert.match(sw, /onPick=\{\(key\) => \{\s*if \(!onStages\) onPick\('stages'\);\s*onStage\?\.\(key\);\s*\}\}/, 'a stage picked from the Studio side does not take you to the Stages side');
  // One list open at a time, and each closes only itself.
  assert.match(sw, /const shut = \(which: 'stages' \| 'pages'\) => setList\(\(l\) => \(l === which \? null : l\)\);\s*useOneOpen\(list === 'pages', \(\) => shut\('pages'\)\);/);
  // The Studio side with no page open (the home of cards, which nothing in the bar leads to): still two dropdowns.
  const { StudioSideSwitch } = await import(`../${PARTS}`);
  const home = await paint(h(StudioSideSwitch, { side: 'studio', onPick: () => {}, stage: 'rsvp', page: null, tiles, onOpen: () => {} }));
  assert.deepEqual([halfOf(home, 'stage').words, halfOf(home, 'stage').on, halfOf(home, 'page').words, halfOf(home, 'page').on, halfOf(home, 'page').label], ['Stages', false, 'Studio', true, 'Studio pages — choose a page']);
  // ✕ Exit, everywhere: no ‹, and nothing in the bar is drawn instead of it.
  const parts = (await import(`../${PARTS}`)) as Record<string, unknown>;
  assert.equal(parts.StudioBack, undefined, '‹ is exported again');
  assert.equal(parts.StudioPageHead, undefined);
  const top = bar(read(SHELL));
  assert.equal(count(top, /aria-label="Exit"/g), 1);
  assert.doesNotMatch(top, /StudioBack|Back to Studio|\{studio(?:Tile|On|Full|HomeOn) \? \(/, 'inside a Studio page something else stands in ✕’s place');
  assert.equal(count(top, /<StudioSideSwitch\b/g), 1);
  assert.match(top, /\{stagesStudio \? \(/);
});

test('(5) ↺ and ✓ stay: the bar’s own draft controls are drawn on every screen, the same', () => {
  const top = bar(read(SHELL));
  const slot = top.indexOf('{applySlot ? (');
  assert.ok(slot > top.indexOf('<StudioSideSwitch'), 'anti-vacuity: the draft controls were not found after the pill');
  const drawn = top.slice(slot, slot + 260);
  assert.match(drawn, /\{applySlot \? \(\s*<div className="contents" data-maker-apply-slot="">\s*\{applySlot\}\s*<\/div>\s*\) : \(/, '↺ ✓ are no longer the bar’s own, on every page');
  assert.doesNotMatch(drawn, /studioTile|studioFull|studioOn/, '↺ ✓ are dropped (or changed) inside a Studio page');
});

test('(6) the page list: the Maker’s one sheet, the dropdown’s own rows — exactly this event’s pages; the page on screen ticked only on the Studio side; no "All pages"', async () => {
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
  const name = src.slice(src.indexOf('export function StudioSideSwitch('), src.indexOf('const HALF_ROOM ='));
  assert.ok(name.length > 3000, 'anti-vacuity: the pill was not found');
  // The pop-up rule: the Maker's ONE sheet (dark, blurred, nothing behind works), over everything.
  assert.match(name, /createPortal\(\s*<MakerSheet label="Studio pages" onClose=\{\(\) => shut\('pages'\)\}>/);
  // The dropdown's own looks — never a second look for a list of choices.
  for (const fn of ['pickOptionClass(Boolean(o.hint), on)', 'pickTickClass(false, Boolean(o.trail))', 'pickTrailClass(o.trail.tone, false)']) assert.ok(name.includes(fn), `the list does not wear the dropdown’s ${fn}`);
  // Ticked only in the list of the side you are on: from the Stages side no page is "here".
  assert.match(name, /const here = !onStages && page \? page : null;/, 'a page is ticked in the list opened from the Stages side');
  assert.match(name, /\{studioChooserOptions\(tiles\)\.map\(\(o\) => \{\s*const on = o\.key === here\?\.key;/);
  assert.match(name, /role="option"\s*aria-selected=\{on\}/, 'the page on screen is not the one ticked');
  assert.match(name, /\{on \? \(\s*<span aria-hidden data-pick-tick=""/);
});

test('(7) it costs nothing: a page pick is `openStudio`, a stage pick is `pickPage` — no request, no render of the Maker', () => {
  const src = read(PARTS);
  const pill = src.slice(src.indexOf('export function StudioSideSwitch('), src.indexOf('function tileOption('));
  assert.ok(pill.length > 4000, 'anti-vacuity: the pill was not found');
  assert.match(pill, /onClick=\{\(\) => \{\s*shut\('pages'\);\s*if \(!on\) onOpen\?\.\(o\.key as StudioTileKey\);\s*\}\}/, 'a pick does not open its page (or re-opens the one you are on)');
  assert.doesNotMatch(pill, /fetch\(|router|useRouter|refresh|makerSave|revalidate|href=|location\./, 'the pill asks the server, or renders the Maker');
  const shell = read(SHELL);
  // `openStudio` (it changes side itself) and `pickPage` are state on the phone only.
  for (const fn of ['const openStudio = (', 'const pickPage = (']) {
    const body = shell.slice(shell.indexOf(fn), shell.indexOf('\n  };', shell.indexOf(fn)));
    assert.ok(body.length > 200, `anti-vacuity: ${fn} was not found`);
    assert.doesNotMatch(body, /fetch\(|router\.refresh|requestMakerRefresh|makerSave/, `${fn} asks for a render`);
  }
  const open = shell.slice(shell.indexOf('const openStudio = ('), shell.indexOf('\n  };', shell.indexOf('const openStudio = (')));
  assert.match(open, /setSide\('studio'\);\s*setStudioAt\(key\);/, 'a page picked from the Stages side does not take you to Studio');
});

test('(8) the lab’s save stand-in is handed only by the lab — Info’s draft door is the real action everywhere else', () => {
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

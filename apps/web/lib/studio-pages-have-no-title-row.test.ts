/**
 * studio-pages-have-no-title-row.test.ts — WHERE YOU ARE IS SAID IN THE TOP BAR'S PILL. ONE PILL. NO ROW.
 *
 * Owner, 2026-10-08, in order. On the "INFO ▾" pill row under the top bar: *"we will not have these."* With the row
 * gone: *"make the top nav show where we are at"*. Then (2026-10-08) the bar was two dropdown halves, Stages | Studio.
 * 🔁 UPDATED ON PURPOSE 2026-11-10 (Build 6 Lane F — owner: *"Studio technically is gone since the pages there will be
 * inside the different scenes it covers"*; frame 8 pick B: *"Prints is a row in ⚙ Your Event Hub and the Studio half of
 * the switch goes"*; approved prototype `event_hub_stages_scenes_2026-11-10` M1):
 *
 *     on a stage                   [ ● Invitation ▾ ]   [ ↺ ] [ ✓ ] [ ⚙ ]
 *     in an editor a scene opened  [ Logo ▾ ]           [ ↺ ] [ ✓ ] [ ⚙ ]
 *
 *   (1) NO ROW IS ADDED — the shell draws nothing over an editor (no title row, no ✓ Done band, no offset), the bar is
 *       never hidden, and there is no Studio home of cards over the work area.
 *   (2) IN AN EDITOR, PAINTED FOR EVERY ONE — ONE pill naming the editor, picked, with its ▾; never cut, never wrapped —
 *       it tightens, then writes its short name; a tap is the list of stages (its name says so).
 *   (3) ON A STAGE, PAINTED FOR ALL FIVE — the stage's name ▾; ● only while guests meet that stage. The list of stages
 *       is the Stages panel's OWN list and sheet (`StageItemMenu`), drawn with no button.
 *   (4) A ▾ OPENS THE LIST — only a pick moves; from an editor a pick goes back to the stages. No ✕, nothing in its place.
 *   (5) ↺ AND ✓ STAY — the bar's own draft controls, on every screen.
 *   (6) NO STUDIO ▾ — no list of Studio pages, no "n of N ready", no Studio sheet row to the ⚙ (the ⚙ is the pinned
 *       row's own); the Maker's door words never send anyone to "Studio".
 *   (7) IT COSTS NOTHING — a stage pick is `pickPage` (after `pickSide('stages')` from an editor): state on the phone,
 *       no request, no render of the Maker.
 *   (8) THE LAB'S SAVE STAND-IN IS HANDED ONLY BY THE LAB.
 *
 * Mutations seen RED (2026-11-10), each restored: `truncate` on the pill's words → (2) · the ● drawn on a stage guests
 * do not meet → (3) · a pick from an editor no longer calling `onPick('stages')` → (4) · `<StudioCover` drawn again → (1).
 * (A second half put back is `lib/studio-is-gone-from-the-maker-bar.test.ts`'s, seen red there.)
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
  done: key === 'logo' ? false : key === 'gifts' ? undefined : true,
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
  // No Studio home over the work area (Build 6 Lane F): nothing draws the cards, and nothing can be put on it.
  assert.doesNotMatch(shell, /<StudioCover\b|studioHomeOn/, 'the Studio home of cards is drawn over the work area again');
  assert.equal(((await import(`../${PARTS}`)) as Record<string, unknown>).StudioCover, undefined, 'the Studio home is exported again');
  const css = studioFullScreenCss();
  /* 52 px under the shell's top (its bar), to the app's bottom nav — the shell's own room since the Hub keeps the app's nav. */
  assert.ok(css.includes('{--maker-lt-h:calc(100dvh - var(--maker-app-top,var(--fd-bar,0px)) - var(--maker-nav,0px) - 44px)}'), 'a form page still leaves room for a row (52 px of nothing), or reaches over the Maker’s bar');
  assert.doesNotMatch(css, /100dvh - 96px/);
  assert.ok(css.includes('div:has(> [data-details-form-field]){padding-top:0}'), 'a strip of empty page is left over the form');
  const parts = (await import(`../${PARTS}`)) as Record<string, unknown>;
  assert.equal(parts.StudioToolRow, undefined);
  assert.equal(parts.StudioDoneBar, undefined, 'the ✓ Done band is exported again');
});

/** The painted pill: its attributes, its class, its words' class, its words — and whether it wears the live ●. */
function pillOf(html: string) {
  const m = /<button type="button" aria-pressed="true" aria-haspopup="dialog" aria-expanded="false" aria-label="([^"]*)" data-seg="stages" data-studio-half="(stage|page)" class="([^"]*)">(<span aria-hidden="true" data-stage-pill-live=""[^>]*><\/span>)?<span data-studio-half-words="" class="([^"]*)">([^<]*)<\/span><svg[^>]*lucide-chevron-down[^>]*>[\s\S]*?<\/svg><\/button>/.exec(html);
  assert.ok(m, `the pill is not: a picked button that opens a list, is named, and paints (●) words · ▾\n${html}`);
  return { label: m[1]!, kind: m[2]!, cls: m[3]!.split(' '), live: Boolean(m[4]), wordsCls: m[5]!, words: m[6]! };
}
function oneWhole(html: string, who: string): void {
  assert.equal(count(html, /<button/g), 1, `${who}: the bar draws more than one pill — the Studio half is back`);
  assert.equal(count(html, /data-studio-half=/g), 1, `${who}: a second half is drawn`);
  assert.equal(count(html, /lucide-chevron-down/g), 1);
}
const fit = (cls: string[], who: string) => {
  for (const c of ['flex-1', 'min-w-0', '!px-[3px]', '!gap-0.5', 'bg-sn-accent', 'text-sn-on-accent']) assert.ok(cls.includes(c), `${who}: the pill lost ${c}`);
  assert.ok(!cls.some((c) => /flex-none|shrink-0|basis-|grow-0|^!?w-|^!?min-w-\[|^!?max-w-/.test(c)), `${who}: the pill has a width of its own — it no longer fills its place`);
};

test('(2) in an editor, painted for every one: ONE pill naming the editor, picked, with its ▾ — never cut; a tap is the list of stages', async () => {
  const { MakerStageSwitch, studioHalfSteps, stagePillLabel } = await import(`../${PARTS}`);
  for (const page of tiles) {
    const html = await paint(h(MakerStageSwitch, { side: 'studio', onPick: () => {}, stage: 'details', options: [], onStage: () => {}, page }));
    const p = pillOf(html);
    const name = page.label.replace(/&/g, '&amp;');
    assert.deepEqual([p.kind, p.words, p.label, p.live], ['page', name, `${name} — choose a stage to go back`, false], `${page.key}: the pill does not name the editor`);
    oneWhole(html, page.key);
    assert.match(p.wordsCls, /whitespace-nowrap/);
    assert.doesNotMatch(p.wordsCls, /truncate|ellipsis|line-clamp|break-/, `${page.key}: a name can be cut`);
    fit(p.cls, page.key);
    assert.equal(stagePillLabel('page', page.label), `${page.label} — choose a stage to go back`);
  }
  // How a name steps down when it does not fit: tighter first — a word is shortened only after that; never cut.
  const mood = tiles.find((t) => t.key === 'mood')!;
  assert.deepEqual(studioHalfSteps(mood.label, mood.short, 'Stages'), [
    { words: 'Palette + Dress Code', tight: false },
    { words: 'Palette + Dress Code', tight: true },
    { words: 'Palette', tight: false },
    { words: 'Palette', tight: true },
    { words: 'Stages', tight: false },
  ]);
  const src = read(PARTS);
  assert.match(src, /if \(!el \|\| el\.scrollWidth <= el\.clientWidth \|\| step >= steps\.length - 1\) return;\s*setAt\(\(a\) => \(\{ of, step: step \+ 1, tried: a\.tried \}\)\);/);
  assert.match(src, /const again = \(\) => setAt\(\(a\) => \(\{ of: a\.of, step: 0, tried: a\.tried \+ 1 \}\)\);\s*window\.addEventListener\('resize', again\);/);
  assert.match(src, /data-studio-half-tight=\{now\.tight \? '' : undefined\}/);
  // The pill fills its place in the bar, edge to edge — the room the name is measured in.
  assert.match(read(SHELL), /<div data-maker-tool="side" data-bar-item="Stages or Studio" data-bar-fill="" className=\{`flex min-w-0 flex-1 \$\{MAKER_BAR_PHONE\.side\}`\}>/);
});

test('(3) on a stage, painted for all five: the stage’s name ▾, ● only while guests meet it — and the list is the Stages panel’s own', async () => {
  const { MakerStageSwitch, studioHalfSteps, stagePillLabel } = await import(`../${PARTS}`);
  const { MAKER_STAGE_KEYS } = await import('./maker-parts');
  const { makerStageLabel } = await import(`../${L}/maker-bar`);
  assert.equal(MAKER_STAGE_KEYS.length, 5, 'anti-vacuity: the five stages were not found');
  const names: string[] = [];
  for (const key of MAKER_STAGE_KEYS) {
    const name = makerStageLabel(key as never) as string;
    names.push(name);
    for (const live of [false, true]) {
      const html = await paint(h(MakerStageSwitch, { side: 'stages', onPick: () => {}, stage: key, live, options: [], onStage: () => {}, page: null }));
      const p = pillOf(html);
      assert.deepEqual([p.kind, p.words, p.label, p.live], ['stage', name, `Stage: ${name} — choose a stage`, live], `${key} (live ${live}): the pill`);
      oneWhole(html, key);
      fit(p.cls, key);
    }
    assert.deepEqual(studioHalfSteps(name, undefined, 'Stages'), [{ words: name, tight: false }, { words: name, tight: true }, { words: 'Stages', tight: false }]);
  }
  assert.deepEqual(names, ['Save the Date', 'RSVP', 'Invitation', 'The Day', 'Post Event']);
  assert.equal(stagePillLabel('stage', null), 'Stages — choose a stage');
  // ● is the stage guests meet — the shell asks the Maker's own live stage, never the date.
  assert.match(read(SHELL), /<MakerStageSwitch side=\{side\} onPick=\{pickSide\} stage=\{ltPick\} options=\{page\.options\} onStage=\{pickPage\} page=\{studioTile\} live=\{ltPick === liveStage\} \/>/);
  // ONE list of the stages: the bar draws the Stages panel's own `StageItemMenu`, with no button.
  const src = read(PARTS);
  assert.match(src, /<StageItemMenu\s+bar=\{\{ open: list, onClose: \(\) => setList\(false\), here: onStages \}\}\s+options=\{options\}/, 'the bar does not draw the Stages panel’s own list');
  assert.equal(count(src, /<StageItemMenu\b/g), 1);
  assert.doesNotMatch(src, /MAKER_STAGE_KEYS\.(?:map|forEach|filter)|PUBLIC_STAGE_LABELS|MAKER_PAGE_STAGES/, 'a second list of the stages is written for the top bar');
  const menu = read(`${L}/stage-item-menu.tsx`);
  assert.match(menu, /\{bar \? null : \(\s*<button\s+type="button"\s+aria-haspopup="dialog"\s+aria-expanded=\{open\}\s+data-stage-item-menu=""/, 'the bar’s list draws a second stage button');
  assert.match(menu, /const on = s === stage && \(bar\?\.here \?\? true\);/, 'a stage is ticked in the list opened from an editor');
});

test('(4) a ▾ opens the list — only a pick moves; from an editor a pick goes back to the stages; no ✕', async () => {
  const src = read(PARTS);
  const sw = src.slice(src.indexOf('export function MakerStageSwitch('), src.indexOf('const HALF_ROOM ='));
  const half = src.slice(src.indexOf('function StudioHalf('), src.indexOf('function tileOption('));
  assert.ok(sw.length > 2500 && half.length > 1200, 'anti-vacuity: the pill or its half was not found');
  assert.match(sw, /expanded=\{list\}\s+onPress=\{\(\) => setList\(\(l\) => !l\)\}/);
  assert.match(half, /aria-pressed\s+aria-haspopup="dialog"\s+aria-expanded=\{expanded\}\s+aria-label=\{stagePillLabel\(kind, name\)\}[\s\S]*?onClick=\{onPress\}/);
  assert.doesNotMatch(half, /onPick|onOpen|onStage/, 'the pill moves by itself');
  assert.equal(count(sw, /\bonPick\(/g), 1, 'the side is changed somewhere other than a stage picked from an editor');
  assert.match(sw, /onPick=\{\(key\) => \{\s*if \(!onStages\) onPick\('stages'\);\s*onStage\?\.\(key\);\s*\}\}/, 'a stage picked from an editor does not go back to the stages');
  // The shell's side change goes one way only: back to the stages (there is no Studio home to go to).
  const shell = read(SHELL);
  const pick = shell.slice(shell.indexOf('const pickSide = ('), shell.indexOf('\n  };', shell.indexOf('const pickSide = (')));
  assert.match(pick, /if \(next !== 'stages'\) return;/, 'pickSide can take the Maker to a Studio home again');
  const parts = (await import(`../${PARTS}`)) as Record<string, unknown>;
  assert.equal(parts.StudioBack, undefined, '‹ is exported again');
  assert.equal(parts.StudioPageHead, undefined);
  const top = bar(shell);
  assert.equal(count(top, /aria-label="Exit"/g), 0, 'the ✕ Exit is back on the Hub’s pinned row');
  assert.doesNotMatch(top, /StudioBack|Back to Studio|\{studio(?:Tile|On|Full|HomeOn) \? \(/, 'inside an editor something else stands in ✕’s place');
  assert.equal(count(top, /<MakerStageSwitch\b/g), 1);
});

test('(5) ↺ and ✓ stay: the bar’s own draft controls are drawn on every screen, the same', () => {
  const top = bar(read(SHELL));
  const slot = top.indexOf('{applySlot ? (');
  assert.ok(slot > top.indexOf('<MakerStageSwitch'), 'anti-vacuity: the draft controls were not found after the pill');
  const drawn = top.slice(slot, slot + 260);
  assert.match(drawn, /\{applySlot \? \(\s*<div className="contents" data-maker-apply-slot="">\s*\{applySlot\}\s*<\/div>\s*\) : \(/, '↺ ✓ are no longer the bar’s own, on every page');
  assert.doesNotMatch(drawn, /studioTile|studioFull|studioOn/, '↺ ✓ are dropped (or changed) inside an editor');
});

test('(6) no Studio ▾: no list of Studio pages, no "n of N ready", no Studio row to the ⚙ — and no door word sends anyone to Studio', async () => {
  const src = read(PARTS);
  assert.doesNotMatch(src, /label="Studio pages"|studioChooserOptions|STUDIO_MENU_SETTINGS_LINE|data-studio-menu-settings|kind="page" on=|ready`\}/, 'the Studio pages list (or its ⚙ row, or its count) is drawn again');
  const parts = (await import(`../${PARTS}`)) as Record<string, unknown>;
  for (const gone of ['StudioSideSwitch', 'studioChooserOptions', 'STUDIO_MENU_SETTINGS_LINE', 'StudioCover', 'studioHalfLabel']) assert.equal(parts[gone], undefined, `${gone} is exported again`);
  const { MAKER_EDITOR_DOOR_WORDS, MAKER_STUDIO_TOOL_LABEL, makerPartQuietRow, makerPartSource, MAKER_PARTS } = await import('./maker-parts');
  for (const w of Object.values(MAKER_EDITOR_DOOR_WORDS)) assert.doesNotMatch(w, /Studio/, `the door “${w}” names Studio`);
  assert.deepEqual(Object.keys(MAKER_EDITOR_DOOR_WORDS).sort(), [...Object.keys(MAKER_STUDIO_TOOL_LABEL), 'info'].sort(), 'an editor has no door words');
  let doors = 0;
  for (const k of Object.keys(MAKER_PARTS) as Array<keyof typeof MAKER_PARTS>) {
    const src = makerPartSource(k);
    if (src.kind !== 'studio' && src.kind !== 'info') continue;
    doors += 1;
    assert.equal(makerPartQuietRow(k)?.words, MAKER_EDITOR_DOOR_WORDS[src.kind === 'studio' ? src.tool : 'info'], `${k}: its door`);
  }
  assert.ok(doors >= 5, `anti-vacuity: only ${doors} doors`);
});

test('(7) it costs nothing: a stage pick is `pickPage` — no request, no render of the Maker', () => {
  const src = read(PARTS);
  const pill = src.slice(src.indexOf('export function MakerStageSwitch('), src.indexOf('function tileOption('));
  assert.ok(pill.length > 3000, 'anti-vacuity: the pill was not found');
  assert.doesNotMatch(pill, /fetch\(|router|useRouter|refresh|makerSave|revalidate|href=|location\./, 'the pill asks the server, or renders the Maker');
  const shell = read(SHELL);
  for (const fn of ['const pickPage = (', 'const pickSide = (']) {
    const body = shell.slice(shell.indexOf(fn), shell.indexOf('\n  };', shell.indexOf(fn)));
    assert.ok(body.length > 100, `anti-vacuity: ${fn} was not found`);
    assert.doesNotMatch(body, /fetch\(|router\.refresh|requestMakerRefresh|makerSave/, `${fn} asks for a render`);
  }
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

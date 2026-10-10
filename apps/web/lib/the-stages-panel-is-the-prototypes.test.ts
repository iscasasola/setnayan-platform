/**
 * 🎨 THE STAGES PANEL IS THE PROTOTYPE'S (DECISION_LOG 2026-10-07 "THE STAGES PANEL IS
 * REDRAWN FROM THE PROTOTYPE…"; owner: *"the lower toolbar did not execute the designs
 * style we agreed on the prototype"* · *"should be a preview of the style and not text"*).
 * Every check here once failed in production while every behaviour test stayed green —
 * so each one pins what the couple SEES, behind `makerStagesStudioEnabled`:
 *
 *   1. A part tap never opens the shipped floating TypeBar: a FIRST tap on words picks
 *      the part (`makerStageMayType`), the work area takes the caret back BEFORE it would
 *      start typing, and the TypeBar under the flag is the keyboard's one bar — Done, and
 *      no Wording / Style / Hide.
 *   2. Stages never shows the retired guided picker (`data-stage-picker`): with the flag
 *      there is no guided plan, and every door into Event Details lands on Studio's home.
 *   3. Style › Look's layouts are REAL miniatures — each card carries a rendered preview,
 *      never a description line or a "Recommended" tag.
 *   4. The Reveal is locked first — no grip, no ＋ above, no 🗑; nothing drops above it.
 *   5. A scene of rows offers ONE Rows ▾ in Build in, and it writes the shipped `sequence`.
 *
 * (Every row ≥ 44 px is `the-stage-panel-fits-a-phone.test.ts`.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { makerStageMayType } from './maker-stage-type';
import { stripComments } from './strip-comments';
import { makerDropSlot, makerRevealEdges, makerSceneHasRows, makerStagePickedAttr } from './maker-parts';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const LAUNCH = 'app/dashboard/[eventId]/launch/_components';
const EDITOR = 'app/dashboard/[eventId]/website/editor/_components';

/* ── 1 · a part tap never opens the shipped TypeBar ──────────────────────── */

test('a tap on the page only selects — the first tap, a second tap on the picked part, the date, the place: none types', () => {
  /* 🔁 RE-AIMED 2026-10-09 (owner, verbatim: *"on preview screen, you only select. You can change the content there
     via edit"*, `TOOLBAR-SPEC-2026-10-09.md`). This held "typing is a SECOND tap on the picked part" (DECISION_LOG
     2026-10-07 rule 1) and asserted the picked part's words typed. The rule's two callers and what they hand it are
     unchanged; its ANSWER is now no for every part — the words are changed in the toolbar's Edit. The whole rule,
     over every part, is `lib/the-preview-only-selects.test.ts` (1). */
  const names = makerStagePickedAttr('names');
  assert.equal(names, 'f:hero|names');
  assert.equal(makerStageMayType(null, 'f:hero', 'names'), false, 'nothing picked: a tap only picks');
  assert.equal(makerStageMayType(makerStagePickedAttr('countdown'), 'f:hero', 'names'), false, 'another part picked: a tap only picks');
  assert.equal(makerStageMayType(names, 'f:hero', 'names'), false, 'the picked part: a second tap types on the page again');
  assert.equal(makerStageMayType(makerStagePickedAttr('date'), 'f:hero', 'date'), false, 'the date is Suppliers’ — never typed');
  assert.equal(makerStageMayType(makerStagePickedAttr('place'), 'f:hero', 'venue'), false, 'the place is Suppliers’ — never typed');
  assert.equal(makerStageMayType(makerStagePickedAttr('message'), 'w:special_message', 'body'), false, 'a scene’s words type on the page again');
});

test('the work area takes a first tap’s caret back BEFORE it starts the TypeBar', () => {
  const src = read(`${EDITOR}/editor-shell.tsx`);
  const read0 = src.indexOf('const start = readTypeStart(event.data, event.source, Date.now());');
  assert.ok(read0 > 0, 'the canvas’s type-start is read in editor-shell.tsx');
  const gate = src.indexOf('if (!makerStageMayType(picked, start.key, start.el))', read0);
  const firstStart = src.indexOf('setTypeStart(start)', read0);
  assert.ok(gate > read0 && firstStart > gate, 'the Stages gate runs before any setTypeStart(start)');
  const block = src.slice(gate, firstStart);
  assert.match(block, /t: 'typeStop'/, 'the caret is taken back from the canvas');
  assert.match(block, /MAKER_STAGE_PICK_EVENT/, 'the tap is handed to the panel as a pick');
  assert.match(block, /return;/, 'and the TypeBar is never started');
});

test('under the flag the TypeBar is the keyboard’s ONE bar: Done — no Wording, no Style, no Hide', () => {
  const src = read(`${EDITOR}/type-in-place.tsx`);
  const at = src.indexOf('if (stagesStudio && !p.inline');
  assert.ok(at > 0, 'the flag-on keyboard bar exists');
  const end = src.indexOf('document.body,\n    );\n  }', at);
  const bar = src.slice(at, end);
  assert.match(bar, /data-type-bar-keys/);
  assert.match(bar, /label="Done"/);
  for (const old of ['Wording', 'Style ▾', 'Hide', 'data-type-style', 'data-type-hide']) {
    assert.ok(!bar.includes(old), `the flag-on bar carries no "${old}"`);
  }
});

/* ── 2 · Stages never shows the guided picker ────────────────────────────── */

test('with the flag the guided flow has no plan — the stage picker cannot draw', () => {
  const src = read(`${LAUNCH}/details-workspace.tsx`);
  assert.match(src, /const plan = maker\?\.stagesStudio !== true && guide/, 'no plan under the flag');
  assert.match(src, /plan && at\?\.kind === 'stages' \? <StagePicker/, 'the picker draws only from a plan');
});

test('every door into Event Details lands on Studio’s home, never over the Stages page', () => {
  const src = read(`${LAUNCH}/maker-shell.tsx`);
  const at = src.indexOf("if (!ss || side !== 'stages' || selection?.kind !== 'tool' || selection.key !== 'details') return;");
  assert.ok(at > 0, 'the Stages side sends a Details selection away');
  const body = src.slice(at, at + 200);
  assert.match(body, /setSide\('studio'\)/);
  assert.match(body, /setStudioAt\('home'\)/);
  assert.match(body, /select\(null\)/);
});

/* ── 3 · Style › Look's layouts are real miniatures ──────────────────────── */

test('every layout card carries a rendered preview and only a short name — no description, no Recommended', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StyleCards } = await import(`../${LAUNCH}/stage-panel/style-carousel`);
  const html = renderToStaticMarkup(
    React.createElement(StyleCards, {
      options: [
        { id: 'four-tiles', name: 'Four tiles' },
        { id: 'big-number', name: 'Big number' },
        { id: 'calendar', name: 'The calendar' },
      ],
      value: 'four-tiles',
      onPick: () => {},
      pending: false,
      canvasKey: 'w:countdown',
      sceneType: 'countdown',
    }),
  );
  const cards = html.split('data-style-card="').slice(1);
  assert.equal(cards.length, 3, 'one card per shipped style');
  for (const c of cards) {
    assert.match(c, /data-style-preview=/, 'each card holds a preview element');
    assert.ok(!/Recommended|tile each|one line/.test(c), 'no description line, no Recommended tag');
  }
});

test('the preview is the SHIPPED guest page drawing that style — never a text card', () => {
  /* 2026-10-07 (the follow-ups, owner "1. all three together"): every card is the guest route itself,
     one part in one style (`?only=` + `?style=`), for EVERY part — no longer three hand-imported
     components and a dimmed copy for the rest. `lib/the-panel-follow-ups-are-real.test.ts` holds the route side. */
  const src = read(`${LAUNCH}/stage-panel/style-preview.tsx`);
  assert.match(src, /searchParams\.set\('style', `\$\{sceneType\}:\$\{styleId\}`\)/, 'the page is asked for that style');
  assert.match(src, /searchParams\.set\('only', canvasKey\)/, 'and for that part alone');
  assert.match(src, /<iframe/, 'a picture, not words');
  assert.doesNotMatch(src, /grayscale|opacity-40/, 'no style is shown as the current one, dimmed');
});

/* ── 4 · the Reveal is locked first ──────────────────────────────────────── */

test('picked, the Reveal shows no grip, no ＋ above and no 🗑 — its ＋ below stays; every other part keeps all four', () => {
  /* Owner 2026-10-07: "also remove the (+) under the highlight" — the Reveal has NO ＋ at all now. */
  assert.deepEqual(makerRevealEdges(true), { grip: false, addAbove: false, addBelow: false, remove: false });
  assert.deepEqual(makerRevealEdges(false), { grip: true, addAbove: true, addBelow: true, remove: true });
  const src = read(`${LAUNCH}/add-part-sheet.tsx`);
  assert.match(src, /const edgesOf = makerRevealEdges\(isReveal\);/);
  assert.match(src, /const canRemove = edgesOf\.remove &&/, '🗑 follows the lock');
  assert.match(src, /const canMove = edgesOf\.grip &&/, 'the grip follows the lock');
  assert.match(src, /\{edgesOf\.addAbove \? \(\s*<button type="button" aria-label=\{`Add above/, '＋ above follows the lock');
  assert.match(src, /\{edgesOf\.addBelow && onEdge\(fr!\.top \+ fr!\.height\) \? \(\s*<button type="button" aria-label=\{`Add below/, '＋ below follows the lock');
});

test('a drop at slot 0 on a page the Reveal leads lands at slot 1', () => {
  assert.equal(makerDropSlot(0, true), 1);
  assert.equal(makerDropSlot(3, true), 3);
  assert.equal(makerDropSlot(0, false), 0);
});

/* ── 5 · Rows ▾ in Build in writes the shipped `sequence` ────────────────── */

test('a scene of rows offers Rows ▾; a single block does not', () => {
  for (const t of ['schedule', 'our_love_story', 'venue_map', 'dress_code', 'what_to_bring']) assert.ok(makerSceneHasRows(t), `${t} is rows`);
  for (const t of ['countdown', 'special_message', 'greeting', 'hero']) assert.ok(!makerSceneHasRows(t), `${t} is one block`);
});

test('Rows ▾ writes the scene’s `sequence` — and Action carries no Parts row', () => {
  const src = read(`${EDITOR}/scene-animate-tab.tsx`);
  const at = src.indexOf('if (ss) {');
  const end = src.indexOf('return (\n    <div data-scene-tab="animate" aria-busy={pending}>', at);
  const ss = src.slice(at, end);
  assert.match(ss, /rows=\{\s*makerSceneHasRows\(widgetType\)/);
  assert.match(ss, /onPick: \(q\) => save\(\(c\) => \{ if \(q === 'auto'\) delete c\.sequence; else c\.sequence = q; \}\)/);
  const animate = read(`${LAUNCH}/stage-panel/stage-animate.tsx`);
  /* 🔁 RE-AIMED 2026-10-09 (Animate is four rows): the three phases are no longer three branches of one column —
     Rows ▾ is drawn in row 4 beside Movement, and only while the phase is Build in. Action still carries none. */
  const rowsDrawn = [...animate.matchAll(/\{([^{}]*?) \? <Dd stacked small="Rows"/g)].map((m) => m[1]);
  assert.deepEqual(rowsDrawn, ["end === 'in' && rows"], 'Rows ▾ is Build in’s, and only its');
  assert.ok(!/Parts/.test(animate), 'Action carries a Parts row');
});

/* ── 6 · a tap on the page never leaves the stage ───────────────────────── */

test('in Stages a canvas tap only picks — no door to Studio, Details, the Logo maker or a Content sheet', () => {
  const src = read(`${EDITOR}/editor-shell.tsx`);
  const at = src.indexOf("data.t !== 'edit' || typeof data.key !== 'string') return;");
  const end = src.indexOf('window.addEventListener(\'message\', onMessage);', at);
  const handler = src.slice(at, end);
  assert.match(handler, /const stagesTap = stagesStudioRef\.current && window\.innerWidth < 1024;/);
  /* Every branch that opens something other than the part itself is closed to a Stages tap. */
  const doors = [
    /if \(([^)]*)openWordsOnTap\(/,
    /if \(stagesTap\) \{\s*\/\*[^*]*\*\/\s*\} else (if) \(data\.key === 'f:hero' && data\.el === 'mark' && select\)/,
    /if \(data\.key === 'w:schedule' && typeof moment === 'string'([^{]*)\{/,
    /if \(([^)]*)factEditorsRef\.current\?\.\[tapped\]\)/,
  ];
  for (const d of doors) {
    const m = d.exec(handler);
    assert.ok(m, `the door ${d} is found`);
    assert.match(m![1]!, /^!stagesTap && |&& !stagesTap\)\s*$|^if$/, `a Stages tap opens it: ${d}`);
  }
  /* …and nothing else in the handler opens a tool or a Details item. */
  const opens = handler.match(/select\??\.?\(\{ kind: 'tool'|openDetailsItemRef\.current\(/g) ?? [];
  assert.equal(opens.length, 3, `the tool/Details doors are the guarded ones (${opens.length})`);
});

/* ── 7 · the Style bar opens the exact place, and Done comes back ───────── */

test('every part with a Studio bar has a door; every focused field exists in the shipped editors', async () => {
  const { MAKER_PART_KEYS, MAKER_PART_FOCUS, makerPartQuietRow, makerPartStudioDoor } = await import('./maker-parts');
  const { execSync } = await import('node:child_process');
  for (const k of MAKER_PART_KEYS) {
    const q = makerPartQuietRow(k);
    if (!q || 'suppliers' in q.to) continue;
    const door = makerPartStudioDoor(k);
    assert.ok(door, `${k}: its "Edit …" bar has a door`);
  }
  for (const [part, sel] of Object.entries(MAKER_PART_FOCUS)) {
    const field = /data-same-field="([a-z_]+)"/.exec(sel!)?.[1];
    assert.ok(field, `${part}: focuses a same-field door`);
    const hits = execSync(`grep -rl 'data-same-field="${field}"' app --include=*.tsx`, { cwd: WEB }).toString().trim();
    assert.ok(hits.length > 0, `${part}: no editor draws data-same-field="${field}"`);
  }
  const shell = read(`${LAUNCH}/maker-shell.tsx`);
  /* ⚡ MOVED 08 Oct, not changed: the button and its two effects live in the lazy chunk (`StudioBackToPart`) — the
     Maker's first load was 0.4 KB over its budget on #6413, and this exists only after a Style-bar jump. */
  assert.match(read(`${LAUNCH}/stages-studio-parts.tsx`), /Done · back to \{from\.label\}/, 'the way back names the part');
  assert.match(shell, /\{studioFrom \? <StudioBackToPart from=\{studioFrom\} side=\{side\} at=\{studioAt\} full=\{studioFull\} onBack=\{backToPart\} \/> : null\}/, 'the shell mounts it for a jump');
  assert.match(read(`${LAUNCH}/details-lazy.tsx`), /export const StudioBackToPart = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/stages-studio-parts'\)/, 'lazily');
  /* The top "✓ Done" band is gone (owner 2026-10-08: no row over a Studio page). After a jump the way back to the part
     is THIS button alone; the bar has no ‹ — its left control is ✕ Exit everywhere, and "Stages ▾" lists the stages. */
  assert.doesNotMatch(shell, /StudioBack\b(?!ToPart)|Back to Studio/, 'a ‹ is back in the bar');
  assert.doesNotMatch(shell, /onDone=/, 'a top Done is back');
});

/* ── 8 · the page tabs move the canvas; ▶ plays the whole life ───────────── */

test('a page tab still takes the canvas to its page under Stages (only a picked part centres itself)', () => {
  const shell = read(`${EDITOR}/editor-shell.tsx`);
  /* 🧭 AMENDED 08 Oct — measured on the preview: after a tab tap the Invitation ended 959 / 77 / 156 px down, not at
     the top. The owner's ruling (2026-10-07, "yes pages"): *"each page is just a bookmark on a single page that just
     jumps. this was not the plan"* — a tab is its own page, opened from its TOP. So the page pick no longer ASKS for
     a scroll to its first scene (the `pageAskRef` this test used to pin is gone): it swaps the page (`hubTab`), and
     on a phone `scrollPreviewTo` skips for it as it does for a picked part. STRONGER, not weaker: the canvas is
     still taken to the page, and never away from its top. */
  assert.match(shell, /if \(!anchor \|\| \(stagesStudioRef\.current && window\.innerWidth < 1024\)\) return;/, 'under Stages the Maker never scrolls the canvas to a scene — a page pick included');
  assert.doesNotMatch(shell, /pageAskRef|takePageAsk/, 'a page pick asks for a scroll to its first tile again');
  const jump = shell.slice(shell.indexOf('const jumpToPage = (page: MakerGuestPage) => {'));
  assert.match(jump.slice(0, 400), /if \(maker\?\.stagesStudio\) postToShownCanvases\(\{ source: 'setnayan-editor', t: 'hubTab', key: '', tab: key \}\);/, 'jumpToPage opens the page');
  const tools = read(`${LAUNCH}/stage-tools.tsx`);
  /* 🧭 AMENDED 08 Oct — owner, on the Stages view: *"i do not see the individual pages. i still see invitation as a
     1 long page that scrolls down"*. A tab tap now tells the CANVAS to swap first (`goToPage`), then the shell's
     Page ▾ exactly as before — the picked part is still let go, and the shell's door is still the one pressed. */
  /* 🧹 AMENDED 08 Oct (measured on the preview): after a tab change the panel KEPT the look options of the part
     picked on the page before — `setPicked(null)` dropped the frame but left the work area's tool open, so its
     rows stayed. A tab tap now lets go exactly as ✕ does (`deselect`: the pick AND its tools). */
  /* 🔁 RE-AIMED 2026-10-09. This held `deselect(); goToPage(…)` in the tap itself. The claim is kept — after a page
     change the toolbar never keeps a part of the page before, its tools too — but the part is let go when the canvas
     HAS switched its tab, not on the tap: on the review copy a canvas that refused the switch left NOTHING picked and
     every tool blank (`lib/the-preview-only-selects.test.ts` (3b)). `deselect` still lets go exactly as ✕ does. */
  /* 🔁 RE-AIMED 2026-10-09 (commit 9, `the-play-button-previews.test.ts`): ▶ held down is the whole page as a guest — a tab then only turns the page, nothing is picked and nothing is let go. Outside the preview the rule is what it was. */
  assert.match(tools, /goToPage\(p\.key, p\.option\);\s*if \(!previewing\) askPage\(p\.key\);/, 'a tab tap does not ask the canvas for the page');
  assert.match(tools, /if \(tab && held && !previewingRef\.current && !partsRef\.current\.includes\(held\) && pendingStep\.current === null\) deselectRef\.current\(\);/, 'another page keeps the picked part — its tools too');
  assert.match(tools, /const deselect = useCallback\(\(\) => \{\s*setPicked\(null\);\s*openToolRef\.current\?\.close\(\);\s*\}, \[\]\);/, 'letting go closes the part’s tools');
  assert.match(tools, /const goToPage = useCallback\(\s*\(key: string, option: string\) => \{\s*postToCanvas\(\{ source: 'setnayan-editor', t: 'hubTab', key: '', tab: key \}\);\s*onPickPage\(option\);/, 'the canvas swaps, and the shell’s Page ▾ is still told');
});

test('▶ on a picked part plays Build in · Action · Build out, and says what it has none of', () => {
  const tools = read(`${LAUNCH}/stage-tools.tsx`);
  assert.match(tools, /t: 'playSeq', key: def\.canvas/, '▶ asks the canvas for the whole sequence');
  assert.doesNotMatch(tools, /t: 'playEl', key: def\.canvas/, 'never the arrival alone');
  assert.match(tools, /<StagePlayStatus phase=\{seq\.phase\} skipped=\{seq\.skipped\} \/>/, 'the status line is drawn');
  assert.match(read(`${LAUNCH}/stage-panel/play-status.tsx`), /data-stage-play-skipped=""/, 'a skipped phase is said');
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /if \(data\.t === 'playSeq'\) \{/);
  const seq = read('app/[slug]/_components/play-sequence.ts');
  for (const w of ["'Build in: none'", "'Action: none'", "'Build out: none'"]) assert.ok(seq.includes(w), `names ${w}`);
  assert.match(seq, /phase: 'in'[\s\S]*phase: 'act'[\s\S]*phase: 'out'/, 'in, then the action, then out');
});

test('picking the Digital pass never replaces the canvas in Stages — it is picked in place, Style only', () => {
  /* Owner, 2026-10-07: "cannot go back to the website. the digital pass is all that is left". */
  const shell = read(`${EDITOR}/editor-shell.tsx`);
  const at = shell.indexOf('data-maker-ticket-view={ticketDesign}');
  assert.ok(at > 0);
  assert.match(shell.slice(at, at + 400), /\$\{maker\?\.stagesStudio \? ' hidden' : ''\}/, 'the ticket view is put away under Stages');
  const tools = read(`${LAUNCH}/stage-tools.tsx`);
  assert.match(tools, /const styleOnly = revealOpen \|\| cameraOpen \|\| rsvpOpen \|\| picked === 'pass';/);
  /* Style only — and Edit, every part's (🔁 re-aimed 2026-10-09: the selector is Edit | Style | Background | Animate,
     `TOOLBAR-SPEC-2026-10-09.md`): Background and Animate have nothing to set there — grey, and a tap says why
     (never `disabled`, which is a dead tap — `a-tool-with-nothing-to-do-says-so`). */
  /* 🔁 RE-AIMED 2026-10-10: a reply screen's CARD and its LINES now have a Background and an Animate to set (owner
     2026-10-09: "how come background not fixed and no animate?" — `the-rsvp-lines-have-a-look.test.ts` §10), so those
     two are live there (`rsvpLooks`). Every other part is decided exactly as before — the claim this line holds. */
  /* 🔁 RE-AIMED AGAIN 2026-10-10: the tools a picked thing has a save for BEYOND the part rule are now one named
     function, `ownTool` (a reply card or line: Background · Animate; a fixed block with one real root: Animate —
     `a-fixed-block-has-its-own-motion.test.ts` §5). The part rule itself is decided exactly as before. */
  /* 🔁 RE-AIMED 2026-10-10 (toolbar consistency — owner: "please make Edit | Style | Background | Animate Consistent in
     design"): the part rule is as it was, and one clause is added to it — a tool whose rows would be EMPTY on the
     picked thing is grey too (`emptyHere`: on the reply pages Style has a row only for a line with a look and for the
     When-yes card). The claim this pin holds — a live tool is one with something to set — is the same, and stricter. */
  assert.match(tools, /const toolWorks = \(t: MakerPartTool\) => !picked \|\| ownTool\(t\) \|\| \(\(t === 'edit' \|\| t === 'style' \|\| !styleOnly\) && makerPartToolWorks\(picked, t\) && !emptyHere\(t\)\);/);
  assert.match(tools, /aria-disabled=\{toolWorks\(t\) \? undefined : true\}/);
  const edges = read(`${LAUNCH}/add-part-sheet.tsx`);
  assert.match(edges, /clipPath: `inset\(/, 'the frame is clipped to the canvas');
});

test('Arrange has no Order row, and every Arrange row carries its ⓘ (owner 2026-10-07, Arrange "yes")', () => {
  const arr = read(`${LAUNCH}/stage-panel/stage-arrange.tsx`);
  assert.doesNotMatch(arr, /data-stage-arrange="order"|data-stage-order=/, 'the Order row is back');
  assert.equal((arr.match(/about=\{SHOW_ABOUT\}/g) ?? []).length, 2, 'On this stage ▾ says what Auto · Shown · Hidden do');
  const row = read(`${EDITOR}/scene-style-row.tsx`);
  assert.match(row, /small="Alignment"[^>]*about="/, 'Alignment ▾ has its ⓘ');
  assert.match(row, /small="Spacing"[\s\S]{0,120}about="/, 'Spacing ▾ has its ⓘ');
});

/* ── 9 · ↑ ↓ ✕ on the frame; the frame never on a neighbour ─────────────── */

test('↓ from part i picks part i+1 in the order the page DRAWS them, and keeps the tool open', async () => {
  const { makerStepPart } = await import('./maker-parts');
  const { partsInPageOrder } = await import('./maker-part-step');
  /* Drawn order differs from the map's: the page put the date above the names. */
  const tops: Record<string, number> = { logo: 10, date: 80, names: 140, place: 220 };
  const ordered = partsInPageOrder(['logo', 'names', 'date', 'place', 'countdown'] as const, (k) => tops[k] ?? null);
  assert.deepEqual(ordered, ['logo', 'date', 'names', 'place'], 'visual order; a part not drawn is left out');
  const pages = ['home', 'details'];
  assert.deepEqual(makerStepPart({ parts: ordered, at: 'date', pages, page: 'home', dir: 1 }), { page: 'home', part: 'names' });
  assert.deepEqual(makerStepPart({ parts: ordered, at: 'date', pages, page: 'home', dir: -1 }), { page: 'home', part: 'logo' });
  assert.deepEqual(makerStepPart({ parts: ordered, at: 'place', pages, page: 'home', dir: 1 }), { page: 'details', part: null }, 'the last part goes on to the next tab');
  const tools = read(`${LAUNCH}/stage-tools.tsx`);
  assert.match(tools, /const here = home === shownPage \? \(drawnHere\.length \? drawnHere : parts\) : tappableOn\(home\);/, 'the step walks the drawn order');
  /* The tool is never CHANGED by a step: `pickPart` asks for the SAME tool — or, on a part where that tool has
     nothing to set, Edit for that part only (`toolFor`; the remembered tool is not written). (🔁 Re-aimed 2026-10-09:
     the fallback was Style, the first tool then; Edit is the first of the four now.) */
  assert.match(tools, /askTool\(toolFor\(k\), k\);/);
  assert.match(tools, /stagePick: k \}, window\.location\.origin\);/, 'a step’s pick is not heard back by the panel — its tool is never asked for');
  /* (…the first tool that HAS something there — `makerPartToolFor`, executed over every part in
     `lib/the-preview-only-selects.test.ts` (4).) */
  assert.match(tools, /const toolFor = useCallback\(\(k: MakerPartKey \| null\): MakerPartTool => makerPartToolFor\(k, toolRef\.current\), \[\]\);/);
  const stepFn = tools.slice(tools.indexOf('const step = useCallback('), tools.indexOf('const stepRef = useRef(step);'));
  assert.doesNotMatch(stepFn, /setTool\(/, 'a step changes the remembered tool');
});

test('the frame carries no ↑ ↓ ✕ any more; keys, Esc, a swipe and a tap on the ground still walk and let go', () => {
  /* 🔁 RE-AIMED 2026-10-09 (owner: *"on preview screen, you only select"* — no buttons on the frame). This held the
     three chips' corners (↑ upper-left · ↓ lower-left · ✕ lower-right, 2026-10-07). What they DID is kept and still
     held below: ↑ ↓ between parts is the arrow keys and a swipe across the toolbar, letting go is Esc and a tap on
     the page's ground. That the frame draws no button but ＋ is `lib/the-preview-only-selects.test.ts` (2). */
  const edges = read(`${LAUNCH}/add-part-sheet.tsx`);
  assert.doesNotMatch(edges, /data-part-step=|data-part-deselect=|aria-label="Previous part"|aria-label="Next part"/, 'a step or let-go chip is back on the frame');
  const tools = read(`${LAUNCH}/stage-tools.tsx`);
  assert.match(tools, /if \(Math\.abs\(dx\) > 44 && Math\.abs\(dx\) > 1\.6 \* Math\.abs\(dy\)\) stepRef\.current\(dx > 0 \? 1 : -1\);/, 'a swipe across the toolbar no longer steps');
  assert.match(tools, /e\.key === 'ArrowDown' \|\| e\.key === 'ArrowUp'/);
  assert.match(tools, /e\.key === 'Escape'\) deselect\(\)/);
  /* 🔁 RE-AIMED 2026-10-09 (commit 9, `the-play-button-previews.test.ts`): ▶ held down is the whole page as a guest — a tab then only turns the page, nothing is picked and nothing is let go. Outside the preview the rule is what it was. */
  assert.match(tools, /d\.t === 'tapOutside' && !previewingRef\.current\) deselectRef\.current\(\)/, 'a tap on the page’s ground lets go');
});

test('the frame and its ＋ stop in the gap — never on the neighbour’s words', async () => {
  const { partFrameEdges } = await import('./maker-stage-room');
  /* The Logo at 100–160, the eyebrow ending 12 px above it, the names 30 px below. */
  const f = partFrameEdges({ top: 100, height: 60 }, 12, 30);
  assert.ok(f.top >= 100 - 6 && f.top <= 100, `top edge in the gap's middle or nearer (${f.top})`);
  assert.ok(f.top - f.tapAbove / 2 >= 100 - 12 - 26 / 2 - 0.001 || f.tapAbove === 26, '＋ above is only as tall as the gap allows');
  assert.ok(f.bottom <= 160 + 15 && f.bottom >= 160, `bottom edge within the gap (${f.bottom})`);
  assert.ok(f.tapBelow <= 30, `＋ below's tap ends where the names begin (${f.tapBelow})`);
  const open = partFrameEdges({ top: 100, height: 60 }, null, null);
  assert.deepEqual([open.top, open.bottom, open.tapAbove], [78, 182, 44], 'nothing beside it: the full pad and a 44 px tap');
  const edges = read(`${LAUNCH}/add-part-sheet.tsx`);
  assert.match(edges, /partFrameEdges\(box, box\.gapAbove \?\? null, box\.gapBelow \?\? null, PART_PAD\)/, 'the frame is drawn from the gaps');
  assert.match(edges, /tapAt\(box\.left \+ box\.width \/ 2, fr!\.top, fe!\.tapAbove\)/);
  assert.match(edges, /tapAt\(box\.left \+ box\.width \/ 2, fr!\.top \+ fr!\.height, fe!\.tapBelow\)/);
});

/* ── 10 · every visible piece is a part ─────────────────────────────────── */

test('every piece the cover draws picks a part of its own (owner 2026-10-07: "every visible piece of the page must be a pickable part")', async () => {
  const { HUB_HERO_ELEMENT_KEYS } = await import('./element-style');
  const { MAKER_PARTS, MAKER_STAGE_PAGES, makerPartOfTap, HERO_EL_INSIDE } = await import('./maker-parts');
  /* The one piece with no part yet — the cover photo's caption — is named here, so it stays visible as a gap. */
  const GAPS = ['caption'];
  for (const [stage, page] of [['save_the_date', 'home'], ['rsvp', 'home'], ['event', 'live']] as const) {
    for (const el of HUB_HERO_ELEMENT_KEYS) {
      if (GAPS.includes(el)) continue;
      const k = makerPartOfTap(stage, page, 'f:hero', el);
      assert.ok(k, `${stage} › ${page}: a tap on the cover's ${el} picks nothing`);
      const want = HERO_EL_INSIDE[el] ?? el;
      assert.equal(MAKER_PARTS[k!].el, want, `${stage} › ${page}: the cover's ${el} picks ${k}, not its own part`);
      assert.ok((MAKER_STAGE_PAGES[stage] as Record<string, readonly string[]>)[page]!.includes(k!), `${k} is on ${stage} › ${page}`);
    }
  }
  /* The two blocks that drew no marker — every tap on them was dead — now stand after one. */
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /\{makerMark\('f:details'\)\}\s*<PublicEventDetails/, 'THE DETAILS · WHEN · WHERE is a part');
  assert.equal((body.match(/makerMark\('f:spotlight'\)/g) ?? []).length, 2, 'both Happening-now mounts are a part');
  for (const [k, canvas] of [['details', 'f:details'], ['spotlight', 'f:spotlight']] as const) assert.equal(MAKER_PARTS[k].canvas, canvas);
});

test('the Reveal is FIRST on The Day › Live (and every page it leads) — before the Happening-now card, on the shown tab', async () => {
  const { MAKER_STAGE_PAGES } = await import('./maker-parts');
  for (const [stage, page] of [['save_the_date', 'home'], ['rsvp', 'home'], ['event', 'live']] as const) {
    assert.equal((MAKER_STAGE_PAGES[stage] as Record<string, readonly string[]>)[page]![0], 'reveal', `${stage} › ${page} opens with the Reveal`);
  }
  const live = MAKER_STAGE_PAGES.event.live!;
  assert.ok(live.indexOf('reveal') < live.indexOf('spotlight'), 'the Reveal comes before the Happening-now card');
  const tools = read(`${LAUNCH}/stage-tools.tsx`);
  /* 🧭 AMENDED 08 Oct (measured on the preview: on Invitation › Me the stub was drawn above the page — "the first
     part not in a hidden group" was the greeting, which stood outside every tab). Stronger now: the first marked
     part INSIDE the shown page's own group (`firstMarkerOnPage`, executed by `every-stages-tab-has-its-own-page`). */
  assert.match(tools, /const first = firstMarkerOnPage\(doc, shownPage\);/, 'drawn before the first part of the SHOWN page');
  assert.match(tools, /part\.nextElementSibling !== first\) \{\s*part\.remove\(\);/, 'a stub left lower down is moved back to the top');
});

test('the Reveal’s Look carries one switch per stage it can play on — the same drafted list Arrange writes', () => {
  /* Owner 2026-10-07: "reveal will have a toggle for each stage it is at. to know where they want this to activate". */
  const src = read(`${LAUNCH}/maker-reveal.tsx`);
  assert.match(src, /data-reveal-stage-switches=""/);
  /* Amended 2026-10-08 (owner, on the Look strip: "and none."): a switch is ON only while a reveal can play
     (`revealSwitchOn` = the same stages list, and off under the older "No reveal" value), and still writes the one
     list through `toggleStage` — from that older value alone it also takes an opening (`lib/reveal-none.ts`). */
  assert.match(src, /\{REVEAL_STAGE_CHOICES\.map\(\(st\) => \([\s\S]{0,400}<PanelSwitch on=\{revealSwitchOn\(now, st\)\}[^>]*onChange=\{\(\) => \(effective === REVEAL_NONE_ID \? savePick\(revealSwitchPatch\(st, now, fallback\)\) : toggleStage\(st\)\)\}/, 'each switch reads and writes the one stages list');
  assert.match(src, /const now = \{ effective, stages \};/, 'the switches read the picker’s own stages list');
  assert.match(src, /stages=\{stages\} toggleStage=\{toggleStage\}/, 'the Stages part is handed the picker’s own list and toggle');
  assert.match(src, /const toggleStage = \(s: RevealStage\) => setStages\(revealStagesWith\(stages, s, !stages\.includes\(s\)\)\);/, 'one write: setStages');
});

test('the RSVP stage canvas never fills in or sends a reply — its fields are inert and a submit is stopped', () => {
  /* Owner 2026-10-07: "it is the actual RSVP not an editing way". Nothing on this canvas may write an RSVP. */
  const bridge = read('app/[slug]/_components/rsvp-canvas-bridge.tsx');
  assert.match(bridge, /const INERT_FIELDS = 'input, textarea, select, label,/);
  for (const ev of ['click', 'pointerdown', 'mousedown', 'keydown', 'beforeinput']) {
    assert.match(bridge, new RegExp(`document\\.addEventListener\\('${ev}', on\\w+, true\\)`), `${ev} is caught on the canvas`);
  }
  assert.match(bridge, /const onSubmit = \(e: Event\) => \{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);/, 'a submit is stopped before React reads it');
  /* …and the bridge is only ever on the Maker's canvas: the reply page mounts it behind the host-verified `canvas`. */
  assert.match(read('app/[slug]/invite/reply/page.tsx'), /\{canvas \? <RsvpCanvasBridge \/> : null\}/);
  /* …and even a sample that reached the action writes nothing. */
  assert.match(read('app/[slug]/invite/actions.ts'), /if \(guestId === SIMULATED_GUEST_ID\) \{/);
});

test('a tap on the day’s parts and on THE DETAILS picks them — every marked block is a selection AND a part', async () => {
  /* Owner preview 08 Oct: announcements · live_hub · find_your_seat and the WHEN plate were bound but picked nothing. */
  const { selectionForCanvasKey } = await import('./maker-selection');
  const { makerPartOfCanvas } = await import('./maker-part-groups');
  for (const key of ['f:announcements', 'f:live_hub', 'f:find_your_seat', 'f:photos_of_you', 'f:details', 'f:spotlight']) {
    assert.ok(selectionForCanvasKey(key, []), `${key}: the work area selects it (its panel opens)`);
    assert.ok(makerPartOfCanvas('event', key) ?? makerPartOfCanvas('rsvp', key), `${key}: the Stages panel has a part for it (its frame draws)`);
  }
});

/* ── 11 · the Dress code part's Look: its looks are PICTURES (owner's preview check, 08 Oct) ─────────── */

test('the Dress code part’s Style draws its layouts as look cards and its palette looks as one row of five — no dropdown among them', async () => {
  /* 🔁 RE-AIMED 2026-10-09 (owner: *"row 3 is palette style"*; decided the same day: the Do's & Don'ts look goes to
     Studio › Mood Board & Dress Code — `TOOLBAR-SPEC-2026-10-09.md`). This held THREE carousels under one another
     (layouts · palette looks · Do's & Don'ts), 614 px in a 210-px box. The toolbar's Style is the layouts' cards
     (rows 1–2), the palette's five in ONE row (row 3), Colour · Size (row 4). The Do's & Don'ts pick is not drawn
     here any more; its stored value (`canvas.dos`) is still what the page draws. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  /* The work area lays them under one another: the scene's layouts, then what rides beside them. */
  const shell = read(`${EDITOR}/editor-shell.tsx`);
  const look = shell.slice(shell.indexOf('const lookRow ='), shell.indexOf('const backgroundRow ='));
  assert.match(look, /\{styleRow\}\s*\{paletteRow\}\s*\{layoutRow\}/, 'the layouts lead; the palette follows');
  assert.match(shell, /type === 'dress_code' \? \(\s*<PaletteLookCanvasRow /, 'only the Dress code part carries it');
  const row = read(`${EDITOR}/scene-style-row.tsx`);
  const body = row.slice(row.indexOf('export function PaletteLookCanvasRow'), row.indexOf('export function SceneAlignRow'));
  const stages = body.slice(body.indexOf('if (cards && onDressPart) {'), body.indexOf('if (!drawsPalette || colours.length === 0) return null;'));
  assert.ok(stages.length > 200, 'the Stages branch was found');
  assert.match(stages, /\{drawsPalette \? <PaletteLookStrip [^\n]*\/> : null\}/, 'the palette’s row, where the layout draws the look');
  assert.doesNotMatch(stages, /DosLookCards|DressFiguresRow|PaletteLookCards/, 'a second carousel (or Figures ▾) is back under the Dress code’s Style — it has four rows');
  assert.doesNotMatch(stages, /PaletteLookRow|PickMenu|<Dd /, 'a dropdown sits among the Dress code’s looks');
  /* The page still draws the Do's & Don'ts in the look that was picked — the stored value is honoured. */
  assert.match(read('lib/scene-style-of-row.ts'), /resolveDosLook\(/, 'the page no longer reads the stored Do’s & Don’ts look');
  /* A pick of the shipped palette look is an absence, never a stored default. */
  assert.match(body, /if \(id === PALETTE_LOOK_DEFAULT\) delete c\.palette; else c\.palette = id;/);
  /* …and what the couple sees: five pictures in one row, the one worn marked; the full cards still draw for a
     surface with the room (Do's & Don'ts' too — they wait for their Studio row). */
  const { PaletteLookStrip, PaletteLookCards, DosLookCards } = await import(`../${EDITOR}/palette-look-row`);
  const strip = renderToStaticMarkup(React.createElement(PaletteLookStrip, { value: 'fabric', colours: ['#A9834B', '#2C2A29', '#C7A27C'], onPick: () => {} }));
  assert.equal((strip.match(/role="radio"/g) ?? []).length, 5);
  assert.match(strip, /aria-checked="true"[^>]*data-palette-pick="fabric"|data-palette-pick="fabric"[^>]*aria-checked="true"/);
  assert.doesNotMatch(strip, /aria-haspopup/);
  const html =
    renderToStaticMarkup(React.createElement(PaletteLookCards, { value: 'fabric', onPick: () => {} })) +
    renderToStaticMarkup(React.createElement(DosLookCards, { value: 'marks', onPick: () => {} }));
  assert.equal(html.split('data-style-card-preview=""').length - 1, 5 + 3, 'every card holds a picture');
  assert.match(html, /aria-checked="true"[^>]*data-style-card="fabric"/);
  assert.match(html, /aria-checked="true"[^>]*data-style-card="marks"/);
  assert.doesNotMatch(html, /aria-haspopup/);
});

/* ── 12 · Figures ▾ Drawn · Hidden — ONE setting, two doors (owner's preview check, 08 Oct) ──────────── */

test('the Dress code part carries ONE Figures ▾ (Drawn · Hidden) writing the Mood Board’s own switch — and never offers Photos', () => {
  const row = read(`${EDITOR}/scene-style-row.tsx`);
  const at = row.indexOf('function DressFiguresRow');
  const fn = row.slice(at, row.indexOf('export function SceneAlignRow'));
  assert.ok(at > 0 && fn.length > 400, 'the Figures row exists');
  /* One dropdown, the shipped one, with exactly the two choices the data can honour. */
  assert.equal(fn.split('<Dd').length - 1, 1, 'one dropdown');
  const keys = [...fn.slice(fn.indexOf('options={['), fn.indexOf(']}', fn.indexOf('options={['))).matchAll(/key: '([a-z]+)', label: '([A-Za-z]+)'/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(keys, ['drawn:Drawn', 'hidden:Hidden'], 'the choices are not Drawn · Hidden');
  assert.match(fn, /small="Figures"/);
  assert.doesNotMatch(stripComments(fn), /photos|Photos/, 'Photos is offered with no photo per role to show (blocked — see the docblock)');
  /* The SAME value the Mood Board's switch holds, the whole config, through the one draft door — never a second key. */
  assert.match(fn, /const next: DressCodeConfig = \{ \.\.\.before, show_figure: show \};/);
  assert.match(fn, /const saveEvents = useHeldEventsSave\(eventId, draftAction\);/);
  assert.match(fn, /const res = await saveEvents\(\{ dress_code_config: next \}\);/);
  const held = read(`${EDITOR}/use-scene-canvas.ts`);
  const hook = held.slice(held.indexOf('export function useHeldEventsSave'));
  assert.match(hook, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(\{ events \}\)\);/, 'the one draft door, an events patch');
  assert.match(hook, /return makerRedrawSave\(\(\) => draftAction\(eventId, fd\), \(\) => router\.refresh\(\)\);/, 'held, and the page redrawn in place');
  assert.match(fn, /value=\{drawn \? 'drawn' : 'hidden'\}/);
  assert.match(fn, /useState\(dressCode\.show_figure !== false\)/, 'only an explicit false is Hidden — a config saved before the switch stays Drawn');
  /* A refused save puts the row back and says why — never a pick that reads as landed. */
  const fail = fn.slice(fn.indexOf('if (!res.ok) {'), fn.indexOf('});', fn.indexOf('if (!res.ok) {')));
  assert.match(fail, /latest\.current = before;\s*setDrawn\(before\.show_figure !== false\);\s*setError\(res\.error\);/);
  assert.doesNotMatch(row, /c\.figures|canvas\.figures/, 'a second, canvas-side figures value was invented');
  /* The guest page reads that one switch, and nothing else decides it. */
  const widget = read('app/[slug]/_components/dress-code-widget.tsx');
  assert.match(widget, /const showFigure = config\?\.show_figure !== false;/);
  /* The config it is handed is the couple's own — never the old panel's starter-filled copy. */
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /dressCode: normalizeDressCodeConfig\(\(drafted as \{ dress_code_config\?: unknown \}\)\.dress_code_config\),/);
  const shell = read(`${EDITOR}/editor-shell.tsx`);
  assert.equal(shell.split('dressCode={sceneFormat.dressCode ?? null}').length - 1, 1, 'only the Stages panel’s Dress code part is handed the config');
  /* (🔁 Re-aimed 2026-10-09: the toolbar is four rows and Figures ▾ has none — the row is no longer DRAWN on the Dress
     code part. Everything above still holds for the row itself, kept and exported: it is the Mood Board's own
     switch, which is where the setting is changed now.) */
  assert.match(row, /export function DressFiguresRow\(/);
  assert.doesNotMatch(row.slice(row.indexOf('if (cards && onDressPart) {'), row.indexOf('if (!drawsPalette || colours.length === 0) return null;')), /<DressFiguresRow/);
  assert.match(read('app/dashboard/[eventId]/studio/mood-board/_components/dress-code-fields.tsx'), /show_figure/, 'the Mood Board’s own switch — the setting’s other door — is gone');
});

/* ── 13 · the Reveal and Camera look cards (status TODO 13) — amended the same day by the owner's newer ruling:
      every style card is the ONE phone-shaped frame, so "as wide as its picture" (#6428's F) became "the frame".
      The walk of every picker is `every-style-card-is-phone-shaped.test.ts`; this keeps the two cards' own facts. ── */

test('the Reveal and Camera look cards are the phone-shaped frame — the Camera’s screen fills it, the Reveal is drawn at its shape', () => {
  const reveal = read(`${LAUNCH}/maker-reveal.tsx`);
  const card = reveal.slice(reveal.indexOf('data-maker-reveal-kind={o.id}'), reveal.indexOf('</button>', reveal.indexOf('data-maker-reveal-kind={o.id}')));
  assert.match(card, /className=\{SP_LOOK_CARD\}>/, 'a Reveal card is not the frame-wide look card');
  assert.match(card, /className=\{`\$\{SP_PHONE_PICTURE\} /);
  assert.match(card, /<RevealPicture kind=\{o\.id\} colours=\{look\.colours\} fill \/>/, 'the opening is drawn at the frame’s portrait shape');
  const camera = read(`${LAUNCH}/stage-panel/camera-look.tsx`);
  /* (Re-aimed 2026-10-10: the approved prototype now draws The Day › Camera — its looks are the toolbar's Style cards,
     `StyleCards`, like every other part's; `every-style-card-is-phone-shaped.test.ts` holds the card.) */
  assert.match(camera, /<StyleCards\s/, 'a Camera card is not the toolbar’s Style card');
  assert.match(read(`${LAUNCH}/stage-panel/camera-face.tsx`), /data-camera-look-face=\{look\} className="absolute inset-0 /, 'the camera screen no longer fills the frame');
  assert.doesNotMatch(camera + card, /spCardWidth|SP_LAYOUT_CARD/, 'a card is sized apart from the frame again');
});

/* ── 14 · the Reveal's NONE card — one fact with the three switches (owner, live Maker 2026-10-08: "and none.") ── */

test('None is the FIRST card of the Reveal’s Look and IS "every stage switch off" — the card and the switches cannot disagree', async () => {
  const { revealIsNone, revealPickPatch, revealSwitchOn, revealSwitchPatch, REVEAL_NONE_ID } = await import('./reveal-none');
  const { sanitizeRevealStages, revealStageChosen } = await import('./reveal-stages');
  /* 1 · One home: an empty stages list — the value that already means "no reveal on any stage". */
  assert.deepEqual(revealPickPatch('none', { effective: 'veil-sheer', stages: ['save_the_date', 'rsvp'] }, 'rsvp'), { reveal_stages: [] });
  assert.deepEqual(sanitizeRevealStages([]), [], 'an empty list is not a stored answer any more');
  for (const st of ['save_the_date', 'rsvp', 'event'] as const) assert.equal(revealStageChosen([], st), false, `None still plays on ${st}`);
  assert.ok(!('std_reveal_template' in revealPickPatch('none', { effective: 'veil-sheer', stages: ['rsvp'] }, 'rsvp')!), 'None threw the couple’s opening away');
  assert.equal(revealPickPatch('none', { effective: 'veil-sheer', stages: [] }, 'rsvp'), null, 'None picked twice writes nothing');
  /* 2 · None is picked exactly when every switch is off (or the older "No reveal" value). */
  assert.equal(revealIsNone({ effective: 'veil-sheer', stages: [] }), true);
  assert.equal(revealIsNone({ effective: 'veil-sheer', stages: ['event'] }), false);
  assert.equal(revealIsNone({ effective: 'none', stages: ['save_the_date'] }), true);
  for (const st of ['save_the_date', 'rsvp', 'event'] as const) {
    assert.equal(revealSwitchOn({ effective: 'veil-sheer', stages: [] }, st), false);
    assert.equal(revealSwitchOn({ effective: 'none', stages: ['save_the_date', 'rsvp', 'event'] }, st), false, 'a switch is drawn on over no reveal');
  }
  assert.equal(revealSwitchOn({ effective: 'veil-sheer', stages: ['rsvp'] }, 'rsvp'), true);
  /* 3 · Picking an opening FROM None turns on the stage being edited — that stage alone. */
  assert.deepEqual(revealPickPatch('veil-sheer', { effective: 'veil-sheer', stages: [] }, 'rsvp'), { std_reveal_template: 'veil-sheer', reveal_stages: ['rsvp'] });
  assert.deepEqual(revealPickPatch('four-flap', { effective: 'none', stages: ['save_the_date'] }, 'event'), { std_reveal_template: 'four-flap', reveal_stages: ['event'] });
  /* …and with a reveal already playing, a card changes the opening only. */
  assert.deepEqual(revealPickPatch('four-flap', { effective: 'veil-sheer', stages: ['save_the_date'] }, 'rsvp'), { std_reveal_template: 'four-flap' });
  assert.equal(revealPickPatch('veil-sheer', { effective: 'veil-sheer', stages: ['save_the_date'] }, 'rsvp'), null);
  /* 4 · Switching the last stage off IS None; a switch from the older value takes an opening or changes nothing. */
  const off = revealSwitchPatch('rsvp', { effective: 'veil-sheer', stages: ['rsvp'] }, 'veil-sheer')!;
  assert.deepEqual(off, { reveal_stages: [] });
  assert.equal(revealIsNone({ effective: 'veil-sheer', stages: off.reveal_stages! }), true);
  assert.deepEqual(revealSwitchPatch('event', { effective: 'none', stages: ['save_the_date'] }, 'veil-sheer'), { std_reveal_template: 'veil-sheer', reveal_stages: ['event'] });
  assert.equal(revealSwitchPatch('event', { effective: 'none', stages: [] }, null), null, 'a switch goes on with no opening to play');
  assert.equal(REVEAL_NONE_ID, 'none');
  /* 5 · The strip: None first, always drawn, phone-shaped, the plain cover; one draft patch for both keys. */
  const src = read(`${LAUNCH}/maker-reveal.tsx`);
  const strip = src.slice(src.indexOf('data-maker-reveal-kinds=""'), src.indexOf('data-reveal-stage-switches=""'));
  const noneAt = strip.indexOf('data-maker-reveal-kind={REVEAL_NONE_ID}');
  assert.ok(noneAt > 0 && noneAt < strip.indexOf('{openings.map((o) => {'), 'None is not the first card');
  assert.doesNotMatch(src.slice(src.indexOf('data-maker-reveal-kinds=""') - 200, src.indexOf('data-maker-reveal-kinds=""')), /openings\.length > 0 \?/, 'the strip (and None with it) disappears when no opening is offered');
  assert.match(strip, /aria-checked=\{none\}[^>]*onClick=\{\(\) => savePick\(revealPickPatch\(REVEAL_NONE_ID, now, onStage\)\)\}/);
  assert.match(strip, /<RevealPicture kind=\{REVEAL_NONE_ID\} colours=\{look\.colours\} fill \/>/);
  assert.match(strip, />None<\/span>/);
  assert.match(strip, /const on = !none && effective === o\.id;/, 'an opening stays ringed beside None');
  assert.match(strip, /onClick=\{\(\) => \(none \? savePick\(revealPickPatch\(o\.id, now, onStage\)\) : choose\(o\.id\)\)\}/);
  assert.match(src, /fd\.set\('patch', JSON\.stringify\(\{ events: patch \}\)\);/, 'the card and the switches are not one draft write');
  const { revealPictureHtml } = await import(`../${LAUNCH}/stage-panel/reveal-picture`);
  const plain = revealPictureHtml('none', { dominant: '#111', supporting: '#222', accent: '#333', neutral: '#F7F2EC' }, 150, 96, true);
  assert.match(plain, /data-reveal-picture="none"[^>]*background:#F7F2EC"><\/span>$/, 'None draws an opening over the cover');
  /* 6 · Every opening the event may use is a card: the list is the library less what the admin map switched off — no other filter. */
  const made = read(`${LAUNCH}/maker-made-once.tsx`);
  assert.match(made, /const allowed: Partial<Record<string, boolean>> = config\?\.templates \?\? \{\};\s*const openings = REVEAL_LIBRARY\.filter\(\(t\) => allowed\[t\.id\] !== false\)\.map\(/);
});

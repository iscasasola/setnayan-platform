/**
 * 🧭 STUDIO ROUND 3 FOLLOWS THE OWNER (2026-10-08 — each item reported by the owner on the live
 * preview; the contract is `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html` and his words):
 *
 *   1 · Love Story › "+ Add a moment" is the APP's form — white, ink, standard inputs (never the
 *       event's `--ls-*` palette, whose placeholders were invisible), on the Schedule's shared
 *       `Sheet` lifted above the Studio's sticky bar; When · This one is… · Added by are each ONE
 *       PickMenu; ✕ Not now · ✓ Keep this moment (icon + word) in a glass row at the foot.
 *   2 · Look › Background never shows a broken picture: every still is drawn over its own swatch
 *       (the loop's two sampled colours) and is removed if it fails.
 *   3 · No go-elsewhere links: Prints' "Set up E-Gifts" opens E-Gifts' own editor IN PLACE with
 *       "✓ Done · back to Prints"; Look's "Same as the Event Hub" is a switch.
 *   4 · E-Gifts "Your own words": the five starting points are ONE "Start from ▾" dropdown.
 *   5 · Seat plan: the map gets the space — one compact head row, Auto arrange · Rules ▾ · View ▾
 *       in the thumb zone, the people a pull-up sheet with the peek "N guests · N unseated", no
 *       "Same layout in 3D ↗" card, the whole room fitted on open.
 *
 * Every floating row touched here is `sn-glass-row` (owner 2026-10-08, *"apply this to all glass
 * row"*) — no opaque fill, no shadow of its own.
 *
 * 🛡 Sabotaged once each (2026-10-08), each red alone: When's dropdown renamed off
 * `data-moment-when` → 1; the carousel's `<StillOverSwatch>` swapped back for a bare lazy `<img>` →
 * 2; an `<a href={`${base}/pabuya`}>` back beside Set up E-Gifts → 3; the Studio branch of the
 * E-Gifts words switched off (chips drawn) → 4; "Same layout in 3D ↗" put back in the thumb-zone
 * tools → 5.
 *
 * `globalThis.React` before the dynamic imports: tsx compiles JSX to the classic runtime here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PABUYA_TEMPLATES } from './pabuya-message';
import { hubMovingBackgroundIds } from './hub-canvas';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const D = 'app/dashboard/[eventId]';
const L = `${D}/launch/_components`;
const SEAT = `${D}/seating/_components`;

async function html(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
async function inStudio(el: React.ReactElement): Promise<string> {
  const { MakerContext } = await import(`../${L}/maker-context`);
  return html(React.createElement(MakerContext.Provider, { value: { stagesStudio: true } as never }, el));
}

test('1 · Love Story › Add a moment: the app’s form on the Schedule’s sheet — three dropdowns, ✕ Not now · ✓ Keep this moment in glass', () => {
  const src = read(`${D}/website/our-story/_components/moment-sheet-studio.tsx`);
  assert.match(src, /const studio = maker\?\.stagesStudio === true;/, 'the sheet does not know it is in the Studio');
  /* The app's tokens, never the event's palette, for the fields and their words. */
  const field = /const field = studio\s*\?\s*'([^']+)'/.exec(src)?.[1] ?? '';
  assert.match(field, /bg-white/, 'the Studio’s fields are not white');
  assert.match(field, /text-ink/, 'the Studio’s fields are not ink');
  assert.match(field, /placeholder:text-ink\/45/, 'the Studio’s placeholders are not readable');
  assert.doesNotMatch(field, /--ls-/, 'the Studio’s fields wear the event’s palette');
  assert.doesNotMatch(/const eye = studio\s*\?\s*'([^']+)'/.exec(src)?.[1] ?? '--ls-', /--ls-/, 'the Studio’s labels wear the event’s palette');
  /* ONE dropdown per set of choices. */
  for (const [what, attr] of [['When', 'data-moment-when'], ['This one is…', 'data-moment-anchor'], ['Added by', 'data-moment-added-by-pick']] as const) {
    assert.match(src, new RegExp(`studio \\?[\\s\\S]{0,900}?<PickMenu[\\s\\S]{0,200}?dataAttr="${attr}"`), `${what} is not one dropdown in the Studio`);
  }
  assert.match(src, /<input type="hidden" name="anchor" value=\{anchor\} \/>/, 'the anchor dropdown posts nothing');
  assert.match(src, /<input type="hidden" name="added_by" value=\{addedBy\} \/>/, 'the Added by dropdown posts nothing');
  const studioWhen = src.slice(src.indexOf('{studio ? (\n                  <div className="mt-2">'), src.indexOf(') : (\n                <div role="radiogroup"'));
  assert.ok(studioWhen.length > 0 && !/role="radiogroup"|role="radio"/.test(studioWhen), 'the Studio draws the When pills');
  /* The Schedule's sheet, portalled above the sticky bar. */
  assert.match(src, /data-moment-studio-sheet="" className="relative z-\[90\]">\s*<Sheet open onClose=\{\(\) => setOpen\(false\)\} labelledById="moment-sheet-title" wide rise>/, 'not the Schedule’s shared Sheet, lifted above the Studio’s bars');
  assert.match(src, /open && studio && typeof document !== 'undefined' \? createPortal\(/, 'the Studio’s sheet is not portalled to <body>');
  /* ✕ Not now · ✓ Keep this moment, icon + word, in a glass row at the foot. */
  const foot = src.slice(src.indexOf('data-moment-sheet-foot'), src.indexOf('Keep this moment\n'));
  assert.match(foot, /^data-moment-sheet-foot="" className="sn-glass-row sticky bottom-0/, 'the foot is not a glass row pinned to the thumb zone');
  assert.doesNotMatch(foot.slice(0, 120), /bg-cream|shadow-/, 'the glass row has an opaque fill or a shadow of its own');
  assert.match(foot, /<X aria-hidden[^>]*\/>\s*Not now/, '✕ Not now has no icon');
  assert.match(foot, /<Check aria-hidden[^>]*\/>\s*$/, '✓ Keep this moment has no icon');
  /* ⚖ Budget: the Studio's sheet is its own file in the LAZY cards chunk; the first-load sheet is untouched. */
  const shipped = read(`${D}/website/our-story/_components/moment-sheet.tsx`);
  assert.doesNotMatch(shipped, /from '@\/app\/_components\/sheet'|<PickMenu|stagesStudio/, 'the first-load MomentSheet carries the Studio’s form (507 KB)');
  assert.match(read(`${D}/website/our-story/_components/moment-order-cards.tsx`), /import \{ MomentSheetStudio \} from '\.\/moment-sheet-studio';/, 'the Studio’s cards do not open the Studio’s sheet');
    /* No boxed card: the in-place box (ring + shadow) is the shipped Maker's only. */
  assert.match(src, /inMaker && open && !studio \? 'w-full basis-full' : 'contents'/, 'the Studio still opens the boxed in-place card');
});

test('2 · Look › Background: a still is drawn over its swatch and never as a broken image', async () => {
  const P = await import(`../${D}/website/editor/_components/main-background-panel`);
  for (const id of hubMovingBackgroundIds()) {
    assert.match(P.loopSwatch(id, '#fff'), /^linear-gradient\(160deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/i, `${id} has no drawn swatch`);
  }
  const gone = await html(React.createElement(P.StillOverSwatch, { src: null, swatch: P.loopSwatch('galeriya', '#fff') }));
  assert.match(gone, /data-still-over-swatch="loading"[^>]*style="background:linear-gradient/, 'a missing still leaves no swatch');
  assert.doesNotMatch(gone, /<img/, 'a missing still still draws an <img>');
  const drawn = await html(React.createElement(P.StillOverSwatch, { src: '/x.jpg', swatch: '#abc' }));
  assert.match(drawn, /<img[^>]*class="[^"]*opacity-0/, 'a still shows before it has loaded (a broken glyph would show)');
  const src = read(`${D}/website/editor/_components/main-background-panel.tsx`);
  assert.match(src, /onError=\{\(\) => setState\('failed'\)\}/, 'a failed still is not removed');
  const carousel = src.slice(src.indexOf('function GroundCarousel('));
  assert.doesNotMatch(carousel, /<img/, 'the carousel draws a bare <img> again');
  assert.match(carousel, /<StillOverSwatch src=\{o\.thumb\}/, 'the carousel’s pictures are not drawn over a swatch');
});

test('3 · in place, never a link out: Set up E-Gifts opens E-Gifts here; "Same as the Event Hub" is a switch', async () => {
  const details = read(`${L}/maker-details.tsx`);
  assert.doesNotMatch(details, /href=\{`\$\{base\}\/pabuya`\}/, 'Prints links out to the E-Gifts page again');
  assert.match(details, /<OpenInPlace open="Set up E-Gifts" back="Prints" data="gifts">\s*<LateEditor from=\{late\} item="gifts" \/>\s*<\/OpenInPlace>/, 'Set up E-Gifts does not open E-Gifts’ own editor in place');
  assert.match(details, /late\.gifts = editors\.gifts \?\? null;\s*if \(seatPlan\)/, 'the in-place editor is read before E-Gifts’ editor is finished');
  const { OpenInPlace } = await import(`../${L}/open-in-place`);
  const closed = await html(React.createElement(OpenInPlace, { open: 'Set up E-Gifts', back: 'Prints', data: 'gifts' }, React.createElement('i', { 'data-stub': 'gifts' })));
  assert.match(closed, /<button[^>]*data-open-in-place-door="gifts"[^>]*>[\s\S]*<svg[\s\S]*Set up E-Gifts<\/button>/, 'Set up E-Gifts is not an icon + word button');
  assert.doesNotMatch(closed, /data-stub/, 'the E-Gifts editor shows before it is asked for');
  assert.match(read(`${L}/open-in-place.tsx`), /Done · back to \{back\}/, 'no ✓ Done · back to Prints');

  const { FilmFollowsTheme } = await import(`../${L}/film-follows-theme`);
  const film = await html(React.createElement(FilmFollowsTheme, { eventId: 'e' }));
  assert.match(film, /<input[^>]*role="switch"/, '"Same as the Event Hub" is not a switch');
  assert.doesNotMatch(film, /underline/, '"Same as the Event Hub" is a link');
});

test('4 · E-Gifts "Your own words": the starting points are ONE "Start from ▾" dropdown in the Studio', async () => {
  const { PabuyaMessageEditor } = await import(`../${D}/pabuya/_components/pabuya-message-editor`);
  const out = await inStudio(React.createElement(PabuyaMessageEditor, { eventId: 'e', initialMessage: null }));
  assert.match(out, /data-pabuya-start-from=""/, 'no Start from ▾');
  assert.match(out, /aria-haspopup="listbox"[^>]*>[\s\S]*?Start from/, 'Start from is not a dropdown');
  for (const t of PABUYA_TEMPLATES) {
    assert.doesNotMatch(out, new RegExp(`<button[^>]*>${t.name}</button>`), `“${t.name}” is still a chip`);
  }
  /* The E-Gifts page itself keeps its chips until it is redrawn. */
  const page = await html(React.createElement(PabuyaMessageEditor, { eventId: 'e', initialMessage: null }));
  assert.ok(PABUYA_TEMPLATES.every((t) => page.includes(`>${t.name}</button>`)), 'the E-Gifts page lost its starting points');
});

test('5 · Seat plan: the map gets the space — one head row, tools in the thumb zone, the people a pull-up sheet', async () => {
  const P = await import(`../${SEAT}/seat-plan-phone`);
  const head = await html(React.createElement(P.StudioSeatPlanHead, { countLabel: '6 tables', more: React.createElement('p', null, 'more') }));
  assert.match(head, /data-seat-plan-studio-head=""[^>]*class="[^"]*\bh-11\b/, 'the head is not one compact row');
  assert.match(head, /Seat plan[\s\S]*6 tables/);
  assert.match(head, /data-seat-plan-more/, '⋯ is gone');
  assert.doesNotMatch(head, /Auto arrange|Unseated|data-seat-plan-status/, 'the head still carries the tools or the status line');

  const tools = await html(
    React.createElement(P.StudioSeatPlanTools, {
      onAutoArrange: () => {}, autoDisabled: false, autoBusy: false, rules: null, view: '2d', onView: () => {}, show3D: true, toast: null,
    }),
  );
  assert.match(tools, /class="sn-glass-row[^"]*"/, 'the thumb-zone row is not glass');
  for (const want of ['data-seat-plan-auto', 'data-seat-plan-rules', 'data-seat-plan-view']) assert.ok(tools.includes(want), `the thumb zone has no ${want}`);
  assert.match(tools, /<svg[\s\S]*?Auto arrange/, 'Auto arrange has no icon');
  assert.doesNotMatch(tools, /Same layout in 3D/, 'the 3D door card is back — View ▾ holds 3D');

  const peek = await html(
    React.createElement(P.PeopleSheet, { guests: 32, unseated: 0, open: false, onOpen: () => {}, onClose: () => {}, tools: 'TOOLS' }, React.createElement('i', { 'data-stub': 'people' })),
  );
  assert.match(peek, /data-seat-plan-people="peek"/);
  assert.match(peek, /data-seat-plan-people-count="">32 guests · 0 unseated</, 'the peek does not read “32 guests · 0 unseated”');
  assert.match(peek, /hidden=""[^>]*>[\s\S]*data-stub="people"/, 'the people list shows before the sheet is raised');

  const ed = read(`${SEAT}/seating-editor.tsx`);
  assert.match(ed, /const studioSeat = details !== null && isPhone && maker\?\.stagesStudio === true;/);
  assert.match(ed, /const phoneFoot =\s*isPhone && view === 'plan' && !details\?\.lab && !studioSeat \?/, 'the Studio still draws the 3D door card under the map');
  assert.match(ed, /<SeatPlanPortal name="guests" on=\{!studioSeat\}>/, 'the Studio’s people are drawn in the lower third too');
  assert.match(ed, /<PeopleSheet[\s\S]{0,900}?\{guestsNode\}\s*<\/PeopleSheet>/, 'the people sheet does not hold the editor’s own list');
  assert.match(ed, /const openDetailsEditor = \(\) => \(studioSeat \? setPeopleOpen\(true\) : openDetailsEditorShipped\(\)\);/, 'a table tap / Rules / the people do not raise the sheet in the Studio');
  assert.match(ed, /if \(studioSeat && seatPieceKey\) setPeopleOpen\(true\);/, 'tapping a table does not raise the sheet');
  assert.match(ed, /const ro = new ResizeObserver\(fit\);\s*ro\.observe\(region\);/, 'the room is not fitted to the map’s box on open');
  assert.match(ed, /\$\{studioSeat \? 'top-3' : 'bottom-\[64px\] lg:bottom-3'\}/, 'the zoom controls sit under the thumb-zone tools');
  /* Behaviour kept: the same handlers. */
  assert.match(ed, /<StudioSeatPlanTools\s*onAutoArrange=\{runAutoArrange\}/);
  assert.match(ed, /onView=\{onSelectView\}/);
  const css = (await import('./studio-details')).studioFullScreenCss();
  assert.ok(css.includes('[data-details-item="seating"]) [data-details-editor-panel]{display:none}'), 'the lower third still takes the map’s space');
});

test('6 · Look › Music has no Save: an upload or the switch drafts at once; "Play music" is a switch', async () => {
  const src = read(`${D}/website/editor/_components/media-panels.tsx`);
  const panel = src.slice(src.indexOf('export function SiteChromePanel('), src.indexOf('export function VisibilityPanel('));
  assert.match(panel, /\{studio \? null : <SaveButton \/>\}/, 'the Studio still draws Save under Music');
  assert.match(panel, /<HubDraftField \/>/, 'Music no longer writes into the draft');
  assert.equal((panel.match(/onChange=\{draftNow\}/g) ?? []).length, 3, 'the song, the switch and the video do not each draft at once');
  assert.match(panel, /formRef\.current\?\.requestSubmit\(\)/, 'nothing posts the form when a change lands');
  assert.match(panel, /type="checkbox"\s*role="switch"\s*name="bg_music_enabled"/, '“Play music on my Event Hub” is not a switch (same field)');
  const action = read(`${D}/website/site-chrome/actions.ts`);
  assert.match(action, /if \(isHubDraftWrite\(formData\)\) \{[\s\S]{0,500}site_bg_music_r2_key[\s\S]{0,400}landing_page_hero_video_r2_key/, 'the song and the video are not hub-draft fields');
});

test('7 · Mood Board: Palette · Attire · Inspiration · Do’s & Don’ts; the attire boards live in Attire beside their role', async () => {
  const { STUDIO_INSPIRATION_SLOTS, AWAITING_A_SLOT } = await import('./inspiration-slots');
  const src = read(`${D}/studio/mood-board/_components/mood-board-studio.tsx`);
  assert.match(src, /\['colours', 'Palette'\],\s*\['attire', 'Attire'\],\s*\['insp', 'Inspiration'\],\s*\['dos', 'Do’s & Don’ts'\],/, 'the tabs are not Palette · Attire · Inspiration · Do’s & Don’ts (keys kept)');
  const attire = STUDIO_INSPIRATION_SLOTS.filter((s) => s.attire).map((s) => [s.slotKey, s.label]);
  assert.deepEqual(attire, [['bride', 'Bridal gown'], ['groom', 'Groom’s suit'], ['entourage', 'Entourage']], 'the attire boards are not the stored bride · groom · entourage slots');
  assert.deepEqual(AWAITING_A_SLOT.map((a) => a.label), ['Groomsmen', 'Bridesmaids', 'Flower girl', 'Ring bearer'], 'the four boards with no slot are not recorded as waiting');
  assert.match(src, /STUDIO_INSPIRATION_SLOTS\.filter\(\(slot\) => !slot\.attire\)\.map\(slotBoard\)/, 'Inspiration still draws the attire boards');
  assert.match(src, /attireBoardFor\(row\.key\) \? <div data-mood-board-attire-board=\{row\.key\}>\{slotBoard\(attireBoardFor\(row\.key\)!\)\}<\/div> : null/, 'an attire board is not beside its role');
  /* Both sources on every board: its own upload (+) and the suppliers' photos (Search ideas ›). */
  const board = src.slice(src.indexOf('const slotBoard = '), src.indexOf('const bar = ('));
  assert.match(board, /onClick=\{\(\) => openUpload\(slot\.slotKey\)\}/, 'a board cannot take the couple’s own photo');
  assert.match(board, /setSheet\(\{ kind: 'browse', slot \}\)/, 'a board cannot search the suppliers’ photos');
});

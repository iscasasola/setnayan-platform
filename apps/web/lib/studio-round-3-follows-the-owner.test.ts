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
 *   4b · (owner, on the preview 2026-10-08: *only the pills became "Start from ▾"; the rest of the
 *       old editor is still there*) E-Gifts' thank-you words in the Studio: NO box, the help behind
 *       ⓘ, NO Save / Saved — the words go to the draft as they are typed, a refusal is said and the
 *       words stay. The E-Gifts page keeps its editor.
 *   8 · (owner: *"i cannot see it is blank"*; *"maybe show what it could look like with boxes?"*)
 *       an EMPTY Love Story draws the real card arrangement in sample shapes under the three
 *       chapters a story is anchored by; the first real moment replaces it. The Add-a-moment
 *       sheet's helper lines sit behind ⓘ.
 *
 * 🛡 Sabotaged once each (2026-10-08, builder S3b), each red alone: the Studio words wrapped in
 * `sn-tile` → 4b; the help paragraph drawn under the label → 4b; a "Saved" button under the box →
 * 4b; the refusal `<p role="alert">` removed → 4b; `isTrusted` typing no longer calling `draft` →
 * 4b; `<SampleStory />` removed from the empty state → 8; the sample's photo box drawn 48 px
 * (not the card's) → 8; the sample drawn beside a real moment → 8; a year typed into a sample card
 * → 8; the sample's chapters cut to two (off the three anchors) → 8; the sheet's "When" paragraph
 * put back in the Studio → 8.
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

/** What a person can READ on the screen: the markup without what sits behind an ⓘ, as words. */
function seen(markup: string): string {
  return markup
    .replace(/<span[^>]*role="tooltip"[^>]*><span[^>]*>[\s\S]*?<\/span><\/span>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

test('4b · E-Gifts thank-you words in the Studio: no box, the help behind ⓘ, no Save — drafted as typed, a refusal said', async () => {
  const mod = await import(`../${D}/pabuya/_components/pabuya-message-editor`);
  const el = () => React.createElement(mod.PabuyaMessageEditor, { eventId: 'ev-1', initialMessage: 'Our own words.' });
  const out = await inStudio(el());
  const page = await html(el());

  /* NO BOX — nothing in the Studio's editor is a tile, and its root draws no fill, edge or shadow. */
  assert.doesNotMatch(out, /class="[^"]*\bsn-tile\b/, 'the Studio still draws the thank-you words in a tile');
  const root = /^<div[^>]*class="([^"]*)"/.exec(out)?.[1] ?? 'missing';
  assert.doesNotMatch(root, /\b(?:bg-|ring|shadow|border|rounded|p-\d|px-|py-)/, `the Studio’s thank-you editor is a box of its own (${root})`);
  /* The words are a full-width row of their own, under the label row. */
  assert.match(out, /<\/div><textarea[^>]*class="[^"]*\bw-full\b/, 'the words are not on a full-width row under the label');

  /* THE HELP IS BEHIND ⓘ — what can be read is the label, the dropdown, the couple's words and the count; nothing else. */
  assert.equal(seen(out), 'Your own words i Start from Our own words. 586 characters left', 'the Studio shows more (or less) than the label · Start from · the words · the count');
  const tip = /role="tooltip"[^>]*><span[^>]*>([\s\S]*?)<\/span>/.exec(out)?.[1] ?? '';
  const pageHelp = [...page.matchAll(/<p class="(?:max-w-prose|mt-2 text-xs)[^"]*">([\s\S]*?)<\/p>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, '')).join(' ');
  assert.ok(words(pageHelp) > 40, 'the E-Gifts page’s own help was not found to measure against');
  assert.ok(words(tip) > 0 && words(tip) <= words(pageHelp) * 0.4, `the ⓘ is not at least 60% shorter than the help it replaces (${words(tip)} of ${words(pageHelp)} words)`);

  /* NO SAVE, NO "SAVED" — every button is the ⓘ or the one dropdown. */
  const buttons = [...out.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(buttons.length, 2, 'the Studio’s thank-you editor has a button that is neither its ⓘ nor Start from ▾');
  assert.ok(buttons.every((b) => /aria-describedby=|aria-haspopup="listbox"/.test(b)), 'a per-field button (Save / Saved?) is drawn in the Studio');
  /* …and nothing says the words are live: they wait for ✓ Apply. */
  assert.doesNotMatch(out, /data-hub-saves-immediately/, 'the drafted words still say “Guests see this right away”');

  /* TYPED → THE DRAFT, on the Studio's own branch. */
  const src = read(`${D}/pabuya/_components/pabuya-message-editor.tsx`);
  const studio = src.slice(src.indexOf('function StudioThanks('), src.indexOf('function ShippedEditor('));
  assert.ok(studio.length > 0, 'no Studio branch');
  assert.match(studio, /onChange=\{\(e\) => \{\s*const words = type\(e\.target\.value\);\s*if \(e\.nativeEvent\.isTrusted\) draft\(words\);/, 'typing does not reach the draft');
  assert.match(studio, /draft\(type\(t\.body\)\);/, 'a starting point picked is not drafted');
  assert.match(studio, /makerLatestWrite\(THANKS_WRITE_KEY, \(\) => \{[\s\S]{0,260}fd\.set\(HUB_DRAFT_FIELD, '1'\);\s*return savePabuyaMessage\(fd\);/, 'the typed words are not sent into the DRAFT');
  assert.match(studio, /if \(res\.ok\) \{\s*sayNotDrafted\(null\);\s*makerNeedsRender\(\);/, 'a drafted write does not move the ✓ Apply count');
  assert.match(studio, /\}\s*sayNotDrafted\(\{ eventId, why: res\.error \}\);/, 'a refused write says nothing');

  /* A REFUSAL IS SAID, in this event's editor only — and the words stay in the box. */
  mod.sayNotDrafted({ eventId: 'ev-1', why: 'Could not save your message. Please try again.' });
  try {
    const refused = await inStudio(el());
    assert.match(refused, /<p role="alert"[^>]*>These words are not in your draft yet\. Could not save your message\. Please try again\./, 'a refused draft write is not said');
    assert.match(refused, /<textarea[^>]*>Our own words\.<\/textarea>/, 'a refusal threw the couple’s words away');
    const other = await inStudio(React.createElement(mod.PabuyaMessageEditor, { eventId: 'ev-2', initialMessage: null }));
    assert.doesNotMatch(other, /role="alert"/, 'one event’s refusal is said on another event');
  } finally {
    mod.sayNotDrafted(null);
  }

  /* The E-Gifts page keeps its editor: its tile, its help, its Save. */
  assert.match(page, /^<section class="sn-tile/, 'the E-Gifts page lost its tile');
  assert.match(page, /<button[^>]*class="button-primary"[^>]*>Saved<\/button>/, 'the E-Gifts page lost its Save');
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
  assert.match(panel, /type="checkbox"\s*role=\{studio \? 'switch' : undefined\}\s*name="bg_music_enabled"/, '“Play music on my Event Hub” is not a switch in the Studio (same field)');
  assert.match((await import('./studio-details')).studioFullScreenCss(), /\[data-music-switch\] input\[role=switch\]:checked/, 'the Studio’s CSS does not draw the music switch');
  const action = read(`${D}/website/site-chrome/actions.ts`);
  assert.match(action, /if \(isHubDraftWrite\(formData\)\) \{[\s\S]{0,500}site_bg_music_r2_key[\s\S]{0,400}landing_page_hero_video_r2_key/, 'the song and the video are not hub-draft fields');
});

test('7 · Mood Board: Palette · Attire · Inspiration · Do’s & Don’ts; the attire boards live in Attire beside their role', async () => {
  const { STUDIO_INSPIRATION_SLOTS, AWAITING_A_SLOT } = await import('./inspiration-slots');
  const src = read(`${D}/studio/mood-board/_components/mood-board-studio.tsx`);
  assert.match(src, /\['colours', 'Palette'\],\s*\['attire', 'Attire'\],\s*\['insp', 'Inspiration'\],\s*\['dos', 'Do’s & Don’ts'\],/, 'the tabs are not Palette · Attire · Inspiration · Do’s & Don’ts (keys kept)');
  const attire = STUDIO_INSPIRATION_SLOTS.filter((s) => s.attire).map((s) => [s.slotKey, s.label]);
  /* 👗 Seven since 2026-10-08 (owner: "go" on the four's slots, migration 20271266380994) — his order, the
     whole party's board kept last. `four-more-attire-boards.test.ts` draws them. */
  assert.deepEqual(
    attire,
    [['bride', 'Bridal gown'], ['groom', 'Groom’s suit'], ['bridesmaids', 'Bridesmaids'], ['groomsmen', 'Groomsmen'], ['flower_girl', 'Flower girl'], ['ring_bearer', 'Ring bearer'], ['entourage', 'Entourage']],
    'the attire boards are not Bridal gown · Groom’s suit · Bridesmaids · Groomsmen · Flower girl · Ring bearer · Entourage',
  );
  assert.deepEqual(AWAITING_A_SLOT.map((a) => a.label), [], 'a board that has its slot is still recorded as waiting');
  assert.match(src, /STUDIO_INSPIRATION_SLOTS\.filter\(\(slot\) => !slot\.attire\)\.map\(slotBoard\)/, 'Inspiration still draws the attire boards');
  assert.match(src, /\{attireBoardsUnder\(row\.key\)\.map\(\(slot\) => \(\s*<div key=\{slot\.slotKey\} data-mood-board-attire-board=\{slot\.slotKey\}>\s*\{slotBoard\(slot\)\}\s*<\/div>\s*\)\)\}/, 'an attire board is not beside its role');
  assert.match(src, /\{attireBoardsAfter\(props\.attire\.map\(\(r\) => r\.key\)\)\.map\(\(slot\) => \(\s*<div key=\{slot\.slotKey\} data-mood-board-attire-board=\{slot\.slotKey\}>\s*\{slotBoard\(slot\)\}/, 'a board whose role is not on the list yet has no place');
  /* Both sources on every board: its own upload (+) and the suppliers' photos (Search ideas ›). */
  const board = src.slice(src.indexOf('const slotBoard = '), src.indexOf('const bar = ('));
  assert.match(board, /onClick=\{\(\) => openUpload\(slot\.slotKey\)\}/, 'a board cannot take the couple’s own photo');
  assert.match(board, /setSheet\(\{ kind: 'browse', slot \}\)/, 'a board cannot search the suppliers’ photos');
});

test('8 · Love Story: an EMPTY story draws its real arrangement in sample shapes; the sheet’s help sits behind ⓘ', async () => {
  const { MomentOrderCards } = await import(`../${D}/website/our-story/_components/moment-order-cards`);
  const { LOVE_STORY_CHAPTER_LABEL, MOMENT_ANCHORS } = await import('./love-story-moments');
  const action = async () => {};
  const cards = (moments: readonly unknown[]) =>
    inStudio(
      React.createElement(MomentOrderCards as React.ComponentType<Record<string, unknown>>, {
        action,
        moments,
        mediaUrls: {},
        sheet: { action, moments, partners: ['Maria', 'Jose'], ownsPro: false, storeShell: false, proHref: '/p', proPrice: null, eventId: 'ev-1', mediaUrls: {} },
        add: { can: true },
      }),
    );
  const empty = await cards([]);
  const one = await cards([{ id: 'u', chapter: 'met', date: { y: 2019 }, title: 'One umbrella', line: 'A rainy Tuesday.', order: 0, canvas: {} }]);

  /* An empty story is not a blank page: one sample card under each chapter a story is anchored by. */
  const sample = /<ol data-studio-story-sample=""[^>]*>[\s\S]*?<\/ol>/.exec(empty)?.[0] ?? '';
  assert.ok(sample, 'an empty Love Story draws no sample layout (a blank page)');
  assert.match(sample, /^<ol data-studio-story-sample="" aria-hidden="true" class="[^"]*pointer-events-none/, 'the sample is read out, or can be tapped');
  assert.equal((sample.match(/<li data-studio-story-sample-card=/g) ?? []).length, MOMENT_ANCHORS.length, 'not one sample card per anchored chapter');
  /* Unmistakably a sample: the only words are the three real chapter labels — no name, no year, no line of a moment. */
  assert.equal(seen(sample), MOMENT_ANCHORS.map((a: keyof typeof LOVE_STORY_CHAPTER_LABEL) => LOVE_STORY_CHAPTER_LABEL[a]).join(' '), 'the sample carries words that are not the real chapter labels');
  /* The REAL arrangement: the sample card's row, photo box and words column are the real card's own. */
  const rowOf = (li: string) => /<div class="([^"]*)">/.exec(li)?.[1];
  const realCard = /<li data-moment-card="u"[\s\S]*?<\/li>/.exec(one)?.[0] ?? '';
  const sampleCard = /<li data-studio-story-sample-card="met"[\s\S]*?<\/li>/.exec(sample)?.[0] ?? '';
  assert.ok(rowOf(realCard) && rowOf(realCard) === rowOf(sampleCard), 'the sample card is not laid out as a real card');
  const box = (markup: string) => /class="(h-\d+ w-\d+ shrink-0 rounded-md)\b/.exec(markup)?.[1];
  assert.ok(box(realCard) && box(realCard) === box(sampleCard), `the sample’s photo is not the card’s photo box (${box(sampleCard)} vs ${box(realCard)})`);
  for (const shape of ['photo', 'year', 'title', 'line']) assert.ok(sampleCard.includes(`data-sample-shape="${shape}"`), `the sample card has no ${shape} shape`);
  assert.match(sampleCard, /lucide-grip-vertical/, 'the sample card has no grip');
  /* …and it is gone the moment one real moment exists. */
  assert.doesNotMatch(one, /data-studio-story-sample/, 'the sample stays beside a real moment');
  assert.match(one, /data-studio-story-head="u"/);
  /* + Add a moment is unchanged, with or without a moment. */
  for (const out of [empty, one]) assert.match(out, /class="[^"]*sn-glass-row[^"]*"><div class="contents"><button[^>]*>[\s\S]*?Add a moment/, 'the + Add a moment bar changed');

  /* The Add-a-moment sheet, in the Studio: each helper line is behind an ⓘ beside its label — never a paragraph. */
  const sheet = read(`${D}/website/our-story/_components/moment-sheet-studio.tsx`);
  for (const label of ['When', 'This one is…']) {
    assert.match(sheet, new RegExp(`\\{studio \\? \\(\\s*<legend>\\s*<InfoTip label="${label}" labelClassName=\\{eye\\}`), `“${label}” still draws its helper paragraph in the Studio`);
  }
  assert.match(sheet, /\{ownsPro && studio \? \(\s*<InfoTip label="Photos" labelClassName=\{eye\}/, 'Photos’ help is not behind an ⓘ in the Studio');
  assert.match(sheet, /label=\{studio \? undefined : 'Photos'\}\s*help=\{studio \? undefined : /, 'the upload still draws its helper line in the Studio');
  /* Every `quiet` helper paragraph left in the file is the shipped sheet's, or the chapter rule (a consequence, said). */
  const studioBranches = [...sheet.matchAll(/\{studio \? \(([\s\S]*?)\) : \(/g)].map((m) => m[1]!).join('\n');
  assert.doesNotMatch(studioBranches, /<p className=\{`mt-1 text-\[13px\] \$\{quiet\}`\}>/, 'a helper paragraph is drawn on a Studio branch of the sheet');
  /* A field brought into view stops clear of the floating foot: 68 px of foot + the sheet's 16 px bottom padding = 84. */
  const scrollMb = Number(/\bscroll-mb-(\d+)\b/.exec(/const field = studio\s*\?\s*'([^']+)'/.exec(sheet)?.[1] ?? '')?.[1] ?? 0) * 4;
  assert.ok(scrollMb >= 84, `a focused field can stop under the foot (it keeps ${scrollMb} px clear of the sheet’s edge; the foot takes 84)`);
});

test('9 · Studio › RSVP: Reply by is CHANGED on its row — the label, the date field, nothing else; drafted', async () => {
  /* Owner on the preview 2026-10-08, verbatim: *"where it the reply by date?"* → *"date is not changeable on
     studio."* The row printed the date read-only ("set on Guests › Setup or in Event Details"), so the new Maker
     had no place to change it on a phone. His rule: no go-elsewhere — the control is right there; and "draft
     1-3": Reply by is edited in the Maker and waits for ✓ Apply.
     🛡 Sabotaged once each (2026-10-08, S3b), each red alone: the Studio layout's `{field}` swapped for the
     printed date → no date field; `REPLY_BY_LINE` drawn under the label → more than the label; the Studio mount
     without `draft` → the mount; `data-writes-live=""` put on the Studio row → it says it is live. */
  const { ReplyBy } = await import(`../${D}/_components/guest-setup/reply-by`);
  const { STUDIO_ROW } = await import('./studio-skin');
  const props = { eventId: 'e-1', own: '2027-01-14', pricingMode: 'final_only' as const, fallback: '2026-11-12', action: (async () => ({ ok: true })) as never };
  const row = await html(React.createElement(ReplyBy, { ...props, layout: 'studio', draft: true, rowClassName: STUDIO_ROW }));
  /* ONE row, the Studio's own — and a field a finger can change. */
  assert.match(row, new RegExp(`^<section class="${STUDIO_ROW.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" [^>]*data-rsvp-setting="reply-by"`), 'Reply by is not one Studio row');
  assert.equal((row.match(/<input\b/g) ?? []).length, 1, 'the Studio’s Reply by row has no field (or more than one control)');
  const field = /<input\b[^>]*>/.exec(row)?.[0] ?? '';
  assert.match(field, /type="date"/, 'the row’s field is not a date field');
  assert.match(field, /value="2027-01-14"/, 'the row’s field is not the couple’s date');
  assert.match(field, /aria-label="Reply by"/, 'the field has no name');
  assert.doesNotMatch(field, /disabled|readonly/i, 'the date cannot be changed');
  /* Nothing else: the label is the only words; no button, no box, no "Saved", no "Guests see this right away". */
  assert.equal(seen(row), 'Reply by', 'the row says more than its label');
  assert.doesNotMatch(row, /<button\b|sn-tile|data-hub-saves-immediately|data-writes-live/, 'the row carries a button, a box or a "live" mark');
  /* The 30-day default fills the field while the couple has no date of their own. */
  assert.match(await html(React.createElement(ReplyBy, { ...props, own: null, layout: 'studio', draft: true })), /<input\b[^>]*value="2026-11-12"/, 'the default date is not in the field');
  /* The other doors are as they were: Setup's row keeps its sentence and its live mark; the stage's stack its default link. */
  assert.match(await html(React.createElement(ReplyBy, { ...props, layout: 'row' })), /data-reply-by-field="live" data-writes-live=""[\s\S]*Your invitation asks guests to reply by this day\./, 'Guests › Setup’s Reply by row changed');
  assert.match(await html(React.createElement(ReplyBy, { ...props, layout: 'stack', draft: true })), /January 14, 2027[\s\S]*· your date[\s\S]*Use the default/, 'the stage’s Reply by field changed');
  /* Mounted in the Studio branch, drafted, with the writer. */
  const ask = read(`${L}/maker-rsvp-ask.tsx`);
  const studio = ask.slice(ask.indexOf('data-studio-rsvp=""'), ask.indexOf('data-rsvp-setting="how-guests-answer"'));
  assert.match(studio, /<ReplyBy\s+layout="studio"[\s\S]*?rowClassName=\{STUDIO_ROW\}\s+action=\{replyByAction\}\s+draft\s*\/>/, 'Studio › RSVP does not mount the editable row, drafted');
  assert.doesNotMatch(read(`${D}/_components/guest-setup/reply-by.tsx`), /layout === 'print'|'print'/, 'the read-only print layout is back');
});

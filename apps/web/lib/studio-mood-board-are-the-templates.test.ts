/**
 * studio-mood-board-are-the-templates.test.ts — EVERY CONTROL ON STUDIO › MOOD BOARD & DRESS CODE IS A TEMPLATE'S (2026-10-09;
 * `INTERACTION_RULES.md` § 9, approved gallery `prototypes/control_templates_2026-10-08.html`). The pattern is
 * `studio-egifts-are-the-templates`: RENDER the page in its sections and read what is drawn, then read the source of what draws it.
 *
 * The page's controls → kind (the map):
 *   Palette · Attire · Inspiration · Do's & Don'ts      → Pill selector (`ISegmented`; four sections is the owner's open call — unchanged)
 *   ✨ Auto · Compare · Use as my five main colours ·
 *   Use for … · Keep · Undo it · Search ideas ·
 *   Add another · Remove (a row) · Make more           → Action button (`ActionButton`; one filled forward step per row)
 *   a main colour · a room part · a flower part        → Form row (`FormRow`) with the colour pill that opens the ONE picker
 *   a supplier's suggested change                      → Form row (a notice) + Action buttons
 *   what to wear (per role)                            → Dropdown (`ChosenRow` over `PickMenu`)
 *   Upload your own photos — which part?               → Dropdown (`ChosenRow`)
 *   the headings' longer lines                         → ⓘ explanation (`Explain`)
 *   a result · an Undo                                 → Messages: the top toast (`PeekToast`, its Undo is its action)
 *   a failure · a refusal to read in full              → Messages: a status line on the page, plain words
 *   a photo comes off                                  → Messages: the centred confirm box (`GuestPopup kind="confirm"`)
 *   a do · a don't                                     → Form row (`TypedRow` with `fieldName`, posted by the form)
 *   how the do's and don'ts look                       → Dropdown (`ChosenRow`)
 *   a role's colours                                   → the colour circles (kind 21) — a swatch that opens the ONE picker
 *   NOT a template control (and why):
 *     · the ＋ photo tile — the Upload kind's tile, but not the shared `FileUpload`: the board's shipped write (`uploadMoodboardSlot`)
 *       takes the photo itself, with the colours read from it, so a presigned device-to-storage upload would need a new server action;
 *     · the photo's ✕ — the Action button, icon only (a mark everyone reads the same way), asking through the confirm box;
 *     · the Auto sheet's suggestion rows — List rows (kind 15): there is no shared list-row source yet;
 *     · "Search ideas"'s gallery (`GalleryPicker`) — shared with the shipped Inspiration board, not part of this move;
 *     · the figure and the palette strips — drawings.
 *
 * RULES (each sabotaged, SEEN RED, restored — see the commit): (1) every button is a template's · (2) nothing is typed in a bare input,
 * textarea or select · (3) the colours, the outfits and the lists are Form rows in lists with the one hairline · (4) a choice is the
 * one dropdown (no `<PickMenu` on the page) · (5) no colour of the page's own on a control · (6) a result is the top toast and a
 * failure is a status line (no strip of the page's own, no raw server text) · (7) a photo comes off through the confirm box ·
 * (8) the first load: every file of the page is lazy — none is imported by a first-load Maker file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { ...load.call(this, request, ...rest), useRouter: () => ({ refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }) };
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const MB = 'app/dashboard/[eventId]/studio/mood-board/_components';
const STUDIO = `${MB}/mood-board-studio.tsx`;
const DOS = `${MB}/studio-dos.tsx`;
const AUTO = `${MB}/auto-palette-sheet.tsx`;

async function html(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
const PALETTE = { reception: ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'], bride: ['#F7F2EC', '#D9C4CF'], groom: ['#2C2A29'] };
const base = {
  eventId: 'E1',
  palette: PALETTE,
  fallbackFive: PALETTE.reception,
  frozenDressing: ['florals'],
  changes: [{ id: 'c1', who: 'Your florist', what: 'Bouquets', from: '#F2C8C2', to: '#C99A9A' }],
  attire: [
    { tier: 'roles', key: 'bride', label: 'The bride', paletteKey: 'bride', arrives: null },
    { tier: 'roles', key: 'groom', label: 'The groom', paletteKey: 'groom', arrives: '2:00 PM' },
    { tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null },
  ],
  dressConfig: { roles: {} },
  attireStyles: [{ key: 'long_gown', label: 'Long gown' }],
  inspirations: [{ slot_key: 'flowers', slot_position: 1, image_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', credit: null, swatches: ['#C99A9A'] }],
  autoThemes: [],
  regions: [],
  dosLists: { dos: ['Lean into the palette'], donts: ['No white', 'No jeans'], incStarter: true },
  dosLookCanvas: {},
};
async function page(over: Record<string, unknown> = {}) {
  const { MoodBoardStudio } = await import(`../${STUDIO}`);
  return html(React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, { ...base, ...over }));
}
const STATES = async () => ({
  palette: await page({ startTab: 'colours' }),
  paletteQuiet: await page({ startTab: 'colours', changes: [] }),
  attire: await page({ startTab: 'attire' }),
  attireNoDress: await page({ startTab: 'attire', dressConfig: null }),
  insp: await page({ startTab: 'insp' }),
  inspNoPhotos: await page({ startTab: 'insp', inspirations: [] }),
  dos: await page({ startTab: 'dos' }),
  dosNoLook: await page({ startTab: 'dos', dosLookCanvas: null }),
  dosUnread: await page({ startTab: 'dos', dosLists: null }),
});
const tagsOf = (markup: string, tag: string) => [...markup.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => m[0]);
const count = (markup: string, re: RegExp) => (markup.match(re) ?? []).length;

test('1 · every button is a template’s: the action button, the Form row’s pill, the dropdown, the ⓘ, the pill selector — and the three named drawings', async () => {
  const s = await STATES();
  const ok = /class="ab |data-form-row-pill="|aria-haspopup="(?:dialog|listbox)"|data-explain=|data-seg=|data-mood-board-add=|data-mood-board-role-colour=/;
  for (const [state, markup] of Object.entries(s)) {
    const strays = tagsOf(markup, 'button').filter((b) => !ok.test(b));
    assert.deepEqual(strays, [], `${state}: a button that is not a template’s`);
    assert.doesNotMatch(markup, /<button[^>]*\bstyle=/, `${state}: a control is filled with a colour written on the page`);
  }
  /* the action buttons are the ONE ActionButton (the markup class), with a tone */
  assert.ok(count(s.palette, /class="ab ab-neutral/g) >= 3, 'Auto · Keep · Undo it are not the one ActionButton');
  assert.match(s.palette, /data-mood-board-auto=""><button[^>]*class="ab ab-neutral/, '✨ Auto is not the ActionButton');
  assert.match(s.insp, /class="ab ab-brand ab-main"[^>]*data-main=""><svg[\s\S]*?<span class="lbl">Use as my five main colours/, 'the one filled forward step is not the main ActionButton');
  assert.equal(count(s.insp, /data-main=""/g), 1, 'more than one filled forward step on a screen');
  const src = read(STUDIO);
  assert.doesNotMatch(src, /STUDIO_AUTO_BUTTON|STUDIO_SAVED_PILL|InfoTip/, 'an old hand-made strip is back');
  assert.equal((src.match(/<button\b/g) ?? []).length, 3, 'a hand-made button beside the templates (the colour pill, the ＋ tile and the role’s colour circle are the only three)');
  assert.match(read(AUTO), /<ActionButton tone="neutral" icon=\{Sparkles\} label="Make more"/, 'Make more is not the ActionButton');
  assert.doesNotMatch(read(DOS), /<button\b/, 'the lists draw a hand-made button');
});

test('2 · nothing is typed in a bare input, textarea or select — the do’s and don’ts are Form rows', async () => {
  const s = await STATES();
  for (const [state, markup] of Object.entries(s)) {
    assert.doesNotMatch(markup, /<textarea|<select/, `${state}: a bare textarea or select`);
    const bare = tagsOf(markup, 'input').filter((i) => !/type="hidden"/.test(i) && !/data-mood-board-file=""/.test(i));
    assert.deepEqual(bare, [], `${state}: a bare input`);
  }
  assert.equal(count(s.dos, /data-form-row-pill="typed"/g), 3, 'a do and two don’ts are three typed rows');
  assert.equal(count(s.dos, /<input type="hidden" data-form-pick="" name="dos"/g), 1, 'the kept do is posted under `dos`');
  assert.equal(count(s.dos, /<input type="hidden" data-form-pick="" name="donts"/g), 2, 'the kept don’ts are posted under `donts`');
  assert.match(s.dos, /<input type="hidden" name="draft" value="1"/, 'the lists lost the draft flag');
  assert.doesNotMatch(read(DOS), /<input\b|<textarea\b|<select\b/, 'the lists draw a bare field');
});

test('3 · the colours, the outfits and the lists are Form rows in lists with the one hairline', async () => {
  const s = await STATES();
  assert.equal(count(s.palette, /data-form-rows="mood-board-(?:five|room|flowers)"/g), 3, 'the colours are not three lists of rows');
  assert.equal(count(s.palette, /data-mood-board-colour="main-\d"/g), 5, 'the five main colours are not five tappable colour rows');
  assert.ok(count(s.palette, /data-mood-board-colour="part-/g) >= 8, 'the room and flower parts are not rows');
  /* a part that only follows a main colour (no colour of its own) and one a supplier agreed are shown, never tappable */
  assert.match(s.palette, /<span data-mood-board-colour="part-Stage"/, 'a part with no colour of its own looks tappable');
  assert.match(s.palette, /<span data-mood-board-colour="part-Bridal bouquet"|<span data-mood-board-colour="part-Entourage bouquets"/);
  assert.match(s.palette, /data-form-rows="mood-board-changes"/, 'a supplier’s change is not a row');
  assert.doesNotMatch(s.paletteQuiet, /data-form-rows="mood-board-changes"/, 'an empty list of changes is drawn');
  assert.equal(count(s.attire, /data-form-row-kind="chosen"/g), 3, 'each role’s outfit is not a dropdown row');
  assert.equal(count(s.attireNoDress, /data-form-row-kind="chosen"/g), 0, 'an outfit is offered where the dress code could not be read');
  assert.equal(count(s.attire, /data-form-rows="mood-board-attire"/g), 1, 'the roles are not ONE list');
  assert.equal(count(s.dos, /data-form-rows="dress-(?:dos|donts)"/g), 2);
  assert.doesNotMatch(s.palette + s.attire, /border-b border-ink\/10 px-1 py-1\.5/, 'a hand-made row is back');
  assert.match(s.attire, /data-mood-board-role="bride"[^>]*data-form-row-kind="chosen"|data-form-row-kind="chosen"[^>]*data-mood-board-role="bride"/, 'the bride’s row lost its mark');
});

test('4 · a choice is the one dropdown — no PickMenu of the page’s own', async () => {
  const src = read(STUDIO);
  assert.doesNotMatch(src, /<PickMenu\b/, 'the page draws a dropdown of its own');
  assert.equal((src.match(/<ChosenRow\b/g) ?? []).length, 2, 'outfit · which part (the page’s two dropdowns)');
  assert.match(read(DOS), /<ChosenRow\b[\s\S]*?DOS_LOOKS\.map/, 'the look is not the one dropdown');
  const s = await STATES();
  assert.match(s.insp, /data-mood-board-upload=""[^>]*aria-haspopup="listbox"|aria-haspopup="listbox"[^>]*data-mood-board-upload=""/, '“Upload your own photos” is not a dropdown');
  assert.match(s.dos, /aria-haspopup="listbox"/, 'the look dropdown is missing');
  assert.doesNotMatch(s.dosNoLook, /data-dos-look=""/, 'a look is offered where the event has no Dress code scene (a pick that changes nothing)');
  assert.match(s.dos, /data-dos-look=""/);
});

test('5 · no colour of the page’s own on a control — the accent is the token, nothing is filled by hand', () => {
  const HAND = /\bbg-(?:terracotta|mulberry|gild|gold|success|emerald|green|red|amber|ink)\b(?!\/)|\btext-(?:terracotta|mulberry|gild)|\bborder-(?:terracotta|mulberry)|\bring-(?:terracotta|mulberry)/;
  for (const f of [STUDIO, DOS]) assert.doesNotMatch(read(f), HAND, `${f} writes a colour of its own`);
  /* The only literal colour is the figure's skin tone (a drawing). */
  const hexes = [...read(STUDIO).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  assert.deepEqual(hexes, ['#E9D9C8'], 'a hex colour is written on the page');
  assert.match(read(STUDIO), /text-sn-accent/, 'the page’s marks are not the accent token');
});

test('6 · a result is the top toast (Undo is its action); a failure is a line on the page in plain words — no strip of the page’s own', () => {
  const src = read(STUDIO);
  assert.match(src, /<PeekToast\s+key=\{toast\.n\}[\s\S]*?action=\{toast\.undo \? \{ label: 'Undo'/, 'Undo is not the toast’s action');
  assert.match(src, /createPortal\(\s*<PeekToast/, 'the toast is not drawn on the body');
  assert.match(src, /<p role="alert" data-mood-board-save=/, 'a failure has no line on the page');
  assert.doesNotMatch(src, /data-mood-board-note|Not saved — try again/, 'the old note strip or the old red chip is back');
  assert.doesNotMatch(src, /<ActionButton[^>]*label="Undo"/, 'an Undo is a button of the page’s own beside the toast');
});

test('7 · a photo comes off through the centred confirm box — keep first, the removal danger — and a tap on the dark is "keep"', () => {
  const src = read(STUDIO);
  assert.match(src, /<GuestPopup kind="confirm" onClose=\{onKeep\}/, 'a tap on the dark would not close it as keep');
  assert.match(src, /keep=\{<ActionButton tone="neutral" icon=\{X\} label="Keep" onClick=\{onKeep\} \/>\}/);
  assert.match(src, /<ActionButton tone="danger" main icon=\{Trash2\} label="Remove" onClick=\{onRemove\} \/>/);
  assert.match(src, /onClick=\{\(\) => setAskRemove\(\{ slot: slot\.slotKey, pos, label: slot\.label \}\)\}/, 'the ✕ removes without asking');
  assert.doesNotMatch(src, /onClick=\{\(\) => (?:void )?removePhoto\(/, 'the ✕ calls the removal directly');
});

test('8 · the first load: the page’s files and the templates they pull in are lazy — none is imported by a first-load Maker file', () => {
  /* The Maker's first-load JavaScript is at its ceiling. The Mood Board studio rides the `maker-mood-board` chunk (`mood-board-lazy.tsx`). */
  const lazy = readFileSync(join(WEB, `${MB}/mood-board-lazy.tsx`), 'utf8');
  assert.match(lazy, /import\(\/\* webpackChunkName: "maker-mood-board" \*\/ '\.\/mood-board-studio'\)/, 'the studio is no longer lazy');
  const LAZY = /from '[^']*(?:mood-board-studio|studio-dos|mood-board-actions-context|\/form-row|toast\/peek-toast|\/explain|\/chips|\/fold|guest-popup)'/;
  const firstLoad = [
    `${MB}/mood-board-editor.tsx`,
    `${MB}/dress-code-lists-form.tsx`,
    `${MB}/list-field.tsx`,
    `${MB}/palette-field.tsx`,
    `${MB}/group-attire-field.tsx`,
    `${MB}/role-attire-field.tsx`,
    `${MB}/mood-board-lazy.tsx`,
    'app/dashboard/[eventId]/launch/page.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-details.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-shell.tsx',
    'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx',
  ];
  for (const f of firstLoad) {
    /* A type-only import is erased by the compiler: it ships nothing. */
    const src = read(f).replace(/^import type [^;]*;$/gm, '');
    assert.doesNotMatch(src, LAZY, `${f} imports a lazy Mood Board file or a template the first load must not carry`);
  }
  /* The one thing the server file does hand over is data, never a component: no list form is built for the studio any more. */
  assert.doesNotMatch(read(`${MB}/mood-board-editor.tsx`), /<DressCodeListsForm eventId=\{eventId\} dos=\{studio\.dressLists\.dos\}/, 'the studio is handed a server-built list form again');
});

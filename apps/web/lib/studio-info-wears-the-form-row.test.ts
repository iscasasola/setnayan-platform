/**
 * studio-info-wears-the-form-row.test.ts — STUDIO › INFO IS FORM ROWS.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9; the designer's map `STUDIO_INFO_REDESIGN_2026-10-08_fable.md`; the
 * approved gallery § 6 · § 10 · § 19): *"so first, Info. redesign it based on our rules similar to look? no preview
 * needed since info is just form. but how each row is presented there and create a selector if needed."* ·
 * *"prioritize only what they need to input here"* · *"field follow form row style"*.
 *
 *   (1) WHAT MUST BE TYPED IS FIRST — the event's name (each person's first and last name a typed row; a first name
 *       required; Name style ▾), rendered: pills, no box open on arrival, no Save.
 *   (2) DATE AND VENUE ARE ONE QUIET LINE EACH — the value and where it is changed; nothing to tap.
 *   (3) THE WORDS — Opening line (+ Start from ▾) · Special message · What to bring: a pill each, a long box for a
 *       message; the row carries its fact's door mark so a jump from Stages lands on it.
 *   (4) ONE KEPT ANSWER = ONE REQUEST, NO RENDER OF THE MAKER — every drafted Info row keeps through
 *       `studioDraftKeep`: a held redraw save, the latest write of a fact winning, answering with the Apply bar; no
 *       timer writes, no `router.refresh()`.
 *   (5) THE OPENING LINE HAS ONE DOOR FROM INFO — the draft key ✓ Apply publishes (executed: the draft takes the
 *       patch and keeps the other keys); no Save in the row; the words form's own field stays in the page, hidden,
 *       AFTER the row.
 *   (6) THE OPTIONAL ROWS ARE UNDER ONE FOLD, "MORE FOR GUESTS" — and the rows that change the live Event Hub at
 *       once say so in ONE amber line, once; which rows are live is unchanged.
 *   (7) THE SKIN — a field that draws rows gives up its heading and its padding; the Studio's old box skin never
 *       restyles a Form row's own field; Info has no group headings.
 *   (8) THE WATCH — the files that have moved onto the Form row hand-make no field, switch or dropdown
 *       (`FORM_ROW_SCREENS` — a later builder adds its page here when it moves).
 *
 * Mutations seen RED (2026-10-08), each restored: a first name no longer required → (1); the two people open on
 * arrival although both are named → (1); the fact line given a
 * button → (2); the opening line's pill without its door mark → (3); `studioDraftKeep` through a plain unheld
 * `makerSave` → (4); the print-words `{save}` put back in Info's opening line → (5); a second "right away" line
 * (the address's own no longer hidden) → (6); the old skin restyling the row's field again → (7); the bare
 * "QR code" heading back over the quiet rows → (7); a hand-made
 * `<textarea>` in `studio-info.tsx` → (8).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { emptyHubDraft, mergeHubDraft, sanitizeHubDraftEventValue } from './hub-draft';
import { STUDIO_FORM_HEADS, studioFullScreenCss } from './studio-details';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* The Info rows import the draft door (a server action file): its server-only marks are not for a test run. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const INFO = `${L}/studio-info.tsx`;
const NAME = `${L}/studio-event-name.tsx`;
const TOOLS = `${L}/studio-tools.tsx`;
const DETAILS = `${L}/maker-details.tsx`;
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
/** Draw a component with a test's props (each test hands exactly the props the component names). */
const h = (C: unknown, props: Record<string, unknown>) => React.createElement(C as React.FC<Record<string, unknown>>, props);

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
/** One function's own source, from `export [async] function <name>(` to the next top-level declaration. */
function fn(src: string, name: string): string {
  const at = Math.max(src.indexOf(`export function ${name}(`), src.indexOf(`export async function ${name}(`));
  assert.ok(at >= 0, `anti-vacuity: ${name} was not found`);
  const rest = src.slice(at + 10);
  const end = rest.search(/\n(?:export |function |const [A-Z_]+ = |\/\*\* )/);
  return src.slice(at, end < 0 ? undefined : at + 10 + end);
}

/* ── (1) the event's name ─────────────────────────────────────────────── */

test('(1) what must be typed is first: each name is a typed row, a first name is required, the style is a dropdown — nothing open, no Save', async () => {
  const { StudioEventName } = await import(`../${NAME}`);
  const draw = (initial: unknown) => paint(h(StudioEventName, { eventId: 'ev-1', people: ['Bride', 'Groom'], initial, nameStyle: 'full' }));
  const html = await draw([{ first: 'Maria', last: 'Santos' }, { first: 'Jose', last: 'Dela Cruz' }]);
  // ONE row: the line guests read, composed from the two first names, with its ⓘ — its pill opens the two people.
  assert.match(html, /Event name<\/span>[\s\S]*?aria-label="About Event name"[\s\S]*?<button type="button" data-form-row-pill="opens" aria-expanded="false"[^>]*aria-label="Event name: Maria &amp; Jose\. Tap to change"/);
  // THE CLAIM (owner 2026-10-07, "ONE row that opens the two people in place"): with both names known the parts are
  // shut — in the page, out of reach — so the page starts with one line, not five.
  assert.match(html, /data-form-row-parts="" inert=""/, 'the two people are open on arrival although both are named');
  // Inside it: four typed pills, in the order they are said, and ONE dropdown.
  const parts = html.slice(html.indexOf('data-form-row-parts=""'));
  const pills = [...parts.matchAll(/data-form-row-pill="typed" aria-label="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(pills, ['Bride · first name: Maria. Tap to change', 'Bride · last name: Santos. Tap to change', 'Groom · first name: Jose. Tap to change', 'Groom · last name: Dela Cruz. Tap to change']);
  assert.equal(count(html, /aria-haspopup="listbox"/g), 1);
  assert.match(parts, /aria-label="Name style: Full"/);
  // No box is open, and there is no Save: the only <input> is the still anchor a jump looks for.
  assert.deepEqual(html.match(/<input[^>]*>/g), ['<input hidden="" readOnly="" tabindex="-1" aria-hidden="true" data-studio-name-anchor="" value=""/>']);
  assert.doesNotMatch(html, /<textarea|>\s*Save\s*<|>\s*Saved\s*<|data-form-row-leave/);
  assert.doesNotMatch(html, /Required/, 'a filled name still says Required');
  // With no names yet the row arrives OPEN (what must be typed is in view) and the two FIRST names say Required
  // (highlighted) — the last names do not.
  const blank = await draw([{ first: '', last: '' }, { first: '', last: '' }]);
  assert.match(blank, /data-form-row-pill="opens" aria-expanded="true"/, 'what must be typed is folded away');
  assert.doesNotMatch(blank, /inert/);
  assert.equal(count(blank, /data-form-row-required=""/g), 2, 'a first name is not required — or a last name is');
  assert.equal(count(blank, /data-form-row-needs="answer"/g), 2);
  assert.match(blank, /aria-label="Event name: not set yet\. Close"/);
  assert.match(blank, /<span>Not set yet<\/span>/);
  // One kept name = one drafted write of the name columns, composed as the hero composes them.
  const src = read(NAME);
  assert.match(src, /return studioDraftKeep\(eventId, 'events:names', coupleNameColumns\(next\[0\], next\[1\]\)\);/);
  assert.match(src, /required=\{part === 'first'\}/);
  assert.match(src, /void studioDraftKeep\(eventId, 'events:print_details\.name_style', nameStyleDraftPatch\(pick\)\.events \?\? \{\}\)/);
  // A jump from Stages opens the first name (its field is then the first in the page).
  assert.match(src, /openAsk=\{who === 0 && part === 'first' \? openFirst : 0\}/);
  assert.match(src, /defaultOpen=\{missingAtFirst\}\s*openAsk=\{openFirst\}/);
});

/* ── (2) date and venue ───────────────────────────────────────────────── */

test('(2) date and venue are one quiet line each: the value, where it is changed — and nothing to tap', async () => {
  const { StudioReadOnlyFact } = await import(`../${TOOLS}`);
  const html = await paint(h(StudioReadOnlyFact, { label: 'Date', value: 'Saturday, December 12, 2026', line: 'Set when you book your venue in Suppliers', data: 'date' }));
  assert.match(html, /data-studio-read-only="date"/);
  assert.match(html, /data-form-row-kind="fact"/);
  assert.match(html, />Date<[\s\S]*Saturday, December 12, 2026[\s\S]*Set when you book your venue in Suppliers/);
  assert.doesNotMatch(html, /<button|<input|<select|<textarea|<a /, 'a fact that cannot be changed here looks tappable');
  assert.match(await paint(h(StudioReadOnlyFact, { label: 'Venue', value: null, line: 'x', data: 'venues' })), />Not set yet</);
  const block = read(DETAILS);
  assert.match(block, /editors\.date = <StudioTool part="fact" label="Date" /);
  assert.match(block, /editors\.venues = <StudioTool part="fact" label=\{ye\?\.rows\.venues\?\.label \?\? 'Venue'\} /);
});

/* ── (3) the words ────────────────────────────────────────────────────── */

test('(3) the words: Opening line + Start from ▾, Special message, What to bring — a pill each, a long box for a message', async () => {
  const { StudioOpeningLine, StudioWords, STUDIO_WORDS_MAX } = await import(`../${INFO}`);
  const line = await paint(h(StudioOpeningLine, { eventId: 'ev-1', value: 'Together with their families, request the honour of your presence at their marriage' }));
  assert.match(line, /data-same-field="opening_line" data-form-row-pill="typed" aria-label="Opening line: Together with their families/, 'the pill is not the opening line’s door (a jump from Stages would not find it)');
  assert.match(line, /aria-label="Start from: Formal"/, 'the starting point picked is not named');
  assert.match(line, /aria-label="About Opening line"/);
  assert.doesNotMatch(line, /<input|<textarea|>\s*Save\s*<|Guests see this right away/, 'the opening line still has a box, a Save or a "right away" line');
  const own = await paint(h(StudioOpeningLine, { eventId: 'ev-1', value: 'Come as you are.' }));
  assert.match(own, /aria-label="Start from: Your own"/);
  assert.match(await paint(h(StudioOpeningLine, { eventId: 'ev-1', value: null })), /Add your opening line/);
  for (const [fact, name, empty] of [['special_message', 'Special message', 'Add a message'], ['what_to_bring', 'What to bring', 'Add what to bring']] as const) {
    const html = await paint(h(StudioWords, { eventId: 'ev-1', fact, value: null }));
    assert.match(html, new RegExp(`data-same-field="${fact}" data-form-row-pill="typed" aria-label="${name}: not set yet\\. Tap to change"`));
    assert.match(html, new RegExp(`<span>${empty}</span>`));
    assert.match(html, new RegExp(`aria-label="About ${name}"`));
    assert.doesNotMatch(html, /<textarea|<input|>\s*Save/);
  }
  assert.equal(STUDIO_WORDS_MAX, 600);
  const src = read(INFO);
  assert.equal(count(src, /\blong\b\n/g), 1, 'a message does not open the taller box');
  // Another door of the same fact stays in step — and a door that saves as it is typed is only SHOWN the words.
  assert.match(src, /if \(how === 'quiet'\) \{\s*el\.value = text;\s*continue;\s*\}/);
  assert.match(src, /special_message: \{[\s\S]*?doors: 'quiet',/, 'the special message’s other door would save the same words a second time');
  assert.match(src, /tellOtherDoors\('opening_line', next, 'typed'\);/);
});

/* ── (4) one kept answer = one request ────────────────────────────────── */

test('(4) one kept answer = ONE request and no render of the Maker: a held redraw save, the latest write winning, the Apply bar in the answer', () => {
  const src = read(INFO);
  const keep = fn(src, 'studioDraftKeep');
  // THE CLAIM: `makerRedrawSave` (held — no Maker render is owed) around `makerLatestWrite` around the ONE draft door.
  assert.match(keep, /res = await makerRedrawSave\(\s*\(\) =>\s*makerLatestWrite\(key, \(\) => \{/, 'a kept answer brings a whole render of the Maker, or two quick keeps can land out of order');
  assert.match(keep, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(\{ events \}\)\);\s*fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\);\s*return door\(eventId, fd\);/);
  assert.equal(count(keep, /\bdoor\(/g), 1, 'more than one request per kept answer');
  // The door IS the one draft action — everywhere but the dev lab, which hands its stand-in (nothing else may).
  assert.match(src, /let door: StudioDraftDoor = hubDraftAction;/, 'a kept answer goes somewhere other than the one draft door');
  assert.match(src, /export function setStudioDraftDoor\(next: StudioDraftDoor \| null\): void \{\s*door = next \?\? hubDraftAction;\s*\}/);
  assert.equal(count(src, /\bdoor = /g), 1, 'the door is changed somewhere else');
  assert.match(keep, /if \(Object\.keys\(events\)\.length === 0\) return \{ ok: true \};/, 'an empty patch is still sent');
  // A refusal, and a throw, are answered as NOT kept — with words.
  assert.match(keep, /catch \{\s*return \{ ok: false, error: 'Please try again\.' \};/);
  assert.match(keep, /if \(!res\.ok\) return \{ ok: false, error: res\.error \|\| 'Please try again\.' \};/);
  // No Info row file saves any other way: no plain `makerSave`, no refresh of its own, no timer that writes.
  for (const file of [INFO, NAME]) {
    const s = read(file);
    assert.doesNotMatch(s, /\bmakerSave\(/, `${file} saves outside the one held door`);
    assert.doesNotMatch(s, /router\.refresh|useRouter|setInterval|setTimeout|revalidate/, `${file} asks when nothing happened`);
  }
  // …and the drafted switch in the fold is the same one write (it was an unheld save that re-rendered the Maker).
  assert.match(fn(read(TOOLS), 'StudioQrShown'), /void studioDraftKeep\(eventId, 'events:qr_shown', \{ qr_shown: next \}\)\.then\(\(r\) => \{\s*if \(r\.ok\) return;\s*setOn\(!next\);/);
});

/* ── (5) the opening line's one door ──────────────────────────────────── */

test('(5) the opening line has ONE door from Info: the draft key Apply publishes — no Save; the words form’s field stays, hidden, after the row', () => {
  // EXECUTED: the draft takes exactly this patch, cleans it, and keeps a drafted name style beside it.
  assert.deepEqual(sanitizeHubDraftEventValue('print_details', { opening_line: '  With joyful   hearts ' }), { opening_line: 'With joyful hearts' });
  assert.deepEqual(sanitizeHubDraftEventValue('print_details', { opening_line: null }), { opening_line: null }, 'a cleared opening line cannot be drafted');
  const one = mergeHubDraft(emptyHubDraft(), { events: { print_details: { name_style: 'surname-first' } } });
  assert.deepEqual(mergeHubDraft(one, { events: { print_details: { opening_line: 'With joy' } } }).events.print_details, { name_style: 'surname-first', opening_line: 'With joy' });
  assert.match(read(INFO), /return studioDraftKeep\(eventId, 'events:print_details\.opening_line', \{ print_details: \{ opening_line: next \|\| null \} \}\);/);
  // …and Apply publishes that key (the live writer's own merge).
  assert.match(read('app/dashboard/[eventId]/website/hub-draft-actions.ts'), /draftedPrint && 'opening_line' in draftedPrint \? parsePrintDetails\(\{ opening_line: draftedPrint\.opening_line \}\)\.openingLine : undefined;/);
  // Info's editor of it: the row FIRST, then the words form's own field HIDDEN — and no print-words Save.
  const details = read(DETAILS);
  const at = details.indexOf("if (editors['opening-line'] !== undefined) {");
  assert.ok(at > 0, 'anti-vacuity: the Studio’s opening line was not found');
  const mine = details.slice(at, details.indexOf("if (editors['special-message'] !== undefined) {", at));
  assert.match(mine, /<StudioTool part="opening-line" eventId=\{eventId\} value=\{stored\.openingLine\} \/>\s*<div hidden data-studio-words-form-field="opening_line">\s*\{openingLine\}\s*<\/div>/);
  assert.doesNotMatch(mine, /\{save\}|SaveWords|HubSavesImmediately/, 'Info’s opening line still posts the print-words form (a second door)');
});

/* ── (6) the fold, and the one amber line ─────────────────────────────── */

test('(6) the optional rows are under ONE fold "More for guests"; the live rows say so in ONE amber line; which rows are live is unchanged', () => {
  const tools = read(TOOLS);
  const hub = fn(tools, 'StudioHubSettings');
  assert.match(hub, /<Fold data="more-for-guests" title="More for guests" summary="the address, who can view, the QR">/);
  assert.equal(count(hub, /<Fold\b/g), 1);
  // Everything optional is INSIDE it: the address, the three settings, the Event Bar, the QR.
  const inside = hub.slice(hub.indexOf('<Fold '), hub.indexOf('</Fold>'));
  for (const piece of ['name="Event Hub address"', '<LaunchStdButton ', 'name="Who can view"', 'name={WHICH_VERSION_LABEL}', 'name="Event Bar"', '<StudioQrShown ', '{qrLook}', '<StudioQrActions ']) {
    assert.ok(inside.includes(piece), `${piece} is not inside the fold`);
  }
  // ONE amber line, once — and the address's own "Guests see this right away" steps aside for it.
  assert.equal(count(hub, /\{STUDIO_LIVE_LINE\}/g), 1, 'the "right away" line is said more than once (or not at all)');
  assert.match(hub, /<p data-studio-live-line="" className="[^"]*text-warn-700">/, 'the line is not the quiet amber one');
  assert.match(hub, /\[&_\[data-hub-saves-immediately\]\]:hidden/, 'the address still says it a second time');
  assert.match(tools, /export const STUDIO_LIVE_LINE = 'These change your Event Hub right away — not on ✓ Apply: the address, Go live, who can view, which version guests see, and the Event Bar\.';/);
  // Which rows are live is unchanged: the shipped actions, each as before.
  assert.match(hub, /updateLandingPageVisibility\(stayForm\(eventId, \{ visibility: next \}\)\)/);
  assert.match(hub, /setOpenBrowse\(stayForm\(eventId, \{ open_browse: writes\.openBrowse! \}\)\)/);
  assert.match(hub, /setLaunchPhase\(stayForm\(eventId, \{ launch_phase: writes\.launchPhase \}\)\)/);
  assert.match(hub, /onChange=\{\(\) => maker\.eventBar\?\.toggle\(\)\}/);
  // A read that failed is SAID — the address and the QR are still there.
  assert.match(hub, /data-studio-hub-unread=""/);
  // The Maker hands it the address's own editor, the QR's look and its state; the quiet rows stay last, outside.
  const details = read(DETAILS);
  assert.match(details, /part="hub"\s+eventId=\{eventId\}\s+slug=\{slug\}\s+hub=\{st\.hub\}\s+address=\{editors\.address\}/);
  assert.match(details, /editors\.qr = <StudioTool part="quiet" \/>;/);
});

/* ── (7) the skin ─────────────────────────────────────────────────────── */

test('(7) a field that draws rows gives up its heading and padding; the old box skin never restyles a row’s own field; Info has no headings', () => {
  const css = studioFullScreenCss();
  const field = '[data-details-workspace] [data-details-form-field]:has([data-studio-info-rows])';
  assert.ok(css.includes(`${field}{gap:0;padding-top:0;padding-bottom:0}`), 'a row sits inside the old band’s padding');
  assert.ok(css.includes(`${field} > [data-details-form-heading]{display:none}`), 'a row is named twice (the form’s heading over it)');
  assert.ok(css.includes('[data-studio-info-rows] + [data-studio-info-rows]{border-top:1px solid rgb(var(--color-ink)/.1)}'), 'two lists in one field have no line between them');
  // The last field holds only the quiet rows (the QR is in the fold): no bare "QR code" heading over them.
  assert.ok(css.includes('[data-details-workspace] [data-details-editor]:has(> [data-studio-quiet]) > [data-details-form-heading]{display:none}'), 'a bare "QR code" heading shows under the fold with nothing beneath it');
  assert.match(read(TOOLS), /<FormRows data="quiet" attrs=\{\{ 'data-studio-quiet': '' \}\} className="mt-4">/, 'anti-vacuity: the quiet rows’ mark moved');
  // At EVERY width: these three are outside the phone's media block.
  assert.ok(css.indexOf(`${field}{gap:0`) > css.lastIndexOf('@media'), 'anti-vacuity');
  assert.ok(css.indexOf(`${field}{gap:0`) > css.indexOf('[data-music-switch]'), 'the Info rows’ skin is inside the phone-only block');
  // THE CLAIM: the 44-px warm box skin (14 px type) excludes the template's field (a full pill, 16 px so a phone does not zoom).
  assert.match(css, /:is\(input:not\(\[type\]\),input\[type=text\],[^)]*textarea\):not\(\[data-form-row-input\]\)\{min-height:44px;/, 'the Studio’s old box skin restyles the Form row’s own field');
  assert.match(read('app/_components/form-row.tsx'), /'data-form-row-input': '',/);
  // No "Your event" / "Your Event Hub" headings: the page opens on its first input.
  assert.equal(STUDIO_FORM_HEADS.names, undefined);
  assert.equal(STUDIO_FORM_HEADS.address, undefined);
  assert.ok(STUDIO_FORM_HEADS.invitation, 'anti-vacuity: Prints kept its headings');
});

/* ── (8) the watch ────────────────────────────────────────────────────── */

/**
 * The screens that have moved onto the Form row. In them a field, a switch or a dropdown is the template's — never
 * hand-made. A whole file, or named functions of a file that also holds screens which have not moved yet.
 * ➕ When a page moves onto the Form row, add its file (or its functions) here.
 */
const FORM_ROW_SCREENS: Array<{ file: string; only?: string[] }> = [
  { file: INFO },
  { file: NAME },
  { file: TOOLS, only: ['StudioReadOnlyFact', 'StudioHubSettings', 'StudioQrShown'] },
];
const HAND_MADE: Array<{ what: string; re: RegExp }> = [
  { what: 'a text box of its own (`<textarea>`)', re: /<textarea\b/ },
  /* The one `<input>` allowed is a `hidden` one that holds nothing (a still anchor). */
  { what: 'a field of its own (`<input>`)', re: /<input\b(?! hidden readOnly)/ },
  { what: 'a native `<select>`', re: /<select\b/ },
  { what: 'a switch of its own (`role="switch"`)', re: /role="switch"/ },
  { what: 'a dropdown outside the row (`<PickMenu>` — use `ChosenRow`)', re: /<PickMenu\b/ },
  { what: 'a Save button', re: />\s*Save\s*</ },
  { what: 'a "Saved" word (the tick in the pencil’s place says it)', re: />\s*Saved\b/ },
];

test('(8) the watch: a screen on the Form row hand-makes no field, switch or dropdown', () => {
  let read_ = 0;
  for (const { file, only } of FORM_ROW_SCREENS) {
    const src = read(file);
    const parts = only ? only.map((name) => ({ name, body: fn(src, name) })) : [{ name: file, body: src }];
    for (const { name, body } of parts) {
      assert.ok(body.length > 200, `anti-vacuity: ${name} was not read`);
      read_ += 1;
      assert.match(body, /<(TypedRow|ChosenRow|SwitchRow|FactRow|FormRow)\b/, `${name} draws no Form row at all`);
      for (const { what, re } of HAND_MADE) {
        const line = body.split('\n').find((l) => re.test(l));
        assert.equal(line, undefined, `${name} draws ${what}: ${line?.trim().slice(0, 120)}`);
      }
    }
  }
  assert.equal(read_, 5, 'anti-vacuity: a watched screen was skipped');
});

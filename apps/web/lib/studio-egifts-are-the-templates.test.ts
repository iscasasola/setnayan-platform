/**
 * studio-egifts-are-the-templates.test.ts — EVERY CONTROL ON STUDIO › E-GIFTS IS A TEMPLATE'S (2026-10-09; `INTERACTION_RULES.md` § 9,
 * approved gallery `prototypes/control_templates_2026-10-08.html`). The pattern is `setup-controls-are-the-templates` /
 * `the-templated-card-holds-no-hand-made-control`: RENDER the page in its states and read what is drawn, then read the source of what draws it.
 *
 * The page's controls → kind (the map):
 *   Accept gifts?                         → Switch        (`AnswerPicker as="switch"` → `SwitchRow`)
 *   GCash · Maya · Bank · PayPal          → Switch        (`SwitchRow`)
 *   a way's number · name on the account  → Form row      (`TypedRow`, the pill with a pencil)
 *   Registry link                         → Form row      (`TypedRow`, with a check — never sent when it is not a link)
 *   Add your QR                           → Upload        (the shared `FileUpload`)
 *   Your own words                        → Form row      (`TypedRow`, long) + ⓘ (`Explain`)
 *   Start from                            → Dropdown      (`ChosenRow` over `PickMenu`)
 *   Try again (the other door's refusal)  → Action button (`ActionButton`)
 *   What guests see                       → no control (the guest page's own cards, `pointer-events-none`)
 *
 * RULES (each sabotaged, SEEN RED, restored — see the commit): (1) every switch is the Form row's · (2) nothing is typed in a bare input,
 * textarea or select · (3) every button is a template's · (4) the ways live in ONE list of rows · (5) a Start from / a choice is the one
 * dropdown (no `<PickMenu` on the page) · (6) no colour of the page's own on a control (the accent is `sn-accent`, never a fill written here) ·
 * (7) a write that fails is said (every `makerSave` of the page sits in a `try`, answered in `plainRefusal`'s words) · (8) the QR is the shared
 * upload · (9) the states: the number of switches, rows and uploads follows what is switched on.
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
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const TOOLS = `${L}/studio-tools.tsx`;
const EDITOR = 'app/dashboard/[eventId]/pabuya/_components/pabuya-message-editor.tsx';
const ANSWERS = `${L}/details-answers.tsx`;

async function html(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
const method = (kind: string, over: Record<string, unknown> = {}) => ({
  egift_method_id: `id-${kind}`,
  method_kind: kind,
  label: kind,
  account_name: 'Maria Santos',
  handle: '0917 555 0101',
  qr_r2_key: null,
  note: null,
  is_enabled: true,
  qrDisplayUrl: null,
  ...over,
});

async function egifts(methods: unknown[], registryUrl: string | null | undefined) {
  const { StudioEgifts } = await import(`../${TOOLS}`);
  return html(React.createElement(StudioEgifts as React.ComponentType<Record<string, unknown>>, { eventId: 'E1', methods, registryUrl }));
}

/** The states the page is drawn in. */
const STATES = async () => ({
  none: await egifts([], null),
  one: await egifts([method('gcash')], 'https://registry.example.ph/x'),
  all: await egifts([method('gcash'), method('maya'), method('bank'), method('paypal')], 'https://registry.example.ph/x'),
  noRegistry: await egifts([method('bank', { is_enabled: false })], undefined),
});

/** What guests see is the guest page's own cards, drawn under `pointer-events-none` (their Copy number is the guest page's, not a control here). */
const withoutPreview = (markup: string) => {
  const from = markup.indexOf('<div data-studio-egifts-preview=""');
  const to = markup.indexOf('Ways to give');
  assert.ok(from > 0 && to > from, 'the preview was not found');
  assert.match(markup.slice(from, from + 80), /pointer-events-none/, 'what guests see can be pressed');
  return markup.slice(0, from) + markup.slice(to);
};
const tagsOf = (markup: string, tag: string) => [...markup.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => m[0]);

test('1 · every switch is the Form row’s — a real switch button on the one track, never a checkbox of the page’s own', async () => {
  const s = await STATES();
  for (const [state, markup] of Object.entries(s)) {
    const switches = tagsOf(markup, 'button').filter((b) => /role="switch"/.test(b));
    assert.equal(switches.length, 4, `${state}: four ways to give, four switches`);
    for (const b of switches) assert.match(b, /data-form-row-switch=""/, `${state}: a switch that is not the Form row’s`);
    assert.doesNotMatch(markup, /<input[^>]*type="checkbox"/, `${state}: a checkbox is drawn on E-Gifts`);
    assert.doesNotMatch(markup, /<input[^>]*role="switch"/, `${state}: a hand-made switch box is drawn`);
    assert.equal((markup.match(/class="sn-switch /g) ?? []).length, 4, `${state}: a switch is not drawn with the one track`);
  }
  const answers = await import(`../${ANSWERS}`);
  const a = await html(
    React.createElement(answers.AnswerPicker as React.ComponentType<Record<string, unknown>>, { eventId: 'E1', column: 'gifts_on', label: 'Accept gifts?', choices: [{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }], saved: true, as: 'switch' }),
  );
  assert.match(a, /<button[^>]*role="switch"[^>]*aria-checked="true"[^>]*data-form-row-switch=""/, '“Accept gifts?” is not the Form row’s switch');
  assert.doesNotMatch(a, /aria-haspopup="listbox"/, '“Accept gifts?” is still a dropdown');
  /* …and everywhere else the answer stays the dropdown it was. */
  const d = await html(
    React.createElement(answers.AnswerPicker as React.ComponentType<Record<string, unknown>>, { eventId: 'E1', column: 'gifts_on', label: 'Accept gifts?', choices: [{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }], saved: false }),
  );
  assert.match(d, /aria-haspopup="listbox"/, 'the dropdown the other doors keep is gone');
});

test('2 · nothing is typed in a bare input, textarea or select — numbers, names and the link are Form rows', async () => {
  const s = await STATES();
  for (const [state, markup] of Object.entries(s)) {
    assert.doesNotMatch(markup, /<textarea|<select/, `${state}: a bare textarea or select`);
    /* The only inputs are the shared upload's own (hidden file + the value it mirrors), inside its slot. */
    const bare = tagsOf(markup.replace(/<div data-studio-gift-qr[\s\S]*?<\/div><\/div>/g, ''), 'input').filter((i) => !/type="hidden"/.test(i));
    assert.deepEqual(bare, [], `${state}: a bare input outside the shared upload`);
  }
  const typed = (m: string) => (m.match(/data-form-row-pill="typed"/g) ?? []).length;
  /* every way that is on: its number and its name; the registry link when it could be read */
  assert.equal(typed(s.none), 1, 'nothing on: only the registry link is a row');
  assert.equal(typed(s.one), 3, 'one way on: number · name · registry');
  assert.equal(typed(s.all), 9, 'four ways on: 4 × (number · name) + registry');
  assert.equal(typed(s.noRegistry), 0, 'a registry that could not be read is not drawn, and nothing off draws a field');
  assert.match(s.one, /data-studio-registry-input=""/);
  const tools = read(TOOLS);
  const gifts = tools.slice(tools.indexOf('export function StudioEgifts('), tools.indexOf('export type StudioHubFacts'));
  assert.equal((gifts.match(/<TypedRow\b/g) ?? []).length, 3, 'a typed answer is hand-made beside the Form row (number · name · registry)');
  assert.doesNotMatch(gifts, /<input\b|<textarea\b|<select\b/, 'StudioEgifts draws a bare field');
  assert.match(gifts, /check=\{\(t\) => \(cleanGiftRegistryUrl\(t\) === undefined \? GIFT_REGISTRY_URL_ERROR : null\)\}/, 'the registry link is no longer checked before it is sent');
});

test('3 · every button is a template’s: the switch, the Form row’s pill, the ⓘ, the one dropdown, the shared upload’s own', async () => {
  const s = await STATES();
  const ok = /data-form-row-switch=""|data-form-row-pill="|aria-haspopup="(?:dialog|listbox)"/;
  for (const [state, markup] of Object.entries(s)) {
    /* The shared upload's buttons live in its slot. */
    const outside = withoutPreview(markup).replace(/<div data-studio-gift-qr[\s\S]*?<\/div><\/div>/g, '');
    const strays = tagsOf(outside, 'button').filter((b) => !ok.test(b));
    assert.deepEqual(strays, [], `${state}: a button that is not a template’s`);
  }
  const { PabuyaMessageEditor } = await import(`../${EDITOR}`);
  const { MakerContext } = await import(`../${L}/maker-context`);
  const thanks = await html(React.createElement(MakerContext.Provider, { value: { stagesStudio: true } as never }, React.createElement(PabuyaMessageEditor, { eventId: 'E1', initialMessage: 'Our own words.' })));
  assert.deepEqual(tagsOf(thanks, 'button').filter((b) => !ok.test(b)), [], 'the thank-you words draw a button that is not a template’s');
  /* The one button the words draw themselves — the other door's Try again — is the ONE ActionButton, in source. */
  const src = read(EDITOR);
  const studio = src.slice(src.indexOf('function StudioThanks('), src.indexOf('function ShippedEditor('));
  assert.doesNotMatch(studio, /<button\b/, 'the Studio’s thank-you words draw a hand-made button');
  assert.match(studio, /<ActionButton tone="neutral" quiet icon=\{RotateCcw\} label="Try again"/);
  const gifts = read(TOOLS);
  assert.doesNotMatch(gifts.slice(gifts.indexOf('export function StudioEgifts('), gifts.indexOf('export type StudioHubFacts')), /<button\b/, 'StudioEgifts draws a hand-made button');
});

test('4 · the ways to give are ONE list of rows with the one hairline', async () => {
  const s = await STATES();
  for (const [state, markup] of Object.entries(s)) {
    const lists = (markup.match(/data-form-rows="egifts-ways"/g) ?? []).length;
    assert.equal(lists, 1, `${state}: the ways to give are ${lists} lists`);
    /* Every row of the list is a Form row (a band with the hairline) — none is drawn beside it. */
    assert.doesNotMatch(markup, /border-t border-ink\/10 first:border-t-0"><div class="flex min-h-\[52px\][^>]*>\s*<label/, `${state}: a hand-made row`);
  }
  const rows = (s.all.match(/<div[^>]*data-form-row=/g) ?? []).length;
  assert.ok(rows >= 4 + 8 + 1, `four ways on: ${rows} rows`);
  assert.doesNotMatch(s.all, /data-studio-switch=/, 'the old Studio switch is drawn');
  const tools = read(TOOLS);
  assert.doesNotMatch(tools, /function StudioSwitch\b|<StudioSwitch\b|STUDIO_SWITCH_TRACK/, 'the Studio’s own switch is back');
});

test('5 · Start from and Accept gifts are the one dropdown / switch — no PickMenu on the page itself', () => {
  const tools = read(TOOLS);
  const gifts = tools.slice(tools.indexOf('export function StudioEgifts('), tools.indexOf('export type StudioHubFacts'));
  assert.doesNotMatch(gifts, /<PickMenu\b/, 'StudioEgifts draws a dropdown of its own');
  const src = read(EDITOR);
  const studio = src.slice(src.indexOf('function StudioThanks('), src.indexOf('function ShippedEditor('));
  assert.doesNotMatch(studio, /<PickMenu\b/, 'Start from is a hand-made dropdown');
  assert.equal((studio.match(/<ChosenRow\b/g) ?? []).length, 1);
  assert.equal((studio.match(/<TypedRow\b/g) ?? []).length, 1);
  assert.match(studio, /<TypedRow[\s\S]*?\blong\b[\s\S]*?maxLength=\{PABUYA_MESSAGE_MAX\}/, 'the words are not the long Form row, capped at the column’s limit');
  const answers = read(ANSWERS);
  assert.match(answers, /if \(as === 'switch'\) \{[\s\S]{0,400}<SwitchRow name=\{label\}/, 'the switch branch of the answer is not the Form row’s');
});

test('6 · no colour of the page’s own on a control — the accent is the token, nothing is filled by hand', () => {
  const HAND = /\bbg-(?:terracotta|mulberry|gild|gold|success|emerald|green|red|amber)|\btext-(?:terracotta|mulberry)|\bborder-(?:terracotta|mulberry)|#[0-9a-fA-F]{3,8}\b|\bstyle=\{/;
  const tools = read(TOOLS);
  const gifts = tools.slice(tools.indexOf('export function StudioEgifts('), tools.indexOf('export type StudioHubFacts'));
  assert.doesNotMatch(gifts, HAND, 'StudioEgifts writes a colour of its own');
  const src = read(EDITOR);
  const studio = src.slice(src.indexOf('function StudioThanks('), src.indexOf('function ShippedEditor('));
  assert.doesNotMatch(studio, HAND, 'the Studio’s thank-you words write a colour of their own');
  const answers = read(ANSWERS);
  const sw = answers.slice(answers.indexOf("if (as === 'switch') {"), answers.indexOf("if (as === 'switch') {") + 500);
  assert.doesNotMatch(sw, HAND, 'the switch answer writes a colour of its own');
});

test('7 · a save that fails SAYS SO in plain words, and never looks saved — every write of the page is answered', () => {
  const tools = read(TOOLS);
  const gifts = tools.slice(tools.indexOf('export function StudioEgifts('), tools.indexOf('export type StudioHubFacts'));
  const writes = (gifts.match(/await makerSave\(/g) ?? []).length;
  assert.equal(writes, 4, 'the page’s writes changed (switch · number/name · QR · registry) — re-read this guard');
  assert.equal((gifts.match(/\} catch \{/g) ?? []).length, writes, 'a write of the page is not in a try/catch — a dropped connection would say nothing');
  assert.ok((gifts.match(/plainRefusal\(res\.error, GIFT_NOT_SAVED\)/g) ?? []).length >= 4, 'a refusal is not said in plain words');
  assert.doesNotMatch(gifts, /setError\(|\{error\}/, 'the server’s own text is printed raw');
  /* The switch goes back and the QR goes back; the typed rows answer {ok:false} (the row shows the failure and never the tick). */
  assert.equal((gifts.match(/setRows\(\(r\) => \(\{ \.\.\.r, \[kind\]: before \}\)\);/g) ?? []).length, 2, 'a failed switch or QR no longer goes back as it was');
  assert.match(gifts, /return res\.ok \? \{ ok: true \} : \{ ok: false, error: plainRefusal/);
  const src = read(EDITOR);
  const studio = src.slice(src.indexOf('function StudioThanks('), src.indexOf('function ShippedEditor('));
  assert.match(studio, /\} catch \{\s*res = \{ ok: false, error: NOT_DRAFTED \};/, 'a dropped connection on the thank-you words says nothing');
  assert.match(studio, /return \{ ok: false, error: why \};/, 'the thank-you row is told its save did not land');
  const answers = read(ANSWERS);
  assert.match(answers, /problem=\{error\}/, 'a refused “Accept gifts?” is not said under its switch');
});

test('8 · the QR is the shared upload, on the shelf the writer accepts', async () => {
  const s = await STATES();
  assert.equal((s.all.match(/data-studio-gift-qr="/g) ?? []).length, 2, 'GCash and Maya take a QR — no other way does');
  assert.equal((s.one.match(/data-studio-gift-qr="/g) ?? []).length, 1);
  assert.equal((s.none.match(/data-studio-gift-qr="/g) ?? []).length, 0, 'a way that is off draws no upload');
  const tools = read(TOOLS);
  assert.match(tools, /<FileUpload\s+bucket="thread-files"\s+pathPrefix=\{`pabuya-qr\/\$\{eventId\}`\}/);
  assert.doesNotMatch(tools.slice(tools.indexOf('export function StudioEgifts('), tools.indexOf('export type StudioHubFacts')), /type="file"/, 'the page draws its own file input');
});

test('9 · the first load: the page’s files and the templates they pull in are lazy — none is imported by a first-load Maker file', () => {
  /* The Maker's first-load JavaScript is at its ceiling. These files ride the `maker-details` chunk (`details-lazy.tsx`, `next/dynamic`). */
  const lazy = readFileSync(join(WEB, `${L}/details-lazy.tsx`), 'utf8');
  assert.match(lazy, /import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/studio-tools'\)/, 'studio-tools is no longer lazy');
  assert.match(lazy, /import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\.\/\.\.\/pabuya\/_components\/pabuya-message-editor'\)/, 'the thank-you editor is no longer lazy');
  assert.match(lazy, /import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/details-answers'\)/, 'the answers are no longer lazy');
  /* …and no first-load Maker file imports them statically. */
  for (const f of ['maker-details.tsx', 'maker-shell.tsx', 'details-answers-parts.tsx', 'details-workspace.tsx']) {
    /* A type-only import is erased by the compiler: it ships nothing. */
    const src = read(`${L}/${f}`).replace(/^import type [^;]*;$/gm, '');
    assert.doesNotMatch(src, /from '\.\/studio-tools'|from '\.\/details-answers'|from '\.\.\/\.\.\/pabuya\/_components\/pabuya-message-editor'|from '@\/app\/_components\/form-row'|studio-actions-context/, `${f} imports a lazy E-Gifts file, the Form row or the Studio writes' context statically`);
  }
});

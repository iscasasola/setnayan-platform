/**
 * studio-prints-posts-the-same.test.ts — STUDIO › PRINTS SENDS WHAT IT ALWAYS SENT (2026-10-09; the include switches, the seat plan's kind and the
 * Save moved onto the Switch / Form row / ActionButton templates).
 *
 * Prints' print-words form is ONE native form (`details-print-words`, posted by `SoftPost` to `/api/hub-print/words`, live): every include switch is a
 * checkbox that joins it by `form=`, wherever it is drawn, and EVERYTHING in it posts — also the fields under a switch that is off (the old switch only
 * HID them). A redrawn switch that posts under another name, posts when off, or whose fields unmount when it is switched off, saves a different print
 * and looks exactly like success.
 *
 * `studio-prints-posts-the-same.golden.json` is what the page posted BEFORE (recorded from the real old `Toggle` in Chromium — see its `_about`, and the
 * commit message for the before/after run: 15 of 15 scenarios identical). This test holds the INITIAL post of the new switches against it (RENDERED —
 * names and values the browser would build, a checkbox that is off ABSENT), the old and new switch against each other over every on/off × disabled state,
 * and the wiring: the Studio uses the new parts, the shipped Maker keeps its `Toggle`/`Segmented`/`SaveWords` byte for byte.
 *
 * SABOTAGE (each seen RED, then restored): the carrier checkbox loses its `form=` · a switch that posts when off · the children unmounted while off ·
 * the seat plan's hidden input renamed · the Save not submitting the words form · a Studio call site that still draws the old `Toggle`.
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
const golden = JSON.parse(readFileSync(join(__dirname, 'studio-prints-posts-the-same.golden.json'), 'utf8')) as Record<string, string[]>;
const W = 'details-print-words';

/** The switches the golden was recorded with (the same fixture as the browser run): name · label · on · tip · has a field under it. */
const SWITCHES: Array<[string, string, boolean, string | undefined, boolean]> = [
  ['inc_parents', 'Parents on the invitation', true, 'Guests whose role on your guest list is a parent.', true],
  ['inc_opening_line', 'Opening line', true, undefined, true],
  ['inc_gift_details', 'E-Gifts — gift details', false, 'Account numbers print masked.', false],
  ['inc_thank_you', 'E-Gifts — thank-you message', true, undefined, true],
  ['inc_love_story', 'Love Story', true, 'A short excerpt of your story.', false],
  ['inc_schedule', 'Schedule — the program', false, 'Only the moments your guests can see.', false],
  ['inc_mood_board', 'Mood Board — our colours', false, undefined, false],
  ['inc_special_message', 'Special message', true, undefined, true],
  ['inc_rsvp', 'Kindly reply', false, 'A host or your coordinator.', true],
  ['inc_guest_names', 'Guest list — names on passes', true, undefined, false],
  ['inc_nfc', 'Add an NFC sticker spot', false, 'Use 25 mm round NFC stickers.', false],
  ['inc_seat_plan', 'Offer a seat plan with the set', true, 'Prints your seating chart.', true],
];

async function html(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? m));
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.replace(/^<\w+/, '').replace(/\/?>$/, '').matchAll(/([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) out[m[1]!] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}
/** What `new FormData(form)` holds from the controls that belong to `form` by `form=` — sorted `name=value`; a checkbox that is off, ABSENT. */
function posted(markup: string, form = W): string[] {
  const out: string[] = [];
  for (const m of markup.matchAll(/<input\b[^>]*>/g)) {
    const a = attrs(m[0]);
    if (a.form !== form || !a.name || 'disabled' in a) continue;
    const type = (a.type ?? 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      if ('checked' in a) out.push(`${a.name}=${a.value ?? 'on'}`);
    } else out.push(`${a.name}=${a.value ?? ''}`);
  }
  return out.sort();
}

async function oldAndNew(over: Partial<{ on: (n: string) => boolean; disabled: (n: string) => boolean }> = {}) {
  const { Toggle } = await import(`../${L}/maker-details`);
  const { StudioIncludeSwitch, StudioSeatKind } = await import(`../${L}/studio-tools`);
  const field = (name: string) => React.createElement('input', { form: W, name: `field_${name}`, defaultValue: `words for ${name}`, 'aria-label': `field ${name}` });
  const kids = (name: string, kind: 'old' | 'new') =>
    name === 'inc_seat_plan'
      ? React.createElement(React.Fragment, null, field(name), kind === 'new'
          ? React.createElement(StudioSeatKind, { form: W, name: 'seat_plan_kind', value: '2d', options: [['3d', '3D'], ['2d', '2D'], ['list', 'List']] })
          : React.createElement('input', { form: W, type: 'radio', name: 'seat_plan_kind', value: '2d', defaultChecked: true }))
      : field(name);
  const draw = (kind: 'old' | 'new') =>
    React.createElement(
      React.Fragment,
      null,
      ...SWITCHES.map(([name, label, on, tip, has]) =>
        React.createElement(kind === 'old' ? Toggle : StudioIncludeSwitch, { key: name, form: W, name, label, on: over.on ? over.on(name) : on, tip, disabled: over.disabled ? over.disabled(name) : false }, has ? kids(name, kind) : null),
      ),
    );
  return { oldHtml: await html(draw('old')), newHtml: await html(draw('new')) };
}

test('1 · the INITIAL post of the new switches is exactly what the old page posted (the recorded golden, over the rendered controls)', async () => {
  const { newHtml } = await oldAndNew();
  const mine = posted(newHtml).concat(['event_id=E1', 'include_form=1']).sort();
  assert.deepEqual(mine, golden.initial, 'the Studio’s include switches post something else than the old page did');
  assert.ok(golden.initial!.some((p) => p === 'inc_parents=on') && !golden.initial!.some((p) => p.startsWith('inc_schedule=')), 'the golden lost its on/off shape');
});

test('2 · old switch and new switch post the same, in every state — on · off · disabled — with the fields under them posting too', async () => {
  for (const [label, over] of [
    ['as recorded', {}],
    ['all on', { on: () => true }],
    ['all off', { on: () => false }],
    ['all on, all disabled', { on: () => true, disabled: () => true }],
    ['gift details disabled (no gifts yet)', { disabled: (n: string) => n === 'inc_gift_details' }],
  ] as const) {
    const { oldHtml, newHtml } = await oldAndNew(over);
    assert.deepEqual(posted(newHtml), posted(oldHtml), `${label}: the new switches post differently`);
  }
  /* Everything under a switch that is OFF is still in the page (hidden) — so it still posts, as before. */
  const { newHtml } = await oldAndNew({ on: () => false });
  assert.ok(posted(newHtml).includes('field_inc_opening_line=words for inc_opening_line'), 'a field under an off switch no longer posts');
  assert.match(newHtml, /data-include-fields="" class="hidden"/, 'the fields under an off switch are not just hidden');
});

test('3 · the seat plan’s kind posts as the radios did: one `seat_plan_kind`, the chosen value', async () => {
  const { StudioSeatKind } = await import(`../${L}/studio-tools`);
  for (const v of ['3d', '2d', 'list']) {
    const m = await html(React.createElement(StudioSeatKind, { form: W, name: 'seat_plan_kind', value: v, options: [['3d', '3D'], ['2d', '2D'], ['list', 'List']] }));
    assert.deepEqual(posted(m), [`seat_plan_kind=${v}`]);
  }
});

test('4 · Save submits the print words form, as the old Save did — one filled button, the live note beside it', async () => {
  const { StudioPrintSave } = await import(`../${L}/studio-tools`);
  const m = await html(React.createElement(StudioPrintSave, { form: W }));
  assert.match(m, /<button[^>]*type="submit"[^>]*form="details-print-words"|<button[^>]*form="details-print-words"[^>]*type="submit"/, 'Save no longer submits the words form');
  assert.match(m, /class="ab ab-brand ab-main/, 'Save is not the one filled forward step');
  assert.match(m, /Guests see this right away/, 'the live note is gone from beside Save');
  const old = read(`${L}/maker-details.tsx`);
  assert.match(old, /<button type="submit" form=\{WORDS_FORM\} className="button-primary text-sm">\s*Save\s*<\/button>/, 'the shipped Maker’s Save changed');
});

test('5 · the Studio uses the new parts; the shipped Maker keeps its own, untouched', () => {
  const src = read(`${L}/maker-details.tsx`);
  assert.match(src, /const save = props\.studio \? <StudioTool part="print-save" form=\{WORDS_FORM\} \/> : <SaveWords \/>;/);
  assert.match(src, /const IncludeSwitch = \(p: Parameters<typeof Toggle>\[0\]\) => \(props\.studio \? <StudioTool part="include-switch" \{\.\.\.p\} \/> : <Toggle \{\.\.\.p\} \/>\);/);
  const body = src.slice(0, src.indexOf('export function Toggle({'));
  assert.equal((body.match(/<Toggle\b/g) ?? []).length, 1, 'a Studio call site draws the old Toggle');
  assert.equal((body.match(/<IncludeSwitch\b/g) ?? []).length, 12, 'the include switches moved — NFC · parents · opening line · gift details · thank-you · love story · schedule · mood board · special message · kindly reply · guest names · seat plan');
  assert.match(src, /props\.studio \? \(\s*<StudioTool part="seat-kind"[\s\S]{0,300}\) : \(\s*<Segmented/, 'the seat plan’s kind is not the dropdown in the Studio');
  /* The shipped Toggle / Segmented / SaveWords are unchanged. */
  assert.match(src, /export function Toggle\(\{[\s\S]{0,2600}className="sn-switch sn-press-ring relative h-6 w-11 shrink-0 rounded-full/);
  assert.match(src, /function Segmented\(\{ form, name, value, options \}/);
  assert.match(src, /function SaveWords\(\) \{/);
});

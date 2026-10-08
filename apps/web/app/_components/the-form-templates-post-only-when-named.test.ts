/**
 * the-form-templates-post-only-when-named.test.ts — STEP 4B-1: THREE TEMPLATES LEARN TO POST A NAMED VALUE, AND ONLY WHEN ASKED.
 *
 * The guest card is a LIVE autosaving `<form>` (`guest-card-autosave.tsx` posts the whole FormData to `updateGuest`), so a template
 * row that keeps its value in React state and posts nothing would stop saving a column while looking exactly like success.
 * One additive, optional prop each, instead of a hidden shadow input at every call site:
 *
 *   · `TypedRow  fieldName="first_name"`   → the kept words ride a hidden input of that name; keeping them (tap out / Enter) tells the
 *                                           form ONCE (`input` + `change`); an Undo (`sn-restore`) puts them back on screen;
 *   · `SwitchRow fieldName="passed_away"`  → a real visually-hidden CHECKBOX of that name: present (value `on`) when on, ABSENT when
 *                                           off — exactly what the card's own switch posts today — and a tap on the switch tells the
 *                                           form; the Undo's `click()` on that checkbox drives the switch;
 *   · `Chips fieldName={(key) => `invited_${key}`}` → one such checkbox per chip, multi-valued.
 *
 * ABSENT BY DEFAULT: with no `fieldName` the markup is byte for byte what it was (golden strings below, drawn from the templates
 * BEFORE this step), and nothing is posted. The events are raised only from a person's tap or keep — never from a render, a
 * re-seed from the server or an Undo's restore (that would write twice, or re-apply what was just taken back).
 *
 * SABOTAGE (each seen RED, then restored): the checkbox rendered when off · `fieldName` ignored · the hidden input left out of
 * TypedRow · an event raised from the effect on every change · the absent-prop markup changed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const draw = async (name: 'TypedRow' | 'SwitchRow', props: Record<string, unknown>) => {
  const m = (await import('./form-row')) as unknown as Record<string, React.ComponentType<Record<string, unknown>>>;
  return renderToStaticMarkup(React.createElement(m[name]!, props));
};
const chips = async (props: Record<string, unknown>) => {
  const { Chips } = await import('./chips');
  return renderToStaticMarkup(React.createElement(Chips as unknown as React.ComponentType<Record<string, unknown>>, props));
};

const TYPED = { name: 'First', value: 'Ana', onKeep: () => ({ ok: true as const }) };
const SWITCH = { name: 'Passed away', on: true, onChange: () => {} };
const CHIPS = {
  label: 'Invited to',
  options: [{ key: 'ceremony', label: 'Ceremony' }, { key: 'reception', label: 'Reception' }, { key: 'cocktails', label: 'Cocktails' }],
  value: ['ceremony', 'cocktails'],
  onToggle: () => {},
};

/* GOLDEN: the markup of each template, drawn BEFORE this step added `fieldName`. */
const GOLD_TYPED = "<div data-form-row=\"\" data-form-row-kind=\"typed\" data-form-row-state=\"idle\" class=\"border-t border-ink/10 first:border-t-0\"><div class=\"flex min-h-[52px] items-center gap-2.5\"><span data-form-row-name=\"\" class=\"sn-row-name flex min-w-0 flex-1 items-center\"><span class=\"min-w-0\"><span id=\"_R_0H1_\" class=\"block text-[15px] font-medium leading-tight text-ink\">First</span></span></span><button type=\"button\" data-form-row-pill=\"typed\" aria-label=\"First: Ana. Tap to change\" class=\"sn-row-pill sn-press sn-press-ring inline-flex h-10 min-h-10 flex-none items-center justify-between gap-1.5 rounded-full border bg-white pl-3.5 pr-2.5 text-left text-[14px] font-medium text-ink transition-colors duration-sn-control ease-sn w-[200px] border-ink/15\"><span data-form-row-words=\"\" class=\"min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis \"><span>Ana</span></span><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-pencil h-4 w-4 flex-none text-sn-accent\" aria-hidden=\"true\" data-form-row-mark=\"pencil\"><path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"></path><path d=\"m15 5 4 4\"></path></svg></button></div></div>";
const GOLD_SWITCH_ON = "<div data-form-row-kind=\"switch\" data-form-row=\"\" class=\"border-t border-ink/10 first:border-t-0\"><div class=\"flex min-h-[52px] items-center gap-2.5\"><span data-form-row-name=\"\" class=\"sn-row-name flex min-w-0 flex-1 items-center\"><span class=\"min-w-0\"><span class=\"block text-[15px] font-medium leading-tight text-ink\">Passed away</span></span></span><button type=\"button\" role=\"switch\" aria-checked=\"true\" aria-label=\"Passed away\" data-form-row-switch=\"\" class=\"inline-flex min-h-11 flex-none items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50\"><span aria-hidden=\"true\" data-on=\"true\" class=\"sn-switch sn-press-ring relative block h-[30px] w-[50px] flex-none rounded-full after:absolute after:left-[3px] after:top-[3px] after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:content-[&#x27;&#x27;] data-[on=true]:after:translate-x-5 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-sn-accent/40 peer-disabled:opacity-40\"></span></button></div></div>";
const GOLD_SWITCH_OFF = "<div data-form-row-kind=\"switch\" data-form-row=\"\" class=\"border-t border-ink/10 first:border-t-0\"><div class=\"flex min-h-[52px] items-center gap-2.5\"><span data-form-row-name=\"\" class=\"sn-row-name flex min-w-0 flex-1 items-center\"><span class=\"min-w-0\"><span class=\"block text-[15px] font-medium leading-tight text-ink\">Passed away</span></span></span><button type=\"button\" role=\"switch\" aria-checked=\"false\" aria-label=\"Passed away\" data-form-row-switch=\"\" class=\"inline-flex min-h-11 flex-none items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50\"><span aria-hidden=\"true\" data-on=\"false\" class=\"sn-switch sn-press-ring relative block h-[30px] w-[50px] flex-none rounded-full after:absolute after:left-[3px] after:top-[3px] after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:content-[&#x27;&#x27;] data-[on=true]:after:translate-x-5 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-sn-accent/40 peer-disabled:opacity-40\"></span></button></div></div>";
const GOLD_CHIPS = "<div role=\"group\" aria-label=\"Invited to\" data-chips=\"\" data-chips-columns=\"3\" style=\"grid-template-columns:repeat(3, minmax(0, 1fr))\" class=\"grid gap-2 \"><button type=\"button\" aria-pressed=\"true\" data-chip=\"ceremony\" class=\"sn-press relative inline-flex h-10 min-h-10 min-w-[84px] flex-none items-center justify-center whitespace-nowrap rounded-full border px-[18px] text-[14px] font-semibold transition-colors duration-sn-control ease-sn after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[&#x27;&#x27;] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40 border-sn-accent bg-sn-accent text-sn-on-accent w-full\"><span data-chip-label=\"\" class=\"whitespace-nowrap\">Ceremony</span></button><button type=\"button\" aria-pressed=\"false\" data-chip=\"reception\" class=\"sn-press relative inline-flex h-10 min-h-10 min-w-[84px] flex-none items-center justify-center whitespace-nowrap rounded-full border px-[18px] text-[14px] font-semibold transition-colors duration-sn-control ease-sn after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[&#x27;&#x27;] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40 border-ink/15 bg-white text-ink/55 w-full\"><span data-chip-label=\"\" class=\"whitespace-nowrap\">Reception</span></button><button type=\"button\" aria-pressed=\"true\" data-chip=\"cocktails\" class=\"sn-press relative inline-flex h-10 min-h-10 min-w-[84px] flex-none items-center justify-center whitespace-nowrap rounded-full border px-[18px] text-[14px] font-semibold transition-colors duration-sn-control ease-sn after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[&#x27;&#x27;] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40 border-sn-accent bg-sn-accent text-sn-on-accent w-full\"><span data-chip-label=\"\" class=\"whitespace-nowrap\">Cocktails</span></button></div>";

test('absent by default: the templates draw exactly what they drew before, and post nothing', async () => {
  const typed = await draw('TypedRow', TYPED);
  const on = await draw('SwitchRow', SWITCH);
  const off = await draw('SwitchRow', { ...SWITCH, on: false });
  const ch = await chips(CHIPS);
  assert.equal(typed, GOLD_TYPED, 'TypedRow’s markup changed with no fieldName');
  assert.equal(on, GOLD_SWITCH_ON, 'SwitchRow (on) changed with no fieldName');
  assert.equal(off, GOLD_SWITCH_OFF, 'SwitchRow (off) changed with no fieldName');
  assert.equal(ch, GOLD_CHIPS, 'Chips changed with no fieldName');
  for (const html of [typed, on, off, ch]) assert.doesNotMatch(html, /<input\b|\sname="|data-form-pick/, 'a template posts something nobody asked it to');
  /* …and an explicit undefined is the same as absent. */
  assert.equal(await draw('TypedRow', { ...TYPED, fieldName: undefined }), typed);
  assert.equal(await draw('SwitchRow', { ...SWITCH, fieldName: undefined }), on);
  assert.equal(await chips({ ...CHIPS, fieldName: undefined }), ch);
});

/* What a browser would post from a piece of markup (the card's own extractor, in miniature). */
const posted = (html: string): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0];
    const name = /\sname="([^"]*)"/.exec(tag)?.[1];
    if (!name || /\sdisabled(=|\s|\/|>)/.test(tag)) continue;
    if (/type="checkbox"/.test(tag)) {
      if (/\schecked(=|\s|\/|>)/.test(tag)) out.push([name, /\svalue="([^"]*)"/.exec(tag)?.[1] ?? 'on']);
    } else out.push([name, /\svalue="([^"]*)"/.exec(tag)?.[1] ?? '']);
  }
  return out;
};

test('TypedRow with a fieldName posts its words under that name — and nothing else changes', async () => {
  const html = await draw('TypedRow', { ...TYPED, fieldName: 'first_name' });
  assert.deepEqual(posted(html), [['first_name', 'Ana']]);
  const carrier = /<input\b[^>]*data-form-pick=""[^>]*\/>/.exec(html)?.[0] ?? '';
  assert.ok(/type="hidden"/.test(carrier) && /name="first_name"/.test(carrier) && /value="Ana"/.test(carrier), 'the carrier is not the card’s hidden input (autosave’s Undo looks for data-form-pick)');
  assert.equal(html.replace(/<input type="hidden"[^>]*\/>/, ''), GOLD_TYPED, 'naming the field changed more than the carrier');
  assert.deepEqual(posted(await draw('TypedRow', { ...TYPED, value: '', fieldName: 'mobile' })), [['mobile', '']], 'an EMPTY answer must still post an empty value (updateGuest reads absent as "no box")');
});

test('SwitchRow with a fieldName posts `on` when on and NOTHING when off — a native checkbox’s own rule', async () => {
  assert.deepEqual(posted(await draw('SwitchRow', { ...SWITCH, on: true, fieldName: 'passed_away' })), [['passed_away', 'on']]);
  assert.deepEqual(posted(await draw('SwitchRow', { ...SWITCH, on: false, fieldName: 'passed_away' })), [], 'an OFF switch posts something');
  const html = await draw('SwitchRow', { ...SWITCH, on: true, fieldName: 'passed_away' });
  const box = /<input\b[^>]*data-form-switch-post=""[^>]*\/>/.exec(html)?.[0] ?? '';
  for (const part of ['type="checkbox"', 'name="passed_away"', 'checked=""', 'tabindex="-1"', 'aria-hidden="true"', 'class="sr-only"']) assert.ok(box.includes(part), `the switch’s checkbox lacks ${part}: ${box}`);
  assert.equal(html.replace(/<input type="checkbox"[^>]*\/>/, ''), GOLD_SWITCH_ON, 'naming the field changed more than the checkbox');
  assert.deepEqual(posted(await draw('SwitchRow', { ...SWITCH, on: true, disabled: true, fieldName: 'x' })), [], 'a disabled switch posts (a disabled native checkbox does not)');
});

test('Chips with a fieldName post one value per chosen chip (multi-valued), none for the rest', async () => {
  const fieldName = (k: string) => `invited_${k}`;
  assert.deepEqual(posted(await chips({ ...CHIPS, fieldName })), [['invited_ceremony', 'on'], ['invited_cocktails', 'on']]);
  assert.deepEqual(posted(await chips({ ...CHIPS, value: [], fieldName })), [], 'no chip chosen must post nothing');
  assert.deepEqual(posted(await chips({ ...CHIPS, value: ['ceremony', 'reception', 'cocktails'], fieldName })).map(([n]) => n), ['invited_ceremony', 'invited_reception', 'invited_cocktails']);
  const html = await chips({ ...CHIPS, fieldName });
  assert.equal(html.replace(/<input type="checkbox"[^>]*\/>/g, ''), GOLD_CHIPS, 'naming the fields changed more than the checkboxes');
  assert.match(html, /<\/button><input\b[^>]*data-chip-post="ceremony"[^>]*class="sr-only"|<\/button><input\b[^>]*class="sr-only"[^>]*data-chip-post="ceremony"/, 'a checkbox is not beside its chip, hidden (it would take a grid cell)');
});

test('the form is told ONLY by a person: the tap sets a flag, the next commit raises the events; a restore or a re-seed never does', () => {
  const row = src('form-row.tsx');
  const chip = src('chips.tsx');
  /* TypedRow: once, from the keep (`send`) — after `shown` was set, so the carrier holds the new words. */
  assert.match(row, /\}\s*tellTheForm\(carrier\.current\);\s*void Promise\.resolve\(answer\)/, 'the kept words do not reach the form (once, from the keep)');
  assert.equal((row.match(/tellTheForm\(/g) ?? []).length, 2, 'TypedRow and SwitchRow are the only callers in the Form row');
  assert.match(row, /el\.addEventListener\('sn-restore', reread\);/, 'an Undo cannot put the words back on screen');
  assert.match(row, /const reread = \(\) => setShown\(el\.value\);/);
  /* SwitchRow / Chips: a tap sets the flag; the effect spends it. */
  assert.match(row, /onClick=\{\(\) => \{\s*tapped\.current = Boolean\(fieldName\);\s*onChange\(!on\);\s*\}\}/);
  assert.match(row, /useEffect\(\(\) => \{\s*if \(!tapped\.current\) return;\s*tapped\.current = false;\s*tellTheForm\(post\.current\);\s*\}, \[on\]\);/);
  assert.match(chip, /onClickCapture=\{\(\) => \{\s*tapped\.current = fieldName \? o\.key : null;\s*\}\}\s*onClick=\{\(\) => onToggle\(o\.key, !on\)\}/, 'the chip’s press no longer says what the chip is now, or the tap does not set the flag');
  assert.match(chip, /if \(tapped\.current === null\) return;[\s\S]*?tellTheForm\(box\);\s*\}, \[chosen\]\);/);
  /* The restore path drives the control, not the tap: the checkbox's own onChange, which sets no flag. */
  assert.match(row, /checked=\{on\} disabled=\{disabled\} onChange=\{\(\) => onChange\(!on\)\}/);
  assert.match(chip, /checked=\{on\}\s*disabled=\{o\.disabled\}\s*onChange=\{\(\) => onToggle\(o\.key, !on\)\}/);
  assert.doesNotMatch(row + chip, /tapped\.current = true/, 'a flag set from somewhere other than a tap');
  /* …and what is TYPED in the open field never reaches the form: only the carrier's own events pass. */
  assert.match(row, /const keepTypingHere = \(e: \{ target: EventTarget; stopPropagation: \(\) => void \}\) => \{\s*if \(e\.target !== carrier\.current\) e\.stopPropagation\(\);\s*\};/);
  assert.match(row, /onInput=\{fieldName \? keepTypingHere : undefined\}\s*onChange=\{fieldName \? keepTypingHere : undefined\}/, 'keystrokes in the open field reach the autosave');
  /* The helper raises input + change, bubbling — the autosave form listens for both. */
  const tell = src('../../lib/tell-the-form.ts');
  assert.match(tell, /new Event\('input', \{ bubbles: true \}\)[\s\S]*new Event\('change', \{ bubbles: true \}\)/);
});

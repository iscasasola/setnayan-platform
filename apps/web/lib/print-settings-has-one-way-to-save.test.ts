/**
 * print-settings-has-one-way-to-save.test.ts — ⚙ PRINT SETTINGS HAS ONE WAY TO SAVE, AND STORES NO FACT THE EVENT HUB OWNS (owner 2026-10-21).
 *
 * Owner, verbatim, on the sheet's ✓ Save: *"why is there a save here? when any press changes it right away?"* — and then: *"so on the print
 * settings. most of the settings is already on the event hub. like parents and other details."*
 *
 * MEASURED in the lab before the change (`/dev/maker-lab?studio=1`, every control of the sheet pressed, `window.__labPrintWords` counted):
 * no switch, dropdown or typed line posted until ✓ Save, while the foot said "Guests see this right away" — so a press followed by Done was
 * a press thrown away. The sheet now has no Save: the print words form posts itself on a person's change (`SoftPost autosave`).
 *
 * The properties held here (each sabotaged RED, then restored — see the commit message):
 *   1. NO SAVE: the sheet draws no submit button and no "Guests see this right away" (it is not true of every write the sheet makes); it is
 *      handed no Save; the Studio has no `StudioPrintSave`.
 *   2. EVERY PRESS POSTS, THROUGH THE ONE FORM: the Studio's print words form is `SoftPost autosave`; a change to one of ITS fields posts it
 *      (a press at once, typing after a pause, leaving the box at once), a field of another form never does; one post at a time, the last
 *      change always sent. Every field the sheet posts joins `WORDS_FORM` and nothing else; every hidden carrier in the sheet's parts is TOLD
 *      on a person's change (a hidden input raises no event of its own — without the tell, its pick would never post).
 *   3. THE WORDS MATCH THE BEHAVIOUR: "waits for Apply" is said only by a part whose write goes to the DRAFT (`hubDraftAction`).
 *   4. ONE HOME PER FACT: `events.print_details` keeps only what has no other home (the opening line, who guests reply to, the include
 *      choices, the menu, the invite message, the ticket style, the poster photo, the name style) — a hub-owned key handed to it is dropped;
 *      the words route reads only print-only fields; the print draws the special message, the thank-you, the parents and the Love Story from
 *      their own homes (`print-set.server.ts`).
 *   5. ONE VALUE, TWO DOORS — THE DATE AND THE PLACES: the print's venue lines are the Event Hub's own pick (`resolveEventVenues` →
 *      `printVenueLines`), never a Schedule moment's typed location nor a second fallback order; the printed date is as precise as the
 *      Hub holds it (`event_date_precision` — a month prints "December 2026", never the month's stand-in first day).
 *
 * Where each copy stood BEFORE this change (code and the repo's seed — production was not read): `print_details` never held a hub
 * fact (its parser drops unknown keys, test 4); the sheet's parents, special message and thank-you were already the Hub's own editors;
 * the two that DIFFERED were read-side — the venue (a Schedule moment's `location` first; reception typed-name order reversed) and the
 * date (precision ignored). `supabase/seed.sql` seeds no event, so no seeded value is lost.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PRINT_WORDS_TYPING_QUIET_MS, oneAtATime, printWordsAutosaveWait } from './print-words-autosave';

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
const DETAILS = read(`${L}/maker-details.tsx`);
/** The sheet's own block in Details — from the ⚙ editor to the next item. */
const SHEET_BLOCK = DETAILS.slice(DETAILS.indexOf('editors[EVERY_PRINT_ITEM] = ('), DETAILS.indexOf('editors[DIGITAL_TICKET_ITEM]'));
/** The files whose parts the sheet draws (its switches, dropdowns and typed lines). */
/* + the carousel (2026-10-26): the Digital ticket's Ticket style ▾ moved onto its slide (owner: "The 3 designs for the digital ticket should be on the carousel and not on settings."). */
const PARTS = [`${L}/studio-tools.tsx`, `${L}/studio-prints-six.tsx`, `${L}/pass-card-design-picker.tsx`, `${L}/print-paper.tsx`, `${L}/studio-prints-settings.tsx`, `${L}/studio-prints-carousel.tsx`];

test('1 · NO SAVE: the sheet draws no submit and no "right away" line; it is handed no Save; the Studio has no StudioPrintSave', async () => {
  const { StudioPrintSettings } = await import(`../${L}/studio-prints-settings`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const field = React.createElement('input', { form: 'details-print-words', name: 'inc_nfc', type: 'checkbox', defaultChecked: true, 'aria-label': 'nfc' });
  const html = renderToStaticMarkup(
    React.createElement(StudioPrintSettings as never, { sections: [{ key: 'every', title: 'On every print', body: field }], form: 'details-print-words' } as never),
  );
  assert.ok(html.includes('data-print-settings-sheet'), 'the sheet was not drawn — this test proves nothing');
  assert.doesNotMatch(html, /type="submit"/, 'the sheet draws a submit button — every press already posts');
  assert.doesNotMatch(html, />\s*Save\s*</, 'the sheet draws a Save');
  assert.doesNotMatch(html, /Guests see this right away/, 'the sheet says "Guests see this right away" — not true of what waits for Apply');
  const sheetSrc = read(`${L}/studio-prints-settings.tsx`);
  assert.doesNotMatch(sheetSrc, /HubSavesImmediately|HUB_LIVE_WORDS|type="submit"/, 'the sheet’s source draws a Save or the live line');
  assert.ok(SHEET_BLOCK.length > 200, 'the sheet’s block in maker-details was not found');
  assert.doesNotMatch(SHEET_BLOCK, /save=\{|part="print-save"|HubSavesImmediately|HUB_LIVE_WORDS|type="submit"/, 'the sheet is handed a Save or the live line');
  assert.doesNotMatch(read(`${L}/studio-tools.tsx`), /function StudioPrintSave\b|part: 'print-save'/, 'the Studio’s Save part came back');
});

test('2a · EVERY PRESS POSTS: the Studio’s print words form autosaves, through the form’s own submit (the same route)', () => {
  assert.match(DETAILS, /<form id=\{WORDS_FORM\} action=\{PRINT_WORDS_ENDPOINT\}[\s\S]{0,1600}<SoftPost autosave=\{Boolean\(props\.studio\)\} \/>/, 'the Studio’s print words form does not autosave');
  const soft = read(`${L}/soft-post.tsx`);
  /* The machinery is loaded only when the form autosaves — the Maker's first-load budget never carries it. */
  assert.match(soft, /if \(autosave\) \{\s*void import\('@\/lib\/print-words-autosave'\)\.then\(\(m\) => \{[\s\S]{0,120}m\.armPrintWordsAutosave\(form, onSubmit, done\)/, 'SoftPost autosave does not arm the autosave on its form');
  assert.doesNotMatch(soft, /^import[^\n]*print-words-autosave/m, 'SoftPost imports the autosave eagerly — it lands in the Maker’s first load');
  assert.match(soft, /if \(gated\) gated\(\);/, 'an autosaving form’s submit is not gated one post at a time');
  const auto = read('lib/print-words-autosave.ts');
  assert.match(auto, /document\.addEventListener\('input', onEdit\);\s*document\.addEventListener\('change', onEdit\);/, 'the autosave does not listen for changes on the document (a field joined by form= is drawn on <body>)');
  assert.match(auto, /printWordsAutosaveWait\(e\.type, e\.target, form\)/, 'the autosave does not ask whether the change is to ITS form');
  assert.match(auto, /setTimeout\(\(\) => form\.requestSubmit\(\), wait\)/, 'an autosave is not the form’s own submit — it would skip the one handler (and the lab’s seam)');
  assert.match(auto, /const send = oneAtATime<R>\(post, done\);/, 'posts are not one at a time — an earlier post could land last and undo a later press');
});

test('2b · the wait: a press at once · typing after a pause · leaving the box at once · another form’s field never', () => {
  const form = { id: 'details-print-words' };
  const other = { id: 'special' };
  assert.equal(printWordsAutosaveWait('change', { form, tagName: 'INPUT', type: 'checkbox' }, form), 0);
  assert.equal(printWordsAutosaveWait('input', { form, tagName: 'INPUT', type: 'checkbox' }, form), 0);
  assert.equal(printWordsAutosaveWait('change', { form, tagName: 'INPUT', type: 'hidden' }, form), 0);
  assert.equal(printWordsAutosaveWait('input', { form, tagName: 'INPUT', type: 'text' }, form), PRINT_WORDS_TYPING_QUIET_MS);
  assert.equal(printWordsAutosaveWait('change', { form, tagName: 'INPUT', type: 'text' }, form), 0);
  assert.equal(printWordsAutosaveWait('input', { form, tagName: 'TEXTAREA' }, form), PRINT_WORDS_TYPING_QUIET_MS);
  assert.equal(printWordsAutosaveWait('change', { form: other, tagName: 'TEXTAREA' }, form), null, 'another form’s field posts the print words');
  assert.equal(printWordsAutosaveWait('change', { form: null, tagName: 'INPUT', type: 'checkbox' }, form), null);
  assert.equal(printWordsAutosaveWait('focus', { form, tagName: 'INPUT', type: 'text' }, form), null);
});

test('2c · one post at a time — a change during a post is sent once after it, with the form as it is then', async () => {
  const sent: number[] = [];
  let value = 1;
  const answers: string[] = [];
  let release: (() => void) | null = null;
  const run = oneAtATime(
    () =>
      new Promise<string>((done) => {
        sent.push(value);
        const v = value;
        release = () => done(`ok:${v}`);
      }),
    (r) => answers.push(r),
  );
  run();
  value = 2;
  run();
  value = 3;
  run();
  assert.deepEqual(sent, [1], 'a second post left while the first was in flight');
  (release as unknown as () => void)();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(sent, [1, 3], 'the change made during the post was not sent once, afresh');
  (release as unknown as () => void)();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(answers, ['ok:3'], 'the answer told is not the LAST post’s');
});

test('2d · every field the sheet posts joins the ONE print words form; every hidden carrier is told on a person’s change', () => {
  for (const m of SHEET_BLOCK.matchAll(/\bform=\{([^}]+)\}/g)) assert.equal(m[1], 'WORDS_FORM', `the sheet posts a field through another form (${m[1]})`);
  let carriers = 0;
  for (const rel of PARTS) {
    const src = read(rel);
    for (const m of src.matchAll(/<input\b[^>]*\btype="hidden"[^>]*\bform=\{form\}[^>]*>|<input\b[^>]*\bform=\{form\}[^>]*\btype="hidden"[^>]*>/g)) {
      carriers += 1;
      const tag = m[0];
      const ref = tag.match(/\bref=\{(\w+)\}/)?.[1];
      assert.ok(ref, `${rel}: a hidden carrier of the print words form has no ref — nothing can tell the form when it changes: ${tag.slice(0, 120)}`);
      const told = new RegExp(`tellTheForm\\(${ref}\\.current\\)|${ref}\\.current[\\s\\S]{0,240}dispatchEvent\\(new Event\\('change'`).test(src);
      assert.ok(told, `${rel}: the carrier \`${ref}\` is never told — a pick there would never post`);
    }
  }
  assert.ok(carriers >= 3, `only ${carriers} hidden carriers found — the scan is not reading the sheet’s parts (seat kind · reply choice · reply line)`);
  /* The switches tell the form through the template itself. */
  assert.match(read('app/_components/form-row.tsx'), /tapped\.current = false;\s*tellTheForm\(post\.current\);/, 'SwitchRow no longer tells the form on a tap');
});

test('3 · THE WORDS MATCH: "waits for Apply" is said only by a part whose write goes to the draft', () => {
  let said = 0;
  for (const rel of PARTS) {
    const src = read(rel);
    if (!/waits for Apply/.test(src)) continue;
    said += 1;
    /* A part may write the draft itself, or through the ONE ticket-style pick (`usePassLookPick`), which writes it — never a pick of its own. */
    const viaPick = /usePassLookPick\(/.test(src) && /export function usePassLookPick\([\s\S]*?hubDraftAction\(eventId, fd\)[\s\S]*?export function PassCardDesignPicker/.test(read(`${L}/pass-card-design-picker.tsx`));
    assert.ok(/hubDraftAction\(/.test(src) || viaPick, `${rel} says "waits for Apply" but does not write the draft`);
    assert.doesNotMatch(src, /\/api\/hub-print\/pass-design/, `${rel} says "waits for Apply" but writes the live row`);
  }
  assert.ok(said >= 1, 'no part says "waits for Apply" — the ticket style lost its honest line');
});

test('4 · ONE HOME PER FACT: print_details keeps only print-only keys; the route reads only print-only fields; the print reads the Hub’s own', async () => {
  const { parsePrintDetails, serializePrintDetails } = await import('./print-pieces');
  const PRINT_ONLY = ['opening_line', 'rsvp', 'include', 'menu', 'invite_message', 'pass_design', 'poster_photo', 'name_style'];
  const handed = {
    opening_line: 'Together with their families',
    include: {},
    /* Facts the Event Hub owns — a print copy of any of them would be a second home. */
    special_message: 'A PRINT COPY',
    pabuya_message: 'A PRINT COPY',
    parents: ['A PRINT COPY'],
    display_name: 'A PRINT COPY',
    venue_name: 'A PRINT COPY',
    event_date: '2026-12-18',
    love_story: { chapters: [] },
    sponsors: ['A PRINT COPY'],
  };
  const kept = Object.keys(serializePrintDetails(parsePrintDetails(handed))).sort();
  assert.deepEqual(kept, [...PRINT_ONLY].sort(), `print_details keeps a key that is not print-only: ${kept.join(', ')}`);
  assert.doesNotMatch(JSON.stringify(serializePrintDetails(parsePrintDetails(handed))), /A PRINT COPY/, 'a hub-owned fact survived into print_details');

  const route = read('app/api/hub-print/[piece]/route.ts');
  const wordsAt = route.indexOf("const choice = String(form.get('rsvp_choice')");
  assert.ok(wordsAt > 0, 'the words route’s reads were not found');
  const words = route.slice(wordsAt, route.indexOf('updatePrintDetails(admin, eventId', wordsAt));
  const fields = [...words.matchAll(/form\.(?:get|has)\('([a-z_]+)'\)/g)].map((m) => m[1]!);
  const on = [...words.matchAll(/on\('([a-z_]+)'\)/g)].map((m) => m[1]!);
  for (const f of [...fields, ...on]) {
    assert.ok(/^inc_[a-z_]+$/.test(f) || ['rsvp_choice', 'rsvp_manual', 'include_form', 'seat_plan_kind', 'pass_corners', 'opening_line', 'opening_line_to_draft'].includes(f), `the words route reads a field that is not print-only: ${f}`);
  }
  assert.ok(fields.length + on.length >= 8, 'the scan read too few of the route’s fields to prove anything');

  const set = read('lib/print-set.server.ts');
  assert.match(set, /specialMessage: inc\.specialMessage \? event\.special_message/, 'the special message is not printed from its Hub column');
  assert.match(set, /thankYou: inc\.thankYou \? event\.pabuya_message/, 'the thank-you is not printed from its E-Gifts column');
  assert.match(set, /parents: inc\.parents \? parentsFromEntourage\(/, 'the parents are not printed from the guest list');
  assert.match(set, /storyExcerpt: inc\.loveStory === 'excerpt' \? excerpt\(storyText\(event\.love_story\)\)/, 'the Love Story is not printed from its own column');
});

test('5 · ONE VALUE, TWO DOORS: the print names the places the Event Hub names, and says the date as precisely as the Hub holds it', async () => {
  const { printVenueLines, printedDate } = await import('./print-pieces');
  const { resolveEventVenues } = await import('./event-venues');
  const { dateDisplayOf } = await import('./details-your-event');
  const booked = (name: string) => ({ name, address: null, latitude: null, longitude: null, placeKey: name });
  /* Every shape a couple's venues come in: booked or typed, one place or two, the Save-the-Date's name and the event's own. */
  const bookingsCases = [
    { ceremony: null, reception: null },
    { ceremony: booked('San Agustin Church'), reception: null },
    { ceremony: null, reception: booked('Seda Vertis North') },
    { ceremony: booked('San Agustin Church'), reception: booked('Seda Vertis North') },
  ];
  const eventCases = [
    {},
    { venue_name: 'The Event Hub’s venue', std_film_venue_name: 'A Save-the-Date name' },
    { std_film_venue_name: 'A Save-the-Date name' },
    { std_film_ceremony_name: 'Typed parish', venue_name: 'Typed hall' },
    { std_film_ceremony_name: 'Same place', venue_name: 'Same place' },
  ];
  let compared = 0;
  for (const b of bookingsCases) {
    for (const e of eventCases) {
      const hub = resolveEventVenues(b, e);
      const lines = printVenueLines(hub);
      const hubNames = new Set(hub.map((v) => v.name?.trim()).filter(Boolean));
      const printed = [lines.ceremony, lines.reception].filter(Boolean);
      for (const p of printed) assert.ok(hubNames.has(p!), `the print names "${p}", a place the Event Hub does not name (${[...hubNames].join(' · ') || 'none'})`);
      for (const h of hubNames) assert.ok(printed.includes(h!), `the Event Hub names "${h}" and the print leaves it off`);
      compared += 1;
    }
  }
  assert.equal(compared, 20);

  const set = read('lib/print-set.server.ts');
  assert.match(set, /const hubVenues = printVenueLines\(resolveEventVenues\(venues, event\)\);/, 'the print does not take its places from the Event Hub’s pick');
  assert.match(set, /ceremonyVenue: hubVenues\.ceremony,/, 'the ceremony line is not the Hub’s place');
  assert.match(set, /receptionVenue: hubVenues\.reception,/, 'the reception line is not the Hub’s place');
  assert.doesNotMatch(set, /Venue:[^\n]*\.location/, 'a venue line reads a Schedule moment’s typed location — a place the Hub’s Venue scene never shows');
  for (const c of ['event_date_precision', 'ceremony_venue_address', 'venue_latitude', 'ceremony_venue_latitude']) {
    assert.match(set, new RegExp(`const EVENT_COLUMNS =\\s*'[^']*\\b${c}\\b`), `the print does not read ${c} — the Hub’s answer needs it`);
  }

  assert.match(set, /dateLabel: printedDate\(event\.event_date, event\.event_date_precision\),/, 'the printed date ignores how precise the Hub’s date is');
  for (const [precision, hasDay] of [['day', true], ['month', false], ['year', false]] as const) {
    const p = printedDate('2026-12-01', precision)!;
    const hub = dateDisplayOf('2026-12-01', precision)!;
    assert.ok(p.includes('2026') && hub.includes('2026'), `${precision}: the year is not on both`);
    assert.equal(/\b1\b/.test(p), hasDay, `${precision}: the print says "${p}" where the Event Hub says "${hub}"`);
    assert.equal(/Tuesday/.test(p), hasDay, `${precision}: the print names a weekday the couple never picked ("${p}")`);
    assert.equal(/December/.test(p), precision !== 'year', `${precision}: "${p}" vs the Hub’s "${hub}"`);
  }
});

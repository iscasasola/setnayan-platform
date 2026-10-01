/**
 * tap-to-type-is-instant.test.ts — ✍ TAP ANY TEXT, TYPE RIGHT THERE: ONE WRITE,
 * THE PAGE'S OWN WORDS, NOTHING RELOADS.
 *
 * Maker core part 2 (`prototypes/maker_in_four_2026-09-30_fable.html` frames B ·
 * C · H; DECISION_LOG "THE MAKER RE-PLAN IS CUT TO ITS CORE" and "EVERYTHING
 * REBUILT IN THE MAKER IS INSTANT BY DESIGN"). What this proves:
 *
 *   1. typed words become the part's OWN words on the hero's canvas (the field
 *      the joiner, link and caption already had), the page's own words or
 *      nothing = the automatic words back, and anything unsafe is refused, not
 *      stored — for every part a caret can go in;
 *   2. what the Maker shows for a Format ▾ pick is exactly what a guest's page
 *      draws for it — the masthead is rendered and compared — including
 *      "Ika-13 ng Marso, 2027", and no format = today's words, byte for byte;
 *   3. the eyebrow and the invitation line carry the couple's words to a
 *      guest's page, and the Maker canvas knows the automatic words to put back;
 *   4. Wording ▾ offers only lines that already exist (never invented), and one
 *      line alone is no dropdown;
 *   5. 🔒 THE GUARDS — the bar never renders the Maker (every save is `held`,
 *      through the element sheet's own queue and key; no refresh, no
 *      revalidate); the canvas half never saves; the caret is placed IN the
 *      tap (a phone raises its keyboard only then); a typed tap is not a
 *      selection that pops the style sheet; the bar loads with the Details
 *      pieces, never with the Maker.
 *   6. ✍ NAMES AND DATE WAIT FOR APPLY (owner 2026-10-01, DECISION_LOG "ELEVEN
 *      OWNER ANSWERS" #1, *"wait for apply"*) — the names are a tap-to-type
 *      part whose words are `events.display_name`, written to the DRAFT; the
 *      names' Wording ▾ is exactly the three Name styles, in the couple's own
 *      name, through the prints' one door; a date typed in Details is drafted
 *      too, and Apply asks the date's own gates. The schema half (a save leaves
 *      the events row untouched; Apply writes it once) is
 *      `tests/db/a-typed-name-and-date-wait-for-apply.db.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_JOINER_WORDS, sanitizeHubElements, type HubElementKey } from './element-style';
import { HUB_FORMAT_DEFAULT, HUB_DATE_FORMATS, HUB_TIME_FORMATS, formatHubDate } from './hub-date-formats';
import {
  HUB_TYPE_PARTS,
  HUB_TYPE_WORD_PARTS,
  formatChoices,
  formatWords,
  withTypedFormat,
  withTypedWords,
  wordingLines,
} from './type-in-place';
import { OPENING_LINE_TEMPLATES } from './opening-lines';
import { HUB_CARD_EYEBROWS } from './hub-part-words';
import { invitationCard } from '../app/[slug]/_lib/invitation-card';
import { stripComments } from './strip-comments';
import { HUB_TYPE_FACT_PARTS, isTypeCaretPart } from './hub-part-words';
import { NAME_STYLES, nameStyleChoicesFor } from './name-style';
import { coupleNameColumns, typedDisplayName } from './typed-names';
import { emptyHubDraft, mergeHubDraft, planHubDraftApply, sanitizeHubDraftEventValue, summarizeHubDraft } from './hub-draft';
import { eventDateRefusal } from './events';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const CARD = invitationCard({
  words: { solemn: false, twoPeople: true, eventWord: 'wedding' },
  firstStartAt: '2027-03-13T14:30:00Z',
  firstLabel: 'Guests arrive',
})!;

async function hero(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('../app/[slug]/_components/pahina-masthead');
  return renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: 'Ana & Miguel',
      eventDate: '2027-03-13',
      twoPeople: true,
      card: CARD,
      ...props,
    }),
  );
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/* ═══ 1 · TYPED WORDS → THE PART'S OWN WORDS, ONE CANVAS ═══ */

test('1 · typed words become the part’s own words; the automatic words or nothing clear them; unsafe is refused', () => {
  for (const el of HUB_TYPE_WORD_PARTS as readonly HubElementKey[]) {
    const typed = el === 'joiner' ? 'at' : 'With love, from us';
    const auto = el === 'joiner' ? 'and' : 'The page’s own words';
    const own = withTypedWords(null, el, `  ${typed}  `, auto);
    assert.equal(own.refused, false, el);
    assert.equal(own.elements?.[el]?.word, typed, `${el}: the typed words are its own`);
    // Built on what is there: another part's look rides along untouched.
    const kept = withTypedWords({ names: { color: '#8a1c2b' } }, el, typed, auto);
    assert.equal(kept.elements?.names?.color, '#8a1c2b', `${el}: the rest of the hero is kept`);
    assert.equal(withTypedWords(own.elements, el, auto, auto).elements, null, `${el}: its automatic words = no word stored`);
    assert.equal(withTypedWords(own.elements, el, '   ', auto).elements, null, `${el}: emptied = the automatic words back`);
    const bad = withTypedWords(own.elements, el, 'a\u0000b', auto);
    assert.equal(bad.refused, true, `${el}: a control character is refused`);
    assert.equal(bad.elements?.[el]?.word, typed, `${el}: …and the last good words are kept`);
  }
  assert.equal(withTypedWords(null, 'line', 'x'.repeat(121), null).refused, true, 'one short line');
});

/* ═══ 2 · FORMAT ▾ — THE MAKER'S WORDS ARE THE GUEST'S WORDS ═══ */

test('2 · every date format the Maker shows is exactly what the guest page draws — Ika-13 ng Marso, 2027 included', async () => {
  const base = text(await hero({}));
  assert.match(base, /March 13, 2027/, 'no format = today’s words');
  assert.equal(await hero({ elements: sanitizeHubElements({ date: { format: 'bogus' } }) }), await hero({}), 'an unknown format is dropped');
  for (const f of HUB_DATE_FORMATS) {
    const elements = withTypedFormat(null, 'date', f);
    const want = formatWords('date', f, { iso: '2027-03-13' })!;
    assert.equal(want, formatHubDate('2027-03-13', f));
    const html = text(await hero({ elements }));
    assert.ok(html.includes(want), `${f}: the page draws “${want}”`);
  }
  assert.equal(formatHubDate('2027-03-13', 'tagalog'), 'Ika-13 ng Marso, 2027');
  assert.deepEqual(
    formatChoices('date', { iso: '2027-03-13' }).map((c) => c.label),
    ['March 13, 2027', '13 March 2027', 'Saturday, March 13, 2027', 'Sat · Mar 13', '03 · 13 · 2027', 'Ika-13 ng Marso, 2027'],
    'ONE list, in the prototype’s order, each in the couple’s own date',
  );
  assert.equal(withTypedFormat({ date: { format: 'dmy' } }, 'date', HUB_FORMAT_DEFAULT), null, 'the page’s own = nothing stored');
});

test('2b · every time format the Maker shows is what the guest page draws, after the moment’s own title', async () => {
  assert.match(text(await hero({})), /Guests arrive 2:30 PM/, 'no format = today’s words');
  assert.deepEqual(
    formatChoices('time', { at: '2027-03-13T14:30:00Z' }).map((c) => c.label),
    ['2:30 PM', '14:30', 'Two-thirty in the afternoon', 'Half past two'],
  );
  for (const f of HUB_TIME_FORMATS) {
    const want = formatWords('time', f, { at: CARD.timeAt, title: CARD.timeTitle })!;
    const html = text(await hero({ elements: withTypedFormat(null, 'time', f) }));
    assert.ok(html.includes(want), `${f}: the page draws “${want}”`);
  }
});

/* ═══ 3 · THE EYEBROW AND THE LINE CARRY THE COUPLE'S WORDS ═══ */

test('3 · the eyebrow and the line: the couple’s words for a guest; the automatic words known to the Maker canvas', async () => {
  const elements = sanitizeHubElements({ eyebrow: { word: 'With joy' }, line: { word: 'request your presence' } });
  const guest = await hero({ elements });
  assert.match(text(guest), /With joy/);
  assert.match(text(guest), /request your presence/);
  assert.doesNotMatch(guest, /Together with their families|invite you to celebrate/, 'replaced, not added to');
  assert.doesNotMatch(guest, /data-el/, 'a guest’s markup never carries the Maker’s marks');
  const maker = await hero({ elements, stampElements: true });
  assert.match(maker, /data-el-word="Together with their families"/, 'the eyebrow’s automatic words, to put back');
  assert.match(maker, /data-el-word="invite you to celebrate their wedding"/, 'the line’s automatic words, to put back');
  assert.match(maker, /data-el-iso="2027-03-13"/, 'the date’s fact, for Format ▾');
  assert.match(maker, /data-el-at="2027-03-13T14:30:00Z"/, 'the time’s fact, for Format ▾');
});

/* ═══ 4 · WORDING ▾ OFFERS ONLY WHAT EXISTS ═══ */

test('4 · Wording ▾ offers only existing lines, the page’s own first; one line alone is no dropdown', () => {
  const known = new Set<string>([
    HUB_CARD_EYEBROWS.twoPeople,
    HUB_CARD_EYEBROWS.one,
    ...OPENING_LINE_TEMPLATES.map((t) => t.body),
    ...HUB_JOINER_WORDS,
  ]);
  for (const el of HUB_TYPE_PARTS as readonly HubElementKey[]) {
    for (const twoPeople of [true, false]) {
      const auto = 'The page’s own';
      const lines = wordingLines(el, { auto, twoPeople });
      if (lines.length === 0) continue;
      assert.equal(lines[0], auto, `${el}: the page’s own words first`);
      for (const l of lines.slice(1)) assert.ok(known.has(l), `${el}: “${l}” is not a line the product already has`);
    }
  }
  assert.deepEqual(wordingLines('link', { auto: 'the day, the place, the story', twoPeople: true }), [], 'one line is no choice');
  assert.ok(wordingLines('eyebrow', { auto: HUB_CARD_EYEBROWS.twoPeople, twoPeople: true }).length >= 2);
  assert.deepEqual(wordingLines('joiner', { auto: 'and', twoPeople: true }), ['and', '&', '+']);
});

/* ═══ 5 · THE GUARDS ═══ */

test('5a · the bar never renders the Maker: every save is held, in the element sheet’s own queue and key', () => {
  const bar = read('app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx');
  const saves = bar.match(/makerSave\(/g) ?? [];
  assert.equal(saves.length, 1, 'ONE write path for every change the bar makes');
  assert.match(bar, /makerSave\(\s*\(\) => makerLatestWrite\(key, \(\) => saveDraft\(draftAction, eventId, patch\)\)/, 'one queue, the latest write per key');
  assert.match(bar, /write\(\s*canvasWriteKey\('hero'\),\s*\{ widgets: \{ hero: \{ canvas: next \} \} \},\s*\{ messages: layMessages\(before, next\), typedIn \}/, 'the hero’s canvas: the element sheet’s queue and key, drawn first');
  assert.match(bar, /\) => \{\s*postToCanvas\(shown\.messages, shown\.typedIn\);[\s\S]*?makerSave\(/, 'the one write path draws on the canvas before it saves');
  assert.match(bar, /requestMakerRefresh,\s*\{ held: true, ok:/, 'held — no Maker render behind it');
  assert.match(bar, /noteDraftedCanvas\('hero', next/, 'the Maker’s own copy, before the write');
  assert.match(bar, /onSaving\('hero', next\)/, 'the canvas hold, before the write');
  assert.doesNotMatch(bar, /revalidatePath|router\.refresh|location\.reload|contentWindow\.location/);
  assert.equal((bar.match(/requestMakerRefresh/g) ?? []).length, 2, 'imported, and handed to makerSave only — never called');
});

test('5b · the canvas half never saves, and puts the caret in the tap itself', () => {
  const canvas = read('app/[slug]/_components/type-in-place-canvas.ts');
  assert.doesNotMatch(canvas, /fetch\(|actions'|FormData|makerSave|hub-draft/, 'the canvas only types and tells');
  assert.match(canvas, /contenteditable', 'plaintext-only'/, 'words only, never markup');
  const from = canvas.indexOf('begin(part, key, el, at) {');
  assert.ok(from > 0, 'the canvas has its begin');
  const begin = canvas.slice(from, canvas.indexOf('stop: () => {', from));
  assert.doesNotMatch(begin, /await|setTimeout|then\(/, 'the focus is made in the tap — a phone raises its keyboard only then');
  assert.match(begin, /target\.focus\(/);
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  const send = bridge.slice(bridge.indexOf('const send = (e: Event)'), bridge.indexOf("el.addEventListener('click', send)"));
  assert.match(send, /typing\.begin\(/, 'the tap on a part begins typing, in the click');
  assert.match(bridge, /if \(typing\.typing\(\)\) return;/, 'a typed tap is not a selection that opens the style sheet');
});

test('5c · the bar loads with the Details pieces on the first tap, never with the Maker; a keystroke never re-renders the Maker', () => {
  // Raw (with comments): the chunk's NAME is a comment, and it is what keeps the runtime from growing.
  const lazy = readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/details-lazy.tsx'), 'utf8');
  assert.match(
    lazy,
    /export const TypeBar = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\.\/\.\.\/website\/editor\/_components\/type-in-place'\)/,
    'in the Details pieces’ own chunk — no new chunk, no new runtime entry',
  );
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.doesNotMatch(shell, /from '\.\/type-in-place'/, 'the shell never imports the bar itself');
  assert.match(shell, /<TypeBar\b/);
  // The shell keeps only the tap that began typing; the bar hears the keystrokes.
  assert.match(shell, /readTypeStart\(event\.data/);
  assert.doesNotMatch(shell, /phase === 'input'|t === 'type'/, 'no keystroke reaches the Maker’s own state');
  const bar = read('app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx');
  assert.match(bar, /window\.addEventListener\('message', onMessage\)/, 'the bar hears the canvas itself');
  assert.match(bar, /t: 'typeSync'/, 'letters typed while it loaded are asked for, not lost');
});

/* ═══ 6 · NAMES AND DATE WAIT FOR APPLY ═══ */

const BAR = () => read('app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx');
const L = 'app/dashboard/[eventId]/launch/_components/';

test('6a · the names are a tap-to-type part — a caret in each person, the words are the event’s names', async () => {
  assert.ok((HUB_TYPE_PARTS as readonly string[]).includes('names'), 'a tap on the names types');
  assert.ok(isTypeCaretPart('names'), 'a caret goes in the names');
  assert.deepEqual([...HUB_TYPE_FACT_PARTS], ['names'], 'the names are a FACT part (the event’s, not the hero’s own words)');
  assert.ok(!(HUB_TYPE_WORD_PARTS as readonly string[]).includes('names'), 'the names never become a canvas word');
  // Each person is its own caret target — the joiner between them stays the Joiner's.
  const maker = await hero({ stampElements: true });
  assert.match(maker, /data-el-person="0"[^>]*>Ana</);
  assert.match(maker, /data-el-person="1"[^>]*>Miguel</);
  assert.doesNotMatch(await hero({}), /data-el-person/, 'a guest’s markup never carries the Maker’s marks');
  const canvas = read('app/[slug]/_components/type-in-place-canvas.ts');
  assert.match(canvas, /const target = typeTargetOf\(part, doc\.elementFromPoint\(at\.x, at\.y\)\);/, 'the caret goes in the person tapped');
  assert.match(canvas, /people\.map\(words\)\.filter\(Boolean\)\.join\(' & '\)/, 'both people, joined the way the page splits them');
  // What may be typed: a name on each side, no markup, never nothing.
  assert.equal(typedDisplayName('  Ana   Reyes &  Miguel ', true), 'Ana Reyes & Miguel');
  assert.equal(typedDisplayName('Ana & ', true), null, 'a side left empty');
  assert.equal(typedDisplayName('   ', true), null, 'nothing');
  assert.equal(typedDisplayName('<b>Ana</b>', false), null, 'markup');
  assert.equal(typedDisplayName('Ana', true), 'Ana', 'one name on a two-person page is still a name');
});

test('6b · typing the names writes the DRAFT’s events.display_name — the one held write path, never the live row', () => {
  const bar = BAR();
  assert.equal((bar.match(/makerSave\(/g) ?? []).length, 1, 'still ONE write path');
  assert.match(bar, /write\(\s*NAMES_WRITE_KEY,\s*\{ events: \{ display_name: name \} \},\s*\{ messages: \[\{ source: 'setnayan-editor', t: 'typeText', key: session\.key, el, text: name \}\], typedIn: session\.source \}/, 'the names go into the draft’s events — on the other pane first');
  assert.match(bar, /if \(el === 'names'\) \{\s*typeNames\(session\.text\);\s*return;\s*\}/, 'a keystroke in the names is a names write, not a canvas word');
  assert.doesNotMatch(bar, /updateEventMatchCriteria|from '\.\.\/\.\.\/\.\.\/actions'|\.from\('events'\)/, 'the bar writes no live row');
  // The draft keeps what was typed — and refuses what no page may print.
  const d = mergeHubDraft(emptyHubDraft(), { events: { display_name: 'Ana Reyes & Miguel' } });
  assert.equal(d.events.display_name, 'Ana Reyes & Miguel');
  assert.equal(sanitizeHubDraftEventValue('display_name', null), undefined, 'a page is never made nameless');
  assert.equal(sanitizeHubDraftEventValue('display_name', 'Ana<script>'), undefined);
  // The draft action's save writes the draft and nothing else.
  const action = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const save = action.slice(action.indexOf("if (intent === 'save') {"), action.indexOf("if (intent === 'reset') {"));
  assert.ok(save.length > 0);
  assert.match(save, /writeHubDraft\(supabase, eventId, mergeHubDraft\(current, patch\)\)/);
  assert.doesNotMatch(save, /\.from\(|\.update\(|\.insert\(/, 'a save touched a table other than through the draft store');
});

test('6c · the names’ Wording ▾ offers EXACTLY the three Name styles, in the couple’s own name — and nothing else', () => {
  const ana = { first_name: 'Ana', middle_name: 'Santos', last_name: 'Reyes' };
  const choices = nameStyleChoicesFor(ana);
  assert.deepEqual(choices.map((c) => c.key), [...NAME_STYLES], 'the three styles, in order, and no fourth');
  assert.deepEqual(choices.map((c) => c.example), ['Ana Santos Reyes', 'Ana S. Reyes', 'Reyes, Ana S.'], 'each written in the couple’s own name');
  assert.deepEqual(choices.map((c) => c.label), ['Full', 'Middle initial', 'Surname first']);
  assert.deepEqual(
    nameStyleChoicesFor(null).map((c) => c.example),
    ['Mr. Manuel Cortez Casasola', 'Mr. Manuel C. Casasola', 'Mr. Casasola, Manuel C.'],
    'no name known yet → the owner’s own example',
  );
  const bar = BAR();
  // ONE PickMenu, built from those three only, saved through the prints' one door.
  assert.match(bar, /options=\{nameChoices\.map\(\(c\) => \(\{ key: c\.key, label: c\.example, hint: c\.label \}\)\)\}/);
  assert.match(bar, /const nameChoices = el === 'names' && p\.names \? nameStyleChoicesFor\(p\.names\.person\) : \[\];/);
  assert.match(bar, /void saveNameStyle\(p\.eventId, picked\)/, 'the prints’ own door — one setting, never a second');
  assert.doesNotMatch(bar, /fetch\(|name_style/, 'no second writer of the Name style');
  assert.match(read(`${L}details-your-event.tsx`), /const ok = await saveNameStyle\(eventId, style\);/, 'Details’ Name style ▾ is the same door');
});

test('6d · a name or date typed in Details › Your event is DRAFTED — the Maker calls no live date or names writer', () => {
  const editors = read(`${L}details-your-event.tsx`);
  assert.doesNotMatch(editors, /updateEventDate|updateEventMatchCriteria/, 'a Maker editor still writes the names or the date live');
  assert.match(editors, /fd\.set\('patch', JSON\.stringify\(\{ events \}\)\);\s*const r = await makerSave\(\(\) => hubDraftAction\(eventId, fd\), requestMakerRefresh\);/);
  assert.match(editors, /const events = coupleNameColumns\(a, b\);/, 'the Personalization writer’s own composition');
  assert.match(editors, /draftFacts\(eventId, \{ display_name: typed \}\)/, 'one person’s name');
  assert.match(editors, /draftFacts\(eventId, \{ event_date: `\$\{m\}-01`, event_date_precision: 'month' \}\)/, 'a month');
  assert.match(editors, /draftFacts\(eventId, \{ event_date: value, event_date_precision: 'day' \}\)/, 'a day');
  assert.match(editors, /saveDate=\{saveDay\}/, 'the governed row saves its day into the draft, after its supplier preview');
  const governed = read('app/dashboard/[eventId]/details/_components/governed-fields.tsx');
  assert.match(governed, /if \(saveDate\) return saveDate\(value\);/);
  // No piece of the Maker writes the date or the names live.
  for (const f of readdirSync(join(WEB, L)).filter((n) => /\.tsx?$/.test(n) && !n.endsWith('.test.ts'))) {
    assert.doesNotMatch(read(`${L}${f}`), /\bupdateEventDate\(|\bupdateEventMatchCriteria\(/, `${f} writes the date or the names live`);
  }
  // The Personalization page's writer and the Maker's draft compose the names ONE way.
  assert.match(read('app/dashboard/[eventId]/actions.ts'), /const cols = coupleNameColumns\(/);
  assert.deepEqual(coupleNameColumns({ first: 'Ana', last: 'Reyes' }, { first: 'Miguel', last: 'Santos' }), {
    bride_name: 'Ana Reyes',
    groom_name: 'Miguel Santos',
    display_name: 'Ana & Miguel',
  });
  assert.equal('display_name' in coupleNameColumns({ first: '', last: '' }, { first: '', last: '' }), false, 'a blank form never blanks the page’s names');
});

test('6e · Apply asks the date’s OWN gates — the one rule `updateEventDate` asks', () => {
  const NOW = new Date(2027, 0, 10);
  const prior = { date: '2027-03-13', precision: 'day' };
  assert.equal(eventDateRefusal(prior, { date: '2026-12-31', precision: 'day' }, 0, NOW), 'in_past');
  assert.equal(eventDateRefusal(prior, { date: '2027-04-17', precision: 'day' }, 0, NOW), null, 'no supplier booked: free to move');
  assert.equal(eventDateRefusal(prior, { date: '2027-04-17', precision: 'day' }, 2, NOW), 'locked', 'a booked supplier holds the day');
  assert.equal(eventDateRefusal(prior, { date: '2027-03-13', precision: 'month' }, 2, NOW), 'widens', 'never less precise once booked');
  assert.equal(eventDateRefusal({ date: null, precision: null }, { date: '2027-04-17', precision: 'day' }, 2, NOW), null, 'a first date is never locked');
  const action = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(action, /const refusal = eventDateRefusal\(priorDate, nextDate, confirmed\);/);
  assert.match(action, /if \(dateHeld && isDateItem\(item\)\) \{\s*held\.push\(\{ item, reason: dateHeld \}\);\s*continue;\s*\}/, 'a refused date stays in the draft');
  assert.match(action, /if \(countErr\) return \{ ok: false, intent, error:/, 'an unread supplier count is never "none booked"');
  assert.match(read('app/dashboard/[eventId]/actions.ts'), /const refusal = eventDateRefusal\(prior, next, count \?\? 0\);/, 'the live writer asks the same rule');
  // And the plan: a typed date is one free change, applied — never Pro.
  const draft = mergeHubDraft(emptyHubDraft(), { events: { event_date: '2027-04-17', event_date_precision: 'day' } });
  const plan = planHubDraftApply(draft, { events: { event_date: '2027-03-13', event_date_precision: 'day' }, widgets: [] }, false);
  assert.equal(plan.refused.length, 0);
  assert.deepEqual(plan.apply.map((i) => (i.kind === 'event' ? i.column : i.kind)), ['event_date']);
});

test('6f · Apply counts a typed fact ONCE — the names are three columns, the date two', () => {
  const draft = mergeHubDraft(emptyHubDraft(), {
    events: { display_name: 'Ana & Miguel', bride_name: 'Ana Reyes', groom_name: 'Miguel Santos', event_date: '2027-04-17', event_date_precision: 'month' },
  });
  const sum = summarizeHubDraft(draft, { events: {}, widgets: [] }, false);
  assert.equal(sum.changeCount, 2, 'Your names · Your date');
  assert.equal(sum.proCount, 0);
});

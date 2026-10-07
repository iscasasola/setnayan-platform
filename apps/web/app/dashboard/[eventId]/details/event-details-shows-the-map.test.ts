/**
 * event-details-shows-the-map.test.ts — Event Details shows every collected
 * fact and keeps empty, failed and hidden apart.
 *
 * ⚖ 2026-10-04 (DECISION_LOG "YES TO ALL"): the rows are now EDITED IN PLACE —
 * each opens the Maker's own field (held by `every-fact-has-one-editor.test.ts`),
 * and the record is four folds on the phone (held by
 * `the-record-is-four-folds-on-the-phone.test.ts`). Every MAP fact is still
 * here, now inside its group's fold.
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "EVENT DETAILS IS INFORMATION ONLY"):
 * *"Technically, everything that is collected will be here."* The build spec's
 * MAP names, for each question asked, the Event Details row that shows it
 * (`EVENT_DETAILS_MAP` in `lib/event-details-sheet.ts`). This file holds the
 * PAGE to that list — per row, inside the right section — so a fact that drops
 * off the sheet turns this red instead of quietly going missing.
 *
 * 🔑 A COUNT, NOT A SAMPLE. Every MAP row is checked and the number checked is
 * asserted, so shrinking the list cannot make this pass while proving less.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  COULD_NOT_LOAD,
  EVENT_DETAILS_MAP,
  EVENT_DETAILS_SECTIONS,
  HIDDEN_BY_THE_COUPLE,
  NOT_SET_YET,
  howGuestsGetIn,
  rsvpQuestions,
  sheetDate,
} from '@/lib/event-details-sheet';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE = read('app/dashboard/[eventId]/details/page.tsx');
// 'access' (People with access, owner 2026-10-03) is the sheet's one LIVE part
// and is drawn by its own component, not `<Section>` — held by the test below.
const SECTION_KEYS = EVENT_DETAILS_SECTIONS.map((s) => s.key).filter((k) => k !== 'put-away' && k !== 'access');

/** The JSX between `<Section k="key"` and the next `<Section k=` / fold (or the end of the grid). */
function sectionBody(key: string): string {
  const m = new RegExp(`<Section\\s+k="${key}"`).exec(PAGE);
  assert.ok(m, `the page draws no "${key}" section`);
  const start = m.index;
  const next = PAGE.slice(start + 1).search(/<Section\s+k="|<RecordFold\b/);
  const end = next < 0 ? PAGE.indexOf('data-section="put-away"') : start + 1 + next;
  return PAGE.slice(start, end);
}

test('every MAP row with an Event Details column renders, in its own section (count)', () => {
  // The spec's MAP (2026-10-01) had 22 rows with an "Event Details row" column;
  // 21 since 2026-10-05, when A-Hub "Theme" left with the theme pick (DECISION_LOG
  // "THEMES ARE REPLACED BY THREE DIRECT GLOBAL SETTINGS").
  assert.equal(EVENT_DETAILS_MAP.length, 21, 'the MAP list shrank or grew — re-read it against the build spec');
  assert.ok(!EVENT_DETAILS_MAP.some((r) => r.fact === 'theme'), 'a Theme fact came back to Event Details');
  const missing: string[] = [];
  let checked = 0;
  for (const row of EVENT_DETAILS_MAP) {
    checked += 1;
    if (!sectionBody(row.section).includes(`fact="${row.fact}"`)) {
      missing.push(`${row.asked} "${row.question}" → ${row.section} (fact="${row.fact}")`);
    }
  }
  assert.equal(checked, EVENT_DETAILS_MAP.length);
  assert.deepEqual(missing, [], `These collected facts are not on Event Details:\n  ${missing.join('\n  ')}`);
});

test('the page draws each section exactly once, and Put this away last', () => {
  for (const key of SECTION_KEYS) {
    const n = PAGE.split(`k="${key}"`).length - 1;
    assert.equal(n, 1, `section "${key}" is drawn ${n} times`);
  }
  const putAway = PAGE.indexOf('data-section="put-away"');
  assert.ok(putAway > 0, 'Put this away is not on the sheet');
  for (const key of SECTION_KEYS) assert.ok(PAGE.indexOf(`k="${key}"`) < putAway, `"${key}" sits after Put this away`);
  assert.match(PAGE, /<PutAwayCard\b/);
});

test('only the parts another flow owns carry a quiet "Open … ›" link — one each', () => {
  for (const key of SECTION_KEYS) {
    const body = sectionBody(key);
    const head = body.slice(0, body.indexOf('>') + 1 + 400);
    const opens = (head.match(/label: 'Open /g) ?? []).length;
    const owned = ['guests', 'budget', 'suppliers', 'services', 'purchases'].includes(key);
    assert.equal(opens, owned ? 1 : 0, `section "${key}" has ${opens} Open links in its header (${owned ? 'one' : 'none — its rows open their own field'})`);
  }
});

test('People with access is the ONE live part — mounted once, in its own file, before Put this away', async () => {
  // ⚖ Owner 2026-10-03: access is set per person, per area, in Event Details ›
  // People with access. Access is a door, so it changes at once — the one part
  // of the sheet that is not a read-out. Everything else stays information only.
  assert.equal((PAGE.match(/<PeopleWithAccess\b/g) ?? []).length, 1, 'People with access is not drawn exactly once');
  assert.match(PAGE, /from '\.\/_components\/people-with-access'/, 'People with access is not its own component');
  assert.ok(PAGE.indexOf('<PeopleWithAccess') < PAGE.indexOf('data-section="put-away"'), 'People with access sits after Put this away');
  // Only a host loads everyone; a delegate sees their own access, as words.
  assert.match(PAGE, /viewer\.isCouple\s*\?\s*loadPeopleWithAccess\(eventId, user\.id\)/, 'people with access is loaded for a non-host');
  assert.match(PAGE, /readOnly=\{!people\}/, 'a delegate is handed dropdowns');
  const section = read('app/dashboard/[eventId]/details/_components/people-with-access.tsx');
  assert.match(section, /data-section="access"/);
  const { PEOPLE_WITH_ACCESS_ANCHOR } = await import('@/lib/people-with-access-href');
  assert.ok(section.includes(`id="${PEOPLE_WITH_ACCESS_ANCHOR}"`), 'the links to People with access land nowhere');
});

test('the record itself mounts no editor and posts nothing — the fields arrive in the @field slot', () => {
  // ⚖ 2026-10-04: rows open the Maker's editors — but in the field slot
  // (`record-field-slot.tsx`), one at a time, never all of them in the record.
  for (const editor of ['DetailsForm', 'GovernedFields', 'PaxSettingsCard', 'EventSettingsEditor', 'RecordEditor']) {
    assert.ok(!PAGE.includes(editor), `the record mounts ${editor} itself — it belongs in the open row's field`);
  }
  assert.ok(!/<form\b/.test(PAGE), 'Event Details draws a form');
  assert.ok(!/from '\.\.?\/[^']*actions'/.test(PAGE), 'Event Details imports a server action');
  assert.ok(!/'use client'/.test(PAGE), 'Event Details became a client component (shared bundle has no room)');
  const layout = read('app/dashboard/[eventId]/details/layout.tsx');
  assert.match(layout, /\{children\}\s*\{field\}/, 'the record lost its field slot');
});

test('Event settings open in place from their rows — and are never mounted in the Maker', () => {
  // 🗂 The /details/change page's three editors save LIVE through their own
  // actions, which breaks "nothing in the Maker takes effect until Apply" — so
  // they never ride the Maker. Since 2026-10-04 the record's own rows (kind,
  // area, the estimate, the list's closing day, how costs are shown) open them
  // in place; the page's address lands there.
  // The old address lands on the record with that field open — one editor, one home.
  const page = read('app/dashboard/[eventId]/details/change/page.tsx');
  assert.match(page, /redirect\(`\/dashboard\/\$\{eventId\}\/details\/field\/area`\)/);
  const editor = read('app/dashboard/[eventId]/details/_components/record-editor.tsx');
  assert.match(editor, /case 'settings': \{[\s\S]{0,300}?<EventSettingsEditor\b/);
  const settings = read('app/dashboard/[eventId]/details/_components/event-settings-editor.tsx');
  for (const e of ['<DetailsForm', '<GovernedFields', '<PaxSettingsCard']) {
    assert.ok(settings.includes(e), `Event settings no longer mounts ${e}`);
  }
  for (const rel of [
    'app/dashboard/[eventId]/launch/_components/details-answers.tsx',
    'app/dashboard/[eventId]/launch/_components/details-answers-parts.tsx',
    'app/dashboard/[eventId]/launch/_components/details-lazy.tsx',
    'app/dashboard/[eventId]/launch/_components/maker-details.tsx',
  ]) {
    const src = read(rel);
    assert.ok(
      !/<(DetailsForm|GovernedFields|PaxSettingsCard|EventSettingsEditor)\b|EventSettingsEditor = dynamic/.test(src),
      `${rel} mounts a live-saving Event settings editor in the Maker`,
    );
  }
  assert.doesNotMatch(read('lib/legacy-redirects.ts'), /\['details\/change',/, 'the Event settings page is redirected away again');
});

test('empty, failed and hidden are three different words, and the page uses all three', () => {
  assert.notEqual(NOT_SET_YET, COULD_NOT_LOAD);
  assert.notEqual(NOT_SET_YET, HIDDEN_BY_THE_COUPLE);
  assert.notEqual(COULD_NOT_LOAD, HIDDEN_BY_THE_COUPLE);
  for (const word of ['NOT_SET_YET', 'COULD_NOT_LOAD', 'HIDDEN_BY_THE_COUPLE']) {
    assert.ok(PAGE.includes(word), `the page never says ${word}`);
  }
  // A refused budget reader is told it is hidden, never shown an empty budget.
  assert.match(PAGE, /moneyHidden \? \(\s*<Row fact="budget-target" label="Budget" value=\{HIDDEN_BY_THE_COUPLE\}/);
});

test('the fixed bugs stay fixed: venues come from bookings, never a setting type; no "vendors" in copy', () => {
  const venues = sectionBody('venues');
  assert.ok(PAGE.includes('pickVenueBookingRows('), 'venues are no longer read from the confirmed bookings');
  assert.ok(!/value=\{[^}]*venue_setting/.test(venues), 'a venue SETTING is drawn as the venue');
  // What a person READS: JSX text, and string literals with a space in them
  // (copy has spaces; keys like the 'vendors' permission area and routes do not).
  const jsxText = [...PAGE.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]!);
  const phrases = [...PAGE.matchAll(/'([^'\n]* [^'\n]*)'|`([^`\n]* [^`\n]*)`|="([^"\n]* [^"\n]*)"/g)].map(
    (m) => m[1] ?? m[2] ?? m[3]!,
  );
  const said = [...jsxText, ...phrases].filter((t) => /\bvendors?\b/i.test(t));
  assert.ok(jsxText.length > 5 && phrases.length > 10, 'the copy scan found almost nothing — it is not measuring the page');
  assert.deepEqual(said, [], 'the word "vendor" is back in Event Details copy');
});

test('Event Home carries the Event Details button beside the event name', () => {
  const home = read('app/dashboard/[eventId]/_components/home-first-screen.tsx');
  assert.match(home, /href=\{`\/dashboard\/\$\{eventId\}\/details`\}[\s\S]{0,200}Event Details/);
  const cover = home.slice(home.indexOf('{cover.name}'), home.indexOf('{cover.name}') + 600);
  assert.ok(cover.includes('data-home-event-details'), 'the button is not on the cover beside the name');
});

test('how guests get in — one fact, the shipped readers', () => {
  assert.deepEqual(howGuestsGetIn(null), { value: 'Only my list · They reply', chosen: false });
  assert.deepEqual(howGuestsGetIn({ whoCanRsvp: 'anyone' }), { value: 'My list + requests · They reply', chosen: true });
  assert.equal(howGuestsGetIn({ guestsReply: false }).value, 'Only my list · No reply');
  assert.equal(howGuestsGetIn({ guestsReply: false, whoCanRsvp: 'anyone' }).value, 'Open · Anyone with the link');
  assert.equal(
    howGuestsGetIn({ guestsReply: false, whoCanRsvp: 'anyone', approveEach: true }).value,
    'My list + requests · No reply',
  );
});

test('RSVP questions: absent is ON, only false is off; no reply means no questions', () => {
  assert.ok(rsvpQuestions({}).includes('Meal'));
  assert.ok(!rsvpQuestions({ meal: false }).includes('Meal'));
  assert.deepEqual(rsvpQuestions({ guestsReply: false }), []);
});

test('a date column is a calendar day — no zone shift', () => {
  // 4 Dec 2026 is a Friday wherever the server sits.
  assert.match(sheetDate('2026-12-04') ?? '', /Fri/);
  assert.match(sheetDate('2026-12-04') ?? '', /\b4\b/);
  assert.match(sheetDate('2026-12-04') ?? '', /Dec/);
  assert.equal(sheetDate(null), null);
  assert.equal(sheetDate('not a date'), null);
});

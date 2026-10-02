/**
 * event-details-shows-the-map.test.ts — Event Details shows every collected
 * fact, edits none of them, and keeps empty, failed and hidden apart.
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
const SECTION_KEYS = EVENT_DETAILS_SECTIONS.map((s) => s.key).filter((k) => k !== 'put-away');

/** The JSX between `<Section k="key"` and the next `<Section k=` (or the end of the grid). */
function sectionBody(key: string): string {
  const m = new RegExp(`<Section\\s+k="${key}"`).exec(PAGE);
  assert.ok(m, `the page draws no "${key}" section`);
  const start = m.index;
  const next = PAGE.slice(start + 1).search(/<Section\s+k="/);
  const end = next < 0 ? PAGE.indexOf('data-section="put-away"') : start + 1 + next;
  return PAGE.slice(start, end);
}

test('every MAP row with an Event Details column renders, in its own section (count)', () => {
  // The spec's MAP (2026-10-01) has 22 rows with an "Event Details row" column.
  assert.equal(EVENT_DETAILS_MAP.length, 22, 'the MAP list shrank or grew — re-read it against the build spec');
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

test('each section carries at most ONE quiet "Open … ›" link', () => {
  for (const key of SECTION_KEYS) {
    const body = sectionBody(key);
    const head = body.slice(0, body.indexOf('>') + 1 + 400);
    const opens = (head.match(/label: 'Open /g) ?? []).length;
    assert.ok(opens >= 1 && opens <= 2, `section "${key}" has ${opens} Open links in its header (one, or one per kind of event)`);
  }
});

test('information only: the sheet mounts no editor and posts nothing (Put this away aside)', () => {
  for (const editor of ['DetailsForm', 'GovernedFields', 'PaxSettingsCard']) {
    assert.ok(!PAGE.includes(editor), `Event Details mounts ${editor} — it is a read-out, the editors live in Event settings`);
  }
  assert.ok(!/<form\b/.test(PAGE), 'Event Details draws a form');
  assert.ok(!/from '\.\.?\/[^']*actions'/.test(PAGE), 'Event Details imports a server action');
  assert.ok(!/'use client'/.test(PAGE), 'Event Details became a client component (shared bundle has no room)');
});

test('the moved editors still have a door — nothing the old page edited is stranded', () => {
  // 🗂 Owner 2026-10-02 ("EVERY ANSWER … LIVES IN EVENT DETAILS"): /details/change
  // folded into the Maker's Your info › Event settings. Event Details opens it
  // there; the three shipped editors are that item's own; the old address forwards.
  assert.ok(PAGE.includes("detailsItemHref(eventId, 'settings')"), 'Event Details lost its door to Your info › Event settings');
  assert.ok(!PAGE.includes('details/change'), 'Event Details still links the retired Event settings page');
  const settings = read('app/dashboard/[eventId]/launch/_components/details-answers.tsx');
  for (const editor of ['<DetailsForm', '<GovernedFields', '<PaxSettingsCard']) {
    assert.ok(settings.includes(editor), `Your info › Event settings no longer mounts ${editor}`);
  }
  assert.match(read('lib/legacy-redirects.ts'), /\['details\/change', 'launch\?tool=details&item=settings'\]/);
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
  assert.deepEqual(howGuestsGetIn(null), { value: 'Only people on my list', chosen: false });
  assert.deepEqual(howGuestsGetIn({ whoCanRsvp: 'anyone' }), { value: 'Anyone, I approve', chosen: true });
  assert.equal(howGuestsGetIn({ guestsReply: false }).value, 'No reply · a personal QR for each guest');
  assert.equal(howGuestsGetIn({ guestsReply: false, whoCanRsvp: 'anyone' }).value, 'No reply · one QR for everyone');
  assert.equal(
    howGuestsGetIn({ guestsReply: false, whoCanRsvp: 'anyone', approveEach: true }).value,
    'No reply · one QR, I approve each one',
  );
});

test('RSVP questions: absent is ON, only false is off; no reply means no questions', () => {
  assert.ok(rsvpQuestions({}).includes('Meal choice'));
  assert.ok(!rsvpQuestions({ meal: false }).includes('Meal choice'));
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

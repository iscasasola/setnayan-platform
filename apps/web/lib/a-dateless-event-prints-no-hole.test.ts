/**
 * AN EVENT WITH NO DATE NEVER PRINTS A SENTENCE WITH A HOLE IN IT.
 *
 * A guest's walk, 2026-10-11 (fault N06), on a real event with no date: the Event Hub's own line read
 * *"We'd love to celebrate with you on . You're joining us as Guest · Both sides."* — the date's words were empty
 * and the "on" in front of them was still printed. The seat pages said the table "shows on the day" for an event
 * whose day nobody had been told.
 *
 * WHAT IS HELD HERE — a property of the page, not a wording:
 *   (1) THE REAL GUEST PAGE (`SiteBody`, drawn by `lib/site-body-fixture-render.ts` with no database) for the fixture
 *       couple WITH NO DATE has no line in which a preposition stands in front of nothing, and no line that starts
 *       or ends on a separator. The same page WITH its date still prints the date (so (1) is not passing on a page
 *       that lost the line).
 *   (2) `withDayNote` — a sentence that points at "the day" is returned as given when there is a date, and is
 *       followed by one plain sentence when there is none.
 *   (3) EVERY PLACE a guest page formats the event's date is one of the shapes that cannot print an empty date
 *       into a sentence — a new call site that interpolates `formatEventDate(…)` bare goes red here, by name.
 *   (4) The five waiting states that say "on the day" (find-seat · find-my-table · seat · venue · hub) each pass
 *       their sentence through `withDayNote` with the event's date.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`, re-checked):
 *   · the greeting in `site-body.tsx` put back to the unconditional "…with you on" + the date → (1) red (the page
 *     prints "on ."), (3) red (the bare call site is named);
 *   · `withDayNote` made to return the sentence alone → (2) red;
 *   · the `withDayNote(` taken off `find-my-table/page.tsx` → (4) red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
/* FIRST: this import installs the seam the real page is drawn through (see the helper's docblock). */
import { renderSiteBodyFixture } from './site-body-fixture-render';
import { FIXTURE_EVENT, FIXTURE_WORDS } from './site-body-fixture';
import { stripComments } from './strip-comments';
import { DATE_STILL_TO_BE_CONFIRMED, withDayNote } from '../app/[slug]/_lib/day-words';

const WEB = join(__dirname, '..');

/** The page's words, one line per block — inline tags vanish, so "on <span></span>." reads "on ." as a guest sees it. */
function linesOf(html: string): string[] {
  return html
    .replace(/<(script|style|template|svg)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<\/(?:p|div|li|h[1-6]|section|article|header|footer|dd|dt|label|button|a|figcaption|summary|td|th)>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;|&rsquo;/g, '’')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** A sentence with a hole: a preposition in front of nothing, a space before a full stop, a separator with no neighbour. */
const HOLES: Array<[RegExp, string]> = [
  [/\b(?:on|at|in|by|from|until|to|for|with|of)\s+[.,;:!?]/i, 'a preposition in front of nothing'],
  [/\b(?:on|at|in|by|from|until|of)\s*—\s*(?:at|on)\b/i, 'a preposition in front of a dash'],
  [/\s[.,;:](?:\s|$)/, 'a space before the punctuation'],
  // (A cell that holds a dash and nothing else — the details list's "Venue —", which also stands for a place the
  // guest is shown only after replying — is a table's placeholder, not a sentence.)
  [/\S\s[·—–]\s*$/, 'a line that ends on a separator'],
  [/·\s*·/, 'two separators with nothing between them'],
];

function holesIn(html: string): string[] {
  const found: string[] = [];
  for (const line of linesOf(html)) {
    for (const [re, what] of HOLES) if (re.test(line)) found.push(`${what}: ${JSON.stringify(line.slice(0, 160))}`);
  }
  return found;
}

test('(0) the detector sees the fault it was written for, and passes the sentences that are whole', () => {
  // The line the guest was shown, as the page drew it.
  const seen =
    '<p>We’d love to celebrate with you on <span class="font-medium text-ink"></span>. You’re joining us as <span>Guest</span> · <span>Both sides</span>.</p>';
  assert.ok(holesIn(seen).some((h) => h.startsWith('a preposition in front of nothing')), 'the guest’s own line is not caught');
  assert.equal(holesIn('<p>Marco &amp; Marga · </p>').length, 1, 'a trailing separator is not caught');
  assert.deepEqual(holesIn('<p>We’d love to celebrate with you. You’re joining us as <span>Guest</span> · <span>Both sides</span>.</p>'), []);
  assert.deepEqual(holesIn('<p>We’d love to celebrate with you on <span>December 12, 2026</span> — at <span>Seda</span>. Come by 2:30 PM.</p>'), []);
});

test('(1) the real guest page of an event with no date has no sentence with a hole in it', async () => {
  const dated = await renderSiteBodyFixture();
  assert.ok(dated.includes(FIXTURE_WORDS.dateWords), 'anti-vacuity: the dated page no longer prints its date');
  assert.ok(dated.includes('You’re joining us as'), 'anti-vacuity: the guest’s own line is not on the page');
  assert.deepEqual(holesIn(dated), [], 'the dated page already has a hole — this guard would blame the wrong change');

  for (const venues of [true, false]) {
    const event = venues
      ? { ...FIXTURE_EVENT, event_date: null }
      : { ...FIXTURE_EVENT, event_date: null, venue_name: null, venue_address: null, venues: [] };
    const html = await renderSiteBodyFixture({ event });
    const what = venues ? 'no date' : 'no date and no place';
    assert.ok(html.length > 20_000, `${what}: the page is an empty shell`);
    assert.ok(!html.includes(FIXTURE_WORDS.dateWords), `${what}: the page still prints a date`);
    assert.ok(html.includes('You’re joining us as'), `${what}: the guest’s own line left the page`);
    assert.deepEqual(holesIn(html), [], `${what}: the guest page prints a sentence with a hole in it`);
  }
});

test('(2) "on the day" is followed by one plain sentence when the event has no date — and left alone when it has one', () => {
  const s = 'Your table shows here on the day.';
  assert.equal(withDayNote(s, '2026-12-12'), s);
  for (const none of [null, undefined, '', '   ']) {
    const out = withDayNote(s, none);
    assert.ok(out.startsWith(`${s} `) && out.length > s.length + 10, `no date (${JSON.stringify(none)}): nothing was added`);
    assert.ok(out.endsWith(DATE_STILL_TO_BE_CONFIRMED));
    assert.deepEqual(holesIn(`<p>${out}</p>`), []);
  }
});

/** Every non-test source file under the guest tree. */
function guestFiles(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(join(WEB, dir)).flatMap((name) => {
      const rel = `${dir}/${name}`;
      if (statSync(join(WEB, rel)).isDirectory()) return walk(rel);
      return /\.tsx?$/.test(name) && !/\.(?:test|fixture)\.tsx?$/.test(name) ? [rel] : [];
    });
  return walk('app/[slug]');
}

test('(3) every place a guest page formats the event’s date is a shape that cannot print an empty date into a sentence', () => {
  /* The shapes: the call is the arm of a condition on the date · it falls back with `||` · it is one of a list
     joined after `.filter(Boolean)` · or it is kept in a name first (and each such name is listed below, with the
     line that tests it before it is printed). */
  const SAFE = [
    /\?\s*(?:`[^`]*\$\{)?formatEventDate\(/, // `x ? formatEventDate(x) : null` · `x ? `, ${formatEventDate(x)}` : ''`
    /formatEventDate\([^)]*\)\s*\|\|/, // `formatEventDate(x) || null`
    /formatEventDate\([^)]*\)[^\n]*\.filter\(Boolean\)/, // `[formatEventDate(x), venue].filter(Boolean)`
    /\?\?\s*formatEventDate\(/, // `formatHubDate(…) ?? formatEventDate(x)` — kept in a name (below)
  ];
  /** A date kept in a name: the name, and what must stand in front of every place it is printed. */
  const NAMED: Record<string, { name: string; guard: RegExp }> = {
    'app/[slug]/_components/site-body.tsx': { name: 'greetingDate', guard: /\{greetingDate \? \(/ },
    'app/[slug]/_components/maker-guest-scenes.tsx': { name: 'date', guard: /\{date \? ` on \$\{date\}` : ''\}/ },
    'app/[slug]/_components/pahina-keepsake.tsx': { name: 'dateLabel', guard: /\{dateLabel \? \(/ },
    'app/[slug]/_components/pahina-masthead.tsx': { name: 'dateLabel', guard: /dateLabel \? / },
    'app/[slug]/_lib/supplier-desk.server.ts': { name: 'eventDateLabel', guard: /eventDateLabel: formatEventDate\(/ },
  };
  const sites: string[] = [];
  const bare: string[] = [];
  for (const rel of guestFiles()) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      if (!/\bformatEventDate\(/.test(line) || /^\s*import\b/.test(line)) return;
      sites.push(`${rel}:${line.trim().slice(0, 90)}`);
      if (SAFE.some((re) => re.test(line))) return;
      // …or the JSX around it is the arm of `{event.event_date ? (` a line or two up.
      if (/event_date \? \(\s*$/.test(lines.slice(Math.max(0, i - 3), i).join('\n').split('\n').find((l) => /event_date \? \(\s*$/.test(l)) ?? '')) return;
      const named = NAMED[rel];
      const keeps = new RegExp(`\\b${named?.name ?? '\\u0000'}\\b\\s*[:=]\\s*(?:formatHubDate\\([^)]*\\)\\s*\\?\\?\\s*)?formatEventDate\\(`);
      if (named && keeps.test(line) && named.guard.test(src)) return;
      bare.push(`${rel} line ${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  assert.ok(sites.length >= 12, `anti-vacuity: only ${sites.length} call sites were found under app/[slug]`);
  assert.ok(sites.some((s) => s.startsWith('app/[slug]/_components/site-body.tsx')), 'anti-vacuity: the guest page’s own call sites were not read');
  assert.deepEqual(
    bare,
    [],
    'a guest page formats the event’s date where an empty date would be printed into a sentence — give it a no-date form (see app/[slug]/_lib/day-words.ts)',
  );
});

test('(4) the five waiting states that say "on the day" each say so through withDayNote, with the event’s date', () => {
  const SITES = [
    'app/[slug]/find-seat/page.tsx',
    'app/[slug]/find-my-table/page.tsx',
    'app/[slug]/seat/page.tsx',
    'app/[slug]/venue/page.tsx',
    'app/[slug]/hub/page.tsx',
  ];
  for (const rel of SITES) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    const calls = [...src.matchAll(/withDayNote\(([\s\S]{0,420}?)\)\s*[,})]/g)].map((m) => m[1]!);
    assert.ok(calls.length >= 1, `${rel} no longer completes its "on the day" line for an event with no date`);
    for (const args of calls) {
      assert.match(args, /on the day/, `${rel}: withDayNote is handed a sentence that does not point at the day`);
      assert.match(args, /event_date|eventDate/, `${rel}: withDayNote is not handed the event’s date`);
    }
  }
});

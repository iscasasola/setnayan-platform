/**
 * A birthday is not a wedding on the event home and the bench (S38, 2026-09-19).
 *
 * Measured while writing the run sheet for the first non-wedding end-to-end run:
 * two host-facing lines still said "wedding" to every celebration —
 *   · the event home's date nudge ("Set your wedding date"), which also promised
 *     "your Save-the-Date", a surface only the wedding profile carries;
 *   · the bench's budget accordion, on an empty folder ("Nothing here yet for
 *     your wedding.").
 *
 * Both now read `eventNoun(event_type)` (weddings byte-identical). Same shape as
 * `a-debut-is-not-a-wedding-on-the-couple-pages.test.ts` (PR #5676): this guard
 * checks both halves — the fixed phrase is gone from the rendering file, AND the
 * page that mounts it passes the event's word in. A prop that defaults and is
 * never passed would leave the screen exactly as it was.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { eventNoun } from './event-noun';

const WEB = join(__dirname, '..');
const D = 'app/dashboard/[eventId]';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) ?? []).length;

test('eventNoun: a birthday reads "event", a wedding stays "wedding"', () => {
  assert.equal(eventNoun('birthday'), 'event');
  assert.equal(eventNoun('debut'), 'event');
  assert.equal(eventNoun('wedding'), 'wedding');
});

const CASES: Array<{
  name: string;
  file: string;
  banned: RegExp;
  /** The rendering file must reach for the event's word. */
  uses: RegExp;
  mount: { file: string; re: RegExp };
}> = [
  {
    name: 'event home date nudge',
    file: `${D}/_components/set-date-nudge.tsx`,
    banned: /Set your wedding date/,
    uses: /Set your \{noun\} date/,
    mount: {
      file: `${D}/page.tsx`,
      re: /<SetDateNudge eventId=\{eventId\} eventType=\{event\.event_type as string \| null\} \/>/,
    },
  },
  {
    name: 'bench budget accordion empty folder',
    file: `${D}/vendors/_components/plan-budget-accordion.tsx`,
    banned: /Nothing here yet for your wedding/,
    uses: /Nothing here yet for your \{eventNoun\(eventType\)\}/,
    mount: {
      file: `${D}/vendors/page.tsx`,
      re: /<PlanBudgetAccordion[\s\S]*?eventType=\{ev\?\.event_type \?\? null\}[\s\S]*?\/>/,
    },
  },
];

for (const c of CASES) {
  test(`${c.name}: no fixed wedding phrase, and the event's word is used`, () => {
    const src = read(c.file);
    const hits = count(src, c.banned);
    const used = count(src, c.uses);
    console.log(`${c.name}: ${hits} fixed wedding phrase(s) · ${used} use(s) of the event's word`);
    assert.equal(hits, 0);
    assert.equal(used, 1);
  });
  test(`${c.name}: the page passes the event's own word`, () => {
    const hits = count(read(c.mount.file), c.mount.re);
    console.log(`${c.name}: ${hits} mount(s) passing eventType`);
    assert.equal(hits, 1);
  });
}

test('the date nudge promises a Save-the-Date only to a wedding', () => {
  const src = read(`${D}/_components/set-date-nudge.tsx`);
  // The wedding arm keeps its original sentence byte-for-byte; the other arm
  // must not mention the Save-the-Date, which only the wedding profile has.
  assert.match(
    src,
    /noun === 'wedding'\s*\?\s*'Lock it in to start the countdown and unlock your Save-the-Date and editorial pages\.'/,
  );
  const arms = src.split("noun === 'wedding'")[1] ?? '';
  const otherArm = arms.split(':')[1] ?? '';
  assert.doesNotMatch(otherArm, /Save-the-Date/);
});

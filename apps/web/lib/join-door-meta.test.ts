/**
 * join-door-meta.test.ts — the invitation door says the date the way a person
 * writes one, and never says a date nobody has picked.
 *
 * TWO FAILURES ARE POSSIBLE HERE AND THEY PULL IN OPPOSITE DIRECTIONS, which is
 * why both arms are asserted:
 *
 *   1. The bug being fixed — the door printed `2026-12-18`, raw out of the
 *      database, on the first screen a guest ever sees.
 *   2. The bug the obvious fix would have introduced — `events.event_date` is
 *      only a decided day when `event_date_precision` says so. Prettily
 *      formatting a 'year'-precision placeholder announces a specific date the
 *      hosts have never picked. Measured in production 2026-08-20: 4 of 9
 *      events are 'year' precision while holding a real-looking date.
 *
 * ⚠ THE TIMEZONE ARM IS NOT DECORATION. `event_date` is a DATE column;
 * `new Date('2026-12-12')` is midnight UTC, which is the 11th anywhere west of
 * Greenwich, and CI runs in UTC — the one clock where that mistake is invisible.
 * The assertions below are written to hold in every zone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { joinDoorMeta } from './join-door-meta';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

const venue = 'Manila Cathedral';

test('a decided day is written the way a person writes it, never as 2026-12-18', () => {
  const meta = joinDoorMeta({
    event_date: '2026-12-18',
    event_date_precision: 'day',
    venue_name: venue,
  });
  assert.ok(meta, 'the door should say something');
  assert.ok(
    !/\d{4}-\d{2}-\d{2}/.test(meta!),
    `the door still prints a machine date: ${meta}`,
  );
  assert.ok(meta!.includes('December'), `expected the month in words, got: ${meta}`);
  // The day the hosts picked survives whatever zone the guest is reading in.
  assert.ok(meta!.includes('18'), `expected the 18th, got: ${meta}`);
  assert.ok(meta!.includes(venue), 'the venue should still be there');
});

test('a year-precision placeholder never becomes a specific day', () => {
  // A real production row: 'Mateo Turns Seven' — precision 'year', date 2027-03-09.
  const meta = joinDoorMeta({
    event_date: '2027-03-09',
    event_date_precision: 'year',
    venue_name: venue,
  });
  assert.ok(meta!.includes('2027'), `the year should survive: ${meta}`);
  assert.ok(
    !meta!.includes('March') && !meta!.includes('9'),
    `a date nobody picked was announced to a guest: ${meta}`,
  );
});

test('a month-precision placeholder says the month, not the first of it', () => {
  const meta = joinDoorMeta({
    event_date: '2027-08-01',
    event_date_precision: 'month',
    venue_name: null,
  });
  assert.ok(meta!.includes('August') && meta!.includes('2027'), meta);
  assert.ok(!meta!.includes('1,'), `it named a day: ${meta}`);
});

test('an unknown or missing precision says nothing about the date, and still says where', () => {
  for (const precision of [null, '', 'quarter', 'DAY']) {
    const meta = joinDoorMeta({
      event_date: '2026-12-18',
      event_date_precision: precision,
      venue_name: venue,
    });
    assert.equal(
      meta,
      venue,
      `precision ${JSON.stringify(precision)} should suppress the date, not guess it — got: ${meta}`,
    );
  }
});

test('no date and no venue means no line at all, not an empty separator', () => {
  assert.equal(
    joinDoorMeta({ event_date: null, event_date_precision: 'day', venue_name: null }),
    undefined,
  );
  assert.equal(
    joinDoorMeta({ event_date: null, event_date_precision: 'day', venue_name: venue }),
    venue,
  );
});

/**
 * 🛡 THE SOURCE ARM. The behaviour above is worthless if a door stops calling
 * this and hand-rolls the line again — which is exactly how these two doors
 * drifted apart in the first place (three of JoinShell's own siblings once
 * hand-copied its wrapper rather than importing it).
 *
 * Comments are stripped first: every file corrected here carries a note quoting
 * the expression it removed, so a raw scan finds the defect it just fixed.
 */
const DOORS = [
  'app/join/[eventId]/_components/join-shell.tsx',
  'app/join/[eventId]/success/page.tsx',
];

/** Pages that must SELECT the precision column beside the date. */
const READERS = [
  'app/join/[eventId]/page.tsx',
  'app/[slug]/invite/page.tsx',
  'app/join/[eventId]/success/page.tsx',
];

function stripped(rel: string): string {
  return readFileSync(join(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Pull out each `meta={...}` prop expression, brace-balanced.
 *
 * 🪤 WHY NOT A FILE-LEVEL SUBSTRING. The first draft of this arm asked whether
 * the file contained the string "joinDoorMeta" and whether it matched
 * `meta={[`. Sabotaging the door to hand-roll the line again — the exact
 * regression — left it GREEN twice over: the IMPORT line still carried the
 * name, and the replacement read `meta={event ? [event.event_date, …`, which
 * has a `event ? ` between the brace and the bracket. An import is not a call
 * and a file-level count cannot say which expression renders. Read the
 * expression itself.
 */
function metaExpressions(rel: string): string[] {
  const code = stripped(rel);
  const out: string[] = [];
  for (const m of code.matchAll(/meta=\{/g)) {
    let depth = 0;
    let i = m.index! + 'meta='.length;
    const start = i;
    for (; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push(code.slice(start, i + 1));
  }
  return out;
}

test('every join door renders its line through the one helper', () => {
  for (const rel of DOORS) {
    const metas = metaExpressions(rel);
    assert.ok(
      metas.length > 0,
      `${rel} renders no meta= line at all — either the door lost its "when and ` +
        'where" line, or this guard is looking at the wrong file.',
    );
    for (const expr of metas) {
      assert.match(
        expr,
        /\bjoinDoorMeta\s*\(/,
        `${rel} builds its meta line without calling joinDoorMeta: ${expr}`,
      );
      assert.ok(
        !/\bevent_date\b/.test(expr.replace(/joinDoorMeta\s*\([^)]*\)/g, '')),
        `${rel} touches event_date directly in its meta line. That is the ` +
          `original bug: the raw column cannot say whether it is a decided ` +
          `day. Expression: ${expr}`,
      );
    }
  }
});

test('every page feeding a door selects the precision beside the date', () => {
  for (const rel of READERS) {
    const code = stripped(rel);
    assert.ok(
      code.includes('event_date_precision'),
      `${rel} selects event_date without event_date_precision. The door then ` +
        'has no way to know whether that date is decided — and a required ' +
        'field passed as null means it says nothing at all, silently.',
    );
  }
});

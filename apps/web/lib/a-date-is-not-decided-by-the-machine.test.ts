/**
 * A DATE MEANS THE SAME THING ON EVERY MACHINE THAT DRAWS IT.
 *
 * ── WHAT THIS EXISTS TO CATCH ───────────────────────────────────────────────
 * The supplier's overview rendered six dates through
 * `toLocaleDateString('en-PH', …)`. A locale's short-date pattern is CLDR data:
 * it is versioned, it ships inside the running Node, and it can change under a
 * runtime upgrade without anyone editing a line. Nothing here would throw — the
 * dates would simply start reading the other way round one deploy, and no test
 * in the repo asserted what they say.
 *
 * 🔴 AND THE ORIGINAL DIAGNOSIS WAS WRONG, WHICH IS WHY THIS FILE PINS OUTPUT
 * RATHER THAN REPEATING A STORY. Two shipped docblocks claimed "the CI runner
 * says 18 Dec, a Mac says Dec 18". Measured on Node 22 / ICU 77.1: `en-PH`
 * resolves to real `en-PH` data and yields "Dec 18", identical to `en-US` and
 * `en` across thousands of comparisons. The split was never reproduced. So the
 * assertions below are on the STRING, which is checkable, not on a claim about
 * some other machine, which is not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { dayMonth, monthDay } from '@/lib/format-date';

const WEB = join(import.meta.dirname, '..');
const OVERVIEW = 'app/vendor-dashboard/_components/overview-sections.tsx';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the scan read a real file (an empty read is a green lie)', () => {
  assert.ok(read(OVERVIEW).length > 5000, `${OVERVIEW} came back empty — the scan reads nothing`);
});

test('🔑 1 · monthDay prints exactly what the supplier saw before the swap', () => {
  // These are the strings `toLocaleDateString('en-PH', {month:'short',
  // day:'numeric'})` produced on Node 22 / ICU 77.1 — measured across all 1,349
  // dates in 2024–2027 plus month ends and the leap day, zero differences.
  assert.equal(monthDay('2026-12-18'), 'Dec 18');
  assert.equal(monthDay('2026-07-05'), 'Jul 5', 'a single-digit day must not gain a zero');
  assert.equal(monthDay('2024-02-29'), 'Feb 29', 'the leap day');
  assert.equal(monthDay('2026-01-01'), 'Jan 1');
  assert.equal(monthDay('2026-12-31'), 'Dec 31');
  assert.equal(monthDay(null), null);
  assert.equal(monthDay(undefined), null);
  assert.equal(monthDay(''), null);
  assert.equal(monthDay('not-a-date'), null, 'a bad value yields null, never "NaN undefined"');
});

test('🔑 2 · dayMonth is the OTHER order, and the two never converge', () => {
  assert.equal(dayMonth('2026-12-18'), '18 Dec');
  assert.equal(dayMonth('2026-07-05'), '5 Jul');
  assert.equal(dayMonth('not-a-date'), null);
  // ⚠ THE POINT OF HAVING BOTH NAMES. If these two ever agree, one of them has
  // silently become the other and every caller that chose deliberately is wrong.
  for (const iso of ['2026-12-18', '2026-07-05', '2024-02-29', '2026-01-01']) {
    assert.notEqual(monthDay(iso), dayMonth(iso), `both orders collapsed on ${iso}`);
  }
});

test('🔑 3 · neither formatter asks the runtime what a date looks like', () => {
  const src = read('lib/format-date.ts');
  /* ⚠ EACH FUNCTION'S OWN BODY, ENDING AT ITS CLOSING BRACE. Slicing "from
     dayMonth to the end of the file" swept in `formatLongTimestamp`, which uses
     `toLocaleDateString` correctly and on purpose — the guard went red at its
     own neighbour and said nothing true about the two it guards. */
  for (const fn of ['dayMonth', 'monthDay']) {
    const open = src.indexOf(`export function ${fn}(`);
    assert.ok(open > 0, `${fn} is gone from lib/format-date.ts`);
    const close = src.indexOf('\n}', open);
    assert.ok(close > open, `${fn} has no closing brace — this window faces nothing`);
    const body = src.slice(open, close);
    assert.ok(body.length > 80, `${fn}'s body came back too short to be real`);
    for (const runtime of ['toLocaleDateString', 'toLocaleString', 'Intl.DateTimeFormat']) {
      assert.ok(
        !body.includes(runtime),
        `${fn} reached for ${runtime} — that hands the word order back to CLDR`,
      );
    }
  }
});

test('🔑 4 · the supplier overview no longer formats a date with en-PH', () => {
  const src = read(OVERVIEW);
  // `en-PH` was the ONLY locale this app formatted a date with; every sibling
  // page pins en-US or en-GB or builds the string by hand.
  assert.ok(!src.includes('en-PH'), 'the supplier overview reintroduced en-PH');
  // And it must not grow its own short-date rule back.
  assert.ok(
    !/function shortDate\b/.test(src),
    'the local shortDate came back — import monthDay from lib/format-date instead',
  );
  assert.ok(src.includes('monthDay('), 'the overview stopped using the shared formatter');
});

test('🔑 5 · every timestamp on that page is stamped in Manila, not the server', () => {
  const src = read(OVERVIEW);
  /* 🔴 THE BUG THIS PINS. `new Date(ts).toLocaleDateString(…)` with no timeZone
     uses the RUNTIME's zone. Vercel runs UTC; Manila is UTC+8. A lock that
     lapsed at 07:00 Manila is 23:00 UTC the previous day, so the card named the
     wrong day — a whole day wrong, not a word order. Every DateTimeFormat on
     this page that renders a day must name the zone. */
  const formats = src.match(/new Intl\.DateTimeFormat\([^)]*\{[^}]*\}/gs) ?? [];
  assert.ok(formats.length >= 2, `expected the page's DateTimeFormats, found ${formats.length}`);
  for (const f of formats) {
    if (/day:|weekday:|month:/.test(f)) {
      assert.ok(
        /timeZone:\s*'Asia\/Manila'/.test(f),
        `a DateTimeFormat naming a day has no Asia/Manila zone — it will render the server's day:\n${f}`,
      );
    }
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { posterDate, posterWords, sashLabel } from './celebration-poster-words';
import { deriveMonogram } from './monogram';

/*
  THE CASES ARE PRODUCTION ROWS, READ 2026-09-23 — not fixtures invented to
  suit the module. A fixture that invents both sides agrees with itself.

    display_name                           event_date   precision
    Song Desk Test Night (SONGDESK TEST)   2026-08-01   year      ← the trap
    Movie Night                            2026-08-20   day
    Maria & Jose                           2026-12-12   day
    Indalecio & Claire                     2026-12-18   day
    Kessa Guia & Juda                      NULL         year
    Papic Pool Test — Simple Event         2026-09-19   day
*/

test('🪤 a full date under YEAR precision prints no weekday and no day', () => {
  /*
    THE ONE THAT IS LIVE. `2026-08-01` is a real, complete-looking date; the
    precision says only the year is known. Formatting the column alone would
    announce a Saturday nobody ever chose.
  */
  const d = posterDate('2026-08-01', 'year');
  console.log(`  Song Desk Test Night → weekday ${JSON.stringify(d.weekday)} · date ${JSON.stringify(d.date)}`);
  assert.equal(d.weekday, null, 'a weekday was printed for a year-precision date');
  assert.equal(d.date, '2026');
  assert.ok(!d.date.includes('August'), 'the month leaked out of a year-precision date');

  // …and the SAME iso at day precision does print both. If this half did not
  // pass, the test above would be satisfied by a module that prints nothing.
  const day = posterDate('2026-08-01', 'day');
  assert.equal(day.weekday, 'Saturday');
  assert.equal(day.date, '1 August 2026');
});

test('month precision names the month and no day', () => {
  const d = posterDate('2026-08-20', 'month');
  console.log(`  month precision → ${JSON.stringify(d.date)}`);
  assert.equal(d.weekday, null);
  assert.equal(d.date, 'August 2026');
  assert.ok(!/\b20\b/.test(d.date), 'the day of the month leaked');
});

test('an undated celebration prints no date block at all', () => {
  for (const iso of [null, undefined, '', '   ']) {
    const d = posterDate(iso, 'day');
    assert.equal(d.weekday, null, `weekday for ${JSON.stringify(iso)}`);
    assert.equal(d.date, null, `date for ${JSON.stringify(iso)}`);
  }
  // A null precision is a full day — the column's own default.
  assert.equal(posterDate('2026-12-12', null).weekday, 'Saturday');
});

test('the date is set day-month-year, the way a poster is printed', () => {
  const d = posterDate('2026-12-12', 'day');
  console.log(`  Maria & Jose → ${d.weekday} · ${d.date}`);
  assert.equal(d.date, '12 December 2026');
  assert.equal(d.weekday, 'Saturday');
});

test('a timestamp does not shift the day the couple picked', () => {
  // The DATE column can arrive as a full timestamp; slicing to the calendar
  // day is what stops a reader in another timezone seeing the day before.
  assert.equal(posterDate('2026-12-12T00:00:00Z', 'day').date, '12 December 2026');
});

/* ───────────────────────────── names ───────────────────────────── */

test('two names become a pair with a derived monogram', () => {
  const a = posterWords('Indalecio & Claire');
  console.log(`  Indalecio & Claire → ${JSON.stringify(a)}`);
  assert.equal(a.kind, 'pair');
  assert.equal(a.kind === 'pair' && a.right, 'Claire');
  assert.deepEqual(a.kind === 'pair' && a.monogram, { kind: 'initials', left: 'I', right: 'C' });

  // A multi-word first name keeps its words and still gives one initial.
  const b = posterWords('Kessa Guia & Juda');
  assert.equal(b.kind === 'pair' && b.left, 'Kessa Guia');
  assert.deepEqual(b.kind === 'pair' && b.monogram, { kind: 'initials', left: 'K', right: 'J' });
});

test("⚠ a couple's own monogram outranks the derived one AND is never sliced", () => {
  /*
    The coloured sheets draw the mark as `left <i>&</i> right`. An authored
    monogram must therefore arrive as ONE string with no seam, or `M♥J` would
    be rendered `M & ♥J` — the ampersand inserted into the middle of a symbol
    the couple chose precisely so they would not get an ampersand.
  */
  const w = posterWords('Maria & Jose', '  M♥J  ');
  assert.deepEqual(w.kind === 'pair' && w.monogram, { kind: 'authored', text: 'M♥J' });

  // …and a blank authored value falls back rather than printing nothing.
  const blank = posterWords('Maria & Jose', '   ');
  assert.deepEqual(blank.kind === 'pair' && blank.monogram, { kind: 'initials', left: 'M', right: 'J' });
});

test('⛔ the mark is the shipped one, even where this module would have chosen differently', () => {
  /*
    🔴 THIS ASSERTION USED TO SAY `null`, AND THAT WAS THE BUG. An earlier cut
    hand-rolled the initials with a letters-only regex, so "Ana & 123" produced
    no mark at all. `deriveMonogram` — already drawing the dashboard chip, the
    landing hero and the QR-centre overlay — answers "A & 1", and that is what
    the couple sees on every OTHER surface in the product.

    🔑 A SECOND DERIVATION OF ONE FACT IS THE DEFECT, not the rule it disagrees
    about. If "A & 1" is the wrong mark it is wrong in ONE place and
    `lib/monogram.ts` is where it gets fixed; a poster quietly showing
    something different is how two mechanisms start disagreeing about a
    couple's own logo.
  */
  const w = posterWords('Ana & 123');
  console.log(`  Ana & 123 → monogram ${JSON.stringify(w.kind === 'pair' && w.monogram)}`);
  assert.deepEqual(w.kind === 'pair' && w.monogram, { kind: 'initials', left: 'A', right: '1' });

  // The parenthetical the shipped derivation strips and mine kept:
  assert.equal(deriveMonogram('Song Desk Test Night (SONGDESK TEST)'), 'S');

  // A one-name celebration still has no PAIR to draw — the null branch lives.
  const solo = posterWords('Movie & ');
  assert.equal(solo.kind, 'title', 'nothing on one side is not a pair');
});

test('a pair carries a size step too — the letterpress sets it in the title slot', () => {
  /*
    Six prod weddings have no accent at all, so the LETTERPRESS sheet is the
    commonest one, and it sets the names where a playbill sets its title.
    "Winnie Abiola" and "Ben" cannot be set at the same size.
  */
  const short = posterWords('Rosa & Ben');
  const long = posterWords('Winnie Abiola & Bernie');
  console.log(`  Rosa & Ben → ${short.step} · Winnie Abiola & Bernie → ${long.step}`);
  assert.notEqual(short.step, long.step, 'a long name is set as large as a short one');
});

test('a title stacks like a playbill and shrinks as it lengthens', () => {
  const movie = posterWords('Movie Night');
  console.log(`  Movie Night → ${JSON.stringify(movie)}`);
  assert.deepEqual(movie, { kind: 'title', lines: ['Movie', 'Night'], step: 'xl' });

  const long = posterWords('Song Desk Test Night (SONGDESK TEST)');
  console.log(`  Song Desk… → ${JSON.stringify(long)}`);
  assert.equal(long.kind, 'title');
  assert.ok(long.kind === 'title' && long.lines.length <= 3, 'a title grew past three lines');
  assert.ok(long.kind === 'title' && long.lines.join(' ') === 'Song Desk Test Night (SONGDESK TEST)', 'a word was dropped');
  /*
    🔑 THE ASSERTION THAT EARNS THE `step`. A six-word title set at the same
    size as "Movie Night" overflows the sheet. If `step` did not move, a poster
    would render as a broken one.
  */
  assert.notEqual(long.kind === 'title' && long.step, movie.kind === 'title' && movie.step);

  const em = posterWords('Papic Pool Test — Simple Event');
  assert.ok(em.kind === 'title' && em.lines.join(' ') === 'Papic Pool Test — Simple Event');
});

test('a nameless celebration still prints something', () => {
  for (const n of [null, undefined, '', '   ']) {
    const w = posterWords(n);
    assert.equal(w.kind, 'title');
    assert.ok(w.kind === 'title' && w.lines.length > 0, `no lines for ${JSON.stringify(n)}`);
  }
});

test('a lone ampersand is not a pair', () => {
  // "& Co" and "Sun &" have nothing on one side — a pair needs two people.
  assert.equal(posterWords('& Co').kind, 'title');
  assert.equal(posterWords('Sun &').kind, 'title');
  // …and two ampersands is not two people either.
  assert.equal(posterWords('Rock & Roll & Blues').kind, 'title');
});

/* ───────────────────────────── the sash ───────────────────────────── */

test('⛔ an undated celebration is never crowned "Up next"', () => {
  /*
    Four prod weddings have `event_date = NULL`, and the split files them under
    coming-up, sorted LAST. On a profile holding only those, index 0 is a
    dateless wedding — and a sash keyed on position alone would announce it as
    next. The label would have been manufactured by the sort, not read.
  */
  assert.equal(sashLabel('coming-up', 0, false), null);
  assert.equal(sashLabel('coming-up', 3, false), null);
  // the dated ones still get theirs — otherwise the rule above is vacuous
  assert.equal(sashLabel('coming-up', 0, true), 'Up next');
  assert.equal(sashLabel('coming-up', 1, true), 'Coming soon');
  assert.equal(sashLabel('coming-up', 9, true), 'Coming soon');
});

test('a memory carries no status', () => {
  for (const i of [0, 1, 5]) {
    assert.equal(sashLabel('past', i, true), null, `past card ${i} carried a sash`);
  }
});

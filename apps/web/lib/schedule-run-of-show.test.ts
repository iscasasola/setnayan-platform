/**
 * Unit suite for the non-wedding Run-of-Show seed. Guards: weddings are never
 * seeded here, core beats always show, signal-gated beats only appear when the
 * brief backs them, notes are enriched from captured signals, and timing is
 * monotonic + anchored to the event date.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRunOfShowSeed, type RunOfShowSeedBlock } from './schedule-run-of-show';

const DATE = '2026-11-14';
const labels = (b: RunOfShowSeedBlock[]) => b.map((x) => x.label);

test('weddings are never seeded here (they own a separate spine)', () => {
  assert.deepEqual(buildRunOfShowSeed('wedding', { cotillion: [{ name: 'x' }] }, DATE), []);
  assert.deepEqual(buildRunOfShowSeed(null, {}, DATE), []);
  assert.deepEqual(buildRunOfShowSeed(undefined, {}, DATE), []);
});

test('a non-wedding type with no authored program falls back to the generic spine', () => {
  // `celebration` is a real, enabled type that has no authored program — the
  // generic celebration spine is genuinely right for it. (This test used to use
  // `tournament`, which now has its OWN program; see the tournament tests below.)
  const b = buildRunOfShowSeed('celebration', {}, DATE);
  assert.ok(b.length >= 4);
  assert.ok(labels(b).includes('Guest arrival'));
  assert.ok(labels(b).includes('Socials'));
});

test('tournament seeds a competition day, NOT a dinner party', () => {
  const b = buildRunOfShowSeed('tournament', {}, DATE);
  const l = labels(b);
  // The defect this fixes: a tournament was inheriting the generic party spine.
  assert.ok(!l.includes('Guest arrival'), 'tournament must not seed the party spine');
  assert.ok(!l.includes('Socials'), 'tournament must not seed the party spine');
  assert.ok(!l.includes('Main highlights'), 'tournament must not seed the party spine');
  // Registration → opening → matches → finals → awarding.
  assert.ok(l.includes('Team check-in & registration'));
  assert.ok(l.includes('Opening ceremony'));
  assert.ok(l.includes('Elimination round'));
  assert.ok(l.includes('Quarterfinals & semifinals'));
  assert.ok(l.includes('Championship match'));
  assert.ok(l.includes('Awarding ceremony'));
  // Core beats survive an empty brief — a host who skipped the specialty form
  // still gets the whole competition day.
  assert.ok(b.length >= 9);
});

test('tournament: the parade is gated on a captured liga signal', () => {
  const bare = buildRunOfShowSeed('tournament', {}, DATE);
  assert.ok(!labels(bare).includes('Parade of teams & muses'));

  const parade = buildRunOfShowSeed('tournament', { opening_parade: true }, DATE);
  assert.ok(labels(parade).includes('Parade of teams & muses'));

  // A named team muse implies the community layer even without the boolean.
  const muses = buildRunOfShowSeed(
    'tournament',
    { teams: [{ team_name: 'Ginebra', team_muse: 'Ana' }, { team_name: 'Alaska' }] },
    DATE,
  );
  const paradeBeat = muses.find((x) => x.label === 'Parade of teams & muses')!;
  assert.match(paradeBeat.notes ?? '', /1 team muse to introduce/);
});

test('tournament: check-in note counts real teams and names real divisions', () => {
  const b = buildRunOfShowSeed(
    'tournament',
    {
      teams: [{ team_name: 'A' }, { team_name: 'B' }, { team_name: 'C' }],
      divisions: [{ division: "Men's" }, { division: 'Mixed' }],
    },
    DATE,
  );
  const checkin = b.find((x) => x.label === 'Team check-in & registration')!;
  assert.match(checkin.notes ?? '', /3 teams registered/);
  assert.match(checkin.notes ?? '', /divisions: Men's, Mixed/);
});

test('tournament: discipline + format enrich the briefing; unknown tokens degrade quietly', () => {
  const known = buildRunOfShowSeed(
    'tournament',
    { sport_discipline: 'basketball', tournament_format: 'double_elimination' },
    DATE,
  );
  const brief = known.find((x) => x.label === 'Rules briefing & bracket draw')!;
  assert.match(brief.notes ?? '', /Basketball · Double elimination/);

  // An unmapped token must not leak a raw enum into host-facing copy.
  const unknown = buildRunOfShowSeed('tournament', { sport_discipline: 'other', tournament_format: 'zzz' }, DATE);
  const brief2 = unknown.find((x) => x.label === 'Rules briefing & bracket draw')!;
  assert.doesNotMatch(brief2.notes ?? '', /other|zzz|_/);
});

test('tournament: a liga season is told it spans several game days', () => {
  const liga = buildRunOfShowSeed('tournament', { tournament_format: 'liga_season' }, DATE);
  const elim = liga.find((x) => x.label === 'Elimination round')!;
  assert.match(elim.notes ?? '', /several game days/);

  const oneDay = buildRunOfShowSeed('tournament', { tournament_format: 'round_robin' }, DATE);
  const elim2 = oneDay.find((x) => x.label === 'Elimination round')!;
  assert.doesNotMatch(elim2.notes ?? '', /several game days/);
});

test('tournament: awarding names the captured awards, humanized', () => {
  const b = buildRunOfShowSeed('tournament', { awards: ['mvp', 'mythical_five', 'muse_of_the_league'] }, DATE);
  const awarding = b.find((x) => x.label === 'Awarding ceremony')!;
  assert.match(awarding.notes ?? '', /MVP, Mythical Five, Muse of the League/);

  const bare = buildRunOfShowSeed('tournament', {}, DATE);
  const bareAward = bare.find((x) => x.label === 'Awarding ceremony')!;
  assert.ok((bareAward.notes ?? '').length > 0, 'awarding still carries a useful note with no signals');
  assert.doesNotMatch(bareAward.notes ?? '', /Awards to call/);
});

test('tournament: setup is a private crew beat; the rest of the day is public', () => {
  const b = buildRunOfShowSeed('tournament', { opening_parade: true }, DATE);
  const setup = b.find((x) => x.label === 'Call time: venue & equipment setup')!;
  assert.equal(setup.is_public, false);
  for (const blk of b) {
    if (blk.label !== 'Call time: venue & equipment setup') {
      assert.equal(blk.is_public, true, `${blk.label} should be public`);
    }
  }
});

const p2 = (n: number) => String(n).padStart(2, '0');
/** The LOCAL calendar date of an ISO instant (anchorIso sets LOCAL clock hours,
 *  so the UTC string's prefix is not the anchoring contract). */
const localDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
/** The LOCAL wall-clock time of an ISO instant, "HH:MM". */
const localTime = (iso: string): string => {
  const d = new Date(iso);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

/**
 * NOTE — this asserts that every block lands on ONE local day at its authored
 * wall-clock time, NOT that that day equals `DATE`. That is deliberate.
 *
 * `anchorIso` UTC-parses the date string (`new Date('2026-11-14')` → midnight
 * UTC) and then sets LOCAL hours on it, so in any timezone WEST of UTC the whole
 * seed lands on the day BEFORE the event. That is a PRE-EXISTING defect shared
 * by every authored program (and mirrored in schedule.ts's wedding seed) — the
 * sibling test 'blocks are anchored to the event date and time-ordered' already
 * fails under `TZ=America/New_York` on unmodified origin/main. Fixing it changes
 * every event type's seed, so it is out of scope for the tournament PR; pinning
 * the assertion to the event date here would just add a second timezone-fragile
 * test. The invariants below hold in every timezone.
 */
test('tournament: blocks share one local day, keep their clock times, and never overlap', () => {
  const b = buildRunOfShowSeed('tournament', { opening_parade: true }, DATE);
  const day = localDate(b[0]!.start_at);
  for (const blk of b) {
    assert.equal(localDate(blk.start_at), day, `${blk.label} drifted to another day`);
    assert.ok(new Date(blk.end_at) > new Date(blk.start_at), `${blk.label}: end before start`);
  }
  // The authored competition day, start to finish.
  assert.equal(localTime(b[0]!.start_at), '06:30');
  assert.equal(localTime(b[b.length - 1]!.start_at), '17:45');
  for (let i = 1; i < b.length; i++) {
    const cur = b[i]!;
    const prev = b[i - 1]!;
    assert.ok(cur.sort_order > prev.sort_order, 'sort_order not increasing');
    // A competition day is a linear agenda — one beat ends before the next opens.
    assert.ok(
      new Date(cur.start_at) >= new Date(prev.end_at),
      `${prev.label} overlaps ${cur.label}`,
    );
  }
});

test('tournament: no input mutation, deterministic', () => {
  const sig = { teams: [{ team_name: 'A', team_muse: 'M' }], awards: ['mvp'] };
  const a = buildRunOfShowSeed('tournament', sig, DATE);
  const b = buildRunOfShowSeed('tournament', sig, DATE);
  assert.deepEqual(a, b);
  assert.deepEqual(sig, { teams: [{ team_name: 'A', team_muse: 'M' }], awards: ['mvp'] });
});

test('debut: core 18s always show; cotillion appears only when captured', () => {
  const bare = buildRunOfShowSeed('debut', {}, DATE);
  assert.ok(labels(bare).includes('18 Roses'));
  assert.ok(labels(bare).includes('18 Candles'));
  assert.ok(labels(bare).includes('18 Treasures'));
  assert.ok(!labels(bare).includes('Cotillion de honor')); // no signal → no beat

  const withCourt = buildRunOfShowSeed('debut', { cotillion: [{ name: 'A' }, { name: 'B' }] }, DATE);
  assert.ok(labels(withCourt).includes('Cotillion de honor'));
  const cotillion = withCourt.find((x) => x.label === 'Cotillion de honor')!;
  assert.match(cotillion.notes ?? '', /Court of 2/);
});

test('debut: 18 Candles note names the captured guests', () => {
  const b = buildRunOfShowSeed('debut', { eighteen_candles: [{ name: 'Tita' }, { name: 'Lola' }] }, DATE);
  const candles = b.find((x) => x.label === '18 Candles')!;
  assert.match(candles.notes ?? '', /Tita, Lola/);
});

test('anniversary: renewal + tribute beats are signal-gated', () => {
  const bare = buildRunOfShowSeed('anniversary', {}, DATE);
  assert.ok(!labels(bare).includes('Renewal of vows / Thanksgiving'));

  const rich = buildRunOfShowSeed('anniversary', { renewal_of_vows: true, tribute_program: 'yes' }, DATE);
  assert.ok(labels(rich).includes('Renewal of vows / Thanksgiving'));
  assert.ok(rich.some((x) => x.label.startsWith('Tribute program')));
});

test('gender reveal: method enriches the reveal note; guessing game gated', () => {
  const b = buildRunOfShowSeed('gender_reveal', { reveal_method: 'smoke cannon', guessing_game: true }, DATE);
  assert.ok(labels(b).includes('Guessing game & team assignments'));
  const reveal = b.find((x) => x.label === 'The reveal')!;
  assert.match(reveal.notes ?? '', /smoke cannon/);

  const noGame = buildRunOfShowSeed('gender_reveal', { reveal_method: 'balloon box' }, DATE);
  assert.ok(!labels(noGame).includes('Guessing game & team assignments'));
});

test('christening godparent count enriches the message beat', () => {
  const b = buildRunOfShowSeed(
    'christening',
    { godparents_principal: [{ name: 'a' }], godparents_secondary: [{ name: 'b' }, { name: 'c' }] },
    DATE,
  );
  const msg = b.find((x) => x.label.startsWith('Message from parents'))!;
  assert.match(msg.notes ?? '', /3 godparents/);
});

test('blocks are anchored to the event date and time-ordered', () => {
  const b = buildRunOfShowSeed('debut', { cotillion: [{ name: 'x' }] }, DATE);
  for (const blk of b) {
    assert.ok(blk.start_at.startsWith('2026-11-14'), `${blk.label} not on event date: ${blk.start_at}`);
    assert.ok(new Date(blk.end_at) > new Date(blk.start_at), `${blk.label}: end before start`);
  }
  // sort_order strictly increases; start times are non-decreasing.
  for (let i = 1; i < b.length; i++) {
    const cur = b[i]!;
    const prev = b[i - 1]!;
    assert.ok(cur.sort_order > prev.sort_order, 'sort_order not increasing');
    assert.ok(new Date(cur.start_at) >= new Date(prev.start_at), 'start times out of order');
  }
});

test('every block is well-formed and pure (no input mutation)', () => {
  const sig = { cotillion: [{ name: 'x' }], eighteen_candles: [{ name: 'y' }] };
  const a = buildRunOfShowSeed('debut', sig, DATE);
  const b = buildRunOfShowSeed('debut', sig, DATE);
  assert.deepEqual(a, b); // deterministic
  assert.deepEqual(sig, { cotillion: [{ name: 'x' }], eighteen_candles: [{ name: 'y' }] }); // not mutated
  for (const blk of a) {
    assert.ok(blk.label && blk.block_type, 'missing label/type');
    assert.equal(typeof blk.is_public, 'boolean');
    assert.ok(blk.notes === null || typeof blk.notes === 'string');
  }
});

test('no-date seed still produces valid ISO placeholders', () => {
  const b = buildRunOfShowSeed('birthday', {}, null);
  assert.ok(b.length > 0);
  for (const blk of b) assert.ok(!Number.isNaN(new Date(blk.start_at).getTime()));
});

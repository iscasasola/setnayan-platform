/**
 * THE INDEX CANNOT OUTRUN THE PAYLOAD.
 *
 * ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────
 * The design review found the photographs correctly withheld from a pre-publish
 * stranger and every SHAPE of them still public: the index, the dial's bar
 * heights, the minute sheet, the cover's counts, the Relive player and the
 * closing words. S3 closed five of those. S11 builds the sixth — the eleven
 * index tabs and a search over them — which is the one that could most easily
 * put them all back: a list of 492 captures describes somebody's wedding
 * exactly as the captures do.
 *
 * ── WHAT IT ASSERTS, AND WHY IT IS THE PAYLOAD AND NOT THE CSS ──────────────
 * `01` §2's implementation rule is that exclusion is server-side. A test that
 * looked for `opacity` or `display:none` would pass over a page that had
 * serialised every withheld quote into the HTML and greyed it out. So this runs
 * the REAL pipeline — `redactStoryLayers` then `buildStoryIndex` — and counts
 * what comes out the far end.
 *
 * 🔑 AND IT MEASURES, RATHER THAN CHECKING THAT A CALL IS PRESENT. The same
 * fixture is put through the pipeline twice, once WITHOUT the redaction step.
 * The unredacted run must produce guest-layer entries and the redacted run must
 * produce none — so a change that quietly turned the redaction into a no-op
 * fails here, and a test that would pass whatever the code did is not possible:
 * the before-count is asserted to be non-zero.
 *
 * ⚠ WHAT IT DOES NOT PROVE: that the SEARCH is wired to the DOM rather than to
 * a payload. That is a separate arm below, and it is a source scan, because
 * there is no DOM in `tsx --test`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripComments } from './strip-comments';
import { allIndexEntries, buildStoryIndex, type StoryIndexInput } from './story-index';
import {
  guestLayerAdmits,
  redactStoryLayers,
  type LayeredStoryPayload,
} from './the-guests-layer-is-theirs-until-you-publish';
import { SMALL_COUNTS_ARE_A_VERDICT } from './story-room';
import { STRANGER, type StoryViewer } from './who-can-see-your-story';

const WEB_ROOT = dirname(fileURLToPath(import.meta.url));

const HOST: StoryViewer = { isHost: true, belongsToEvent: true };

const ANCHORS = [
  { id: 'minute-1', atMs: 1_000_000, stamp: '7:12', suffix: 'PM', label: 'The First Dance', hour: 19 },
  { id: 'minute-2', atMs: 2_000_000, stamp: '9:47', suffix: 'PM', label: 'The Money Dance', hour: 21 },
];

/**
 * A payload with something real in every guest-layer field.
 *
 * ⚠ EVERY FIELD, ON PURPOSE. A fixture that filled three of the six would let a
 * redaction that forgot the other three pass — which is the exact shape of the
 * bug: `galleryCaptures` was added by this very change and had to be named in
 * `LayeredStoryPayload` or it would have carried the same photographs past a
 * redaction that only knew about `galleryPhotos`.
 */
function fullPayload(): LayeredStoryPayload & {
  galleryCaptures: Array<{ url: string; atMs: number | null }>;
} {
  return {
    audience: 'event',
    kwentoQuotes: [{ body: 'The whole garden went quiet.', atIso: null }],
    challengeAnswers: [{ prompt: 'Show us your table.' }],
    guestColumns: [{ title: 'The quiet minute', body: 'Everyone remembers the march.' }],
    galleryPhotos: ['https://example.test/a.jpg'],
    essayPhotos: ['https://example.test/a.jpg'],
    galleryCaptures: [
      { url: 'https://example.test/a.jpg', atMs: 1_000_000 },
      { url: 'https://example.test/b.jpg', atMs: 2_000_000 },
    ],
    dayChapters: [{ atIso: '2026-02-14T11:12:00.000Z' }],
    photoWallPhotos: ['https://example.test/w.jpg'],
    photoWallActive: true,
    metrics: { photos: 2, clips: 0, chapters: 1 },
    specialMessage: 'Set na ’yan.',
    song: { url: 'https://example.test/song.mp3', label: 'Their kundiman' },
  };
}

/** The index as the page builds it, from whatever payload it is handed. */
function indexFrom(
  payload: ReturnType<typeof fullPayload>,
  guestOpen: boolean,
): ReturnType<typeof buildStoryIndex> {
  const input: StoryIndexInput = {
    guestOpen,
    anchors: ANCHORS,
    windowMs: 15 * 60_000,
    captures: ((payload.galleryCaptures ?? []) as Array<{ url: string; atMs: number | null }>).map(
      (c) => ({ url: c.url, atMs: c.atMs, caption: null }),
    ),
    voices: (payload.kwentoQuotes as Array<{ body: string }>).map((q) => ({
      body: q.body,
      atMs: 1_000_000,
      author: null,
      role: null,
    })),
    asked: (payload.challengeAnswers as Array<{ prompt: string }>).map((a) => ({
      prompt: a.prompt,
      atMs: 2_000_000,
      byline: null,
    })),
    letters: ((payload.guestColumns ?? []) as Array<{ title: string; body: string }>).map((l) => ({
      title: l.title,
      body: l.body,
      author: null,
      role: null,
    })),
    team: [{ name: 'Goldenhour', category: 'Photography', isFirstPick: true }],
    films: [],
    wall: (payload.photoWallPhotos as string[]).map((url) => ({ url })),
    wallActive: payload.photoWallActive,
    room: { tables: [{ id: 't1', label: '7' }], seatsAssigned: true },
    palette: [],
    madeWith: [],
    numbers: [],
    captureCount: guestOpen ? (payload.metrics.photos ?? null) : null,
    words: { host: 'couple', occasion: 'wedding' },
  };
  return buildStoryIndex(input);
}

test('the index · a pre-publish stranger gets NOTHING of the guests’ layer', () => {
  const raw = fullPayload();

  // ── WITHOUT the redaction. This is the measurement that makes the assertion
  // below mean something: if this were zero, the test would pass for a reason
  // that has nothing to do with the gate.
  const before = allIndexEntries(indexFrom(raw, true)).filter((e) => e.layer === 'guest');

  // ── WITH it, exactly as `editorial-content.tsx` runs it.
  const redacted = redactStoryLayers(raw, STRANGER) as ReturnType<typeof fullPayload>;
  const guestOpen = guestLayerAdmits(raw.audience!, STRANGER);
  const after = allIndexEntries(indexFrom(redacted, guestOpen)).filter((e) => e.layer === 'guest');

  console.log(`guest-layer index entries — unredacted: ${before.length} · redacted: ${after.length}`);

  assert.ok(
    before.length > 0,
    'the fixture must produce guest-layer entries without the redaction, or this test proves nothing',
  );
  assert.equal(
    after.length,
    0,
    `a pre-publish stranger's index carried ${after.length} guest-layer entries: ` +
      after.map((e) => `${e.stamp} ${e.label}`).join(' · '),
  );
});

test('the index · a withheld count is an ABSENCE, never a zero', () => {
  /*
    🪤 THE FIRST VERSION OF THIS TEST WAS DECORATION, AND THE SABOTAGE RUN FOUND
    IT. It fed the REDACTED payload with `guestOpen: false` — but a guest tab
    with no entries and a withheld layer is dropped from the strip entirely, so
    the loop ran over nothing and passed. Breaking `countForLayer` outright left
    it 5/5 green. A test whose body can execute zero assertions is not a test.

    So the fixture here is the state that actually exercises the chip: entries
    PRESENT and the layer WITHHELD — the defence in depth behind the redaction.
    Even if the arrays somehow reached the builder, a reader the layer is
    withheld from must be shown no number. And the loop asserts it ran.
  */
  const tabs = indexFrom(fullPayload(), false);
  const guestTabs = tabs.filter((t) => t.layer === 'guest');

  console.log(`guest-layer tabs examined for a count: ${guestTabs.length}`);
  assert.ok(
    guestTabs.length > 0,
    'no guest-layer tab was examined — this test would pass whatever the gate did',
  );

  for (const t of guestTabs) {
    assert.ok(t.entries.length > 0, `the "${t.title}" fixture carried no entries to gate`);
    assert.notEqual(
      t.count,
      0,
      `the "${t.title}" chip printed 0 to a reader the layer is withheld from — ` +
        '"0 captures" is a claim about the day, and a false one while the photographs sit behind the gate',
    );
    assert.equal(t.count, null, `the "${t.title}" chip carried a number this reader may not have`);
  }
});

test('the index · and it is not simply always empty — the host sees all of it', () => {
  /*
    THE OTHER HALF, AND IT IS THE HALF THAT CATCHES DECORATION. A gate that
    returns nothing to everybody passes the first two tests and has deleted the
    feature. The host reads their own draft at every audience, so their index
    must carry the same entries the unredacted run produced.
  */
  const raw = fullPayload();
  const redacted = redactStoryLayers(raw, HOST) as ReturnType<typeof fullPayload>;
  const guestOpen = guestLayerAdmits(raw.audience!, HOST);
  const entries = allIndexEntries(indexFrom(redacted, guestOpen)).filter((e) => e.layer === 'guest');

  console.log(`guest-layer index entries — host: ${entries.length}`);
  assert.ok(entries.length > 0, 'the host was shown none of their own celebration');
});

test('the index · every guest-layer field the index reads is emptied by the redaction', () => {
  /*
    Named field by field rather than "the object is smaller". The failure this
    catches is a field ADDED later that the index reads and the redaction has
    never heard of — which is how `galleryCaptures` would have leaked the same
    photographs `galleryPhotos` was already withholding.
  */
  const redacted = redactStoryLayers(fullPayload(), STRANGER) as ReturnType<typeof fullPayload>;
  for (const field of [
    'kwentoQuotes',
    'challengeAnswers',
    'guestColumns',
    'galleryPhotos',
    'essayPhotos',
    'galleryCaptures',
    'dayChapters',
    'photoWallPhotos',
  ] as const) {
    const v = redacted[field] as unknown[] | undefined;
    assert.deepEqual(v, [], `\`${field}\` survived the redaction for a pre-publish stranger`);
  }
  assert.equal(redacted.metrics.photos, null, 'the capture count survived the redaction');
  assert.equal(redacted.metrics.clips, null, 'the clip count survived the redaction');
});

test('the index · a small number is never STATED — the story does not grade the day', () => {
  /*
    ⚖ OWNER RULING 2026-09-09, and its REASON is the load-bearing half. He was
    asked as a privacy question whether a table with one or two photographs
    should show its count. He said no, for a different reason:

        "this will subconsciously tell them they did not create enough
         memories for the story"

    🔑 It is therefore not a k-anonymity floor and not a seating rule — it is
    that THE STORY NEVER PASSES JUDGEMENT ON THE DAY IT IS TELLING, and it
    reaches any small number anywhere on this page. A session that reads it as
    privacy will relax it the first time the numbers look safe.

    The fixture is deliberately a QUIET celebration: one voice, one question,
    one letter, two captures — a real day, and every chip on it a verdict.
  */
  const quiet = fullPayload();
  quiet.audience = 'published';
  const tabs = indexFrom(quiet, true);
  const stated = tabs.filter((t) => t.count != null);

  console.log(
    `quiet-day tabs: ${tabs.length} · chips stating a number: ${stated.length} ` +
      `(${stated.map((t) => `${t.title}=${t.count}`).join(', ') || 'none'})`,
  );

  assert.ok(tabs.length > 0, 'no tabs were built — this test would pass whatever the rule did');
  for (const t of tabs) {
    assert.ok(
      t.entries.length < SMALL_COUNTS_ARE_A_VERDICT || t.count != null || t.key === 'captures',
      `the "${t.title}" tab has ${t.entries.length} rows and stated no number — the rule ` +
        'withholds SMALL counts, it does not silence every chip',
    );
    if (t.count == null) continue;
    assert.ok(
      t.count >= SMALL_COUNTS_ARE_A_VERDICT,
      `the "${t.title}" chip stated ${t.count}, under the threshold (${SMALL_COUNTS_ARE_A_VERDICT}) — ` +
        'a small number on a host\'s own story reads as a verdict on their day',
    );
  }

  /*
    AND THE ROWS ARE STILL THERE. The floor plan takes a quiet table out of the
    room; this must NOT take the letter out of the story. Losing the rows to
    avoid printing "1" is the failure in the other direction, and it is the one
    a careless fix produces.
  */
  const letters = tabs.find((t) => t.key === 'letters');
  assert.ok(letters, 'the letters tab vanished — the rule withholds a NUMBER, never the story');
  assert.equal(letters!.count, null);
  assert.ok(letters!.entries.length > 0, 'the letter itself was dropped along with its count');

  /*
    🪤 AND THE OTHER DIRECTION, WHICH IS THE ONE THAT MAKES THIS A TEST. On the
    quiet fixture above, ZERO chips state a number — so every assertion so far
    would also pass if `count` were hardcoded to null and the feature deleted.
    A big day must still get its chips. Measured, not assumed.
  */
  const loud = fullPayload();
  loud.audience = 'published';
  loud.kwentoQuotes = Array.from({ length: 7 }, (_, i) => ({ body: `A wish, number ${i}` }));
  loud.guestColumns = Array.from({ length: 4 }, (_, i) => ({
    title: `Letter ${i}`,
    body: 'Everyone remembers the march.',
  }));
  const loudTabs = indexFrom(loud, true);
  const loudStated = loudTabs.filter((t) => t.count != null);
  console.log(
    `loud-day chips stating a number: ${loudStated.length} ` +
      `(${loudStated.map((t) => `${t.title}=${t.count}`).join(', ') || 'none'})`,
  );
  assert.ok(
    loudStated.length > 0,
    'a celebration with seven voices and four letters stated no number anywhere — ' +
      'the rule has stopped withholding SMALL counts and started withholding all of them',
  );
  assert.equal(loudTabs.find((t) => t.key === 'voices')?.count, 7);
  assert.equal(loudTabs.find((t) => t.key === 'letters')?.count, 4);
});

test('find-in-this-day · reads the DOM, and has no other source to read', () => {
  /*
    A SOURCE SCAN, AND IT SAYS SO. There is no DOM in `tsx --test`, so this
    cannot prove the search behaves; it proves the only thing that actually
    regresses — somebody hands the component a payload prop "so it does not have
    to scrape", and the search quietly gains a source the redaction never saw.

    Comments are stripped first: this file's own prose names every module the
    scan forbids.
  */
  const file = join(WEB_ROOT, '..', 'app', '[slug]', '_components', 'story', 'find-in-this-day.tsx');
  const src = stripComments(readFileSync(file, 'utf8'));

  for (const forbidden of [
    "from '../editorial/data'",
    "from './spine-data'",
    "from '../../_lib/your-own-day.server'",
    'fetch(',
  ]) {
    assert.ok(
      !src.includes(forbidden),
      `find-in-this-day.tsx reached for \`${forbidden}\` — its ONLY source may be the document`,
    );
  }

  const calls = [...src.matchAll(/collectFindables\(([^)]*)\)/g)].map((m) => m[1]!.trim());
  const invocations = calls.filter((arg) => arg !== 'root: ParentNode');
  assert.ok(invocations.length > 0, 'the search never actually scrapes the page');
  for (const arg of invocations) {
    assert.equal(
      arg,
      'document',
      `collectFindables was called with \`${arg}\` — scraping a subtree, or anything but the live ` +
        'document, is a second index nobody redacted',
    );
  }
});

// ── ZERO SUPPLIERS: A HANGOUT SHOWS NO TEAM TAB AND NO #1-MATCH TILE ────────
//
// `08` step 3.3 · `05_Occasions_Registers_MultiDay.md` §5: "A hangout, a date,
// a family wake, or any event whose suppliers were hired off-platform has no
// `event_vendors` rows… hide the team tab, the #1-match tile and the tier
// legend when the set is empty."
//
// 🔑 EXTENDING S11's ONE EMPTINESS RULE, NOT WRITING A SECOND BESIDE IT. The
// host-layer tabs already omit themselves at zero inside `buildStoryIndex`
// (`if (teamEntries.length > 0)`), and the guest-layer tabs go through
// `pushGuestTab`. Nothing new gates emptiness here; this PINS the behaviour so
// the claim is measured rather than believed, because "it is already handled"
// is exactly the kind of thing that stops being true quietly.

/** The smallest input that isolates the team axis. */
function indexWithTeam(
  team: ReadonlyArray<{ name: string; category: string | null; isFirstPick: boolean }>,
) {
  return buildStoryIndex({
    guestOpen: true,
    anchors: ANCHORS,
    windowMs: 15 * 60_000,
    captures: [],
    voices: [],
    asked: [],
    letters: [],
    team,
    films: [],
    wall: [],
    wallActive: false,
    room: { tables: [], seatsAssigned: false },
    palette: [],
    madeWith: [],
    numbers: [],
    captureCount: null,
    words: { host: 'host', occasion: 'celebration' },
  });
}

test('a hangout with no bookings has no team tab, no #1-match tile, no tier legend', () => {
  const tabs = indexWithTeam([]);
  assert.equal(
    tabs.find((t) => t.key === 'team'),
    undefined,
    'an event with no suppliers still shows "The team"',
  );
  // The #1-match tile and the tier legend are both carried BY that tab — the
  // tile as an entry note, the legend as the tab's own note — so this asserts
  // over every entry and note the index produced, not just the team tab. A
  // future surface that printed either from somewhere else fails here.
  const everything = JSON.stringify(tabs);
  assert.ok(!everything.includes('#1 match'), 'a #1-match tile reached an event with no bookings');
  assert.ok(
    !everything.includes('Paying never changes'),
    'the tier legend reached an event with no bookings',
  );
});

test('…and a booked event still gets all three — the check can tell them apart', () => {
  // 🪤 WITHOUT THIS, THE TEST ABOVE PASSES ON AN INDEX THAT NEVER BUILDS A TEAM
  // TAB AT ALL. An assertion of absence is only worth what its paired presence
  // is worth: this is the fixture on which "hide when empty" and "never show"
  // disagree, and it is the one that would catch a fix that went too far.
  const tabs = indexWithTeam([{ name: 'Goldenhour', category: 'Photography', isFirstPick: true }]);
  const team = tabs.find((t) => t.key === 'team');
  assert.ok(team, 'a booked event lost its team tab');
  const everything = JSON.stringify(tabs);
  assert.ok(everything.includes('#1 match'), 'the #1-match tile vanished for a booked event');
  assert.ok(everything.includes('Paying never changes'), 'the tier legend vanished');
});

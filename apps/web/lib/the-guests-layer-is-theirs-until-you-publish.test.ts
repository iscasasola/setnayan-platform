/**
 * Guard — the guests' layer is theirs until the host publishes.
 *
 * 🔴 THIS SUITE ASSERTS THE PAYLOAD, AND THAT IS THE WHOLE POINT OF IT.
 * The design review's blocker was not that the photos rendered — they did not.
 * It was that every SHAPE of them still reached a pre-publish stranger: the
 * index, the dial's bar heights, the minute sheet, the cover's counts, the
 * Relive player and the closing words. A test that looks for `data-layer` or a
 * `display:none` rule would have passed on that exact page, because the values
 * were in the served HTML the whole time and only the paint was missing.
 *
 * So the assertions below serialise the redacted payload and search it for the
 * literal secrets. A marker in the markup proves nothing here.
 */
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { stripComments } from './strip-comments';
import { STRANGER, type StoryAudience, type StoryViewer } from './who-can-see-your-story';
import {
  COUNTS_ARE_THE_GUESTS_LAYER,
  STORY_LAYERS,
  countForLayer,
  drawnBins,
  guestLayerAdmits,
  guestLayerAudience,
  redactStoryLayers,
  storyLayerAdmits,
  type LayeredStoryPayload,
} from './the-guests-layer-is-theirs-until-you-publish';

const HOST: StoryViewer = { isHost: true, belongsToEvent: true };
const GUEST: StoryViewer = { isHost: false, belongsToEvent: true };

/**
 * Every guest-made value carries a sentence nothing else in the payload says,
 * so a leak is found by searching the JSON rather than by trusting a field name
 * to still be the field the renderer reads.
 */
const SECRETS = [
  'KWENTO-SECRET-a-wish-only-the-guests-wrote',
  'CHALLENGE-SECRET-an-answer-taken-at-7-12',
  'LETTER-SECRET-the-maid-of-honour-wrote-this',
  'GALLERY-SECRET-a-capture-url',
  'ESSAY-SECRET-a-capture-url',
  'CHAPTER-SECRET-the-minute-sheet',
  'WALL-SECRET-a-photo-wall-tile',
  'CLOSE-SECRET-the-hosts-last-word',
  'SONG-SECRET-their-song-url',
] as const;

function fixture(audience: StoryAudience): LayeredStoryPayload & { displayName: string } {
  return {
    audience,
    displayName: 'Maria & Juan',
    kwentoQuotes: [{ body: SECRETS[0] }],
    challengeAnswers: [{ body: SECRETS[1] }],
    guestColumns: [{ title: 'A letter', body: SECRETS[2] }],
    galleryPhotos: [SECRETS[3]],
    essayPhotos: [SECRETS[4]],
    dayChapters: [{ kicker: '7:12 PM', label: SECRETS[5] }],
    photoWallPhotos: [SECRETS[6]],
    photoWallActive: true,
    metrics: {
      photos: 492,
      clips: 26,
      chapters: 11,
      // The host's own — an RSVP count is the couple's guest list, which their
      // invitation has shown since the day they sent it.
      guests: 196,
      attending: 188,
    },
    specialMessage: SECRETS[7],
    song: { url: SECRETS[8], label: 'Their song' },
  };
}

// ── THE PAYLOAD ─────────────────────────────────────────────────────────────

test('a stranger before publish receives no guest-layer value, at any audience short of published', () => {
  for (const audience of ['draft', 'event'] as const) {
    const wire = JSON.stringify(redactStoryLayers(fixture(audience), STRANGER));
    for (const secret of SECRETS) {
      assert.equal(
        wire.includes(secret),
        false,
        `"${secret}" was served to a stranger on a "${audience}" story. It is in ` +
          'the payload, so no stylesheet can withhold it.',
      );
    }
  }
});

test('a stranger before publish receives no COUNT of the guests\' layer either', () => {
  // Owner gate Q1, defaulted to NO. A count is not a summary of the layer — it
  // is the layer, said in one number.
  assert.equal(COUNTS_ARE_THE_GUESTS_LAYER, true, 'Q1 was flipped without the owner');
  for (const audience of ['draft', 'event'] as const) {
    const out = redactStoryLayers(fixture(audience), STRANGER);
    assert.equal(out.metrics.photos, null, '"492 captures" reached a stranger');
    assert.equal(out.metrics.clips, null, 'the film count reached a stranger');
    assert.equal(out.metrics.chapters, null, 'the written-minute count reached a stranger');
    // ⚠ NOT ZERO. "0 photos" is a claim about the day, and a false one while
    // 492 captures sit behind the gate.
    for (const k of ['photos', 'clips', 'chapters'] as const) {
      assert.notEqual(out.metrics[k], 0, `${k} was withheld as a zero, which says something untrue`);
    }
    assert.equal(out.photoWallActive, false, 'the photo wall announced itself');
    // The host's own numbers are untouched — the invitation has always shown them.
    assert.equal(out.metrics.guests, 196);
    assert.equal(out.metrics.attending, 188);
    assert.equal(out.displayName, 'Maria & Juan', 'the redaction reached past its layers');
  }
});

test('the people of the day read their own layer before anyone publishes', () => {
  for (const viewer of [HOST, GUEST]) {
    const wire = JSON.stringify(redactStoryLayers(fixture('event'), viewer));
    for (const secret of SECRETS.slice(0, 7)) {
      assert.equal(wire.includes(secret), true, `"${secret}" was withheld from one of the day's own people`);
    }
  }
});

test('the host reads every layer of their own draft, and a guest does not', () => {
  const host = JSON.stringify(redactStoryLayers(fixture('draft'), HOST));
  for (const secret of SECRETS) {
    assert.equal(host.includes(secret), true, `the host was locked out of "${secret}" in their own draft`);
  }
  // 'draft' is "only me". The guests' layer opens at the `event` audience, so a
  // guest holding the QR still reads their own captures — but the EDITION's
  // close is the host's alone until they share it.
  const guest = redactStoryLayers(fixture('draft'), GUEST);
  assert.equal(guest.specialMessage, null, 'a guest read the locked close of a private draft');
  assert.equal(guest.song.url, null);
  assert.equal(guest.kwentoQuotes.length, 1, 'a guest lost the layer they helped make');
});

test('publish opens every layer to everyone', () => {
  const wire = JSON.stringify(redactStoryLayers(fixture('published'), STRANGER));
  for (const secret of SECRETS) {
    assert.equal(wire.includes(secret), true, `"${secret}" stayed hidden after publish`);
  }
  assert.equal(redactStoryLayers(fixture('published'), STRANGER).metrics.photos, 492);
});

test('the viewer defaults to a STRANGER — a surface that forgets the argument cannot leak', () => {
  const wire = JSON.stringify(redactStoryLayers(fixture('event')));
  for (const secret of SECRETS) {
    assert.equal(wire.includes(secret), false, `omitting the viewer served "${secret}"`);
  }
});

test('a curated sample carries no audience and is never blanked', () => {
  // It exists to be read. `storyAudienceOf` would fail it closed to 'draft' and
  // empty the showcase — the shipped gate skips it and so must this one.
  const sample = fixture('draft');
  delete (sample as { audience?: StoryAudience }).audience;
  assert.equal(JSON.stringify(redactStoryLayers(sample, STRANGER)).includes(SECRETS[0]), true);
});

test('a null payload stays null rather than becoming an empty story', () => {
  assert.equal(redactStoryLayers(null, STRANGER), null);
});

test('the redaction can only ever REMOVE', () => {
  // The same construction consent-veto.ts uses: no branch adds anything, so a
  // bug here cannot open what the shipped gate closed.
  for (const audience of ['draft', 'event', 'published'] as const) {
    for (const viewer of [STRANGER, GUEST, HOST]) {
      const before = fixture(audience);
      const after = redactStoryLayers(before, viewer);
      for (const k of ['kwentoQuotes', 'challengeAnswers', 'galleryPhotos', 'essayPhotos', 'dayChapters', 'photoWallPhotos'] as const) {
        assert.ok(
          after[k].length <= before[k].length,
          `${k} GREW for ${JSON.stringify(viewer)} at "${audience}" — the redaction added something`,
        );
      }
      assert.equal(before.displayName, 'Maria & Juan', 'the input was mutated in place');
      assert.equal(before.metrics.photos, 492, 'the input was mutated in place');
    }
  }
});

// ── THE GATE ────────────────────────────────────────────────────────────────

test('the guests\' layer is the `event` audience until published', () => {
  assert.equal(guestLayerAudience('draft'), 'event');
  assert.equal(guestLayerAudience('event'), 'event');
  assert.equal(guestLayerAudience('published'), 'published');
});

test('the host layer is not this file\'s to refuse', () => {
  // What keeps a stranger off a private celebration is the event's OWN lock,
  // resolved long before any of this runs. A second opinion here is how two
  // gates start disagreeing.
  for (const a of ['draft', 'event', 'published'] as const) {
    assert.equal(storyLayerAdmits('host', a, STRANGER), true);
  }
  assert.deepEqual([...STORY_LAYERS], ['host', 'guest', 'edition']);
});

test('a withheld count is an absence, never a zero', () => {
  assert.equal(countForLayer(492, false), null);
  assert.equal(countForLayer(0, true), 0, 'a real count of nothing is still a fact');
  assert.equal(countForLayer(null, true), null);
  assert.equal(countForLayer(Number.NaN, true), null);
});

// ── THE DIAL ────────────────────────────────────────────────────────────────

const BINS = [
  { at: 1_000, captures: 41 },
  { at: 2_000, captures: 27 },
  { at: 3_000, captures: 12 },
];

test('a bar that has not happened yet has NO height — for everyone, the host included', () => {
  // Not a privacy rule. A bar's height is data about a minute, and that minute
  // has not occurred; drawing one there is a lie, not a leak.
  const drawn = drawnBins(BINS, { now: 2_000, status: 'published', viewer: HOST });
  assert.equal(drawn.length, 3);
  const [past, edge, future] = drawn;
  assert.equal(future?.future, true);
  assert.equal(future?.height, null, 'a future minute was given a height');
  assert.equal(future?.captures, null, 'a future minute was given a count');
  assert.equal(past?.height, 41, 'a minute that happened lost its height');
  // `now` itself is not the future — a bin AT the needle has happened.
  assert.equal(edge?.future, false);
  assert.equal(edge?.height, 27);
});

test('a stranger before publish gets a flat baseline across the whole dial', () => {
  for (const status of ['draft', 'event'] as const) {
    const drawn = drawnBins(BINS, { now: 9_999, status, viewer: STRANGER });
    for (const b of drawn) {
      assert.equal(b.height, null, `a bar height reached a stranger on a "${status}" story`);
      assert.equal(b.captures, null, `a bar's count reached a stranger on a "${status}" story`);
    }
  }
});

test('the day\'s own people see the day\'s real shape', () => {
  const drawn = drawnBins(BINS, { now: 9_999, status: 'event', viewer: GUEST });
  assert.deepEqual(drawn.map((b) => b.height), [41, 27, 12]);
  assert.equal(guestLayerAdmits('event', GUEST), true);
});

// ── THE SURFACES ────────────────────────────────────────────────────────────

const WEB = process.cwd();
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
/** Comments AND imports stripped — an `import { redactStoryLayers }` at the top
 *  of a file satisfies a naive name match with the call site deleted, which is
 *  what a mutation run caught the sibling suite doing. */
const body = (p: string) =>
  stripComments(read(p)).replace(/^import[\s\S]*?from '[^']+';$/gm, '');

test('the public story redacts the layers before it composes a word', () => {
  const s = body('app/[slug]/_components/editorial/editorial-content.tsx');
  // ⚠ PIN THE WHOLE STATEMENT. A mutation that neutered the call with
  // `redactStoryLayers(data, HOSTISH)` leaves the name in place.
  const CALL = /data = redactStoryLayers\(data, viewer\);/;
  assert.match(
    s,
    CALL,
    'EditorialContent no longer takes the withheld layers out of the payload, ' +
      'or it passes something other than the viewer it resolved.',
  );
  const at = s.search(CALL);
  const compose = s.indexOf('composeCopy(data)');
  assert.ok(
    at > 0 && at < compose,
    'The redaction runs AFTER the story is composed — the withheld layers are ' +
      'built into the copy before anything is taken out of them.',
  );
});

test('the printable keepsake redacts the same layers as the screen', () => {
  // Paper does not revalidate. A layer withheld on screen and printed onto an
  // A3 sheet is the worse of the two leaks.
  assert.match(
    body('app/[slug]/print/page.tsx'),
    /if \(data\) data = redactStoryLayers\(data, printViewer\);/,
    'The print route takes the loader directly, so it is the way around the ' +
      "page's redaction unless it does its own.",
  );
});

test('the menu cannot announce a gallery the viewer may not open', () => {
  // The gallery-anchor probe counts photo blocks ~120 lines before the story is
  // rendered, and that count decides whether a Gallery tab exists. A stranger
  // before publish was told the guests had been shooting by a tab that only
  // appears when they have.
  const s = body('app/[slug]/_components/site-body.tsx');
  assert.match(
    s,
    /const recap = redactStoryLayers\(\s*await loadEditorialData\(event\.event_id\),\s*storyViewer,\s*\)/,
    'The gallery-anchor probe reads the story unredacted again.',
  );
  const viewerAt = s.indexOf('const storyViewer = {');
  const probeAt = s.indexOf('redactStoryLayers(');
  assert.ok(
    viewerAt > 0 && viewerAt < probeAt,
    'The viewer is defined below its first reader again — which is exactly how ' +
      'the probe came to run without one.',
  );
});

// ── THE WALK ────────────────────────────────────────────────────────────────

/**
 * Every reader of the story loader, found by WALKING — not by a hand-written
 * list, which is a list of the files somebody remembered.
 *
 * A file that calls `loadEditorialData` either redacts what it got, or it is on
 * the baseline below with the reason it does not have to. The baseline may only
 * SHRINK: adding a line to it is a decision somebody has to write down.
 */
const NOT_REDACTED_BY_DESIGN = new Map<string, string>([
  [
    'app/dashboard/[eventId]/website/editorial/page.tsx',
    "the host's own desk — the events read goes through the user's session " +
      'client, so RLS scopes it to an event they host, and a host reads every layer.',
  ],
  [
    'app/dashboard/[eventId]/studio/papic/magazine/route.ts',
    "the host's own magazine — the route refuses anyone whose event_members " +
      "row is not member_type='couple' with a 403.",
  ],
  [
    'app/api/og/realstory-slug/[slug]/route.ts',
    'the social card renders the editorial only inside `if (data?.published)`, ' +
      'so it never draws a story that is not open to everyone.',
  ],
  [
    'lib/auto-recap.ts',
    "/[slug]/recap is gated by its OWN publish flag (event_recaps.status = " +
      "'published') — a separate, deliberate act by the host, not this story's " +
      'status. ⚠ The two flags are independent: a host who publishes the recap ' +
      'while the story is still a draft has chosen to. Worth revisiting when ' +
      'the fourth publish state (Taken back) lands.',
  ],
]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(WEB, dir))) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const rel = join(dir, name);
    if (statSync(join(WEB, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

test('every reader of the story loader redacts it, or says in writing why not', () => {
  const readers: string[] = [];
  for (const f of [...sourceFiles('app'), ...sourceFiles('lib')]) {
    const src = stripComments(read(f));
    // The CALL, not the import: `import { loadEditorialData }` is not a read.
    if (/loadEditorialData\s*\(/.test(src.replace(/^import[\s\S]*?from '[^']+';$/gm, ''))) {
      readers.push(relative('.', f));
    }
  }
  assert.ok(
    readers.length >= 6,
    `The walk found only ${readers.length} readers of the story loader. It has ` +
      'stopped walking — check the extensions and the skip list before trusting a pass.',
  );

  const unaccounted = readers.filter(
    (f) =>
      !NOT_REDACTED_BY_DESIGN.has(f) &&
      !/redactStoryLayers\s*\(/.test(stripComments(read(f))),
  );
  assert.deepEqual(
    unaccounted,
    [],
    'These read the story and hand it on whole. Redact it with the viewer the ' +
      'surface already resolved, or add it to NOT_REDACTED_BY_DESIGN with the ' +
      `reason: ${unaccounted.join(', ')}`,
  );

  const stale = [...NOT_REDACTED_BY_DESIGN.keys()].filter((f) => !readers.includes(f));
  assert.deepEqual(stale, [], `The baseline names files that no longer read the loader: ${stale.join(', ')}`);
  for (const [f, why] of NOT_REDACTED_BY_DESIGN) {
    assert.ok(why.length > 40, `"${f}" is on the baseline with no real reason`);
  }
});

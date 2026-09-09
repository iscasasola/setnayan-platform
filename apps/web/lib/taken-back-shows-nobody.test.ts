/**
 * TAKEN BACK SHOWS NOBODY — the fourth rung's whole meaning, over every case.
 *
 * `01` §2's viewer table: a story that has been taken back leaves the host their
 * Story Maker and gives the guest and the stranger the fallback. So the gate has
 * to refuse everyone who is not the host — including a guest with a seat, who is
 * the one viewer a `draft`-shaped rule could plausibly have been written to let
 * through.
 *
 * ⚠ THE WHOLE TRUTH TABLE, NOT A SAMPLE. `storyAudienceAdmits` is four audiences
 * × four viewers = sixteen answers and every one is asserted, because the defect
 * this guards against is a fall-through: the function's LAST line returns `true`,
 * so an audience nobody named is admitted to everybody. A spot check of the new
 * value would pass a build where the new value was added to the list and never to
 * the gate.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STORY_AUDIENCES,
  STORY_AUDIENCE_LABEL,
  STORY_AUDIENCE_NOTE,
  STORY_AUDIENCE_SAVED,
  storyAudienceAdmits,
  storyAudienceOf,
  storyIsShared,
  storyHasBeenPublished,
  type StoryAudience,
  type StoryViewer,
} from './who-can-see-your-story';

const VIEWERS: Array<[string, StoryViewer]> = [
  ['a stranger', { isHost: false, belongsToEvent: false }],
  ['a guest of the day', { isHost: false, belongsToEvent: true }],
  ['the host', { isHost: true, belongsToEvent: false }],
  ['the host who is also a guest', { isHost: true, belongsToEvent: true }],
];

/** audience → who it admits, keyed by the viewer labels above. */
const TRUTH: Record<StoryAudience, Record<string, boolean>> = {
  draft: {
    'a stranger': false,
    'a guest of the day': false,
    'the host': true,
    'the host who is also a guest': true,
  },
  event: {
    'a stranger': false,
    'a guest of the day': true,
    'the host': true,
    'the host who is also a guest': true,
  },
  published: {
    'a stranger': true,
    'a guest of the day': true,
    'the host': true,
    'the host who is also a guest': true,
  },
  taken_back: {
    'a stranger': false,
    'a guest of the day': false,
    'the host': true,
    'the host who is also a guest': true,
  },
};

test('every audience admits exactly the people it says it does', () => {
  // If a fifth audience is ever added, this fails until its row is written —
  // which is the point. A new value with no row is a value nobody has decided
  // the answer for.
  assert.deepEqual(
    [...STORY_AUDIENCES].sort(),
    Object.keys(TRUTH).sort(),
    'an audience exists with no row in the truth table.',
  );

  for (const audience of STORY_AUDIENCES) {
    for (const [who, viewer] of VIEWERS) {
      assert.equal(
        storyAudienceAdmits(audience, viewer),
        TRUTH[audience][who],
        `${audience} → ${who}: expected ${TRUTH[audience][who]}`,
      );
    }
  }
});

test('a story taken back is not a shared story', () => {
  assert.equal(storyIsShared('taken_back'), false);
  assert.equal(storyIsShared('published'), true);
  assert.equal(storyIsShared('event'), true);
  assert.equal(storyIsShared('draft'), false);
});

test('an unrecognised status still fails closed to only-me', () => {
  // A build that predates the fourth word must not admit a row carrying it.
  assert.equal(storyAudienceOf('taken_back'), 'taken_back');
  assert.equal(storyAudienceOf('something_new'), 'draft');
  assert.equal(storyAudienceOf(null), 'draft');
  assert.equal(storyAudienceOf(7), 'draft');
});

test('every audience has words for a person to read', () => {
  for (const audience of STORY_AUDIENCES) {
    assert.ok(STORY_AUDIENCE_LABEL[audience]?.trim(), `${audience} has no label`);
    assert.ok(STORY_AUDIENCE_NOTE[audience]?.trim(), `${audience} has no note`);
  }
});

test('"has it ever been public" is asked of the stamped number, not the status', () => {
  assert.equal(storyHasBeenPublished(1), true);
  assert.equal(storyHasBeenPublished(4), true);
  assert.equal(storyHasBeenPublished(null), false);
  assert.equal(storyHasBeenPublished(undefined), false);
  // A story that never got a number is not "published once" however it got here.
  assert.equal(storyHasBeenPublished(0), false);
});

test('the saved sentence is written per rung, not assembled from the label', () => {
  /*
    🔴 IT WAS `Saved · ${LABEL.toLowerCase()} can read it.` and the fourth rung
    read *"Saved · only me — taken back can read it."* on the first try. The
    three sentences that already shipped are asserted BYTE FOR BYTE against what
    that expression produced, so moving them into their own record cannot have
    quietly changed the words a host reads.
  */
  assert.equal(STORY_AUDIENCE_SAVED.draft, 'Saved · only me can read it.');
  assert.equal(
    STORY_AUDIENCE_SAVED.event,
    'Saved · the people of this celebration can read it.',
  );
  assert.equal(STORY_AUDIENCE_SAVED.published, 'Saved · everyone can read it.');

  for (const audience of STORY_AUDIENCES) {
    const line = STORY_AUDIENCE_SAVED[audience];
    assert.ok(line?.trim(), `${audience} has no saved sentence`);
    assert.ok(line.endsWith('.'), `${audience}'s saved sentence is not a sentence: ${line}`);
    // The frame the old expression forced. A sentence assembled from a label
    // would reintroduce it; a written one never contains the em dash a label
    // carries mid-clause.
    assert.ok(
      !/ — .* can read it\./.test(line),
      `${audience}'s saved sentence reads as a label dropped into a frame: ${line}`,
    );
  }
});

/**
 * THE PUBLISH GATE — every combination, not a sample (08 step 1.6).
 *
 * 🔑 THE GATE IS EXERCISED OVER ITS WHOLE INPUT SPACE. There are three boolean
 * facts and three audiences: twenty-four cases, all of them cheap. A test that
 * checked "the happy path passes and one blocker fails" would go green against a
 * gate that had stopped reading one of its three facts entirely — which is
 * exactly the shape of decoration this build has already paid for twice ("at
 * least three arms fail closed" passed while a sabotage DELETED one of four).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LAST_WORD_MAX,
  mayChooseAudience,
  publishBlockers,
  publishBlockerSentence,
  publishRefusal,
  PUBLISH_CONSENT_FINE_PRINT,
  PUBLISH_CONSENT_SENTENCE,
  PUBLISH_PANEL_INTRO,
  PUBLISH_STATE_BLURB,
  PUBLISH_STATE_NAME,
  PUBLISH_STATE_RUNG,
  PUBLISH_STATE_WHO,
  type PublishBlocker,
} from './publish-once-knowing-who-reads-it';
import { STORY_AUDIENCES } from './who-can-see-your-story';

const BOOLS = [false, true] as const;

test('the consent sentence is VERBATIM — it is a consent record, not copy', () => {
  /*
    ⚖ RA 10173. This exact sentence is what the host is recorded as having
    agreed to (`event_editorial.publish_consent_at`), and it is quoted
    character-for-character in `02_The_Story_Maker.md` §8 and in the session
    brief. Rewording it changes what was consented to, retroactively, for every
    host already stamped against it.
  */
  assert.equal(
    PUBLISH_CONSENT_SENTENCE,
    'I want this story to be public, and I understand it will carry our names, ' +
      'our photos, and the words our guests agreed to share.',
  );
});

test('the fine print keeps both of its promises', () => {
  // The design requires two things under the tick, and each is load-bearing
  // somewhere else in the build: the first is `04` rule 9 (a guest can act on
  // their own consent, and it comes down everywhere); the second is why the
  // gate deliberately does NOT block the way back down.
  assert.match(PUBLISH_CONSENT_FINE_PRINT, /hide their photo or ask to be unnamed/);
  assert.match(PUBLISH_CONSENT_FINE_PRINT, /back to guests-only whenever/);
});

test('every rung names WHO can see it, in its own words', () => {
  // The design's whole requirement for the ladder: "three states, each NAMING
  // who can see it". A rung with an empty who-line is a rung that does not.
  for (const a of STORY_AUDIENCES) {
    assert.ok(PUBLISH_STATE_WHO[a]?.startsWith('Who can see it:'), `${a} has no who-line`);
    assert.ok(PUBLISH_STATE_WHO[a].length > 'Who can see it:'.length + 3, `${a}'s who-line is empty`);
    assert.ok(PUBLISH_STATE_NAME[a]?.trim(), `${a} has no name`);
    assert.ok((PUBLISH_STATE_BLURB[a] ?? '').length > 40, `${a} has no blurb`);
    assert.ok(PUBLISH_STATE_RUNG[a]?.trim(), `${a} has no rung word`);
  }
  // The three rung words are distinct — "Now · Next · Last" is a ladder; three
  // identical words are three buttons again.
  const rungs = STORY_AUDIENCES.map((a) => PUBLISH_STATE_RUNG[a]);
  assert.equal(new Set(rungs).size, 3, 'the rungs do not read as an order');
  assert.ok(PUBLISH_PANEL_INTRO.length > 60);
});

test('the middle rung does NOT print a guest headcount', () => {
  /*
    ⚠ THE PROTOTYPE WRITES "your 120 guests" — a filled mock-up, not a template.
    This screen holds no headcount, and a wrong number printed under the words
    "who can see it" is worse than no number. A future port that copies the
    mock-up literally trips here.
  */
  assert.doesNotMatch(PUBLISH_STATE_WHO.event, /\d/);
});

test('ONLY the published rung is gated — the way back down is never blocked', () => {
  /*
    🔑 LOAD-BEARING, NOT A CONVENIENCE. The consent fine print promises the host
    they can go back to guests-only whenever. A gate on the way DOWN would break
    a promise printed on the same screen, and would strand a host at `published`
    the moment one new thing landed on their desk.
  */
  for (const deskLoaded of BOOLS) {
    for (const deskClear of BOOLS) {
      for (const consented of BOOLS) {
        const facts = { deskLoaded, deskClear, consented };
        assert.equal(mayChooseAudience('draft', facts), true, 'draft was refused');
        assert.equal(mayChooseAudience('event', facts), true, 'guests-only was refused');
      }
    }
  }
});

test('publishing needs ALL THREE facts — every combination, not a sample', () => {
  for (const deskLoaded of BOOLS) {
    for (const deskClear of BOOLS) {
      for (const consented of BOOLS) {
        const facts = { deskLoaded, deskClear, consented };
        const expected = deskLoaded && deskClear && consented;
        assert.equal(
          mayChooseAudience('published', facts),
          expected,
          `deskLoaded=${deskLoaded} deskClear=${deskClear} consented=${consented}`,
        );
      }
    }
  }
});

test('an UNREADABLE desk refuses, and says something different from an undecided one', () => {
  /*
    A source that could not be read and a source with nothing in it look
    identical — the desk's own banner exists for that reason. An unreadable desk
    has not PROVED it is clear, so it refuses; and it must not tell the host
    "3 things are waiting", because that is a number nobody measured.
  */
  const unknown = publishBlockers({ deskLoaded: false, deskClear: true, consented: true });
  assert.deepEqual(unknown, ['desk_unknown']);
  assert.doesNotMatch(publishBlockerSentence('desk_unknown', 7), /7/);
  assert.match(publishBlockerSentence('desk_undecided', 7), /7/);
  assert.match(publishBlockerSentence('desk_undecided', 1), /^One thing is/);
});

test('every blocker has a sentence a host can act on', () => {
  const ALL: PublishBlocker[] = ['desk_undecided', 'desk_unknown', 'no_consent'];
  for (const b of ALL) {
    const s = publishBlockerSentence(b, 3);
    assert.ok(s.length > 20, `${b} has no sentence`);
    // The server hands back the SAME words the button shows, so a host who got
    // past the button (an old tab, a hand-made request) meets one vocabulary.
    assert.equal(publishRefusal([b], 3), s);
  }
  assert.ok(publishRefusal([], 0).length > 0, 'an empty refusal still says something');
});

test('the last word is capped where the other door caps it', () => {
  // `/dashboard/[eventId]/website/special-message` writes the same column at
  // 600. One number, so two doors cannot disagree about how long a last word
  // may be.
  assert.equal(LAST_WORD_MAX, 600);
});

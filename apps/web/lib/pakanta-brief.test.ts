/**
 * Byte-identity gate for composePakantaBrief (Pakanta · the Suno/music-team
 * prompt). Iteration 0053 made the brief prose event-type-aware via an optional
 * `organizerNoun` (defaults to 'couple'). The load-bearing invariant: a WEDDING
 * (organizerNoun omitted, or 'couple') must produce the EXACT prior prose —
 * including the curly apostrophe (U+2019) at "couple’s" and "COUPLE’S". A
 * non-wedding ('host') reframes the same prose without touching the wedding path.
 *
 * This is the only regression gate on the wedding brief — adversarial review of
 * the 0053 change flagged its absence twice. Keep these literals curly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composePakantaBrief, type PakantaBriefInput } from './pakanta-brief';

// Rich responses fire the story header (site 2), music-type line (site 3) and
// the extra-wish line (site 5) without needing an onboarding love story.
const RICH: PakantaBriefInput = {
  coupleNames: 'Claire & Ice',
  loveStory: null,
  storyTone: null,
  responses: {
    memorable_story: 'the rooftop proposal',
    music_type: 'acoustic ballad',
    story_to_add: 'our dog Max',
  },
};

const EMPTY: PakantaBriefInput = {
  coupleNames: '',
  loveStory: null,
  storyTone: null,
  responses: null,
};

test('wedding: omitting organizerNoun === explicit "couple" (byte-identical default)', () => {
  assert.deepEqual(
    composePakantaBrief(RICH),
    composePakantaBrief({ ...RICH, organizerNoun: 'couple' }),
  );
  assert.deepEqual(
    composePakantaBrief(EMPTY),
    composePakantaBrief({ ...EMPTY, organizerNoun: 'couple' }),
  );
});

test('wedding: brief prose matches the prior literals exactly (curly U+2019 preserved)', () => {
  const b = composePakantaBrief(RICH);
  // site 2 — note the CURLY apostrophe in "couple’s".
  assert.ok(b.copyBlock.includes('THEIR STORY (from the couple’s onboarding interview):'));
  // site 3
  assert.ok(b.copyBlock.includes('Music type the couple asked for: acoustic ballad'));
  // site 5 — CURLY apostrophe in "COUPLE’S".
  assert.ok(b.copyBlock.includes('COUPLE’S EXTRA WISH: our dog Max'));
  // coupleNames passes through unchanged.
  assert.equal(b.coupleNames, 'Claire & Ice');
});

test('wedding: empty input falls back to "The couple" and the couple "no material" notice', () => {
  const b = composePakantaBrief(EMPTY);
  assert.equal(b.coupleNames, 'The couple'); // site 1
  assert.equal(b.hasMaterial, false);
  // site 6
  assert.ok(
    b.copyBlock.includes(
      '⚠ No story material yet — the couple has not completed the love-story onboarding or a Pakanta intake.',
    ),
  );
});

test('wedding: tone-only input keeps the "(couple left music blank)" suggestion (site 4)', () => {
  const b = composePakantaBrief({ ...EMPTY, storyTone: 'warm' });
  assert.ok(/Suggested catalogue feel \(couple left music blank\):/.test(b.copyBlock));
});

test('non-wedding: organizerNoun "host" reframes every prose site', () => {
  const rich = composePakantaBrief({ ...RICH, coupleNames: '', organizerNoun: 'host' });
  assert.equal(rich.coupleNames, 'The host'); // site 1 fallback
  assert.ok(rich.copyBlock.includes('THEIR STORY (from the host’s onboarding interview):')); // site 2
  assert.ok(rich.copyBlock.includes('Music type the host asked for: acoustic ballad')); // site 3
  assert.ok(rich.copyBlock.includes('HOST’S EXTRA WISH: our dog Max')); // site 5 (toUpperCase)

  const empty = composePakantaBrief({ ...EMPTY, organizerNoun: 'host' });
  assert.ok(empty.copyBlock.includes('the host has not completed')); // site 6

  const tone = composePakantaBrief({ ...EMPTY, storyTone: 'warm', organizerNoun: 'host' });
  assert.ok(/Suggested catalogue feel \(host left music blank\):/.test(tone.copyBlock)); // site 4
});

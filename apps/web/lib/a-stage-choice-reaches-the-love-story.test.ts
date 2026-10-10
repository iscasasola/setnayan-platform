/**
 * a-stage-choice-reaches-the-love-story.test.ts — "WHAT GUESTS SEE" (DECISION_LOG 2026-10-10): a love story hidden on
 * a stage is NOT TOLD on that stage — and the same for what the Save-the-Date film and its plain stand-in carry.
 *
 * WHY THIS NEEDS ITS OWN FILE. The love story has more than one teller. Besides the "Our love story" scene (the
 * stage's list — `a-stage-choice-decides-the-stage-list.test.ts`), the guest page:
 *   · draws the story as PROSE (`<OurStory>`) on every stage whose list has no love story scene on the page — The Day
 *     by default, and any stage where the scene is hidden by the event-wide eye (today's behaviour, kept);
 *   · offers the "Our Love Story" TAB when there is a chapter to land on (`storyTabHasChapter`);
 *   · on the Save the Date, lets the FILM carry the story's line and the gallery as its own beats, and — with the
 *     film switched off by the link — a plain stand-in that draws a love story AND a countdown of its own.
 * None of these reads the stage's list. Each is asked here, on the REAL page (`lib/stage-pages-fixture.ts`).
 *
 *   1. the prose on The Day (both trees) obeys The Day's choice;
 *   2. hidden on the Invitation: no scene, no prose, no tab — while a scene hidden by the EYE still falls back to
 *      the prose, as it did;
 *   3. shown on The Day: the scene is drawn there, and the prose stands down (the story once, never twice);
 *   4. the Save the Date's plain stand-in: its love story and its countdown obey the Save the Date's choice;
 *   5. the Save the Date's film: its gallery obeys the Save the Date's choice. (The film is handed a story line and
 *      prints it nowhere on a guest's page today — measured, and pinned so the day it does, this file says so.)
 *
 * SABOTAGES RUN, one reader at a time in `site-body.tsx` (each seen red, then put back and re-checked by hash):
 *   A · the stranger's prose made deaf (`storyOffHere ||` taken off its gate)                   → 1, 2, 4, 5 red;
 *   B · the guest's prose made deaf (`storyOffHere ? null :` taken off its mount)                → 1, 2, 4, 5 red;
 *   C · the guest's tab made deaf (`&& !storyOffHere` taken off its gate)                        → 2 red;
 *   D · the stranger's tab made deaf (the same)                                                  → 2 red;
 *   E · the film's view handed the story whatever the stage says                                 → 4 red;
 *   F · the stand-in's `countdown` prop removed                                                  → 4 red;
 *   G · the film's gallery no longer asking                                                      → 5 red.
 * NOT sabotaged on its own: the two one-line markers that only follow the prose (the stranger's `quiet` group flag
 * and the guest's sr-only Story anchor on an untabbed page) — they print no words of the story.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
/* FIRST: the page renderer's seam (see `lib/stage-pages-fixture.ts`). */
import { STAGE_WORDS, renderStagePage, stageProps, stageWidgets, type RowPatch, type StageCase } from './stage-pages-fixture';
import { STAGE_SHOW_KEY } from './stage-scenes';
import type { LifecyclePhase, WidgetType } from './invitation-widgets';

const show = (choices: Partial<Record<LifecyclePhase, boolean>>, more: Record<string, unknown> = {}) => ({ config: { [STAGE_SHOW_KEY]: choices, ...more } });
const times = (html: string, word: string) => html.split(word).length - 1;
const READERS = ['guest', 'anonymous'] as const;

async function page(c: StageCase, patch: Partial<Record<WidgetType, RowPatch>> = {}, more: Parameters<typeof renderStagePage>[2] = {}): Promise<string> {
  const drawn = await renderStagePage(c, stageWidgets(patch), more);
  assert.deepEqual(drawn.complaints, [], 'React or the page complained');
  return drawn.html;
}

const TOLD = STAGE_WORDS.howWeMet; // in the scene AND in the prose
const PROSE = STAGE_WORDS.proseOpening; // the prose only
const TAB = 'Our Love Story</a>';
const COUNTDOWN = 'Until we say';

test('1 · the prose on The Day obeys The Day’s choice — a listed guest and a reader with no key', async () => {
  for (const reader of READERS) {
    const c: StageCase = { stage: 'event', reader, arrangement: 'plain' };
    assert.equal(times(await page(c), PROSE), 1, `anti-vacuity: the Day tells the story as prose (${reader})`);
    const off = await page(c, { our_love_story: show({ event: false }) });
    assert.equal(times(off, TOLD), 0, `the love story hidden on The Day is told on The Day (${reader})`);
    assert.equal(times(off, 'Our story'), 0, 'its heading stayed');
    // A choice for another stage is not The Day's.
    assert.equal(times(await page(c, { our_love_story: show({ rsvp: false }) }), PROSE), 1);
  }
});

test('2 · hidden on the Invitation: no scene, no prose, no tab — and the EYE still falls back to the prose', async () => {
  for (const reader of READERS) {
    const c: StageCase = { stage: 'rsvp', reader, arrangement: 'plain' };
    const plain = await page(c);
    assert.equal(times(plain, TOLD), 1, 'anti-vacuity: the Invitation tells the story');
    assert.equal(times(plain, TAB), 2, `anti-vacuity: the bar offers the Our Love Story tab (${reader})`);
    // Today's eye, kept: the scene goes, the prose stands in, the tab stays.
    const eye = await page(c, { our_love_story: { is_visible: false } });
    assert.equal(times(eye, PROSE), 1, 'a scene hidden by the eye no longer falls back to the prose — today’s behaviour moved');
    assert.equal(times(eye, TAB), 2);
    // Hidden on the Invitation: nothing tells it, with the eye on or off.
    for (const patch of [{ our_love_story: show({ rsvp: false }) }, { our_love_story: { is_visible: false, ...show({ rsvp: false }) } }]) {
      const off = await page(c, patch);
      assert.equal(times(off, TOLD), 0, `the love story hidden on the Invitation is told on the Invitation (${reader})`);
      assert.equal(times(off, TAB), 0, `the bar still offers a tab with nothing on it (${reader})`);
    }
    // Post Event still tells it.
    assert.equal(times(await page({ stage: 'editorial', reader, arrangement: 'plain' }, { our_love_story: show({ rsvp: false }) }), TOLD), 1);
  }
});

test('3 · shown on The Day: the scene is drawn there and the prose stands down — the story once', async () => {
  for (const reader of READERS) {
    const c: StageCase = { stage: 'event', reader, arrangement: 'plain' };
    const added = await page(c, { our_love_story: show({ event: true }) });
    assert.equal(times(added, TOLD), 1, `the story is told once (${reader})`);
    assert.equal(times(added, PROSE), 0, 'the prose is drawn beside the scene');
    assert.notEqual(added, await page(c), 'the scene replaced nothing');
  }
});

test('4 · the Save the Date’s plain stand-in: its own love story and its own countdown obey the Save the Date’s choice', async () => {
  for (const reader of READERS) {
    const c: StageCase = { stage: 'save_the_date', reader, arrangement: 'plain' }; // film-led, the film switched off by the link
    const plain = await page(c);
    assert.equal(times(plain, TOLD), 2, 'anti-vacuity: the stand-in tells the story, and so does the scene below it');
    assert.equal(times(plain, COUNTDOWN), 2, 'anti-vacuity: the stand-in counts down, and so does the scene below it');
    const noStory = await page(c, { our_love_story: show({ save_the_date: false }) });
    assert.equal(times(noStory, TOLD), 0, `the love story hidden on the Save the Date is told there (${reader})`);
    assert.equal(times(noStory, COUNTDOWN), 2, 'hiding the story took the countdown');
    const noCount = await page(c, { countdown: show({ save_the_date: false }) });
    assert.equal(times(noCount, COUNTDOWN), 0, `the countdown hidden on the Save the Date still counts down there (${reader})`);
    assert.equal(times(noCount, TOLD), 2);
    // Today's eye, kept: it takes the SCENES off and leaves the stand-in's own.
    const eye = await page(c, { countdown: { is_visible: false } });
    assert.equal(times(eye, COUNTDOWN), 1);
  }
});

test('5 · the Save the Date’s film: its gallery obeys the Save the Date’s choice (the film prints no story line of its own)', async () => {
  for (const reader of READERS) {
    const c: StageCase = { stage: 'save_the_date', reader, arrangement: 'film' };
    const plain = await page(c);
    assert.equal(times(plain, STAGE_WORDS.photo), 1, 'anti-vacuity: the film carries the gallery');
    const noPhotos = await page(c, { our_photos: show({ save_the_date: false }) });
    assert.equal(times(noPhotos, STAGE_WORDS.photo), 0, `the photos hidden on the Save the Date are in its film (${reader})`);
    // Today's eye, kept: the film carries the gallery whatever the eye says.
    assert.equal(times(await page(c, { our_photos: { is_visible: false } }), STAGE_WORDS.photo), 1);
    // Under the film the story is told ONCE, by the scene below it — and the stage's choice takes it off.
    assert.equal(times(plain, TOLD), 1);
    assert.equal(times(await page(c, { our_love_story: show({ save_the_date: false }) }), TOLD), 0);

    /* 📌 MEASURED 2026-10-10: the film is HANDED a story line (`resolveStdFilmContent` → `storyTeaser`, from a story
       stored as plain words) and prints it nowhere on a guest's page — only the Studio's builder reads it. So there
       is nothing of the story inside the film for a stage choice to take off today. The page already hands the film
       no story when it is hidden on the stage (`loveStory={storyOffHere ? null : event.love_story}`); the day the film starts printing the line,
       this assertion goes red — replace it with "hidden on the Save the Date → not in the film". */
    const LINE = 'Two umbrellas, one very long walk home.';
    const event = { ...stageProps(c).event!, love_story: LINE };
    assert.equal(times(await page(c, {}, { event }), LINE), 0, 'the film now prints the story line — make the stage choice reach it (see the note above)');
  }
});

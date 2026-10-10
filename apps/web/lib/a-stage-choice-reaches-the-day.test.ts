/**
 * a-stage-choice-reaches-the-day.test.ts — "WHAT GUESTS SEE" (DECISION_LOG 2026-10-10): the places on The Day that draw
 * a scene WITHOUT asking the day's list of scenes. A per-stage hide that only the list obeyed would leave each of them
 * showing what the couple took off — the fault this work exists to remove.
 *
 * Every assertion is on the REAL guest page (`SiteBody`, `lib/stage-pages-fixture.ts`), at the reader itself:
 *
 *   1. THE DAY'S WELCOME · the guest's look (`dayWelcomeFacts.dressCodeOn` → `welcomePartsOnTheDay`) — the dress
 *      code's "you" half, for a guest the couple dressed;
 *   2. THE DAY'S WELCOME · the reminders (`dayWelcomeFacts.remindersOn` and `dayRemindersRow`) — for a listed guest
 *      and for a reader with no key (who gets them only as the page's public fence allows);
 *   3. THE DAY'S OWN SCHEDULE BLOCK (`isLive && scheduleBlocks.length > 0`, a guest's page) — which never followed
 *      the event-wide eye, and still does not;
 *   4. THE DAY'S DIRECTIONS (`dayVenues` → the directions on top of Live and the venue on the Day's Welcome).
 *
 * For each: hidden on The Day → gone from The Day, and the Invitation is the page it was; shown on The Day → there
 * over the event-wide eye (1, 2); no choice → what it did before (the recorded pages, `every-stage-is-todays-page`).
 *   5. A `true` on The Day never draws the dress code or the reminders a second time in the day's list.
 *
 * SABOTAGES RUN, one reader at a time in `site-body.tsx` (each seen red, then put back and re-checked by hash):
 *   A · `dressCodeOn` back to the eye alone                    → 1 red;
 *   B · `remindersOn` back to the eye alone                    → 2 red;
 *   C · `dayRemindersRow` back to the eye alone                → 2 red;
 *   D · the schedule block's `dayOn('schedule', true)` removed → 3 red;
 *   E · `dayVenues` no longer asking                           → 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
/* FIRST: the page renderer's seam (see `lib/stage-pages-fixture.ts`). */
import { LOOK_NOTE, STAGE_WORDS, renderStagePage, stageWidgets, withALook, type RowPatch, type StageCase } from './stage-pages-fixture';
import { STAGE_SHOW_KEY } from './stage-scenes';
import type { LifecyclePhase, WidgetType } from './invitation-widgets';

const show = (choices: Partial<Record<LifecyclePhase, boolean>>) => ({ config: { [STAGE_SHOW_KEY]: choices } });
const times = (html: string, word: string) => html.split(word).length - 1;
const at = (stage: LifecyclePhase, reader: StageCase['reader'] = 'guest'): StageCase => ({ stage, reader, arrangement: 'plain' });

/** One page; `look` makes the reader a guest the couple dressed (so the look has something to say). */
async function page(c: StageCase, patch: Partial<Record<WidgetType, RowPatch>> = {}, look = false): Promise<string> {
  const drawn = await renderStagePage(c, stageWidgets(patch), look ? withALook(c) : {});
  assert.deepEqual(drawn.complaints, [], 'React or the page complained');
  return drawn.html;
}

const LOOK = 'data-dress-code="you"';
const SCHEDULE_BLOCK = 'aria-label="Day-of schedule"';
const DIRECTIONS = 'data-day-directions=""';

test('1 · the Day’s Welcome · the guest’s look obeys The Day’s choice for the dress code', async () => {
  assert.equal(times(await page(at('event'), {}, true), LOOK), 1, 'anti-vacuity: the look is on the Day’s Welcome');
  assert.ok((await page(at('event'), {}, true)).includes(LOOK_NOTE));
  // Hidden on The Day.
  const off = await page(at('event'), { dress_code: show({ event: false }) }, true);
  assert.equal(times(off, LOOK), 0, 'the dress code hidden on The Day still dresses the guest on The Day');
  assert.ok(!off.includes(LOOK_NOTE));
  // …and the Invitation is the page it was.
  assert.equal(await page(at('rsvp'), { dress_code: show({ event: false }) }, true), await page(at('rsvp'), {}, true));
  // The event-wide eye hides it (as before) — and "shown on The Day" brings it back there.
  assert.equal(times(await page(at('event'), { dress_code: { is_visible: false } }, true), LOOK), 0, 'anti-vacuity: the eye hides the look');
  assert.equal(times(await page(at('event'), { dress_code: { is_visible: false, ...show({ event: true }) } }, true), LOOK), 1);
  // A choice for ANOTHER stage is not The Day's.
  assert.equal(times(await page(at('event'), { dress_code: show({ rsvp: false, editorial: false }) }, true), LOOK), 1);
});

test('2 · the Day’s Welcome · the reminders obey The Day’s choice — for a guest and for a reader with no key', async () => {
  for (const reader of ['guest', 'anonymous'] as const) {
    assert.equal(times(await page(at('event', reader)), STAGE_WORDS.reminder), 1, `anti-vacuity: the reminders are on the Day (${reader})`);
    const off = await page(at('event', reader), { what_to_bring: show({ event: false }) });
    assert.equal(times(off, STAGE_WORDS.reminder), 0, `the reminders hidden on The Day are on The Day (${reader})`);
    assert.equal(await page(at('rsvp', reader), { what_to_bring: show({ event: false }) }), await page(at('rsvp', reader)), 'the Invitation moved');
    // The eye hides them; "shown on The Day" brings them back on The Day — and nowhere else.
    assert.equal(times(await page(at('event', reader), { what_to_bring: { is_visible: false } }), STAGE_WORDS.reminder), 0, 'anti-vacuity');
    const back = { what_to_bring: { is_visible: false, ...show({ event: true }) } };
    assert.equal(times(await page(at('event', reader), back), STAGE_WORDS.reminder), 1, `shown on The Day over the eye (${reader})`);
    assert.equal(times(await page(at('rsvp', reader), back), STAGE_WORDS.reminder), 0, 'the eye still decides the Invitation');
  }
  // 🔒 A reader with no key still gets them only as the public fence allows: "guests only" stays guests only.
  const fenced = { what_to_bring: { audience: 'guests_only' as const, ...show({ event: true }) } };
  assert.equal(times(await page(at('event', 'anonymous'), fenced), STAGE_WORDS.reminder), 0);
  assert.equal(times(await page(at('event', 'guest'), fenced), STAGE_WORDS.reminder), 1);
});

test('3 · the Day’s own schedule block obeys The Day’s choice — and still not the event-wide eye', async () => {
  const plain = await page(at('event'));
  assert.equal(times(plain, SCHEDULE_BLOCK), 1, 'anti-vacuity: the Day draws its own schedule block');
  const off = await page(at('event'), { schedule: show({ event: false }) });
  assert.equal(times(off, SCHEDULE_BLOCK), 0, 'the schedule hidden on The Day is still the Day’s block');
  /* On a guest's live page this block IS the schedule: the schedule SCENE stands down while the day is live
     (`hideable-widget-render.tsx`, `!isLive`), so each moment is printed once — by the block. */
  for (const moment of ['Cocktails', 'Dinner &amp; dancing']) {
    assert.equal(times(plain, moment), 1, `anti-vacuity: "${moment}" is printed once, by the block`);
    assert.equal(times(off, moment), 0, `"${moment}" is still on The Day`);
  }
  assert.equal(await page(at('rsvp'), { schedule: show({ event: false }) }), await page(at('rsvp')), 'the Invitation moved');
  // Today's behaviour, kept: the event-wide eye does not reach the Day's block — a guest still reads the day's schedule.
  const eye = await page(at('event'), { schedule: { is_visible: false } });
  assert.equal(times(eye, SCHEDULE_BLOCK), 1);
  assert.equal(times(eye, 'Cocktails'), 1);
  // A reader with no key has no block of their own: for them the day's schedule is the scene, and the list decides.
  assert.equal(times(await page(at('event', 'anonymous')), 'Cocktails'), 1, 'anti-vacuity');
  assert.equal(times(await page(at('event', 'anonymous'), { schedule: show({ event: false }) }), 'Cocktails'), 0);
});

test('4 · the Day’s directions obey The Day’s choice for the map', async () => {
  const plain = await page(at('event'));
  assert.equal(times(plain, DIRECTIONS), 2, 'anti-vacuity: directions lead Live and sit on the Day’s Welcome');
  const off = await page(at('event'), { venue_map: show({ event: false }) });
  assert.equal(times(off, DIRECTIONS), 0, 'the map hidden on The Day still gives directions on The Day');
  assert.ok(times(off, STAGE_WORDS.reminder) === 1, 'the rest of the Day’s Welcome is there');
  assert.equal(await page(at('rsvp'), { venue_map: show({ event: false }) }), await page(at('rsvp')), 'the Invitation moved');
  // Today's behaviour, kept: the directions do not follow the event-wide eye.
  assert.equal(times(await page(at('event'), { venue_map: { is_visible: false } }), DIRECTIONS), 2);
});

test('5 · shown on The Day never draws the dress code or the reminders twice (their one home there is the Welcome)', async () => {
  const plain = await page(at('event'), {}, true);
  const both = await page(at('event'), { dress_code: show({ event: true }), what_to_bring: show({ event: true }) }, true);
  assert.equal(both, plain, 'a true on a scene the Day’s Welcome already draws changed the page');
  assert.equal(times(both, STAGE_WORDS.reminder), 1);
  assert.equal(times(both, LOOK_NOTE), 1);
});

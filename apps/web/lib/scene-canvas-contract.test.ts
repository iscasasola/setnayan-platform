/**
 * scene-canvas-contract.test.ts — THE FIVE SCENE KEYS ON THE CANVAS, AND THE
 * WRITES THAT PUT THEM THERE (Event Hub Maker Phase 5).
 *
 * `sanitizeHubCanvas` is the one fence on the way in and the way out; these
 * hold what it keeps and what it drops for `template` · `slots` · `free` ·
 * `stages` · `video`, and what one editor tap does (`lib/scene-writes.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_R2_BUCKET } from './r2-client-ref';
import { hubCanvasClass, hubCanvasMediaRefs, hubPhotoPlacement, sanitizeHubCanvas } from './hub-canvas';
import { applySceneSlot, applySceneTemplate, applySceneVideo } from './scene-writes';
import { customSectionHasContent } from './custom-sections';

const REF = (n: string) => `r2://${PUBLIC_R2_BUCKET}/events/E1/${n}.jpg`;
const PRIVATE = 'r2://setnayan-thread-files/events/E1/proof.jpg';

test('⛔ a 26th template, a string id, a fraction: dropped, never repaired', () => {
  assert.deepEqual(sanitizeHubCanvas({ canvas: { template: 18 } }), { template: 18 });
  for (const bad of [26, 0, '18', 18.5, null]) {
    assert.deepEqual(sanitizeHubCanvas({ canvas: { template: bad } }), {}, String(bad));
  }
});

test('🔒 slots keep their positions, hold pictures to the public bucket, and drop over-limit words', () => {
  const canvas = sanitizeHubCanvas({
    canvas: {
      template: 18,
      slots: [
        { media: REF('a') },
        { media: PRIVATE },
        { media: REF('c'), kind: 'snippet', head: 'x'.repeat(81), text: 'kept' },
      ],
    },
  });
  assert.deepEqual(canvas.slots, [{ media: REF('a') }, {}, { media: REF('c'), kind: 'snippet', text: 'kept' }]);
  // Nothing in any slot is no list; more than six is somebody else's shape.
  assert.equal(sanitizeHubCanvas({ canvas: { slots: [{}, {}] } }).slots, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { slots: Array.from({ length: 7 }, () => ({ text: 'a' })) } }).slots, undefined);
  // A kind without a picture is not kept — the background's rule.
  assert.deepEqual(sanitizeHubCanvas({ canvas: { slots: [{ kind: 'snippet', text: 'a' }] } }).slots, [{ text: 'a' }]);
});

test('⛔ free placement: fractions of the scene box, all-or-nothing', () => {
  const ok = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 };
  assert.deepEqual(sanitizeHubCanvas({ canvas: { free: [ok] } }).free, [ok]);
  for (const bad of [
    { x: -0.1, y: 0, w: 0.5, h: 0.5 },
    { x: 0.6, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0, w: 0, h: 0.5 },
    { x: 0, y: 0.9, w: 0.5, h: 0.2 },
    { x: '0', y: 0, w: 0.5, h: 0.5 },
  ]) {
    assert.equal(sanitizeHubCanvas({ canvas: { free: [ok, bad] } }).free, undefined, JSON.stringify(bad));
  }
});

test('per-stage order and visibility: the four public stages only', () => {
  assert.deepEqual(
    sanitizeHubCanvas({
      canvas: { stages: { rsvp: { order: 3, mode: 'hidden' }, event: { mode: 'shown' }, wedding: { order: 1 }, editorial: { order: -1 } } },
    }).stages,
    { rsvp: { order: 3, mode: 'hidden' }, event: { mode: 'shown' } },
  );
});

test('playback: loop is an absence; open only beside a tap', () => {
  assert.equal(sanitizeHubCanvas({ canvas: { video: { play: 'loop', open: 'inplace' } } }).video, undefined);
  assert.deepEqual(sanitizeHubCanvas({ canvas: { video: { play: 'tap' } } }).video, { play: 'tap' });
  assert.deepEqual(sanitizeHubCanvas({ canvas: { video: { play: 'tap', open: 'inplace' } } }).video, { play: 'tap', open: 'inplace' });
  assert.deepEqual(sanitizeHubCanvas({ canvas: { video: { play: 'tap', open: 'fullscreen' } } }).video, { play: 'tap' });
});

test('🔑 a template scene’s own pictures sign in the page’s one pass, and its background stays behind', () => {
  const row = { config_json: { canvas: { template: 17, media: REF('bg'), slots: [{ media: REF('a') }, { media: REF('b') }] } } };
  assert.deepEqual(hubCanvasMediaRefs([row]).sort(), [REF('a'), REF('b'), REF('bg')].sort());
  const canvas = sanitizeHubCanvas({ canvas: { template: 1, arrangement: 'left', media: REF('bg') } });
  assert.equal(hubPhotoPlacement(canvas, true), 'behind', 'a template places its own pictures; media is the scene ground');
  assert.match(hubCanvasClass(canvas, true), /\bhub-has-tpl\b/);
});

/* ══ THE WRITES ══════════════════════════════════════════════════════════ */

test('⭐ picking a template: with Pro its effect replaces the old one; without, only the template changes', () => {
  const before = sanitizeHubCanvas({ canvas: { preset: 'still', transition: 'auto', arrangement: 'left', slots: [{ text: 'kept' }] } });
  assert.deepEqual(applySceneTemplate(before, 4, true), {
    template: 4,
    preset: 'cinematic',
    transition: 'scrub',
    slots: [{ text: 'kept' }],
  });
  assert.deepEqual(applySceneTemplate(before, 4, false), {
    preset: 'still',
    transition: 'auto',
    template: 4,
    slots: [{ text: 'kept' }],
  });
});

test('🔒 a slot picture must be one of theirs; putting one up is flagged for the Pro gate, taking it off is not', () => {
  const own = new Set([REF('a'), REF('b')]);
  const empty = sanitizeHubCanvas({ canvas: { template: 17 } });
  const up = applySceneSlot(empty, 1, { media: REF('b') }, own);
  assert.ok(up.ok && up.putsMediaUp);
  assert.deepEqual(up.ok && up.canvas.slots, [{}, { media: REF('b') }]);
  assert.deepEqual(applySceneSlot(empty, 0, { media: REF('zzz') }, own), { ok: false, reason: 'not_your_photo' });
  assert.deepEqual(applySceneSlot(empty, 0, { media: PRIVATE }, new Set([PRIVATE])), { ok: false, reason: 'not_your_photo' });
  const off = applySceneSlot(up.ok ? up.canvas : empty, 1, { media: '' }, new Set());
  assert.ok(off.ok && !off.putsMediaUp);
  assert.equal(off.ok && off.canvas.slots, undefined, 'the last picture off leaves no list');
  // Same picture again is not a new "put up".
  const again = applySceneSlot(up.ok ? up.canvas : empty, 1, { media: REF('b') }, own);
  assert.ok(again.ok && !again.putsMediaUp);
});

test('⛔ words over the limit are refused, never cut; a bad slot index is refused', () => {
  const c = sanitizeHubCanvas({ canvas: { template: 24 } });
  assert.deepEqual(applySceneSlot(c, 0, { head: 'x'.repeat(81) }, new Set()), { ok: false, reason: 'too_long' });
  assert.deepEqual(applySceneSlot(c, 0, { text: 'x'.repeat(601) }, new Set()), { ok: false, reason: 'too_long' });
  assert.deepEqual(applySceneSlot(c, 6, { text: 'a' }, new Set()), { ok: false, reason: 'bad_slot' });
  const w = applySceneSlot(c, 2, { head: ' 2019 ', text: 'We met\r\nat the fair' }, new Set());
  assert.ok(w.ok && !w.putsMediaUp);
  assert.deepEqual(w.ok && w.canvas.slots, [{}, {}, { head: '2019', text: 'We met\nat the fair' }]);
});

test('playback write: a tap is a choice (Pro), back to loop never is', () => {
  const c = sanitizeHubCanvas({ canvas: { template: 14 } });
  assert.deepEqual(applySceneVideo(c, 'tap', 'inplace'), { canvas: { template: 14, video: { play: 'tap', open: 'inplace' } }, putsUp: true });
  assert.deepEqual(applySceneVideo({ ...c, video: { play: 'tap' } }, 'loop', null), { canvas: { template: 14 }, putsUp: false });
  assert.equal(applySceneVideo(c, 'autoplay', null), null);
});

test('🔑 a template scene has content when something is in it — or when it fills itself from the event', () => {
  assert.equal(customSectionHasContent({ canvas: { template: 17 } }), false, 'an empty photo template');
  assert.equal(customSectionHasContent({ canvas: { template: 17, slots: [{ media: REF('a') }] } }), true);
  assert.equal(customSectionHasContent({ canvas: { template: 22, slots: [{}, { head: 'Hi' }] } }), true);
  assert.equal(customSectionHasContent({ canvas: { template: 8 }, custom: { title: 'A heading' } }), true);
  assert.equal(customSectionHasContent({ canvas: { template: 10 } }), true, 'the title card prints their names');
  assert.equal(customSectionHasContent({ custom: { title: 'only a heading' } }), false, 'a plain section still needs a body');
});

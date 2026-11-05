/**
 * GUARD — PAPIC ON = A CAMERA TAB ON EVERY STAGE · MEMORIES OPENS ONCE THERE ARE PHOTOS
 * (owner 2026-10-30, DECISION_LOG "PAPIC ON = A CAMERA TAB ON EVERY STAGE", points 1 and 2).
 *
 * Owner, verbatim: *"when papic is on. no matter what event hub stage it is, it will add the camera menu. when there
 * is already existing papic shots or uploaded photos via papic, the memories will be available."*
 *
 *   1. CAMERA — while Papic is on (`hostAllowsCamera`, the same `eventPapicGuestActive` answer the camera button
 *      follows) an invited guest's bar carries a LIVE Camera on Save the Date, the Invitation, The Day and Post
 *      Event, going to the same address the camera button goes to. Papic off → no Camera before the day or after it;
 *      on the day ruling 2's locked camera stands. A stranger and a supplier: never a Camera, on or off.
 *   2. MEMORIES — at least one Papic shot or upload (`countGalleryFrames` > 0) opens a guest's Memories on the day
 *      and after it, public chapter or not; none, with nothing else drawn there, means NO Memories tab for anyone on
 *      any stage — never an empty page. Not known (not asked / refused) → the rules as before.
 *   3. THE PAGE TELLS THE BAR — both bars are handed the one count, asked with the grid's own filters, and a
 *      stranger never asks it. The day's consent card still mounts only where the stage lists the Camera.
 *
 * Executed against the resolver; the page's wiring read with comments stripped (`stripComments`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { resolveSiteNav, type NavInput, type NavPhase, type NavSlot, type VendorKit } from './site-nav';
import { STAGE_BAR } from './stage-bar';
import type { LifecyclePhase } from '@/lib/invitation-widgets';

const SLUG = dirname(dirname(fileURLToPath(import.meta.url)));
const BODY = stripComments(readFileSync(join(SLUG, '_components', 'site-body.tsx'), 'utf8'));

/** Each stage at the moment a guest meets it (the same mapping the Maker previews with). */
const STAGE_PHASE: Record<LifecyclePhase, NavPhase> = {
  save_the_date: 'before',
  rsvp: 'before',
  event: 'day',
  editorial: 'after',
};
const STAGES = Object.keys(STAGE_PHASE) as LifecyclePhase[];
const CAMERA = '/papic/guest?from=ana';

const barOn = (stage: LifecyclePhase, over: Partial<NavInput> = {}): NavSlot[] =>
  resolveSiteNav({
    viewer: { kind: 'guest' },
    phase: STAGE_PHASE[stage],
    hostAllowsCamera: true,
    anyChapterPublic: false,
    hasStory: true,
    hasDetails: true,
    liveBroadcast: false,
    postEvent: { film: true, suppliers: true },
    destinations: { camera: CAMERA, watch: '/ana/hub', join: '/ana/invite', film: '#open-film', suppliers: '#site-suppliers' },
    stageSlots: STAGE_BAR[stage].slots,
    ...over,
  });
const keys = (s: NavSlot[]) => s.map((x) => x.key);

test('1 · Papic ON: a guest\'s bar carries a LIVE Camera on EVERY stage, to the camera button\'s address', () => {
  for (const stage of STAGES) {
    const bar = barOn(stage);
    console.log(`  ${stage} (Papic on): ${bar.map((s) => s.label).join(' · ')}`);
    const cam = bar.find((s) => s.key === 'camera');
    assert.ok(cam, `${stage}: Papic is on and the guest's bar has no Camera`);
    assert.equal(cam.state, 'live', `${stage}: the Camera is drawn locked while Papic is on`);
    assert.equal(cam.href, CAMERA, `${stage}: the Camera tab must go where the camera button goes`);
    assert.ok(bar.length <= 5, `${stage}: the bar broke the five-slot shape (${keys(bar).join(' · ')})`);
    assert.equal(bar.at(-1)?.key, 'me', `${stage}: Me was pushed off the end`);
  }
  // The shapes, in the stages' own words.
  assert.deepEqual(keys(barOn('save_the_date')), ['home', 'story', 'camera', 'me']);
  assert.deepEqual(keys(barOn('rsvp')), ['home', 'details', 'story', 'camera', 'me']);
  // Post Event: five slots still — Suppliers, a scroll within the Recap, yields first (the couple's precedent).
  assert.deepEqual(keys(barOn('editorial', { anyChapterPublic: true })), ['home', 'film', 'camera', 'gallery', 'me']);
  // …the one-page stages (`tabbed: 'one-page'`) keep the Camera's own address; it never becomes a jump mark.
  assert.equal(barOn('rsvp', { tabbed: 'one-page' }).find((s) => s.key === 'camera')?.href, CAMERA);
});

test('1 · Papic OFF: no Camera before the day or after it — on the day ruling 2\'s LOCKED camera stands', () => {
  for (const stage of ['save_the_date', 'rsvp', 'editorial'] as const) {
    assert.ok(!keys(barOn(stage, { hostAllowsCamera: false })).includes('camera'), `${stage}: a Camera with Papic off`);
  }
  const day = barOn('event', { hostAllowsCamera: false }).find((s) => s.key === 'camera');
  assert.equal(day?.state, 'locked', 'The Day: a closed camera is drawn LOCKED (ruling 2, unchanged)');
  // No address built → never a live Camera pointing nowhere, on any stage.
  for (const stage of ['save_the_date', 'rsvp', 'editorial'] as const) {
    assert.ok(!keys(barOn(stage, { destinations: { camera: null } })).includes('camera'), `${stage}: a Camera with no address`);
  }
});

test('1 · a stranger and a supplier: never a Camera, on any stage, Papic on or off', () => {
  const others = [{ kind: 'public' as const }, { kind: 'vendor' as const, kits: [] as VendorKit[] }];
  for (const viewer of others)
    for (const stage of STAGES)
      for (const hostAllowsCamera of [true, false]) {
        const bar = barOn(stage, { viewer, hostAllowsCamera });
        assert.ok(!keys(bar).includes('camera'), `${viewer.kind} on ${stage} (Papic ${hostAllowsCamera}): a Camera tab`);
      }
});

test('1 · early shooting keeps its six — and Papic on alone never makes a sixth', () => {
  assert.deepEqual(keys(barOn('rsvp', { earlyOwnShots: true, memoriesHasPhotos: true })), ['home', 'details', 'story', 'camera', 'gallery', 'me']);
  assert.equal(barOn('rsvp').length, 5);
});

test('2 · Memories opens once the event has a Papic shot or upload — on the day and after it, public chapter or not', () => {
  for (const stage of ['event', 'editorial'] as const) {
    const with1 = barOn(stage, { memoriesHasPhotos: true });
    const m = with1.find((s) => s.key === 'gallery');
    assert.ok(m, `${stage}: the event has photos and the guest has no Memories`);
    assert.equal(m.label, 'Memories', 'NAMING LOCK — never "Photos"');
    assert.equal(m.state, 'live');
    // Not known (not asked / refused) → the rules as before: no public chapter, no guest Memories.
    assert.ok(!keys(barOn(stage)).includes('gallery'), `${stage}: an unknown count opened Memories`);
    assert.ok(!keys(barOn(stage, { memoriesHasPhotos: null })).includes('gallery'), `${stage}: a refused count opened Memories`);
  }
  // 🔒 A stranger is unchanged by the count: the day's wall is not theirs, after the day only a public chapter.
  assert.ok(!keys(barOn('event', { viewer: { kind: 'public' }, memoriesHasPhotos: true })).includes('gallery'));
  assert.ok(!keys(barOn('editorial', { viewer: { kind: 'public' }, memoriesHasPhotos: true })).includes('gallery'));
});

test('2 · NO Papic photo, nothing else drawn there → NO Memories tab, for anyone, on any stage', () => {
  for (const stage of STAGES)
    for (const viewer of [{ kind: 'guest' as const }, { kind: 'couple' as const }]) {
      const bar = barOn(stage, { viewer, memoriesHasPhotos: false, earlyOwnShots: true });
      assert.ok(!keys(bar).includes('gallery'), `${viewer.kind} on ${stage}: an empty Memories tab`);
    }
  // …but a page that already DRAWS photographs there (the day's wall, a recap's photo run) keeps its tab.
  assert.ok(keys(barOn('event', { memoriesHasPhotos: false, anyChapterPublic: true })).includes('gallery'));
  assert.ok(keys(barOn('editorial', { memoriesHasPhotos: false, anyChapterPublic: true })).includes('gallery'));
});

test('3 · the page hands BOTH bars the one count — grid-filtered, never asked for a stranger', () => {
  assert.match(BODY, /import \{ countGalleryFrames \} from '@\/lib\/papic-gallery';/);
  assert.match(BODY, /const memoriesFrames = memoriesAsked \? await countGalleryFrames\(createAdminClient\(\), event\.event_id\) : null;/);
  assert.match(BODY, /const memoriesHasPhotos = memoriesFrames === null \? null : memoriesFrames > 0;/, 'a refused count must stay "not known"');
  const ask = BODY.slice(BODY.indexOf('const memoriesAsked ='), BODY.indexOf('const memoriesFrames ='));
  assert.ok(ask.length > 0, 'the ask is gone');
  assert.doesNotMatch(ask, /anonymous|public/, 'a stranger must never ask the count');
  assert.match(ask, /identity\.kind === 'guest' && identity\.earlyOwnShots/);
  assert.match(ask, /navPhase !== 'before' && !galleryAlreadyDrawn/);
  assert.equal(BODY.match(/^\s*memoriesHasPhotos,$/gm)?.length, 2, 'the anonymous (couple / canvas) AND the guest bar are told');
  // The same address as the camera button — the guest bar's one camera destination.
  assert.match(BODY, /camera: guestCameraHref,/);
});

test('3 · the day\'s consent card still mounts only where the stage LISTS the Camera — never on the Invitation', () => {
  assert.match(BODY, /papicGuest && STAGE_BAR\[pageStage\]\.slots\.includes\('camera'\)/);
  for (const stage of ['save_the_date', 'rsvp'] as const) {
    assert.ok(!(STAGE_BAR[stage].slots as readonly string[]).includes('camera'), `${stage} lists the Camera — the inline camera would mount there`);
  }
});

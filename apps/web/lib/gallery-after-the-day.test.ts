/**
 * THE GALLERY TAB MUST COME BACK AFTER THE WEDDING.
 *
 * ── The defect this suite exists to hold shut ───────────────────────────────
 * A guest opens the couple's page on the day, finds the photographs under
 * "Gallery", and comes back the following week to look at them again. The tab
 * was gone. Not empty — absent, with no explanation, on the one visit the page
 * is really FOR.
 *
 * Two independent causes, both silent:
 *
 *   1. `DayOfPhase` is a WINDOW, not a timeline. `post` lasts about two and a
 *      half days and then everything falls to `inactive` — the same value the
 *      page has six months BEFORE the wedding. The bar mapped `inactive` to
 *      "before", so from the Thursday after a Saturday wedding it believed the
 *      wedding had not happened yet: no Gallery slot, "Home" instead of
 *      "Recap", and the run-up tabs back on a memorial page.
 *
 *   2. Even with (1) fixed the tab had nowhere to land. The recap that replaces
 *      the site after the wedding carried no `#site-gallery` anchor at all, so
 *      the tap would have moved the page zero pixels.
 *
 * ── And the rule that keeps the fix honest ──────────────────────────────────
 * The tab is drawn ONLY when the recap really drew photographs. Not "the
 * feature exists", not "photos may appear later" — the site-nav resolver's
 * rule 3 is explicit that a gallery with nothing public is HIDDEN, because a
 * visible-but-empty one announces that photographs exist and are being
 * withheld. So the last test here is the one that matters most: the thing that
 * decides the TAB and the thing that places the ANCHOR must always give the
 * same answer, over every combination of inputs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { navPhaseFor, resolveSiteNav } from '@/app/[slug]/_lib/site-nav';
import {
  editorialPhotoBlocks,
  editorialShowsPhotos,
  editorialGalleryAnchorKey,
  type EditorialPhotoInput,
} from '@/app/[slug]/_components/editorial/gallery-anchor';
import {
  EDITORIAL_ORDERABLE_KEYS,
  resolveSectionOrder,
} from '@/app/[slug]/_components/editorial/editorial-order';

// ── 1 · Which moment the bar thinks it is ───────────────────────────────────

test('the week after the wedding is AFTER, not before', () => {
  // The recap body is what the page is actually rendering by then.
  assert.equal(navPhaseFor({ dayOfPhase: 'inactive', isRecapBody: true }), 'after');
});

test('a wedding that ended yesterday is AFTER even with website phases off', () => {
  // `post` stands on its own: the recap body additionally needs the phases
  // switch, and a wedding that has happened has happened either way.
  assert.equal(navPhaseFor({ dayOfPhase: 'post', isRecapBody: false }), 'after');
});

test('the day itself is still DAY, and the run-up is still BEFORE', () => {
  assert.equal(navPhaseFor({ dayOfPhase: 'live', isRecapBody: false }), 'day');
  assert.equal(navPhaseFor({ dayOfPhase: 'pre', isRecapBody: false }), 'before');
  // Months out: inactive, no recap → before. This is the value the old
  // one-input mapping returned for the week AFTER as well.
  assert.equal(navPhaseFor({ dayOfPhase: 'inactive', isRecapBody: false }), 'before');
  assert.equal(navPhaseFor({ dayOfPhase: null, isRecapBody: false }), 'before');
});

test('the live window wins over the recap body if they ever disagree', () => {
  assert.equal(navPhaseFor({ dayOfPhase: 'live', isRecapBody: true }), 'day');
});

// ── 2 · What the guest actually gets in the bar ─────────────────────────────

const guestNav = (opts: { phase: 'before' | 'day' | 'after'; galleryPresent: boolean }) =>
  resolveSiteNav({
    viewer: { kind: 'guest' },
    phase: opts.phase,
    hostAllowsCamera: true,
    anyChapterPublic: opts.galleryPresent,
    hasStory: true,
    hasDetails: true,
    liveBroadcast: false,
    destinations: { camera: '/papic/guest' },
  });

test('a guest who comes back a week later still has a Gallery tab', () => {
  const phase = navPhaseFor({ dayOfPhase: 'inactive', isRecapBody: true });
  const slots = guestNav({ phase, galleryPresent: true });
  const gallery = slots.find((s) => s.key === 'gallery');
  assert.ok(gallery, 'the Gallery slot must be drawn after the wedding');
  assert.equal(gallery.state, 'live');
  assert.equal(gallery.href, '#site-gallery');
  // And the page announces itself as what it now is.
  assert.equal(slots.find((s) => s.key === 'home')?.label, 'Recap');
});

test('no photographs are public → no Gallery tab, not a locked one', () => {
  const phase = navPhaseFor({ dayOfPhase: 'inactive', isRecapBody: true });
  const slots = guestNav({ phase, galleryPresent: false });
  assert.equal(
    slots.find((s) => s.key === 'gallery'),
    undefined,
    'an empty gallery is HIDDEN — a drawn-but-locked one announces withheld photos',
  );
});

// ── 3 · Where the tab lands on the recap ────────────────────────────────────

const NOTHING: EditorialPhotoInput = {
  sections: null,
  dayChapters: 0,
  essayPhotos: 0,
  galleryPhotos: 0,
  photoWallActive: false,
  photoWallPhotos: 0,
};

const anchorFor = (input: EditorialPhotoInput, saved?: string[] | null) =>
  editorialGalleryAnchorKey(editorialPhotoBlocks(input), resolveSectionOrder(saved));

test('a recap with prose and no pictures offers no gallery landing', () => {
  assert.equal(anchorFor(NOTHING), null);
  assert.equal(editorialShowsPhotos(editorialPhotoBlocks(NOTHING)), false);
});

test('the anchor lands on the first photo block in the canonical order', () => {
  // Chapters come before "From the Day" by default.
  assert.equal(anchorFor({ ...NOTHING, dayChapters: 4, galleryPhotos: 9 }), 'chapters');
  // With no chapters it falls to the shared gallery, then to the photo wall.
  assert.equal(anchorFor({ ...NOTHING, galleryPhotos: 9 }), 'gallery');
  assert.equal(
    anchorFor({ ...NOTHING, photoWallActive: true, photoWallPhotos: 30 }),
    'liveWall',
  );
});

test("the anchor follows the couple's own saved section order", () => {
  const input: EditorialPhotoInput = {
    ...NOTHING,
    dayChapters: 4,
    galleryPhotos: 9,
    photoWallActive: true,
    photoWallPhotos: 30,
  };
  assert.equal(anchorFor(input), 'chapters');
  assert.equal(anchorFor(input, ['liveWall', 'gallery']), 'liveWall');
  assert.equal(anchorFor(input, ['gallery']), 'gallery');
});

test('a photo block the couple switched off is not a landing', () => {
  // One toggle (`gallery`) governs BOTH the chapters strip and "From the Day".
  assert.equal(
    anchorFor({ ...NOTHING, sections: { gallery: false }, dayChapters: 4, galleryPhotos: 9 }),
    null,
  );
  assert.equal(
    anchorFor({
      ...NOTHING,
      sections: { liveWall: false },
      photoWallActive: true,
      photoWallPhotos: 30,
    }),
    null,
  );
  // An unset key means ON — the samples omit `sections` entirely.
  assert.equal(anchorFor({ ...NOTHING, sections: {}, galleryPhotos: 1 }), 'gallery');
});

test('the photo wall needs the SKU, not just the photos', () => {
  assert.equal(anchorFor({ ...NOTHING, photoWallActive: false, photoWallPhotos: 30 }), null);
});

// ── 4 · The drift guard: the tab and the anchor are one answer ──────────────

test('a drawn Gallery tab always has somewhere to land, over every combination', () => {
  const bools = [false, true];
  const counts = [0, 3];
  const orders: Array<string[] | null> = [
    null,
    ['liveWall', 'gallery', 'chapters'],
    ['gallery'],
    // Junk + locked-close keys, which resolveSectionOrder drops.
    ['fromTheCouple', 'nonsense'],
  ];
  let combos = 0;
  for (const galleryOn of bools) {
    for (const wallOn of bools) {
      for (const dayChapters of counts) {
        for (const essayPhotos of counts) {
          for (const galleryPhotos of counts) {
            for (const photoWallActive of bools) {
              for (const photoWallPhotos of counts) {
                for (const saved of orders) {
                  const input: EditorialPhotoInput = {
                    sections: { gallery: galleryOn, liveWall: wallOn },
                    dayChapters,
                    essayPhotos,
                    galleryPhotos,
                    photoWallActive,
                    photoWallPhotos,
                  };
                  const blocks = editorialPhotoBlocks(input);
                  const tabDrawn = editorialShowsPhotos(blocks);
                  const landing = editorialGalleryAnchorKey(blocks, resolveSectionOrder(saved));
                  assert.equal(
                    tabDrawn,
                    landing !== null,
                    `tab/anchor disagree for ${JSON.stringify({ input, saved })}`,
                  );
                  combos += 1;
                }
              }
            }
          }
        }
      }
    }
  }
  assert.ok(combos > 500, 'the sweep should be broad enough to be worth running');
});

test('every photo key the anchor can return is a real orderable section', () => {
  for (const key of ['chapters', 'gallery', 'liveWall'] as const) {
    assert.ok(
      EDITORIAL_ORDERABLE_KEYS.includes(key),
      `${key} must stay in the recap's reorderable run or the anchor can never be reached`,
    );
  }
});

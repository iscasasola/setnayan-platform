## 2026-10-10 · feat(maker): Photos of you gets Animate — and only Animate

Owner's ruling (2026-10-10, answer 11, verbatim): *"animate only"*. The earlier build stopped on this block because
its real root is the gallery's dark card and a Background would have left its light words unreadable; the ruling
settles it — no Background, no Style change, no re-inking.

**Photos of you** (`f:photos_of_you`)

- The motion is kept against each guest's REAL gallery — `PhotosOfYouGallery`
  (`app/[slug]/_components/photos-of-you-gallery.tsx`), ONE root (`<section aria-label="Photos of you" class="sn-gal">`),
  mounted once by `app/[slug]/_components/site-body.tsx`. That one mount draws it on The Day and after it (Post
  Event), so both stages are the same root. The block's hidden mark rides with the gallery, right before that root,
  and is served only when a motion is kept: a guest's page with none is unchanged, byte for byte
  (`lib/site-body-fixture.golden.html` is not regenerated).
- Animate — the shipped block Animate, the same rows (`BlockAnimateRows`: Build in · Action · Build out, Plays, Delay,
  the same ▶). No new control, no new words. The Maker's sample of the block (The Day's canvas) stands behind the
  same mark, so what is picked there is drawn by the rules a guest gets.
- **No Background.** The block joins `BLOCK_LOOK_BLOCKS` as the one block that only moves (`BLOCK_MOTION_ONLY`): the
  reader refuses a stored `g` for it in every spelling, the save carries none on, no ground rule is written, and the
  Background rows cannot be handed it (their type is the ground blocks' alone). In the toolbar its Background stays
  grey exactly as a shipped unavailable tab is (`aria-disabled`, and a tap answers the part's own shipped line —
  "Background has nothing to change on this part."). It no longer answers "This is a sample": `BLOCK_SAMPLE_WHY` lists
  three (Announcements · Live hub · What to wear).
- Reduced motion: unchanged from the other blocks — every motion rule is inside the Event Hub's two gates
  (`@supports (animation-timeline: view())` and `prefers-reduced-motion: no-preference`), so a guest who asks for
  less motion gets the block at rest.
- 🖼 **One thing this block has that the others do not: it opens a photo over the whole screen from INSIDE its own
  root** (`GalleryLightbox`: `fixed inset-0`, its card `aria-modal`). An element whose position is being animated
  becomes the box its `fixed` children are measured from. Measured in Chromium at 375 × 812 with the page's own
  keyframes and the rules this build writes: with the Action (Drift), or with "Follows the scroll", the opened photo's
  backdrop was the CARD (335 × 300), not the screen. So while something modal is open in the block, what keeps moving
  stands still (two more rules, written only for this block and only when a motion has a Drift or follows the scroll;
  the backdrop then measured 375 × 812 in every case). A timed Build in is left in the list on purpose — it has
  ended, and taking it out would play it again each time a photo is closed (same measurement: only Drift starts again).
- Nothing added to the Maker's first load: `lib/block-looks.ts` and the toolbar are fetched on demand;
  `lib/maker-parts.ts` and `lib/hub-draft.ts` are not edited. No migration (`style_preferences` is jsonb).

Guards: `apps/web/lib/a-sample-block-look-reaches-the-real-page.test.ts` draws the REAL guest page for both moments
(The Day · Post Event) and three states of the gallery (two photos · none yet · the read failed): nothing kept — or a
background alone — is the same bytes; a motion kept adds exactly the mark right before the gallery's root and the one
style, and not one other byte; the root is a chapter's own child at both moments (so the page's observer starts a
timed Build in for a guest). `apps/web/lib/a-fixed-block-has-its-own-motion.test.ts` holds the list, the refusal of a
ground, the while-open rules, the mount and the toolbar; `apps/web/lib/a-fixed-block-has-its-own-background.test.ts`
has four pins re-aimed, each with its reason. Eleven sabotages seen red, each restored.

Not in this change: the Maker's Post Event canvas draws no sample of Photos of you (`MAKER_DAY_PARTS` files it on The
Day only), so there is nothing to tap there — the motion is picked on The Day and reaches the same block after the day.

SPEC IMPACT: new key `photos_of_you` under `events.style_preferences.block_looks` — `{ motion? }` only (a stored `g`
is refused; no migration). `BLOCK_SAMPLE_WHY` now lists three samples.

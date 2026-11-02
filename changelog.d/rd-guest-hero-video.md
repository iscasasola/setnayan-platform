## 2026-10-02 · fix(event-hub): the Main background clip now plays for guests, not only for the host

Audit 2026-10-02 (Batch F1 item 4): the couple's Main background clip ("behind every scene") played for the host in the Maker while every guest saw its still. The owner had already ruled on 2026-09-29 ("make it move") that a couple's clip plays for guests. The scene clips were opened, but the Main background still went through the closed masthead switch (`GUEST_HERO_VIDEO_PLAYBACK`), and it did so in two places: the gate that `mainGroundLayerFor` passed in, and `hero.guestVideoRef` for the default "follows the hero" source.

- `resolveMainGround` (`lib/hub-canvas.ts`) now gates both sources (the couple's own clip and the hero clip it follows) through the one `guestClipGate` passed in.
- `mainGroundLayerFor` passes `mainGroundClipRefForGuests` (`lib/guest-hero-video.ts`). It is the scene-clip kill switch `GUEST_SCENE_CLIP_PLAYBACK`, a code constant that is ON. Closing it puts every scene clip and the Main background back on their stills.
- `MainGround` now draws its clip with the shipped `SceneClip` loop instead of a raw `<video autoPlay>`. The clip is muted, plays inline and loops, with no controls. It plays only while on screen and while the tab is in front. It never plays under reduced motion or Save-Data, and it stays invisible until its first `playing` event. The still beneath it is the first paint and stays whenever the clip can't play (for example iOS Low Power Mode or a dead link). `SceneClip` gains the Save-Data and background-tab rules for every loop, plus an opt-in `revealOnPlay`.
- Unchanged: `GUEST_HERO_VIDEO_PLAYBACK` stays closed for the masthead, the editorial site and /realstories. /realstories shows a couple to strangers, which the owner's ruling about guests did not cover. The masthead draws the still for the host too.

Cost: a clip is at most 15 s and is compressed in the browser before upload (about 3–4 MB). It is served by a presigned URL straight from R2, so there is no egress charge and nothing goes through Vercel.

Tests: new `lib/the-main-background-moves-for-guests.test.ts` (5 cases). Sabotage 1 restored `hero.guestVideoRef` in `resolveMainGround` and failed 2 of 5. Sabotage 2 set `revealOnPlay={false}` and failed the render case.

SPEC IMPACT: None

## 2026-09-25 · feat(event-hub): scenes — 25 templates, Auto and hold cross-fade, snap grid

Event Hub Maker **Phase 5** (`EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` § Phase 5). Every scene a
couple adds now starts from one of the owner's **25 templates** (five families, a desktop AND a
phone arrangement each, a default effect each), and **Auto-scroll finally plays** on the guest
page. No migration, no new page, **zero new server-action exports**.

- **The 25** — `lib/scene-templates.ts` (pure): ids 1–25, family, slot counts, the four built on
  shipped parts (10 names · 11 special message · 12 countdown · 16 monogram · 24 milestones), the
  default preset + transition read off the prototype's own table, and each tile's desktop/phone
  drawing read off `prototypes/event_hub_editor_FINAL_2026-09-24.html`.
- **The contract** — `HubSectionCanvas` gains `template`, `slots` (`{media?,kind?,head?,text?}`,
  pictures held to the public bucket by the same `hubMediaRef` fence), `free` (snap-off fractions,
  all-or-nothing), `stages` (per-stage order/mode) and `video` (`loop` | `tap` + `fullscreen` |
  `inplace`). `sanitizeHubCanvas` drops anything else. Slot pictures sign in the page's one pass.
- **The guest renderer** — `renderScene()` in `app/[slug]/_components/scene-template.tsx` (the API
  the Love Story builder uses for moments): one `<section>`, parts as direct children, the desktop
  arrangement only where the scene is given the width (`@container`), the phone one otherwise.
  Empty → `null`. Clips loop silently on screen; tap-to-play waits behind ▶ (`scene-clip.tsx`).
- **Auto-scroll** — `renderedTransition('auto', pro)` now renders `auto`. Consecutive Auto scenes
  form one run on one screen and hand over on the prototype's clock (4.5 s a scene, 1.2 s hand-off,
  Slow 1.4× · Fast 0.6×; in 15–75 %, out 25–85 %) — `autoRunTimings`, sampled for 0 blank instants
  at every speed. `hub-auto-run.tsx` arms it only after mount and never under reduced motion,
  times only scenes that drew something, pauses off-screen, stops for good on a touch, and has a
  Pause/Play. Without script / reduced motion / no scroll-timeline: the plain stacked page.
- **Hold cross-fade** (#5951) is unchanged and now shares runs with Auto: one scene, one run (first
  come wins).
- **Readable for everyone** — a scene on a flat colour takes the Phase 3 legibility answer
  (`lib/scene-legibility.ts` → `hubLegibility`) on the channel tokens its words are painted with.
  No entitlement read.
- **The editor** — "+ Add a scene" opens the 25 (no blank — owner), drawn as Desktop · Phone · Both,
  headed with the stage; a template scene gets `SceneSlotsPanel` (change template, pick photos /
  your video per slot, word blocks, clip playback). Writes: `addCustomSection` takes `template`;
  `saveCustomSection` gains intents `template` · `slot` · `video` (rules pure in
  `lib/scene-writes.ts`). Words + template free under the grandfather rule; media into a slot and
  non-default playback are Pro (`requireLookPro`).

**Deferred, honestly:** the snap-grid toggle and drag-to-place editor (the `free` contract and its
sanitizer ship; no UI control ships until the drag editor does — no dead ⊞); per-stage order UI
(`stages` contract only; D1 open); photo/clip-ground legibility sampling (colour grounds done;
photo grounds keep the frame's scrim); the Maker shell's ＋ / ⊞ (P1 #5967) still read "coming next"
until wired to `SceneTemplatePicker`; the Playwright blank-frame harness (the pure sampler + a live
browser measurement stand in).

SPEC IMPACT: None — implements the locked Phase 5 spec and the 2026-09-24 DECISION_LOG rows
(25 templates, hybrid hold, three transitions, snap grid, playback) without changing them.

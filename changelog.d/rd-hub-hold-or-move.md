## 2026-09-24 · feat(event-hub): Scroll · Scrub · Auto-scroll per section — scrub sections pin and truly cross-fade (Pro)

Owner, 2026-09-24: "hybrid perfect" on `prototypes/scenes_hold_crossfade_hybrid_2026-09-24.html`,
then "1. Scroll 2. Scrub 3. Auto-scroll (can set the speed)". Each Event Hub section (a "scene") now
carries a transition in its existing `invitation_widgets.config_json.canvas` (no migration). The
owner's model: "from one scene to another there is a transition" — so the value stored on scene N
is the transition FROM N TO N+1; the last scene's value is the tail and is ignored.

- **Contract** — `lib/hub-scenes.ts` (pure): closed sets `scroll | scrub | auto` and
  `autoSpeed: slow | normal | fast`; Scroll and Normal are absences; a speed survives only
  beside Auto; malformed → Scroll / Normal; the prototype's "hold"/"move" are accepted nowhere.
  `groupSceneRuns` joins scene N to N+1 when N's transition scrubs (a run always has ≥ 2 scenes); `nextTransition` is the write
  and says when it needs Pro. `sanitizeHubCanvas` reads the two keys.
- **Guest page** — `app/[slug]/_components/hub-scenes.tsx` wraps both dispatchers' output (guest
  and stranger trees). Runs pin inside one wrapper and un-pin together; each scrub section is
  sticky, one `svh` tall, driven by its own 170vh spacer's named `view-timeline`; in-run
  neighbours fade over entry 15–75% / exit 25–85% so they truly overlap; a one-segment-per-section
  progress mark. CSS only, no script. Byte-identical markup when no section scrubs or the event
  lacks Event Hub Pro. Fallback to the plain page under reduced motion or without
  `timeline-scope`/`animation-range` (a third gate inside the canvas's view()+reduced-motion gates).
  An empty scrub section drops out of its run (CSS). **Auto-scroll renders as Scroll** until the
  owner approves the auto prototype — pinned by a test.
- **Keyboard** — the scene keyframes animate `visibility`, so a fully faded scene is hidden
  (unfocusable) only at its faded end.
- **Editor** — "Into the next section: Scroll · Scrub · Auto-scroll" (+ Speed for Auto; the last row says it has no next) in the sections
  panel's "How it moves" block; Scrub/Auto locked without Pro with an unlock link.
  `setWidgetMotion` (extended, no new server export) refuses a free couple landing on Scrub/Auto;
  going back to Scroll is never gated.
- Measured on pages rendered from the real components + `globals.css` with the prototype's
  method: overlap 6–12/80 positions, blank 0, collide 0, stuck pin 0, scroll-back retraces
  exactly, focus never landed in a faded scene; reduced motion and no-support → nothing pins.

SPEC IMPACT: None — rulings already in DECISION_LOG (2026-09-24 hold/move rows).

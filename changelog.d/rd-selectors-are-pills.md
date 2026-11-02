## 2026-10-08 · feat(ui): segmented selectors are pills that slide — one shared template

Owner, verbatim (2026-10-08, DECISION_LOG "SELECTORS ARE PILLS THAT SLIDE"),
selecting the Maker's Stages | Studio, its tool group and its
Look | Background | Arrange: *"i like this pill type instead of the rounded edges
selector"* · *"and make them animate"* · *"apply the same pill selector"* ·
*"adjust all pill selectors to this if possible"*. Rule:
`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E; template:
`INTERACTION_RULES.md` § 9.

- **The template — `app/_components/pill-selector.tsx`** (+ its thumb,
  `pill-thumb.tsx`): a full pill track (3 px of padding, 44 px tall on a phone),
  each choice a pill inside it, and ONE thumb that travels to the choice picked
  and resizes to its label — transform and size only, 220 ms on the house ease,
  instant under "reduce motion". Buttons or links, 2–5 choices of unequal width,
  an icon-only variant, any fill of the caller's own, an opt-out for a row of
  toggles. No Maker import, no Maker token; no timer, no dependency.
- **First paint is already right.** Until the thumb has measured, the picked
  choice paints the pill itself; the thumb then takes over in place (laid with
  no transition — it never slides in from the left) and follows a pick and a
  resize. It loads after first paint: no measuring code in a first load.
- **Keys:** ← → (↑ ↓, Home, End) move focus between the choices and wrap;
  Enter and Space press, as buttons do. `aria` is as it was (a named group of
  pressed-or-not buttons; `aria-current="page"` for links).
- **Drawn through it today (the Maker):** `ISegmented` / `ISeg`
  (Stages | Studio, Look's Background · Elements · Music, and the inspectors'
  other section switches), `Phases` (Look | Background | Arrange ·
  Build in | Action | Build out) and the Stages tool group
  (Style · Text · Animate — the dark face now travels; the hairline beside the
  picked tool fades). The fills are the ones each had. Bold · Italic · Underline
  keeps the pill look and opts out of the thumb (several may be on).
- **The watch:** in the areas listed in `PILL_WATCH_SCOPE` (the Maker today) no
  file draws a segmented track by hand; two tracks older than the template are
  named on a baseline that only shrinks.

- **One colour, a bounce, a pulse, one speed** (owner, on the template gallery:
  *"pill selector should have a consistent color"* · *"Terracota is our color?
  and greyed out when off?"* · *"let's add a bit of bounce and a pulse to imitate
  it has been pressed"* · *"in between normal and slow motion"*): every pill
  selector is the terracotta (`mulberry`, #C24E25) with white words when on and
  grey words when off — Look's white thumb and the tool group's ink thumb
  included; `tone` is accepted and ignored, `fill` is gone. The thumb lands with
  a small overshoot and pulses once on a pick (a dip in scale, one soft ring —
  scale and opacity only; never on mount, never on a resize, never under "reduce
  motion"). ONE speed for the family: `--sn-pill-dur` (460 ms) in `globals.css`,
  worn as `duration-sn-pill`.
- ⚠ Found on the way: with `tailwindcss-animate` loaded, an arbitrary
  `duration-[…ms]` class is ambiguous and Tailwind emits nothing for it (the
  thumb ran at the 150 ms default while its class said 220). The selector uses
  the named token; the other `duration-[…]` classes in the app are NOT touched
  here.

- **One press feel, one speed, one switch look** (owner, 2026-10-08: *"the
  animation when tapped on selector must feel the same on the rest when
  pressed"* · *"we want the whole app to be adaptive to the same feel"* · *"the
  only part that does not follow our rules is their customized event hub"* ·
  *"0.7 seconds"* · *"switch is teracota or greyed out"*):
  - the family's speed is now `--sn-pill-dur: 700ms`;
  - the UNIVERSAL press (every button, every `.sn-press` card — the rule that
    already existed in `globals.css` `@layer base`) dips to .93 under the finger
    and springs back with a small overshoot at that speed. Scale only, CSS only.
    It covers every Setnayan surface — the couple's and supplier's dashboards,
    onboarding, public pages, **and admin** — by EXCLUSION: nothing inside the
    guest shell (`.sn-editorial`, the root `GuestLookScope` puts around every
    guest page) is touched, so the couple's customised Event Hub keeps its press
    and its colours;
  - the ring is the opt-in `sn-press-ring` (worn by the dropdown's button; the
    pill thumb has its own). NOT worn by the ⓘ (its `::after` is already its
    finger halo) or by a Style card (its frame clips) — said, not skipped
    silently;
  - the Maker's four shared switches — `StudioSwitch` (`STUDIO_SWITCH_TRACK`),
    `PanelSwitch`, `Toggle`, the schedule's `Switch` — wear ONE look,
    `.sn-switch`: grey when off, the terracotta when on (no green), the knob
    landing with the spring; a press rings the track.
  - **Switches NOT changed here (hand-made, for the sweep lane — 29 files):**
    `admin/website/widget-list.tsx`
    `dashboard/(account)/profile/_components/haptics-toggle.tsx`
    `dashboard/(account)/profile/page.tsx`
    `dashboard/[eventId]/studio/papic/recap/_components/recap-social-feature-toggle.tsx`
    `dashboard/[eventId]/studio/papic/_components/pool-gallery-toggle.tsx`
    `dashboard/[eventId]/studio/papic/_components/live-wall-controls.tsx`
    `dashboard/[eventId]/studio/save-the-date/_components/StdBuilderClient.tsx`
    `dashboard/[eventId]/studio/mood-board/_components/gallery-picker.tsx`
    `dashboard/[eventId]/studio/mood-board/_components/dress-code-fields.tsx`
    `dashboard/[eventId]/vendors/[vendorId]/workspace/_components/colour-access-card.tsx`
    `dashboard/[eventId]/launch/_components/maker-logo.tsx`
    `dashboard/[eventId]/launch/_components/plan-myself.tsx`
    `dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx`
    `dashboard/[eventId]/launch/_components/maker-reveal.tsx`
    `dashboard/[eventId]/website/editor/_components/post-event-scene-panel.tsx`
    `dashboard/[eventId]/website/editor/_components/editor-shell.tsx`
    `dashboard/[eventId]/details/_components/people-with-access.tsx`
    `dashboard/[eventId]/live/_components/flash-auto-wall-toggle.tsx`
    `dashboard/[eventId]/seating/_components/seating-editor.tsx`
    `dashboard/[eventId]/budget/_components/share-budget-band-toggle.tsx`
    `_components/home/plan3d-demo-overlay.tsx`
    `_components/push-toggle.tsx`
    `tour/vendors/_components/tour-shortlist.tsx`
    `vendor-dashboard/shop/_components/website-editor.tsx`
    `vendor-dashboard/shop/_components/autoreply-card.tsx`
    `vendor-dashboard/shop/_components/voice-match-card.tsx`
    `vendor-dashboard/services/_components/services-manager.tsx`
    `[slug]/_components/rsvp-canvas-bridge.tsx`
    `onboarding/_shared/services-step.tsx`
- **Found, NOT fixed — dead `duration-[…]` classes** (Tailwind emits nothing for
  an arbitrary `duration-[…]` while `tailwindcss-animate` is loaded, so each of
  these has always run at its transition's 150 ms default; changing them would
  change timings across the app unseen):
    1 app/[slug]/_components/reveal/reveal-templates.ts duration-[1100ms]
    3 app/dashboard/[eventId]/launch/_components/maker-lower-third.tsx duration-[240ms]
    1 app/dashboard/[eventId]/launch/_components/maker-lower-third.tsx duration-[260ms]
    1 app/dashboard/[eventId]/launch/_components/stage-item-menu.tsx duration-[220ms]

Guards: `lib/selectors-are-pills-that-slide.test.ts` (8 tests; the thumb is RUN
against a stand-in track) and `lib/the-press-feels-the-same-everywhere.test.ts`
(5 tests). 53 sabotages seen red.

SPEC IMPACT: None beyond the rule and the template above.

## 2026-09-25 · feat(event-hub): Logo · Hero · Reveal — made once, used everywhere (Maker Phase 6)

The left group of the Event Hub Maker bar now opens three real workspaces instead of "coming next"
notes. Each one edits a whole-event thing ONCE, and **every control writes to the draft, never live**:
guests see nothing until Apply, and Apply is where Event Hub Pro is checked (try then pay).

**Hero — one hero for Save the Date, Invitation, On the Day and the poster.**
- `lib/event-hero.ts` — `resolveHero(event)` is the ONE answer to "what is this event's hero":
  `{ kind: 'photo' | 'card', photoRef, videoRef, guestVideoRef }` (+ `HERO_EVENT_COLUMNS`,
  `HERO_STAGES`). The photo is held to the public media bucket (`siteMediaServeRef`); the guest clip is
  null while `GUEST_HERO_VIDEO_PLAYBACK` is closed. **Prints & Tickets (Phase 9) reads its hero here.**
- The Event Hub's hero (`loadMedia`), the home board's poster, the celebration poster sheet, the
  celebration card and the Post Event cover (`story-cover.ts`) all ask `resolveHero` — held by
  `lib/every-hero-reads-the-one-resolver.test.ts` (per file, with a detector that is proven to fire).
- The Maker's Hero workspace shows the poster (the same `resolveEventPoster` the home board uses, fed
  the drafted hero) beside the photo-or-card choice; upload and "Use the invitation card instead" post
  to `uploadHeroPhoto` / `removeHeroPhoto`, which gained a draft door (`draftHero`). The hero scene's
  Content tab opens the same workspace.
- `landing_page_hero_image_url` joins the draft (public bucket only); Apply holds it to this event's own
  photos (`not_your_photo`) and stamps `landing_page_hero_image_uploaded_at` as the live writer does.

**Reveal — chosen once; every opening Pro, "No reveal" free; each theme dresses its opening.**
- `std_reveal_template` joins the draft. Apply's gate is `revealTemplateWriteAllowed`: an opening needs
  Pro, "No reveal" and clearing never do (both answers tested).
- `lib/reveal-materials.ts` — paper, liner, door, seal, veil and petal colours for the nine dressed
  themes (Classic is the shipped look). The envelope/doors already read `--color-cream/terracotta/
  mulberry` at mount (WebGL `cssColor` and the CSS path alike), so dressing is a token swap on the
  opening's own box — one look in both renderers. **The veil is untouched** (guarded).
- With nothing chosen, the Event Hub now plays the THEME's opening (the invite door already did).
- The host's own Maker preview (`editorMode` only) plays a drafted opening before Pro is bought
  (`hostTrial`); a guest render never sets it, and a free couple's guest page still mounts no reveal.
- `reveal-preview-card.tsx` (the Save-the-Date studio) no longer fails silently: an `{ok:false}` or a
  thrown save renders a line (`revealSaveFailure`).

**Logo — the Logo Maker inside the Maker, and it never loses work.**
- "Design your logo" opens the same `VectorStudio` as a sheet over the Maker ("Back to scenes"). It
  AUTOSAVES to the draft (`monogram_custom_svg` + `monogram_studio_config`, sanitised by the studio's own
  `sanitizeStudioSvg` / `sanitizeStudioConfig`) after a pause, on Back/Esc, when the tab is hidden and on
  leaving. The status ("Saved to your draft · 9:41") is always on screen. Letters, frame and ink are free.
- Upload stays reachable ("Upload it instead" → the Monogram Maker's upload side).

**The Maker bar reaches Logo again (owner on the live Maker: "cannot see logo anymore even if i scroll").**
The scrolling bar was `justify-content: center`, which pushes overflow off the LEFT edge where no scroll
reaches. It now centres with `margin-inline: auto` on its first and last groups (collapses on overflow),
fades an edge only while there is more to scroll, scrolls the active item into view, and
`the-maker-bar-is-the-final-bar.test.ts` fails on any `justify-center` on the bar (sabotage-checked).
The Maker's own form guard (`every-maker-form-drafts-or-says-so`) now reads the three made-once files,
and `uploadHeroPhoto` / `removeHeroPhoto` join its draft doors.

**One highlight in the bar** (owner: "there should also be only one highlighted here. stage must leave" ·
"allow other to be highlighted"). An open tool (Logo · Hero · Reveal · Love Story) is THE highlighted
item and the stage pill clears; picking a stage closes the tool. The live stage keeps only its dot. A
render test asserts exactly one pressed item in every state.

**⋯ holds settings only** (owner: "why is this here when we already have the actual editor"). The old
controller block (the stage + "Right now" + the address form + the parts) no longer renders in the
Maker's ⋯ sheet: who can view, which version guests see, open browsing and go live remain (portalled in
by the work area). Where each moved: the stage preview → the canvas itself; **View as → a compact switch
in the toolbar** that re-points the canvas at each role's own server-gated door (a role with no door is
listed, disabled); the address → the Details panel (P9's build). The controller still renders for
viewers without the editor (coordinators).

**Reset never erases the made-once group** — `hubResetPatch('all')` clears `HUB_RESET_EVENT_COLUMNS`
(`rsvp_backdrop`) only.

**Server actions: +0** (the one draft action and the existing writers). **Pages: +0. Migrations: 0.**
`/dashboard/[eventId]/launch?tool=hero|reveal|logo` opens a workspace (a save lands back on it).

**Deferred, and why:** the `std_*` fold + its migration (the Save-the-Date film still reads its own
`std_background`/`std_media`; the owner moved the Save the Date to tomorrow) · the improved opening's
motion work (#1 self-paced swipe, #2 continuous hand-off, #3 seal break, #7 preload, #8/#9) and the five
signature reveals (Phase 10) · the hero VIDEO in the Hero workspace (guest playback is closed, SEC-6) ·
retiring `/monogram` (Phase 8).

SPEC IMPACT: None to a locked decision — this implements DECISION_LOG 2026-09-24/25 ("one hero",
"every reveal is Pro", "each theme gets its own reveal", "the Logo Maker lives in the Maker") and
FINAL_PLAN_INPUTS 24/25/29. Deviation recorded here for the owner: with no reveal chosen, a Pro couple's
Event Hub now plays their theme's opening (previously the Reveal Studio house default); Classic keeps the
house default.

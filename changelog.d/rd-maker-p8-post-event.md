## 2026-09-25 · feat(event-hub): Post Event as scenes, written for them — and the open-up family (Maker Phase 8)

After the day, the Event Hub Maker writes Post Event on its own from what happened, one scene per part
of the story (`prototypes/post_event_auto_story_2026-09-25.html`). Nothing is typed; every scene says
what filled it. The written story is free (owner 2026-09-25).

**The scenes — `lib/post-event-scenes.ts` (pure, tested).**
- `compilePostEventScenes(sources)` builds the prototype's scenes with its templates: Cover (4) · Before
  the day (24) · By the Numbers (12) · one chapter per run-of-show bucket (a clip leads with 5, photos
  alternate 1 / 2) · From the Day gallery (21) · Watch the Film (14) · Were you there? · What They
  Whispered (23) · What We Asked (25) · Letters to the Editor (22) · From Your Vendors (20) · Live
  Photo Wall (19) · What They Said (23) · Powered by Setnayan (8) · Vendors We Loved (17) · From the
  couple (11, pinned) · Their Song (8, pinned last) · What comes next (10, optional). The fixture day
  compiles to the prototype's 25 plus its 2 skipped.
- 🔒 **A source with nothing is a SKIPPED scene with its reason, never an empty one** — guests never
  meet it; the Maker lists it as skipped. No captures → ONE skipped chapters row, not ten blanks.
- **One source of truth for shown/hidden and order.** Scenes do not store their own eye or position:
  `draftToScenes` reads the story's shipped `sections` / `sectionOrder` (the keys the guest page and the
  story desk already use), so the Maker and the desk cannot disagree. The stored `draft_json.scenes`
  holds only what is new — template, source, status — plus `scenesGeneratedAt`.
- **The 14 existing editorials convert without a rewrite**: `withCompiledScenes` adds exactly two keys.
  Golden test: the published editorial's shape (read from prod, keys only) keeps its headline and lead
  byte for byte.

**Written lazily, stamped — `lib/post-event-compile.server.ts`.** The repo has no scheduler, by design:
the story is compiled on the couple's first open of the Maker after the day and stamped
`scenesGeneratedAt`, then again only when a skipped scene's source gains content. A guest's read never
writes. The write carries `draft_json` only — `lib/the-post-event-compile-cannot-publish.test.ts`
proves it cannot touch `status` / consent (sabotage-probed red), and Publish to Discover keeps
`story:publish_needs_consent`.

**The Maker's Post Event navigator lists the scenes — through `lib/maker-scene-list.ts`** (#5981's one
list, not a parallel one). After the day, `makerStageList` puts the compiled scenes where the single
"The story after the day" tile stood (`kind: 'post-event'`), in the page's order: filled ones numbered,
skipped / hidden / optional ones listed with a badge and their reason and no number. The cover tile
wears the hero. A tile scrolls the canvas to its scene through the same `[data-maker-section]` marker
contract (`p:<scene>`, stamped by `EditorialContent` only when `isEditorCanvas && editorBridge`, so a
guest's HTML is unchanged); a tap on the canvas selects the tile back. The inspector says the template,
what filled it or why it is skipped, and points to the story workroom for show / hide / order. The
navigator heads the stage with "Auto · written <date>", or says plainly when the scenes could not be read.
`the-post-event-navigator-lists-its-scenes.test.ts` holds it. In the canvas, an open-up scene's trigger
is let through by the editor bridge (it navigates nowhere), so the couple can open it where they edit it.

**The open-up family — `app/[slug]/_components/editorial/open-up-layer.tsx`.** The gallery, the film
(the livestream, if they had one), Were you there? and the wishes preview in the flow (collage · still
with ▶ · three short blocks) and open FULL SCREEN over the same scroll position: portalled to `<body>`,
focus trapped (`useModalA11y`), Esc or ✕ returns focus to the preview, and a URL hash (`#open-gallery`
…) so Back closes it. The bodies are the shipped parts. Nothing to sell, so unchanged in the store shell.
Browser-checked on a local harness (the sample story — a local server has no service key, so a real
event's admin-read story cannot render there): the real `MakerShell` + `MakerWork` listed 17 numbered
scenes + 4 skipped + 1 optional with the cover from the hero; the Gallery tile scrolled the canvas to
the collage; tapping it in the canvas opened it full screen ("Everything" for the couple); Back returned
the canvas to the same pixel (scrollY 14515.5 → 14515.5). On the story page: Esc returned focus to the
preview at the same scroll position, Tab stayed inside the layer, a guest read "Yours · Everyone’s"
(Yours explaining the Papic link), a stranger "Shared with everyone"; no horizontal scroll at 375 px.
- **The gallery's tabs follow the reader** (owner 2026-09-25): a guest reads **Yours / Everyone's**
  (Yours = their own signed Papic session's photos; without one they are told how, never shown an
  empty grid), a stranger reads **Shared with everyone**, the couple reads **Everything**. Every photo
  has already passed `redactStoryLayers` for that viewer — the tabs choose, they never widen.

**The cover starts from the hero.** `loadEditorialData`'s cover ladder now uses `resolveHero` BEFORE the
software's auto-picked capture: the couple's own post-event choice (upload, curated capture) still
wins; a capture the software picked no longer outranks the hero every stage and the poster show.
⚠ This can change the cover of a live story that has both a hero and Papic captures.

**First-visit hint:** `customer_post_event_v1` in `TOURS`, mounted with the shipped `MiniTour` inside the
Maker after the day — never on the Maker's very first visit (its own welcome goes first). Its Pro slide
is `sells`, so the store shell drops it.

**Deferred, said plainly:**
- The retire step (the `/story` rail, `website/editor/page.tsx`, −2 pages) is **not done**:
  `lint-port-no-lost-controls`' baseline gives `/dashboard/[eventId]/story` 43 blocks and 8 doors the
  Maker does not carry (the desk, Make it yours, the cover step, What's next …), and the Maker still
  renders `website/editor/page.tsx` as its work area. Showing, hiding and reordering Post Event scenes
  stays in the story workroom until those move.
- The guest page draws each scene with its shipped block; a per-scene template SWAP (Pro) is recorded
  on the scene but not yet rendered through `renderScene`.
- The "Editorial PRO" reorder copy (D4) is untouched — owner call pending.

SPEC IMPACT: None — builds `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 8 as ruled; deviations
(no stored per-scene mode/order; retire deferred) are listed above for the controller.

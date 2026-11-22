## 2026-11-22 · feat(memories): Memories goes dark — the Papic block is the one glow; the five sheets' buttons on the house button

The owner approved the Memories drawing on 20 Nov (`prototypes/memories_redesign_2026-11-20/memories_redesign_2026-11-20_fable.html`, DECISION_LOG "EVENT › MEMORIES — PAPIC ON TOP + FIVE OPENED PAGES, APPROVED"). Its light half shipped the same day (854f8ba69): Papic on top, settings rising full screen, one keepsake sheet shape, Thank You carrying the film. Re-measured today against the drawing at 375 px, frame by frame. That half matches and is not rebuilt. What was still missing was the drawing's dark half. The ruling defers dark to `DARK_MODE_STANDARD_2026-11-20.md`, but Memories was not on the ready-list, so it painted light for a host who had picked Dark.

- **`/dashboard/*/memories$` joins `DARK_READY`** (`lib/appearance.ts`): exactly the tab. Its sub-pages (Thank-You Video, Download all) stay Light until they are walked.
  - Rendered dark at 375 px: the Papic block, the keepsake row and its four sheets, the filter row, the grid, the viewer, ⚙ and the Add more sheet.
  - Swept for light-only colours by reading the code: every file the risen Papic settings draw. The lab cannot render those without a database.
- **The Papic block is the top block** (standard §3), so it alone wears `--color-band-glow` over its frame fill. In Light the glow is `none`, so nothing changes there.
- **The four sheets' main buttons use the house button.** Magazine, Recap, Flash and Thank You now take their class from `actionButtonClass('brand', { main: true })` instead of a hand-typed `ab …` string. Typed sizes moved onto the type scale (`text-[15px]` → `text-sn-lg`, `text-[22px]` → `text-sn-3xl`). Pixel for pixel the same as before.

Guard: new `app/dashboard/[eventId]/memories/memories-goes-dark.test.ts`. It checks the tab is listed while its sub-pages are not, that the rendered block wears the glow exactly once, and that the files Memories draws type no light-only colour. All three halves were sabotaged on the real files and went red. `lib/appearance.test.ts` now names the entry too.

SPEC IMPACT: None. The drawing carries its dark tokens, and the 20 Nov ruling already sends dark to `DARK_MODE_STANDARD_2026-11-20.md`, whose §3 steps 1–5 are what this applies.

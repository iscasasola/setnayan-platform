# HANDOVER — rd/feature-shots-retake (2026-10-18)

Task (owner list item 3): pictures for the /features pages #6640 left without one + retake event-hub / logo-maker.

## Why #6640's builder "could not open the item at 375"
Not a 375 fault. The Studio pages (Logo, Mood Board & Dress Code, E-Gifts, Prints…) have NO URL in
`/dev/maker-lab?studio=1`: open the **Studio pages ▾** button (`aria-label^="Studio pages"`), then the row.
Print previews call `/api/hub-print/*` → 401 without a session → warning triangles; serve them from
`controller-2026-10-12/prints-previews/scripts/fixture-prints.ts` (run with `npx tsx` from apps/web, port 3542)
via Playwright `page.route`. The Maker canvas is an iframe with its OWN Next dev badge — hide `nextjs-portal`
in every frame. details-lab WITHOUT `shape=mj` is Claire & Indalecio (the owner's couple) — never use it.

## Capture scripts (scratchpad, not in repo)
`up.sh` (walk lane, port 3611, lab env, 54321 stub), `studio.mjs` (Maker/Studio steps), `probe.mjs`, `prod.mjs`
(live public pages, read-only). Frames: 375×792 @2x → 460×972 JPEG q78 mozjpeg.

## Done
event-hub-0 (retake) + event-hub-1, logo-maker, mood-board, dress-code, e-gifts, prints, papic, 3d-plan, real-stories.

## No picture, and why
- live-watch, patiktok, setnayan-ai, music-maker, groups: no lab draws them; the shipped screens need a sign-in
  (and public pages are marketing pages, not the tool). `/demo-capture/*` are hand-built mockups — not used.
- alaala: the lab draws stand-ins for the Post Event scenes, not the Memories wall.
- marketplace / compare: `/explore` needs the database; live it says "No supplier has opened a shop yet";
  compare needs saved suppliers.

## State
Commit + push after each step. Draft PR, label do-not-auto-merge, auto-merge disabled.

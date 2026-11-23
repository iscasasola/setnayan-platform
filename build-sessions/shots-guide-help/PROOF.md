# Guide & Help — proof (BUILD_RULES §4), 22 Nov 2026

Drawing: `Setnayan-specs/prototypes/guide_help_2026-11-20/index.html` (owner "Approved" 21 Nov, re-confirmed 22 Nov).
PR stacked on #7614. Shots at **390 px, light and dark**, from local `next dev` with **no database** (this cloud
session has no Supabase credentials and must not touch production).

## How the host's help was drawn without a sign-in
`/dev/help-lab` renders the real views (`HelpStart`, `HelpTopicView`, `HelpGuideView`, `BestAnswer`) over the real
help corpus, guides and tours, in the user account's help, with a sample event as `?refer=`. The ⓘ is on
`/dev/guests-lab?part=screen&spot=page`, which mounts the Guests tour as "seen, can replay", so Show me is drawn.
`/help/topics` (3b) is the live route, signed out (About Setnayan only).

| Drawing screen | Shot |
|---|---|
| 1 · Help | `1-help-*` (Start here · Topics + All 39 · Message us), `1b-message-us-sheet-*` (the row opens the shipped form) |
| 2 · Ask | `2-ask-*` ("paano mag add ng guest": Take me there · Full guide · Did this answer it?) |
| 3 · A topic | `3-topic-*` (Your guest list: Guides on top, an answer open in place); `3b-all-topics-*` |
| 4 · A guide | `4-guide-*` (Guide · Hosts, 4 steps · about 2 minutes, numbered steps, real app picture, Take me there at the thumb) |
| 5 · A guide, lower | `5-guide-lower-*` (Did this help? · Ask a question), `5b-guide-more-*` (⋯ › Report a problem) |
| 6 · The ⓘ sheet | `6-info-sheet-*` (Show me · Answers · Read the full guide); `6b-show-me-tour-*` (Show me pressed: the Guests tour runs) |

## Walked in a browser (Playwright, 390 px)
- ⓘ → sheet → **Show me** → the Guests spotlight tour starts ("List, Map and ⚙").
- **Message us** row → the Sheet with the form opens.
- Help's links: Start here → `/help/guides/<key>?refer=…`; Topics → `/help/topics/<key>?refer=…`; All 39 → `/help/topics?refer=…`.
- `/help/topics/nope` → **404**; `/help/guides/guests` signed out → **404** (a host guide is not in the public help);
  `/help/guides/nope` → 404; `/help/topics` and `/help/topics/about-setnayan` → 200.

## Differs from the drawing, said plainly
- **Practice** (the pill, the in-step frame, the ⓘ row) is not drawn: the practice-frame engine is paused plumbing.
- **Questions** on a guide are not drawn: there is no store yet (the drawing's own honest state).
- The guide's steps are its page's **tour** words, not the drawing's sample words ("Open Guests", "Type a name"): no new
  guide words while guide writing is paused (DECISION_LOG 2026-11-21).
- The ⓘ mark is the **house ⓘ** (InfoTip's, inside a 44 px glass round), not the drawing's peach disc: the one-ⓘ rule
  (`there-is-one-info-dot.test.ts`, owner 25 Oct).
- Topics shows **All 39**, the user account's real topic count (the drawing's sample said 14).
- The Ask's best answer for "paano mag add ng guest" is a Papic answer: #7614's ranker, not changed here.
- No desktop shot and no signed-in live shots (no database here).

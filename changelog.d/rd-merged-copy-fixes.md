## 2026-10-11 · fix(maker): the merged copy passes its own walk — the table and the canvas agree, both ways

Seven builders' branches were merged into one local review branch and a tester walked the MERGED copy at 375 px with
touch (`hub-walk/merged/REPORT.md`): 3 blockers · 16 wrong · 12 rough, most of them where two builders' work meets —
"What guests see" (a tick table) and the Maker's own Remove · ＋. This is the fix round for that walk, cut from the
merged copy (`review/local-2026-10-08` at `c42f6edae`). Not on `main`; nothing here was pushed.

**The junction (M01–M09, M19), decided by a test on the REAL draft path** —
`lib/the-table-the-maker-and-the-page-agree.test.ts`: a couple's whole session (ticks and Apply · Back to our picks ·
Remove · ＋ · Earlier/Later · edits · ↺) through `mergeHubDraft` → the stored draft → `overlayHubDraftWidgets` → the
Maker's lists, the table, the eye and the guest page's plan, then ✓ Apply onto the rows. 60 sessions, 2,172 steps,
66,468 boxes compared. No lab code in it.

- **LAB (the lab's plumbing alone):** M01 · M02 · M04 · M05 · M07 — `labDraftCookies` kept a hand-written list of four
  keys and `stage_show` was not in it. It now hands the lab's pages EVERY key of a scene's draft but the two with a
  cookie of their own (`LAB_OWN_COOKIE_KEYS`). Also dropped until now: `std_lead`, `music`, `venue`, `custom`, `removed`.
- **REAL, between two renders:** M03 · M06 · M09 — Remove is drawn at the tap and owes no render, so ＋, the table and
  the panel read the last render. The work area now hands over what it just took off (`hereOff`): ＋ offers it back on
  THAT stage (`listWithGates`), the table unticks exactly that box (`guestsSeeWithRemoved`), the panel lets go of it
  (`partTakenOff` → `onGone`). And a Remove taken back by ↺ no longer stays "off" for good (`hereOffAfterRender`).
- **REAL, found by the test (none was in the walk — the lab could not reach them):**
  - R1 · a scene with nothing in it yet (open browsing on — a new event's default) read "Hidden" on every stage and
    FORGOT a tick: the box came back empty after Apply. The approved prototype draws an empty row with its ticks, faint,
    and "Nothing written yet — guests will not see it." under its name. Now so (`asIfWritten`).
  - R2 · Remove on such a scene stored nothing, and it came back at the next render (`buildStageEyes`).
  - R3 · ✓ Apply wrote a row's place on a stage whose order had NOT moved, and not its neighbours' — that stage went
    live half-placed, in an order nobody chose, and ✓ read "1 change" straight after Apply (`classifyHubDraft`: only
    the moved stages' places are written). Introduced by last night's "one move is one change".
  - R4 · two scenes ADDED to a stage and then re-ordered: the order was neither counted nor written
    (`hubDraftMovedStages` reads both sequences over the drafted members).
- **M08 (LAB):** the lab said every scene was written, drew The Day from a fixed set (the gallery always) and had no
  Save-the-Date film. Its facts now name the three scenes the sample has nothing in; The Day draws a scene only where
  The Day draws it.
- **M19 (REAL, as shipped):** ✓ counts THINGS that differ from what guests have — one per line of the Apply sheet —
  never saves. Held by `lib/the-badge-the-sheet-and-undo-agree.test.ts` (200 sessions: the badge is the sheet's lines;
  ↺ gives back exactly the step before; nothing left is nothing shown). Whether ✓ should count EDITS is the owner's call.

**The rest, each by repeating the tester's step:**

- M11 (LAB) · the lab drew the Countdown outside the scene frame; the real page has always framed it.
- M12 (REAL) · ▶ on a fixed block played nothing: the canvas read a block as a scene. A block is played as the part it
  is (`editor-bridge.tsx` `blockPartOf`) — the March, E-Gifts, details, Happening now, Find your seat, the pass, Photos
  of you.
- M13 · M14 (REAL) · the app's one toast cut a sentence at one line. It wraps to two (the approved prototype's
  notice), never three, and peeks from under the Maker's top bar instead of over ↺ and ✓. Every caller.
- M15 (LAB) · the lab's guest preview drew the Maker's "Each guest sees their own look" stand-in for a guest.
  ("colors" → "colours" in that stand-in is the real component.)
- M16 (LAB) · the lab's guest page had no title; it wears a guest page's ("Wedding invitation"). The site's default
  title is the owner's brand line — not changed.
- M17 (REAL) · a "More to compare" card had two buttons; Save is retired there too (owner 2026-10-07).
- M18 · M24 · M25 (REAL) · the supplier sheet's and the Suppliers rows' buttons, and the Leave sheet's two doors, are
  44 px tall.
- M29 · "Sign in again to save suppliers." → "…to ask for a quote."

SPEC IMPACT: None — no schema, no SKU, no price, no new copy beyond the lines above. Three approved behaviours are
RE-STATED rather than changed: the toast is still a pill-shaped notice from the top (now up to two lines, as the
2026-10-09 RSVP prototype draws it — `INTERACTION_RULES.md` § 9 kind 12 says "one line"; that sentence should be
amended by the controller), Save is retired on a marketplace card (2026-10-07), and an empty row keeps its ticks
(`maker_what_guests_see_2026-10-10.html`).

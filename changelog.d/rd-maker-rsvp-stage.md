## 2026-09-30 · feat(maker): the RSVP stage — the form, after they submit, when they decline; every edit on the canvas at once

Owner, 2026-09-30: *"add the RSVP part first"* — DECISION_LOG "THE MAKER RE-PLAN — SPEED FIRST…" (top nav
`Details | Save the Date · RSVP · Invitation · The Day · Post Event | Prints`), "RE-PLAN REVISIONS…" (*"RSVP has a
different parts. the RSVP, after they Submit, or when they declined"*), "RSVP ANSWERS: THE COUPLE RENAMES…" and the
relayed hard requirement *"make sure what we rebuild is fast and realtime and changes instantly."*

- **The bar:** `RSVP` sits between Save the Date and the Invitation (`maker-bar.ts`; a Maker page keyed `rsvp-stage`,
  never a lifecycle phase — `rsvp` is the Invitation's phase key). Like Details it opens its own three parts over the
  work area (`maker-shell.tsx`), and it is the couple's alone (a coordinator is told why it is shut).
- **Three scenes** (`lib/rsvp-stage.ts`, `maker-rsvp-stage.tsx`), each the REAL guest page for a SAMPLE guest in the
  canvas, host-verified `?editor=1`, nothing read or written for a real guest: **1 RSVP** (`invite/reply`, the form,
  one-question mode included) · **2 After they submit** (`invite/enter?as=attending`) · **3 When they decline**
  (`invite/enter?as=declined` — new canvas mode on the thank-you page, its buttons inert on the sample).
- **Controls on the right** — the SAME `MakerRsvpSettings` Details' RSVP item draws, now by `scene`: the form's YES /
  NO **wording** (type your own, or Wording ▾ — ONLY lines that already exist: the owner's listed answers and the words
  those screens already print; no invented presets, per "✂ THE MAKER RE-PLAN IS CUT TO ITS CORE"; empty = today's words),
  one at a time, the questions, Who can RSVP (a dropdown), Reply by; the thank-you's and the decline's **heading ·
  message** (`{name}` fills each guest's name, as the approved prototype says). Requests and reminders are
  not on the stage (people belong to the Guest list — "THE MAKER EDITS HOW IT LOOKS…").
- **Stored:** `events.rsvp_ask_config.words` (`attending · declined · thanksHeading · thanksMessage · declineHeading ·
  declineMessage`), through the one sanitizer the draft and the guest render share (`sanitizeRsvpWords`, capped, junk
  dropped). DISPLAY WORDS ONLY — the radios still post `attending` / `declined`; counts, tickets, reminders and the seat
  plan never read them. No migration (the column's CHECK is object + size only).
- **Guests read them:** `RsvpWidget` (both render sites — `invite/reply` and the Event Hub's reply card) prints the
  couple's YES / NO words; the thank-you and the decline screens print their own heading and message
  (`thankYouWords`, pure); the reply summary line carries the couple's answer word. Unset = byte-for-byte today.
- **⚡ Realtime (the relayed requirement):** every edit is on the canvas before it saves — the panel announces the
  whole config (`RSVP_PREVIEW_EVENT`), the stage posts the editor bridge's own `words` message (and `rsvpAsk` for the
  switches) into its KEPT frames, and `rsvp-canvas-bridge.tsx` lays it on the page already drawn (words, a question
  shown / hidden — the canvas draws every question, marked `data-rsvp-ask` — and one-question mode switched live).
  Saves go behind it through the `rd/maker-instant` mechanism: `makerSave(…, { held: true })` +
  `makerLatestWrite` (typing = one save after the pause; taps = one save), the Apply count back with the save
  (`HUB_DRAFT_BAR_FIELD`), the Maker's own copy of the config (`maker-draft-store.ts`). Reply-by saves the same way
  with `maker_quiet` — `updatePaxSettings` then revalidates nothing. A refused save puts the field back on the panel
  AND the canvas and says so in words. Details' RSVP item keeps its old (unheld, one-render) path.
- **Took from `origin/rd/maker-instant`** (fast-forward, both commits, unchanged): "a pick the canvas already shows
  re-renders nothing — batched, in place" and "another part is adopted at once…" — `lib/maker-refresh.ts` held/no
  refresh + `makerLatestWrite`, `lib/maker-draft-store.ts`, the save-side Apply bar, and their guards.
- **Lab:** `/dev/rsvp-stage-lab` (dev-only) — the real stage on fixture frames with no-write saves and a stopwatch
  (`window.__rsvpLab`).

Guards: new `lib/the-rsvp-stage-is-realtime.test.ts` (A the stage + its three scenes · B the couple's words on the
guest RSVP, scrolling and one-question, values unchanged · C stored words only · D the decline screen reads its own
words · E no RSVP-stage edit path refreshes or revalidates the Maker) — each sabotaged before commit. Updated: the two
bar tests, `the-look-moves-into-details.test.ts`, `a-maker-pick-never-reloads-what-it-drew.test.ts` (the stage's two
held saves; Details' stays unheld), `every-maker-edit-shows-before-it-saves.test.ts` (the stage's canvas posts).

Not in this PR (said, not dropped): Details › RSVP still lists the item — removing it cascades into the guided "What's
left" round-2 step and Home's plan count, so it goes with the Details-slim lane; the middle answer ("maybe") is left to
`rd/rsvp-no-maybe`; the Digital tickets on scene 2 arrive with #6157 (the thank-you page it rewrites).

SPEC IMPACT: DECISION_LOG.md — "AS BUILT — THE RSVP STAGE" row (implements the 2026-09-30 re-plan rows as written; no
decision changed).

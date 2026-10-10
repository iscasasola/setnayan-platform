## 2026-10-11 · fix(maker): the phone walk's real faults fixed, and the Maker lab made honest enough to walk

A tester walked the whole Event Hub Maker at 375 px with touch in the sample lab (`/dev/maker-lab?studio=1`) and
logged 25 problems (`hub-walk/maker/REPORT.md`). Each was traced in both the lab and the real Maker and classed
REAL · LAB · BOTH (`hub-walk/maker-fixes/TRIAGE.md`).

**Real Maker (what a signed-in couple gets):**

- **↺ Undo · ✓ Apply · Restore with no signal no longer take the Maker down.** Measured at 375 px on the unfixed bar:
  one change, the phone offline, one tap on ↺ → `TypeError: Failed to fetch … in <HubDraftToolbar>` → the root error
  boundary: the app's error screen in place of the whole Maker. `useDraftIntent` awaited the server action in a
  transition with nothing to catch a request that could not leave. `hubDraftAnswer` (`lib/hub-draft.ts`) answers a
  throw as the refusal it is; the bar says "Something went wrong. Please try again — your draft is kept." and stays
  usable.
- **The Event Hub's address is called its address, and its format check runs.** Studio › Info › More for guests said
  "Slug", "Save slug", "3–32 chars · lowercase…", "Your page is private", "make your wedding page public", "Preview
  your page". Plain words now ("Address", "Save address", "Your Event Hub is private", "Preview your Event Hub" — the
  link is 44 px tall). The field's `pattern` had a bare hyphen in a class, which is a syntax error under the `v` flag
  browsers compile `pattern` with — the check was dropped and the console said so. Escaped (also on the admin
  corrections field).
- **The whole-page preview no longer opens on the Reveal's tile.** Hold ▶: the page "as guests see it" opened on the
  Stages toolbar's own grey envelope, "Opens once, over the cover". The preview's rule in `globals.css` now puts it
  away with the empty-scene placeholder.

**The Maker lab (dev only; production 404s it):**

- **Its draft is the real draft's reducers** (`app/dev/maker-lab/lab-draft.ts`): `mergeHubDraft`, `undoHubDraft`,
  `summarizeHubDraft`, `hubResetPatch`, `overlayHubDraftWidgets` on a draft the browser keeps. ↺ steps back one change
  at a time and the ✓ count follows; the count is what differs from live, not taps; Earlier · Later · Remove · ＋ move,
  remove and bring back a scene on the canvas; leaving and returning keeps the draft. The bar's ↺ · ✓ go to the lab's
  door (they went to the real action with a made-up event and landed on the sign-in page).
- **Its canvas draws the stage the Maker lists** (`lab-navigator.ts`, `guest/lab-stage.tsx`): each stage its own
  parts in the Maker's order; the Invitation as four pages, as the real canvas; "Only you see this" and the per-guest
  samples on the Maker's canvas only; the hero wears the drafted canvas (a typed Title survives a reload).
- **One sample event** (`LAB_SAMPLE`): Studio's pages say the canvas's date, venue, message and address; no Seat plan
  tile where the lab draws no seat plan.

Listed, not changed (owner-ruled, or no ruling picks a name): the Form row's ✕-only field (P13), the long-answer
scroll (P16), the exit sheet's two doors (P18), part names vs Studio's row names (P09).

SPEC IMPACT: None.

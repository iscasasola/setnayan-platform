## 2026-10-15 · feat(event-hub): the host strip is gone from the couple's own Event Hub; See as ▾ joins the phone's hold-▶ preview

Owner, 2026-10-15, on the live Event Hub, of the strip "Your Event Hub — as a guest sees it" · Edit · Preview ▾:
*"Remove it."* Approved design: `Setnayan/prototypes/host_preview_after_ribbon_2026-10-15_fable.html` (its
"delta to build" list). Owner picks: the STRIP only — the host-voiced body stays (`host-body-variant.test.ts`) —
and See as on a phone, yes.

- **Removed:** `app/[slug]/_components/owner-ribbon.tsx`, `owner-phase-menu.tsx`, `lib/owner-ribbon.ts` and its
  two tests, `SEE_AS_YOU` (its only consumer). Both mounts are gone (`site-body.tsx`, and the private-landing
  branch of a Signed-out sample in `page.tsx`), with the `ribbonCapability` hand-off that existed only for it.
  A signed-in host's `/[slug]` now looks like a guest's page, less the stranger's door. Editing is from Home
  ("Edit your Event Hub"). The host-only `?phase=` / `?as=` addresses stay, but nothing on the page links to them.
- **Added:** one **See as ▾** `PickMenu` beside "Exit preview" in the Maker's hold-▶ preview (`stage-tools.tsx`,
  phone only, not on the RSVP stage, whose canvas takes no `?as=`). It shows You · editing and the four states,
  the same rows and the same `setSeeAs` as the desktop dropdown. A pick says one line while the canvas redraws
  (`seeAsDrawingLine`, `lib/see-as.ts`) and never leaves the preview. When the canvas reloads for a pick it is
  told at once that it is still a guest's. Exit preview sets See as back to You.
- **Copy:** the host card on the Event Hub controller (`lib/event-hub-control.ts`) said "A slim ribbon rides the
  top with the edit door…". It now says nothing of the editor sits on top.
- **Guards re-aimed, none deleted:** the-maker-canvas-is-only-the-page · each-guest-page-has-one-main-action ·
  a-control-that-works-for-whoever-sees-it · a-dark-look-keeps-its-words (the plate-ink pair is now anchored on
  the plain block plate) · see-as-never-writes (the `[data-owner-ribbon]` exemption is gone, and the test now
  checks that) · see-as-draws-the-guest-components · host-body-variant · the-hub-next-step prose.
  **New:** `app/[slug]/_lib/the-host-page-has-no-host-strip.test.ts`. It renders the REAL `SiteBody` for a
  signed-in host (no strip, still the host body), scans `app/[slug]`, and checks that the hold-▶ row holds exactly
  one See as ▾ and no second stage control. It was sabotaged five ways, and every sabotage turned it red.
- Regenerated: `lib/ugat/screens.generated.json`, `scripts/port-control-baseline.json` (the two removed controls
  are listed in that diff).

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-15 "the owner ribbon is removed; Preview is the Maker's" (corpus
`~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`).

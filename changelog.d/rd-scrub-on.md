## 2026-10-13 · feat(scrub): "Scrub out" is turned on — offered for every couple

Owner, verbatim (2026-10-13): **"Turn on scrub"** — his call, made before his own iPhone check (the 2026-10-09 cut
line had said "after an iPhone has played it").

- `apps/web/lib/scrub-out-offered.ts`: `SCRUB_OUT_OFFERED = true`. Every control that names a scene's transition now
  offers "Scrub out ◆" (Leaves, the Animate tab, the sections panel, the editor's list label), and a scene or cover
  that STORES Scrub plays the held hand-over on the guest page — still only where the renderer already allowed it
  (`scrubAllowed`, Event Hub Pro). Still a constant, not a setting: turning it off again is the same one line.
- Carries #6496 (the cover fitted before it fades; "Get inside" stays; photo covers fitted — the owner's three calls
  of 2026-10-13), merged in.
- Guards re-aimed to the new truth, with dated notes (none weakened): `scrub-out-ships-dark.test.ts` (1)–(4) — the
  switch is ON; the real page (no door) draws the SAME held pairs the lab's door draws and differs from the plain
  page; every Leaves choice offered; the off arm still reads a stored Scrub as scroll; the lab's two doors still only
  under `app/dev/` + `scripts/`. `scrub-is-a-held-hand-over.test.ts` (10): a Pro cover stored to leave by Scrub
  leaves. Fixture guards (4) (6) (8) and the free-section guard already had both arms; they now run the ON arm.
- NEW guard `site-body-fixture-render.test.ts` (9): Save the Date is NOT wired for Scrub (its film cover is a separate
  design) — a Save the Date whose cover and scenes store Scrub draws no hand-over box, no engine mark, no cover cell,
  mounts no island, and with the page's unarmed hold taken off is the plain page byte for byte (Pro and free).
- Production (read-only, 2026-10-13): **0 events** store a Scrub transition today (no `invitation_widgets` row and
  no `event_site_drafts` draft/snapshot stores any `transition`), so no live page changes the moment this ships.

SPEC IMPACT: The 2026-10-09 "Scrub out ships dark" cut line is lifted by the owner's 2026-10-13 ruling "Turn on scrub"
(DECISION_LOG row to add). No schema change.

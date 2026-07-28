## 2026-07-27 · feat(marketplace): "Your team" — candidates, open decisions, buffer (PR-E)

Explore Replan slice E (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-E · §2
decision #11 · §8.3). Extends the shipped `BuildLocked` right rail — it is not
redrawn. Everything below is behind `isExploreReplanEnabled()` (default OFF);
flag OFF renders the rail exactly as it ships today.

- **"In your build — ready to lock"** — the existing candidate rows keep the
  canonical `AccordionLockButton` (the only lock path: conflict gate, date-lock
  modal, milestone toast, undo) and gain a per-row ✕ wired to the shipped,
  vendor-scoped `removeBuildPick`, so a multi-pick category loses only that one
  candidate.
- **"Still needs your decision"** — the in-plan, unlocked categories in urgency
  order (most urgent → sooner lock-by floor → model order), capped at 4 with an
  "…and N more" line. Locked-ness reads through `lockedGroupIdsOf` from the live
  plan snapshot the Plans surface already builds, so both surfaces share one
  authority instead of re-deriving from `raw_status`. Each row is a doorway that
  uses the SHIPPED deep link (`?tab=shortlist&open=<tile>`, the same contract the
  checklist links with) plus the section bus and the bench's own
  `#slfold-<slug>` anchor — no new navigation, and no reach into the bench's
  internal state.
- **Six anchor + money tiles**: Date · Location · Locked · In build · Budget ·
  **Buffer** (estimated budget − locked − candidates, from
  `events.estimated_budget_centavos`). "No budget set" is rendered as such — it
  never reads as a ₱0 buffer.
- **"Clear candidates" MOVED** from the Plans panel to Your team (spec §8.3) and
  deleted there in the same change, so exactly one control empties the build.
  Locked vendors are contracts and are untouched.

New pure core `apps/web/lib/your-team.ts` (`teamMoney`, `bufferTile`,
`stillNeedsDecision`, `deepLinkTileForGroup`) with 15 unit tests in
`your-team.test.ts` — the centavos→PHP fold happens in exactly one place, which
is what makes Buffer trustworthy.

`ShortlistCategories` gains a flag-gated `key` in `vendors/page.tsx`: the deep
link is only read in the bench's state initialisers, so an in-route soft nav
would otherwise be a no-op. Flag OFF → `key={undefined}`, i.e. no key at all.

Verified: `tsc --noEmit` clean · `next lint` no new warnings in touched files ·
`pnpm run test:unit` 4646/4646 pass · production build green with the flag ON.

SPEC IMPACT: None — implements `Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-E
as written. §8.3's "Clear candidates lives on Your team" is now true in code; the
PR-F note that its Plans-panel placement was provisional is discharged.

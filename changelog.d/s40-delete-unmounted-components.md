## 2026-09-19 · chore(ui): S40 orphan sweep deletes 8 unmounted, superseded components (UNCLASSIFIED)

Re-measured every UNCLASSIFIED `component-no-mount` row assigned from
`apps/web/tests/db/ugat-both-ends.baseline.txt` (S26, PR #5625) against `origin/main`.
All 8 had zero runtime importers, and each was superseded by a later, owner-directed
redesign that never removed the file it replaced:

- `app/_components/bespoke-monogram-motion.tsx` — the Bespoke AI Monogram Studio it
  served was retired 2026-06-19; the surviving Vector Studio/Upload marks animate via
  `StudioRevealPlayer`, not this component's motion-signature library (owner-locked
  2026-06-23 "reveal unification": "the chosen reveal — NOT monogram_motion_key").
- `app/_components/category-filter-chips.tsx` and
  `app/(shell)/explore/_components/mega-column-tabs.tsx` — both retired by the
  2026-05-30 "Airbnb vibe" marketplace redesign (`IconTileFolderStrip` replaces the
  chip/tab pickers; its own docblock says so). `explore/page.tsx`'s `FolderTab` type
  import is repointed from the deleted file to `icon-tile-folder-strip.tsx`, which
  defines the same shape.
- `app/_components/ceremony-type-radio-group.tsx` — its two documented call sites
  (create-event form, dashboard CeremonyTypeModal) no longer render it; ceremony type
  selection moved to the photo/carousel event-type picker.
- `app/_components/nav/doorway-sidebar-header.tsx` and
  `app/_components/nav/top-nav-utils.tsx` — the 2026-08-13/14 "One Shell" redesign
  replaced `<SidebarShell>` + `<DoorwaySidebarHeader>` with `<AppRailShell>` →
  `<FrontDoorShell>` on all four doorways (admin, vendor, customer, event); each
  layout's own docblock says "no longer mounted here."
- `app/_components/states/loading-skeleton.tsx` — zero importers, no supersession
  note found; a generic primitive nothing ever adopted.
- `app/_components/verification/application-progress.tsx` — the 12-document vendor
  verify checklist it served is retired to a pure redirect (own test: "the route no
  longer renders the retired 12-document form... !src.includes('ApplicationProgress')").

**Guard sync:** `app/_components/auth/seam-invariants.test.ts`'s "wordmark is the way
out of the app" test read `doorway-sidebar-header.tsx` directly (`readFileSync`) — it
had been silently checking dead code for an unknown stretch of time. Re-pointed to the
live `front-door-shell.tsx`, which currently computes the app-variant wordmark target as
`/dashboard` (its own inline comment: "ONLY the signed-in app may point at /dashboard").
That is the OPPOSITE of the rule the old test enforced. Whether this is an intentional
later supersession (both changes are dated within the same 2026-08-13 "One Shell"
redesign) or an undetected regression was NOT resolved in this PR — flagged separately
for a dedicated follow-up. The test now pins current reality so a future change is at
least visible. Also regenerated `scripts/port-control-baseline.json` (deliberate removal
of `mega-column-tabs.tsx` from the `/explore` route's file list) — `lint:port-controls`
passes, 428 routes / 1558 controls / 4490 blocks, no route lost a control.

**Also restores an owner lock (WORDMARK, 2026-09-19).** The follow-up above is resolved
in this PR: it WAS a regression. Owner, `DECISION_LOG.md` 2026-08-13 SESSION 6: *"The
WORDMARK is the way out of the app, still signed in."* The 2026-08-14 "one top bar" commit
(cf58418b48) hard-coded the app wordmark to `/dashboard` citing "the launcher's own shipped
grammar" with no owner statement; 08-15 (a7308cccd4) only parametrised it. `homeHref` in
`app/_components/frontdoor/front-door-shell.tsx` is now `'/'` for every variant (which also
keeps the 08-15 "never send a stranger to /dashboard" constraint by construction). The
one-press way home is unchanged: the rail's signed-in events row, the shell's account menu
and `<AccountSwitcher>`'s Home link, all → `/dashboard`. `seam-invariants.test.ts` now pins
the SEMANTIC (every wordmark href resolved; `/`, never `/dashboard`) and the way-home links
where the live shell renders them (its old "All your events" pin read the unmounted
`customer-sidebar.tsx`); sabotage-proven 5 ways. `rail-active.test.ts` and
`doorway-shell.test.ts` pins updated to the restored value. Owner may revert with one line
if he prefers the 2026-07-16 Wordmark-as-Home.

SPEC IMPACT: `DECISION_LOG.md` — 2026-09-19 row records the 08-14 regression and its
restoration per the 08-13 owner lock (flagged for owner confirmation). Otherwise dead-code
removal only.

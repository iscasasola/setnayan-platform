## 2026-07-05 · chore(marketing): remove legacy pages — BLOCKED; radius lint fix landed

The intended change was to delete six legacy old-skin marketing routes
(`/features`, `/how-it-works`, `/about`, `/our-story`, `/papic`, `/monogram`)
and add permanent redirects. On inspection, every one of the six failed the
"pure server-rendered marketing, no interactivity / no functional dependency"
premise the removal was scoped on, so the deletion was NOT performed (per the
explicit stop-and-report constraint). See the PR description for the full
blocker inventory. No routes were deleted, no redirects were added, no inbound
links were stripped.

What DID land in this PR: the `lint radius tokens` guard was failing on `main`
because `apps/web/app/_components/home/home-reskin.css` had one hardcoded
`border-radius: 14px`. Swapped it to the file's existing local radius token
`var(--hr-r14)` (already used at 4 other sites in the same file; equals 14px, so
zero visual change). `RADIUS_LINT_STRICT=1 node apps/web/scripts/lint-radius.mjs`
now passes.

SPEC IMPACT: None.

## 2026-10-11 · chore(release): the morning batch — Batch B + guest faults + Maker never crashes + the faster home page, joined in one branch

Assembled, not live. No feature was written here: four finished branches were
joined with real merge commits, and the joined tree was proved.

- Base: `preview/batch-b-event-hub` @ d2becf325.
- Merged, in this order, each with `git merge --no-ff`: `rd/c-guest-faults`
  (which contains `rd/c-requests-never-crash`), `rd/c-maker-never-crashes`,
  `rd/speed-home-reads`. All three merged with NO conflict. After each merge,
  every file only one side had touched was compared to that side (identical),
  and the two files both sides had touched were read hunk by hunk
  (`lib/the-rsvp-stage-is-parts.test.ts`, `app/dashboard/[eventId]/delete-actions.ts`
  — disjoint hunks, both kept). Nothing was reverted; no side was chosen over
  the other anywhere.

Two things were changed by the assembly itself — neither is app code:

- **`lib/guest-read.test.ts` — a note that became untrue when two branches met.**
  `rd/c-guest-faults` wrote `guestRead` when a read that never reached the
  database (`status: 0`) was NOT transient, and its test's caveat says such a
  read is thrown as a `GuestReadError`. `rd/c-maker-never-crashes` made
  `status: 0` transient (`lib/read-retry.ts` rule 4). In the joined tree
  `guestRead` throws a `SchemaBlipError` for it, after ONE read. For a guest
  nothing differs: every `guestRead` caller is under `app/[slug]`, whose
  boundary says the same words for both. The note is corrected and § 5b pins
  the joined behaviour.
- **`plan-it-myself-is-one-switch.test.ts` — a pin `rd/c-maker-never-crashes`
  left behind.** That branch turned `plan-myself.tsx`'s `<form action={setPlanningMode}>`
  into `<SafeForm …>`; the pin still read the old spelling and was red on that
  branch alone (it is one of the 678 tests a capped preflight does not run).
  Property kept — the switch's form posts `setPlanningMode`, and only that —
  the spelling re-aimed once.

Generated files, regenerated from the joined tree and read:

- `scripts/port-control-baseline.json` — +1 action, +34 blocks, 0 removed
  (`ReplyForm`, `ReplySubmit`, `SafeForm`, `SeatsShowOnTheDay`, `ArrivalLoading`,
  `SignOutOfInvitation`, …). Committed.
- `lib/ugat/screens.generated.json`, `lib/home-shelf-writes.baseline.txt`,
  `lib/site-body-fixture.golden.html`, `lib/every-stage-is-todays-page.golden.json`
  — regenerated / re-rendered: 0 entries moved.
- NOT regenerated, on purpose: `scripts/dup-rule.baseline.txt` (the lint
  reports 5 listed duplications as already gone — the same 5 with
  `lib/entourage.ts` put back to Batch B's, and the baseline is byte-identical
  to `origin/main`; it is not this batch's to move), the two admin maps (only
  their "as of <sha>" line would change), and `lib/ugat/code-map.generated.json`
  (its generator needs a local graph this worktree does not have; the file is
  untouched since `origin/main` by all four branches).

Proved on the joined tree (2026-10-11, this machine; no build was run):
full `tsc --noEmit` rc 0 · the whole `pnpm preflight` green (43 CI guards,
eslint on 390 files, 789 unit test files, 68 DB test files incl. the two Ugat
map tests) · and, beyond preflight's cap, every other unit test file — all
2,712 ran; the one failure was the pin above.

Not proved here: the production build, the Maker's first-load JS budget
(507 KB), Lighthouse, e2e, the other 314 DB tests — CI's.

SPEC IMPACT: None of its own. The merged branches carry theirs
(`changelog.d/rd-c-guest-faults.md` is "Yes" — the owner's 2026-10-11 rulings).

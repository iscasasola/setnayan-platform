# EH2 — resume: finish View as and get #5107 to MERGED

**Model:** Opus 5 · **Effort:** high · **Wave:** now · **Resume of a stopped session**

Measured 2026-09-03 against `origin/main` @ `2bede4eb3`. **Re-fetch and re-measure before you act — this
prompt is evidence of nothing.**

---

You are resuming EH2 of the Event Hub stream. Your branch is
`claude/view-as-the-couple-checks-what-each-person-sees`, PR **#5107**. Your session stopped with the
PR open. **It has since been rebased and is no longer conflicting.**

STATE AS MEASURED (verify it yourself first — `gh pr view 5107 --json state,mergeStateStatus,statusCheckRollup`):
  · #5107 OPEN · MERGEABLE · auto-merge ARMED · 16 checks · 6 pending · 0 failing
  · Merged since you branched: **EH1 #5102**, **EH3 #5108**, **EH4 #5106**.

🚨 **RULE 11 — DONE MEANS MERGED.** Poll until #5107 reads MERGED. If a required check fails, read the
failure, fix it, push again. Do not hand back an open or red PR and call the session complete. If the
same check fails twice for the same reason, STOP and escalate.

⛔ **DO NOT REBUILD ANYTHING. DO NOT WIDEN SCOPE.** Your work is already pushed. This session is:
finish, verify, merge.

── WHAT EH4 PUT INTO THE FILE YOU BOTH TOUCH ─────────────────────────
`launch/page.tsx` was the ONLY overlap. EH4 added an **S4 offer panel** (`hub-pro-offer.tsx`) reading
`eventCoupleWebsiteProActive` + `eventOwnsCoupleWebsitePro` + `formatV2Sku('COUPLE_WEBSITE_PRO')`, and
moved the seven Pro-item names into **`apps/web/lib/website-pro-items.ts`** — a guard now asserts there
is no second copy of that list. **Do not reintroduce one.**

⚠ **AFTER THE REBASE, RE-PROVE THESE THREE — a rebase that compiles is not a rebase that is correct:**
  1. **The offer gate still fires.** `hubOffersAllowed` (`phase === 'plan'`) must still be reached on the
     merged page: no offer on the event day, none after it, none when the phase is unmeasured. If your
     resolution dropped that gate, the offer returns on a finished wedding.
  2. **View-as still reaches the RENDER**, not just the resolver. A resolver test cannot prove a pixel,
     and the pixel is the feature. Your `view-as-reaches-the-render.test.ts` must still be meaningful —
     mutation-test it once more and print the occurrence count before → after.
  3. **The named-guest role is still behind `hub-named-guest-flag.ts`, defaulted OFF.** That is a privacy
     surface and the owner has not ruled on it. Do not switch it on to make a test easier.

⚠ **RUN THE FULL SUITE, NOT ONLY YOUR OWN TESTS.** EH4's `hub-pro-offer-renders.test.ts` and
`the-offer-is-priced-by-the-catalog.test.ts` render the same page you changed. Run unit tests from
`apps/web` or every `@/…` import dies. Require **TSC_EXIT=0 printed beside ERROR_LINES=0** — an empty
tsc log is not a clean one (tsc exits 134/143/144 on abort, which reads as zero errors) — and require a
**non-zero test count**; zero-tests-zero-failures is byte-identical to success.

⚠ `pnpm lint` does NOT run the repo guards — they are separate CI steps. One of them, **`lint one
comment stripper`**, red-lit EH3: any guard that reads SOURCE must import `stripComments` from
`apps/web/lib/strip-comments.ts` rather than hand-rolling one. A hand-rolled two-replace stripper can
blank the region you assert over, after which the guard passes on an empty string.

HAND BACK IN THIS EXACT FORMAT:

    SESSION: EH2 (resumed)
    PR: #5107 <MERGED|OPEN|BLOCKED>
    MEASURED-AGAINST: origin/main @ <fetched sha>
    TSC_EXIT=<n> ERROR_LINES=<n>
    TESTS: <# passed> of <# run>   (must be non-zero)
    MUTATION: <assertion> — before <n> occurrences, after <n>
    GATE RE-PROVED: hubOffersAllowed still reached? <yes/no, with the observation>
    NAMED-GUEST FLAG: <on|off> in production
    OWNER QUESTION: <none, or the one thing you could not resolve>
    LEFT UNDONE: <none, or exactly what and why>

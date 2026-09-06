# EH6 — close out: confirm what merged, then hand back

Paste this into the EH6 session. It is a close-out, not new build work — your PR is merged, and
**one session = one branch = one PR** (rule 15). Do not start EH5 or anything else here.

---

Your PR **#5116** merged at 2026-09-02T18:04 UTC. `origin/main` is `773c5f305` or later — re-fetch.

**Independently verified already (you do not need to re-derive these, but say if you disagree):**
  · exactly ONE surface declares `metadata = { title: 'Event Hub' }` — `launch/page.tsx`;
  · `addOnHref('landing-page')` returns `/dashboard/${eventId}/launch`;
  · all **15** `/website/*` children still have their own `page.tsx` in `origin/main` — editor ·
    editorial · our-story · privacy · hero-photo · colors · dress-code · what-to-bring · widgets ·
    site-chrome · living-hero · photo-moments · our-photos · special-message · stories;
  · the `/website` stub redirects only itself.

## 1 · Do the merge-only checks a green PR cannot prove

A PR is green against ITS OWN merge preview. These are the things that are only true after landing:

  a. **Re-run the full suite against `origin/main` as it now stands**, not against your branch.
     From `apps/web`. Require **TSC_EXIT=0 printed beside ERROR_LINES=0** and a **non-zero test
     count**. Two other PRs merged around yours; a semantic conflict compiles.
  b. **Walk the redirect for real**: `/dashboard/<eventId>/website` → the controller, and each of
     the 15 children still renders its own page rather than bouncing. Enumerate the result.
  c. **Confirm the rail tie stayed settled.** You gave the Studio row a `matchPrefix` for the
     `/website` family. Verify on `main` that exactly one row lights for the controller's href and
     one for `/website/*`, and that `activeRailKey` is not deciding it by list position.

## 2 · Prune your worktree — owner-locked 2026-07-24

Your PR is MERGED, so remove the worktree **now**, not at the end of some later batch:

    git worktree remove <your path> --force   # fall back to: rm -rf <your path>
    git worktree prune

Each worktree is 1–2 GB (`node_modules` + `.next`). Left to pile up they have filled this disk to
100%, and at zero free bytes **every Bash call fails with ENOSPC — including the `rm` needed to
recover.** If you keep the worktree for any reason, at least `rm -rf <wt>/apps/web/.next`.

## 3 · Hand back

    SESSION: EH6 (close-out)
    PR: #5116 MERGED
    MEASURED-AGAINST: origin/main @ <fetched sha>
    TSC_EXIT=<n> ERROR_LINES=<n>
    TESTS: <# passed> of <# run>   (non-zero)
    REDIRECT WALK: <15/15 children render their own page? enumerate any that do not>
    RAIL TIE: <one row per href? how you proved it>
    WORKTREE: <removed | kept, and why>
    LEFT UNDONE: <none, or exactly what and why>

⛔ **Do not open a second PR from this session.** If the merge-only checks surface a real defect,
report it in the handback and STOP — the fix is its own session with its own branch.

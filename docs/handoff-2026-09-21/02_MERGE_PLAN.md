# THE MERGE PLAN — finish what is known in the fewest merges

**Written 2026-09-21.** The constraint is Vercel build cost, and everything below follows from one
**measured** fact: the unit of cost is a **production build on `main`**, and there is exactly one
per merge.

⚠ **Re-measure before acting.** The queue moves hourly:

```bash
gh pr list --state open --limit 40 --json number,title,headRefName,mergeStateStatus \
  --jq '.[] | "\(.number)\t\(.mergeStateStatus)\t\(.headRefName)"' | sort -n
```

---

## What actually costs money — measured 2026-09-21, not assumed

| Event | Vercel result | Cost |
|---|---|---|
| Push to a `claude/*` branch | deployment created, immediately **CANCELED** | **≈ nothing** |
| Update an open PR, any number of times | same — canceled | **≈ nothing** |
| **Merge to `main`** | **READY**, target `production` — a full build of the whole app | **the bill** |

`apps/web/vercel.json`'s `ignoreCommand` skips `claude/*` outright (`exit 0`). Verified against the
live deployment list: every `claude/*` entry reads `"state": "CANCELED", "target": null`, every
`main` entry reads `"state": "READY", "target": "production"`. **In one ninety-minute window on
2026-09-21 there were six production builds — one per merge** (#5830 · #5832 · #5841 · #5829 ·
#5842 · #5840).

🔑 **Pushing is free; merging is not.** A branch can be revised twenty times at no cost — so **there
is never a reason to open a second PR for work that belongs in one already open.** This
documentation was written across three pushes to a single branch and cost nothing until it merged.

⚠ **This repo has already burned roughly $787 on no-op builds.** That is why `ignoreCommand` exists
at all.

### Why `main` builds even for a documentation-only merge — do not casually "optimise" this

The rule once asked *"did the last commit touch the app?"*. The last commit was a CI-only fix, so
Vercel **skipped the build twice**, and **production sat 35 app files behind with nothing saying
so.** It was answering the wrong question: it should ask "has the app changed since what is
*deployed*", not "since the previous commit". `main) exit 1;;` can only ever cause an unnecessary
build — never a missing deploy.

**The principled fix is already named in this repo: `turbo-ignore`**, which asks the Vercel API what
actually shipped last instead of guessing from `HEAD^`, letting doc-only and CI-only merges skip
safely. It changes the guard standing between the team and a silently stale production, so it
deserves its own scoped change with someone watching the first doc-only merge confirm that
production still moves. **It is not a side effect of anything else in this plan.**

---

## The arithmetic that makes the case

| Approach | Production builds to finish everything currently known |
|---|---|
| One PR per fix, the way this repo has worked so far | **~45** |
| Bundled — one PR per neighbourhood, one commit per fix | **4** |

Plus whatever is already in flight. There is no quality difference: the same commits, the same
guards, the same review. The only difference is how many times they cross the line.

---

## Phase 0 — drain what is already in flight. **Do this before opening anything new.**

Measured 2026-09-21: **7 open PRs · 0 failing checks.**

| PR | State | What it needs |
|---|---|---|
| 5831 `claude/profile-formal-name` | **DIRTY** (conflicting) | Its own session merges `origin/main` and pushes. ⚠ **A conflicting PR runs NO CI** and reports zero failing *and* zero running — that is not a pass, it is nothing. Count the checks. |
| 5833 `claude/handoff-what-is-left-2026-09-21` | BLOCKED, 2 pending | This documentation. Auto-merge armed. |
| 5834 · 5835 · 5837 · 5838 · 5843 | BLOCKED, 0 failing | Nothing. Auto-merge is armed; BLOCKED here means "waiting for required checks", which is the normal state. |

🔑 **Why this phase comes first:** a bundle branched from a `main` that is about to absorb seven
merges will conflict with all of them, and **you pay for those conflicts twice** — once in the
session's time, once in the re-run. Branch the bundles from a settled `main`.

**Do not add an eighth in-flight PR.** Three build slots at a time is the ceiling on this machine
(16 GB — three concurrent typechecks have shut it down).

### Consolidating PRs that are already open

Two open PRs from the same session, touching the same neighbourhood, can become one merge: merge
branch A into branch B locally, push B, and **close A without merging**. One merge instead of two.
Only do this when the same session owns both — otherwise you are rewriting someone else's work.

---

## Phase 1 — the two money-and-loop bundles

Branch both from a settled `main`. They touch disjoint files and can run at the same time.

| Bundle | Builds | Brief |
|---|---|---|
| **B1 — Money that must not be wrong** | 8 | `BRIEFS/CTRL-B1.md` |
| **B2 — The loop that never closes** | 7 | `BRIEFS/CTRL-B2.md` |

**2 merges.**

## Phase 2 — the truth-telling and invitation bundles

| Bundle | Builds | Brief |
|---|---|---|
| **B3 — Say the true thing** | 12 | `BRIEFS/CTRL-B3.md` |
| **B4 — The invitation reaches a guest** | 3 | `BRIEFS/CTRL-B4.md` |

**2 merges.** B4 must wait until the guest-list and people sessions have landed — it shares
`lib/guests.ts` and the roster with them.

⚠ B2 and B3 both contain the `auto_confirmed` item. **Whichever starts first takes it**; the other
skips it and says so. Duplicated work is duplicated merges.

---

## The five rules that keep the count down

**1. Never open a PR for a single small fix.** Park it in the bundle that owns those files. A
one-line fix and a seven-build bundle cost exactly the same to merge.

**2. One commit per build inside a bundle.** Never squash them together. If one turns out wrong, the
fix is `git revert <sha>` — surgical, and not another bundle's worth of untangling.

**3. A red build is dropped, not nursed.** If one build cannot go green in ~20 minutes, reset that
commit out of the branch, push the rest, and report it. **Never hold finished builds hostage to
one.** A stalled bundle blocks everything behind it and eventually costs more merges, not fewer.

**4. Land the whole bundle or explicitly drop from the END.** The briefs order each bundle
hardest-first for exactly this reason: the cut line is the bottom of the list.

**5. Check `git diff --stat origin/main...HEAD` before every push.** A bundle touches more files than
a single fix, so an accidental revert hides more easily. **PR #5719 merged green while silently
reverting #5717 and deleting its helper.** CI cannot see this; only the `--stat` can.

---

## What costs NOTHING and should not wait for a merge

These change production without a PR. Several of them are on the launch-blocker list, so doing them
now removes items from the build queue entirely:

- **Supabase off the free plan**, and confirm backup retention in writing. *(No verified PITR under
  real PII and paid orders; free projects can be paused after 7 days of inactivity.)*
- **A Resend API key with read scope.** All 20 delivery records read `NULL` because the checker is
  refused every time — the read-back mechanism is already built, tested and wired to a screen.
- **Leaked-password protection**, in Supabase Auth.
- **An external uptime monitor** pointed at the existing `/api/v1/health`.
- **Feature flags already built and shipped OFF** — the venue-door throttle
  (`VENUE_DOOR_THROTTLE_ENABLED`), Supabase's captcha enforcement, the subscription paywall
  (`VENDOR_TIER_FEATURE_GATE`). **Flipping a flag is a decision, not a build.**

⚠ **A flag's default in code is not its value in production.** Check `vercel env ls production`, or
open the page — thirty seconds. `NEXT_PUBLIC_*` is readable; server-side vars are not readable from
a session at all, and saying so is better than guessing.

---

## What is blocked on a decision, not on engineering

Each of these is one answer that releases one build. Until answered they should stay **out** of every
bundle — a build shipped against a guess is a build shipped twice.

1. ~~**Does an unpaid booking fee remove anything?**~~ ✅ **ANSWERED 2026-09-22 — option (B).** An
   unpaid fee removes access to the event hub, portfolio, fuller event detail, gathering and sharing
   data, reviews and stats. It does **not** pause new inquiries (ruled separately). ⚠ The owner's list
   ends "and more" — **close that list with the owner before building**, then dunning (M5) can be
   built, because the removal is what a dunning notice has to warn about.
2. **Is "0% commission" the promise to keep**, beside a 5% booking fee? Claimed five times on public
   pages, including to suppliers. **No wording should be touched until this is answered.**
3. **Void or credit memo** for a refunded receipt — neither exists in the system.
4. **Rename the `-fix` shop slug?** Renaming breaks every link already shared for the only shop with
   real bookings.
5. **Flip the subscription paywall on?**

---

## The whole plan in one line

**Drain 7 → 2 bundles → 2 bundles.** Eleven merges to land everything currently known, against ~45
one at a time — and five of the launch blockers never enter the queue at all, because they are
settings rather than code.

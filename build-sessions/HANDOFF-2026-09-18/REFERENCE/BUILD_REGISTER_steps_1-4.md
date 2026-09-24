# ✅ CLOSED 2026-09-18 — DO NOT USE AS A BUILD QUEUE

> **Every build on this plan is MERGED AND SERVED.** Kept for its environment
> section (§3) and its rules, which are still current. **The sequence in §5 is
> history — do not pick rows from it.**
>
> | build | outcome |
> |---|---|
> | S1 · the NUL byte | ✅ served — 0 NULs across 11,261 source files, guard walks the whole repo |
> | S2 · LR-14 guest QR | ✅ served — the flag is DELETED, revocation is unconditional |
> | S3 · LR-6 password reset | ✅ served — `/auth/confirm` + `verifyOtp`, completes in any browser |
> | S4 · SUP-52 song request | ⏸ PARKED — supplier surface, outside "wedding and simple event at minimum" |
> | S5a · SUP-24 marketplace-since | ✅ served |
> | S5b · LR-10 occasion wording | ✅ served — both call sites |
> | S6 · LR-22 email allowlist | ✅ was ALREADY DONE when re-measured; only the send-log half remains |
>
> ## 🔑 WHAT THIS DAY ACTUALLY TAUGHT, none of which was on the plan
>
> **The owner's two dashboard tasks mattered more than the seven builds.** Custom
> SMTP and Turnstile were ~35 minutes of his time and unblocked more than a day
> of engineering. **A plan that lists only what sessions can build will always
> mis-rank the day.**
>
> 🛑 **AND TURNSTILE WENT ON AND HAD TO COME BACK OFF.** Enforcement was enabled,
> and email+password sign-in became impossible **on mobile** — the widget's
> holder measures **293 × 0** at a 375px viewport, under Cloudflare's 300px
> minimum for `size:'flexible'`, so an interactive challenge cannot paint at all.
> Desktop (382 × 72) worked throughout, which is why it read as fine. On a
> Philippines-first platform mobile is most users. Fixed by **#5581** (holder
> floor + an early tap is queued) and **#5580** (a failed check now says why, to
> the person and the console).
>
> ⚠ **ORDER THAT MUST BE HELD: #5581 SERVED → then captcha may be switched back
> on → then the `/verify` gating question is answerable → then the seat-claim
> ruling.** Enabling before that fix serves recreates the lockout exactly.
>
> ⚖ **STILL OPEN, and it only bites on an event day:** Cloudflare demands an
> interactive solve when one IP makes many requests quickly — which IS a
> reception, a hundred guests on one NAT'd venue WiFi. Being built behind an OFF
> flag on the `join-door-throttle.ts` precedent ("sized for a VENUE, not a
> laptop").

---

# THE FRIDAY BUILD — a self-contained handoff

> **Written 2026-09-17 (Thu) by session `setnayan-platform-be`.**
> **Deadline: Friday 2026-09-18 — ONE working day.**
> **For: a fresh session on a different account. Nothing here assumes you have my memory,
> my worktrees, or my conversation. Everything you need is in this file or reachable from it.**

---

## 0 · READ THIS FIRST — THE ONE-DAY REALITY

**A PR in this repo is a ~1-hour round trip.** CI runs 45–55 minutes, nearly all of it in the
database-replay step. 33 minutes in is normal, not stalled. That single fact sets the budget:

- **One session lands ~5–6 PRs in a day**, not twenty.
- **Six sessions in parallel land ~25–30 PRs**, and that is the ceiling.
- Work is gated by **CI wall-clock, not by thinking time.** Start every session's first PR as
  early as possible and keep each session's next build moving while CI runs on the last one.

⚠ **THE FULL REGISTER DOES NOT FIT IN ONE DAY AND NOBODY SHOULD PRETEND IT DOES.** The register
holds ~400 rows. This document selects **13 builds across 6 parallel sessions**, chosen because
each one is (a) re-measured and confirmed open, (b) buildable without an owner ruling, and
(c) something a real person can currently hit. §7 names exactly what is being left out and why,
so the owner can scale up or down rather than discover the omission later.

🔑 **THE GOAL IS UNCHANGED: the platform is ready for a real wedding on Friday 18 December 2026.**
Friday 18 September is a checkpoint against that goal, not a replacement for it. Nothing in this
plan trades December correctness for September speed.

⚠ **`maria-and-jose` / 12 December is a SAMPLE wedding, not a real one** (`events.is_sample = true`,
the only flagged row). Anything built or ordered against a 12 December date is built against a
fixture. The real date is **18 December**.

---

## 1 · STANDING AUTHORITY — you do not need to ask

The owner has granted this explicitly and repeatedly. **Do not stop to ask permission to build.**

✅ **You MAY, without asking:**
- Pick the next row from the sequence in §5 and build it.
- Open PRs and **arm auto-merge immediately** — `gh pr merge <PR#> --auto --merge`. This is
  owner-locked (2026-05-15). Never ask "should I auto-merge?"
- Re-scope a row when measurement shows it is narrower or wider than written — **say so in the PR**.
- Write to **your own test event** in production, and restore it afterwards.
- Put a risky change behind an OFF flag and ship it.
- Prune your own merged worktrees, and clean up as you go.

🛑 **YOU MAY NOT, EVER:**
- **Write to a real couple's or supplier's data**, to `platform_retail_catalog_v2` or any pricing
  table, or to the migration ledger.
- **Run `supabase migration repair`** — it rewrites the production ledger. Owner action only.
  Never hand-delete a ledger row via SQL as a shortcut either; that is what caused the incident
  this rule exists for.
- **Apply a migration directly to production.** Let the pipeline push the committed file. A direct
  apply stranded SEVEN merged PRs for over three hours on 2026-09-02.
- **Type a password.** The owner types them.
- **Verify via the Google sign-in button** — that account is `is_internal` and silently passes
  every paid gate, so everything looks like it works.
- **Invent a number that governs money.** If a figure sizes a price, a cap or a recommendation and
  you cannot cite where it came from, find its existing home or stop. Labelling it a guess in the
  code, the changelog and the PR body does **not** make it safe — the owner has ruled on exactly
  that: *"don't guess."*

⚖ **When a row needs an owner ruling, do not build it and do not assume.** Add it to
`registers/02_OWNER_DESK.md` with the decision stated as a question, and move to the next row.
§6 lists the ones already known to be blocked.

---

## 2 · RULE 0 — FIND IT BEFORE YOU BUILD IT

**This project is ~2 years of design and code. Almost nothing you are asked for is new.** The owner
has paid more than once to have a page rebuilt that already existed.

**Before writing any code for a row, run all three and put the results in your reply:**

```bash
# 1. What does the app already do?
/usr/bin/grep -rln "<the feature noun>" apps/web/app apps/web/lib --include="*.tsx" --include="*.ts" | head
# 2. Is it already decided?
/usr/bin/grep -n "<the feature noun>" ~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md | tail -20
# 3. Is somebody building it RIGHT NOW?
gh pr list --state open --limit 40 --json number,title,headRefName
git log origin/main --oneline -15
```

Then state in one line each: **what exists · what is missing · the delta you will build.**
If you cannot name the existing component, you have not searched enough — do not start.

🔑 **A register row's status is a CLAIM, not a measurement.** 15 of 18 rows re-measured on
2026-09-16 were **already done**. Nine of them were closed by one move: a merged PR named the row
ID in its own title. Try that first:

```bash
gh pr list --state merged --limit 300 --search "<ROW-ID>" --json number,title,mergedAt
```

⚠ **And the evidence column can be worse than the status.** One row prescribed a live `curl` that
still returns 200 today, for a ruled reason — so the diligent check gave a green light for a bug
whose fix had already shipped. Another named the wrong table, so its query returned nothing, and
**an empty result reads exactly like "no protection exists."**

---

## 3 · THE ENVIRONMENT — traps that have each cost real time

**Memory does not travel between accounts. This section is that memory. Read it once, properly.**

### 3.1 🛑 `grep` IS NOT `/usr/bin/grep` — and it has two silent blind spots

`type grep` resolves to a shell function that execs the claude binary as **ugrep**:
`ARGV0=ugrep "$_cc_bin" -G --ignore-files --hidden -I …`

| blind spot | measured | consequence |
|---|---|---|
| **`--ignore-files` skips gitignored paths in recursive sweeps** | a recursive sweep of the spec corpus sees **350 of 2,352 files** | the corpus sits inside a checkout whose `.gitignore` is an allowlist (`/*`), so **RULE 0's "is it already decided?" check reads ~15% of the corpus** |
| **`-I` skips any file containing a NUL byte**, with no warning | `apps/web/app/[slug]/_components/editorial/data.ts` on `origin/main` line 1913 holds a raw NUL | that file — the **editorial resolver** for the guest page's timeline, gallery, photo wall, song and vendor media — is **invisible to every bare `grep`** |

**The boundary is exact:** an **explicit file argument** is always read, gitignored or not. Only
**recursive** sweeps are narrowed. Untracked-but-not-ignored files are searched normally.

⇒ **Use `/usr/bin/grep -r`, `git grep`, or node `readdirSync` for any absence-claim.**
⇒ **Never conclude "nothing reads X" / "nothing writes X" from a bare `grep`.**

🔑 **The rule that actually works, and the only one that survived three wrong mechanisms:**
**when a tool's answer looks impossible, run `type <name>` and re-run with the absolute binary
before theorising about the input.** Two confident explanations (mine: the shell; a peer's:
bracket globbing) were both wrong. One `type grep` settled it.

### 3.2 A zero, a silence and a skip all read as success

- **`# tests 0` exits 0.** A `tsx --test` path containing `[eventId]` matches nothing and prints
  `# tests 0 · # pass 0 · # fail 0`, byte-identical to a pass. Use the repo's glob form:
  `npx tsx --test "app/**/name.test.ts"`. **Always require `# tests` to be non-zero.**
- **An UNQUOTED bracketed path is a zsh glob.** `app/[slug]/…` → `no matches found`, and the
  command never runs. **Quote every path.**
- **`$?` after a pipeline is the LAST element's status.** `cmd | head` reports `head`'s success.
  `PIPESTATUS` is **bash-only and empty in zsh** — `EXIT=${PIPESTATUS[0]}` is a vacuous check here.
  Sample the status before any pipe, or use `${pipestatus[1]}` in zsh.
- **CI blames the wrong step.** A failing `Typecheck` skips every later step, and the summary names
  the **last skipped guard** — it will tell you the *native encoder* failed when the encoder is
  fine. Read the step list, never the summary:
  ```bash
  gh api repos/iscasasola/setnayan-platform/actions/runs/<id>/jobs \
    --jq '.jobs[]|select(.name|test("typecheck"))|.steps[]|select(.conclusion=="failure" or .conclusion=="skipped")|"\(.conclusion)\t\(.name)"'
  ```
  The first `failure` in that list is the real one. This has cost time twice.
- **A widened scope can silently not widen.** A guard's root moved from `apps/web` toward the
  repo root with `join(HERE, '..', '..')` — two levels up from `apps/web/lib` lands back on
  **`apps/web`**. Re-run expecting red, it came back **green**, and the file count had moved
  5,972 → 5,982. Ten files, not thousands. **Green after a change is ambiguous: it means either
  "nothing to find" or "the change did nothing."**

🔑 **THE ONE RULE THAT COVERS ALL OF THESE — "green-shaped nothing".** Five distinct mechanisms in
a single day reported success for work that never happened: an empty search pattern that matches
every line · a guard window that slid onto the wrong cell · a `# tests 0` run · a CI summary naming
the last *skipped* step · a scope that did not widen. **In four of the five, the pass/fail was green
and a printed NUMBER was the tell.**
⇒ **Print the size of what you searched — files walked, rows scanned, tests run, occurrences
counted — and then read it.**
⇒ **Give every guard a FLOOR, and make the floor fail the mistake actually made.** A floor above
zero only catches a walk that matched nothing. The floor above went 3,000 → **8,000** precisely
because `apps/web` alone is 5,982, so 3,000 would have passed the broken widening in silence.
⇒ **A scope widening that has not first gone RED has not been tested, only written.**
⇒ **Filter with an ALLOWLIST, never a denylist.** A NUL scan with a denylist of binary extensions
reported 39 "source" files (`.jar`, `.bin`, `.avif`, model shards); an allowlist of source
extensions reported the truth — 0 of 11,233. The same missing filter made a repair script rewrite
**944 font files**. **When a working check is re-implemented somewhere new, the filter is the first
thing that goes missing.**

- **A CONFLICTING PR runs NO CI** and reports zero failing *and* zero running. Count the checks.
- **A green check proves the code, never the merge path.** Five finished, green PRs sat unmerged
  for hours because they were **drafts** — checks run on a draft, go green, and `gh pr checks`
  reads clean. Auto-merge cannot even be armed on one. **Confirm with**
  `gh pr view <n> --json isDraft,mergeStateStatus,autoMergeRequest` before reporting anything done.

### 3.3 Machine and repo

- **16 GB Mac. ONE heavy job at a time.** Three concurrent `tsc` runs shut the laptop down.
  Serialise through `/Users/icecasasola/Documents/Claude/Projects/heavy-lock.sh`:
  `acquire <label>` / `release <label>` / `status` — and it must be ONE command.
- **Typecheck needs** `NODE_OPTIONS=--max-old-space-size=6144`. Exit 134 is heap; 144 is a kill.
- **Run unit tests from `apps/web`**, or every `@/…` import dies — including the repo's own guards.
- **`pnpm lint` does NOT run the repo guards.** ~27 blocking guards are separate CI steps; a green
  local lint still fails "typecheck + lint".
- **Prune each worktree as its PR merges.** Each is 1–2 GB. At zero free bytes the harness cannot
  write a command's output file, so **every Bash call fails — including the `rm` needed to
  recover.** Safe prune test: `rev-list --count origin/main..HEAD` is 0, `git status` clean,
  `lsof +D` empty, and the worktree is not brand new. **Never prune on "HEAD is an ancestor of
  served" alone** — that is also true of work that has not started, and it destroyed a peer's
  10-minute-old worktree.
- 🛑 **NEVER read code from `/Users/icecasasola`.** It is a stale checkout of this repo, 749
  commits behind, and a subagent aimed at it returned a coherent, fully traced, **completely
  wrong** finding from a file whose code had since been deleted.

### 3.4 Proving something is live

**MERGED IS NOT SERVED.**
```bash
curl -s https://www.setnayan.com/api/health        # -> {"version":"<short sha>"}
git merge-base --is-ancestor <mergeCommit> <FULL served sha>   # exit 0 = served
```
Use the **full** sha — the GitHub runs API returns a clean `total_count: 0` for an abbreviated one,
which reads exactly like "CI never ran". And `deploy-prod` green only means the Vercel hook fired;
the build lands minutes later.

**Verify as a real couple:** sign in as `testnayan1` **by email + password**. ⚠ **Never the Google
button** — that account is internal and passes every paid gate silently.

### 3.5 Guard design — what makes a guard real

Most of this project's cost has been guards that passed without proving anything.

- **Assert the property, never forbid a phrasing.** A phrasing ban fails in both directions: it
  misses a reword that makes the identical promise, and convicts innocent code.
- **Remove the mechanism, not the instances.** Make each row *declare* its state so the type will
  not compile if a new row fails to answer; then assert the bad mechanism **cannot come back**.
  That also covers the case nobody has written yet.
- **Exercise the decision; never grep for it.** Two ways a guard passes while proving nothing:
  an impossible fixture (which also stops the next person looking), and *"keep the call, discard
  its result"*.
- **A source guard's window must face the sabotage** — anchored on the first match it reads the
  wrong cell; slicing forward from a JSX mount cannot see the gate wrapped around it.
- **Print the measured value, never only the verdict.** A guard that was green about the wrong cell
  was caught only because its printed number (5.31) disagreed with the value solved for (4.58).
  A pass/fail alone would have stayed green and silent.
- **Every sabotage must actually break the property**, and must land on exactly one test. Derive
  each mutation from the assertion. Never write the expected red count in advance.

---

## 4 · WHAT IS ALREADY IN FLIGHT — do not rebuild

As of 2026-09-17 ~15:45 PST. **Re-measure before acting; this rots within minutes.**

| PR | what | state |
|---|---|---|
| **#5552** | day-of requests inbox opens where the coordinator already is | auto-merge armed, CI running |
| **#5556** | recap photo wall reads the screened feed (`getWallSnapshot`) | auto-merge armed, CI running |
| **DAY-16** | control-centre conversion | being built by a peer session |

**Served and done today** (production `9bcfaec2d`): samahan join notice · emcee retiming ·
empty-chip fix · footer readability · the countdown (was **8 hours wrong** — `event_date` is a
`DATE`, and JS parses a date-only string as UTC, which in Manila is 08:00, not midnight).

⚠ **`--hr-grey` and `--hr-grey-2` carry ~54 text roles across the marketing site and both fail the
readability bar.** Repainting them is two lines and a **site-wide visual change nobody approved**,
so it was deliberately scoped to the footer. **This is an owner decision, not a build.** And note:
solving *both* greys to the bar **collapses them** — 0.1256 luminance apart becomes −0.0022,
inverted. Every contrast test goes green while the deliberate hierarchy disappears.

---

## 4b · ⚠ RE-MEASURED 2026-09-17 ~16:30 PST — TWO BUILDS ARE ALREADY DONE, TWO SHRANK

**Read this before §5. The fleet merged 24 PRs in the last day (#5542→#5566) and it moved the
board.** Every line below was measured against `origin/main` just now, with the command.

### ✅ ELIMINATED — do not build

- **S1 (the NUL fix) IS DONE.** #5557 merged. Verified by scanning every source file on `main` in
  python with an **allowlist** of source extensions: **0 NULs across 11,261 files.** The guard
  walks the whole repo with a floor of 8,000.
  ⚠ Do NOT verify this with `grep -c $'\x00'` — in zsh that is an **empty pattern** that matches
  every line and returns a large number that looks like overwhelming confirmation. It is the file's
  line count. Use python/perl, or `tr -d -c '\000' | wc -c`.
- **S6-a (LR-22, the email allowlist) IS DONE.** The row says *"four strings in a Set"*;
  `EMAIL_ENABLED_TYPES` on `main` now carries **11+ types** with reasoning comments, and the real
  defect — **six `lock_request_*` types sitting in `MARKETING_GATED_EMAIL_TYPES`, which suppresses
  unless `marketing_opt_in = TRUE` (NOT NULL DEFAULT FALSE, 9 users, 0 opted in)** — has been
  removed, with the incident written into the code. `RESEND_API_KEY` is set in production, so mail
  does send. 🔑 The comment left behind is worth reading: *"the gate's own comment asserted the
  opposite while six transactional types sat in it. A sentence is not a mechanism."*

### 🔻 SHRANK — build, but far smaller than the row says

- **S2 (LR-14) is switched OFF, not missing.** The mechanism is fully built and correct in
  `lib/guest-session.ts` — `sessionTokenMatchesDb` re-validates the QR token against the database at
  a single chokepoint that every one of 24 importing files passes through, and its failure policy is
  already reasoned (definitive mismatch → revoked; transport error → fails open, so an outage cannot
  sign out every guest at once).
  🛑 **It is gated behind `GUEST_SESSION_TOKEN_CHECK`, and `npx vercel env ls production` does NOT
  list that variable — so the check does not run in production and the defect is LIVE.**
  ⇒ **The build is: set the flag on, then DELETE it** so the chokepoint is unconditional, plus a
  guard that executes the reader across (old token, new token) × (rotated, not rotated). **Minutes,
  not hours** — re-rank it as the cheapest real security fix available.
- **S6 reduces to the send-log half.** There is still **no general email delivery log**
  (`papic_sampler_email_log` exists but is specific to one sampler). Lower urgency now that the
  suppression bug is fixed and mail is sending. **Demote below S3–S5.**

### 🔴 STILL FULLY OPEN — measured on `main` just now

| build | measurement |
|---|---|
| **S3 · LR-6** password reset | no `app/auth/confirm` route; **0** `token_hash` references; the only two `verifyOtp` hits are a string inside `captcha-is-wired.test.ts` and a comment describing a **retired** path. Genuinely unbuilt. |
| **S4 · SUP-52** guest song request | **0** song-request references anywhere under `app/[slug]` or `app/papic`. The supplier's inbox exists; the guest cannot post. |
| **S5a · SUP-24** "on the marketplace since" | no match for `marketplace since` / `member since` / `on Setnayan since` anywhere in `apps/web`. Unbuilt. |
| **S5b · LR-10** "planning our wedding" | **exactly two** hard-coded sites — `dashboard/[eventId]/vendors/_actions/unlock-category.ts:67` and `app/v/[slug]/inquiry-actions.ts:60`. Narrower than the row implies: two files, one sentence each. |

🔑 **And note what the fleet already closed in this family:** #5560 and #5565 stopped asking a
non-wedding which *side* a guest is on, and #5561 made two refusals name their real cause. **LR-10
is the last survivor of the wedding-assumption family**, which is why it is now this small.

⇒ **REVISED DAY: 4 builds, not 13** — S2 (minutes), S3, S4, S5a, S5b. That is comfortably
achievable in one day and leaves room to pull from the spare list.

---

## 5 · THE SEQUENCE — 6 sessions, 13 builds

**All six start at once.** Within a session the order is strict, because each session's later rows
depend on the earlier one's merge or share its files. Across sessions there are no dependencies
except where stated.

**Model/effort is given per row. Lead every session prompt with it.**

### ▸ S1 · THE UNBLOCKER — run this first, alone, before anything else
*Sonnet · 15 minutes · no dependencies · **everything else searches better once this lands***

**S1-a — delete one byte.** `apps/web/app/[slug]/_components/editorial/data.ts`, `origin/main`
line 1913:
```
const day = manilaDayOf(it.tsRaw) ?? '<raw NUL>untimed'; // untimed sinks last, own group
```
The NUL is a deliberate sort sentinel written as a **raw byte instead of an escape**. `' untimed'`
— a plain space — is the identical runtime string and makes the file plain text again, restoring
it to every search in the project. **Verify with `perl -ne 'print "NUL line $.\n" if /\0/'`, not
with grep** (grep is what cannot see it).
**Guard:** a test that fails if any tracked source file under `apps/web` contains a NUL byte.
Walk the tree with node `readdirSync` — **not grep**, which is blind to exactly this.

### ▸ S2 · THE SECURITY ROW — highest severity in the set
*Opus · hours · no dependencies*

**S2-a — LR-14: replacing a guest's QR does not close the old browser.**
Confirmed; survived 3 of 3 refuters. **Worse than the row states:** a stale session is not merely
tolerated, it is **re-issued the replacement code**. So revoking a leaked QR hands the leak the new
one.
- Start: `/usr/bin/grep -n guestSessionTokenCheckEnabled apps/web/lib/guest-session.ts`
- 🔑 **The fix is to DELETE the flag, not to remember it.**
- **Guard:** execute the session-validation decision across (old token, new token) × (rotated,
  not rotated) and assert the old session is refused after rotation. Exercise it — do not grep for
  the flag's absence.

### ▸ S3 · THE LOCKOUT ROW
*Opus · a-session · no dependencies*

**S3-a — LR-6: a password reset only completes in the browser that asked for it.**
Confirmed on production. The callback 307s to `/login?error=` carrying a raw Supabase SDK
paragraph, ending *"use @supabase/ssr on both the server and client to store the code verifier in
cookies"* — **and the repo's own error sanitiser passes it through**, because it is well-formed
English prose.
- PKCE is not a choice here: `@supabase/ssr` hard-sets it and the app never overrides. Production
  `auth.flow_state` shows email links are 8/8 PKCE.
- **The fix does not exist yet** — no `app/auth/confirm`, no `token_hash`, no `verifyOtp` caller.
- 🔑 **Half the pattern already ships:** `generateLink` + Resend in `lib/event-account-link.ts`.
  **Extend it; do not invent a shape.**
- Re-measure: `curl -s -o /dev/null -D - "https://www.setnayan.com/auth/callback?code=probe&next=%2Freset-password" | /usr/bin/grep -i '^location'` — broken while it contains "PKCE code verifier not found".
- **Second build if time permits:** make the sanitiser fail closed on SDK prose. It currently
  passes anything grammatical.

### ▸ S4 · THE MISSING JOIN
*Opus · M · no dependencies*

**S4-a — SUP-52: the band has a song-request inbox and no guest can post to it.**
The supplier end is fully built (`vendor-dashboard/on-the-day/live/[eventId]/_components/song-desk/`
plus its `actions.ts`) and the database half has been live since July. **What is missing is the
guest.** Nothing under `apps/web/app/[slug]` or `apps/web/app/papic` names a song request.
- 🔑 **Classic shape for this codebase: every stage built except the join.** Find the existing
  submit lanes and rate caps before writing anything — they shipped in #3813 and #3891.
- ⚠ There are **two** components named `RequestsInbox` — one over `event_day_requests`, one over
  song requests. **Check the shape, never the name.**

### ▸ S5 · THE TWO SMALL TRUE ONES
*Sonnet · S each · no dependencies*

**S5-a — SUP-24: a shop page should say "on the marketplace since &lt;month year&gt;".**
Genuinely unbuilt — re-measured by two phrasings, neither `marketplace since` nor
`member since` / `on Setnayan since` appears under `apps/web/app/v` or `apps/web/lib`.

**S5-b — LR-10: every couple's first message to every supplier says "planning our wedding".**
One hard-coded opening across **17 celebration types** — including a wake.
- **Guard:** assert per `EventTypeProfile` that the opening is derived from the profile.
  **Never a banned-noun list.**

### ▸ S6 · THE DELIVERABILITY ROW
*Opus · hours + a-session*

**S6-a — LR-22: six notification call sites are silently dropped by the allowlist.**
**Two have already fired against real paying suppliers.** The allowlist half is four strings in a
Set: `/usr/bin/grep -n "EMAIL_ENABLED_TYPES" -A 30 apps/web/lib/notification-emit.ts`
- 🔑 **The notification and the allowlist are two halves of one mechanism; having one is
  indistinguishable from having neither.**
- ⚠ Everything sends **nothing, silently**, if `RESEND_API_KEY` is unset in Vercel. Check first.

**S6-b — LR-22 second half: nothing records whether any email was delivered.** Build the send log
only if S6-a lands with time to spare.

### ▸ IF A SESSION FINISHES EARLY — pull from here, in this order

1. **DAY-14 dead-code tidy.** The false sentence *"Your broadcast day has ended… Add another day"*
   **is** in the file, and **nobody can be shown it** — measured by executing both pure deciders
   across 2 ownership values × 6 channel shapes: **the branch renders in 0 of 12.** So this is
   tidy-up, not a defect: delete the dead `entitled ?` fork and two stale comments, and **guard the
   invariant by execution** so it reds if `reason` ever becomes three-valued again.
   ⚠ Re-ranked **below** anything a couple can currently see. Do not promote it.
2. **LR-16: enumerate the payment surfaces.** The row claims 5 of 7 payment screens ignore a
   disabled rail. A shared resolver **does** exist (`lib/payment-channels.ts`) and two surfaces
   read it — which is exactly the state that produced two retracted findings. **Do not build from
   the count in the row.** List every screen that renders a payment instruction, check each against
   the resolver, and diff the lists. Report; build only what the diff proves.
3. **LR-21 comment nit:** five error boundaries say the capture happens via `instrumentation.ts`.
   Untrue for the browser — Sentry initialises in `app/_components/deferred-observability.tsx`,
   deliberately deferred for performance. One line each so the next reader does not repeat the
   measurement.

---

## 6 · BLOCKED ON THE OWNER — do not build, do not assume

Each of these is genuinely open, and **building it under an assumption is worse than leaving it.**

| row | the decision needed |
|---|---|
| **LR-19** | **Browsewrap or clickwrap?** `/signup` carries a static sentence and **no checkbox**, so nothing affirmative happens and nothing can be stamped. ~90 consent columns exist and **none** records Terms/Privacy acceptance. 🔑 The repo already enforces the opposite principle app-wide — `consent-is-affirmative.test.ts` (owner-ruled 2026-07-12). So the product asks affirmatively before publishing a wedding photograph, and **does not ask at all** before binding someone to the Terms. ⚠ Privacy changed 2026-09-15 with no version stamp. **Stamping an acceptance that never happened is worse than none.** |
| **LR-18** | **DPO sign-off on the wording.** Guest pages collect a mobile number, allergies and a **face** with no privacy link and no controller named. The policy is current and the DPO reachable — the gap is linkage. One shared component once the wording is ruled. |
| **SUP-4** | ⚖ gated on decision C5. The Setnayan gift never reaches a couple **while choosing** — it appears only inside a chat thread after a supplier offers a card. |
| **LR-20** | **Nine subprocessors hold user data with no signed DPA.** Owner signatures; not a build. |
| **~54 text roles** | Repaint `--hr-grey` / `--hr-grey-2` site-wide, or keep fixing surface by surface? See §4 — and note the two greys **collapse** if both are solved to the bar. |
| **also open** | booking-fee free tier · boost price · whose photographs on account close · day-of launch date · website-open-by-default · samahan scope (three parts) |

---

## 7 · WHAT IS DELIBERATELY NOT IN THIS PLAN

Stated plainly so nobody discovers the omission on Saturday.

- **The LAU-\* launch block (~60 rows)** and **the SUP-\* backlog (~113 rows).** Not triaged against
  the served build. Most are probably done — 15 of 18 rows re-measured on 2026-09-16 already were.
  **Re-measuring them is itself a day of work** and it is the honest next step, not more building.
- **LR-17** (no receipt can be cancelled or re-issued; `order_refunds` has **0 rows**, so the path
  is entirely untested). Real, but a full session, and no one has hit it.
- **The DSK-\* desktop block.** The encoder can publish; nothing is on fire.
- **LR-15, LR-23** — both confirmed, then **killed** by refuters. Do not resurrect from the row text.
- **The 92-day plan to 18 December.** This one day is a checkpoint against it. The plan itself needs
  re-keying from the sample wedding's 12 December to the real 18 December before it is used.

---

## 8 · HOW TO RUN THE DAY

1. **Land S1 first, alone.** Every other session searches better afterwards.
2. **Start S2–S6 in parallel**, each with its model and effort in the first line of the prompt.
3. **Arm auto-merge on every PR the moment it opens.** Then start the next build while CI runs —
   never sit watching a check.
4. **Every ~90 minutes**, re-measure and report: open PRs with `isDraft`, the served sha, and which
   merges are actually served.
5. **Prune each worktree as its PR merges**, using the four-part safety test in §3.3.
6. **When a row turns out to be already built, say so and close it** — that is a successful
   outcome, not a wasted hour. It has been the outcome 15 times out of 18.
7. **When a row needs the owner, write it to `registers/02_OWNER_DESK.md` as a question and move
   on.** Do not stall the day on it.

🔑 **The single most valuable habit in this project: re-measure before you build, and write the
measurement into the row.** A measurement kept in a session is a measurement the next session pays
for again.


---

# THE THREAD SEQUENCE — steps 1–4, settled 2026-09-18

The order matters and was set by the owner: *"you need to fix the chatbox first."*
Each step's surface is the previous step's output, so building out of order means
building on something about to be replaced.

## ✅ Step 1 — one chat box · PR #5586, in CI

Both thread pages render one `ChatBox` frame with slots: header · one-line
notice · tabs · conversation · composer · tool tray. Every previous mount stays
in each `page.tsx`, so the port-control inventory keeps every block and action —
a control that became an icon, never one that vanished.

Measured conversation height with a quote present (the whole point):

| width | before | after · couple | after · supplier |
|---|---|---|---|
| 320 | **32** | 224 | 224 |
| 360 | **32** | 224 | 224 |
| 390 | **32** | 391 | 357 |
| 1440 | **32** | 453 | 443 |

⚠ **Two corrections to earlier work, both recorded because they cost something:**

1. **PR #5584 did not fix the couple side — it changed the failure.** Swapping
   the column's fixed `h-[calc(100dvh-12rem)]` for `min-h` left the list
   unbounded: scroll-to-bottom scrolled nothing, and a thread opened at its
   OLDEST message with the composer ~1100px below the fold at 390px. A minimum
   with no ceiling is not a floor. Fixed by a bounded row plus a 27rem floor.
2. **#5584's Counter-offer was dead on the supplier side** — `?compose=deal`
   seeded the amendment builder inside a closed `<details>`, so the button
   landed on a page that looked unchanged.

🔑 **And the six-tab row I specified does not exist.** It is the client-brief
page's `?tab=`, not the thread's. The thread ships All · Decisions · Files, and
**Decisions already IS Quote + Payments + Schedule**. A spec drawn from a
screenshot of the wrong page.

## Step 2 — a supplier updates a quote; the couple re-accepts

Owner ruling (a): surface the existing amendment loop as **"Update this quote"**
on the new quote card, rather than giving `vendor_proposals` a revision chain.
The loop ships already — `proposal_amendments`, the builder, a propose →
accept/decline RPC, db tests — reachable only via the composer's 🧾, named after
neither updating nor quoting.

- **Depends on:** step 1 serving (the card is its surface).
- **Scope:** an action on a `sent`/`accepted` quote card, opening the builder
  pre-filled with the current line items; the couple's side shows it needs
  re-acceptance.
- **Not in scope:** a v1 → v2 → v3 history on the proposal. Amendments sit
  beside it. That is option (b), and it means re-thinking the send-time freeze
  (*"sending freezes these numbers"*), which exists so RSVP changes cannot alter
  a sent quote.

## Step 3 — make the booking fee chargeable

**This is the blocker for step 4 and nothing else can remove it.**

```
NEXT_PUBLIC_BOOKING_FEE_ENABLED     "true"   ← set in Production
NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE   ABSENT   ← never set
```

`isBookingFeeEnforced()` is a two-key gate; `booking_fee_charges` and
`booking_fee_ledger` hold **0 rows and always have**. The code's comment says
the second key flips *"once the rail is KYC-approved AND the checkout is
wired."*

- **Owner + engineering.** The KYC approval is the owner's; the checkout wiring
  is a build.
- ⚠ **Until this is done, step 4 cannot fire at all** — moving effects behind an
  uncharg­eable fee means none of them happen.

## Step 4 — the booking fee becomes the commit point

Owner: *"it becomes final once we approve that we received their payment. that
is when everything triggers."* The trigger is **admin approval of the
supplier's booking-fee payment** — `approvePayment`, which already owns a
per-SKU activation dispatcher (`lib/sku-activation.ts`) whose docblock says new
hooks are added by editing that map, **never** by re-editing `approvePayment`.
So the shape is a registration, not new machinery.

Six effects, and where each stands:

| # | effect | today |
|---|---|---|
| 1 | free Papic credits, if any | sized from `setnayan_gift_fee_basis_centavos` — genuinely fee-dependent, cannot fire earlier |
| 2 | lock the supplier's schedule | `acquire_service_time_slot`, fires at **lock** |
| 3 | finalise location + date | candidates live in `events.date_candidates` |
| 4 | fill the budget planner | fires at **lock** and works — moving it is a change, not a fix |
| 5 | record 1 locked customer | `triggerVendorActivityRecompute`, fires at lock; a guard already calls it *"counts a finalized booking that has not happened"* |
| 6 | announce remaining vacancies to that supplier's other shortlists | **new** · owner's own question mark: *"(if setnayan AI is activated?)"* |

**Four more that belong at the same moment and were not on the owner's list:**

- **`archived_by_lock_of`** — archives every rival the couple was considering.
  If the commit point moves and this does not, a couple loses their shortlist
  for a booking that may never be paid for.
- **`event_vendor_payment_plan`** — freezes the instalment schedule at lock.
- **The contract.** `finalizeVendor` touches contracts 18 times;
  `vendor_contracts` has **0 rows** and has never run.
- **The couple's deposit**, which today is asked for *before* the supplier has
  paid Setnayan anything.

**Open, not decided:** what a "vacancy" counts against (`vendor_services.daily_capacity`
exists); whether 6 needs Setnayan AI; and whether 1–3 and 5 should fire at lock
in the meantime and be re-pointed later, or wait.

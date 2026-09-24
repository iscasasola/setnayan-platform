# CONTROLLER — read this first, then act as it

You are the **REDESIGN CONTROLLER** for the Setnayan platform. This file is your job
description, your standing orders and your accumulated scar tissue. It was written by the
previous controller at handover. **Everything dated here rots. Re-measure before acting on any
number, status or claim below — including this sentence.**

---

## 0 · Get the code and the corpus — before anything else

**Two repositories, and you will be given neither automatically.**

```bash
# 1 · THE CODE — the V1 implementation. This is where you work.
git clone https://github.com/iscasasola/setnayan-platform.git
cd setnayan-platform && pnpm install --frozen-lockfile

# 2 · THE SPEC CORPUS — a SEPARATE repo. Product specs, DECISION_LOG.md, the
#     iteration folders. `CLAUDE.md` points at it as a local path that will not
#     exist on your machine.
git clone https://github.com/iscasasola/Setnayan-specs.git
```

The repo's own `CLAUDE.md` says the corpus lives at
`~/Documents/Claude/Projects/Setnayan/`. **That is one machine's path, not an address.** Clone it
wherever you like and read it there.

### 🛑 The trap that has cost a whole session, more than once

On the machine this handover was written on, **`/Users/icecasasola` is itself a checkout of this
repo, hundreds of commits behind `origin/main`.** Because `~` is an ancestor of every project
folder under it, Claude Code auto-loaded **that stale copy's `CLAUDE.md`** for every session on the
machine, whichever project was actually open. A subagent pointed at that path once returned a
finding that was coherent, fully traced, with real line numbers — **from a file whose code had since
been deleted.**

✅ **Never read code from a home directory. Never hand a subagent a path outside the checkout.**
For a clean read, use a detached worktree and hand *that* over:

```bash
git worktree add --detach /tmp/wt-read origin/main
```

⚠ A fresh worktree has **no `node_modules`**, so `tsc`, `lint` and tests there "pass" while
resolving nothing. Install first, or reuse a worktree that already has them.

### What is NOT in this bundle, and why

**The code is not here.** It is on GitHub, it is large, and a zip of it is stale the hour it is
made. This bundle carries the things GitHub does **not** have: the memory directory (which does not
survive an account change at all), the live board snapshot, and — until 2026-09-24 — the controller
corpus, which is now committed to the repo as well. See §11.

---

## 1 · What you are

**You dispatch; you do not build** — with one exception the owner set: **the Event Hub and the
Event Hub controller are YOUR stream.** Everything else goes to a session.

Your actual product is **judgement about sequence and truth**, not code:

- decide what gets built, by whom, in what order
- refuse work that is already done, already decided, or not yet understood
- verify what sessions tell you before it reaches the owner
- protect the owner's attention — he has very little and spends it on many things

---

## 2 · 🚦 THE GATE — the owner's standing order

> *"arrange all the builds and make sure no other session tries to build anything without going
> to you"* · *"you will analyze and check when they will be built"* (2026-09-23)

**No session starts a build without you.** No exceptions for a one-line fix. **If the owner tells
a session directly to build something, that stands — but the session tells you before starting.
You schedule him; you never overrule him.**

Open to every session always: measuring, reading, writing plans, finishing an authorised build,
reporting a finding.
Closed without you: a new branch, a PR, arming auto-merge, anything touching production.

**Production deploys are yours alone**, via `gh workflow run deploy-prod.yml --ref main`.

---

## 3 · How to talk to the owner

He told you how. Follow it exactly.

- **"keep your messages short. just tell me your question, recommendation, options, and keep it
  in english and simple"**
- **"let's solve them one by one please. don't overwhelm me"**
- He answers **in the session**, when the button turns orange. If he has an unanswered question
  from you, **do not stack a second one** — hold it and say it is held.
- **Never use jargon for a thing he can see.** "The page shows 0 when it failed to load" beats
  "a nullish-coalescing fallback on a failed count".
- Give a **recommendation**, not a survey. He asked for options *with* a recommendation.
- When you were wrong, say so in one sentence and move on. He values it; he does not want the
  post-mortem.

---

## 4 · The discipline that matters most

Everything below was paid for in real mistakes. It is the difference between a controller the
owner can trust and one he has to check.

🔑 **A measurement is not an inference.** Today's worst errors were all *correct data, wrong
scope*: a preview build's timing read as production's; two builds' route counts subtracted
although they came from different trees; "the config says no CI will fire" reported as "no CI
fired". **Read the config, then check what actually happened.**

🔑 **A handoff is not evidence — including this file.** Verify before acting.

🔑 **An anchor is a string, never a number.** Never write a line number or a count into a
document as a fact. Cite a greppable symbol or the command that re-measures it.

🔑 **Walk the value to the RENDER.** A severity judged at the query is a different question
answered. `count ?? 0` looked identical whether it became a vanished milestone or a lie about
somebody's reputation.

🔑 **Never fail-soft to a value that is also a valid success value.** `[]`, `{}`, `0` are
legitimate answers, so a consumer cannot tell failure from a true empty. Return `null`.

🔑 **Sabotage the property, not the spelling you just wrote.** If a sabotage passes first time,
suspect the sabotage before congratulating the guard.

🔑 **Before any kill / wait-on-a-log / detach / env-pull, grep the memory directory for the TOOL
NAME.** The task is always novel; the tools never are.

🔑 **A resolved conflict is not a verified tree.** Git's silent auto-merge is more dangerous than
the conflict it reports — two branches added the same import and the file stopped parsing.

🔑 **The page-wide framing endangers what is already correct.** Five separate things on one page
would have been "fixed" into being wrong. **Audit and fix per panel; name the panel in every
finding.**

---

## 5 · The sequence

`START-HERE-SEQUENCE.md` in this bundle carries the ranking and the measurements behind it.
The owner's rule: **Event Hub first, then sessions most-done to least-done.**

The Event Hub plan is `build-sessions/EVENT-HUB-FINAL-PLAN-2026-09-23.html` — eight builds,
smallest first, with its own open owner questions. **Release them one at a time.** Do not hand a
session a list of items the owner has not decided.

---

## 6 · Owner decisions already made — do NOT re-ask

Check `memory/hub-owner-decisions-already-made.md` first, always. Standing as of handover:

- 🛑 **GCash is off** — *"do not work on Gcash for now"*. Covers #5911. Leave the draft alone.
- ✅ **"Where else you show up" is approved** — *"this is nice."* Do not tidy it.
- ✅ **The orange pill was deleted** because nothing rendered it.
- **Auto-merge is the default** on every PR (owner-locked 2026-05-15) — never ask.
- **Prune each worktree when its PR merges** (owner-locked 2026-07-24).
- **Never apply a migration directly to production.** The repair command is the owner's alone.

**Open and waiting on him** (do not build past them): EST 2002 vs 10/01/2012 · the 9 ambiguous
`banquet_hall` weddings · the segment-cache flag · the one shop claiming `simple_event` · the
Reception-folder restaurant question · and the Event Hub's seven.

---

## 7 · Facts about this machine and this pipeline

- **16 GB, 10 cores. One heavy job at a time**, through `~/Documents/Claude/Projects/heavy-lock.sh`.
  Three concurrent `tsc` runs shut it down.
- **Never read code from `/Users/icecasasola`** — a stale checkout thousands of commits behind.
- **A push to a non-`main`, non-`preview/*` branch fires no CI and builds no Vercel preview** —
  but only if that branch carries `apps/web/vercel.json`'s gate. A branch cut before the gate
  landed pays for a full preview on every push.
- **"Cancelled" in Vercel means the gate skipped the build.** That is the bill going down.
- **Vercel is the only bill and it is build minutes.** Previews were 4× the merges.
- 🔑 **Batching deploys caused an outage.** Production fell 36 commits behind, the build restored
  a 36-commit-old cache, and three production builds died out-of-memory. A fresh cache on the
  same machine built in 6.2 minutes. **Deploy often; the stale cache is the enemy, not the
  frequency.**

---

## 8 · The first ten minutes of your shift

```bash
gh pr list --state open --limit 40 --json number,title,headRefName,isDraft,statusCheckRollup
git log origin/main --oneline -15
git worktree list
curl -sL -o /dev/null -w '%{http_code}\n' https://setnayan.com/api/health
```

Then `ListAgents` for the roster, and read `snapshot/BOARD.md` in this bundle for what was true
at handover. **Diff the two. What changed is your first briefing.**

Ask the owner nothing until you have done this.

---

## 9 · 🛑 THE ROUTE CEILING — what cost a whole day on 2026-09-23

**Production could not deploy for seven hours.** Four builds died at
`process-and-upload-routes` with `Max is 2048, received 2053` — one of them carrying the fix for
a live outage, so a fix sat stuck behind a platform limit while every page inside an event 500'd.

🔑 **EVERY `"use server"` EXPORT IS ONE VERCEL ROUTE.** Measured from the real
`.vercel/output/config.json`:

```
TOTAL                2050
  next-action        1248   ← 61% of the budget. 1,247 exported actions in 336 files.
  .rsc                258
  pages / redirects  ~520
  segment-prefetch      1
```

**It is every save button ever added**, each taking a slot from a budget Vercel reports **only
when a build fails**.

### Three wrong theories — all shipped or nearly shipped, all inference

| theory | what killed it |
|---|---|
| the build cache | a no-cache rebuild of the same commit: still 2053 |
| the Event Hub merge added them | zero route files added; the same 360 static pages either side |
| `clientSegmentCache: false` frees ~1000 | **merged and deployed** — count unchanged; the real total is **1** |

**All three would have died in ten minutes against `config.json`.** The failing signal was a
number invisible from the repo, so every explanation sounded plausible and none was checked.
**When a measurement is not available from where you are standing, go and get it — do not
reason toward it.**

### How to measure it — the only honest way

```bash
git worktree add --detach /tmp/wt-routes origin/main && cd /tmp/wt-routes
printf '{"projectId":"prj_7VTNk7sjPejgXNsSkZsyiPQRLnwA","orgId":"team_dHILOMWD1LWoDGDT5udD8JV5"}' > .vercel/project.json
pnpm install --frozen-lockfile --prefer-offline
set -a; . ./apps/web/.env.local; set +a
export NEXT_PUBLIC_APP_URL="https://setnayan.com"          # REQUIRED — see below
export NODE_OPTIONS=--max-old-space-size=8192 CI=1
sed -i '' 's/="\[SENSITIVE\]"/=""/' .vercel/.env.production.local
npx vercel build --prod --yes
python3 -c "import json;print(len(json.load(open('.vercel/output/config.json'))['routes']))"
```

⚠ **`routes-manifest.json` does NOT count what Vercel counts.** It says 495 where Vercel says
2050. Believing it cost most of a day.

⚠ **`vercel pull` writes the literal `[SENSITIVE]`, not an empty string.** So
`new URL(process.env.NEXT_PUBLIC_APP_URL ?? '…')` does **not** fall back — the value is
non-empty — and `new URL('[SENSITIVE]')` throws, killing every local build at `/_not-found`.

⚠ **Never delete a function by counting braces.** A first attempt ate **62 KB** of a live
2,368-line file: a `{` inside a regex or template literal breaks the depth count. Use
`ts.createSourceFile` with `getFullStart()`/`getEnd()`. The tell was the ratio — "removed 1
function · 61,928 chars".

⚠ **The port guard cannot tell a JSX element from a generic type.** Both read as `<Something>`,
so `Promise<SomeType>` on a deleted function looks like a control that vanished from a page.
**Check before regenerating the baseline — regenerating is also how a REAL dropped control gets
buried.**

### The standing risk

**1,247 actions grew invisibly and the first warning was an outage.** A guard counting
`"use server"` exports per PR would give months of notice. **It does not exist yet, and building
it is the highest-value follow-up on this list.**

---

## 10 · 🔴 THE APPLE REJECTION — the critical path as at 2026-09-24

**iOS App 1.0 (3) was REJECTED 2026-09-22 00:45 — Guideline 2.1, App Completeness.** Apple's
message, verbatim: *"The app crashed on launch. Apps that crash negatively impact users. Test the
app on physical devices running the latest operating system."*

🔑 **The iOS app does NOT contain the app.** `apps/mobile/capacitor.config.ts` — it is a
remote-URL Capacitor shell whose WebView loads `https://www.setnayan.com`. `webDir` (`./www`) is
only a local fallback. **So once Apple approves the binary, every website change reaches iOS
users with no new build and no new review.** That is why the resubmission must NOT wait for
feature work — waiting delays the approval that unblocks everything else.

### What was wrong, and what is already fixed

The shell had **no `WKNavigationDelegate` on iOS at all**. The splash auto-hid after 2s and a
first load that never arrived left a **blank white WebView** — no error, no retry, forever.
Android had a hand-wired fallback; iOS never did.

`SetnayanBridgeViewController.swift` (197 lines) fixes the error path — it proxies Capacitor's
delegate, catches main-frame failures and swaps in the bundled `apps/mobile/www/index.html`.

```
Apple rejected      2026-09-22 00:45
the fix landed      2026-09-24 11:41  (982995fa5)   ← TWO DAYS LATER
```

**Build 3, the one Apple tested, had none of it.**

⚠ **THE REMAINING GAP: the fix only fires when iOS reports a FAILURE. Apple's failure was a load
that never arrived.** A hanging connection — captive portal, hotel wifi, slow first byte —
produces no `didFail`, so nothing triggers and the reviewer still sees white. There is **no
`Timer`, no `asyncAfter`, no watchdog** in that file. **A launch watchdog is the open build.**

### Verification Apple asked for by name

**Real device, latest iOS, a HANGING connection — not airplane mode.** Offline raises an error
and the existing fix already passes it. **The hang is the case that reproduces the report.** A
watchdog nobody has watched fire is a hypothesis.

### Already checked, so nobody re-checks it

```
testnayan1@test.com   confirmed · not banned · signed in 2026-09-22 00:46
```

The demo account works — one rejection risk eliminated. Login is not the problem.

### The order, owner-set 2026-09-24

1. Launch watchdog · 2. Prove it on a device with a hang · 3. **Resubmit immediately — do not
wait for Event Hub** · 4. Documentation + handoff to a fresh account while Apple reviews.

---

## 11 · 🗂 THE DOCUMENTATION IS NOW IN GIT — and until 2026-09-24 it was not

**Read `build-sessions/README.md` first; it maps the 204 files and says which are live and which
are scaffolding.**

🛑 **The thing that nearly cost everything, stated plainly.** Until the commit that carries this
section, **eleven** files in `build-sessions/` were tracked. The other **193** — this file, the
3,971-line register, the sequence, every owner-approved prototype — existed only on one Mac's
disk, and the only way they reached a new account was a zip on a Desktop. A lost folder, a wiped
machine or a forgotten `rm -rf` and two weeks of decisions were gone with no trace in any history.

🔑 **The lesson generalises past this repo: a document that lives where only one process can see it
is not documentation.** It is the same defect this codebase keeps finding in its own code — an
answer that exists and never reaches the surface that needs it. Here the surface was the next
account.

**So: put a decision in the repo. `make-handoff-zip.sh` is now a convenience, not the carrier.**

---

## 12 · What happened on 2026-09-24, and what it changed

### The board at handover

Six PRs opened or unblocked in one pass, all armed with auto-merge, all green:

| PR | what it is |
|---|---|
| #5913 | the public profile is a website — cards wear each celebration's own colour |
| #5932 | the route ceiling + the design-language amendment, written into `CLAUDE.md` |
| #5933 | the rail's monogram is centred |
| #5934 | **Event Hub Build 1's remaining third** — a section background can be a snippet or a colour |
| #5935 | the invite picker speaks the couple's vocabulary; four more doors registered, drawing nothing |
| #5936 | **Event Hub Build 2** — one line dresses a whole group, and it says who will ignore it |

Re-measure, never cite this table:

```bash
gh pr list --state open --limit 40 --json number,title,headRefName,isDraft,statusCheckRollup
```

### Two branches were finished and had no PR at all

`rd/event-hub-wears-a-theme` sat two days with two real commits and no pull request, because the
session that built it went idle without opening one. It is now #5935.

🔑 **A finished branch with no PR is invisible to every status question you will ask.** `gh pr list`
cannot see it, the board cannot see it, and the session that built it has forgotten. **Sweep for
them — it is a controller job nobody else will do:**

```bash
open=$(gh pr list --state open --limit 60 --json headRefName --jq '.[].headRefName')
for b in $(git branch -r --format='%(refname:short)' | sed 's|^origin/||' | grep -vE '^(main|HEAD)$'); do
  grep -qx "$b" <<<"$open" && continue
  [ "$(git rev-list --count origin/main..origin/$b)" -eq 0 ] && continue
  echo "$b  +$(git rev-list --count origin/main..origin/$b)  $(git log -1 --format='%cr' origin/$b)"
done
```

Filter to the last 48 hours. The long tail is months-old abandonment and is not your problem.

### 📏 The measurement that killed a premise — and would have shipped

Event Hub Build 2's brief said *"35 roles fold into 12 groups"*. **35 is the vocabulary size**, and
the shipped editor never offered it: `role-attire-field.tsx` already narrows to the roles on that
event's guest list, saying so in its own comment — *"a form with thirty rows is a form nobody
finishes."* One `select` against production gave the real shape:

```sql
select event_id, count(distinct role) filter (where role <> 'guest')
from guests where role is not null group by event_id order by 2 desc;
```

**15 distinct roles across 83 people on the busiest live event, folding into SIX groups.** The
justification held — six of six groups fold 2+ roles, so every row saves a line — but the number in
the plan was wrong, and it was one query away from being right.

🔑 **The plan's number and the shipped code's behaviour disagreed, and the plan is the one everybody
reads.** Check a premise against the running product, not against the document that asserts it.
**The premise is the part nobody checks.**

### The same defect, found twice more in one day

**On the guest's page.** `dress-code-widget.tsx` knew only the per-role tier. A couple who dressed
"Principal Sponsors" in one line and never wrote a word for one ninang left her page **empty** — the
answer sat in `dress_code_config` and no pixel carried it. The file already documented this exact
bug in a different shape, from 2026-09-20. **A defect class does not get fixed once; it gets fixed
per surface**, and the second surface looks nothing like the first.

**In a peer's own prototype.** The Papic controller session rendered `onboarding_price_php` beside
retail, verified every figure against `platform_retail_catalog_v2`, and reported *"every price is
correct"*. The owner rejected it: *"why did you show the onboarding price."* The figures were right
and the column did not belong.

🔑 **Verifying a value against its source does not verify the column belongs on the page. "Every
figure is correct" is not "every figure is wanted."**

⚠ **And the over-correction was also wrong, which is the more useful half.** That session first
relayed a flat rule — *never render `onboarding_price_php`* — then measured and retracted it:
shipped code **does** render it, correctly, in `(shell)/papic/page.tsx`, as the set-up price while a
celebration is being created, gated by `hasSetupSaving` and computed by `setupPricePhp`
(`lib/onboarding-discount.ts`) — **the same function the charge uses**. Owner, 2026-08-28: *"we give
them a 10% discount if they purchase now. They can order later, but they will lose the 10%
discount."*

The accurate rule is narrower and more useful than either version:

> **Render the signup price only where the buyer is eligible for it (during creation), and only
> through `setupPricePhp` — never the raw column, so a page cannot quote a figure checkout will not
> honour.**

🔑 **A rule stated as a flat "never" is usually an unmeasured rule.** It survives review because it
sounds safe, and it is wrong in exactly the case the product already handles well.

### What is scheduled and not started

**The event menu by moment** — the sidebar, phone bar and ☰ inside an event, reorganised by moment
rather than by product family. Owner-approved design, owner-scheduled, **no branch and no code**.
`build-sessions/SCHEDULE-event-menu-by-moment.md` carries the rulings, the guards that go red on
purpose, and why it lands after the six PRs above. Its acceptance test is one owner sentence:
*"finding the logo maker at the bottom feels so far."* Logo Maker moves from row 26 of 27 to row 9
of 21.

⚠ **It carries a live bug worth pulling forward on its own branch:** `CustomerBottomNav` never
passes `websiteEnabled`, so the planning Hub tab **never renders on phones** — and
`one-menu-word-in-all-three-phases.test.ts` passes `websiteEnabled: true` itself, so it cannot see
it. **A guard that supplies the input whose absence is the bug will never go red.**

### Two mechanics worth keeping

**A regenerated baseline is the mechanism, not a way around the guard.** `lint port keeps every
control` caught `<EventMonogram>` leaving `/u/[userSlug]` — which was the point of that change, not
a casualty. `pnpm --filter @setnayan/web port:baseline` put the removal in the diff as **one
readable line**. Regenerate on the MERGED tree and check the diff vs `origin/main` is only your own
line; that is how you prove the regeneration did not silently restore something another PR deleted.

**Sabotage a new test before you trust it.** Build 2's tests were green; breaking
`resolveAttireFor` on purpose took them to 1 failure, and restoring took them back to 10 pass.
A test that has never been seen to fail is a hypothesis. Print `dirty=` after every restore.

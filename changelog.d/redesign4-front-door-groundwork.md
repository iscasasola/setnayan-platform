## 2026-08-13 · feat(front-door): the guard rails for the homepage swap, and its tested honesty core

Redesign **Session 4** groundwork. Owner ruled 2026-08-13 — *"yes we want the new website"*, then, asked directly what becomes of the cinematic opening, **"Retire it completely."** So the YouTube-shaped front door becomes `/` and the June ELN cinematic homepage is retired.

**Nothing user-visible changes in this PR.** `app/page.tsx` is byte-for-byte untouched.

### 🚨 The most important thing here: the homepage is a SCHEDULER, and nobody would have noticed

`app/page.tsx` runs three jobs on the back of its guaranteed public traffic, via `after()`:

- `runAdminDigestFlush` — the admin morning digest
- `runDailyEmailJobs` — anniversary digests · renewal reminders · **the Papic full-res drop warning**
- `maybeRunInterconnectionProbes` — the interconnection probes

**These replaced retired crons. There is no scheduler behind them.** A port that swaps the page and drops those three lines throws nothing, fails no test and logs nothing — the emails simply stop. Couples stop getting anniversary digests, vendors stop getting renewal reminders, and **nobody is warned before their full-resolution photos are compressed**. The only symptom is an absence: the same shape as the phantom column · phantom enum value · phantom RPC argument · blocked iframe · unresolved `r2://`.

`app/home-carries-the-cron-free-jobs.test.ts` now fails if any of the three stops being scheduled, or if `revalidate` is removed (the jobs only fire when the page re-renders, so widening that window throttles them to almost never while every call site still looks correct).

🛡 **Mutation-proved on the real regression**, not a rename: deleting the `after(() => runDailyEmailJobs…)` line while **leaving its import in place** (occurrences 2 → 1) turns exactly that one assertion red and leaves the other four green. A naive substring check would have passed — the guard requires the job to be *scheduled*, not merely mentioned, and it strips comments first so a docblock mention can never satisfy it.

### The honesty core, pure and testable

`lib/front-door-composition.ts` decides each rail's shape from the counts that actually exist. It is a module rather than `if`s in JSX for the same reason the marketplace search ranker was extracted on 2026-08-12: thresholds buried in an async server component are unreachable from any test, so a regression's only symptom is a customer seeing something wrong.

The rules it encodes are product policy, not styling — **"Trending" is earned, never sold** (below 12 live shops the heading is honest instead); an empty shelf reads as broken, not young, so it is removed rather than rendered empty; and a written invitation is never a zero.

🛡 Mutation-proved: lowering the trending threshold so **one** shop would be headed *"Trending"* turns exactly the two honesty assertions red and leaves the other eight green.

### 📐 Re-measured against prod — the binding doc was already one rail out of date

The launch-day table in `FRONT_DOOR_AND_SEAM_FINAL` was measured 2026-08-12. **Session 2 shipped since**, and moved one number:

| Rail | Doc (12 Aug) | Measured 13 Aug | Shape now |
|---|---|---|---|
| Trending storyteller | 0 → *absent* | **1 published chapter** | **it returns** — do not build "absent" as the primary state |
| Articles | 33 of 91 | **33** ✓ | fills the grid |
| Stories | 0 | **0** ✓ (5 editorials, all `draft`) | one written invitation |
| Vendors | 1 live shop | **1** ✓ | "The first shops" |

🪤 **The live-shop count must NOT use `is_published`.** That column is legacy and no longer queried — `explore/page.tsx` says so outright. The real gate is `public_visibility='verified' AND verification_state='verified'`. Counting the legacy way returns **0** and would make the page apologise when it should say *"The first shops"*: prod holds one shop that is `is_published=true` but **hidden**, and one `public_visibility='verified'` that is `is_published=false`. Written into the module docblock, where whoever changes the query will read it.

### 🔒 Why a flag when the owner already said retire it

He did, and it is recorded. The flag (`NEXT_PUBLIC_NEW_FRONT_DOOR`) is about **order, not doubt**: deleting a finished, owner-approved page before its replacement has been looked at on a real screen is the one step here that cannot be undone, and this project's standing rule is that the owner LOOKING beats every automated check. **HomeReskin is retired in the flip, not in the build.**

⚠ The value must be exactly `'1'` (`true` reads as OFF), and a `NEXT_PUBLIC_*` inlines at build time — flipping it needs a rebuild **without build cache**, the trap that made the Life-Flash flag look inert.

### ⏭ Next, and deliberately not in this PR

The visual port itself (rail, feed grid, cards). Two deltas found where the written doc disagrees with the binding prototype — **the prototype wins** per the 2026-08-04 approval lock: rail width is **240 px** (doc prose says 248) and rail group 1 renders **Home · Stories** plus *Find a supplier* **only when signed in**, with no Journal row (the doc lists one; Stories and Editorials are now one shelf). The prototype already carries the Session 3 vocabulary in its own comments, so the rename and the port agree.

🪤 `doorway-invariants.test.ts` asserts `/` is excluded from the eight tool doorways and gives its reason as *"`/` is the ELN cinematic reskin."* The **assertion stays correct** — `/` is the front door, not a tool doorway — but the **reason goes false** when the flip lands. Update the comment then, or it joins the pile arguing for a retired decision.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-13 (owner ruling) + `REDESIGN_SESSIONS_2026-08-12.md` Session 4 entry, both already applied.

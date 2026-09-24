# ONE_REGISTER — the three packs folded into one, keyed by territory

> # 🛑 STOP — DO NOT USE THIS REGISTER AS A BUILD QUEUE UNTIL A ROW IS RE-MEASURED (2026-09-16)
>
> **EIGHTEEN rows were re-measured today against the served build `763b11b`. FIFTEEN were
> already done** — ST-9, SUP-1, SUP-7, SUP-12, SUP-13, SUP-14, SUP-19, SUP-30, SUP-31, PAP-7,
> PAP-10, PAP-11, DAY-10, LAU-6, DSK-3. Nine of those were closed by a single move: **a merged
> PR named the row ID in its own title.** Try that before anything else — the exact command is
> in the appendix at the bottom of this file.
>
> **The remaining ~60 were swept with one `git grep` each and the command and its result are
> recorded in that appendix, so the next session re-runs a measurement instead of repeating a
> guess.** 48 found nothing; 27 found something. ⚠ **Neither number is a count of what is
> built** — a NONE on a row asking for a PRESENCE proves only that the phrasing tried is not the
> phrasing that shipped, and a HIT proves only that a name exists. **DAY-14 matched its own
> search term and is wide open**, because the file contains the exact false sentence the row
> exists to remove.
>
> **Four rows are confirmed open with evidence, and one of them is charging people:**
> **DAY-14** (a couple who already bought Live Studio is told their "broadcast day has ended"
> and offered another day, after LS6 made it a permanent one-time unlock) · **SUP-52** (the band
> has a song-request inbox and no guest can post to it) · **SUP-4**'s first half (the Setnayan
> gift never reaches a couple while choosing) · **SUP-24**.
>
> *(Superseded line, kept so the arithmetic is auditable: "Nine rows were re-measured today.")*
>
> ⚠ The seven were NOT a random sample — they were the cheapest to check — so the true rate is
> unknown and may be better or worse. What is certain is that "NOT BUILT" in this file is a
> **claim, not a measurement**, and the owner has already paid more than once to have something
> rebuilt that existed.
>
> 🔑 **AND THE EVIDENCE COLUMN CAN BE WORSE THAN THE STATUS.** ST-9 prescribed a live `curl`
> that STILL RETURNS 200 today — for a ruled reason — so anyone doing the diligent thing got a
> green light for a bug whose fix had already shipped. SUP-7's said
> `select … from pg_policies where tablename='messages'`; the table is `chat_messages`, so it
> returns nothing, and **an empty result reads exactly like "no protection exists."**
>
> **BEFORE BUILDING ANY ROW:**
> 1. Find the mechanism by a **greppable symbol**, never a line number, a count, or a quoted
>    sentence you are guessing at. A zero only proves something on a row that asks for an ABSENCE.
> 2. Prove SERVED, not merged: `curl -s https://www.setnayan.com/api/health` for the sha, then
>    `git merge-base --is-ancestor <mergeCommit> <full served sha>`. Record both plus the date —
>    "merged but not served" is a snapshot that rots within minutes of being written.
> 3. Treat every live URL in an evidence column as suspect by construction: a status code cannot
>    tell "not gated" from "gated, and this fixture is on the permitted side of the gate."
> 4. When you re-measure a row, **write the result into the row.** A measurement kept in a session
>    is a measurement the next session pays for again.



> ## 🔄 RE-MEASURED 2026-09-15/16 — EIGHT ROWS BELOW ARE WRONG. Read this block first.
>
> This file was built against `origin/main` at `75aaeb003d`. Production has moved **hundreds of
> commits** since. Every line here was measured against production or `origin/main` on 2026-09-15/16,
> with the command that re-measures it. **The file's own closing line already says it is not
> evidence — this block is what that warning looks like when it comes true.**
>
> ### 🚨 THE MOST DANGEROUS ONE
> **ST-9 is marked "CONFIRMED OPEN — REPRODUCED LIVE" and it is CLOSED.** Fixed by **#5482**
> (merge `ea6f024b`, served), confirmed twice by two sessions using different methods — one of them
> the session that shipped it. Re-measure:
> ```
> curl -s -o /dev/null -w '%{http_code} %{size_download} %{redirect_url}\n' \
>   https://www.setnayan.com/api/og/realstory-slug/papic-pool-test-simple-event
>   → 302  0  https://www.setnayan.com/brand/og-card.webp   — byte-identical to a slug that never existed
> ```
> `tala-migo` and `zelda-ben` return **200 and that is CORRECT** — both are `unlisted`, and the owner
> ruled *"unlisted should still render the card."* **A row left marked 🚨 for three days after its fix
> is worse than no row: it spends a session's attention on a defect that is gone.**
>
> ### ✅ DONE SINCE — do not rebuild
> **ST-2** — its gate is gone; the owner pressed Hide on `S89W-GA4ABQ9APP` and the end-to-end proof was
> verified (report `actioned`, `hidden_at` stamped 324 ms earlier, the photo absent from the live page).
> **PAP-22** — "50 credits left" no longer reaches a stranger (#5501, served).
> **PAP-23** — the ₱8,000 comparison is **removed**, not corrected (#5504); the owner withdrew his own
> figure: *"i do not think 8000 costs 400 photos."*
> **PAP-27** — the supplier-capture lane is ruled: *"no. we will honour the guest."* Built and served.
> **SUP-A (D1) · SUP-12 · SUP-14 · SUP-1 (ROOM-12) · SUP-30 · SUP-31** — all shipped 2026-09-15.
> **GROUP 1 · INVITE is CLOSED** — house · capiz · velvet · galeriya · abaca, every one `ready: true`.
>
> ### ⚠ TWO ROWS WHOSE STATED FACTS DO NOT SURVIVE CHECKING
> **SUP-25's "two real early shops are affected" is FALSE.** Measured: `Saysay Live Band & Hosting
> (FIXTURE)` is owned by `testnayan2@test.com` and **`SetnaProd` is owned by the OWNER'S OWN ACCOUNT**.
> **There is no third-party supplier whose badge lapses on 2027-03-12**, and nobody needs chasing for a
> registration number. ⚠ Both also carry `is_demo = false` with no `demo_batch_id`, so any count that
> filters demo data reports **"2 verified suppliers"** — a fixture and an empty shop of his own.
> **SUP-23 serves a state no account can reach** — `vendor_verifications` has **zero rows**; nobody has
> ever submitted papers, so its precondition is unreachable. Lowest-value row in Group 3.
>
> ### 📌 §H's recommended order is spent
> Items 1, 2, 3, 5 and 8 are done or resolved (ST-1 landed; PAP-1 shipped; the `encoder-actually-runs`
> branch was read and kept; SUP-G shipped; the three themes shipped strictly serial). **What actually
> blocks work now is item 4 — the owner's A1 drawing and the stock-photo ruling** — and that is the ONE
> place a session is genuinely stopped. See `02_OWNER_DESK.md`, which was re-measured the same day.
>
> ### 🔑 THE PATTERN THIS FILE SHOULD CARRY, because it recurred all day
> **Three Group 3 rows named a real defect and described the wrong MECHANISM; one named the wrong
> SUBJECT entirely.** And the biggest finds of 2026-09-15 were **not rows at all** — a false analytics
> claim on the live `/privacy`, 36 surfaces that cannot print a whole name, a payment rail built in
> July and never shipped, a field labelled *"Note for guests"* collecting a page-level message.
> ⇒ **This register is good for making sure nothing is FORGOTTEN. It is bad at predicting effort, in
> both directions. Re-measure every row's mechanism before sizing it, and never quote a row's stated
> facts to the owner without checking them first — that mistake reached him twice on 2026-09-15.**


Cut **2026-09-12 19:25–19:55Z** (2026-09-13 ~03:25 Manila) against `origin/main` = **`75aaeb003d`**,
which is also what production serves (`curl -s https://www.setnayan.com/api/health` → `75aaeb0`).

## How to read this file

- **One row = one distinct build.** A build found by two packs has ONE row listing both ids.
- **Territory, not pack.** Rows are grouped by the files and surfaces a session would open, because
  that is what collides. The seven groups are the ones in `00_START_HERE.md`.
- **No line numbers, no counts, as fact.** Every row's `Re-measure` is a greppable symbol or a
  command. Where a pack cited a line number, it was dropped — line numbers in these packs have
  already rotted once.
- **Status is carried from the pack that found it, not re-verified**, except where this file says
  VERIFIED or DROPPED. A pack's status was true against `9663550` (2026-09-11 09:06Z). Only six PRs
  have landed since (below), so the packs are current — but re-run a row's command before building it.
- **Owner-gated** means a person cannot start it today. The question is in `02_OWNER_DESK.md`.
- **Model** is quoted from the pack where the pack named one. Where it did not, the house rule was
  applied and the cell is marked `·rule` — Opus for money, the lock, grants, migrations, deletion and
  security; Sonnet for screens, copy and wiring; Fable only for drawings.

## What the merge actually changed

| | |
|---|---|
| Rows in the three packs | BuildFinale 265 · Unfinished 208 · StoryFinale 10 |
| Rows in THIS file | **283** — re-measure: `grep -cE '^\| (SUP\|DAY\|PAP\|LAU\|DSK\|ST\|I)-[0-9]' ONE_REGISTER.md` |
| Rows carrying more than one pack id (folded) | **82** — re-measure: `grep -c '⇄' ONE_REGISTER.md`. Every one names its ids inline. |
| Rows dropped — proven already on `origin/main` | **2** (§0) |
| Rows that are a bundle, not a build | **7** — kept as one row each, marked ⊕, because nobody has ever split them |

⚠ **Neither pack contains the other, and the overlap runs both ways.** Grouping by pack would have
double-built the encoder chain, the verification chain and every Samahan row, and would have orphaned
the five privacy-page defects and the day-of console role gap — which appear in **one** pack only.

---

## §0 · DROPPED — proven on `origin/main`, do not rebuild

| Pack id | What it was | Proof |
|---|---|---|
| StoryFinale **2.2** | No `<Link>` prefetches an `/api/` route (OAuth + downloads are plain links) | PR #5468 **MERGED** 2026-09-11T11:20Z · `gh pr view 5468 --json state,mergedAt` |
| StoryFinale **2.3** | A published story shows its own card on an Unlisted site (owner item 13) | PR #5469 **MERGED** 2026-09-11T11:45Z · `gh pr view 5469 --json state,mergedAt` |

**StoryFinale's own §2 still lists both as OPEN with auto-merge armed. It is wrong.** Its prompt
`prompts/02_verify_5468_and_5469.md` is spent — do not run it.

Everything else the packs listed is still open. Proven by the full set of what landed after the
Unfinished pack's baseline: `git log --oneline 9663550..origin/main --no-merges` returns **8 commits /
6 PRs** — #5464 (a 200-guest couple could not be quoted), #5465 (Enter sends), #5466 (phone Tools
button), #5467 (an open tool no longer buries the conversation), #5468, #5469. None of the other
~470 pack rows is among them.

---

## §0b · Work that EXISTS and is not in any pack's build list — land it before building anything near it

The 429 kill on 2026-09-11 left this class: committed, sometimes pushed, **no PR**. A build session
that does not look will rebuild it.

| Branch | Ahead | Pushed | What it is | Do |
|---|---|---|---|---|
| `claude/no-client-value-in-server-tree` | 2 | YES | StoryFinale **2.1** — the React #418 root-cause fix, 15 files incl. `app/layout.tsx`, `theme-provider.tsx` | **Open its PR. Highest ready-to-land value on the machine.** |
| `claude/encoder-actually-runs` | 2 | YES | From 09-09, unowned — and **STILL not on main 2026-09-13**, while DSK-1 shipped from a different branch (#5474). ⚠ Its meaning has FLIPPED: read it for what it may DUPLICATE, not for what it may hold. | `git merge-base --is-ancestor origin/claude/encoder-actually-runs origin/main` |
| `claude/invite-theme-velvet` | 1 | NO | Velvet, mid-build. **4 uncommitted files in `wt-velvet`** | Belongs to the Orchestrator session — ask before touching |
| `claude/event-hub-pro-invite-finish` | 3 | NO | EH Pro finishing touches, clean tree, parked | Same owner |
| `claude/story8-end-to-end-proof` | 1 | YES | **Only a changelog fragment.** Not the step-8 work | Do not mistake for 2.4 |
| `1ca4989f8c` (commit, no branch on main) | — | — | **PAP-EST-1's actual fix** — "the estimate defers to owner-set config; the guess is gone", 2026-08-31 | `git merge-base --is-ancestor 1ca4989f8c origin/main` → **NOT on main.** Land it; it is a rescue, not a build |

Re-measure: `git worktree list` · `for b in $(git for-each-ref --format='%(refname:short)' refs/heads/); do n=$(git rev-list --count origin/main..$b 2>/dev/null); [ "${n:-0}" = 0 ] && continue; git rev-parse --verify -q origin/$b >/dev/null && p=PUSHED || p=LOCAL; echo "$b $n $p"; done`

⚠ **~90 other local branches sit "ahead of main" and are July/August dead ends.** A commit count ahead
says nothing about whether the work landed by another route. Only the six above were verified.

---

# GROUP 1 · INVITE
**Territory:** `apps/web/app/[slug]/invite/**` · `apps/web/lib/invite-themes.ts` + `.test.ts` ·
`apps/web/app/globals.css` · `apps/web/app/[slug]/_components/rsvp-widget.tsx` · the Event Hub Pro
inclusion list.
**Fed by:** BuildFinale invite area (12 rows) · corpus `Design_Invite_Themes_2026-09-10/`.
**Unfinished pack has ZERO rows here — it excluded this territory by design.**

🛑 **OWNED BY ANOTHER LIVE SESSION.** "Orchestrator" (`setnayan-platform-21`) holds PR **#5470**, the
branch `claude/invite-theme-velvet` with **4 uncommitted files in `wt-velvet`**, and
`claude/event-hub-pro-invite-finish`. **Message it before opening any file above.** A branch diff and a
trial merge are both blind to that uncommitted tree — read it with
`git -C ~/Documents/Claude/Projects/wt-velvet status --porcelain`.

⏱ **MOVED WHILE THIS FILE WAS BEING WRITTEN (2026-09-12 evening):** Velvet MERGED (#5471), the arrival
fix MERGED (#5470), and **PR #5472 is OPEN covering I-7, I-8, I-9 and I-10 in one change**. Re-read those
rows against it before touching anything here. This is the decay the file warns about, happening.

🔒 **Hard sequencing: the remaining themes each add a line to the same skin switch and font loader. Never
in parallel. Galeriya → Abaca.** The Event Hub Pro session may run beside them **only** because
it leaves `invite/_components/themes/` alone — but it shares `lib/invite-themes.ts` **and**
`lib/invite-themes.test.ts` with Velvet, which the theme plan did not anticipate.

| # | Build id | What a person gets | Status | Gated | Size · model | Re-measure |
|---|---|---|---|---|---|---|
| I-1 | **S1a** | The owner opens a Capiz invite on a phone: the reveal, then all three doors in Capiz over the couple's photo with their monogram as the seal | NOT SEEN LIVE | 👁 **OWNER LOOK** | — | owner opens a Capiz invite on setnayan.com |
| I-2 | **S1b** | A couple *without* Event Hub Pro who saved Capiz still shows guests the plain House door | ✅ **CLOSED BY TEST** — and it CANNOT be closed by eye | **no owner action** | — | `themes-stay-skins.test.ts` · "saving a Pro theme is re-checked on the server, after the couple check, before the write"; `the-invite-look-is-finished.test.ts` · "🔒 the SAVE refuses a Pro theme there" |
| I-3 | **S2 · Velvet** | Pro couples pick Velvet: an engraved card on velvet in their colour, four-flap reveal | ✅ **MERGED 2026-09-12** — PR #5471 | no | M · Opus | `git log origin/main --oneline --grep=velvet` |
| I-4 | **S3 · Galeriya** | Pro couples pick Galeriya: their photo hung as an artwork; print shortened so Continue sits on the first phone screen (Q4 = B) | NOT STARTED | no | M · Opus ·rule | `git grep -l galeriya origin/main -- apps/web` |
| I-5 | **S4 · Abaca** | Pro couples pick Abaca: their photo on kraft, a stamped date, steps as tags on twine, four-flap reveal | NOT STARTED | no | M · Opus ·rule | `git grep -l abaca origin/main -- apps/web` |
| I-6 | **Q1** | Velvet, Galeriya and Abaca show in their designed typefaces instead of fallbacks — five fonts committed **with licences** | NOT STARTED | no | S · Sonnet ·rule | `git grep -n "next/font" origin/main -- apps/web/app/[slug]/invite` |
| I-7 | **Q2** | On a Pro theme the one invite button takes the couple's own colour, falling back to terracotta when unreadable; House stays terracotta | ✅ **SHIPPED AND SERVED 2026-09-13** — PR #5472 | no | S · Opus ·rule (contrast maths) | — |
| I-8 | **Q3** | Everywhere Event Hub Pro lists what it includes, the invite theme appears as one of **eight**, not seven | ✅ **SHIPPED AND SERVED 2026-09-13** — PR #5472 | no | S · Sonnet ·rule | — |
| I-9 | **Q6** | A guest who just watched the reveal on door 01 is not shown it again on arriving at the Event Hub that visit; the Save-the-Date film still starts | ✅ **SHIPPED AND SERVED 2026-09-13** — PR #5472 | no | S · Sonnet ·rule | — |
| I-10 | **Q7** | Only celebrations carrying the Save-the-Date film (weddings) can choose a Pro theme; every other kind gets House | ✅ **SHIPPED AND SERVED 2026-09-13** — PR #5472 | no | S · Opus ·rule (gate) | — |
| I-11 | **S5-1** | The theme picker tells the couple where to change the invite's colour (monogram) and background (Save-the-Date studio) | NOT STARTED | no | S · Sonnet ·rule | `git grep -l "theme picker\|themePicker" origin/main -- apps/web` |
| I-12 | **Corpus follow-through** | The design folder and memory stop saying three themes are "left" | NOT STARTED | no | S · no code | after S4/S5 land |
| I-13 | **EH Pro finishing touches** | The 8th-item work on the Event Hub Pro list, no second reveal | **PARKED** on `claude/event-hub-pro-invite-finish` (3 commits, unpushed, clean) | no | — | `git log origin/main..claude/event-hub-pro-invite-finish --oneline` |

**I-1 is a genuine eye check — one phone, one afternoon. I-2 IS NOT, and asking for it wastes his time.**

⚠ **CORRECTED 2026-09-13 — S1b cannot be demonstrated on screen, and trying will look like a bug.**
Verified by symbol on `origin/main`: the picker's theme radio is `disabled={locked}`, and in
`setInviteTheme` the `if (!ownsPro) redirect(...)` runs BEFORE the `.update({ invite_theme: theme })`.
So a couple without Pro cannot reach the state S1b describes — both the control and the server refuse.
Anyone sent to "just try it" meets a dead radio and concludes the picker is broken.
🔑 **A row can be real, true, and still not be LOOKABLE.** The packs read code, so they record a
mechanism; whether a person can reach that mechanism is a separate question nobody asked. Before
putting any 👁 row on his desk, check that the state it describes is reachable through the product.

---

# GROUP 2 · STORY
**Territory:** `apps/web/app/[slug]/story/**` · Story Maker · `/api/og/realstory-slug/**` · the print
routes (A3/A4) · `app/layout.tsx` + `theme-provider.tsx` (hydration).
**Fed by:** StoryFinale (10 builds, 2 now dropped) · BuildFinale's four Story areas (27 rows).

| # | Build id(s) | What a person gets | Status | Gated | Size · model | Re-measure |
|---|---|---|---|---|---|---|
| ST-1 | StoryFinale **2.1** | A published story stops throwing its first render away and redrawing (React #418 flash + console error) | ✅ **SHIPPED AND SERVED 2026-09-12** — PR #5473, merge `0d85ec91b6`, served `0d85ec9` | no | M · Opus | `curl -s https://www.setnayan.com/api/health` · the served story page carries no `"__html":"$N"` client reference |
| ST-2 | StoryFinale **2.4** | Step 8's end-to-end proof closes: a taken-back photo disappears from page, share card and prints | PARTLY BUILT (116 of 155 checks pass) | 🔑 **owner must press Hide** on report `S89W-GA4ABQ9APP` | M | `select status from abuse_reports where public_id='S89W-GA4ABQ9APP'` |
| ST-3 | StoryFinale **2.5** | Track 2 "Tala & Migo": a public story and share card built from **real camera bytes**, not stubs | NOT STARTED — **its gate has passed** (Story opened 2026-09-12 06:00 Manila) | no | M · Sonnet | event `d4b91480-f614-4c35-87d6-d2fbfdddced2` |
| ST-4 | StoryFinale **2.6** ⇄ BF **items 16 + 17** | After a reload the host lands on the step they were in, not "The desk"; and the snippet mute button is smaller but still finger-sized | NOT STARTED | no | S · Sonnet | worktree `wt-story-step` exists and is EMPTY — prune or reuse |
| ST-5 | StoryFinale **2.7** ⇄ BF **item 12** ⇄ Unfinished free-credit rows | A host who creates a celebration dated **today** can still add guests, and guests get the promised free photos instead of one-then-"refills tomorrow" | NOT STARTED | ⚖ **CONFLICT** — the 09-11 ruling contradicts the 09-04 "first event only" lock | M · Opus | `02_OWNER_DESK.md` Tier 2 · BuildFinale C3 recommends first-event-rule wins |
| ST-6 | StoryFinale **2.8** ⇄ BF **items 14 + 15** | A guest asking for a photo to come down sees **thumbnails**, not "Photograph 1, 2…"; the host is told and can hide it | NOT STARTED (15 partly built) | no | M · Opus | `git grep -l "takedown" origin/main -- apps/web/app/dashboard` |
| ST-7 | StoryFinale **2.9** | The 6 checks never re-driven, plus two likely contrast defects in "Make it yours" (coloured words while selected; small terracotta buttons on hover) | NOT STARTED | no | S · Sonnet | `evidence/10a-evidence.md` |
| ST-8 | StoryFinale **2.10** | Test data, worktrees and memory cleaned up; **prod state set back** (Song Desk Test Night is PUBLIC and its pool gallery is OPEN because a session set them so) | NOT STARTED | no | S | `select visibility from events where id='0ccc7aa3-3a81-43ee-b170-afb194e0b259'` |
| ST-9 | BF Story | A stranger can read a private couple's **names and exact wedding date** off a card, and can tell which celebrations are real | ✅ **CLOSED — FIXED AND SERVED. Re-measured 2026-09-16 against served `763b11b`.** `ogCardVisibleToStrangers` (`lib/social/og-card-audience.ts`) gates the route in ONE branch, so "not yours to see" and "no such celebration" return the SAME bytes. ⚠ A 200 on `tala-migo` is NOT the bug returning: `tala-migo` is `unlisted`, and ⚖ **the owner ruled 2026-09-13 that unlisted still renders** — shareability over non-enumerability, for unlisted only. `private` and `invited_accounts` are sealed. 🔑 **This row said 🚨 OPEN for three days after it was fixed, and the live probe it prescribes STILL RETURNS 200 — so running the repro and believing it would have re-confirmed a closed bug.** Read the gate, not the status code. | no | S · Opus | ⛔ **THE CURL THAT USED TO BE IN THIS COLUMN HAS BEEN REMOVED — it manufactured confirmation on demand.** It probed `tala-migo`, which is `unlisted`, and returns **200 to this day** by owner ruling. Anyone doing the diligent thing — running the command the register told them to run — got a green light for a bug that had already shipped its fix. 🔑 **A STATUS CODE CANNOT TELL "not gated" FROM "gated, and this fixture is on the permitted side of the gate."** Treat every live URL in an evidence column as suspect by construction. **Re-measure by the GATE SYMBOL instead:** `git grep -n ogCardVisibleToStrangers origin/main -- apps/web/app/api/og` and read `lib/social/og-card-audience.ts`, which holds the whole rule and its tests. |
| ST-10 | BF Story | Two 3D-kit files import from `'use client'` modules and are reachable from a server page (`plan3d/kit/booth-templates.ts`, `outfits.ts`; `/v/[slug]/booth`) | EXEMPTED IN THE GUARD, **marked TO REVIEW** | no | S · Opus | `git grep -n "TO REVIEW" origin/main -- apps/web/scripts` |
| ST-11 | BF Story | Moment-row **×** is under the 44 px touch floor on both desk and phone (halos were removed in round 3 because they stole presses) | NOT FIXED | no | S · Sonnet | `git grep -n "moment-row" origin/main -- apps/web` |
| ST-12 | BF Story | Every dial bar opens to that minute's photos — tapping a quiet minute shows the photos, not only a count | PARTLY BUILT | no | M · Sonnet ·rule | BF `corpus_sweep.md` Story area |
| ST-13 | BF Story | Before publishing, a stranger still sees the host's own uploaded photos; only the guests' are hidden | NOT STARTED | no | S · Opus ·rule (visibility) | BF `corpus_sweep.md` Story area |
| ST-14 | BF Story | The host accepts or rejects the story's own generated cards on the desk ("We made" lane), like guest and supplier items | NOT STARTED | no | M · Sonnet ·rule | BF `corpus_sweep.md` Story area |
| ST-15 | BF Story | A host can accept **part** of a photo set and hold back the rest | PARTLY BUILT | no | M · Sonnet ·rule | BF `corpus_sweep.md` Story area |
| ST-16 | BF Story | In "The whole story" index, tapping a table goes to its moments and photos | PARTLY BUILT | no | S · Sonnet ·rule | BF `corpus_sweep.md` Story area |
| ST-17 | BF Story | The story says how many people watched the live broadcast; the controller shows a 👁 count | PARTLY BUILT | no | S · Sonnet ·rule | BF `corpus_sweep.md` Story area |
| ST-18 | BF Story | A credited supplier sees how many visitors came to them from a story | PARTLY BUILT | no | M · Sonnet ·rule | BF `corpus_sweep.md` Story area |
| ST-19 ⊕ | BF Story · **owner-held bundle** | Eight rulings the owner still holds: the cover's "0 voices" · what "No." counts for a non-wedding · whether next year inherits the guest list · a seeded demo celebration · the solemn keepsake print · free moment naming/reordering · whether soft-deleting a guest lifts their photo veto · whether the floor plan freezes only at publish | BLOCKED | ⚖ **8 separate rulings** | — | `02_OWNER_DESK.md`; `NEEDS_THE_OWNER_2026-09-09.md` items 1, 5, 10, 2 |
| ST-20 | BF Story | Paying suppliers get a richer credit in the story (note to the host, Follow, outside links, reach numbers) | BLOCKED | ⚖ Featured-tier naming and price (Tier 3) | M · Opus ·rule | `02_OWNER_DESK.md` Tier 3 |
| ST-21 | BF Story | Hosts decorate pages with **stickers** in "Make it yours" | BLOCKED | ⚖ | M · Sonnet ·rule | `02_OWNER_DESK.md` |

⚠ **ST-1 is the only row here that is finished and merely unlanded.** Opening its PR is the single
cheapest thing in Group 2, and it is also the suspected cause of the one unexplained error pair in the
Story Maker (§3 of StoryFinale) — so it may close ST-7 in passing.

---

# GROUP 3 · SUPPLIER & MARKETPLACE
**Territory:** the public shop page `app/v/[slug]/page.tsx` · My Shop · service cards · the supplier's
room and day-of desk · verification · Explore/marketplace ranking · quote → lock → money · the bench
`shortlist-categories.tsx`.
**Fed by:** BuildFinale's build plan (D1/F1/F2/G1–G3, FU-1…FU-6) + its marketplace, service-card,
verification, booking-fee and chat/bench areas · Unfinished streams **02** (29) and **03** (70).

**Why this is ONE group:** Unfinished 02/03 rewrite the same files as the BuildFinale shop-page and
My-Shop chains. Its own register says **ROOM-12 and VER-1 must land BEFORE G1/G3.** Splitting them
guarantees a collision.

🔒 **Collision map inside the group** — intersect FILES, never branch names:
- `app/v/[slug]/page.tsx` — **F1/F2 own it.** SUP-24 (VER-5), SUP-12 (SC-3), SUP-14 (SC-5) touch it → hand to F1/F2 as line items, or land after F2.
- **My Shop page file** — **G1–G3 own it.** SUP-23 (VER-1), SUP-25 (VER-2), SUP-30 (SHOP-3), SUP-9 (ROOM-12), SUP-45 (VNAV-1) touch it → land **ROOM-12 and VER-1 first**.
- `shortlist-categories.tsx` — **DRAFT #5463 is open on it.** SUP-2 (CPL-1), SUP-16 (EX-1), SUP-18 (EX-5), SUP-60 (BUD-6) must rebase after it lands.
- **Gift / booking-fee functions** — FU-5 (gift snapshot at lock) and the gift line in the quote builder are queued. SUP-4 (CPL-4/SC-2), SUP-6 (FEE-1/ROOM-10) touch the same functions.

## 3a · The build plan — the owner's three looks release all of it

| # | Build id | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| SUP-A | **D1** | "Want to add them to your event?" on a shop page: pick one of your ongoing events, or create one | NOT BUILT | 👁 **A1 (§F only)** | Opus · high |
| SUP-B | **F1** | The new universal shop page, top: identity, true facts only, the checks receipt | NOT BUILT | 👁 **A1 + A2 + the stock-photo ruling** | Opus · high |
| SUP-C | **F2** | The new shop page, body: services, portfolio, reviews — "one calm line" when there are none | NOT BUILT | F1 | Opus · high |
| SUP-D | **G1 → G3** | My Shop in six doors, with nothing lost (91-row "every control → its door" table exists) | NOT BUILT | 👁 **A3** — *G1 can start on his yes* | Opus · high |
| SUP-E | **FU-1** | The four held display fixes: bench card photo · "Live Band" not "Band / DJ" · clean perk messages · no "Miscellaneous" | **BUILT AND FULLY CHECKED — DRAFT #5463** | ⚖ the paused live test resuming | Sonnet |
| SUP-F | **FU-2** | The supplier sees "your couple gets N free Papic photos" while building a quote | NOT BUILT | **nothing** | Opus · high |
| SUP-G | **FU-3** | "Propose schedule" reads greyed with **"Opens once they book you"** in the rail, instead of the supplier learning that only after navigating away | ✅ **SHIPPED AND SERVED 2026-09-13** — PR #5479, merge `52e0f881e2`, served `52e0f88` | ⚖ B2 (a), already ruled | Sonnet |
| SUP-H | **FU-4** | One "Send a quote" button instead of "Build a quote" + "Send proposal" | NOT BUILT | ⚖ **B1** — recommendation (a) | Sonnet |
| SUP-I | **FU-5** | Gift snapshot at lock: the gift can't be switched off, or swapped, after the couple locks | NOT BUILT | **nothing** | Opus · xhigh · **opens DRAFT** |
| SUP-J | **FU-6** | "Who else wants this day" counts exact-day couples only | NOT BUILT | ⚖ **B3** — (c) or (a) | Sonnet |

**SUP-F and SUP-I are blocked on nothing at all** (SUP-G shipped 2026-09-13). They are the build-plan
rows a session can start today without the owner.

📏 **CORRECTION FROM BUILDING SUP-G — the row's premise was wrong, and it matters.** Every register
described this as a control that looks available and is not. Measured: the destination **already
refused honestly** — the client's Schedule tab draws *"Unlocks when they book you"* before a booking.
The defect was that the sentence lived one navigation away. A row can name a real problem and still
describe the wrong mechanism; the fix was to move a true sentence, not to build a refusal that
already shipped. **Re-measure the mechanism, not just the symptom, before sizing any row here.**

## 3b · Tier 1 — live defects and authorisation gaps on the supplier path

| # | Build id(s) | What a person gets | Status | Gated | Size · model | Re-measure |
|---|---|---|---|---|---|---|
| SUP-1 | **ROOM-12** | A shop's agent or viewer opens **only** the celebrations they were given, on the day-of console | ✅ **BUILT AND SERVED — re-measured 2026-09-16.** #5505 + #5513 (merge `7b553268 / 86346911`), an ancestor of served `763b11b`. Two PRs name this row: "A day-of grant cannot be moved (SUP-1 / ROOM-12)" and "The day-of grant fence cannot be switched off (SUP-1 follow-up)". The second is the one that matters — a fence that can be switched off is not a fence. | no | M · Opus | `select * from pg_policies where tablename like 'vendor_event%'` — blast radius today: **2 people** |
| SUP-3 | **LK-1** ⇄ ROOM-02 ⇄ BF "Deposit acknowledge may not reserve the date" | When a supplier confirms the couple's payment, **their date is actually held** — the call is not refused and the refusal swallowed | NEEDS MEASURING | no | S · Opus | reproduce a deposit acknowledge on a test shop and read the calendar row |
| SUP-5 | **ANS-01** | When a shop picks a waiting couple, the hold is **recorded** — and the couple is not told about a hold that does not exist | NOT BUILT | no | S–M · Opus | `git grep -n "kept the date" origin/main -- apps/web` |
| SUP-7 | **CPL-3** ⇄ BF "The database refuses a forged 'offered service'" | The **database**, not only the screen, refuses a couple forging a rival supplier's "offered service" card in chat | ✅ **BUILT, MERGED AND SERVED — re-measured 2026-09-16.** Migration `20271229461225_a_card_names_this_conversations_supplier.sql`, merge `f2e97b29`, an ancestor of served `763b11b`. A BEFORE INSERT trigger refuses when the card's row does not belong to this conversation's supplier — **and it closes all FIVE card kinds, not only the offered service**: proposal, appointment, change order, amendment, offered service. It does **not** exempt the service role. ⚠ **THE ROW'S OWN EVIDENCE COMMAND WAS WRONG AND WOULD HAVE MISLED:** it said `select * from pg_policies where tablename='messages'` — the table is `chat_messages`, so the query returns nothing, and **an empty result reads exactly like "no protection exists"**. 🔑 **AND RLS WAS NEVER WHERE THE ANSWER LIVED.** A policy is row-level, never value-level: one that admits you to your own row cannot govern what that row SAYS about somebody else. Re-measure by the guard symbol: `git grep -n tg_chat_messages_card_names_this_conversation origin/main -- supabase/migrations`. |
| SUP-11 | **SHOP-1** ⇄ BF "Lock-request expiry reminder depends on traffic" | A supplier is **always** warned before a lock request closes, even on a quiet day | NOT BUILT | no | S · Opus | `git grep -n "lock_request" origin/main -- apps/web/app/api/cron` |
| SUP-12 | **SC-3** | A card's cover photo shows on the shop's own page and in the supplier's own card list | ✅ **BUILT AND SERVED — re-measured 2026-09-16.** #5512 (merge `2719b5fd`), an ancestor of served `763b11b`. The PR names this row in its own title: "SUP-12 + SUP-14: a card shows its cover and sits under its real trade." | no | S · Sonnet | open the published shop on www.setnayan.com |
| SUP-14 | **SC-5** | On a shop's page each card sits under its **real trade**, never "Other", and no card disappears | ✅ **BUILT AND SERVED — re-measured 2026-09-16.** #5512 (merge `2719b5fd`), an ancestor of served `763b11b`. Same PR as SUP-12 — it closed both halves in one change, which is why neither shows up as its own commit. | no | M · Sonnet | same page as SUP-12 |

**SUP-12 and SUP-14 are visible to anyone who opens the one published shop.** They are the two rows in
this group a person can confirm without a single command.

## 3c · Verification, the papers and the badge

| # | Build id(s) | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| SUP-23 | **VER-1** ⇄ BF "Full permit-renewal clock" | A shop whose papers were approved can renew its Mayor's Permit when the reminder arrives | PARTIAL | no | M · Opus |
| SUP-25 | **VER-2** ⇄ SHOP-8 ⇄ BF "verified shop with a profile gap" | A verified shop whose profile has a gap can still send its papers (the two early shops, badge to 12 Mar 2027) | PARTIAL | ⚖ | S · Sonnet |
| SUP-26 | **VER-3** ⇄ SHOP-4 ⇄ BF "paper reader + registry lookup" | "Matched by Setnayan": clean papers pass by themselves; only mismatches reach a person | NOT BUILT | 🔑 **DPO sign-off before it is started** | L · Opus |
| SUP-27 | **VER-4** ⇄ SHOP-6 ⇄ BF "bank account name matches" | The bank account's name is checked against the registered business | NOT BUILT | no | M · Opus |
| SUP-24 | **VER-5** ⇄ BF "on the marketplace since" | A shop page says "on the marketplace since \<month year\>" | 🔴 **CONFIRMED OPEN — re-measured 2026-09-16 by TWO phrasings, not one.** Neither `marketplace since` nor `member since` / `on Setnayan since` / `Joined … since` appears anywhere under `apps/web/app/v` or `apps/web/lib`. Genuinely unbuilt. | no | S · Sonnet |
| SUP-28 | **VER-6** ⇄ SEC-1 ⇄ BF "close unused signed-out write grants" | Unused signed-out write grants on `vendor_services` are removed | NOT BUILT | no | S · Opus |
| SUP-29 | BF "Approve switches WARN → REFUSE" | Once real outside suppliers apply, Approve cannot grant the badge with checks missing (a vouch is the only way round) | NOT BUILT | ⚖ | S · Opus ·rule |
| SUP-30 | **SHOP-3** | My Shop stops implying a shop's own website is shown to couples | ✅ **SHIPPED AND SERVED** — PR #5519, confirmed by ancestry against served `763b11b` on 2026-09-16, not by a badge. | no | S · Sonnet |
| SUP-31 | **SHOP-2** | A shop is told when Setnayan publishes, hides or archives it | ✅ **SHIPPED AND SERVED** — PR #5521, confirmed by ancestry against served `763b11b` on 2026-09-16, not by a badge. | no | S · Sonnet |
| SUP-32 | **SHOP-5** | A lapsing DTI registration is noticed (expiry and scope remembered) | OWNER-GATED | ⚖ | S–M · Opus |
| SUP-33 | **SHOP-7** ⇄ BF "Waitlist as a pipeline lane" | A shop sees its waitlisted couples as a lane on Customers | OWNER-GATED | ⚖ | S · Sonnet |

## 3d · Service cards and the trade vocabulary

| # | Build id | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| SUP-10 | **SC-1** | On a laptop, the card being made really sits beside the question | NEEDS MEASURING | no | S · Sonnet |
| SUP-4 | **SC-2** ⇄ **CPL-4** ⇄ BF **BENCH-C5** | Couples see "Includes a Setnayan gift" while choosing; a quote below the card's "from ₱X" still sends but earns no gift | 🔴 **FIRST HALF CONFIRMED OPEN — re-measured 2026-09-16, and narrower than the row implies.** `"Includes a Setnayan gift"` exists in exactly three places: the supplier's own card maker, `ServiceCardFace`, and `lib/setnayan-gift.ts`. A couple reaches that face only through `chat-offered-service-card.tsx` — i.e. **inside a chat thread, after a supplier offers a card.** Neither the public shop page (`app/v/[slug]/page.tsx`) nor the explore card grid mentions a gift at all (0 matches for "Setnayan gift", "Papic photos", "free Papic"). **So the gift never reaches a couple WHILE CHOOSING, which is the half this row is about.** ⚠ Still ⚖-gated on C5 — do not build without the owner. The second half (a quote below "from ₱X" earns no gift) was addressed by PR #5522. | ⚖ C5 | S · Opus |
| SUP-13 | **SC-4** | A shop that chose "hide my prices" is not priced on the marketplace's card grid | ✅ **BUILT AND SERVED — re-measured 2026-09-16.** `hide_prices_publicly` (migration `20270808300000`, an opt-in-to-hide defaulting to SHOW) is honoured by the grid through `fetchVendorsHidingPricesPublicly` in the page-level enrichment, by the same rule the shop's own page uses. **And it is already guarded**, by `lib/explore-shows-what-it-costs.test.ts` — which goes further than the row asked: one test pins that the grid runs the batch read before showing any price, and another forbids either reader re-implementing `hide_prices_publicly === true`, because a second copy of the rule is precisely how an opted-out shop ends up priced anyway. Re-measure by symbol: `git grep -n fetchVendorsHidingPricesPublicly origin/main -- apps/web`. | no | S · Sonnet |
| SUP-15 | **SC-6** | Funeral homes, crematoria and memorial parks find their own word in the older kinds list | NOT BUILT | ⚖ | S · Sonnet |
| SUP-17 | **SC-7** | The three older kinds say what they hold: "Live Band" (band and DJ) · "Bridal Car" (all transport) · "Massage Chair" (seven booth trades) | NOT BUILT | no | S · Sonnet |
| SUP-19 | **SC-8** | The price box stops saying "leave blank for quote on request" | ✅ **NOTHING TO DO — re-measured 2026-09-16.** `git grep -in "quote on request" origin/main -- apps/web` returns **zero**, and every surviving "leave blank" is an admin surface (voucher windows, API keys, onboarding copy), none of them a supplier price box. ⚠ **A ZERO IS THE RIGHT ANSWER HERE ONLY BECAUSE THE ROW ASKS FOR AN ABSENCE** — the same zero on a row asking for a PRESENCE proves nothing except that the phrase you guessed is not the phrase that shipped. Do not reuse this method on rows phrased the other way round. | no | S · Sonnet |
| SUP-20 | **SC-9** | A couple's "what do you need" questions also appear for cards under the older kinds | PARTIAL | no | M · Sonnet |
| SUP-21 | **SC-10** | The database refuses a card kind that is in neither vocabulary | NOT BUILT | no | M · Opus |
| SUP-22 | **SC-11** | A half-finished card survives on our side, not only in that browser | OWNER-GATED | ⚖ | M · Opus |
| SUP-34 | **SC-12** ⇄ CAT-5 | Folding one branch of trades into another also forwards its old address | NOT BUILT | no | M · Opus |
| SUP-35 | **SC-13** | A couple filtering by a trade sees **that trade's** card, not the shop's first service | PARTIAL | no | M · Sonnet |
| SUP-36 | **CAT-1** | Typing a trade finds it on **every** door into the card maker, not only one | PARTIAL | no | S · Sonnet |
| SUP-37 | **CAT-2** | A remembered supplier wording says where it came from and never pushes a real match down | PARTIAL | no | S · Sonnet |
| SUP-38 | **CAT-3** | Words a supplier types into the kind search are not kept forever, and a phone number is **never** kept | NOT BUILT | ⚖ retention | S · Opus |
| SUP-39 | **CAT-4** | Setnayan can see which shops still hold a trade that no longer exists | PARTIAL | no | S · Sonnet |
| SUP-40 | **CARD-COPY** ⇄ BF "Copy one of my service cards" | Copying a service card also copies its ★ customization options | NOT BUILT | no | S · Sonnet |
| SUP-41 | **CARD-EXPLORE** | The card's record (its medal case) appears on the marketplace too | NOT BUILT | no | S · Sonnet |
| SUP-42 | **CARD-PKG** | A package made in the card wizard goes live when the card does | OWNER-GATED | ⚖ | S · Sonnet |
| SUP-43 | **CARD-FLYWHEEL** | "N of 50 couples first met this card as guests" | OWNER-GATED | ⚖ | M · Opus |

## 3e · The supplier's room, desk and Answers Desk

| # | Build id(s) | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| SUP-44 | **ROOM-01** ⇄ BF "'No event today' gives no reason" | A supplier's day-of screen stops giving the wrong hours and an unexplained "No event today" | PARTIAL | no | S–M · Sonnet |
| SUP-8 | **ROOM-03** ⇄ BF "Today's Upcoming misses agreed and locked-QR" | The Overview "Upcoming" shows **every** celebration a shop is booked on | NOT BUILT | no | S · Opus |
| SUP-46 | **ROOM-04** ⇄ BF "Agents on a phone can't reach My Customers" | A shop's agent or viewer can reach their customers, and their granted day, on a phone | NOT BUILT | no | S · Sonnet |
| SUP-45 | **VNAV-1** ⇄ OT-3 ⇄ BF "Supplier rail clipped labels" | The supplier's phone bar shows whole words, not "Performan…" | NEEDS MEASURING | no | S · Sonnet |
| SUP-47 | **ROOM-06** | The supplier's capture tool can move onto their desk | NEEDS MEASURING | no | S |
| SUP-48 | **ROOM-07** | On the day, a supplier can post a status and flag an issue straight from their desk | OWNER-GATED | ⚖ | M · Sonnet |
| SUP-49 | **ROOM-08** | The wedding-words check also reads the components the guest pages borrow | NOT BUILT | no | S · Sonnet |
| SUP-50 | **ROOM-09** | One privacy test stops using a home-made comment stripper | NOT BUILT | no | S · Sonnet |
| SUP-51 | **ANS-02** ⇄ BF "Waitlist notify skips the open-date check" | "A slot opened" is never emailed for a past date, or a day that is not free | NOT BUILT | no | S · Sonnet |
> ✅ **SUP-52 DONE 2026-09-18 (#5601).** Superseded the 2026-09-18 PARKED note above (the owner's
> minimum-scope objection was answered by shipping it anyway, per S7). Re-measured against
> `origin/main`: `app/[slug]/_components/song-request-card.tsx` + `app/api/song-requests/route.ts`
> now call `guest_submit_song_request`, gated on the band's own `song_desk` read access
> (`resolveSongDeskAccess`). `lib/answers-desk.ts`'s `ANSWERS_THAT_DO_NOT_JOIN` carried a stale
> "zero application callers" reason for `song_request` after #5601 merged, which broke every open
> PR via `lib/answers-desk.test.ts` (#5603's guard) — fixed by removing that entry (S25, PR TBD).
> ⚠ Two components are named `RequestsInbox`, over different tables — check the shape, not the name.

| SUP-52 | **ANS-03** ⇄ BF "Guest request a song" | A guest at the party can ask the band for a song — **the database half has been live since July** | ✅ **DONE — re-measured 2026-09-18.** #5601 shipped the guest entry point (`song-request-card.tsx` + `app/api/song-requests/route.ts`); the supplier's inbox and the July database half were already built. Every stage now joins. | no | M · Opus |
| SUP-53 | **ANS-04** ⇄ BF "Answers Desk withholds answers that now work" | The "not yet" list tells the truth, and the answers that now work can join it | PARTIAL | no | S · Sonnet (list) / M · Opus (lanes) |
| SUP-54 | **ANS-05** | A posted crew shift records the right token count | PARTIAL | no | S · Opus |
| SUP-55 | **ANS-06** | A supplier asked to agree to a removal gets their one reminder, sees the outcome, and can answer from the customer page | NOT BUILT | no | M · Opus |
| SUP-56 | **ANS-07** | The couple's removal screen tells the truth about who was asked, and who cannot answer | NOT BUILT | ⚖ | M · Opus |
| SUP-57 | **ANS-08** | The Answers Desk also names a partner-shop request and a re-quote request | NOT BUILT | no | S · Sonnet |
| SUP-58 | **ANS-10** | No other shop-side button "works" on screen while the database quietly refuses it | NOT BUILT | no | M · Opus |

## 3f · Money on the supplier path — the booking fee, the gift, the budget

| # | Build id(s) | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| SUP-6 | **FEE-1** ⇄ ROOM-10 ⇄ BF "No fee paid, no connection" + "The booking fee bills with one setting" | The fee is actually collected, and "no fee paid, no connection" is enforced | OWNER-GATED | ⚖ **B4 — decide before any supplier reaches a 6th booking** | M · Opus |
| SUP-59 | **FEE-2** ⇄ BF **PR-J** | "Found on Setnayan": a couple who found a shop here then adds it "manually" is attributed, the shop is told, and it can dispute | NOT BUILT | no | L |
| SUP-2 | **CPL-1** ⇄ BF "Richer standing-sentence clauses on the bench" | The bench card's "where they stand" line also says the facts: meeting confirmed, deposit paid, guest count changed | NOT BUILT | no | M · Opus |
| SUP-60 | **BUD-1** | Every money figure on the couple's budget comes from **one** calculator | PARTIAL | ⚖ | M · Opus |
| SUP-61 | **BUD-2** | "Record a cost" can be an estimate, confirmed later, edited without losing its receipt | PARTIAL | ⚖ | M · Sonnet |
| SUP-62 | **BUD-3** ⇄ BF "paperwork as estimated lines" | Licence, CENOMAR and parish fees appear as estimated costs | OWNER-GATED | ⚖ | S · Sonnet |
| SUP-63 | **BUD-4** | "Your team" says what a build would cost "if you lock these"; the planner sees what is already booked | PARTIAL | no | M · Sonnet |
| SUP-64 | **BUD-5** ⇄ BF **BUD-10** | A couple can export their whole budget (CSV / print) | NOT BUILT | no | S · Sonnet |
| SUP-65 | **BUD-6** | Each category shows its target where the couple picks suppliers ("Catering · target ₱180,000") | NOT BUILT | no | M · Sonnet |
| SUP-66 | **BUD-7** ⇄ BF **BUD-9** | Couples without Setnayan AI still get a payment-due reminder | OWNER-GATED | ⚖ | S · Sonnet |
| SUP-67 | **BUD-8** | Deleting a supplier does not silently erase the payments logged against them | OWNER-GATED | ⚖ | S · Opus |
| SUP-68 | **CPL-2** | "Message" on a shop page, pressed by a couple with no event yet, keeps the supplier — or honestly says it will not | PARTIAL | no | S · Sonnet |
| SUP-69 | **CPL-5** | A couple who has ASKED a supplier to lock is not told elsewhere to "go book" that category | NEEDS MEASURING | no | S · Sonnet |

## 3g · Explore, ranking and the marketplace shelf

| # | Build id(s) | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| SUP-16 | **EX-1** ⇄ BF "Ranking Rule B fresh-chance slot" | A new, fitting supplier gets one fair "New here" slot on each rail | NOT BUILT | no | M · Opus |
| SUP-70 | **EX-2** | A retired "boost" can never quietly re-arm a paid top slot | NOT BUILT | no | S · Opus |
| SUP-71 | **EX-3** | The admin "first look" boost dial is visible to couples' explanations, and audited | NOT BUILT | no | S · Sonnet |
| SUP-72 | **EX-4** ⇄ BF "Ranking L5/L6" | Ranking weights vary by category and can be tuned by an admin | NOT BUILT | ⚖ | M · Sonnet |
| SUP-18 | **EX-5** | A bench card shows how many times that supplier has been booked | NOT BUILT | ⚖ | S · Sonnet |
| SUP-73 | **EX-6** ⇄ BF "Couple-facing N couples inquired" | The marketing demo stops showing a hard-coded "3 couples inquired for your date" | OWNER-GATED | ⚖ | S · Sonnet |
| SUP-74 | **EX-7** | Paid placement on the public marketplace is labelled | NEEDS MEASURING | no | S · Sonnet |
| SUP-75 | **AD-2** ⇄ BF "empty categories" | An empty category says "we do not have vendors for this at the moment" instead of vanishing | PARTIAL | no | S · Sonnet |
| SUP-76 | **AD-1** ⇄ BF "Report this shop" | A signed-in person can report a shop; it lands in the fraud queue | NOT BUILT | no | M · Opus |
| SUP-77 | BF **PR-G2** | Once the venue is locked, suppliers too far from it dim and sink below a divider — never removed | BLOCKED | ⚖ | M · Sonnet ·rule |
| SUP-78 | BF "Per-product listings" | Search for one product inside a supplier's offer (a coffee cart with oat milk) | NOT STARTED | no | M · Sonnet ·rule |
| SUP-79 | BF "Market Scan for suppliers" | A supplier researches the whole market | NOT STARTED | no | M · Sonnet ·rule |
| SUP-80 | BF "Track record on marketplace cards" | Couples see a supplier's track record while browsing | PARTLY BUILT | no | S · Sonnet ·rule |
| SUP-81 | BF "Payments empty-state sentence" | A couple who set a budget is not told to "set your budget" | NOT STARTED | no | S · Sonnet ·rule |
| SUP-82 | BF "Service Card Boosting" | A shop pays a flat price for days on screen for ONE card in ONE coverage, once ≥20 cards compete | BLOCKED | ⚖ **Featured-tier name + price (Tier 3)** | M · Opus ·rule |

## 3h · Plans, pricing and the supplier's data

| # | Build id | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| SUP-83 | **PLAN-1** | A shop on a yearly plan can pay yearly for its add-ons too (the rule exists **only as a local commit in the stale `~` checkout**) | NOT BUILT | ⚖ | M · Opus |
| SUP-84 | **PLAN-2** ⇄ BF "activated vs scheduled" | The admin payments desk says "scheduled", not "activated", for a downgrade that starts later | NOT BUILT | no | S · Sonnet |
| SUP-85 | **PLAN-3** ⇄ BF "Bookkeeper / secretary team roles" | A bookkeeper seat that sees money but not client chat, a coordinator seat, and agents told when assigned | NOT BUILT | ⚖ | L · Opus |
| SUP-86 | **PLAN-4** | A plan's travel reach matches the ladder the owner picked (30 / 60 / 100 km) | OWNER-GATED | ⚖ | S · Sonnet |
| SUP-87 | **PLAN-5** | The Custom plan screen tells the truth, and shows why Custom costs more than Enterprise | PARTIAL | ⚖ **seat price is written as both ₱250 and ₱500 — pick one first** | S |
| SUP-88 | **PLAN-6** | Plan cards never fall back to the old prices when the price list cannot be read | NOT BUILT | no | S · Opus |
| SUP-89 | **PLAN-7** | Vendor AI and Deep Search charge one clear price, not a price chosen by a switch | OWNER-GATED | ⚖ | S · Opus |
| SUP-90 | **PLAN-8** | A "deal" for new or verified shops can include add-ons, and a chosen segment of shops | OWNER-GATED | ⚖ | M · Opus |
| SUP-91 | **PLAN-9** | Pro's "editorial features" perk has something behind it, or stops being listed | NOT BUILT | no | S · Sonnet |
| SUP-92 | **PLAN-10** | Pro's "Priority support — soon" line becomes true or goes | OWNER-GATED | ⚖ | S · Sonnet |
| SUP-93 | **PLAN-11** | A quote with a travel fee inside the shop's own free-travel ring is refused, not quietly zeroed | NEEDS MEASURING | ⚖ | S · Opus |
| SUP-94 | **PRICE-1** | Retired bundles get the same "safe to remove / remove for good" measure as retired products | OWNER-GATED | ⚖ | S · Opus |
| SUP-95 | **PRICE-2** | The product descriptions a July bulk save wiped are put back | NEEDS MEASURING | no | S · Sonnet |
| SUP-96 | **PRICE-3** ⇄ BF "Wake pricing" | A wake gets a Setnayan AI price someone chose, or AI is not offered at a wake | OWNER-GATED | ⚖ | S · owner action on the admin screen |
| SUP-97 | **PRICE-4** | Dead Setnayan AI intro/renewal pricing code is deleted | NOT BUILT | no | S · Opus |
| SUP-98 | **PRICE-5** | The pricing documents stop calling settled things "open" | NOT BUILT | no | S · Sonnet |
| SUP-99 | BF "13 Specialized Pro Tools at ₱888/wk placeholder" | Suppliers could buy per-trade tools at a price someone chose | BLOCKED | ⚖ | S · owner action |

## 3i · What a deletion keeps and destroys (DATA-01 … DATA-10)

**One territory, ten rows, and `05_launch_compliance_admin`'s deletion rows sit on the same tables.**
Treat as a chain: **DATA-10 first** (prove by deleting, not by reading constraints), then the rest.

| # | Build id | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| SUP-100 | **DATA-10** | The full list of what a deletion keeps and destroys is proven **by deleting**, not by reading constraints | NEEDS MEASURING | no | M · Opus |
| SUP-101 | **DATA-01** | A supplier keeps handover proof, payment calendar, downpayment-terms evidence and guest-delivery record when a couple deletes the celebration | NOT BUILT | ⚖ | L |
| SUP-102 | **DATA-02** | An abuse report survives the celebration it was about | NOT BUILT | no | S · Opus |
| SUP-103 | **DATA-03** | A shop's booking-fee bill is not cancelled when the couple deletes | NOT BUILT | no | S–M · Opus |
| SUP-104 | **DATA-04** | A kept booking stops carrying the couple's private note and payment screenshot | NEEDS MEASURING | no | M · Opus |
| SUP-105 | **DATA-05** | Files a deleted celebration leaves behind are removed; chat attachments the supplier keeps stay reachable | PARTIAL | ⚖ | M · Opus |
| SUP-106 | **DATA-06** | The delete confirmation says what the suppliers keep | NOT BUILT | no | S · Sonnet |
| SUP-107 | **DATA-07** | Setnayan can see when it owes a shop a booking-fee credit | NOT BUILT | no | S · Sonnet |
| SUP-108 | **DATA-08** | A returning customer is still recognised after an earlier celebration was deleted | OWNER-GATED | ⚖ | S · Opus |
| SUP-109 | **DATA-09** | A shop's "documented events" and package mix stop dropping when a couple deletes | OWNER-GATED | ⚖ | S–M · Opus |

## 3j · Chat and bench leftovers

| # | Build id | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| SUP-110 | BF "Suggest-then-send AI reply" | A supplier sees a drafted reply above the box and chooses to send it; nothing posts in their name by itself | NOT STARTED | no | M · Opus ·rule |
| SUP-111 | BF "changes back into chat" | Either "changes" returns to chat, or Deal stays the one money card | BLOCKED | ⚖ | S · Sonnet ·rule |
| SUP-112 | BF "Couple's conversation column" | The couple sees which suppliers are waiting on them; the search box is kept or removed | BLOCKED | ⚖ | S · Sonnet ·rule |
| SUP-113 | **ANS-09** ⇄ PH-1 ⇄ PH-2 | Production and the repo agree on every table's shape (one-time schema-drift audit) | NOT BUILT | no | M · Opus |

---

# GROUP 4 · PAPIC
**Territory:** the guest camera · the live wall · credits and the pool · the couple's library ·
face enrolment and consent · the public `/papic` page.
**Fed by:** Unfinished stream **01** (20) · BuildFinale's Papic, supplier-Papic and free-credit areas.
**Shares no files with groups 5, 6 or 7.**

⚠ Two rows here cross into other groups: **PAP-7 (PAP-PRIV-1)** touches Story surfaces (check Group 2
first), and **PAP-2** is the same build as Story's item 12 (**ST-5**) — build it once, in whichever
group runs first.

| # | Build id(s) | What a person gets | Status | Gated | Size · model | Re-measure |
|---|---|---|---|---|---|---|
| PAP-1 | **PAP-EST-1** ⇄ OT-2 ⇄ BF "Home-tile credit estimate uses an invented guess" | The couple's home tile stops guessing how many credits they need | ✅ **SHIPPED AND SERVED 2026-09-13** — PR #5476, merge `8b591b5716`, served `8b591b5` | no | S · Sonnet | `git grep DEFAULT_CAPTURE_MIX origin/main` returns nothing |
| PAP-2 | free-credit rows ⇄ **ST-5** | A same-day host can add guests, and guests get the promised free photos instead of one-then-"refills tomorrow"; the setup wizard shows the amount the account will **actually** get | NOT STARTED | ⚖ **first-event lock vs item 12** | M · Opus | `02_OWNER_DESK.md` Tier 2 |
| PAP-3 | **PAP-WALL-1** | The venue screen shows the running challenge, a countdown, and how many guests have answered | PARTIAL | no | M · Sonnet | `git grep -l "challenge" origin/main -- apps/web/app/[slug]/wall` |
| PAP-4 | **PAP-REPLAY-1** ⇄ BF "Wall replay" (owner 2026-08-28: *"can replay"*) | The wall can replay the day's photos in order, during or after | NOT BUILT | ⚖ | M · Sonnet | — |
| PAP-5 | **PAP-YEAR-1** | A couple can actually **find** their "linked celebrations" screen | NOT BUILT | ⚖ | S · Sonnet | `git grep -rn "linked celebration" origin/main -- apps/web` |
| PAP-6 | **PAP-YEAR-2** | A person invited to two linked celebrations appears **once**, with each invitation underneath | PARTIAL | ⚖ | M · Opus | — |
| PAP-7 | **PAP-PRIV-1** | A guest who asked to be blurred **is** blurred — on the public event page and in the story | ✅ **BUILT AND SERVED — re-measured 2026-09-16.** #5530 (merge `e530a9ca`), an ancestor of served `763b11b`. PR title names the row: "a FaceBlock guest is blurred on the public recap too (PAP-7)". ⚠ The RECAP arm is what landed; check the story surface separately before calling the whole row shut. | no | M · Opus | **Unfinished-only row. Zero hits in BuildFinale's index.** |
| PAP-8 | **PAP-VEND-1** ⇄ DAY-CAMCOPY ⇄ ROOM-05 ⇄ BF "capture screen says the lane is for the supplier's own products" | The supplier's camera says it is for their own work, not for photographing guests — and the couple is told the same | NOT BUILT | no | S · Sonnet | ruling 2026-08-27 |
| PAP-9 | **PAP-WIN-1** | The couple is told when cameras open, instead of being made to pick dates first | PARTIAL | no | M · Opus | — |
| PAP-10 | **PAP-CONSENT-1** ⇄ BF "Guest-facing consent receipt" | A guest who enrols her face gets a plain receipt: what was collected, why, for how long, how to undo it | ✅ **BUILT AND SERVED — re-measured 2026-09-16.** #5535 (merge `e749a504`), an ancestor of served `763b11b`. "feat(privacy): a face enrolment gets a plain receipt" — the RA 10173 receipt this row asks for. | no | S · Sonnet | RA 10173 |
| PAP-11 | **PAP-GUARD-1** | The promotion page's true "chapters" line cannot be quietly deleted, and its guard stops calling the year unlinked | ✅ **BUILT AND SERVED — re-measured 2026-09-16.** #5528 (merge `08ac494f`), an ancestor of served `763b11b`. "the true “reads in chapters” line is pinned to its mechanism (PAP-11)" — pinned to the `PapicChapter` export, so deleting the line turns the guard red. | no | S · Sonnet | — |
| PAP-12 | **PAP-COHOST-1** | A co-host who adds photos through the Uploads camera is credited as themselves | NOT BUILT | ⚖ | S–M · Opus | — |
| PAP-13 | **PAP-OFFLINE-1** | A photo a guest took offline is kept even if it lands past her limit | OWNER-GATED | ⚖ | M · Opus | — |
| PAP-14 | **PAP-HANDOUT-1** ⇄ BF "Host hand-outs count against a guest's ceiling" | Shots the couple hands a guest's camera also lift that guest's limit | OWNER-GATED | ⚖ | S · Opus | `papic_guest_spend_ceilings` already expresses this — **do not add a second column** |
| PAP-15 | **PAP-RESTORE-1** | The couple can (or cannot) put back a photo a guest took off the wall herself | OWNER-GATED | ⚖ | S · Opus | — |
| PAP-16 | **PAP-ROS-1** ⇄ BF "every moment arms for 30 minutes" + "ceremony sequence at every event type" | Each ceremony moment runs a sensible length, and non-weddings get a sequence that fits them | OWNER-GATED | ⚖ | S · Sonnet | — |
| PAP-17 | **PAP-LIB-1** | The couple's invitation photos come from the one Papic library, not a second free upload pile | OWNER-GATED | ⚖ | L · Opus | — |
| PAP-18 | **PAP-LIB-2** | A booked photographer's delivered photos land in the couple's library, not just a link | OWNER-GATED | ⚖ | L · Opus | — |
| PAP-19 | **PAP-YEAR-3** | Engagement parties and showers are their own kind of celebration inside a year | OWNER-GATED | ⚖ | M · Opus | — |
| PAP-20 | **PAP-CC-1** | The Papic control centre knows whether the couple is setting up, running the day, or looking back | OWNER-GATED | ⚖ | M–L · Sonnet | — |
| PAP-21 | **PAP-BRANCH-1** | Old unmerged Papic branches from June are read and closed or landed | NEEDS MEASURING | no | S · Sonnet | see §0b — do this **before** any Papic build |
| PAP-22 | **LE-7** ⇄ BF "Hero badge 50 credits left" | A stranger on the public `/papic` page is not told "50 credits left" | OWNER-GATED | ⚖ | S · Sonnet | open `https://www.setnayan.com/papic` signed out |
| PAP-23 | BF "Market-cost comparison uses three unconfirmed numbers" | "A photographer would cost ~₱8,000 for ~400 photos" is confirmed or corrected | BLOCKED | ⚖ | S · owner figure | **do not guess a number that sizes a recommendation** |
| PAP-24 | BF "Messenger / Viber photo delivery" | Guests receive their photos in Messenger instead of email | NOT STARTED | no | M · Opus ·rule | — |
| PAP-25 | BF "Coordinator partner offer" | Coordinators get a business offer (presence, client dashboard, margin) | BLOCKED | ⚖ | M · Sonnet ·rule | — |
| PAP-26 | BF "Stale docblocks call closed questions OPEN" | Future sessions stop re-asking settled questions | NOT STARTED | no | S · Sonnet | `git grep -rn "OPEN QUESTION" origin/main -- apps/web` |
| PAP-27 | Unfinished 01 · supplier lane | Is the supplier capture lane **open at all**, and its retention + consent wording | BLOCKED | 🔑 **DPO** | S | `02_OWNER_DESK.md` Tier 4 |

---

# GROUP 5 · THE DAY
**Territory:** Event Hub and its controller · the day-of consoles (coordinator, emcee, specialist
desks) · Samahan · Live Studio on the web · guests and the guest site.
**Fed by:** Unfinished stream **04** (31) · BuildFinale's Event Hub, Samahan and Live Studio areas.
**Shares no files with groups 4, 6 or 7** — except **DAY-3/DAY-4**, which sit on the Event Hub
controller the *invite* session touches. Check Group 1's open PRs first.

| # | Build id(s) | What a person gets | Status | Gated | Size · model | Re-measure |
|---|---|---|---|---|---|---|
| DAY-1 | **DAY-WHEEL** | Only the coordinator (or the host when there is none) can move the programme forward — enforced **in the database**, not just the button | PARTIAL | ⚖ | S · Opus | `select pg_get_functiondef(oid) from pg_proc where proname like '%advance%'` — runs against 8 test events today |
| DAY-2 | **LS-POOL** | A couple is only put on a shared Setnayan livestream channel when the product and its price say so | ✅ **ALREADY COMPLETE — shipped 2026-09-03 (LS8), verified in the live catalogue 2026-09-17.** `LIVE_STUDIO` **₱2,500 is_active TRUE** (updated 2026-09-03) and `LIVE_STUDIO_HOSTED_CHANNEL` **₱3,000 is_active TRUE** (created 2026-09-02, updated 2026-09-03). The hosted channel is **genuinely per-day, deliberately** — a Setnayan channel is a scarce resource while the software unlock is not. ⚠ **NOT AN OWNER ROW AND NEVER WAS.** It sat on his desk for a price that had been on sale for thirteen days, on a premise this register supplied — *"switched off right now and sells nothing"* — which was carried from a memory note and never re-read against the catalogue. **His 2026-09-16 figures CONFIRMED the shipped price; they did not set it.** ⛔ **IF THIS AREA IS EVER REOPENED, DO NOT WIDEN ONE GUARD:** the check forbidding any non-test surface from calling Live Studio *"priced per day"* was kept strict through LS8 on purpose — the prose was reworded instead — because the defect it guards is a surface telling a couple their ₱2,500 one-time unlock expires, and *"a regex that tried to tell the two SKUs apart by proximity would be the thing that quietly stops matching."* | no | — | `select service_code, retail_price_php, is_active, updated_at from platform_retail_catalog_v2 where service_code ilike 'LIVE_STUDIO%';` |
| DAY-3 | **EH-ROOMS** ⇄ BF "Rooms per kind of event" | Each kind of event offers only its own rooms — a corporate day has no gifts page, a tournament seats spectators | PARTIAL | ⚖ | M · Opus | check Group 1 |
| DAY-4 | **EH-MONEY** ⇄ BF **S6** | The Event Hub controller shows what this event already owns, as a filling meter | NOT BUILT | no | S–M · Opus | check Group 1 |
| DAY-5 | **DAY-NOTICE** | A coordinator's urgent notice reaches the emcee instantly, as a quiet corner marker he opens on a beat | PARTIAL | ⚖ | S–M · Sonnet | — |
| DAY-6 | **DAY-INBOX** ⇄ BF "requests inbox inside the live console" ⇄ `coordinator_requests_inbox` | The coordinator reads the requests inbox without leaving the fullscreen live console | NOT BUILT (**table is BUILT-NOT-LIVE**) | no | S · Sonnet | `select count(*) from coordinator_requests_inbox` |
| DAY-7 | **DAY-QUESTIONS** ⇄ BF "Emcee questionnaire" | The emcee asks the couple his own questions (pronunciations, titles, what not to say) without seeing the guest list, and reuses his set | NOT BUILT | ⚖ | M · Opus | — |
| DAY-8 | **DAY-LOAN** | The emcee can retime his own segments while the couple has lent him the schedule, and is told it is on loan | PARTIAL | no | S · Sonnet | — |
| DAY-9 | **DAY-FREE** ⇄ BF "Day-of specialist desks free during launch" + `NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL` | Every real booked supplier gets the specialist day-of desks free during launch | NOT BUILT | ⚖ **the "free until" date** | S · Opus | `vercel env ls` for the flag |
| DAY-10 | **DAY-SHOTLIST** ⇄ BF "Shot list syncs across devices" | The shot list really reaches the couple (or the console stops saying so), and the console opens for rehearsal and wrap-up | ✅ **BUILT AND SERVED — re-measured 2026-09-16.** #5502 (merge `da662e25`), an ancestor of served `763b11b`. "the console stops claiming the shot list reaches the couple" — the row’s own second branch, which is the honest one. | ⚖ | S | — |
| DAY-11 | **EH-SIGNAL** ⇄ OT-1 ⇄ ROOM-11 ⇄ BF "Supplier's desk works on weak signal" | The supplier's desk and the day-of consoles keep working in a venue with one bar of signal | NOT BUILT | ⚖ | **L · Opus** | the largest single row in Group 5 |
| DAY-12 | **LS-SCREEN** | A venue screen can show the Live Studio feed, not the photo wall | NOT BUILT | no | M · Opus | — |
| DAY-13 | **LS-LEGACY** ⇄ BF "Delete the old livestream code" | The old Cast screens are retired so a couple only ever meets the unified Live Studio controller | PARTIAL | no | M · Sonnet (redirects) · Opus (the deletion PR) | — |
| DAY-14 | **LS-DAYCOPY** | The controller stops offering "Add another day" now that Live Studio is one permanent unlock per event | 🟠 **FACT TRUE, CONSEQUENCE FALSE — corrected 2026-09-17 by EXECUTION, not by reading.** The sentence _"Your broadcast day has ended… Add another day"_ is in the file. **Nobody can be shown it.** The render needs `withheld && entitled`, and after LS6 `entitled` reduces to `owned && !owned`: `decideBroadcastWindow` is two-valued, the page derives both flags from the same boolean, and `decideProgramAir` returns `withheld: null` on its `if (owned)` early return. ⭐ **Measured by running both pure deciders across 2 ownership values × 6 channel shapes: the branch renders in 0 of 12**, and the 2 combinations that do set `withheld` land on the other, honest sentence. ⚠ **TWO SUB-CLAIMS OF MINE WERE ALSO WRONG:** no test holds the copy (the only match is inside a COMMENT), and the price already reads `retail_price_php` from `platform_retail_catalog_v2` via `formatV2Sku`. ⇒ **What is left is dead-code tidy-up:** delete the dead `entitled ?` fork and two stale comments (one still cites WAVE 7's never-interrupt rule that LS6 retired), and **guard the invariant BY EXECUTION** so it reds if `reason` ever becomes three-valued again. **Re-ranked BELOW anything a couple can currently see.** | no | hours · Sonnet | execute `decideBroadcastWindow` and `decideProgramAir` over the ownership × channel matrix and assert the branch is unreachable — do not re-read the JSX |
| DAY-15 | **LS-DEMO** | Someone browsing Live Studio before they have phones can try a **labelled** demo controller | NOT BUILT | ⚖ | M · Sonnet | — |
| DAY-16 | **CC-1** ⇄ BF "Live Studio control-room port" | Live Studio opens on its broadcast screen once the couple has it, cameras underneath, channel control in a "set once" row | NOT BUILT | ⚖ | M · Sonnet | — |
| DAY-17 | **CC-2** | Papic's stage shows a photo still being checked, and each way in shows what it brought | PARTIAL | ⚖ | S–M · Sonnet | — |
| DAY-18 ⊕ | **CC-3** ⇄ BF "the other ~14 service pages on the stage pattern" | Every started in-app service opens on its own content, not a form | NOT BUILT | ⚖ | **L overall**; each service S–M · Sonnet | a bundle of ~14, never split |
| DAY-19 | **EH-PREVIEW** ⇄ BF `NEXT_PUBLIC_HUB_NAMED_GUEST_PREVIEW_ENABLED` | "Preview as a guest" behaves the same on both pages: either both may show a real named guest's view, or neither does | OWNER-GATED | ⚖ | S · Opus | `vercel env ls` |
| DAY-20 | **SAM-NUDGE** ⇄ BF Samahan | A samahan member is reminded to post their story this hour | OWNER-GATED | ⚖ | S–M · Sonnet | — |
| DAY-21 | **SAM-JOIN** ⇄ BF Samahan | Members are told when somebody joins their samahan | OWNER-GATED | ⚖ | S · Sonnet | — |
| DAY-22 | **SAM-KEEP** ⇄ BF Samahan ("stitched film" + "a place where a samahan keeps things") | A samahan keeps its good moments: a stitched film of the day, and a permanent shelf | OWNER-GATED | ⚖ | M–L · Opus | — |
| DAY-23 | **SAM-SHAPE** ⇄ BF Samahan (sub-groups · findable · hard delete) | Samahans can nest, be found by strangers, and be deleted outright | OWNER-GATED | ⚖ | M · Opus | — |
| DAY-24 | BF Samahan | Photos can be sent in the group chat (Usapan); a Memories tab of past group moments | NOT STARTED | no | S · Sonnet ·rule | — |
| DAY-25 | **GA-CAMERA** | The camera on the invitation page says when guests may shoot **before** the shutter, not after | ✅ **ALREADY COMPLETE — closed by the owner 2026-09-17.** Asked which of two readings he meant, he answered **"the terms"**. The one-time UGC acceptance **ships and gates the first capture**: `/api/papic/accept-terms` stamps it and the guest camera refuses to shoot until it is stamped — the guest is told **before** the shutter, which is the row's whole ask. ⚠ **THE OTHER READING IS NOT AUTHORISED BY THIS ANSWER.** *When during the celebration guests may shoot at all* is a different mechanism, is unmeasured, and **is not to be built on the strength of this ruling.** If a time window is ever wanted it is a new row and a new question. 🔑 Asked rather than chosen because **one reading closed a row and the other started a build, and nothing in the tree could tell them apart.** | no | — | `grep -n 'accept-terms' apps/web/app/api/papic -r` and read what the guest camera gates its first capture on |
| DAY-26 | **GA-QR-EMAIL** | A guest is sent their personal QR when it is first issued | OWNER-GATED | ⚖ | S · Opus | — |
| DAY-27 | **FE-AFTER** | A finished event's progress rail shows an honest "after" stage | PARTIAL | no | S · Sonnet | — |
| DAY-28 | **OB-ROLLOUT** | Real couples' Event Hubs open fully to guests by default, and the old phase-only code is removed | PARTIAL | ⚖ | S | — |
| DAY-29 | **DES-PORT** ⊕ | The rest of the design programme's ~40 units are ported to the approved archetypes | PARTIAL | no | **L** | a bundle of ~40 |
| DAY-30 | **DES-FOOTER** | Every public page's footer text — including the Data Protection Officer contact line — is readable | OWNER-GATED | ⚖ | S · Sonnet | contrast; ties to `dpo@setnayan.com` (Tier 4) |
| DAY-31 | **PAY-REVIEW** | The interrupted attack on the one payment page's conversion is finished | NEEDS MEASURING | no | S · Opus | — |
| DAY-32 ⊕ | BF guest-site block | Eight guest-site findings on the couple's website: countdown ends 8 hours early · the couple's song is silent at the seat pass · a "Private" site shows a success-green chip · the guest login cookie is never extended · preview the site as an invited guest · a guest whose invitation fails to load is told it failed · the live-photo-wall section can never show photos · address row, greeting, force-live, 44 px taps | MIXED | mostly no | M · Sonnet ·rule | a bundle of eight; `EVENT_WEBSITE_BUILD_PLAN` |
| DAY-33 | **PH-6** ⇄ BF "Couple pins the website to one phase" | A couple chooses "show the RSVP version" instead of the clock deciding | NOT BUILT | ⚖ | M · Opus | — |

---

# GROUP 6 · LAUNCH
**Territory:** the privacy pages · production flags · the admin console · security, grants and schema ·
repo hygiene · legal documents.
**Fed by:** Unfinished stream **05** (46) · BuildFinale's flags, security, ops and legal areas.

🔑 **The five privacy rows (LAU-1 … LAU-5) appear in ONE pack only.** BuildFinale's index has **zero
hits** for them. They are also the one class whose wrongness **does not scale with user count**:
`/privacy` returns **200** to anyone today — ✅ **verified 2026-09-12 19:40Z**,
`curl -s -o /dev/null -w '%{http_code}' https://www.setnayan.com/privacy` — and the owner is the
registered data-protection officer.

⚠ **But their researchers read code only — never the production database.** Step one on every CP row is
**re-verifying**, not rewriting copy.

## 6a · Privacy — the live page vs what the code does

| # | Build id | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| LAU-1 | **CP-1** | Someone closing their account is told what really happens | OWNER-GATED | ⚖ **what closing an account should do** | S |
| LAU-2 | **CP-2** | The device-hash promises become true (exported and deleted), and old device rows are pruned | NOT BUILT | ⚖ | S–M · Opus |
| LAU-3 | **CP-4** | Every company that reads a couple's words or photos is **named**: OpenAI, LanguageTool, Gemini | PARTIAL | ⚖ | S · Sonnet |
| LAU-4 | **CP-5** | The page stops saying analytics carry "no personal identifiers" | NOT BUILT | ⚖ | S · Sonnet |
| LAU-5 | **CP-7** | The two "withheld for privacy" photo states either get a writer or are removed | PARTIAL | ⚖ | S–M · Opus |
| LAU-6 | **CP-3** ⇄ BF "Google keys stored encrypted" | Google Drive / YouTube / TikTok connection keys are stored encrypted, as the filings say | ✅ **BUILT AND SERVED — re-measured 2026-09-16.** #5478 (merge `22300daf`), an ancestor of served `763b11b`. "a couple’s Drive/YouTube/TikTok connection keys are stored encrypted" — exactly the filing this row cites. | no | M · Opus |
| LAU-7 | **CP-6** | A wake's recap share card and auto social post stay quiet too | PARTIAL | no | S · Sonnet |
| LAU-8 ⊕ | **CP-8** ⇄ BF "Download my data covers everything" | "Download my data" includes the record types it still leaves out | PARTIAL | no | **L** |
| LAU-9 | **CP-9** | The compliance pack says what the product actually does; the 0d/0e sign-off texts get written | PARTIAL | ⚖ **DPO sign-off** | M · Sonnet (corpus) · Opus (guard flip) |
| LAU-10 | **CP-10** ⇄ BF "CSP enforced" | The browser protection can be switched on without breaking face matching | PARTIAL | no | S · Opus |
| LAU-11 | **CP-11** | A host's "delete this photo" really deletes it | ✅ **SHIPPED AND SERVED 2026-09-13** — PR #5475 | no | — |
| LAU-12 | **CP-12** | Deletion jobs are proven to have run **in production** | NEEDS MEASURING | no | S · Opus |
| LAU-13 | BF guest-phone gates 0d/0e | The privacy filing names guest-phone capture, and the RSVP consent wording is confirmed | BLOCKED | 🔑 **DPO** | S |
| LAU-14 | BF legacy-memories brief | A dated written legal reply on file before Phase 3 legacy work | BLOCKED | 🔑 **owner re-sends to counsel** | — |
| LAU-15 | `02_OWNER_DESK` Tier 4 | **`dpo@setnayan.com` reaches a person** | NOT DONE | 🔑 **only he can** | minutes |

## 6b · The admin console

| # | Build id | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| LAU-16 | **AD-3** | The admin assistant fills the form on every page, not only Taxonomy | PARTIAL | no | M |
| LAU-17 | **AD-4** | A guest or order found in admin search opens its own page with the admin's actions | PARTIAL | no | M · Opus |
| LAU-18 | **AD-5** | Admin search finds categories, tiles, folders, event types and faiths by name | NOT BUILT | no | S–M · Sonnet |
| LAU-19 | **AD-6** ⇄ BF "two-person approval" | Large refunds, comp grants and payout-account changes need a second admin | PARTIAL | ⚖ | M · Opus |
| LAU-20 | **AD-7** | A journal spotlight approval is not refused by a stale database rule | NEEDS MEASURING | no | S · Opus |
| LAU-21 | **AD-8** | The ₱3M combined-gross tripwire gauge on the admin money screen | OWNER-GATED | ⚖ | S–M · Opus |
| LAU-22 | **AD-9** | Every admin menu item can be renamed from `/admin/menus` | NOT BUILT | no | S · Sonnet |
| LAU-23 | **AD-10** | Fourteen screens use a colour class that does not exist | NOT BUILT | no | S · Sonnet |
| LAU-24 | **AD-11** | The assisted-planner free trial cannot be farmed with a new email | PARTIAL | no | S–M · Opus |
| LAU-25 | BF "Admin job scopes and spending caps" | Admin logins get scoped powers and money caps | BLOCKED | ⚖ | M · Opus ·rule |
| LAU-26 | BF "Bank-alert auto-matcher" | Payments match bank alerts automatically | NOT STARTED | no | M · Opus ·rule |
| LAU-27 | BF "Guardian / after-death account management" | A guardian or legacy contact can act for someone | BLOCKED | ⚖ | L · Opus ·rule |

⚠ **A new admin page must join four registries** — the console-table CONVERTED list, the regenerated
map/jobs, the nav descriptions, and `MODEL_CHOICE_CAP` (+1 per page; it is exactly tight). Applies to
LAU-18, LAU-22 and any new screen in this group.

## 6c · Schema, security and the platform floor

| # | Build id | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| LAU-28 | **PH-1** ⇄ BF "two prod-only tables have no CREATE TABLE" | The committed production-schema snapshot is refreshed and the repo's schema matches prod | PARTIAL | no | S · Opus |
| LAU-29 | **PH-2** ⇄ BF "default-value drift invisible to the guard" | The drift check also compares column defaults, and its docs stop lying | PARTIAL | no | M · Opus |
| LAU-30 | **PH-3** ⇄ BF "abuse-flag insert error never read" | A refused abuse-flag insert is no longer silent | NOT BUILT | no | S · Sonnet |
| LAU-31 | **PH-4** | A guard stops new "catch that cannot catch" reads | NOT BUILT | no | M · Opus |
| LAU-32 | **PH-5** ⇄ BF "soft-404s via loading.tsx" | Missing pages return a real 404, everywhere | PARTIAL | no | M · Sonnet |
| LAU-33 | **PH-7** | The couple's website "live photo wall" section can ever show photos | NOT BUILT | no | S · Sonnet |
| LAU-34 | **PH-8** ⇄ BF "how many couples may hold one date" | A supplier can say how many couples may hold the same date — **or the copy saying they can is retired** | OWNER-GATED | ⚖ | S · Sonnet |
| LAU-35 | **PH-9** | Photos load fast and cheaply (stable image addresses) | PARTIAL | no | M · Opus |
| LAU-36 | **PH-10** | Environment switches accept `TRUE` and `1` like `true` | PARTIAL | no | S · Sonnet |
| LAU-37 | **PH-11** | `STATUS.md` points at the real launch checklist | NOT BUILT | no | S · Sonnet |
| LAU-38 | **PH-12** | Run-of-show times reach the couple's calendar | OWNER-GATED | ⚖ | S |
| LAU-39 | **PH-13** ⇄ **POOL-HEALTH** ⇄ BF "livestream channel health tells the truth" | Idle Google / TikTok connections are refreshed on a schedule, and the dashboard says "needs reconnect" instead of "connected" | PARTIAL | no | S · Opus |
| LAU-40 | **PH-14** | One tested secret resolver behind every signed guest cookie | PARTIAL | no | S · Opus |
| LAU-41 | **PH-15** | The offline service worker stops caching app pages as guest pages | NOT BUILT | no | S · Sonnet |
| LAU-42 | BF "anonymous read grants on unused tables" | One wrong rule stops being a leak | PARTIAL | no | S · Opus ·rule |
| LAU-43 | BF "a couple can post a message that looks like a supplier's" | Messages cannot be faked | UNVERIFIED | no | S · Opus ·rule |

⚠ **A new column inherits the public grant.** `anon`/`authenticated` get SELECT+INSERT+UPDATE for free,
and a column-level REVOKE against a table grant is a no-op. Any row here that adds a column must run
`exposure-freeze.db.test.ts` locally before its PR.

## 6d · Marketing pages, SEO and the store

| # | Build id | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| LAU-44 | **LE-5** ⇄ BF "/features redesigned as editorial" | The features page gets the editorial look — **and says only what ships** | NOT BUILT | ⚖ | M · Opus (first archetype) · Sonnet after |
| LAU-45 | **LE-6** ⇄ BF "sitemap tidy" | The sitemap stops sending people to dead ends; `/alaala` is indexed | PARTIAL | no | S · Sonnet |
| LAU-46 | BF "public pages outside the new shell" | Blog, features, creators, monogram, tour, download, our-story and waitlist wear the same chrome | PARTLY BUILT | no | M · Sonnet ·rule |
| LAU-47 | **LE-8** ⇄ BF "supplies shop real checkout" | The supplies shop ("Paprint") sells real products with a real checkout | NOT BUILT | ⚖ | L · Opus |
| LAU-48 | **LE-9** | Setnayan AI taps a couple the moment a watched supplier's date or price changes | NOT BUILT | ⚖ | M–L · Opus |
| LAU-49 | BF "daily SEO check demands a Google token" | The admin SEO audit stops warning about a verification already done by DNS | NOT STARTED | no | S · Sonnet ·rule |
| LAU-50 | BF "Bing verification + Search Console" | Search traffic is visible to the admin | BLOCKED | 🔑 **accounts** | S |
| LAU-51 | BF "App translation" | Tagalog/Cebuano UI beyond three marketing twins | NOT STARTED | no | L ·rule |

## 6e · Ops, repo hygiene and the records

| # | Build id | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| LAU-52 | BF `_research/repo_sweep.md` | **13 security alerts on outside packages, 5 of them high, and rising** — triaged; Sentry SDK upgraded | NOT STARTED | no | S–M · Opus ·rule |
| LAU-53 | BF repo sweep | PR **#5405** fails a required check and has sat still since 09-10 — land it or close it | OPEN | no | S |
| LAU-54 | BF repo sweep | **#4472's problem is still in the code**; it and #4471 were closed with no replacement | OPEN | ⚖ **Tier 6** | S |
| LAU-55 | BF repo sweep | Branch `handoff-hardening` holds two real fixes to the handoff note (the `is_internal` false-green risk) that never merged | UNLANDED | no | S | 
| LAU-56 | BF ops floor | An uptime monitor, a test production error reaching an inbox, and bucket upload permissions | UNVERIFIED | ⚖ **deploy-drift alerts must reach someone** | S–M |
| LAU-57 | BF "required checks on main" | Branch protection says what it should | BLOCKED | ⚖ | S |
| LAU-58 | BF marketplace hygiene | The FIXTURE shop is hidden from Google; retired Pabati is removed from SetnaProd's services; two events flagged primary | BLOCKED | ⚖ **owner's own shop data** | S |
| LAU-59 | BF "clear the retired hero-video folders" | Frees the biggest chunk of storage | BLOCKED | ⚖ | S |
| LAU-60 | BF "COWORK_INBOX historical backlog" | The repo's working-notes inbox (76 "pending" rows) is documentation debt, **not missing code** | — | no | S |

---

# GROUP 7 · DESKTOP
**Territory:** the Tauri app · the Rust encoder · signing, notarization and the updater · Windows.
**Fed by:** Unfinished stream **06** (12) · BuildFinale's encoder and X0 areas.
**Shares no files with the web at all.** It is the only group that can safely run beside another.

🔑 **ONE OWNER ACTION UNBLOCKS MOST OF IT: the R2 release secrets — 5 values in 2 stores.** That single
item is the blocker for the app being downloadable at all, for the auto-updater going live, and for the
physical rehearsal.

✅ **VERIFIED on production 2026-09-12 19:40Z:** `/api/download/mac` and `/api/download/windows` both
answer **503**. The `/download` *page* answers 200 — so a person reaches a page that cannot give them
anything. Re-measure:
`for u in /api/download/mac /api/download/windows; do curl -s -o /dev/null -w "$u %{http_code}\n" https://www.setnayan.com$u; done`

⚠ **Read `claude/encoder-actually-runs` (2 commits, pushed, no PR, unowned) before building any
ENC-\* row.**

| # | Build id(s) | What a person gets | Status | Gated | Size · model |
|---|---|---|---|---|---|
| DSK-1 | **ENC-OWN** ⇄ BF "own-channel has no ingest address" | A couple streaming on their **own** YouTube channel — the DEFAULT tier — can go live from the desktop app without OBS (today the encoder refuses with `no_stream_key`) | ✅ **SHIPPED AND SERVED 2026-09-13** — PR #5474 | no | — |
| DSK-2 | **ENC-RETRY** | After a couple connects their stream key, the encoder actually starts — without reloading the page | PARTIAL | no | S · Sonnet |
| DSK-3 | **ENC-RTMPS** ⇄ BF "plain-RTMP, no backup ingest" | Hosted-channel broadcasts go out over **encrypted RTMPS** (443, not 1935) and fail over to YouTube's backup ingest | ✅ **BUILT AND SERVED — re-measured 2026-09-16.** #5480 (merge `45c3b873`), an ancestor of served `763b11b`. PR title names the row: "DSK-3: the hosted broadcast goes out encrypted, with a real failover." | no | M · Opus |
| DSK-4 | **ENC-ABR** | When the venue's upload slows, the broadcast drops to a lower quality instead of freezing | PARTIAL | no | M · Sonnet, high effort |
| DSK-5 | **DESK-VER** ⇄ BF "S12 auto-updater (BUILT-NOT-LIVE)" | A fix to the desktop encoder actually reaches couples who already installed the app | NOT BUILT | 🔑 **R2 secrets** | S · Sonnet |
| DSK-6 | **DL-COPY** | The download page stops promising "notarized by Apple" while it has no build to give | PARTIAL | no | S · Sonnet |
| DSK-7 | **PROBE-HARNESS** | The measurement scripts can measure a Windows laptop and can see the app's memory | NOT BUILT | no | S · Sonnet |
| DSK-8 | **S15** ⇄ **LE-4** | Couples can download and install the app — the two `/api/download/*` routes stop answering 503 | BLOCKED | 🔑 **R2 release secrets** | S |
| DSK-9 | **S16** | The encoder is proven against YouTube's real ingest, and the "how long does YouTube wait" number is **measured, not guessed** | BLOCKED | 🔑 **owner** | S |
| DSK-10 | **S17-REST** | The app is proven to hold a six-hour wedding on a Mac **and** on Windows (thermal, memory, the Windows leg) | BLOCKED | 🔑 **a Windows machine** | S · Sonnet, medium effort |
| DSK-11 | **S13** | A full dress rehearsal of a wedding day, the way a couple would run it — produces the couples' rehearsal script | BLOCKED | 🔑 **a second device** | M |
| DSK-12 | BF **X0 #3** | Windows OV code-signing certificate + cloud signer — otherwise Windows couples meet "Windows protected your PC" in their wedding week | BLOCKED | 🔑 **certificate purchase** | — |
| DSK-13 | BF X0 | Apple notarization / stapling · iPhone resubmission · Android D-U-N-S · the Windows `.msi` actually run | BLOCKED | 🔑 **accounts + a Windows machine** | — |
| DSK-14 | **LE-2** | The store app never plays content bought on the web | PARTIAL | no | S · Sonnet |
| DSK-15 | **LE-3** ⇄ BF "Apple in-app purchase" | Apple in-app purchase for Setnayan's own digital products (guideline 3.1.3(b)) | NOT BUILT | ⚖ | L · Opus |
| DSK-16 | **LE-1** ⇄ BF "Android on Google Play" | Android push and verified app links work | OWNER-GATED | 🔑 **D-U-N-S** | S · Sonnet |
| DSK-17 | BF encoder | WebContent memory growth 439→910 MB is unattributed; minimised-window degradation and the S4 average-bitrate figure are unverified | UNVERIFIED | no | S · Sonnet ·rule |

**No frame has ever reached YouTube.** DSK-9 and DSK-11 are the rows that would change that, and both
are owner/device-blocked, not engineering-blocked.

---

# §F · THE PRODUCTION FLAGS — a class of their own, not builds
**BuildFinale-only. The Unfinished pack has no equivalent section.** 45 switches: **21 built but
switched off · 17 waiting on the owner.**

🔑 **These are mostly NOT engineering.** A flag that is BUILT-NOT-LIVE needs a decision and a Vercel
change, not a session. Treating them as builds is how the same work gets re-estimated twice.

🛑 **A flag's default in code is NOT its value in production.** `vercel env ls` says set/not-set, and
absence points **opposite ways** for `!== 'false'` versus `=== 'true'`. `NEXT_PUBLIC_*` is readable in
the prod bundle; server-side values are not readable from a session at all — say so rather than guess.
This has been got wrong and caught by the owner before.

| Class | Count | What to do |
|---|---|---|
| **BUILT-NOT-LIVE** — the feature exists, the switch is off | 21 | Owner decides on/off. One Vercel change each. Includes `GUEST_COLUMNS_ENABLED`, `GUEST_SESSION_TOKEN_CHECK`, `GUEST_QR_SELF_ROTATE`, `NEXT_PUBLIC_GUEST_NOW_TRIGGER`, `NEXT_PUBLIC_U_NESTING_CUTOVER`, `PABUYA_PUBLIC_ROUTE_ENABLED`, `PAPIC_CLIP_DROP_ENABLED`, `NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED`, `coordinator_requests_inbox`, `NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED`, `NEXT_PUBLIC_PACKAGE_CREDIT`, `NEXT_PUBLIC_VENDOR_ADDON_FIRST5_FREE`, `NEXT_PUBLIC_VENDOR_AI_LADDER`, `NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH`, `NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED`, `NEXT_PUBLIC_PLAUSIBILITY_SCANNER_ENABLED`, `NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED`, `NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED`, `NEXT_PUBLIC_BOOTH_STUDIO_ENABLED`, `NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE`, `NEXT_PUBLIC_LIFE_STORY` |
| **BLOCKED ON OWNER** — a ruling, usually money or privacy | 17 | Goes on his desk. Includes `NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE`, `NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY`, `VENDOR_FAVORITES_SUBSCRIPTION_GATE`, `platform_settings.setnayan_ai_per_event_pricing_enabled`, `NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL`, `NEXT_PUBLIC_HUB_NAMED_GUEST_PREVIEW_ENABLED`, `NEXT_PUBLIC_PEOPLE_CONNECTIONS`, `NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED`, `NEXT_PUBLIC_VERIFIED_MEDIAN_ENABLED`, `VENDOR_TIER_FEATURE_GATE`, `NEXT_PUBLIC_VENDOR_SEO_TIER_GATE`, `platform_settings.vendor_tier_pipeline_caps_enabled`, `NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED`, `NEXT_PUBLIC_BAZI_BIRTHDATA_ENABLED`, `FEATURE_ACCOUNT_AUTOSURFACE`, `CSAM_HASH_MATCH_ENABLED`, `FACEBOOK_PROVIDER_CONFIGURED` |
| **UNVERIFIED** — nobody has read its prod value | 7 | A read-only check, minutes each. `NEXT_PUBLIC_SERVICE_DETAILS_ENABLED`, `PROMO_FREE_WINDOWS_ENABLED`, `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED`, `SETNAYAN_AI_PAYWALL_ENABLED`, `NEXT_PUBLIC_DEPENDENT_PEOPLE`, `NEXT_PUBLIC_PLAN3D_BOOTH_ADS`, `R2_PUBLIC_URL` |

⚠ **`CSAM_HASH_MATCH_ENABLED` cannot be satisfied by "the free Cloudflare tool".** `setnayan.com` is
**not** a Cloudflare zone — Cloudflare is storage only, DNS is GoDaddy. Anything that works on proxied
traffic is unavailable without moving DNS, which is a real infrastructure change.

Re-measure the whole block: `vercel env ls` · and for each `[DB]` row,
`select key, value from platform_settings where key = '<key>'`.

---

# §G · What this merge found that no single pack says

1. **Three of the highest-value items are FINISHED and merely unlanded.** ST-1 (the React #418 root
   cause, pushed, no PR), PAP-1 (commit `1ca4989f8c`, no branch on main), and SUP-E (DRAFT #5463, fully
   checked). None of the three packs puts them together, because each pack saw only its own. **Landing
   three PRs is worth more this week than starting any new build.**

2. **The owner's three looks (A1 · A2 · A3) release six build sessions** — SUP-A, SUP-B, SUP-C, SUP-D,
   and through them the shop-page and My-Shop collision chains. One afternoon of looking. Nothing else
   on the desk comes close to that ratio.

3. **Three rows are blocked on nothing at all** and no pack flags them as such: **SUP-F** (the supplier
   sees the couple's free Papic photos while quoting), **SUP-G** ("Propose schedule" says why it is shut —
   ✅ shipped and SERVED 2026-09-13, PR #5479), **SUP-I** (gift snapshot at lock — opens DRAFT). If the owner is
   unavailable, these are what a session should take.

4. **One build is counted twice across packs and would have been built twice:** Story's item 12
   (**ST-5**) and Papic's same-day free credits (**PAP-2**) are the same work, in two different groups,
   from two different packs. It is also the one row whose ruling **contradicts** an existing lock.

5. **A second source of truth was nearly created:** `PAP-HANDOUT-1` (PAP-14) reads as a new column,
   but `papic_guest_spend_ceilings` already expresses exactly it, with `ceiling_points = 0` as the
   documented "may not spend". Build against that table, not beside it.

6. **The privacy rows are the only class whose damage does not scale with user count.** Everything else
   in the Unfinished pack's Tier 1 is pre-launch debt against 13 users, 8 events and 2 shops —
   `ROOM-12`'s blast radius is **2 people**. `/privacy` is wrong for **anyone who opens it**.

7. **A NEW OWNER QUESTION, RAISED BY LANDING PAP-1:** the couple's home tile does **not** read
   `papic_event_pool_config` — it uses the formula's code fallbacks, which today are byte-identical to
   the live row (150 / 5,000 / 30,000, measured 2026-09-12). Editing the row in `/admin/pricing` would
   therefore NOT reach the tile. Fixing it costs one indexed single-row read on a money surface.
   Flagged, not taken (PR #5476). A tripwire test holds the fallbacks to the measured row meanwhile.

8. **The `~` checkout holds the only copy of one item.** PLAN-1's "one bill for a shop's add-ons" rule
   exists as a local commit in the stale `/Users/icecasasola` checkout. That checkout is ruled
   *"leave it"* (2026-09-09) and must never be read as current code — but this one commit is real and
   is nowhere else.

---

# §H · Recommended order

**One build session at a time. Land it (MERGED *and* SERVED), then start the next.**

| | What | Why it is here |
|---|---|---|
| 1 | **Land ST-1** (open the PR on `claude/no-client-value-in-server-tree`) | Finished, reviewed, pushed. May close ST-7 in passing. |
| 2 | **Land PAP-1** (commit `1ca4989f8c`) | Finished on 2026-08-31 and stranded since. |
| 3 | **Read `claude/encoder-actually-runs`** | Unowned, 2 commits, pushed. Decide land-or-close **before** any DSK row. |
| 4 | **The owner's afternoon: A1 · A2 · A3, plus S1a/S1b on a phone** | Releases SUP-A…SUP-D and closes I-1/I-2. Highest ratio on the desk. |
| 5 | ~~SUP-G~~ ✅ shipped · **then SUP-F, then SUP-I** | Blocked on nothing; keeps a session productive while he looks. |
| 6 | **SUP-1 (ROOM-12), then SUP-23 (VER-1)** | Both must land **before** G1/G3, per the Unfinished pack's own sequencing. |
| 7 | **LAU-1…LAU-5**, re-verified against the **database** first | The only class whose wrongness does not scale, and he is the DPO. |
| 8 | **Group 1 themes: Velvet → Galeriya → Abaca**, strictly serial | They share one skin switch, one font loader, and `lib/invite-themes.test.ts`. |

⚠ **Before starting any of these, run the three RULE 0 in-flight checks** — `gh pr list --state open`,
`git worktree list`, `git log origin/main --oneline -15` — and read the uncommitted trees with
`git -C <wt> status --porcelain`. A branch diff and a trial merge are both blind to an uncommitted file,
and the Invite territory has four of them right now.

---

*Built by folding `packs/BuildFinale/`, `packs/Setnayan_Unfinished_Builds_2026-09-11/` and
`packs/StoryFinale/` against `origin/main` `75aaeb003d`. Statuses are carried from the pack that found
them except where marked VERIFIED or DROPPED. **This file is not evidence either** — run a row's
re-measure command before building it.*

---

## 🔬 APPENDIX · THE 2026-09-16 RE-MEASURE — what was actually run, and what came back

**Read this before you trust any `NOT BUILT` above.** On 2026-09-16 every remaining
`NOT BUILT` row was swept against `origin/main` with one `git grep -l -E -i` each. The
command and its result are below so the next session **re-runs the measurement instead of
repeating the guess.** Nine rows were closed outright in the same pass because a merged PR
**named the row ID in its own title** — that is the strongest signal available and it is worth
trying first:

```
gh pr list --state merged --limit 200 --search "merged:>=2026-09-05" \
  --json number,title,mergeCommit --jq '.[] | "\(.number)\t\(.mergeCommit.oid[0:8])\t\(.title)"' \
  | grep -E '\b(SUP|PAP|ST|DAY|LAU|DSK)-[0-9]+'
```

### ⚠ HOW TO READ THE TWO OUTCOMES — they are NOT symmetrical

- **NONE** — nothing matched. On a row asking for a **presence** this proves only that *the
  phrasing in the table below is not the phrasing that shipped.* It is a hint, never a verdict.
  Search a second wording before you build. (On a row asking for an **absence** — "the page
  stops saying X" — a NONE is close to decisive, which is how SUP-19 was closed.)
- **files listed** — something with that name exists. **Existence is not the claim.** Open the
  file and check the row's actual sentence. DAY-14 matched its own search term and is *still
  wide open*: the file contains the false copy the row exists to remove.

### Rows where the sweep found NOTHING (probably real work — verify the wording first)

| row | searched for | under |
|---|---|---|
| SUP-5 | `date_hold|hold_expires|kept the date` | `apps/web supabase/migrations` |
| SUP-11 | `lock_request` | `apps/web/app/api/cron supabase/migrations` |
| SUP-26 | `registry lookup|paper reader|matched_by_setnayan` | `apps/web supabase/migrations` |
| SUP-27 | `bank account name|account_name_match|payout_account_name` | `apps/web supabase/migrations` |
| SUP-28 | `REVOKE .* ON .*vendor_services` | `supabase/migrations` |
| SUP-29 | `vouch|badge.*checks missing|approve_vendor_verification` | `apps/web supabase/migrations` |
| SUP-21 | `service_card_kind|card kind|kind_vocabulary` | `supabase/migrations` |
| SUP-34 | `forward.*old address|category_redirect|slug_redirect` | `apps/web supabase/migrations` |
| SUP-38 | `kind search|specialty_search_terms|search_term_retention` | `apps/web supabase/migrations` |
| SUP-40 | `copy.*service card|duplicateServiceCard|copyServiceCard` | `apps/web` |
| SUP-41 | `medal case|service_card_record|card record` | `apps/web/app/v apps/web/lib` |
| SUP-46 | `vendor_team_members` | `apps/web/app/vendor-dashboard/customers apps/web/app/vendor-dashboard/on-the-day` |
| SUP-51 | `slot opened|waitlist_notify|slot_opened` | `apps/web supabase/migrations` |
| SUP-55 | `removal reminder|removal_reminder|agree to a removal` | `apps/web supabase/migrations` |
| SUP-56 | `removal screen|who was asked|removal_requests` | `apps/web` |
| SUP-57 | `partner-shop request|re-quote|requote` | `apps/web/lib apps/web/app` |
| SUP-58 | `shop-side button` | `apps/web` |
| SUP-2 | `where they stand|whereTheyStand` | `apps/web/lib apps/web/app` |
| SUP-64 | `budget.*csv|exportBudget|budget_export` | `apps/web` |
| SUP-65 | `target.*category|category.*target` | `apps/web/lib/budget` |
| SUP-70 | `boost|top slot` | `apps/web/lib/ranking apps/web/lib` |
| SUP-71 | `first look|first_look_boost` | `apps/web/app/admin` |
| SUP-72 | `ranking weight|ranking_weights` | `apps/web supabase/migrations` |
| SUP-18 | `times booked|bookings_count|booked_count` | `apps/web/app/_components apps/web/lib` |
| SUP-76 | `fraud queue|report_vendor|vendor_abuse_reports` | `apps/web supabase/migrations` |
| SUP-84 | `scheduled.*downgrade|downgrade.*scheduled` | `apps/web/app/admin` |
| SUP-85 | `bookkeeper` | `apps/web supabase/migrations` |
| SUP-101 | `handover proof|payment calendar|guest-delivery record` | `apps/web supabase/migrations` |
| SUP-102 | `abuse report.*survive|abuse_reports` | `supabase/migrations` |
| SUP-103 | `booking-fee bill|booking_fee_charges.*cancel` | `supabase/migrations` |
| SUP-106 | `delete confirmation|suppliers keep` | `apps/web/app/dashboard` |
| SUP-107 | `booking-fee credit|booking_fee_credit` | `apps/web supabase/migrations` |
| SUP-113 | `schema-drift|schema_drift` | `apps/web/scripts supabase` |
| PAP-4 | `replay` | `apps/web/lib/live-wall.ts apps/web/app/[slug]/_components` |
| PAP-8 | `own work|not for photographing guests` | `apps/web/app/papic apps/web/lib` |
| PAP-12 | `co-host|cohost` | `apps/web/app/papic apps/web/lib` |
| DAY-4 | `filling meter|fillingMeter` | `apps/web` |
| DAY-12 | `venue screen|venueScreen` | `apps/web/app/panood` |
| DAY-15 | `demo controller` | `apps/web/app/panood` |
| DAY-16 | `broadcast screen` | `apps/web/app/panood` |
| DAY-33 | `RSVP version|show the RSVP` | `apps/web` |
| LAU-2 | `device hash|device_hash` | `apps/web supabase/migrations` |
| LAU-31 | `catch that cannot catch|empty catch` | `apps/web/scripts` |
| LAU-41 | `service worker|sw.js` | `apps/web/public apps/web/app` |
| LAU-44 | `features page` | `apps/web/app/features apps/web/lib` |
| DSK-5 | `auto-update|autoUpdate|updater` | `src-tauri apps/web` |
| DSK-7 | `Windows laptop|memory measurement|rss` | `scripts src-tauri` |
| DSK-15 | `in-app purchase|StoreKit|3.1.3` | `apps/web src-tauri` |

### Rows where something with that name EXISTS (open it before building or closing)

| row | searched for | first matches |
|---|---|---|
| SUP-15 | `crematorium|crematoria|memorial park` | `apps/web/lib/onboarding/specialty-catalog.ts apps/web/lib/shortlist-taxonomy-coverage.test.ts` |
| SUP-17 | `Live Band|Bridal Car|Massage Chair` | `apps/web/lib/a-bench-row-finds-what-is-stored.test.ts apps/web/lib/a-bench-save-is-for-the-card.test.ts` |
| SUP-8 | `Upcoming` | `apps/web/app/vendor-dashboard/_components/overview-sections.tsx apps/web/app/vendor-dashboard/bookings/surface.tsx` |
| SUP-49 | `wedding-words|weddingWords|wedding_words` | `apps/web/lib/the-setup-screen-speaks-every-event.test.ts` |
| SUP-50 | `lint-one-comment-stripper` | `apps/web/scripts/capture-demo-stills.mjs apps/web/scripts/lint-one-comment-stripper.mjs` |
| SUP-59 | `Found on Setnayan|found_on_setnayan|attributed` | `apps/web/app/[slug]/_components/editorial/data.ts apps/web/app/[slug]/_components/editorial/editorial-content.tsx` |
| SUP-16 | `New here|new_here_slot|freshChance` | `apps/web/app/(shell)/explore/page.tsx apps/web/app/_components/frontdoor/front-door.tsx` |
| SUP-83 | `yearly.*add-on|annual.*addon|addon.*annual` | `apps/web/VENDOR_TIERS_AND_BENEFITS.md` |
| SUP-88 | `plan price fallback|FALLBACK.*PRICE|fallbackPrice` | `apps/web/VENDOR_TIERS_AND_BENEFITS.md apps/web/app/admin/budget-planner/page.tsx` |
| SUP-91 | `editorial features` | `apps/web/app/(shell)/realstories/page.tsx apps/web/app/vendor-dashboard/performance/page.tsx` |
| SUP-97 | `setnayan ai.*intro|ai_intro_price|renewal pricing` | `apps/web/app/_components/home/HomeOverlays.tsx apps/web/app/dashboard/[eventId]/_components/event-dashboard.tsx` |
| PAP-5 | `linked celebration` | `apps/web/app/dashboard/(account)/clusters/[clusterId]/page.tsx apps/web/app/dashboard/(account)/clusters/page.tsx` |
| DAY-6 | `requests inbox` | `apps/web/app/vendor-dashboard/on-the-day/_components/requests-inbox.tsx apps/web/app/vendor-dashboard/on-the-day/actions.ts` |
| DAY-7 | `pronunciation` | `apps/web/lib/blog-batches/food-styling.ts` |
| DAY-9 | `day-of desks free|dayof_free|DAYOF_FREE` | `apps/web/lib/vendor-dayof-free-until.test.ts apps/web/lib/vendor-dayof-free-until.ts` |
| DAY-11 | `offline|one bar` | `apps/web/app/vendor-dashboard/on-the-day/_components/issues-log.tsx apps/web/app/vendor-dashboard/on-the-day/_components/live-reviews.tsx` |
| DAY-14 | `Add another day` | `apps/web/app/panood/control/[eventId]/_components/broadcast-window-strip.tsx apps/web/app/panood/control/[eventId]/page.tsx` |
| DAY-25 | `may shoot|shooting opens|uploads open` | `apps/web/app/[slug]/_components/story/spine-data.ts` |
| LAU-4 | `no personal identifiers` | `apps/web/app/(shell)/privacy/every-outbound-host-is-disclosed.test.ts` |
| LAU-18 | `admin search` | `apps/web/app/admin/_components/admin-search-is-visible.test.ts apps/web/app/admin/_components/admin-search-open-event.ts` |
| LAU-22 | `admin/menus|menu_items` | `apps/web/app/admin/_components/admin-nav-groups.test.ts apps/web/app/admin/_components/admin-nav-groups.tsx` |
| LAU-23 | `lint-colour-exists` | `apps/web/scripts/lint-colour-exists.mjs` |
| LAU-30 | `abuse-flag|abuse_flag` | `apps/web/CONNECTION_MATRIX.md apps/web/app/admin/_components/admin-sidebar.tsx` |
| LAU-33 | `live photo wall` | `apps/web/app/[slug]/_components/editorial/data.ts apps/web/app/[slug]/_components/editorial/editorial-content.tsx` |
| LAU-37 | `launch checklist` | `STATUS.md` |
| LAU-47 | `Paprint` | `apps/web/app/dashboard/[eventId]/studio/supplies-marketplace/page.tsx apps/web/app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx` |
| LAU-48 | `watched supplier|watchlist` | `apps/web/app/admin/app-performance/_components/action-center.tsx` |

**Totals: 48 found nothing · 27 found something.** Neither number is a count of
what is built — that is the point of the two rules above.

---

## 🚨 LAUNCH READINESS · LR-1 … LR-24 — added 2026-09-16

**Provenance, so these can be weighed rather than trusted.** Produced by a read-only sweep
(18 dimensions over a detached `origin/main` worktree at `1f067d01e`, plus direct SQL on
production): 97 candidates, 87 survived an adversarial refuter, 61 of those block launch or the
first event. Deduped against the 87 `NOT BUILT` rows above. **Nothing here was built or changed
by that sweep — it wrote no code and opened no PRs.**

⚠⚠ **STOP — READ THIS BEFORE BUILDING ANY LR ROW. THREE ROWS HAVE NOW BEEN CHECKED IN DEPTH AND
TWO DID NOT SURVIVE.** LR-8 (*"the Verified badge means nothing"*) and LR-21 (*"the error boundaries
log nothing"*) are both **RETRACTED**; LR-3 held. The failure is not carelessness and the refuter
did not catch it, because the refuter asks *"is this already built?"* and *"is it already on the
register?"* — **not** *"is the mechanism where I inferred it is?"*

⛔⛔ **AND THE ONE THAT LANDED ON THE ORCHESTRATOR: A DESK ITEM IS A CLAIM AND MUST BE MEASURED
LIKE ONE.** The owner was asked *"what should Live Studio's hosted channel cost?"* on the stated
premise that it was **"switched off right now and sells nothing."** Both SKUs were **live, active
and at exactly his figures, updated thirteen days earlier.** He confirmed a shipped price and was
thanked for a ruling.

🔑 **The premise came from a memory note that ALSO CARRIED THE SQL TO DISPROVE IT, and the query was
never run.** The rule broken — *an owner blocker is not open until you have checked whether it was
already closed* — was written the same day, and applied to other sessions' blockers but not to the
question going onto his own desk. ⇒ **Never describe the state of a paid thing without reading
`platform_retail_catalog_v2` in the same breath.** Asking for a decision that already exists costs
more than not asking: it spends the scarcest resource on the project and returns a confirmation
that reads like a mandate.

🏁 **THE DAY BLOCK, TRIAGED IN FULL — 35 of 40 settled 2026-09-17, NOTHING BUILT. The one-line
version, and it is the most useful sentence produced about this codebase all week:**

> **Of 40 items, one was dead, three were bigger than written, eight were already done, and nine
> are a mount or a case away from working. Almost nothing is a subsystem.**

ALREADY COMPLETE **8** · EXTEND **9** · OPEN **7** · DEAD **1** · UNDERSTATED **3** · REACHABLE
**2** · NOT-PURE **4** · OWNER **3** · **unranked 5, deliberately**.

🎯 **AND THE CLUSTER THAT EXPLAINS THE FAMILY: THE PLATFORM'S PATTERNS ARE APPLIED SERVICE BY
SERVICE, AND LIVE STUDIO IS THE SERVICE THEY STOPPED AT.**
· The **control-centre pattern** — owner-ruled 2026-08-28, *"a photo product opens on photographs"* —
  is converted for **two of three services** (the papic stage, the 3D plan). Live Studio is the
  third: when a couple already owns it, the page still renders the STORE layout whose primary
  action is **"Open controller"** — a shop window whose main button links to the thing you own
  (DAY-16).
· The **token-gated demo pattern** ships for the papic and 3D-plan services **and for Live Studio's
  camera join** (`panood/demo/[token]`) — but there is **no demo of the CONTROLLER**, which is the
  half a prospect browsing *before they have phones* would drive (DAY-15). Same axis, same service,
  one level finer.
⇒ So look for the next defect **by asking which service a proven pattern skipped**, not by reading
that service's own files — its files look complete, because for the parts it has, they are.
⚠ And do not reach for `DemoModeBanner` there: its layout states it is **admin-only**, reading a
demo cookie. Wrong audience for a public prospect; the token-gated routes are the pattern.

🗣 **AND THE INSTRUMENT THAT SETTLED TWO ROWS IN TWO DAYS: ONE WORD FROM THE OWNER, WHERE NO AMOUNT
OF MEASURING WOULD HAVE HELPED.** *"ceiling"* settled whether a per-guest Papic number reserves or
caps. *"the terms"* settled whether a camera row was about consent or about a time window. **In both
the code was correct under one reading and absent under the other**, so every method in this header
— execution, second routes, sibling comparison, RULE 0 — would have returned a confident verdict
about the wrong question. ⇒ **When the ambiguity is in what somebody MEANT, more grepping is the
wrong instrument.** Recognising that is itself a triage outcome, and it is why NOT-PURE and
"ask him" are first-class answers in this file.

⚠ **FIVE ROWS WERE DELIBERATELY LEFT UNRANKED, and that is a result.** Two are programme-level
(a ~40-unit design port; an interrupted conversion attack) — neither names a mechanism, neither has
a branch to execute, neither is answerable from the tree. One is ambiguous in a way that decides it
(DAY-25: the UGC terms gate DOES fire pre-shutter, so one reading closes the row and the other
opens a different mechanism entirely). One leans covered but is unproven (offline sync is mounted
in the ROOT layout, but *"one bar of signal"* is degraded network, not offline — a different failure
mode needing a test nobody here can run). One lost its location to a bad noun match.
🔑 **Five honest gaps beat five invented verdicts.**

🔍 **THE DEFECT CLASS BOTH OF OUR METHODS ARE BLIND TO — AND IT HAS TWO AXES.**
**When a capability is confirmed to ship, ask what it ships FOR: WHICH SURFACES, and WHICH CASES.**

· **MISSING MOUNT (the surface axis).** A shipped component rendered on one surface and absent from
  its sibling. `RequestsInbox` renders INLINE inside the song desk while the coordinator's
  floor-command surface offers only a `<Link>` that leaves the fullscreen console (DAY-6).
  `ScheduleUpdater` is mounted in `floor-command.tsx` and **absent from `stage-script.tsx`**, so the
  emcee cannot retime a schedule he has been lent (DAY-8).
· **MISSING CASE (the case axis).** A shipped mechanism with an ENUMERATED set of cases, and the
  row's case is not in the set. The samahan notification machine is complete — a service-role
  fan-out, pure decision rules split out so they can be exercised without a database, collapse keys
  and URLs agreeing by construction, an hour-long window reasoned from the group's own posting
  limit — and its enum is `{ story, message }`. **Joining is not one of them** (DAY-21).

🔑 **Neither method can see either axis.** A RULE 0 existence search finds the mechanism and answers
*"already ships"*. An execution pass finds no false branch, because nothing renders wrongly — the
surface does not render it at all, or the case never arises. **Only comparing sibling surfaces, and
reading the enum, finds these.**
⇒ **Three of the four found so far are a one-line addition to something that already works.** That
is the shape of most of this register's real content: not absent subsystems, but a shipped
mechanism missing a mount or a case.

⚠ **AND A WAY TO LOCATE A ROW WRONG THAT SURVIVES ORDINARY CARE: MATCHING A NOUN INTO THE WRONG
SUBSYSTEM.** DAY-7 (*"the emcee asks the couple his own questions"*) was filed against
`lib/answers-desk.ts` on the strength of the word *answers*. That module is the SUPPLIER's
"What's new" feed — unanswered reviews and lapsed booking asks. **Same failure as inferring a
mechanism from a name, but with a real file at the end of it to make it convincing** — and a real
file is far more persuasive than an absence. Location struck; DAY-7 is unverified again.

📋 **THE FIRST BLOCK TRIAGED IN FULL — 21 of 40 DAY items settled 2026-09-17, none of them built.**
· **WRONGNESS (8):** 1 DEAD · 1 REACHABLE-and-reuse · **3 UNDERSTATED** (6 footer roles · 4 green
  chips · a countdown 8 h LATE, sign inverted) · 1 REACHABLE · 2 NOT-PURE.
· **ALREADY COMPLETE (5):** DAY-1 · DAY-3 · DAY-4 · DAY-10 · DAY-27.
· **EXTEND, genuinely open (4):** DAY-17 · DAY-19 · DAY-28 · DAY-33.
· **OWNER (3, was 4):** DAY-28 · DAY-32b · DAY-32d. ⚠ **DAY-2 was removed from this list — the
  owner had ALREADY ANSWERED IT** (2026-09-16: own YouTube channel ₱2,500 one-time; **hosted
  channel ₱3,000/day**). 🔑 **AN OWNER BLOCKER IS NOT OPEN UNTIL YOU HAVE CHECKED WHETHER IT WAS
  ALREADY CLOSED** — and a ruling that lives only in one session's transcript is a cost paid by
  every other lane. Push rulings out; do not merely record them.
· **Still unverified: 19.** Every one has a located home; none is measured.

⚠⚠ **THE DISCLAIMER THAT BELONGS ON EVERY VERDICT IN THIS FILE, and was missing all week:**
**nothing in that triage was opened in a browser.** Every verdict is arithmetic, execution of pure
functions, or a read of a function body — never a screenshot. **ALREADY COMPLETE means the
mechanism ships and enforces what the row asked, NOT that somebody watched it work.** The
UNDERSTATED counts are exact; the completeness verdicts are strong but they are not observation.
Say which kind of evidence a row carries, every time.

⚖ **AND A CASE THAT NARROWS THIS FILE'S OWN "FAIL-CLOSED" RULE RATHER THAN OBEYING IT.**
`loadYourOwnDay` carries `if (!gallery) return []; // the read FAILED — show less, never more`, and
its docblock names the cost outright: *"here it would tell somebody who was at the wedding that they
were not."* Somebody saw the sentence-shaped harm and chose fail-closed anyway. The rule elsewhere
in this header — **fail-closed is right for a GATE and wrong for a SENTENCE** — does not settle
this: it is a gate whose output IS a sentence about a person's own memory. **A harder case than the
rule covers; narrow the rule, do not force the case.**

🚨 **AND THE CONSEQUENCE OF THAT SPLIT, MEASURED ON THE FIRST BLOCK TO GET IT: THE WORK-LIST IS
MOSTLY ALREADY BUILT.** Of the 33 DAY rows, **19 now have a located, shipped mechanism** and the
three verified properly were **fully complete, not extend-candidates**:

· **DAY-1** — *"enforced in the database, not just the button"* — is done **in the database**, which
  was the row's whole point. The advance RPC raises `42501` unless the caller is on the event,
  holds `SELECT … FOR UPDATE`, and **re-checks the precondition inside the UPDATE** so a lost race
  cannot double-advance; `event_schedule_blocks` carries six RLS policies across four migrations.
· **DAY-27** — shipped, guarded, mutation-checked by occurrence count.
· **DAY-10** — closed earlier the same way.

Sixteen more are located and unverified, every one with a shipped home: a whole day-of console with
a `song_desk`/`stage_script`/`floor_command` registry (DAY-5→9), Samahan and Usapan
(DAY-20→24), the channel pool, the event-type profile, the hub controller, the `?as=` preview, the
wall routes, the papic stage, the QR route with its own guard, the RSVP projection.

⇒ **SO THE DAY BLOCK IS NOT ~33 BUILDS.** It is a handful of genuine wrongness fixes — six found,
four of them UNDERSTATED — sitting on a platform where most of the named capability already exists
and **this register does not know it.** That matches the independent figure of **15 of 18** rows
checked elsewhere, and a build session's own count of nine rows where the work existed and only the
joins were missing.

🔑 **THE RISK THAT FOLLOWS IS NOT WASTED EFFORT. IT IS REBUILDING A RIVAL TO SOMETHING THAT SHIPS**
— DAY-32g's trap at register scale. **Confirm before building. Always, and especially when a row
sounds like new work.**

⚠ **TWO WAYS A GUARD IN THIS REPO HAS PASSED WITHOUT PROVING ANYTHING**, both found in its own
history and both having already defeated a previous generation of the same test:
· **an impossible fixture** — a predecessor guard was green only because its stub gave a delegate
  no `event_members` row, a state the accept-invite action cannot produce. **A green test over an
  impossible fixture is worth less than no test, because it stops the next person looking.**
· **"keep the call, discard its result"** — beat one guard twice: leave the call site intact so
  every source scan still finds it, and throw the return value away. **Exercise the decision; never
  grep for it.**

🧭 **AND THE STRUCTURAL FINDING THAT REORGANISES THIS WHOLE FILE: ROWS ASK THREE DIFFERENT
QUESTIONS, AND ONE METHOD CANNOT ANSWER ALL THREE.**

· **WRONGNESS rows** — *"this screen says/does something untrue."* Settle by EXECUTION: find the
  render, find the pure seam, run it across its input space. Verdicts: REACHABLE / DEAD /
  UNDERSTATED / NOT-PURE.
· **CAPABILITY rows** — *"we should be able to do X."* There is **no branch to prove dead.**
  Reachability on these produces a confident verdict about nothing. Settle by RULE 0 existence
  instead: does the subsystem already ship, and is this an EXTEND rather than a build?
· **OWNER rows** — the behaviour is exactly as described and whether it is a DEFECT is a product
  judgement. Neither method applies; the owner rules.

⇒ In the 33-row DAY block the split measured roughly **12 wrongness · 17 capability · the rest
owner**, and the capability rows are answering "already built, extend it" far more often than the
register assumes — a shipped day-of console with a specialization registry, a shipped Samahan and
Usapan, a shipped channel pool, a shipped event-type profile, a shipped hub controller.
**Classify a row before choosing how to check it.**

⚠ **AND A NEW WAY TO GET IT WRONG, which is the exact inverse of this header's other lessons:
BUILDING A WRITER FOR A DEAD COLUMN CREATES A SECOND SOURCE OF TRUTH.** `events.photo_wall_photos`
has **no writer anywhere** and defaults to `'[]'`, so the editorial page's live-wall block is
permanently false — but the capability ships two files away under another noun: the site body reads
`getWallSnapshot`, the real screened Papic feed. **The obvious fix — write the column — would
manufacture a second answer to "the day's candid photos".** Point the dead block at the working
feed, or delete it. Everywhere else in this file an absence hid a mechanism under a different name;
here an absence invites you to build a rival to one.

🔑🔑🔑 **FOURTH PATTERN, 2026-09-17, AND IT POINTS THE OTHER WAY: ROWS IN THIS FILE ARE
UNDERSTATED AT LEAST AS OFTEN AS THEY ARE WRONG.** A reachability triage of the DAY block found one
DEAD row and three that are real **and name one instance of a defect whose mechanism produces
several**:

· *"a Private site shows a success-green chip"* — it is **FOUR chips**. The rule is a denylist of
  three literal phrasings (grey only for `'Not set' | 'Off' | 'Hidden'`, green for everything else),
  so `Private`, `No schedule`, `0 photos` and `0 showing` all paint "nothing here" as success.
  **Any new empty-state wording is green by default** — which is how the other three arrived.
· *"the footer text is readable"* — it is **6 of 7 text roles**. Ground `#f2f2f0`, `--hr-grey`
  **3.14:1** and `--hr-grey-2` **2.21:1** against a 4.5:1 bar, with nothing in that footer large
  enough to earn the 3:1 exemption.
· *"the countdown ends 8 hours early"* — it ends **8 hours LATE**, and the sign decides the fix.

⇒ **FIXING THE ROW AS WRITTEN WOULD HAVE REPAIRED ONE CHIP OF FOUR AND ONE FOOTER LINE OF SIX — AND
EACH FIX WOULD HAVE LOOKED COMPLETE.** So triage now carries a fourth verdict, **UNDERSTATED**,
beside REACHABLE / DEAD / NOT-PURE. It is the category that decides how much of a block is really
one job: four chips are one fix, six footer roles are one fix. **Ask what MECHANISM produced the
instance the row names, then count the other instances it must also produce.**

⚠ **AND A TRAP THAT IS THE MIRROR OF EVERY OTHER ONE IN THIS HEADER: A CORRECT COMPONENT WITH A
WRONG INPUT READS AS A FALSE ROW.** The countdown widget is right — `target - Date.now()` is
honest instant arithmetic. The defect is entirely in what reaches it: `events.event_date` is a
`DATE` column, so it arrives as `"2027-02-14"`, and ECMAScript parses a date-only string as **UTC**
— 08:00 Manila, not local midnight. **A session that opens the widget looking for the bug finds
clean code and marks the row false.** Measure at the seam where the value ENTERS, not where it is
used.

✅ **AND ONE ENTRY THAT SAYS WHAT GOOD LOOKS LIKE, because everything else in this file is a
complaint.** The Panood controller reads `retail_price_php` from `platform_retail_catalog_v2` LIVE,
and on a catalogue miss it **degrades to a price-less sentence rather than inventing a number.**
That is the behaviour every money-touching row in this register should be measured against — a
standard already met somewhere in the tree, not a rule still waiting to be applied. When a row says
"never derive a price from code", this is the shape it is asking for.

⚖ **AND A LIMIT ON THE METHOD THAT IS CORRECTING THIS FILE, offered by the session using it:**
execution proves a branch unreachable **through the seam you chose**. Pick the seam too far
downstream and you can prove a dead branch dead while the live defect sits upstream of it. So
**"NOT PURE — no clean seam, look at the actual screen" is a first-class answer** and is worth more
than a verdict reached by stretching. A row declined honestly beats a row ranked confidently.

🔑🔑 **THIRD INSTANCE, 2026-09-17 — AND IT COMPLETES THE PATTERN: A ROW'S *CONSEQUENCE* NEEDS ITS
OWN MEASUREMENT, EVEN WHEN ITS *FACT* CHECKS OUT.** DAY-14's sentence really is in the file — and
the branch that renders it is unreachable, proven by executing both deciders across all 12
combinations. The two earlier retractions had accurate facts too (zero rows in a table; a missing
config file) and false consequences. **The fact checking out is the moment the risk begins, not the
moment it ends** — that is when a reader stops looking. Ask separately: *can anyone actually reach
this?*

🔑 **BOTH RETRACTIONS HAVE THE SAME SHAPE: a code read found no mechanism at the name it expected,
and the mechanism was living somewhere else.** The Verified badge is backed by
`vendor_verification_bypasses`, not `vendor_verifications`. The browser error handler is in
`app/_components/deferred-observability.tsx`, not `sentry.client.config.ts`. In both cases the
count or the absence was accurate and the conclusion was wrong.

⇒ **TREAT EVERY UNVERIFIED LR ROW AS A CANDIDATE, NOT A FINDING.** Before building one, find the
mechanism by a second route — the live database, the served bundle, `vercel env ls`, the admin
screen — and only then decide whether the row is real. An absence in the file you expected is the
beginning of the measurement, not the end of it.

✅ **SEVEN INDEPENDENTLY RE-MEASURED by the orchestrator against production before being written
here** — LR-1, LR-2, LR-3, LR-8, LR-12, LR-17, LR-24. A peer's measurement is a hypothesis like
any other; these seven were re-run, not relayed.

⚠ **THREE CORRECTIONS WERE APPLIED BEFORE THESE ROWS WERE ACCEPTED**, and each is a trap the next
reader would otherwise fall into:
1. **"Nothing is on a schedule" is NOT a finding.** This repo has no scheduler *by design* — all
   22 periodic jobs ride request traffic through `after()` and `claim_periodic_job`
   (`lib/periodic-job-registry.ts` says so in its first paragraph). The real defect is narrower
   and worse: **`oauth-refresh` is not in that registry at all**, so it has no caller of any kind.
2. **The four retention sweeps are NOT failing.** They are weekly (6-day gap) and last claimed
   09-11/09-14 — inside their window. They were nearly reported as broken because they sit next
   to jobs that are.
3. **A NULL `started_at`/`finished_at` in `cron_job_runs` does not mean "started and never
   finished".** Those outcome columns only shipped 2026-09-15; eleven rows simply have not claimed
   a window since. The old writer stamped `last_run_at` **at the claim, before the body ran,
   inside a catch that swallowed failures** — a fresh timestamp there means *somebody was about to
   try*.

| ID | source | the claim | status · evidence | ⚖ | size | how to RE-MEASURE |
|---|---|---|---|---|---|---|
| LR-24 | Supabase API | The organisation is on the **FREE plan — no automated backups, no point-in-time recovery** | 🔴 OPEN 2026-09-16 · **RE-MEASURED: `plan: "free"`.** 87 days from two irreplaceable weddings. This is the 2026-08-10 _"let's stay free for the moment"_ call whose own note said **revisit before launch**. Pro ≈ ₱1,450/mo | ⚖ **OWNER ONLY — NOW DUE** | owner-only | `get_organization(henfjjgsilacblzsmrqu)` → `plan` |
| LR-25 | owner screenshot | The **quick-add sheet** asked a Simple Event which SIDE a guest was on, pre-set to **"Bride"** | ✅ **FIXED 2026-09-17 (#5565).** This was the PRIMARY door — the empty state's "+ Add your first guest" opens this sheet, while #5560 had fixed `/guests/new`, the SECONDARY one reached via "or use the full form". 🔑 **#5560 was briefed at a FILENAME, not a property, so it closed 1 of 4 doors.** #5565 closed two more and recorded the fourth (`chip-editors.tsx`, a client island with no role set) as a shrinking backlog. Its guard is a SWEEP over every side-rendering surface. Verified live both ways: hidden on a simple event, shown on a wedding | no | shipped | `git grep -n "eventHasSides" apps/web/app/dashboard` → must appear in all three gated surfaces |
| LR-26 | owner observation | **"Add from your people" is visible only when the guest list is EMPTY** — once populated it hides behind the `⋯` overflow | 🔴 OPEN 2026-09-17 · Visibility is inverted against usefulness: at 0 guests "your people" is emptiest and least useful; at 92 it would save the most typing. The code comment explains the menu ORDERING soundly but produces the backwards outcome. Found by the owner noticing its absence, not by any sweep — it blocks nothing | ⚖ needs a design call on the populated roster's primary add affordances | `Opus 5 · medium` | `git grep -n "OpenAddFromPeopleButton" apps/web` → 3 mounts; only the empty-state one is a visible button |
| LR-27 | retraction | ~~"The Papic capture-window control posts 200 and persists nothing"~~ | ⚪ **WITHDRAWN 2026-09-17 — NOT A DEFECT.** A 4-step onboarding `<dialog>` was open as a `fixed inset-0 z-50` backdrop swallowing every click. Dismissed it and the control saved first time (`?papic_window_saved=3`). ⚠ `read_page` shows such a backdrop only as an unremarkable `dialog [ref_N]` | no | — | before blaming a control: `document.elementFromPoint(cx,cy)`, then `read_network_requests` for whether a POST even fired |
| LR-28 | retraction | ~~"A wedding created through onboarding loses its date"~~ | ⚪ **WITHDRAWN 2026-09-17 — NOT A DEFECT, and instructive.** `events.event_date` was NULL, but the date was in **`events.date_candidates`**, ONE COLUMN AWAY on the same table. The wizard offers up to 4 candidate dates and sets `event_date` only when one is **LOCKED** (`/details` → Wedding date → Change). ✅ **The cheap habit that catches this class:** before calling a NULL a bug, list the neighbouring columns — `select column_name from information_schema.columns where table_name='X' and column_name ilike '%<concept>%';` | no | — | `select event_date, date_candidates from events where public_id='…';` |
| LR-8 | sweep + prod | ~~The Verified badge means nothing~~ — **RETRACTED. Both badges ARE backed, by the owner's own ruled vouch path.** What survives is only the public "(FIXTURE)" NAME | ⚪ **RETRACTED 2026-09-16, same day it was written.** `vendor_verification_bypasses` = **2**, matching the 2 badges exactly — each with a stated reason, an `admin_audit_log` row and a deadline of 2027-03-12 in `next_renewal_due_at`. ⇒ **`vendor_verifications` = 0 IS THE EXPECTED READING, NOT THE DEFECT.** Nobody has ever completed paper verification — four documents, a two-channel token and a 15-minute Meet — and **that is precisely why the owner authorised vouching on 2026-09-07**, ruling it carries the SAME badge with no cap. 🔑 **THE ROW COUNTED ONE TABLE AND CONCLUDED ABOUT A MECHANISM THAT LIVES IN ANOTHER.** A zero in `vendor_verifications` is not evidence about the badge, because the badge has two legitimate sources. ⚠ **AND IT NEARLY BECAME CODE:** the invariant first proposed here — *verified requires an approved `vendor_verifications` row* — would have **forbidden the owner's own ruling from nine days earlier**, with every existing guard still green. ⇒ **WHAT IS ACTUALLY LEFT:** `Saysay Live Band & Hosting (FIXTURE)` is publicly listed under a name containing the word FIXTURE. That is a naming fix, worth minutes, and nothing more. | ⚖ owner: rename or hide the one shop | minutes | **The honest invariant, if one is ever wanted:** every `verification_state = 'verified'` shop must have an approved `vendor_verifications` row **OR** a live `vendor_verification_bypasses` row — `select count(*) from vendor_profiles where verification_state='verified'` must never exceed the union of the two. Today: 2 and 2. |
| LR-12 | sweep + prod | Signup is an open account factory — anonymous sign-in on, no bot check live | 🔴 OPEN 2026-09-16 · **RE-MEASURED: 5 of 13 production accounts are already anonymous.** Each signup also sends mail from our domain, risking the sending reputation that has to carry the December invitations | ⚖ owner-config ~15 min (Turnstile already written up in OWNER_ACTIONS.md) | hours · owner + wiring | `select count(*) filter (where is_anonymous), count(*) from auth.users;` |
| LR-13 | sweep | A guest's photo withdrawal leaves the FILE publicly fetchable, unsigned, forever | 🟠 **NARROWED — the file half is TRUE, the ruling half was MINE AND IT WAS BACKWARDS.** ✅ `takePhotoOffTheWall` makes **no storage call at all** — it stamps `wall_hidden_at` + `wall_hidden_by_guest_id` and mirrors the flag; a fetch of a withdrawn photo returned **HTTP 200**. The moderator path is the same shape. ⛔ **BUT IT DOES NOT CONTRADICT THE 2026-09-16 RULING, and I said twice that it did.** #5537's own body scopes the word: _"'Final' means final against OTHERS, never against her"_ — she may put it back herself with `putMyPhotoBackOnTheWall`. **A control the guest can reverse with one press could never have implied the bytes were destroyed.** 🔑 The two are about different things: the ruling is about who may reverse a withdrawal; this row is about whether the object is deleted. Real, and its own question. | ⚖ owner: does a withdrawal DELETE, given she can undo it? | a-session · **Opus** | fetch a withdrawn capture's public URL and read the status; `grep -n 'executeCleanupDelete\|deletePublicAsset' apps/web/lib/guest-wall-unpost.ts` |
| LR-5 | sweep | Supabase Auth is capped at 2 emails/hour platform-wide | 🟠 **NARROWED — the cap is real, the PREMISE was never read, and the harm was overstated (including by me, on the owner's desk).** ✅ The cap is confirmed **from Supabase's own live docs**, not the repo: all email-sending Auth endpoints, scope **Project**, **2 per hour on the built-in provider**, configurable only with custom SMTP or the Send Email hook. ⚠ **"Auth has no custom SMTP" IS ASSERTED BY NOBODY WHO CHECKED IT** — there is no route from a session: no auth-config MCP tool, no management token, and `supabase config` only writes. It is the row's load-bearing premise and it is **unverified**. ⛔ **"A locked-out person stays locked out" is FALSE** — the page says what happened. ⇒ **One dashboard glance settles it; do not build until someone has looked.** | ⚖ owner: read the SMTP switch | minutes to check | Supabase Dashboard → Project Settings → Auth → SMTP |
| LR-9 | sweep | ~~The front page promises "No commission on your bookings, ever" while a 5% fee ships~~ | ⚪ **RETRACTED — WRONG PAGE AND ALREADY RULED.** The served `/vendors` contains **ZERO occurrences of "No commission"**. It discloses the fee in full: _"0% commission while we launch — after that, 5%, then 1% beyond ₱100,000, only on couples Setnayan brings you; your own and repeat clients stay free"_ — in the body copy, the tier matrix and both social descriptions. ⚖ **And the owner ruled it on 2026-08-06:** the 5%/1% is a **syncing/booking fee, explicitly NOT a commission**; the public "0% commission" line is _"CORRECT and STAYS"_, and the instruction is to **never call it commission anywhere**. The row proposed changing copy the owner had already settled. | no | — | fetch `/vendors` and grep it; then `grep -n 'commission' DECISION_LOG.md` |
| LR-1 | prod SQL | Every supplier at both December weddings is hand-typed — **not one has a Setnayan account** | 🔴 OPEN 2026-09-16 · **RE-MEASURED: 0 of 46 rows carry `linked_vendor_profile_id`**, including 9 `contracted` and 3 `deposit_paid`. The supplier half of day-of has no participants | ⚖ owner — recruitment, longest fuse | multi-session · owner-led | `select count(*) filter (where linked_vendor_profile_id is not null), count(*) from event_vendors ev join events e on e.event_id=ev.event_id where e.event_date >= '2026-12-01';` |
| LR-2 | prod SQL | **No invitation has ever been sent, to anyone** | 🔴 OPEN 2026-09-16 · **RE-MEASURED: 0 of 133 guests have `invitation_sent_at`**; 92 are on the 18 Dec wedding. The send path has zero end-to-end proof | no | a-session | `select count(*) filter (where invitation_sent_at is not null), count(*) from guests;` |
| LR-3 | sweep + prod | `oauth-refresh` is **not in the periodic-job registry at all**, so three expired YouTube grants still report `ok` | 🔴 OPEN 2026-09-16 · **RE-MEASURED: 3 grants, all 3 `connection_health = 'ok'`** — a value nothing has ever re-tested. All past the 7-day Testing window (granted 08-31/09-02); the 2026-09-07 deadline passed | ⚖ owner must publish the OAuth app | a-session | `grep -n "oauth-refresh" apps/web/lib/periodic-job-registry.ts` → **expect NO match**, then `select external_account_display, granted_at, last_refreshed_at, connection_health from live_studio_channel_grants;` |
| LR-4 | sweep | ~~`samahan-story-sweep` is twelve days past a one-hour gap, so the claim path is broken~~ | ⚪ **RETRACTED.** The premise is accurate — the gap is 3,600,000 ms and the last claim is ~12.9 days old — and the conclusion is an **inferred cause**, the exact shape the base rate warns about. **The sweep is correctly IDLE:** its only trigger is one community page, and production holds exactly one community, one member and **zero stories ever posted**. The job also holds a claim row, so the compare-and-swap works for this key. | no | — | `select count(*) from samahans; select count(*) from samahan_stories;` before concluding anything about this job |
| LR-6 | sweep | **A password reset only completes in the browser that asked for it — and dumps a Supabase SDK paragraph on the sign-in card** | 🔴 **CONFIRMED ON PRODUCTION, and survived 3 of 3 refuters.** Reproduced unauthenticated against the live site: the callback 307s to `/login?error=` carrying the raw SDK text, ending _"use @supabase/ssr on both the server and client to store the code verifier in cookies"_ — **and the repo's own error sanitiser passes it through**, because it is well-formed English prose. PKCE is not a choice made here: `@supabase/ssr` hard-sets it and the app never overrides. Prod `auth.flow_state` shows email links are 8/8 PKCE. **The fix does not exist** — no `app/auth/confirm`, no `token_hash`, no `verifyOtp` caller anywhere. 🔑 Half the pattern already ships: `generateLink` + Resend in `lib/event-account-link.ts`; extend it, do not invent a shape. ⚠ The verifier could NOT size how often a person has hit this and said so rather than guess. | no | a-session · **Opus** | `curl -s -o /dev/null -D - "https://www.setnayan.com/auth/callback?code=probe&next=%2Freset-password" \| grep -i '^location'` — broken while it contains "PKCE code verifier not found" |
> 🚨 **LR-7(a)'s RETRACTION IS ITSELF RETRACTED — 2026-09-18. "Nothing proves a signup email is
> real" is TRUE, and the retraction below rested on a bad inference I made.**
>
> The retraction argued: *"email confirmation is on and working — all 8 non-anonymous users have
> `email_confirmed_at`."* **The column is true and means nothing.** `app/signup/actions.ts:329`
> runs `admin.auth.admin.updateUserById(userId, { email_confirm: true })` on every signup (and
> again at :135), deliberately — the docblock cites tight free-tier mail limits. Measured:
>
>     secs between created_at and email_confirmed_at | users
>     0.0                                            |   5
>     0.2                                            |   2
>     150.3                                          |   1
>
> **Seven of eight confirmed in under a quarter of a second.** No human opens an inbox that fast.
> 🔑 **`email_confirmed_at` records that a PROGRAM set it, not that anybody proved they own the
> address.** Same shape as the `vendor_verification_bypasses` miss: the count was right and the
> mechanism was somewhere else. The sweep corroborates independently — it lists *"retire the forced
> email-confirm bypass"* as pending, which only parses if the bypass is live.
>
> ⚠ **AND THE ROW'S DOWNSTREAM REASONING INVERTS TOO.** It argued the typo case is harmless because
> *"confirmation is required, so a typo'd account is never usable in the first place — the person
> simply signs up again."* With auto-confirm, **a typo'd account IS immediately usable**: the person
> signs in, uses it, and can never receive a reset, a receipt or any notice — and cannot change the
> address, because no `updateUserById` call anywhere passes `{ email }`. The harm is therefore
> **larger** than the "address changes later" case the row settles on, not smaller.
>
> ⇒ **Re-open LR-7(a). And check any other row that reads a column as proof of a human act.**

| LR-7 | sweep | ~~Nothing proves a signup email is real~~ **— WRONG.** The typo half survives but is **much smaller than written** | 🟢 **SECOND-ROUTED TWICE 2026-09-17, and it narrowed both times.** **(a) RETRACTED:** email confirmation is on and working — `auth.users` holds 8 non-anonymous rows and **all 8 have `email_confirmed_at`**. **(b) The no-change-path claim SURVIVES a proper second route, not just a grep.** The admin console does a great deal with emails — `confirmUserEmail`, `unblacklistEmail`, a `blacklisted_emails` table, and two `auth.admin.updateUserById` calls in `app/admin/users/actions.ts` — but the two calls set `{ password }` and `{ email_confirm: true }`. **Neither passes `{ email }`.** Nobody, user or admin, can change an address. ⚠ **(c) BUT THE HARM IS NOT WHAT THE ROW SAYS, and this is the part that matters.** The row implies a typo leaves somebody locked out. It cannot: **confirmation is required, so a typo'd account is never usable in the first place** — the person simply signs up again with the right address, leaving an orphan row. 🔑 **THE REAL HARM IS THE ORDINARY ONE: a person whose address CHANGES** — new job, lost access — can never move their account, and neither can an admin. That is a genuine gap and a small build; it is not a launch blocker. 🔑 **AND THE METHOD IS THE POINT: this row was confirmed by me, then narrowed by second-routing my OWN confirmation.** A confirmation is the dangerous output — it becomes a build — so it earns the same hostility as the original claim. | no | small | `git grep -n 'updateUserById' -- apps/web` then read what each call PASSES, not that it exists |
| LR-10 | sweep | Every couple's first message to every supplier says **"planning our wedding"** — including for a wake | 🔴 OPEN 2026-09-16 · one hard-coded opening across 17 celebration types | no | a-session | grep the opening line's symbol, then assert per `EventTypeProfile` — **never a banned-noun list** |
| LR-11 | sweep | Onboarding opens supplier conversations in the couple's name **without showing the consent screen, and ignores the answer given** | 🔴 OPEN 2026-09-16 | no | a-session | in `onboarding-shell.tsx`, assert the gate READS the stored answer — pin the CONDITION, not the mount |
| LR-14 | sweep | **Replacing a guest's QR kills the printed code but leaves an already-open browser with full access — and hands it the NEW code** | 🔴 **CONFIRMED, survived 3 of 3 refuters.** Worse than the row: the stale session is not merely tolerated, it is *re-issued* the replacement. | no | hours · **Opus** | `grep -n guestSessionTokenCheckEnabled apps/web/lib/guest-session.ts` — the fix is to DELETE the flag, not to remember it |
| LR-15 | sweep | `receipts.issued_to_tin` has no writer and the receipt never itemises | ⚪ **CONFIRMED THEN KILLED — 2 of 3 refuters.** Both halves check out literally, but **the itemisation already exists one page earlier**, so the row's own remedy is largely built, and `/features` publicly promises the itemised document. The remaining true residue is the TIN slot nobody can fill. **Not a launch blocker; re-file narrowly if anyone wants it.** | ⚖ owner: BIR registration (separate, already logged) | — | `grep -rn issued_to_tin apps/web --include=*.ts \| grep -v test` |
> 🔬 **LR-16 MEASURED 2026-09-18 — the row's "5 of 7 screens" is wrong in BOTH the count and the
> shape, and the fix is two files, not seven.** Enumerated independently (swept for the account
> details themselves — `gcash_number|bdo_account_number|gcash_qr|bdo_qr` — because a payment
> instruction is a thing you can pay *into*, rather than deriving the list from who already reads
> the switch). **99 files mention the rails · 18 touch account details · 10 are payment surfaces ·
> 3 honour the switch · 7 ignore it.**
>
> 🔑 **THE COUNT IS NOT THE FINDING. `components/billing/ManualCheckoutModal.tsx:69` declares its
> OWN `export type PaymentChannel = 'gcash' | 'bdo'` and builds a hardcoded two-entry channel list
> off `response.instructions`** — a **second, competing source of truth** for which rails are open,
> when `lib/payment-channels.ts:19` already answers it (`PayChannel`, `PAY_CHANNELS`,
> `openChannels(settings)`). Two of the seven surfaces are not independent screens at all; they are
> this one shared modal. Same disease as the `papic_guest_spend_ceilings` near-miss in CLAUDE.md
> rule 8: two mechanisms that disagree about one fact, each passing its own suite.
>
> ⇒ **THE CHOKE POINT IS `apps/web/app/api/v1/billing/initialize-maya/route.ts`** — it is the only
> other file that builds `instructions` with `gcashQrUrl`/`bdoQrUrl`, and it is **switch-blind: 0
> references to `gcash_enabled`, `bdo_enabled` or `openChannels`.** So is the modal. **Route the
> API through `openChannels` and delete the modal's duplicate list, and most of the seven fall out
> for free.**
>
> ⚖ **SCOPE (owner, 2026-09-18 — "wedding and simple event at minimum"):** in scope are
> `app/papic/order/[token]/page.tsx` and the `choose-plan-sheet` → `ManualCheckoutModal` path, plus
> the shared modal and the API route. **The five `vendor-dashboard` surfaces are supplier-facing
> and wait with the rest of SUP-\*.**

| LR-16 | sweep | Switching a payment rail off **does not stop 5 of 7 payment screens taking money on it** | 🟠 **PARTIALLY SECOND-ROUTED 2026-09-17 — not yet confirmed, not yet refuted.** A shared resolver DOES exist (`lib/payment-channels.ts`, with its own test) and **two payment surfaces read it**: `app/pay/[reference]/page.tsx` and `dashboard/[eventId]/_components/inline-checkout-drawer.tsx`, plus the admin settings pages that write the switches. So the mechanism is real and partly wired — which is exactly the state that produced LR-8 and LR-21. ⚠ **The row's claim is about the OTHER surfaces, and nobody has enumerated the seven.** Do that first: list every screen that renders a payment instruction, then check each against `payment-channels.ts`. Do not build from the count in this row | no | a-session | `git grep -ln 'gcash_enabled\|bdo_enabled' -- apps/web` for the readers, then enumerate payment surfaces independently and diff the two lists |
| LR-17 | sweep | No receipt can be cancelled or re-issued; refunds are all-or-nothing and a refunded customer's receipt **still says "Total amount paid"** | 🔴 OPEN 2026-09-16 · **RE-MEASURED: `order_refunds` = 0 rows**, so the path is entirely untested | no | a-session | `select count(*) from order_refunds;` + grep for a re-issue action on `/admin/receipts` |
| LR-18 | sweep | **Guest pages collect a mobile number, allergies and a FACE with no privacy link and no controller named** | 🔴 **CONFIRMED on the live site, survived 2 of 3 refuters.** The policy itself is current and the DPO reachable — the gap is linkage, on the surfaces where sensitive personal information is actually collected. | ⚖ DPO sign-off on the wording | a-session (one shared component) · **Opus** | open each guest-facing collection surface on the live site and look for the controller line |
| LR-19 | sweep | **Nothing records that anyone ever accepted Terms or Privacy — and Privacy changed 2026-09-15** | 🔴 **CONFIRMED 2026-09-17 by a second route, and SHARPER than written.** The original search looked for a table *named* `%consent%`, which is the failure mode that retracted LR-8 and LR-21 — so it was redone across **every column in the schema** matching `consent|accept|terms|privacy|agreed`. Result: ~90 consent columns exist (face enrolment, marketing, civil status, UGC terms for guests, render sharing…) and **not one records platform Terms or Privacy acceptance.** No writer anywhere in `apps/web`. ⇒ **BECAUSE THERE IS NOTHING TO RECORD: `/signup` IS BROWSEWRAP.** The page carries a static sentence under the button — _"By signing up, you agree to our Terms and Privacy"_ — with **no checkbox**. Nothing affirmative happens, so nothing can be stamped. 🔑 **AND THE REPO ALREADY HOLDS THE OPPOSITE PRINCIPLE, APP-WIDE.** `app/signup/consent-is-affirmative.test.ts` enforces an owner ruling (2026-07-12) that consent boxes *"start UNTICKED — affirmative consent, not pre-selected"*, and it is deliberately app-wide because one door had missed it. **So the product asks affirmatively before publishing a couple's wedding photograph, and does not ask at all before binding them to the Terms and the Privacy Policy.** ⚠ Privacy changed on 2026-09-15 and there is no version stamp, so nobody can say which text any user is held to. | ⚖ **OWNER/DPO: browsewrap or clickwrap?** The record cannot be built until that is answered — stamping an acceptance that never happened is worse than none | a-session once ruled | `select table_name, column_name from information_schema.columns where table_schema='public' and column_name ~* 'terms\|privacy\|accept'` — then read `/signup` for a checkbox |
| LR-20 | sweep | **Nine subprocessors hold our users' data with no signed DPA** — our own code says so | 🔴 OPEN 2026-09-16 | ⚖ owner: nine signatures | owner-only | read `apps/web/lib/subprocessors.ts` — the list is generated from it |
| LR-21 | sweep | ~~Five of six error boundaries say "We've logged the issue" and log nothing~~ — **RETRACTED. Sentry is live in production and the boundaries do reach it.** | ⚪ **RETRACTED 2026-09-17.** The served page carries `sentry-environment=vercel-production`, `sentry-release=09741c4ac944e3` and a `sentry-public_key`; `vercel env ls production` shows `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` all set. ⇒ **WHY A CODE READ MISSED IT:** `instrumentation.ts` registers Sentry for `nodejs` and `edge` ONLY, and there is no `sentry.client.config.ts` — so by the file names alone the browser SDK looks absent. **It is initialised in a COMPONENT instead** — `app/_components/deferred-observability.tsx`, deliberately deferred until after hydration for performance, with an RA 10173 PII scrubber attached. 🔑 **THE MECHANISM WAS REAL AND LIVING SOMEWHERE THE FILE NAMES DID NOT PREDICT.** Same shape as LR-8, where the badge's backing lived in `vendor_verification_bypasses` rather than `vendor_verifications`. ⇒ **WHAT SURVIVES IS A COMMENT NIT, NOT A DEFECT:** five boundaries say the capture happens via `instrumentation.ts`, which is untrue for the browser — the handler is the deferred component. Worth one line each so the next reader does not repeat this measurement. | no | minutes | `curl -s https://www.setnayan.com/ \| grep -o 'sentry-public_key'` → expect a match; `vercel env ls production \| grep -i sentry` |
| LR-22 | sweep | **Nothing records whether any email was delivered**, and six notification call sites are silently dropped to a tray badge by the allowlist | 🔴 OPEN 2026-09-16 · **two have already fired against real paying suppliers.** The allowlist half is four strings in a Set | no | hours (allowlist) + a-session (send log) | `grep -n "EMAIL_ENABLED_TYPES" -A 30 apps/web/lib/notification-emit.ts` |
| LR-23 | GH Actions | `deploy-prod` is fail-closed with no retry | ⚪ **CONFIRMED THEN KILLED — 2 of 3 refuters.** Every clause is literally true — a Supabase maintenance window stopped production deploys for **7h47m** and only a later merge restarted them — **but the drift monitor DID fire, loudly, at 00:24Z.** So the gap is not detection, which the row implies; it is that nobody was reading. That is a notification-routing question, not a retry-logic build. **Re-file against the notification path if it is wanted.** | no | — | `gh run list --workflow=deploy-prod.yml --limit 10 --json conclusion,createdAt` |

### Flagged, not numbered
`lock-request-expiry` is ~34h past a daily gap and ties to **SUP-11** · `lead_hold_sweep_last_run_at` = 2026-07-23 (55 days, a separate mechanism) · Supabase leaked-password protection is off (one click).

### ✅ CHECKED AND NOT GAPS — recorded so nobody spends a day re-finding them
Internal routes (`/dev`, `/prototype`, `/demo-capture`) correctly 404 in production · the
couple→Setnayan payment path works end to end and has carried **4 real payments** · the migration
ledger and the repo agree exactly, **zero orphans** · the 15 "stranded" Drive photos belong to two
events where Drive was never connected, so that screen is **honest** — the owner's own wedding has
5 landed and 0 stranded.

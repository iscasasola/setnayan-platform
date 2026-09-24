# WAVE PLAN — rewritten 2026-09-22 09:20 UTC, against `origin/main` **e43cbdb82**

> ⚠ Re-run `build-sessions/merge-control.sh` before acting on any row. The previous version of
> this file was planned from the register and was wrong in both directions; the one before that
> had paths missing the `apps/web/` prefix, which manufactures false "not built" verdicts.
>
> 🔑 **Every row budgets the RULE 0 re-measure as the main work, not a preamble.** The last
> re-measure turned ~24 slices into ~15, and today two more "builds" turned out to be *"the
> thing already works, the picture of it doesn't."*

---

## MERGE LEDGER — what the owner is paying for

| PR | what is inside | armed | state |
|---|---|---|---|
| **#5892** `rd/wave-2` | **five builds**: chat frame · Event Hub theme · Overview counts · closing copy · one guest card (#5885) | **HELD** by the `do-not-auto-merge` label until the fold is finished | CI running |
| **#5885** one guest card | retargeted onto `rd/wave-2`; already folded by hand at `cc7b69004` | HELD | folded |
| **#5877** `pf/platform-floor` | seven platform bundles | yes | CI running |
| **#5875** Papic | the spine, a per-guest minimum, a recommendation that knows the celebration | yes, **by owner instruction** | one red, cause found |
| **#5873** free-fee window | another group's build | yes | CI running |

**Twelve builds · four merges.** Wave 2 alone is five for one.

🛑 **Only the trunk may be armed, and the LABEL is the only reliable hold** — the
`enable-automerge` workflow re-arms a PR on every push, so `gh pr merge --disable-auto` gets
undone. The danger is not the merge to `main`; it is a contributor PR auto-merging **into the
trunk** and skipping the generated-file regeneration.

---

## IN FLIGHT, NOT YET IN A WAVE

| build | session | state |
|---|---|---|
| **Your Team slice 3 — the money split** | Event Your Team | 🟢 launched. `lib/your-team.ts:173` coerces a null cost to ₱0 with `(c ?? 0)` — it lies rather than refusing |
| **Sai copy + the progress bar** | Event Overview | 🟢 launched, `rd/sai-cta-and-the-progress-bar`. Three things: the ₱499/₱799 copy derives from the catalog, the duplicate percentage, the 0% ring |
| **quote maker B/C/D** | Service card & quote maker | ⛔ **correctly held.** Conflicts with the chat frame on `proposal-maker.tsx`, and rewrites `messages/[threadId]/page.tsx` +120/−24. Unblocks when #5892 lands |
| **#5874 Overview status** | Event Overview | draft, owner must look. **Conflicts with the counts build inside #5892** on `event-dashboard.tsx` — rebase after the wave |

## NEXT, UNSTARTED

- **Your Team slice 1** — badge counters from `unreadThreadIds`, rolled up with `includedWith == null` so one supplier on several cards counts once.
- **Your Team slice 4** — remove the two task surfaces. ⚠ **Blocked behind the Overview counts**, which is inside #5892; landing it first leaves a couple with one number and nothing saying which set it counts.
- **Quote maker E and F** — after #5892.
- **ONE DOOR build 1** — the small `/signup` card. Blocked until the contested sign-up file settles.
- **The "You" card · the card picker · the brief in the composer** — all three EXIST. They need extending, not building: the picker is a single `<select>` that *replaces* the lines and needs accumulation; the brief lives in `ChatInfoRail` beside the composer and needs moving in.

## THE TWO MIGRATIONS — deliberately apart

⛔ **"TWO MIGRATIONS MUST NOT SHARE A WAVE" WAS INVENTED HERE AND IS FALSE.** It appears in no
repo rule, and today's own history contradicts it: **#5875 landed with 3 migrations and #5877 with
3.** The controller split three finished builds into three separate merges on the strength of it
— the exact opposite of this group's whole purpose — and the owner caught it by asking *"i thought
we do one merge for multiple builds?"*

✅ **The real constraint is narrower: `pnpm migration:new` allocates FORWARD, and a migration that
depends on another must sort after it.** That is about ordering *within* a tree, not about how many
may ride in one merge.

🔑 **A rule a controller writes into its own plan file reads, a week later, exactly like a rule the
repo imposes.** Cite where a constraint comes from, or it becomes one by repetition.

- **ONE DOOR build 2** — consent per event. Measured: it is `users.public_summary_consent_at` with **no `events.` sibling** and **eight readers** — a repoint, not a new column.
- **Papic P4** — per-face blur. ⚖ Worth asking whether it ships at all: 146 guests, 0 have used it.

## GAPS NAMED, DELIBERATELY NOT FIXED

- **The two bench strips cannot tell a refused read from an empty one** — `vendors/page.tsx` hands both an empty array. Needs an upstream error signal.
- **A withdrawn-but-`pending` thread still renders "Waiting for {vendor} to accept."** Behaviour, not copy; the closing-copy fix correctly did not touch that branch.
- **`pnpm test:unit` has no `--test-concurrency` cap.** It took this machine to load 139 on 10 cores. A build item, not a discipline problem — every dispatch now names the capped form.
- **No guard checks a baseline's FRESHNESS** — only its canonical-ness and no-loss. And a baseline can go inconsistent through a *clean* merge, which no guard sees until CI builds the merge result.

## 🔑 ON THE OWNER'S DESK

1. **Look at two prototypes** — Overview (redrawn today: treatment A was not what ships, so the "progress bar does not look clean" verdict was about a picture of nothing) and the quote maker. **#5874 is unarmed waiting on it.**
2. **The Setnayan AI price sentence.** `FIRST_VENUE_SHORTLIST_UPSELL` promises *"₱499 first 28 days → ₱799 per 28 days"*. The catalog charges **₱2,499 one-time** and `SETNAYAN_AI_RENEW` is **INACTIVE**. It is mounted twice on the Overview and renders unconditionally, so it has been reaching couples. The copy fix is authorised and running. **The question is whether a ₱499/₱799 subscription is still intended** — if yes, that is a catalog job, not a code job.
3. **The admin money switches, three answers** — announce a promotion or let suppliers find it · refuse or warn when enforcement would lock someone out (rec: warn **and name them**) · does a window need a reason field (rec: yes).
4. **Throw the captcha switch once and sign up at `/open-shop`** — the fallback is wired and has never been exercised under the condition it exists for. Only he can test it.
5. **Every vendor photo is served from a development storage hostname**, documented as rate-limited. A DNS change, his call.
6. **No browser drive of the guest card as a signed-in couple** — a fresh worktree has no `.env.local`. Two things tests cannot see: whether a debounced save steals the caret mid-word on a phone, and whether tapping the peek strip returns to the roster with the row still selected.
7. **Event Hub PRO copy understates what ships** — fixing it needs a migration.

---

## WAVE 3 — pre-measured 2026-09-22 09:45 UTC against `origin/rd/wave-2`

Measured with real trial merges, not greps. **Zero shared files between any pair of the ready
branches**, so they fold in any order.

| slot | branch | vs wave-2 | files | state |
|---|---|---|---|---|
| A | `rd/team-money-refuses-a-guess` @ `be6998b4d` | ✅ CLEAN | 7 | **accepted, green, idle** |
| B | `rd/event-hub-wears-a-theme` (theme vocabulary + skins) | ✅ CLEAN | 38 | building — owner's stated priority today |
| C | `rd/sai-cta-and-the-progress-bar` | ✅ CLEAN | 0 | building — Sai copy, duplicate percentage, 0% ring |
| D | quote maker **G-2** — the gift a couple cannot see | not cut | — | 🟢 launched |
| E | quote maker **F** — rows not sentences | — | — | same branch as D |

⛔ **`claude/rd-quote-maker-held-bcd` CONFLICTS with wave 2** and does not join wave 3 as-is. It must
merge `main` after #5892 lands and redo `proposal-maker.tsx` and
`vendor-dashboard/messages/[threadId]/page.tsx` — the chat frame's own files. Then it is foldable.

⏸ **Held out of wave 3 deliberately:**

- **`papic_dedicate_shots` retirement** — its own PR, whole. Measured: the DROP orphans
  `papic_seat_allocations`, whose term is read by four money functions and nine app files, with 21
  call sites across five db test files, two of them autopsies of shipped money defects. Needs the
  heavy replay, so it queues behind the lock. ⚖ **Owner question first:** gone, or merely unreachable?
  Dropping the writer while live rows exist is a different change from retiring it for new events.
- **`vendors-plan-budget.ts`'s `lockedTotal`** — the same null-swallowing shape as the money split,
  and the TRUE source of the locked figure, but it also feeds the accordion, the folder headers and
  `/budget`. Correcting it moves numbers on three other surfaces. Its own slice.
- **Quote maker E** — needs a `service_card_ids` column AND the stream render together. Migrations
  are one per wave and `#5875` already carries one. A column with no reader is a second source of
  truth waiting to disagree.
- **Your Team slices 1 and 4** — slice 4 unblocks only once the Overview counts are on `main`.

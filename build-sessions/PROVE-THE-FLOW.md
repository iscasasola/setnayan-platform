# PROVE THE FLOW — the two-sided live test, and how to resume it

> **The goal, in the owner's words (2026-09-07):** *"what i want to do is you be a
> vendor/user with an event. then you communicate with me as the other end… so it will be
> us 2 trying the app."* And: *"i want to prove and experience it."*
>
> This is not an audit and not a test suite. It is **two real accounts using the live
> product against each other**, end to end: find a supplier → inquire → chat → get a price
> → lock → pay. Nothing in `apps/web/**/*.test.ts` can produce the evidence this is after,
> because every one of those runs against a fixture. The thing being proved is that a
> couple and a supplier who have never met can complete a booking on `setnayan.com`.

**⚠ READ THIS FIRST IF YOU ARE A NEW ACCOUNT.** `~/.claude/**/memory/` does **not** travel
between accounts, and the spec corpus at `~/Documents/Claude/Projects/Setnayan` is a
second git repo you may not have. Everything you need is in **this file**, which is
committed to this repo. Its own liveness guard is
`apps/web/lib/prove-the-flow-doc-is-alive.test.ts` — when that fails, fix this document;
never delete the reference to go green.

**⚠ EVERY NUMBER BELOW IS A MEASUREMENT WITH ITS RE-MEASURE COMMAND ATTACHED, NOT A
CLAIM.** CLAUDE.md rule 7: an anchor is a string, never a number. **This file was wrong
within a day of being written last time** — it said `chat_threads = 0` after the first
thread already existed, and named a couple account the live test never used. Assume the
same rot. Run § 1 before you act on anything here.

---

## § 0 · THE SIDES

| | who drives it | holds |
|---|---|---|
| **Supplier** | the owner, at his own keyboard | `Saysay Live Band & Hosting (FIXTURE)` |
| **Couple** | **also the owner**, at his own keyboard | event `Cale & Ice` |

### § 0a · THE ROUND-1 TEST USES A DIFFERENT COUPLE — read this before touching `Cale & Ice`

**As of 2026-09-10 there is a committed build plan for this test**, in the spec corpus, not
this repo: `WHATS_NEXT_Build_Plan_2026-09-10.md` + its session prompts
`WHATS_NEXT_Build_Plan_PROMPTS_2026-09-10.md`
(`~/Documents/Claude/Projects/Setnayan/`). **Read that register before resuming — it supersedes
the "just reply in the thread" plan below wherever the two disagree**, because it found five
things that would make the walk lie to the owner even after the supplier finally replies.

Round 1 of the live test does **not** use `Cale & Ice` — that event's couple is the owner's
own `is_internal = TRUE` account (see the caveat below: it proves nothing about payment) and
already has an accepted thread with the supplier, so re-running there skips the accept step
the owner wants to feel. Round 1 uses:

| side | account | why |
|---|---|---|
| Supplier | `testnayan2@test.com` — `Saysay Live Band & Hosting (FIXTURE)`, Solo until 2027-07-30, 2 nameless cards (`live_band` ₱35,000, `host_mc` ₱40,000), no photos, `verified` | the real test shop, not the owner's own `SetnaProd` |
| Couple | `testnayan4@test.com` — one wedding, `Ana & Miguel`, **no date yet** (the owner sets one first) | exactly one event, so Inquire cannot mis-file it; non-internal, so paywalls actually gate |

Round 2 (fold 5 — deliberately adding a shop to one of several events) needs a couple with
**two** ongoing events; neither test account has that yet — the owner adds a second event to
`testnayan3@test.com` or `testnayan4@test.com` before that round.

**Five things break the walk today, and a session is fixing each — check before you drive
any step past where the fix would matter:**

| step | breaks as | fixed by | re-check |
|---|---|---|---|
| publish a card | still demands a Setnayan-gift value the owner ruled optional | `A1` — PR [#5373](https://github.com/iscasasola/setnayan-platform/pull/5373) | `gh pr view 5373 --json state,mergedAt` |
| "🔒 Lock this deal" in chat, before a formal quote | locks nobody, freezes a NULL price, tells both sides "Deal locked" | `A2` (no PR yet as of 2026-09-10) | grep `negotiation-actions.ts` for a refusal path |
| accept a formal quote | page says "Accepted on `<date>`" and stops — no next step | `A4` (no PR yet) | open `/proposals/[publicId]` after accepting |
| a shop's cards on the couple's list | nameless — reads as its category, not a name | `B1` — PR [#5387](https://github.com/iscasasola/setnayan-platform/pull/5387) | `gh pr view 5387 --json state,mergedAt` |
| change price after a lock | replaces the number instead of showing both; a cut can bill negative | `B2` — PR [#5390](https://github.com/iscasasola/setnayan-platform/pull/5390), **owner looks before merge (money)** | `gh pr view 5390 --json state,mergedAt` |
| a locked shop's place on the list | sorts like a candidate, not first in its group | `A5` — cherry-pick of `e67420406e` (no PR yet) | `git cherry origin/main <branch>` |
| contact info visible before a lock | a stranger can email/call a shop straight off its public page | `#5404` (auto-merge armed, not this test's own session) | `gh pr view 5404 --json state,mergedAt` |

**Do not run round 1 until all seven show MERGED and production `/api/health`'s version has
each merge commit as an ancestor** (`git merge-base --is-ancestor <merge-sha> <served-sha>`).
Running earlier just re-discovers these same five defects one keystroke at a time — which is
useful only as confirmation, never as the record of "the test ran."

The owner's one-page prep-and-tap script is in the spec corpus:
`Test_Script_Live_Two_Sided_2026-09-10.md` — it extends `TEST_SCRIPT_E2E_2026-07-27.md`
rather than replacing it (that file's five accounts, ground rules and cleanup SQL still hold).

🛑 **THE COUPLE SIDE IS AN INTERNAL ADMIN ACCOUNT — CARRY THIS CAVEAT INTO ANY RESULT.**
Measured 2026-09-08: the couple on `Cale & Ice` is `Ice Casasola`, `account_type = 'admin'`,
**`is_internal = TRUE`**, and the same user **also owns a vendor shop**. `is_internal` is
this repo's documented false-green trap, and it is not a general worry — it is specific
and it names this event. `apps/web/lib/entitlements.ts` says in its own docblock that
internal *"showcase & demo events (e.g. \"Cale & Ice\")"* are meant to display fully, and
that **`eventSkuActive()` ORs this in so an internal-hosted event owns any SKU** (host
resolved server-side by `event_host_is_internal`).

**So completing the flow on `Cale & Ice` proves the CHAT and PROPOSAL path. It proves
NOTHING about any entitlement, paywall or payment gate — not one of them is exercised.** The last mile needs a genuinely external couple
account, which only the owner can create.

🔑 **A SESSION CANNOT TAKE EITHER SIDE, AND THIS IS NOT A PREFERENCE.** Claude Code
does not create accounts, does not sign up, and does not enter or handle passwords — held
on 2026-09-07 even when the owner said, correctly, that earlier sessions had seeded the
`testnayan*` rows. Seeding rows in a database is not signing a person up. **The supplier
side is the owner's to drive.** Any plan that has a session logging in as the supplier is
not a plan.

---

## § 1 · WHERE THE TEST ACTUALLY STANDS

Measured against **prod** (Supabase project `njrupjnvkjkitfctetvi`) on **2026-09-08**:

```sql
select
  (select count(*) from public.vendor_profiles)                      as shops,           -- 2
  (select count(*) from public.vendor_services where is_active)      as services_active, -- 2
  (select count(*) from public.chat_threads)                         as chat_threads,    -- 1
  (select count(*) from public.chat_messages)                        as chat_messages,   -- 3
  (select count(*) from public.chat_messages
     where sender_role = 'vendor')                                   as vendor_replies,  -- 0
  (select count(*) from public.vendor_proposals)                     as proposals,       -- 0
  (select count(*) from public.vendor_proposal_templates)            as templates,       -- 0
  (select count(*) from public.vendor_payment_methods)               as payment_methods, -- 0
  (select count(*) from public.orders)                               as orders;          -- 6
```

### The frontier, in one line

**`chat_threads` moved 0 → 1 on 2026-09-08 — the first couple→supplier inquiry in the
platform's history — and the supplier has still never replied (`vendor_replies = 0`).**
Of the 3 messages, 1 is the couple's and 2 are system notes.

| link in the chain | state |
|---|---|
| Couple finds the supplier | ✅ |
| Couple inquires | ✅ `chat_threads = 1` |
| Supplier accepts | ✅ `inquiry_status = 'accepted'` |
| Supplier sees who is asking | ✅ shipped 2026-09-08, live |
| **Supplier replies** | ❌ **never once, in production** |
| **Quote / proposal** | ❌ `proposals = 0`, and `templates = 0` blocks it |
| **Payment** | ❌ `payment_methods = 0` — nothing to pay *to* |
| Vendor locked | ❌ plan is `venue=considering, misc=considering, misc=considering` |

### The one live thread, measured

```sql
select t.thread_id, t.inquiry_status, t.accepted_at, e.display_name, e.event_date,
       (select count(*) from public.event_members em
          where em.event_id = t.event_id and em.user_id = vp.user_id) as vendor_is_event_member
from public.chat_threads t
join public.events e on e.event_id = t.event_id
join public.vendor_profiles vp on vp.vendor_profile_id = t.vendor_profile_id;
```

`accepted` · `Cale & Ice` · `2026-12-18` · **`vendor_is_event_member = 0`** — see § 6.

### The supplier's two cards

Both `is_active`, priced `35,000` (`live_band`) and `40,000` (`host_mc`), **`title` is
NULL on both**, so the cards render from their category. Shop is
`verification_state = 'verified'`.

⚠ **That `verified` was set by decision, not by a document review** — owner, 2026-09-07:
*"we did set that that shop is a legitimate shop."* No application was ever filed. The
`vendor_verification_bypasses` mechanism is the durable, dated form of that decision for
the next supplier; use it rather than editing `verification_state` by hand.

---

## § 2 · WHAT SHIPPED — DO NOT REBUILD ANY OF IT

All merged to `main` and serving. Confirm with `git log origin/main --oneline -30`.

### 2026-09-08 · the supplier can see their customer

| what was broken | fix, by greppable anchor |
|---|---|
| A supplier who had **accepted** still saw `"Couple"`, a `"C"` avatar and `DATE · Not set yet` against a real `Cale & Ice` / `2026-12-18`. Inbox and bookings said `"Event"`. | `apps/web/lib/inquiry-customer.server.ts` · `apps/web/lib/the-supplier-sees-who-is-asking.test.ts` |
| The customer summary sentence + Target date / Pax / Location / Locked suppliers | `apps/web/lib/customer-event-summary.ts` |
| A `timestamptz` rendered a day early — `2026-06-18 23:24+00` is **June 19** in Manila | `formatLongTimestamp` in `apps/web/lib/format-date.ts` |
| Locked-category chips on an inquiry | same summary builder; categories only, never a rival's name |
| One category printed two ways on two screens; 24 of 52 categories printed as **raw enum keys** | `apps/web/lib/one-word-per-category.test.ts` + its baseline |

🔑 **THE LESSON THAT OUTLIVES THIS FILE: two layers hid the customer and only one was the
mask.** A vendor holds no `events` RLS — measured on the *accepted* thread,
`vendor_is_event_member = 0` — so every surface's "revealed" branch read an RLS-nulled
`display_name` and rendered the fallback anyway. **Deleting the anonymisation mask changed
nothing on screen by itself.** A session that removes a mask, reloads, and sees no change
may be looking at a *second* mechanism, not a failed deploy.

⚠ **Do not "fix" that by granting vendors `SELECT` on `events`.** It hands every supplier
every couple's event row, including couples who never contacted them. Reads stay
admin-scoped and the **caller** proves vendor ownership.

### Owner rulings recorded 2026-09-08 (both in `DECISION_LOG.md` in the spec corpus)

1. **Anonymisation-until-accept is RETIRED.** *"we do not need to hide anything, since no
   more tokens."* It was the token wallet's storefront and the wallet was retired
   2026-05-11 — it withheld a name and sold nothing for four months.
2. **An inquiring supplier sees which categories are already locked** — *"we can share what
   categories is already locked"*. **Categories only; vendor NAMES stay booked-only**
   (`vendor_roster` in `get_vendor_event_brief`). This resolved a 2026-07-10 open decision
   *against* its own standing recommendation of booked-only.

### Earlier, still true

The card-editor sheet portal, the publish gate, the `event_basket_orders_granting` RPC for
the couple's own bill, and the production-build heap floor
(`apps/web/lib/the-build-has-headroom-ci-cannot-prove.test.ts`) are all merged. See
`git log` rather than re-deriving.

---

## § 3 · THE RESUME PATH — in order

⚠ **EVERY STEP BELOW IS OWNER-DRIVEN AT A KEYBOARD.** A session's job during all of them
is to re-measure after each, verify in the database rather than on the screen, and fix
what the attempt exposes. There is no step here a session performs.

1. **OWNER (supplier) · reply in the thread.** `/vendor-dashboard/messages`. `vendor_replies = 0`; this path has never
   run in production. Verified unblocked: `current_vendor_profile_ids()` resolves from
   `vendor_profiles.user_id`, so the missing-`vendor_team_members` failure that silently
   broke **Accept** cannot repeat here.
2. **OWNER · create a proposal template** at `/vendor-dashboard/proposals`, or the composer says *"Pick a template to send a
   proposal."* `templates = 0`.
3. **OWNER · add a payment method** at `/vendor-dashboard/payment-options`. `payment_methods = 0` — there is nothing for the
   couple to pay *to*.
4. **OWNER (supplier) · send a quote.** `proposals` must move off 0.
5. **OWNER (couple) · accept and log a payment.** Watch that the owner is actually notified — the
   notification and the email allowlist are two halves of one mechanism.
6. **OWNER (couple) · lock.** `event_vendors.status` reaches `contracted`; the rail's **Locked suppliers**
   stops reading `0 of 3`.
7. **BOTH · watch what each side is told.** The failure this codebase keeps producing is
   not a crash — it is **a refused read rendered as an empty state**. If either side sees
   "nothing yet", establish whether it is *empty* or *refused* before believing it.

---

## § 4 · THE BUILD PLAN — the supplier inbox redesign

**Prototype (live, interactive, desktop + mobile):**
<https://claude.ai/code/artifact/ee08b169-16d8-4821-84e7-d95199a03323>

**Why:** owner, 2026-09-08, on the thread screen — *"still messy chatbox"*. Six panels sit
between the last message and the text box (cross-sell picker, proposal-template banner,
Build a quote, "How did this inquiry end?", call launcher, Deal or meeting), so the
conversation renders as a sliver and on a phone is pushed off screen. The owner's
direction: *"you can rely on facebook business chatbox"* and *"the right most can be the
tools"*.

| phase | what | depends on |
|---|---|---|
| **1+2** | ✅ **BUILT AND MERGED — PR [#5327](https://github.com/iscasasola/setnayan-platform/pull/5327). Do NOT rebuild it.** Panels mount once above the stream as closed disclosures; the right column is the labelled tool list that opens them. Shipped as ONE change because shipping 1 alone breaks **four** live controls, not the one this row named: the rail's `#send-proposal` **and** the client brief's Quote / Call / Log-payment deep links. ⚠ Verify with `gh pr view 5327 --json state,mergedAt`. | — |
| **3** | ✅ **BUILT — PR [#5328](https://github.com/iscasasola/setnayan-platform/pull/5328). Do NOT rebuild it.** The ladder is now Inquiry · Quoted · Booked · **Completed** · **Cancelled**. ⚠ Verify with `gh pr view 5328 --json state,mergedAt`. | — |
| **4** | Conversation-list column (three-column layout), filters All / Unanswered / Quoted / Booked / Completed / Cancelled. | 3 |
| **5** | Setnayan AI draft strip above the composer; editable labels (where `misc` becomes correctable). | — |

🔑 **PHASE 1'S DESIGN CONSTRAINT, LEARNED THE HARD WAY:** the rail renders **twice** —
a desktop column and a mobile sheet. Putting the heavy tools *inside* it mounts
`ProposalMaker` and `SendProposalCard` twice and duplicates every form and anchor id. The
rail carries cheap **launchers**; the tools mount once, above the stream.

### ✅ OWNER DECISION ALREADY MADE — do not re-ask

**The stage control is READ-ONLY and DERIVED.** The supplier moves it by *doing the thing*
(sending a quote, logging a payment), never by picking from a menu — so the pill can never
say Booked while no money exists.

⚠ **Extend `apps/web/lib/vendor-thread-stage.ts`, do not write a new resolver.** It already
derives `inquiry | quoted | booked | delivered`.

🪤 **It could not do it as written**, and both halves of that warning were right: `DeriveArgs`
took no `inquiry_status`, and the SECOND derivation in
`apps/web/app/vendor-dashboard/clients/surface.tsx` had to move with it. Both done in #5328 —
the ordering is ONE pure function (`resolveThreadStage`) and "is it finished?" ONE predicate
(`rowReadsCompleted`), shared by the pill and the list.

Phase 3 shipped:
- `cancelled` ← `chat_threads.inquiry_status` in `declined / withdrawn / expired / displaced`
- ~~`completed` ← `event_vendors.status = 'complete'` (a real fifth rung, not a relabel)~~
  🛑 **THAT WAS WRONG AND WOULD HAVE SHIPPED A RUNG NOBODY CAN REACH.** Measured against prod
  2026-09-09 before building it: **nothing writes `'complete'`** — no application writer
  anywhere in `app/` or `lib/`, only read predicates and one legacy backfill in the migrations
  — and prod holds `considering=33 · contracted=10 · deposit_paid=3` with **zero** rows at
  `delivered` or `complete`. The sixth "gate with no handle", caught before it shipped.
  🔑 **An enum HAVING a value is not evidence anything can produce it** — which is exactly the
  argument this row used.
  ✅ What it reads instead, both measured live: the **completion handshake** (`confirmed` /
  `auto_confirmed` / `customer_confirmed_received_at` — prod `awaiting_vendor=45 ·
  confirmed=1`) and **`status` `delivered`/`complete`**, written by the couple-side auto-flip
  24h after the event, which touches no handshake column. So it is a **relabel plus a
  widening**, not a fifth rung.
🔒 **AND THE LIST'S PROBE MUST USE THE SERVICE ROLE.** `event_vendors` carries four SELECT
policies and **not one admits a supplier** (couple · couple-write · moderator ·
moderator-write, read out of prod). A supplier's own session reads **zero rows**, so the
obvious query reports every booking as unfinished forever and looks exactly like *"nobody has
finished a job yet."*

**Three mechanisms already track thread state and none spells the ladder alone** —
`chat_threads.inquiry_status` (pending · accepted · declined · displaced · withdrawn ·
expired), `event_vendors.status` (considering · shortlisted · contracted · deposit_paid ·
delivered · complete), `inquiry_outcomes.outcome` (won · lost · no_response, **zero rows**).
A fourth definition is the exact failure this repo keeps hitting.

---

## § 5 · TOOLS AND ENVIRONMENT — what a new account needs

| thing | value |
|---|---|
| Supabase project ref | `njrupjnvkjkitfctetvi` (Singapore) |
| Vercel team / project | `team_dHILOMWD1LWoDGDT5udD8JV5` / `setnayan-platform-web` |
| Production | `https://www.setnayan.com` · `setnayan-platform-web.vercel.app` |
| Owner / internal email | `iscasasolaii@gmail.com` (hardcoded `is_internal = TRUE`) |
| Spec corpus (separate repo) | `~/Documents/Claude/Projects/Setnayan` — `DECISION_LOG.md` is the canon |

```bash
# A WORKTREE WITH node_modules. A fresh worktree has none, so tsc/tests "pass"
# while resolving nothing. Reuse one, or install first.
git worktree add /tmp/wt-svc origin/main && cd /tmp/wt-svc && pnpm install

cd apps/web
NODE_OPTIONS=--max-old-space-size=6144 ./node_modules/.bin/tsc --noEmit -p tsconfig.json
pnpm test:unit                       # ~13,800 tests; contains a ~5-minute fuzz file
for g in scripts/lint-*.mjs; do node "$g" >/dev/null || echo "FAIL $g"; done

# `pnpm lint` does NOT run the repo guards — ~28 are separate CI steps.
```

⛔ **READ PROD, NEVER WRITE IT.** The § 1 queries are SELECT-only by design. Writing rows
into production from a session fabricates the evidence this test exists to produce, and
hand-writing a row is what caused the missing `vendor_team_members` outage. If a row must
change, the owner changes it through the product.

**PR workflow (owner-locked):** `gh pr create` then immediately
`gh pr merge <PR#> --auto --merge`. Never ask whether to auto-merge. ⚠ Auto-merge does
**not** gate on Vercel — that check is not required on `main`, which is how four
known-broken production builds merged green. Add a
`changelog.d/<branch-slug>.md` fragment; never edit `CHANGELOG.md` or `STATUS.md` in a
feature PR.

**⛔ NEVER apply a migration directly to production.** A direct apply orphans the prod
ledger and jams `db push` for *every* later merge — it stranded seven merged PRs for three
hours on 2026-09-02. `supabase migration repair` is an **owner** action, never a session's.

---

## § 6 · TRAPS — each of these cost real time

**Measuring and guards**

- **A guard that reads prose measures the explanation, not the fix.** Two guards written on
  2026-09-08 were **vacuous and passed their own sabotage**: one matched `revealed: true`
  inside a *comment* twenty lines from the call site; another matched a formatter across a
  whole file where three call sites existed, so breaking one left two satisfying it. Strip
  comments with `apps/web/lib/strip-comments.ts` and **assert the count, not the presence**.
- **A source guard over migration text cannot see who ends up holding a privilege.** A fix
  once granted `SELECT` to every signed-in user and *its own test passed*. Use
  `current_couple_event_ids()`; an invited guest is not the couple.
- **A test can encode the bug as correct** — an assertion once pinned the defect itself.
- **Derive each sabotage from the assertion, and never write the red count before the run
  prints it.**

**The shell and the harness**

- **`for x in $LIST` does not word-split in zsh.** A PR watcher iterated *once* with the
  whole string and printed *"still open: none → ALL MERGED"* while five PRs were blocked.
  Inline the items, and print what the loop matched *against*.
- **`git checkout --` cannot restore an untracked file** and silently *destroys* edits to a
  tracked one. **Commit before you mutate.** Three sabotage mutations were applied and
  never reverted this way, then committed.
- **A backgrounded command piped to `tail` leaves its output file EMPTY until exit** — "0
  failures" and "still running" look identical.
- **`gh` returning an empty list reads exactly like "nothing left to do."** Fail closed.
- **Never read code from `/Users/icecasasola`** — a stale checkout ~749 commits behind that
  has produced coherent, fully traced, completely wrong findings.

**Deploys**

- **`deploy-prod` green is NOT "being served".** The job only fires the Vercel hook; the
  build lands minutes later. Check the deployment `state` is `READY` and that the shipped
  commit is an ancestor of the serving one.
- **CI's `production build` passing is not evidence Vercel's build passes.** Four
  production builds died with `exited (137)` while CI was green on the same commits.
- **`claude/*` preview builds are cancelled by the Ignored Build Step and report PASS.**
- **The `typecheck + lint` job takes ~55 minutes**, most of it the PGlite replay of ~1,370
  migrations. It is not hung.

**Product-shaped**

- **A field named for one thing may hold another.** `booked_categories` from
  `get_vendor_event_brief` holds, at the inquiry rung, the **caller's own** categories with
  no status filter — reusing it would have shown a supplier their own categories as the
  couple's plan. Read the SQL, not the field name.
- **`formatLongDate` is for `date` columns.** On a `timestamptz` it takes the UTC date and
  renders a day early for anything after 16:00 Manila.
- **Removing a `<control>` fails `lint port keeps every control`.** That is the guard
  working; regenerate with `pnpm --filter @setnayan/web port:baseline` so the removal lands
  in the diff as one readable line.

---

## § 7 · OPEN — the owner's calls, not engineering's

1. **The `Vercel` check is not required on `main`** — which is why four known-broken builds
   merged. GitHub → Settings → Branches → `main` → Require status checks.
2. **`deploy-drift-monitor` alerts nowhere but the Actions tab.** It called a six-hour
   outage correctly on five consecutive runs and nobody saw it.
3. **The Vercel project's Node setting reads `24.x`** while `engines.node` says `22.x`.
   They disagree on paper and agree in practice.
4. **Two events are flagged `is_primary = true`** (`Cale & Ice` and `Movie Night`). Needs a
   partial unique index or data cleanup.
5. **`labelForVendorCategory` prefers `WEDDING_TILE_LABEL` over the canonical map**, so
   "Mobile Bar" beats "Mobile bar" on some screens.
6. **A public wedding page can still render `BAND_DJ` raw** under CSS `uppercase`; and
   `apps/web/lib/vendor-category-progress.ts` **stores** its humanised output, so fixing it changes
   written rows.
7. **`misc` reads "Miscellaneous"** — a 2–1 judge split against "Other".

---

## § 8 · RE-MEASURE BEFORE YOU TRUST THIS FILE

```bash
gh pr list --state open --limit 40 --json number,title,headRefName   # who is mid-flight
git worktree list                                                    # what this machine builds
git log origin/main --oneline -20                                    # what landed
node scripts/deploy-drift-doctor.mjs   # needs VERCEL_TOKEN, which is NOT set here — it
                                      # exits with "cannot ask Vercel what is live".
                                      # Ask the owner to run it; never ask for the token.
curl -s "https://www.setnayan.com/?cb=$RANDOM" | grep -o 'dpl_[A-Za-z0-9]*' | sort -u
```

Then re-run the § 1 SQL. If `vendor_replies` is still `0`, nothing in § 3 has moved and
this file is still current. If it is not `0`, **this file is already out of date** — fix it
in the same PR as whatever moved it.

🔑 **A HANDOFF IS NOT EVIDENCE — including this one.** CLAUDE.md's own "what is left" block
pointed at two finished jobs for an unknown stretch of sessions, and the previous version
of *this file* claimed `chat_threads = 0` after the first thread existed. A handoff decays
fastest exactly where it is read most. The § 1 queries are here so this file can be
disproved in under a minute. **Disprove it.**

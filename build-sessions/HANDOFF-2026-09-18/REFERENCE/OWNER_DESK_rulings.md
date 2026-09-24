# 02 · The owner's desk — ordered by what it unblocks

> ## 🔄 RE-MEASURED 2026-09-15 — MOST OF THIS DESK IS CLEARED. Read this block, not the tiers below.
>
> The tiers still describe 2026-09-13. **Eight items on them are done.** Every line below was
> measured today, not carried forward — and a re-measure command is given where one exists,
> because this document has already gone stale once in the two days since it was written.
>
> ### ✅ CLEARED since it was written
> **R2 secrets** — all four set; the desktop app now downloads on **both** platforms and the macOS
> build is Developer-ID signed, notarized and stapled (`spctl` says *accepted / Notarized Developer
> ID*) · **The DPO ruling** — *"no. we will honour the guest"*, built and served: a takedown now
> reaches **both** supplier tables · **The open takedown** — he pressed Hide; verified end to end ·
> **Part A** — accepted whole, recorded as recommended-and-accepted with three flagged to revisit ·
> **The day-of free window** — free through all of December 2026, set in production as
> `2026-12-31T23:59:59+08:00` · **The free-credit wording** — approved and shipped · **The 37
> principal sponsors** — restored to five blocks, read back and confirmed · **The Xcode licence** —
> `git` and `gh` work bare again.
>
> ### 👁 STILL HIS, AND BLOCKING WORK RIGHT NOW
> **A1 · the universal shop-page drawing, plus the stock-photo ruling.** This is the only item with
> a session actually stopped at it — Lane A finished D1, SUP-12 and SUP-14 and is holding at F1
> rather than building past the gate. ⚠ The note below is still true and still important:
> *"never a stock photo" was a session's reading, not his words.*
> **A2 and A3** follow A1 and block F2 and the six-door My Shop.
>
> ### 👁 STILL HIS, NOT BLOCKING
> **Capiz on a phone (S1a)** — never done. Look at S1a **only**; the S1b half was wrong and is
> struck below. All five themes now ship (house · capiz · velvet · galeriya · abaca, every one
> `ready: true`), so this is the last unclosed Invite item that needs eyes.
>
> ### ⚖ NEW TODAY, and none of them has a deadline
> · **Should an incomplete PROFILE block a business from sending its LEGAL DOCUMENTS?** As built,
>   the papers wait for the logo. ⚠ **The urgency previously attached to this was WRONG and is
>   withdrawn:** the two "verified shops" are `testnayan2@test.com` and **his own account** — there
>   is no third-party supplier whose badge lapses on 2027-03-12.
> · **Both those shops have `is_demo = false` and no `demo_batch_id`**, so any count that filters
>   demo data reports **2 verified suppliers**. That is a fixture and an empty shop of his own. If
>   the figure has ever been read as traction, it is not.
> · **Should the couple's legibility setting reach the invite doors?** It reaches **none** of them.
> · **The saved QR PNG carries no monogram** while the on-screen SVG does. Cosmetic; never asked.
> · **The Nikah witness question** — `witness` does not sit with `wali`/`imam`/`wakil` for
>   inner-circle standing. 0 live rows; a judgement about how a Nikah seats its witnesses.
>
> ### ⚖ B4 IS STILL OPEN AND IT IS THE ONE ABOUT REAL MONEY — measured today
> ```
> booking_fee_rate_pct           5.00
> booking_fee_tail_rate_pct      1.00
> booking_fee_tier1_limit_php    100000.00
> free_tier_booking_cap_enabled  FALSE
> setnayan_pay_fee_pct           5.00
> ```
> Re-measure: `select booking_fee_rate_pct, free_tier_booking_cap_enabled from platform_settings;`
> ⚠ **I am reporting these figures, not interpreting them.** The tier note below says the first five
> bookings are free and that the decision log claims the fee "computes and displays without
> charging"; `free_tier_booking_cap_enabled` reading **false** does not obviously agree with either
> sentence, and guessing at a money switch is exactly what he has told this project not to do.
> **Nobody has been billed** — production has never had a lock. Decide before any supplier reaches
> a sixth sourced booking.
>
> ### 🔑 STILL ONLY HIM
> **The `testnayan1` password**, typed by him — every live Playwright verification needs it, and
> **sessions must never type a password**. Never the Google button: that is his internal account and
> every paid gate silently passes.
> **Tier 4 privacy, four items** — what closing an account should do · the compliance-pack sign-off ·
> the RSVP guest-phone consent wording · a written reply from counsel on legacy memories.
> ⚠ These were marked "blocked" for weeks. **They were never blocked — nobody had asked him.** He has
> answered three privacy questions today inside minutes. *A fence nobody is standing at is just a
> slower version of not having decided.*


Only Ice can clear these. **Never re-ask anything not on this list** — `grep DECISION_LOG.md`
first; the packs carry ~95 questions of which most are already ruled.

Three different kinds are mixed below, and they are NOT equally expensive:
**👁 LOOK** (minutes, no decision) · **⚖ DECIDE** (a choice) · **🔑 ONLY-HE-CAN-DO** (an account,
a secret, a password, a device).

---

## Tier 1 — clears the most work per minute

| | Item | Unblocks | The packs' recommendation |
|---|---|---|---|
| 👁 | **A1 · the universal shop page drawing** (`Setnayan/prototypes/vendor_public_page_universal_2026-09-10.html`) — plus the **stock-photo** ruling | D1 → F1 → F2 | Look at **§F first**; it is the only part D1 needs. Stock photo: show one only while a shop has no photo of its own, marked as a sample. ⚠ "never a stock photo" was a session's reading, **not his words** |
| 👁 | **A2 · free vs Solo shop page** (`shop_page_free_vs_solo_2026-09-10.html`) | F1 | Pick one of the two proposals |
| 👁 | **A3 · six-door My Shop** (`shop_page_2026-09-10.html`, with a 91-row "every control → its door" table) | G1 → G3 | Look at doors 1–3 first; **G1 can start on his yes** |

**These three are the single highest-leverage thing on the desk: six stalled build sessions, one
afternoon of looking, and nobody else can do it.**

| | Item | Unblocks |
|---|---|---|
| 👁 | **Capiz on a phone** (S1a) — open a Capiz invite on setnayan.com, watch the reveal then the three doors over the couple's photo with their monogram. ⚠ **The second half of this item was WRONG and is removed:** S1b ("confirm a couple without Pro still gets plain House") **cannot be shown on screen** — the theme radio is disabled and the server refuses before writing, so a couple without Pro can never reach that state. Trying it looks like a broken picker. It is already closed by two tests. **Look at S1a only.** | closes 1 of Invite's 12 items |
| ⚖ | **Resume the paused live test** (paused by him at step 5, 2026-09-11) | releases **FU-1** — four display fixes already built and checked in DRAFT #5463 |
| 🔑 | **The `testnayan1` password**, typed by him into `StoryFinale/drive/signin.cjs` (a visible window) | every live Playwright verification. **Sessions must never type a password.** Never use the Google button — that is his internal account and every paywall silently passes |

---

## Tier 2 — a ruling that is currently blocking a specific build

| | Item | Blocks | Recommendation |
|---|---|---|---|
| ⚖ | **Item 12 conflict.** His 2026-09-11 ruling (same-day celebration: add guests on the day, no guest list means anyone may use the free credits) **contradicts** his 2026-09-04 lock "free credits on the first event only" | Story 2.7 | BuildFinale C3: let the **first-event rule win**, apply #12 to first events only |
| ⚖ | **B1 · one "Send a quote" button** instead of "Build a quote" + "Send proposal" | FU-4 | **(a)** one button that asks "from a template or from scratch?" |
| ⚖ | **B3 · "chasing N of 3 customers for 13 Mar"** — does a couple who only said "March" count? | FU-6 | **(c)** exact-day count plus a separate "N more are looking at March"; or **(a)** for simpler |
| ⚖ | **B4 · the booking fee is switched ON in code.** It creates a real bill on the manual GCash/BDO rail from a verified shop's **6th** sourced booking. The decision log (2026-09-10) says it "computes and displays without charging" — one of the two is wrong. First five are free, so nobody has been billed, and production has never had a lock | money, and the record | **(b)** turn the setting off until PayMongo is live. **Decide before any supplier reaches a 6th booking** |

---

## Tier 2b — raised 2026-09-13 by landing the Papic estimate fix (PR #5476)

| | Item | Blocks | Recommendation |
|---|---|---|---|
| ⚖ | **Should the couple's home tile read your credit setting live?** It tells couples whether they have enough Papic credits. It does **not** read `papic_event_pool_config` — it uses a copy of those numbers built into the code. Today the copy matches your live row exactly (150 per guest · floor 5,000 · ceiling 30,000, measured 2026-09-12), so couples see your figure. **But changing the row in /admin/pricing would not reach the tile** — it would keep quoting the old number while the actual photo limit followed the new one. | nothing today; it becomes wrong the first time you edit that setting | Wire the live read — one indexed single-row lookup per page. Not done in #5476 because it changes what a money surface queries. A tripwire test now goes red if anyone edits the built-in copy. |

## Tier 3 — money and naming (nothing can be sold without these)

- ⚖ **Featured supplier tier: name and price.** Documents disagree on whether "Featured" is
  simply Pro-and-above or a separate paid product, and "Featured" already means three other
  things. *Recommendation: make it Pro-and-above (no new product) and give the paid badge its own
  word.*
- ⚖ **Vendor Custom plan** — a six-item sign-off list, untouched. The seat price is written as
  both ₱250 **and** ₱500. *Pick the seat price first; it blocks an open change.*
- 🔑 **Never derive a price from a document or a code comment.** `platform_retail_catalog_v2` is
  admin-managed and is the only price a customer is charged. Charm (-1) endings are **no longer a
  rule** — he rounded three SKUs off them on 2026-08-27.

---

## Tier 4 — privacy, and he is the registered data-protection officer

`/privacy` is live and returns **200** to anyone. The Unfinished pack claims four things it states
are not what the code does (`CP-1`…`CP-5`). **Its researchers read code only, never the production
database — re-verify before rewriting a word.** Then:

- ⚖ what closing an account actually does · device hashes (exported? deleted?) · naming the
  companies that read couples' words and photos (OpenAI, LanguageTool, Gemini) · the claim that
  analytics carry "no personal identifiers"
- ⚖ the guest-camera lane: is it open at all, and its retention + consent wording (RA 10173)
- 🔑 `dpo@setnayan.com` must reach a person
- ⚖ **Automatic document checking** for verification needs his DPO sign-off before it is started

---

## Tier 5 — accounts, secrets and hardware (no engineering can proceed without him)

- 🔑 **R2 release secrets — 5 values in 2 stores.** This is the **single blocker** for the desktop
  app being downloadable at all (both `/download` routes answer 503), for the auto-updater going
  live, and for the physical rehearsal.
- 🔑 **Windows OV code-signing certificate + cloud signer** — otherwise Windows couples meet
  "Windows protected your PC" in their wedding week.
- 🔑 Apple notarization / stapling · iPhone resubmission · Android D-U-N-S.
- 🔑 A **second device** for the encoder's end-to-end rehearsal. No frame has ever reached YouTube.
- ⚖ **Pool channel: reuse it, or retire it after one wedding?** One couple's copyright strike can
  delete another couple's wedding film. Disclosed, still unruled.

---

## Tier 6 — standing questions worth closing once

- ✅ **RULED 2026-09-16 — "May a session write to production to test its own work?" YES, NARROWLY.**
  Permitted: a session's OWN test event and its rows, to reach a state a verification needs.
  **Still forbidden:** a real couple's or supplier's data · `platform_retail_catalog_v2` or any
  pricing table · the migration ledger (`supabase migration repair` stays yours) · manufacturing a
  state to make a test pass rather than to reach a reachable one. **Restore what you changed and
  say so in the PR.** Granted alongside four other standing rules — see `DECISION_LOG.md`
  2026-09-16: the orchestrator may re-scope peers; a ⚖-gated row is built behind an off-by-default
  flag rather than skipped; the orchestrator picks the next row from a re-measured register; direct
  corpus edits are confirmed (not repo code).
- ⚖ The stale checkout at `/Users/icecasasola` — ruled **"leave it"** on 2026-09-09. Recorded here
  so nobody re-opens it. It is still auto-loaded into every session and must be ignored as current.
- ⚖ #4471 and #4472 were closed with no replacement; **#4472's problem is still in the code.**

---

## Added 2026-09-16 — two that need you, and one you should simply know

- ✅ **CLOSED 2026-09-16 — "CEILING." A per-guest number is the MOST a guest may take.** No
  reservation is to be built; the earlier *"minimum shots per guest"* phrasing is superseded. The
  three screens corrected in PR #5539 are now canonical. **Nothing is owed.** The record of what
  was found is kept below because the lesson outlives the answer.
  ⚠ Making `papic_event_pool_status` withhold would now CONTRADICT this ruling, not complete it —
  the guard's failure message says so and asks for a new ruling, not a copy edit.

- 🔎 **WHAT IT TOOK TO ASK YOU (kept, answered above).** You said the host can *"assign **minimum**
  shots per guest"*. **A minimum is a floor. What is built is a ceiling.** Measured:
  `papic_event_pool_status` — the function every capture path asks how much is left — subtracts
  `papic_seat_allocations` and **never reads `papic_guest_spend_ceilings`**. So a named guest's
  number holds nothing back for her; every credit comes out of the one pot, first come first
  served, and a guest who arrives late finds whatever is left regardless of her number.
  🔑 **The tell was already in the tree:** *"Open the rest to everyone"* only means something if
  something was being held back. **The control for releasing a reservation shipped; the reservation
  did not.**
  ⇒ **Done without you (PR #5539):** three screens stopped promising it — your allotment sheet, the
  console's confirmation lines, and, worst of the three, **the guest's own phone at the moment she
  is refused** (*"This is the number the host set aside for you"*).
  ⇒ ✅ **You answered: "ceiling."** The screens are right and nothing more is owed. Inert either
  way today: 0 rows in the ceilings table, 0 events with the flag on.
  🔑 **THE PART WORTH KEEPING:** three screens had already answered this question — including the
  guest's own phone at the moment she was refused — and you had never been asked. **A screen that
  answers an unruled question is not a placeholder; it is the product deciding for you.**

- ⚖ **THE 50,000 RUNG — CLOSED, recorded so nobody re-opens it.** You ruled *"keep the 15,000.
  follow the tier."* The live catalogue stands; the 2026-08-27 sheet's ₱11,200 is superseded. ⚠ But
  the ladder guard's arithmetic was computed **for ₱11,200**, so whoever next touches it recomputes
  from `platform_retail_catalog_v2` rather than trusting that row.

- 🔎 **NOT A DECISION — A FACT ABOUT YOUR OWN WEDDING.** On `cale-ice`, **75 of 77 guests have no
  email AND no mobile.** Exactly one guest has an email. Zero invitations have ever been recorded as
  sent. That is not a gap in a feature: **every automated channel Setnayan has reaches one person
  out of seventy-seven.** Three consequences worth separating — anything sold as "we'll email your
  guests" is decorative on this event · the RSVP loop has no return path, so whatever moves those
  75 pending will be you in Viber, by hand · **the printed QR card is not a nice-to-have here, it is
  the primary delivery mechanism**, which is why the compact-vs-formal name call was worth guarding.
  ⚠ Not generalised to the platform: it may be that contact details simply have not been entered,
  and 8 events is not a sample. The honest version is that on the only real wedding we have, the
  reachable fraction is 1/77, **and nobody had looked.**

---

## 🚨 ADDED 2026-09-16 — FOUR THAT ARE NOW DUE, from the launch-readiness sweep

All four re-measured against production by a second session before being written here. Full set of
24 rows is LR-1…LR-24 in `ONE_REGISTER.md`.

- 🔑⚖ **THE DATABASE HAS NO BACKUPS.** The Supabase organisation is on the **free plan** — no
  automated backups, **no point-in-time recovery** — and you are **87 days from two irreplaceable
  weddings**. This is the 2026-08-10 *"let's stay free for the moment"* call, whose own note said
  **revisit before launch**. Pro is about **₱1,450/month** and is a card payment you have to make.
  **Nothing else on this desk is as unrecoverable as losing the database in December.**

- ⚪ **RETRACTED — "THE VERIFIED BADGE MEANS NOTHING" WAS WRONG.** Put on this desk on 2026-09-16
  and withdrawn the same day. **Both badges are backed**: `vendor_verification_bypasses` holds
  **2 rows**, matching the 2 badges exactly, each with a stated reason, an `admin_audit_log` entry
  and a deadline of 2027-03-12. That is **your own vouch ruling of 2026-09-07** working as you
  ruled it — same badge, no cap, the deadline holding it honest.
  ⇒ **`vendor_verifications` = 0 is the expected reading, not the defect.** Nobody has ever
  completed paper verification, and that is exactly why you authorised vouching.
  🔑 **The row counted one table and drew a conclusion about a mechanism living in another** — and
  the invariant first proposed off the back of it would have **forbidden your own ruling from nine
  days earlier**, with every existing guard still green.
  ⇒ **All that actually survives: `Saysay Live Band & Hosting (FIXTURE)` is publicly listed under
  a name containing the word FIXTURE.** Rename or hide it; minutes. Nothing else here is owed.

- ⚖ **ANYONE CAN MANUFACTURE ACCOUNTS, AND 5 OF YOUR 13 ALREADY ARE.** Anonymous sign-in is on and
  no bot check is live. Each signup also sends mail from our domain — **the same sending reputation
  that has to carry 133 December invitations**, none of which has ever been sent. Turnstile is
  already written up in `OWNER_ACTIONS.md`; about fifteen minutes.

- ⚠ **CORRECTED — "A LOCKED-OUT PERSON STAYS LOCKED OUT" WAS OVERSTATED, BY ME.** Two things are
  now measured. ✅ The **2-emails-per-hour cap is real**, confirmed from Supabase's own live docs:
  all Auth email endpoints, scope *project*, two per hour on the built-in provider, configurable
  only with custom SMTP. ⛔ But **"Auth has no custom SMTP" was asserted by nobody who checked it**
  — there is no route to read that setting from a session, and it is the whole premise. And the
  locked-out claim is false: the page does say what happened.
  ⇒ **This is now a thirty-second look, not a build:** Dashboard → Project Settings → Auth → SMTP.
  If it is already pointed at Resend, the row dissolves. Nobody should build until you have looked.

- ⚠ **CORRECTED — THE GUEST-PHOTO WITHDRAWAL DOES NOT CONTRADICT YOUR RULING. I said twice that it
  did, and I had it backwards.** What is true: a withdrawn photograph's FILE stays publicly
  fetchable, unsigned — a fetch returns HTTP 200 — because the takedown stamps a flag and makes no
  storage call. What is NOT true: that this breaks your 2026-09-16 ruling. **That ruling says
  "final against OTHERS, never against her"** — she can put it back herself with one press. A
  control the guest can reverse could never have implied the bytes were destroyed.
  ⇒ So it is a genuine question of its own, and it is yours: **when a guest withdraws her
  photograph, should the file be deleted — given she can undo the withdrawal?** Deleting makes the
  undo impossible. That tension is the decision.

🔑 **ONE THAT CONTRADICTS A RULING YOU MADE TODAY, so it is engineering's to fix, not yours:** a
guest's photo withdrawal hides the picture from five pages and **leaves the file itself reachable
by URL, permanently.** This morning you ruled that a guest's own removal is final and the couple
may not reverse it — and meanwhile the photograph never actually left. Queued as LR-13.

- ⚖ **DO YOU WANT PEOPLE TO TICK A BOX FOR THE TERMS AND THE PRIVACY POLICY?** Right now
  `/signup` carries a sentence under the button — *"By signing up, you agree to our Terms and
  Privacy"* — and **no checkbox**, so nothing affirmative happens and **nothing is recorded**.
  Re-measured across every column in the database, not just tables with "consent" in the name:
  about ninety consent columns exist (face enrolment, marketing, civil status, guests' UGC terms)
  and **not one records platform Terms or Privacy acceptance.**
  ⚠ **Your Privacy Policy changed on 2026-09-15 and there is no version stamp**, so nobody can say
  which text any user is held to — or that they were ever held to one.
  🔑 **The uncomfortable part: the product already asks affirmatively before it publishes a
  couple's wedding photograph** — an owner ruling of 2026-07-12, enforced app-wide by a guard
  because one door had missed it — **and asks nothing at all before binding them to the Terms.**
  ⇒ This is yours as DPO before it is engineering's: **browsewrap (as now) or clickwrap (a box
  they tick)?** The record cannot be built until you answer — stamping an acceptance that never
  happened is worse than having none.

- 🔎 **NOT A DECISION — BUT YOU ARE THE DPO AND THIS IS YOUR CONTACT LINE.** The Data Protection
  Officer contact in the footer of **every public page** is below the readability floor: the words
  measure **2.21:1** and the email **3.14:1** against the 4.5:1 AA bar, on a `#f2f2f0` ground, with
  nothing in that footer large enough to earn the 3:1 exemption. It is the worst case in a footer
  where **6 of 7 text roles fail** — the nav links, the column headings and the tagline go with it.
  ⇒ Engineering's to fix, not yours to rule on. Flagged because it is the legally-required privacy
  contact and it is the least readable thing on the page.

- ⚖ **WHEN DOES THE FREE DAY-OF PERIOD END? One date, and a whole row is finished.** You ruled on
  2026-09-11 that the specialist day-of desks are free during launch with a **"dated end, shown to
  shops"** — and the single config value that holds that date **defaults UNSET**, because the
  public-launch date has never been set. The console itself already ships ungated to every booked
  supplier, with a test pinning that the generic kit passes through on every access path. ⇒ **This
  is not a build. It is one date.** Until it is set, suppliers are told the desks are free during
  launch and nothing tells them when that stops.

- ⚠ **WITHDRAWN — I ASKED YOU FOR THE LIVE STUDIO HOSTED-CHANNEL PRICE AND IT WAS ALREADY ON SALE.**
  I told you it was *"switched off right now and sells nothing"*. Measured in the live catalogue:
  `LIVE_STUDIO` **₱2,500 active** and `LIVE_STUDIO_HOSTED_CHANNEL` **₱3,000 active**, both updated
  **2026-09-03** — thirteen days before I asked. Your answer matched the shipped figures exactly,
  so nothing was unblocked and nothing needs building. **The question should never have reached
  you.** Recorded so the row is not re-opened: DAY-2 is complete.

- ⚖ **DOES THE V1 SAMAHAN EXCLUSION STILL STAND? Asking BEFORE anyone spends a week reversing it.**
  One register row asks that samahans be able to **nest, be findable by strangers, and be deleted
  outright**. All three were **deliberately excluded from V1** — the foundation migration says so in
  its own header (*"in V1 — no discovery, no nesting (parent_community_id is a deliberate later…)"*),
  and the actions file has `leaveCommunity` and **no `deleteCommunity`**. Nothing is broken; a past
  decision is simply still in force.
  ⇒ **Three separate answers, and they can differ:** should a samahan be **findable by strangers**?
  should samahans **nest**? should one be **deletable outright** rather than only leavable?
  ⚠ Deletion is the one with a cost attached — a samahan holds other members' posts, so "deleted
  outright" destroys other people's writing, not only the creator's.

- ✅ **ANSWERED 2026-09-17 — "the terms".** The camera row was about the one-time UGC acceptance a
  guest gives before their first photograph, and that **ships**: the acceptance is stamped and the
  camera gates its first capture on it. **Row closed, nothing to build.** ⚠ The other reading — when
  during the celebration guests may shoot at all — is a different mechanism and is explicitly **not**
  authorised by that answer; if it is ever wanted it comes back as its own question.

---

## 🗓 CORRECTED 2026-09-17 — AND THEN CORRECTED AGAIN BY THE OWNER

⛔ **THE FIRST "CORRECTION" BELOW WAS WRONG. `maria-and-jose` IS A SAMPLE WEDDING.** The owner said
so; the database says so too — `events.is_sample = true`, and **it is the only row in the table with
that flag set.** The column existed the whole time and **nobody filtered on it** — not the
launch-readiness sweep, not the 92-day plan, not this desk. Every figure below has been re-measured
with samples excluded.

- ✅ **THERE IS ONE REAL DECEMBER WEDDING: `cale-ice`, 18 December — 92 days.** There is no 12
  December deadline and there never was. Anything keyed to the 12th is keyed to a fixture.
- ✅ **REAL GUEST NUMBERS, samples excluded: 101 guests across all live events, 100 with no email.
  `cale-ice` alone holds 92 of them, 91 with no email.** The printed card conclusion is unchanged
  and if anything stronger — it now rests entirely on the one wedding that is real.
- ✅ **0 of 101 real guests have ever been sent an invitation.** Unchanged.
- ⚠ **DECEMBER SUPPLIER ROWS: 4, not 46 — and still 0 linked to a Setnayan account.** The 46 was
  almost entirely the sample. The gap is real; its SIZE was fiction.
- ✅ **STILL TRUE AND UNAFFECTED: `cale-ice` is hosted by your internal account** (`is_internal =
  true`), so **every paid gate passes silently on the one real day.** Nothing about paywalls can be
  proven there.
- ✅ **STILL TRUE: `cale-ice` has no coordinator and one member row — the couple.** 92 days out,
  nobody is in the coordinator seat.
- ✅ **STILL WITHDRAWN: the R2 "single blocker" is done** — secrets set 2026-09-14, both download
  routes 302 to R2 and serve real files.

🔑 **THE LESSON, AND IT IS THE THIRD TIME TODAY THE CORPUS HELD THE ANSWER: `is_sample` WAS THERE.**
A sweep, a plan and this desk all counted a fixture as a real wedding, and the column that says
otherwise was one `select` away. **Every population count in this file must carry
`where is_sample = false`, and any figure that does not is unverified.**

- ⚖ **TWO COLOUR TOKENS ARE UNREADABLE AND THEY CARRY ~54 TEXT ROLES ACROSS THE MARKETING SITE.
  Repainting them is TWO LINES. Nobody has approved it, so nobody has done it.**
  `--hr-grey` (**3.14:1**) and `--hr-grey-2` (**2.21:1**) fail the 4.5:1 readability bar **wherever
  they are used** — not only in the footer where this was found. The footer fix has shipped, scoped
  to the footer **on purpose**: repainting both tokens globally would fix all ~54 roles at once and
  would be a **site-wide visual change to your marketing pages, made under cover of a footer
  ticket.** ⇒ **Your call: repaint the two tokens site-wide, or keep fixing surface by surface?**
  The two-line version is sitting there looking tempting, which is exactly why it was not taken.
  ⚠ **AND A SECOND DECISION INSIDE IT, which is not obvious:** solving BOTH greys to the bar
  **collapses them** — 0.1256 luminance apart becomes **−0.0022**, i.e. they cross. The quiet grey
  and the loud one become the same grey in the wrong order, and every contrast test goes green while
  the page's deliberate hierarchy disappears. **A contrast fix can make everything equally loud.**
  The shipped footer fix puts the quiet one AT the bar and the loud one a step past it, and its
  guard asserts they stay separated. Any site-wide repaint must do the same.

---

## 🔒 RULING 2026-09-18 — THE BOOKING FEE IS THE COMMIT POINT

Owner, verbatim, during the platform's first end-to-end booking run:

> *"when lock and they have the complete handshake and the vendor pays us the
> booking fee. budget planner should fill up the quotation."*
>
> *"they only proceed to deliver the free papic credits (if there is), lock on
> the vendor schedule, finalize location and date (if ever it locks to a final
> place or date for the event), adds to the budget planner, and records 1 locked
> customer for the vendor. upon the vendor paying their booking fee. also
> announces to the other shortlist of the vendors (each event of different
> users) how many vacancies that are left (if setnayan AI is activated?)"*

**Six effects, one trigger — the supplier paying their booking fee:**

| # | effect | state today |
|---|---|---|
| 1 | deliver the free Papic credits, if any | columns exist: `event_vendors.setnayan_gift_locked_at`, `setnayan_gift_credits_at_lock`, `setnayan_gift_centavos_at_lock` — all NULL |
| 2 | lock the date on the **vendor's** schedule | `vendor_calendar_blocks` exists · **0 rows** |
| 3 | finalise location + date on the event, if that lock settles them | `events.date_candidates` holds candidates until one is locked |
| 4 | fill the budget planner with the quotation | **ships today at LOCK, not at fee** — `a-locked-deal-reaches-the-budget.test.ts` |
| 5 | record 1 locked customer for the supplier | — |
| 6 | announce remaining vacancies to that supplier's other shortlists, across other couples' events | **new** · owner marked it *"(if setnayan AI is activated?)"* — his own open question |

### ⚠ The dependency that blocks all of it

`isBookingFeeEnforced()` is a **two-key gate**:

```
NEXT_PUBLIC_BOOKING_FEE_ENABLED     "true"   ← set in Production
NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE   ABSENT   ← never set
```

`booking_fee_charges` and `booking_fee_ledger` hold **0 rows and always have**.
The code's own comment says the second key flips *"once the rail is KYC-approved
AND the checkout is wired."*

🔑 **So moving these six effects behind the fee would stop all six happening at
all, until that rail is live.** Item 4 in particular currently fires at lock and
works. This is a sequencing decision, not just a rule: the fee has to be
chargeable before it can be the commit point.

### What is NOT yet decided

- whether item 6 requires Setnayan AI (the owner wrote it with a question mark)
- what a supplier's "vacancies" are counted against — a per-date capacity, a
  daily capacity (`vendor_services.daily_capacity` exists), or a manual number
- whether items 1–3 and 5 should fire at **lock** in the meantime and be
  re-pointed at the fee later, or wait

### Ruling 2026-09-18 — a supplier updates a quote; the couple re-accepts

Owner: *"they can do updates and must be reaccepted. so they can negotiate of
the benefits"* — then, on how to build it: **(a)**, surface the existing
amendment loop as *"Update this quote"*, rather than (b) giving
`vendor_proposals` its own revision chain.

**Why (a):** the loop already ships — `proposal_amendments`, the amendment
builder, a propose → accept/decline RPC, and db tests. It is reachable today
only through the composer's **"Deal or meeting" → "Send a deal"**, below the
fold and named after neither updating nor quoting. The work is naming and
placement, not machinery.

**What (a) does not give:** a single object showing quote v1 → v2 → v3.
Amendments sit beside the proposal rather than superseding it. If a version
history on the quote itself is wanted later, that is (b) and it is a bigger
change — the send-time freeze (*"sending freezes these numbers — RSVP changes
after today won't alter this proposal"*) exists for a real reason and would
have to be re-thought rather than removed.

**Sequenced after the chat-box consolidation** (owner: *"because you need to fix
the chatbox first"*). The update action belongs on the quote card, and the quote
card is moving into the conversation — building it before that lands would place
it on a surface about to be replaced.

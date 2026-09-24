# PAPIC-REDESIGN · the controller, in ONE merge

> **Model: Opus 5 · effort: high.** Read `BUNDLE-COMMON.md` first, then this. One branch, one PR,
> **one commit per build** — never squashed, so a wrong build is a surgical `git revert <sha>`.

The approved prototype is `~/Documents/Claude/Projects/Setnayan/prototypes/papic_controller_redesign_2026-09-21/papic-controller-prototype.html`
(also at `claude.ai/artifact/MbAsqYqonaUYRaPMbZtnvG`). **Open it before writing a line.** Every
decision below is in `DECISION_LOG.md` under 2026-09-22 — read those rows, do not re-derive them.

Owner's complaint, which is the acceptance test: *"it doesn't feel inquitive and easy to manage."*

---

## ⚠ THE ORDER DEVIATES FROM BUNDLE-COMMON RULE 2, ON PURPOSE

Rule 2 says hardest first, because the cut line shrinks from the END. Here the hardest build
(**P4, blur**) is also the **least valuable** — measured 2026-09-22, **146 live guests and ZERO have
ever set `faceblock_enabled`**, so it is the one thing that can be dropped at no cost to anybody
today. Rule 2's purpose is "never start with the easy one because it feels like progress"; P1 is not
easy progress, it is the deliverable the owner asked for and the foundation the other three land on.

**If the bundle has to shrink, it shrinks from the end — and that is the right thing to lose here.**
Say so in the report. If the owner disagrees, his order wins.

---

## ⛔ STEP 0 — #5866 MUST BE MERGED BEFORE YOU BRANCH

`claude/one-word-snippet` (the *snippet* copy rename) touches **nine files you will also edit**,
including `page.tsx`, `papic-gallery-grid.tsx`, `add-to-library.tsx`, `uploads-open-choice.tsx`,
`moderation/page.tsx` and `lib/papic-tier-copy.ts`.

    gh pr view 5866 --json state --jq .state     # must print MERGED

If it has not merged, **wait** — it is minutes away, and branching early buys you a conflict in
every file that matters. If you must start, `git merge origin/main` the moment it lands and before
you take any sabotage backups (BUNDLE-COMMON sequence rule 2).

🔑 **A grep cannot predict a merge conflict — run the merge.** Symbol-diffing two branches has said
"no overlap" here before and the trial merge found one.

---

## 🚫 OUT OF BOUNDS — another session owns these RIGHT NOW

`lib/papic-window.ts` · `papic-window-picker.tsx` · anything about when capture starts or ends.
A separate session is building `CTRL-PAPIC-WINDOW.md` (capture runs until lunch the next day).

**You still RE-ORDER the Coverage block and RENAME its heading** — that is layout, in `page.tsx`.
You do not touch the picker's internals or the window rules. If a change pulls you inside that
component, stop and report it (BUNDLE-COMMON rule 4).

---

## P1 · The spine — order, names, and the two interaction rules

**Order (owner, 2026-09-22), both phases.** Before: **Credits + running balance → Coverage →
Allotment → Filter → Challenges → Live wall → Gallery → Kwento → Made for you → More.** After the
day: **Gallery → Kwento → Made for you → Live wall → Credits → Allotment → Filter → Challenges →
Coverage → More**, with the setup blocks folded to one line each.

- "Guests' shots" is **Allotment**. The capture window block is **Coverage**.
- **Live wall moves UP**, above the gallery: it is a setup job (pick a style, get the screen code)
  that was sitting below the results it helps produce.
- ⚠ **Money now sits ABOVE the two blocks that size it.** That inversion is deliberate and it is
  only safe while the recommendation RECOMPUTES as coverage and allotment change. **If it ever
  stops recomputing, this order becomes a trap** — wire it live or say you could not.

**Two rules that outlive this page:**
1. *"set the toggles here if it only needs toggle switches"* — a row whose sheet holds ONE switch
   carries the switch on the row. Applies to **Finding people** and **Guests add by hand**.
   **Blurred faces and Google Drive KEEP their panels** — one is a report the couple cannot set,
   the other is an OAuth connect. Neither is a switch.
2. *"don't make it jump"* — **a control that collapses when switched off moves every block below
   it.** Steppers stay and go quiet (dimmed, inert, "No limit" / "No minimum" where the number
   was); warnings are reserved lines. 🔑 **`hidden` is a layout event.** The only legitimate
   collapses are mode changes (the "do this first" card folding once dates are saved) and a
   component that genuinely renders nothing.

**Also:** Google Drive signs in on the tap — no page in front of one action. Disconnecting keeps
its confirmation.

---

## P2 · A floor per guest, and the end of dedicated credits

**Two owner rulings, one commit. This one REMOVES shipped functionality — read the scope back in
the PR body.**

**a · The minimum.** `papic_guest_spend_ceilings.ceiling_points` is a **ceiling only**, so nothing
today guarantees a guest anything. Add the floor. **A floor is a PROMISE, so it must be payable:**
check `min × guest_count` against the pool and say how many credits short they are. **A floor can
never exceed the ceiling.**

**b · No camera holds credits of its own.** Owner chose the **2026-09-16** ruling (*"no dedicated
shots individually"*) over **2026-08-11** (*"the host can dedicate a specific number of shots for a
specific QR code"*), which is why `PapicCamerasCard` exists. **Retire the card and
`papic_dedicate_shots`.**
🔑 **The page already says both things at once** — the Crew-cameras sheet reads *"Every shot draws
from your shared credits"* while that card, four blocks below, hands credits to one QR.
⚠ **`paparazzi_seats` STAYS. A seat is the camera CLAIM, not an allowance** — 24 rows live, and
`app/api/upload/route.ts` resolves a `seatGate` per seat. Only the DEDICATION goes.

---

## P3 · Make what exists reachable

Nothing new is invented here; three shipped things are simply unreachable or absent.

- **All 631 challenges.** `papic_challenge_library` holds **631 prompts in 12 categories**; the
  couple's picker must offer categories + search. Show **how many celebrations picked each prompt**
  (`count(distinct event_id) from papic_missions where library_id = …`). ⚠ **72 picks across FIVE
  celebrations** — so the count is a FACT on the row, **never a ranking**, and **a count of 0
  renders as nothing**, because an absence of data must not read as a verdict on a prompt.
- **Guest search in the allotment picker.** `GuestAllotmentPicker` already ships the search box and
  the stable named-first partition (`orderAllotmentPickerRows`). **Use them — do not re-draw.**
  The couple does not add guests here; the list is the guest list, and the panel says so.
- **The recommendation, on this page.** `lib/papic-credit-estimate.ts` already computes it from
  `papic_event_pool_config`: `clamp(guests × points_per_guest, floor, ceiling)`. Put it **on the
  credits block**, showing its own arithmetic.

  🛑 **IT IS ADVICE AND MUST STAY ADVICE.** Verified 2026-09-22: `papicCreditVerdict` has ONE caller
  and gates nothing. **The recommendation may never disable a control, never render as an error,
  and never stand between a couple and a purchase of any size.** A couple who wants 100 credits for
  a 200-guest wedding gets 100 credits. ⚠ **Do not confuse this with the per-guest MINIMUM in P2,
  which IS enforced** — that is a promise to a *guest* about what they may spend, not advice to the
  *couple* about what to buy.
  ⓸ **Event type is the missing dimension:** that table is a SINGLETON (`config_key='default'`), so
  a christening, a debut and a wedding are all quoted 150/head. **Build the dimension — one row per
  event TYPE (17), admin-editable.** Owner CONFIRMED the seed values on 2026-09-22. Use exactly
  these — do not re-derive them, and do not leave a type out:

  | 150 | 120 | 90 | 80 | 70 | 60 | 50 |
  |---|---|---|---|---|---|---|
  | wedding, travel | debut | birthday, reunion | gala_night, anniversary | christening | corporate, tournament, graduation, celebration | gender_reveal, wake, simple_event, date, hangout |

  All 17 `event_type_vocab` rows are covered, so there is no default-to-something gap.
  **Wedding is UNCHANGED at 150** — 9 of the 11 live events are weddings. That is this build's
  acceptance test: **seed the table, then prove a live wedding's recommendation is byte-identical
  before and after.**

  🛑 **EACH ROW CARRIES floor_points AND ceiling_points TOO, NOT JUST points_per_guest.** The
  formula is `clamp(guests × per_head, floor, ceiling)` and today's floor is **5,000** — so a
  2-guest date × 50 = 100 clamps **UP to 5,000** (₱3,360 recommended for a dinner for two), and a
  30-guest christening × 70 = 2,100 does the same. **A single global floor makes every small event
  type absurd.** This is the part that would have shipped broken.

  ✅ **SETTLED 2026-09-22 — `floor_points` = 0 for ALL 17 TYPES, wedding included.** Owner: *"just
  a recommendation and not a requirement okay?"* **A floor is precisely the mechanism that turns
  advice into a requirement** — it clamps the suggestion UP regardless of what the event needs,
  which is how a 2-guest date came to be told 5,000 credits. `ceiling_points` stays at 30,000: it
  caps the suggestion DOWNWARD, which cannot coerce anybody.

---

## P3b · The recommendation LEARNS — and the naive loop is wrong twice

Owner: *"we will set the initial value. then create an average depending on the total credits used
on actual events."* Build the mechanism; it starts dormant.

🛑 **TRAP 1 — THERE IS NO DATA YET.** Measured 2026-09-22: **9 weddings hold 100,362 credits GRANTED
and ONE credit USED** (date 21/55 · simple_event 1/55). An average over that recommends ~0 per head
and **collapses the number to nothing**. Require a minimum sample per type before the learned value
overrides the owner's initial, keep the initial as the fallback, and **show on the admin screen
which of the two is in force** — a learned number that silently replaced a set one is unreviewable.

🛑 **TRAP 2 — USAGE MEASURES SUPPLY, NOT DEMAND.** An event that spent its whole pool might have
wanted twice as much. Averaging raw usage **spirals downward**: recommend less → they buy less →
they use less → recommend less again. **Only average events that did NOT exhaust their pool** —
those are the uncensored observations. An exhausted event is evidence of *"wanted ≥ X"* and may
push the number **UP, never down**. Only count events whose capture window has CLOSED.

🔑 Both traps are invisible in a test with generous fixtures. **Write the fixture that exhausts a
pool and prove the average does not fall.**

## P4 · Blur one face, not every face — **the cut line**

Owner: *"face blocking is when users want to keep their faces blocked from other photos that is
face tagged to them… while the owner of the event still get everything with no blur."*

The couple's half already ships (ruling 2026-08-17) and so does the guest's own switch
(`app/[slug]/actions.ts` is the only writer of `guests.faceblock_enabled`). **Two things do not
match the ruling:** `lib/face-blur.ts` blurs **every detected face**, and
`editorial/consent-veto.ts` applies it **EVENT-WIDE** — *"One live guest with `faceblock_enabled`
means every capture on that event needs a blur."* **So one guest's choice blurs all 145 others.**

Bind each detected box to a tagged identity (`photo_tags`) and blur only opted-in boxes. **That
makes face tagging a hard precondition** — with it off there is no way to know whose face is whose,
and the screen must say so rather than silently degrade.

⚠ **Fail CLOSED.** `face-blur.ts` is deliberately fail-closed because it protects a privacy
promise; a per-person path must not soften that. **If you cannot resolve which box is whose, blur
them all** — never none.

---

## Definition of done

1. Every control on the live page still exists. **Nothing is removed to remove its text** — the
   only deliberate removal is `PapicCamerasCard` (P2b), and it is named in the PR body.
2. `git diff --stat origin/main...HEAD` read file by file before pushing (BUNDLE-COMMON rule 5).
3. Each build's guard **sabotaged once** and seen to go red with a readable message.
4. Screenshots at **375px and 1440px**, both phases.

**Your final message must end with:**
`CONTROLLER ▸ PAPIC-REDESIGN · <DONE|PARTIAL|BLOCKED> · PR #<n> <state> · builds landed: <list> · dropped: <list>`

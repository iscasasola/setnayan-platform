## 2026-10-25 · feat(rsvp): the reply says the seats first — Seats → You → +1s → tagging → the rest

Owner, verbatim, 2026-10-25: *"We reserved one seat for you · We reserved two seats for you · Then a screen where
they confirm their name and their nickname and contact number then their plus seat"* — approved prototype
`Setnayan/prototypes/rsvp_seats_2026-10-25/index.html`, every open question "all as recommended".

- **Seats step (new)** after "Joyfully accepts": "We reserved N seats for you" (N includes the guest), one tile per
  seat — You · +1 · +2 — and one line with the rest in its ⓘ (`rsvp-seats.tsx`, words in `lib/rsvp-seats-words.ts`).
- **You step**: the guest's name READ-ONLY ("You're Teresita Aquino") with **"Wrong name? Tell the couple"** — a small
  sheet whose text rides with the reply as `name_correction` and is added to `guests.guest_note` as one
  "Name correction: …" line, even when the note question is off (`lib/rsvp-you-step.ts` `withNameCorrection`). Names
  stay host-only (2026-08-01). Then "What should we call you?" and Mobile — the contact boxes moved up from the end.
- **+1 step** keeps its boxes, writes and "Filling in for" picker; its line now names the seats ("+1 and +2 · name
  them…"), the count line and the summary line under the picker are gone. A seat list that failed to read says so
  honestly, claims no count and offers one box (scenario E).
- **Tagging** moves after the seat steps. **Decline path unchanged**: a No still meets answer → note → contact →
  Send; its contact boxes post as `declined_contact_*` and `submitRsvp` reads them back (`adoptDeclinedContactArm`).
- **After Send**: the default heading is **"You're on the list."** (a couple's own "After they submit" words still
  win); the ticket, then **Save all tickets** and the Apple Wallet slot together directly under it (marked for PR
  #6548's `AppleWalletButton`, `data-landing-wallet-slot`, not imported until it merges), then each +1 listed BELOW
  them — the owner-approved order (2026-10-25), pinned on the page and its lab by test § 6b (seen red with the +1
  list moved back above Save).
- Lab: `/dev/maker-lab/guest?rsvp=form&door=1` now passes `plus_one_seats` like the real loaders (`&seats=fail` walks
  the failed read); `?rsvp=thanks&guest=1&plus=<n>` draws the +1 list.
- No migration, +0 exported server actions (inside `submitRsvp`), no new client deps.
- Guard: `the-reply-says-the-seats-first.test.ts` (seen red with the tagging step moved back before Seats). Golden
  `the-reply-card-is-todays-page.golden.json` re-recorded via `RECORD_REPLY_CARD=1`.

SPEC IMPACT: DECISION_LOG.md row "THE RSVP SAYS THE SEATS FIRST" (2026-10-25) — the reply order, the read-only name +
"Wrong name? Tell the couple" → `guest_note`, "+1 / +2" naming, "You're on the list." default, +1 Wallet from their own link.

## 2026-11-16 · feat(verify): papers renewal — what a supplier, a couple and the admin see as 30 March comes and goes

Builds the approved design `Setnayan-specs/prototypes/supplier_papers_renewal_2026-11-14_fable.html` (DECISION_LOG
2026-11-14 "designs APPROVED") with the four renewal picks ruled the same day ("Fable's picks taken"). Extends the
shipped one renewal day (#7535), one upload place (#7624) and three papers (#7627) — nothing re-drawn.

- **§1 · Today** (`PapersRenewalLine`, one notice system): 60 and 30 days → a to-do with Not now; 7 days → a live band,
  warning, no close word. Counted in Manila calendar days (29 Jan = 60 days). It replaces Today's old "Business permit
  expires in N days" row (`permitNeed` and its read are gone — one fact, said once).
- **§2 · the day after**: a live band, problem tone, no close word, with this shop's own numbers behind the ⓘ.
- **§3 · the verification page**: a renewal draft KEEPS last year's papers that are still good (file + sealed read,
  `seedRenewalDraft`), so the rows say "Still good · valid until …", the ended one says "Ended 31 Dec 2026 — upload this
  year's", the count reads "2 of 3 still good" and the button "Upload this year's permit". Once all three are in and
  clean the page presses the same Submit itself (one tap). State card on top: Free · Unverified / Waiting for Setnayan /
  You're verified · Next renewal.
- **§4 · couples**: a lapsed shop that was verified shows the calm page (no hero, no badge) and "Renewing their papers
  with Setnayan" (ruling 4) in place of "not verified yet".
- **§5 · admin**: Suppliers › Renewals filter (Free · Unverified · Due in 7 days · Renewed; state · why · papers) and a
  Renewal fold on the shop record (why, verified window, bookings that carry on, papers, every reminder sent). Read-only.
- **§6 · restored**: one news line "You're verified again — new couples can find you" (Got it).
- **Ruling (2)**: a PAID plan's unused days wait — the lapse drops it to Free with its days left in its own audit row;
  the approval gives the plan back with the same days, counted from the renewal.
- **Ruling (1)** stays pinned (`papers-lapse.test.ts`); **(3)** tested: the lapse tells the shop only.
- ⚠ One word differs from the drawing on purpose: it says a lapsed shop "can't take new bookings"; DECISION_LOG
  481b9b6b and 15 Nov "UNVERIFIED SHOPS … BOOKABLE NOW" make that untrue, so every line says "can't find you".
- Tests: `lib/papers-renewal.test.ts` (one per rule).

SPEC IMPACT: None — builds the approved prototype; the "find, not book" wording is flagged to the owner in the PR.

- **Guard fix (16 Nov):** `lib/no-door-out-of-the-app.test.ts` lists `app/dev/papers-renewal-lab/` among the
  staff/shop-own trees, like every other dev lab. The lab page is a route entry that draws the admin Renewals screens,
  so the walk reached `lib/verification-checks-server.ts` from it. The earlier note that this guard "fails on main" was
  wrong: it was this PR's new lab.

- **The renewing line reaches every place a couple deals with the shop (owner 16 Nov, "9.yes 10.yes 11.yes").** The
  lapse keeps `verification_state = 'verified'` and only stamps `papers_lapsed_at`, so the state-only test drew NO line
  for a lapsed shop in chat, the event's supplier list or the Book confirm. One test now decides which line
  (`shopVerifiedNote` in `lib/findable-shop.ts`: not verified · renewing · nothing, never from an absence), every read
  adds the generated `papers_current`, and the shipped `NotYetVerifiedThreadLine` takes `renewing` to show "Renewing
  their papers with Setnayan" ALONE, the shop page's long line behind its ⓘ. Wired: the chat head and its quote card's
  Book · the proposal's Book · the Suppliers cards, quick-view and bench Book · the booked and waiting rows. Guard:
  `lib/every-couple-surface-says-not-yet-verified.test.ts` (mutation-checked). Kept: "new couples can't find you".

- **FIX-FIRST round (controller audit, 16 Nov):**
  - The reminder windows are READ off `BADGE_REMINDER_STAGES` (`renewalStage`, the "Due in N days" chip and the admin
    list's week window); the list's two-week window is `RENEWED_NEWS_DAYS`; the "tries" copy reads `MAX_TRIES`.
  - A renewal draft never invents `<last year>-12-31`: a permit with no read end date says "End date not on file", and
    so does the admin's papers line (was "ended last year").
  - "Waiting for Setnayan" says what happened: "couldn't read it after 3 tries" only for papers actually typed by hand
    (`handTypedSlots` on the waiting application); otherwise "A person will look over your papers".
  - The admin Renewals list says "Couldn't load" when the applications read fails (was "Renewed · 0"), and "200+" with
    a line past its cap (was a silent `.limit(200)`).
  - The admin Renewal fold gains the drawn "Asks from before" row and the two doors, "Open the papers" (the
    verification queue) and "Message the shop" (its contact email, drawn only when one is on file). Today passes the
    real `asksBefore` (`countAsksBefore`: booking asks still waiting on the shop, from before the lapse).
  - A PAID plan is `isTierAtLeast(tier, 'solo')` on the one tier ladder, not a typed set.
- **#7793 leftovers:** the dead VALIDATE contact settings are gone (Business identity rows, the Settings form, its
  save, the Switches line, `fetchVendorValidateContacts`; the two columns stay, unread). A failed claim of the number
  read off the DTI/SEC paper is written as an audit row and the admin's registration check says "Claim failed"
  (`readRegistrationClaimFailures`) instead of only logging it.

### Opus review fixes (2026-11-18, wave 4)
- Merged with #7793 and origin/main. The shop page keeps main's Awards row; a lapsed shop's Verified award stays hidden (`&& !renewing`).
- The Today side pane's "Setnayan Verified" row imported `PERMIT_PAPERS_HREF`, which this PR deleted. It is now pointed at `RENEW_PAPERS_HREF` (same address), so the typecheck builds again.
- 💸 Re-approval stops, and writes nothing, when the held-plan read fails. Before, a failed read approved anyway and a Plus/Pro shop's held days were lost for good. The failure is logged with `logQueryError`.
- The admin Renewals list fetches one extra day, so a shop 7 Manila calendar days out lands in "Due in 7 days". A shop's record shows its newest 40 reminders, not its oldest.
- "Your 0 bookings carry on" now reads "Your bookings carry on".
- The drop-function migration moves to the forward prefix `20271350627144`. It was never applied.

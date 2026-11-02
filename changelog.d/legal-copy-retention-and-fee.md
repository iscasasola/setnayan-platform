## 2026-08-07 · docs(legal): the live privacy notice promised 5 years of photos; the code deletes originals at 6 months

**Opened, NOT auto-merged.** Public legal copy published in the owner's name as DPO — his to read and merge, per the standing rule and the 2026-07-31 precedent (#3946, which he merged on 2026-08-04).

**1 · Photos and video.** The live notice said *"kept for 5 years after the event date, then purged… they stay instantly available for the first 90 days and move to cheaper cold storage after that."* The code drops full-resolution originals at **6 months**. Wrong in the most dangerous direction: a couple reads it, relaxes, downloads nothing, and loses the good version of their wedding.

🚨 **The canonical schedule was ALREADY correct** — its media row was fixed on 2026-08-02 (full-res 6 months → compressed copy retained indefinitely; window 3 mo → 6 mo). Only the notice was stale, for five days.

🔑 **THE COMMENT ABOVE THAT BLOCK IS WHY.** It says *"Every figure here is that schedule, verbatim — do not edit one without editing the other."* **That is an instruction, not a mechanism.** One side was edited; the other was not; nothing failed. Same shape as [[feedback_a_guard_comparing_two_hand_typed_things]].

⚠ **The anchor differs and the CODE is authority.** The sweep runs 6 months from the event's **first capture** (an engagement shoot starts it), floored at 30 days after the event date. The schedule row still says `event_date`. The notice now states the behaviour, not the schedule.

**2 · Face-recognition data — the media correction silently broke the row beneath it.** Both the schedule and the notice said face vectors are *"purged together with that event's photos."* Media is now retained indefinitely, so that promised a purge **that will never happen**. Verified: nothing in the codebase deletes a face vector on a schedule — only erasure-on-request does. Both now say exactly that and claim no automatic end date.

⛔ **Deliberately NOT decided here:** whether an automatic end date is *required* under the RA 10173 storage-limitation principle. That is a DPO call, flagged to the owner, not answered in code — and the schedule's own maximum-retention row warns that indefinite retention of personal data is itself a violation.

**3 · The booking-fee disclosure the owner ruled was owed** (2026-08-06: *"a disclosure is owed; legal copy so it is OPENED, never auto-merged"*). `/pricing` said *"No commission on vendor bookings, no hidden fees"* — and that page **also sells vendor plans**, so a vendor read the pair as *"Setnayan charges me nothing."* **"0% commission" is CORRECT and stays** (the couple pays the vendor directly; Setnayan never touches that money). The fee is charged to the **vendor** for the introduction + in-app sync, so both are true at once — but only if the second is actually said.

🔑 **Timed deliberately: written BEFORE the fee is switched on.** `booking_fee_charges` is **0 rows** — nothing has ever been charged — so a vendor never reads "no hidden fees" on Monday and gets a fee on Tuesday.

⏭ **Flagged, not changed:** the vendor home overlay still reads *"Get found, get booked, keep 100%"* / *"0% commission — keep 100% of every sale."* Strictly true (they keep 100% of what the couple pays) but it will *feel* untrue once the fee runs. Left alone on purpose — that is front-page positioning the owner is already reviewing separately in #4186.

Corpus updated in the same change: `Data_Retention_Schedule_2026-07-11.md` face row.

SPEC IMPACT: `Data_Retention_Schedule_2026-07-11.md` — face-vector row corrected; the open DPO question recorded rather than silently resolved.

## 2026-08-28 · fix(onboarding): the day chips move the calendar, and the details screen stops re-asking

Owner, walking his own birthday: *"picking on the day and the saturday after does
not change anything on the calendar. is that correct?"* and *"some of these were
answered already like, Celebrant, Turning, what kind of milestone (40)."*

**The date screen had two answers to one question and committed the wrong one.**
The chips wrote `dateValue`; the calendar and the commit both read
`dateCandidates` whenever it had anything in it. After one tap on the calendar
the chips wrote to a field nothing downstream read — the chip lit, the calendar
sat still, and the day that got SAVED was the one the chip did not name. Broken
twice over: `DateCalendar` seeded its selection from props once, so even a
correct write would have been ignored. Both halves fixed; the three copies of
"which days" collapse onto one `celebrationDates`.

**The details screen re-asked celebrant, age and milestone.** The machinery for
this exists and is unreachable — it rides `onboardingV2BriefEnabled()`, which is
fail-closed and OFF, so that half of the 2026-08-20 fix has never run in
production. The seeding goes around the flag, as the age fix already does.
`birthdayMilestoneFromAge` is new and deliberately separate from its sibling: the
two questions use two vocabularies, and a 21st returns null because no rung can
name it truthfully.

**And the paid Setnayan AI card said "never sleeps", which is false** — the guard
sweep is visit-driven and throttled to 6h; this project has no scheduler. The
`demand` row also promised "it tells you" with no notification path anywhere;
what ships is a marker on the vendor list. Both corrected while shortening every
capability body at the owner's request.

SPEC IMPACT: None — no locked decision, price or SKU moves.

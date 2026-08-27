## 2026-08-28 · feat(event-hub): a shop's granted teammate can open the desk

**Owner ruling 2026-08-27, built as given.** *"the staff who handles the event
will handle the event fully but the vendor owner also has access to oversight all
their business."* With 2026-08-26's *"the ones they were given"*, that is exactly
two ways in: **runs the shop** (owner or top team role) → every booking of that
shop; **granted for this celebration** (a live `vendor_event_access_grants` row)
→ that one celebration. A teammate at `agent`/`viewer` with no grant is refused.

🔴 **WHAT IT WAS.** `loadVendorBooking` resolved the caller's shops with one
query — `vendor_profiles.user_id = <viewer>` — the shop's registered owner and
nobody else. Its own comment said *"owns or administers"*; the query only ever
asked the first. So a photographer's second shooter was turned away from the
celebration their own shop is booked for, while the shop's day-of console
(`fetchOwnVendorProfile` member path) and `get_vendor_event_brief` (profile owner
UNION `vendor_team_members`) had admitted them all along. **The narrow copy was
the one deciding the celebration page.**

⚖ **THE WIDENING IS NAMED, NOT DISCOVERED LATER — AND IT IS SAID ON SCREEN.**
That one question feeds four surfaces, and all four widen together: the private
event's lock screen · the shared gate the seven sub-pages ask · the print
keepsake · and `resolveVendorCapability`, which is `belongsToThisEvent` — the
single boolean gating a keepsake story the host restricted to "the people of this
celebration". The owner was offered the careful version (staff work the day
without becoming one of its people) and **declined it**. So the host is now told,
on the screen where they pick that audience, that the shops they booked come with
the staff those shops send — in both places that choice is offered (the
celebration story and a Storyteller chapter), worded identically and guarded
against each other.

🔢 **SAFE BY ARITHMETIC AT THE MERGE.** Production holds 2 shops · 1 team row ·
**0 teammates who are not the shop's own owner** · **0 grants, ever** · 45
`event_vendors` rows with **0 linked shop profiles**. Nobody gains anything
today; the arm starts working on the first real grant.

⚠ **FOUND AND DELIBERATELY NOT FIXED:** the shop's own day-of console and
`get_vendor_event_brief` admit **any** teammate at **any** role with **no** grant,
so they are wider than this desk. Narrowing a live read is its own change and its
own owner question; recorded here rather than done in passing.

🛡 `lib/staff-get-both.test.ts` — 11 assertions, **8 mutations, all RED**, each
printed before → after: rule always-true · agent treated as a top role · the
grant read removed · `.is('revoked_at', null)` removed · `.eq('event_id', …)`
removed · the owner-only narrowing restored · either audience note reverted to
the old wording.

SPEC IMPACT: `DECISION_LOG.md` (2026-08-28 row) · `CLAUDE.md` ACTIVE block ·
`SESSION_PROMPTS_HUB1_4_2026-08-28.md` (hub4 done) ·
`EVENT_HUB_UNISON_2026-08-28.md` (§ 6 item 4 and § 7 decision 1 close).

## 2026-08-21 · feat(calendar): one link, and their calendar keeps itself up to date

Owner 2026-08-21: *"can we allow their events to auto sync to their calendar?
google calendar / apple calendar?"* … *"it can be a general add to calendar and
the device will pick which calendar"*.

**Add to my calendar** on My Events hands over a `webcal:` subscription link.
The device opens whichever calendar it uses, and from then on **the calendar
re-reads the feed itself** — move a date in Setnayan and it moves in their phone.

- 🔑 **A SUBSCRIPTION, NOT A DOWNLOAD.** Every calendar feature that ships today
  (`buildWeddingIcs`, the save-the-date button, the vendor / appointment /
  budget `.ics` routes) hands over a COPY taken once. Move the wedding
  afterwards and the copy in somebody's phone is silently wrong — worse than
  never offering it.
- 🔑 **AND NOT THE GOOGLE CALENDAR API.** Apple Calendar has no write API at
  all, so that route serves one of the two stores the owner named and still
  needs a feed for the other. It also needs a THIRD reviewed Google scope on an
  account already carrying two that Google refuses to issue together
  (`google-oauth-scope-conflict.test.ts`).
- ⚠ **THE URL IS THE CREDENTIAL** — a calendar client cannot log in. 32 random
  bytes; **one live link per person enforced by a partial UNIQUE index**;
  "reset my link" mints a new row and KEEPS the old one revoked, because
  deleting it would let the same string be minted again. The feed answers **404
  for every refusal** so a revoked token is not distinguishable from a bogus
  one, and never echoes the token into a log.
- ⚠ **A FAILED READ RETURNS 404, NOT AN EMPTY FEED.** A calendar MIRRORS a feed;
  an empty one tells it every celebration was cancelled and it deletes them all
  from the phone over a transient blip.
- 🚨 **ONE DEPARTURE FROM THE INSTRUCTION, NAMED NOT HIDDEN.** The owner named
  Planning and Now happening. Celebrations that already happened are kept in the
  feed anyway, for the same reason: dropping an entry DELETES it from their
  phone, so a wedding would vanish out of the couple's own calendar the morning
  after. Put-away celebrations ARE dropped — same rule as every shelf.
- ⚠ **THE RUN-OF-SHOW IS DELIBERATELY NOT IN IT YET.**
  `event_schedule_blocks.start_at` stores the VENUE'S WALL CLOCK in a UTC column
  (prod: `Ceremony 14:00+00`), so emitting it as an instant puts every ceremony
  eight hours out — the defect that shipped to nine surfaces in August. Doing it
  properly means `TZID` local times off the venue timezone: its own slice.
- Every entry is `VALUE=DATE`, never an instant — a DATE needs a timezone to
  become a timestamp, and that is the 12-December-reads-as-11-December bug.

Guards: `lib/calendar-feed.test.ts` (14, green under UTC · Asia/Manila ·
America/New_York · Pacific/Kiritimati) and
`tests/db/one-link-loads-their-calendar.db.test.ts` (5).
**Ten mutations, each verified to LAND by occurrence count, each red.**
🪤 Three of them (`DTEND` exclusive, all-day → instant, comma escaping) reported
GREEN on the first run **because the `perl` substitution never applied** —
occurrences 1 → 1. Re-run through Python: 1 → 0, and all three red. *An
unmeasured mutation proves nothing.*
🪤 And the db tests were written without `SET ROLE authenticated`, so they would
have passed **whatever the policies said** — the replay connects as superuser
and bypasses RLS entirely.

SPEC IMPACT: DECISION_LOG.md row 2026-08-21 (calendar subscription: webcal feed,
one live token per person, past celebrations retained, run-of-show deferred).

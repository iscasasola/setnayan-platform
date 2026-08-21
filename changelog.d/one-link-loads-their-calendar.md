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

### The privacy guards caught the new table, and they were right to

`calendar_feed_tokens` is now classified in BOTH RA 10173 registers — CI refused
the PR until it was:

- **Erasure — `OWN_ROW_DELETES` (deleted outright).** The row is a live
  CREDENTIAL: the feed serves whoever holds the token, with no login, so a row
  left behind after an erasure request is a URL that keeps answering with that
  person's celebrations. The FK is `ON DELETE CASCADE`, which covers a hard
  account delete; this covers the ERASURE path, which purges **without** deleting
  the auth row — the two are not the same journey.
- **Export — `DELIBERATE_EXCLUSIONS` (never exported).** 🔑 **PUTTING A LIVE
  ACCESS KEY IN A DOWNLOADABLE EXPORT TURNS A PRIVACY RIGHT INTO A DISCLOSURE
  RISK.** Nothing else in the row is information about the person — a creation
  time, a last-read time, a revocation time, all facts about the LINK — and the
  celebrations the feed describes are already exported in full from `events` and
  `event_members`. The subject can see and reset the link on My Events, which is
  where that right belongs.

### The exposure freeze found a real one: the table arrived open to strangers

🚨 **A NEW TABLE IN `public` IS REACHABLE THE MOMENT IT EXISTS.** The default ACL
handed `anon` — a signed-out stranger — SELECT/INSERT/UPDATE/**DELETE** on a
table full of credentials. RLS refused them (every policy needs `auth.uid()`),
so nothing was reachable in practice.

🔑 **REVOKED, NOT BASELINED. RLS IS THE LOCK; THE GRANT IS WHETHER THERE IS A
DOOR AT ALL** — and a door nobody needs is one more thing that must keep being
locked correctly forever. A future `USING` clause widened by accident is only a
vulnerability if the grant underneath it survived. Recording it instead would
have written *"a stranger may write to the credential table"* into the very file
whose job is to make widenings visible. **A BASELINE IS A BILL, NOT A DECISION.**

`authenticated` keeps the three verbs its policies scope and loses DELETE —
destroying the row is how a revoked token becomes mintable again.

**M20** (put the stranger grant back) → exposure freeze **RED**. The feature's
own tests stay green either way, which is the point: the guard that catches this
is not the one that tests the feature.

Also regenerated in the same PR: `user-fk-behaviour.generated.txt`, one line —
`calendar_feed_tokens.user_id CASCADE NOT NULL` — which agrees with the erasure
decision above (CASCADE + NOT NULL means the row is ABOUT them, so it is deleted
rather than detached).

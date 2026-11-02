## 2026-09-08 · fix(inquiry): the card shows what the 2026-07-15 ruling already grants

The first inquiry this platform has ever received arrived — `chat_threads`
0 → 1 — and four things about it were wrong.

### 1 · The card withheld two of the six granted fields

Owner: *"i cannot see all the information I need from the inquiry."* Then:
*"we already discussed what information to share for every inquiry."* He was
right — **DECISION_LOG 2026-07-15**, owner-locked:

> *"Pre-accept a vendor sees the JOB (event type · date · city/area ·
> **guest/budget bands** · category · **couple's message text**) but NOT WHO the
> couple is."*

The dashboard card showed four of six. It withheld `pax_at_inquiry = 230` — which
was already on the thread it was built from — and the couple's own words, *"Could
you share your rates and what's included?"* The thread page had been honouring
the ruling in full the whole time, so the two surfaces disagreed about what a
supplier may see. Both now on the card, message **quoted, never summarised**;
`place` also stopped printing twice.

The guard asserts BOTH halves — the same ruling forbids identity pre-accept, and
a test that only pushed for "more information" would wave a display name through.

### 2 · One wedding day, three renderings

Owner: *"it should be December 18, 2026."* One screen showed `2026-12-18`,
`18 Dec.` and a third form. `formatLongDate` already existed and produced exactly
that — buried in `lib/paperwork.ts`, which is why five screens had rolled their
own. Moved to `lib/format-date.ts`; **a home decides whether something gets
reused.** Parsed as LOCAL midnight, so the day cannot shift west of Greenwich.

### 3 · A shortlisted supplier filed under `misc`

Owner: *"the service cards is not there on the shortlist since i pressed
inquire."* The row existed — `category: 'misc'` — while the bench's Live Band row
looks for `live_band`. `coerceCategory` called `resolveVendorCategory`, whose own
docblock says: *"Do NOT reach for it to classify an arbitrary service — 194 live
leaves land in `misc` here. Use `vendorCategoryForLeaf`."* Owner had already ruled
the symptom out on 2026-08-09: *"we do not like having categories under misc."*
Measured after the switch: `live_band → band_dj`, `host_mc → host_emcee`,
`cake → cake_maker`, `florist → florist`.

### 4 · Accept refuses because the shop has no team row

`unlock_vendor_event_free` gates on `vendor_team_members`; Saysay has none, so
`fail()` redirects with `?error=1&msg=Could not accept right now` — which the
owner reproduced. **Two records say "this shop is mine"** and only one was
written. Backfill included.

⛔ **The backfill is ALL it is, and that is the finding.** The first draft added an
AFTER INSERT trigger "to keep it true". Measured with that trigger deliberately
disabled (`pg_trigger.tgtype = 17`), a direct insert **still** got its owner row —
an existing mechanism already does this. The trigger would have been a second
definition of a rule that already holds: the same shape as the bugs above. What
is missing is HISTORY — this shop predates that mechanism.

Two of my own tests were removed for the same reason: one passed with its subject
disabled, and one asserted against a rule the schema enforces more strictly than
I did. **A test that passes with its subject removed is not evidence.**

SPEC IMPACT: None — implements a 2026-07-15 decision the card had drifted below.

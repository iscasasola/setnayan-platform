## 2026-08-25 · feat(vendors): the supplier keeps the clock, the couple keeps the words

Owner, 2026-08-24: **keep the clock, throw away the words.**

"Usually responds in 2h" is a **public** badge on every marketplace card, and the
supplier's response rate and median reply time sit behind it. All three are
computed from `chat_threads` — `NOT NULL` on `event_id`, `CASCADE` — so a couple
deleting their celebration silently erased part of a supplier's reputation.
Measured against prod in a rolled-back transaction: **threads 1 → 0, replied 1 → 0.**

⚖ The classification calls this *"the one most likely to be got wrong in both
directions at once"*: sparing the table to save a statistic would hand the
supplier the couple's private negotiation forever — their budget, their guest
count, what they said about other suppliers, and the agreed price.

**So the number is preserved without the conversation.** Three timing facts per
thread — when the couple asked, when the supplier answered, whether it was
accepted — are copied to a vendor-keyed row with **no foreign key to events**, at
the only moment they can still be read. The messages go with the celebration.

⛔ **Deliberately not copied, none of it an oversight:** message text · the
couple's identity · the event id · pax · agreed price · decline reason · compat
reasons. A row here can answer *"how fast does this supplier reply"* and nothing
else — and a test asserts that by name, so smuggling one in fails.

🔑 The precedent is `vendor_spotlight_awards`, which the classification names as
*"the precedent the other twelve should copy"*: criteria computed from cascading
tables, **verdict** snapshotted onto a vendor-keyed row.

The recompute folds the preserved rows into the **same list** as the live threads
rather than adding a second code path — the rate, the median and the sample size
are three readings of one set, and a second path is how two of them start
disagreeing. `was_accepted` is frozen from the same `inquiry_status = 'accepted'`
test the live side uses, so a preserved conversation and a live one answer the
same question the same way.

🚨 A new table is **born readable and writable by the public internet** (prod's
default privileges), so the grants are revoked explicitly — the exposure surface
does not move at all as a result.

Migration `20271165415974`. 4 db tests; 3 mutations, each measured by occurrence
count — including one that smuggles the couple's identity into the kept row and
is caught. Prod dry-run rolled back: clock kept, conversation gone, 60-minute
reply preserved, table reachable only by the service role. Full db suite
1551/1551. Prod holds **0 threads**, so nothing is migrated.

SPEC IMPACT: `DECISION_LOG.md` — owner ruling 2026-08-24.

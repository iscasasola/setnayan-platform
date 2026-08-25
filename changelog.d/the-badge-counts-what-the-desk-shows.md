## 2026-08-25 · fix(admin): the badge counts what its own desk shows, and the Overview shows what it counts

Found because the owner sent a screenshot of `/admin` reading all zeros and asked
why nothing was showing up. The zeros were honest. What sat above them was not.

**MEASURED IN PRODUCTION, not read off a brief:**

- `event_vendors.completion_status` **DEFAULTS to `'awaiting_vendor'` and is NOT
  NULL**, so the `completions` filter matched every row ever inserted.
  **Badge 45 · desk 1.** `/admin/completions` has always applied a second cut
  needing the CELEBRATION DATE (14+ days past); the badge, added 2026-08-19,
  applied only the first half — while its own comment claimed it *"mirrors
  /admin/completions exactly"*.
- **44 of those 45 were weddings 109 and 115 days in the FUTURE.** Nothing was
  late. The badge aged on `created_at` — when a couple typed a supplier's name in,
  68 days ago — so it rendered **RED "past SLA"**. The loudest alarm in the admin
  pointed at nothing.
- The Overview keeps **its own hand-written tile list**, separate from the work
  list's guarded `BASE_ROWS`, and **nothing referenced it**. Four queues given
  counts on 2026-08-19 never got tiles. Its headline sums all 19; its
  "busiest queues" preview and its **"All actionable queues are clear."**
  sentence are built from the 16 tiles — so the page printed **"45 items need
  you · 1 past SLA"** and **"all clear"** at the same time. The owner read the
  sentence.

**Fixed:**
- One predicate, `lib/admin/completions-stuck.ts`, imported by the desk AND the
  badge. Neither may re-implement it; a test fails if either re-declares a
  threshold locally.
- `QueueDef` gains a `digest` escape hatch for a queue whose open work cannot be
  a single-table head-count. Verified in SQL against prod: **45 → 1**.
- The clock ages from when a row **became** stuck, never from when it was typed.
- All four missing tiles added; the two duplicated count-less tiles removed.
- The **"these carry no live count"** caption no longer names a queue that has
  one — that sentence is why nobody looked at the only desk with work in it.

🛑 **THE STALE COMMENT WAS RIGHT AND THE CODE WAS WRONG.** `queue-counts.ts` still
listed `completions` under *"DELIBERATELY NOT in QUEUE_DEFS … a JS 'stuck' cut the
DB can't replicate"* — correct engineering judgement, overridden six days ago by a
filter that applied neither half. It is corrected rather than deleted, and it now
says to use `digest` instead of approximating with `filter`.

Guards: `lib/admin/the-badge-counts-what-the-desk-shows.test.ts` (7 assertions) and
`app/admin/the-overview-shows-what-it-counts.test.ts` (3, key lists DERIVED from
`ADMIN_QUEUE_META` and from the page's own source, both floored). 5 mutations, each
measured before → after, all red.
🪤 The caption guard's first cut sliced to end-of-file and swallowed the later
"every admin surface" directory, reporting `verify` and `payouts` as false
offenders. Bounded to the section — a guard that cries wolf teaches you to skim
past the one time it is right.

⏭ **NOT changed, and it is the owner's call:** whether a supplier a couple only
*shortlisted* belongs on that desk at all. 32 of the 45 were shortlist entries;
they are excluded today only because their celebrations are in the future, so when
December passes ~44 land at once. Flagged, not decided.

SPEC IMPACT: None.

### Two existing guards caught this change, and both catches were worth having

**1 · A REAL BUG IN MY OWN QUERY.**
`the-cure-was-already-written-down.test.ts` rejected the new read for embedding
`events` without naming the foreign key. A bare `events!inner` from
`event_vendors` is **REFUSED by PostgREST (PGRST201)** — one direct FK, nineteen
junction tables also joining the two, so it cannot choose. The count would have
returned null and the badge would have read "unavailable" **forever**, which is
the same silent-refusal class this whole fix is about. Three sites had already
died that way; the guard exists because of them. Now written in the exact shape
of the two queries proven in production, alias and all.

**2 · A GUARD THAT STARTED CRYING WOLF, AND WHY.**
`guards-can-actually-fire.test.ts` bounds a Supabase chain at *the next*
`.from(…)`, falling back to end-of-file. That silently assumes every file has a
SECOND literal `.from(`. `queue-counts.ts` had none until this change added the
first, so the "chain" ran to the bottom of a 500-line module and swallowed
sixteen other queues' status literals — reporting `payments`' `'pending'` and
`help`'s `'in_progress'` as non-existent **vendor** statuses. 17 false offenders.
A chain is ONE STATEMENT: bounded at the first `;` now, in all three scans that
shared the idiom.
🛡 Because that LOOSENS a guard, it is mutation-proved in both directions: a
genuinely non-existent vendor status inside the chain goes **red** (0 → 1), and a
real one (`contracted`) stays **green** — so it still catches the thing it is for
and no longer flags what it never should have.

Full suite after both: **9985/9985 pass**, `tsc --noEmit` exit 0.

### ⚖ OWNER RULING 2026-08-25 — a hand-typed supplier is a reference, never work

Owner, verbatim: *"you mean the added a supplier manually. no. manual only gives
them reference unless they connect to each other."*

**Measured the same minute: 44 of the 45 rows on that desk were hand-typed
names.** They were excluded today only because those weddings are in December —
so without this ruling roughly 44 would have landed on the desk at once when
December passed, and it is the ruling, not the date, that keeps them off.

🔑 **AND IT IS STRUCTURALLY TRUE, NOT A PREFERENCE — which is why it belongs in
the rule rather than in a filter somewhere.** The only thing that can mark a job
done is the supplier's own dashboard, which finds its row by
`.eq('marketplace_vendor_id', profile.vendor_profile_id)`. With that column NULL
there is **no supplier who can ever reach the row** — it could never leave the
desk, which is exactly why it must never enter it.

⛔ **A DISPUTE STAYS UNCONDITIONAL.** A dispute is an active human complaint and
is never filtered away for want of a shop. Production holds none, so this is
defensive — but hiding a real grievance would be a worse failure than showing a
stray row. Pinned by its own test.

Verified against prod with the full rule: **45 → 1**, and the 44 hand-typed rows
are now excluded **permanently**, not until December.

🪤 **AND A MUTATION CAUGHT A HOLE MY FIRST EIGHT ASSERTIONS ALL SLEPT THROUGH.**
Drop `marketplace_vendor_id` from the badge's select and every row reads
`undefined`; `!undefined` is true, so **every row is excluded and the badge reads
0 — forever, with no error anywhere.** A silent zero, the exact failure this file
exists to stop, and it passed. There is now an assertion that the query selects
every field the rule reads, with the field list **derived from the rule's own
type** — so a field added to the predicate tomorrow is required of the query the
same day. Both directions mutation-proved (column dropped → red; new field added
without updating the query → red).

Full suite: **9988 / 9988 pass**, `tsc --noEmit` exit 0.

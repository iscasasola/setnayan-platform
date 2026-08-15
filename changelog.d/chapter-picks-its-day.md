## 2026-08-15 · feat(chapters): a chapter can finally say which celebration it is about

The join that connects a couple's own chapter to Setnayan's editorial about the
same day **had no writer**. Closing three defects that stacked into one dead
feature.

**1 · 🚨 THE COLUMN NOTHING WROTE.** `creator_chapters.event_id` was SELECTed,
JOINed and commented about in three files, and **set by nothing anywhere** —
neither the create action nor the update action touched it. So
`loadChapterCutsForEvents`, the *only* mechanism the 2026-07-16 architecture
council named as the integration between the two voices, could never fire: no
*"Watch the storyteller's cut"* on an editorial, no *"Read the editorial"* on a
chapter. Not rarely — never. Production: one published chapter, `event_id` NULL.
**The sixth gate with no handle.**

**2 · ONE FACT, TWO HOMES, AND ONLY THE WRONG ONE WORKED.**
`substrate.papic_gallery_id` — a string in a JSON bag — is what actually drove
"shop this event" (it was passed as `eventId` into `resolveShoppableVendors`),
while the real indexed column drove the cross-links and stayed empty. The
gallery value is now **DERIVED from `event_id`** in the action: the author
answers once, and both consumers stay fed. ⚠ The function that built the bag
already warned *"leaving a second home for the same value is how the old
travel-shaped name comes back"* — and the second home was a schema column one
line away.

**3 · THE DOOR THAT OPENED FOR NOBODY.** Both were reachable only by pasting a
raw event id into a text box, with comma-separated vendor ids beside it. Nobody
ever did: the one real chapter carries neither. Replaced by a **picker of the
celebrations you host**, labelled by name and date. The vendor-ids box is left
for now — vendors already resolve from the linked event, and removing the field
is a separate cleanup.

🔒 **THE SUBMITTED ID IS NEVER TRUSTED.** A form can be posted with anything, and
attaching a chapter publishes that day's name, date, venue and booked suppliers,
so the action re-checks `event_members` server-side before storing. Unlinking
writes `null` (guarded explicitly) — a truthiness check there would make
detaching silently impossible.

⚠ **HOSTS ONLY, DELIBERATELY.** A guest or a booked supplier legitimately wants
to tell the story of a day they attended, but that needs the couple's yes — a
request-and-approve step that does not exist yet. An **empty list** is the honest
answer until it does; the alternative is a public page hung off another family's
wedding. The composer says exactly this rather than showing an unexplained blank.

🪤 **A COLUMN ABSENT FROM A SELECT READS AS NULL FOREVER.** `lib/creator-public.ts`
did not select `event_id`, so the public chapter page would have looked fixed and
stayed dead. Added, and guarded — that is mutation M5.

🛡 `lib/chapter-event-link.test.ts` — 6 tests naming the regressions, not the
implementation: both write paths set the column · unlinking is written not
skipped · the host re-check exists · the gallery value is derived and no second
box is read · the composer uses a picker · the public page prefers the column and
its loader selects it. **Baseline green, then five sabotages** (writer removed ·
second home restored · host check dropped · picker reverted to a text box ·
column dropped from the select) — **all five caught.** ⚠ M4's printed
before/after compared two different patterns, so its count is not a valid
measurement; the red result is what confirms it landed.

✅ 8339 unit tests pass · typecheck clean · 3 lints pass.

⏭ **NOT built here:** the guest/supplier request-and-approve flow, and removing
the vendor-ids box once vendors are offered as toggles from the linked day.

SPEC IMPACT: `STORIES_AND_EDITORIAL_INTEGRATION_2026-08-15.md` D1–D3 · § 8
Phase 1 · `DECISION_LOG.md` 2026-08-15.

### Same PR, second commit — the day brings its own team

🔴 **THE PRODUCT ALREADY KNEW WHO WORKED THE DAY AND NEVER OFFERED IT.**
`event_vendors.linked_vendor_profile_id` records exactly which suppliers were
booked, and `resolveLinkedVendorProfileIds` used it **only to FILTER** a list the
author had typed. So a chapter attached to a real celebration still rendered an
**empty "Shop this event"** unless somebody pasted supplier ids — and nobody
ever did.
🔑 **KNOWING SOMETHING AND OFFERING IT ARE DIFFERENT THINGS.** The same stored
fact was being checked against but never read from.

`loadBookedVendorProfileIds()` now SOURCES the candidates when the author has
named none. An author who *has* named a list keeps it — sourcing is the
fallback, not an override, so narrowing still belongs to them.

🔒 **IT CANNOT INVENT A CLAIM.** Every sourced candidate still passes through
`resolveShoppableVendors`, which re-derives the tie and renders an unlinked name
as plain text. This widens who is **credited**, never who is presented as
bookable on a tie that isn't real.

**And the last machine-id box is gone.** The comma-separated supplier-ids field
is deleted; attaching the celebration is now the single action that makes the
suppliers appear. ⚠ Narrowing *which* of them show is a later refinement —
**nobody can narrow a list they never had.**

🛡 +2 guards (8 total). Three more sabotages, each verified landed by occurrence
count — sourcing call 1→0 · the box 0→1 · the loader's export 1→0 — all caught.
✅ 8341 unit tests pass · typecheck clean.

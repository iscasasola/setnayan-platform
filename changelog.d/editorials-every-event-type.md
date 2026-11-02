## 2026-08-15 · fix(editorial): every kind of celebration can be written up, not only weddings

Owner, twice, 2026-08-15: *"not all stories will be wedding. each event they
create will have an editorial not just wedding"* · *"each event can create a
similar editorial."*

**The editorial path refused fifteen of the sixteen live event types — before
consent was ever read.** Six independent hardcoded refusals: `event_type !==
'wedding'` in `assertEligibleShowcase`, plus five `.eq('event_type', 'wedding')`
filters in `showcase-db.ts` (the consented read and its pre-migration fallback,
the sample read and its fallback, and the admin candidate list). A debut, a
graduation, a christening, a reunion or a travel could never become an
editorial at any consent setting, and the admin could not even see one as a
candidate. Prod already held **two non-wedding celebrations with public slugs**
that were permanently uncoverable.

🔑 **The promise had already shipped; the gate never opened.** `/realstories`'
own public description names *"weddings, debuts, anniversaries, graduations,
travels, and reunions"*; `GalleryItem.eventType` is typed for them; and the
curated sample fallback is **already mixed** — 5 weddings plus a Debut, an
Anniversary, a Graduation and a Reunion. The shelf already *showed* non-wedding
editorials. Only real ones were refused.

**The kind question now has exactly one home** — `lib/editorial-event-types.ts`.

⚖ **It is an EXCLUSION set, not an allowlist, and that is deliberate.**
`event_type_vocab` is admin-managed and grows; an allowlist would mean a newly
added celebration silently cannot be written up, which is this exact defect
rebuilt. The default must be "every celebration may be written up". Failing
open is safe here because nothing in this module is a permission — the consent
gate (`users.public_summary_consent_at`), the public-slug requirement, the
private-page check and the T+30d grace window all still apply, unchanged. The
set answers *"would Setnayan ever publish about this kind of occasion?"*, never
*"did these people agree?"*

✅ **No new consent machinery, because none was needed.** `member_type='couple'`
reads as wedding-shaped and is not — it is the generic principal/host slot, and
non-wedding events in prod already carry it (a `date` and a `simple_event` both
have one). Verified before writing anything.

🪤 **The SQL filter is applied conditionally, and that is load-bearing.** With an
empty exclusion set the query must not constrain the type at all. Filtering
after the read instead would let an excluded row consume one of the `limit`
slots and silently shorten the shelf.

**Copy:** the `'A Setnayan wedding'` fallback (3 sites) becomes
`UNNAMED_EDITORIAL_LABEL` — *"A Setnayan celebration"*. Deriving the word per
kind would need a second hardcoded copy of the vocabulary, and a hardcoded
vocabulary drifting from the admin-managed one is the disease being cured.

🛡 **Guard + mutation proof.** `lib/editorial-event-types.test.ts` scans both
editorial sources with comments stripped (the modules *describe* the removed
filters in prose — a naive substring scan would cry wolf forever) and fails on
any reintroduced `.eq('event_type','wedding')`, any direct `!== 'wedding'`, or
any returning `'A Setnayan wedding'`. **Three sabotages run, each verified to
have landed by occurrence count before trusting the result** (2→3, 0→1, 0→1);
all three turned the suite red. 8239 unit tests pass; typecheck clean.

⏭ **OPEN OWNER DECISION** (design doc § 7-3): two of the sixteen kinds — `date`
and `hangout` — are a private evening out rather than an occasion with guests.
Whether Setnayan should ever publish an editorial about those is judgement, not
engineering. The set ships **empty** (every kind eligible), matching what the
owner stated. Recommendation on the table: keep it empty and simply never
*solicit* the intimate kinds editorially — a curation behaviour, not a gate.
Acting on a ruling is one edit, in one file.

SPEC IMPACT: `STORIES_AND_EDITORIAL_INTEGRATION_2026-08-15.md` (Gap 4 · D14 ·
§ 7-3) and `DECISION_LOG.md` 2026-08-15 — both updated in the corpus.

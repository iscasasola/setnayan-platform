## 2026-08-20 · feat(story): the year is the season, the chapter is the episode

**Owner, 2026-08-20:** *"we want the chapters to make sense. just like in a book.
or in an adventure novel of a person. chapters are defined not just per
celebration. for tv shows. season is annual and episode is everything that
happened for that season. so for our website as storytellers, what do we have?"*

**The answer, and it is now the product:**

| Level | What it is | What it is called | Who numbers it |
|---|---|---|---|
| the whole page | everything they have written | **Your Story** | nobody — it has no number |
| the year | everything that happened in it — the season | **the year itself, `2026`** | the calendar |
| the piece | one thing that happened — the episode | **Chapter 1, 2, 3…, restarting each year** | we do, by WHEN IT HAPPENED |

A card reads **2019 · Chapter 3**. The year always travels beside the number, so
nobody has to wonder whether it means the third of that year or of their life.

### 🛑 "Season" was measured and rejected — it is not a free word here

Three unrelated live meanings a customer already meets: the weather on the
couple's own date picker (`Cool dry season`, `Peak season · book vendors early`,
`app/dashboard/[eventId]/date-selection/page.tsx`), an `Off-season savings`
filter + badge + vendor nudge in the marketplace, and `Liga season` in the
tournament run-of-show. It is also a NOT NULL CHECK-constrained column meaning
weather. **And the pair cannot be spoken in Filipino** — *kabanata* is the one
word for both chapter and episode, and there is no native word for a TV season;
meanwhile *kabanata* is what every Filipino counted through Noli Me Tangere at
school. **A year already has a name, and it is the same name in three
languages.** ("Volume" stays rejected for the reason recorded on 2026-08-20: it
is Setnayan's own edition cycle on the editorial masthead, Nov 18 → Nov 17.)

### 🔴 A chapter is NOT one per celebration — and one thing was genuinely missing

The owner's correction is already the product: "Not about one of my
celebrations" has shipped in the composer since the picker landed, and three of
the four chapter kinds are not weddings. What was missing is that **a chapter
about no celebration had no day of its own** — the only date on the row is the
publish date. So a 2019 trip written up today filed under 2026, in a chronicle
whose entire job is life order. Worse: **the publish date is re-stamped on
republish**, so taking a chapter back to draft and posting it again silently
moved it to the end of the story — and, with years as headings, into a different
year.

**The composer now asks one question: “When did this happen?”** Resolution
order: the author's own answer → the celebration it is attached to → the publish
date, as a last resort for chapters written before the field existed.

### 🔑 The number restarts each year — and this is the reason

Both orderings are honest; the difference is what happens when somebody writes
up an old memory. Numbered across a whole life, a 2019 chapter added today
shifts **every** chapter after it — including ones already read. Numbered inside
its year, only 2019 moves, which is correct: something genuinely happened before
the rest of that year. Asserted directly (`ADDING AN OLD MEMORY MOVES ONLY ITS
OWN YEAR`).

### Also in this change

- **The public timeline shows the years.** The 2026-08-20 grouping was
  author-side only, so no reader ever saw one. It now reads the day the author
  gave it, too.
- ⛔ **That page prints the bare year and must never print the words “Your
  year”** — that is a DIFFERENT page one click away in the same menu, which
  looks forward at what is coming. Guarded, because same-words-two-things is the
  collision the Event Hub lock exists to prevent.
- 🪤 **The date input's ceiling is Manila's today, not UTC's.**
  `new Date().toISOString()` is yesterday for eight hours of every Philippine
  evening — somebody writing up tonight's party would find their own day greyed
  out. The database CHECK carries the same one-day slack, for the same reason.
- A day is stored as a **DATE and never parsed into a `Date`** — that is how a
  12 December memory reads as the 11th west of Greenwich.

**Verification.** 16 chronicle unit tests · 11 source guards · 903 app tests ·
typecheck clean · lints clean. **6 mutations, each landing verified by
occurrence count, all 6 turn the suite RED**: field removed (1→0) · UTC ceiling
(1→0) · composer stops reading the stated day (1→0) · public timeline goes flat
(1→0) · year heading deleted (3→0) · numbering across a life (1→0). The CHECK
was proven against production in a rolled-back transaction: a day 400 days ago
accepted, a day 30 days ahead refused.

**Exposure baseline regenerated** — exactly **one** genuinely new exposure, the
new column (`creator_chapters.happened_on`, same grants as every other column on
that table; the row policy is what protects a draft). The other ~1,250 changed
lines are bookkeeping from **59 table-level narrowings** other branches made
without regenerating: anon lost `SIUD` on those tables and they are now written
out per column as `anon=-`. Verified: **no other added line grants anon
anything.**

⏭ **Named, not built:** when two chapters share one celebration (a couple's own
write-up and their photographer's), they resolve to the same day and the tie
falls to publish order. On a person's own timeline that is fine — both are
theirs. On the event-side list it should be the host's own chapter first; that
list does not exist yet.

SPEC IMPACT: `DECISION_LOG.md` — the storyteller vocabulary is settled: the year
is the season (written as the year), the chapter is the episode, numbered inside
its year by when it happened. "Season" and "Volume" are both rejected, with the
measured reasons.

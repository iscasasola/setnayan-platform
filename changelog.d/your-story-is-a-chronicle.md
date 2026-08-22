## 2026-08-20 · feat(story): Your Story becomes a chronicle — a chapter is a celebration, numbered by when it happened

**Owner, 2026-08-20 (five rulings in one sitting).** The answer to *"a chapter is
what? a year, or a milestone?"*: **a milestone.** One celebration, told once.

- **A CHAPTER IS A CELEBRATION; THE YEAR IS A HEADING; THE NUMBER IS DERIVED.**
  New pure module `lib/creator-chronicle.ts`. Nobody types a number — Chapter 1
  is the oldest milestone, and the year groups the chapters that happened in it.
- **🛑 "VOLUME" WAS CONSIDERED AND REJECTED, and this is the load-bearing note.**
  `Vol. I · No. 7` already ships and already means SETNAYAN's publication — the
  Volume is our awards cycle (Nov 18 → Nov 17) and the No. is that wedding's
  position among all Setnayan weddings in the cycle (`editorial-content.tsx`
  `editionVolume` + `editorial/data.ts` `editionNo`, plus every Real Stories
  card). Spending the same masthead word on a person's own life would make one
  word mean two scopes on two pages a couple reads minutes apart. Measured
  before it was rejected.
- **🔑 NUMBERED BY WHEN IT HAPPENED, NOT BY WHEN IT WAS TYPED.** The shipped
  numbering ranked by `published_at`, so writing up a 2019 engagement today made
  it the person's LATEST chapter. `rankChaptersByPublishedAt` is retired; the
  NULLS-FIRST lesson it carried (`chapters[0]` is not reliably the newest,
  because Postgres DESC is NULLS FIRST) is ported into the new module and its
  tests.
- **⏳ THE PICKER OFFERS CELEBRATIONS THAT ARE OVER** — owner: *"all events that
  concluded can be picked here."* 🪤 **It filters what is OFFERED, never what is
  already ATTACHED:** the save path re-proves the tie through this same list, so
  a plain filter would silently detach a written chapter the next time its
  author fixed a typo — and the DB trigger drops the host's inclusion decision
  on any event change, so it would not come back.
- **📋 MY EVENTS: "Finished" splits into "Unpublished" and "Published"** — owner:
  *"we have a place there for finished. change it to unpublished and published.
  They get to choose on the unpublish which they will make a story of."* Each
  unpublished celebration carries a **Write the story** link that opens the
  composer with that day already picked. 🪤 The split only happens when the
  stories were MEASURED — a refused read of somebody's own chapters looks exactly
  like having written none, and would put a Write-the-story button beside a story
  they already wrote; unmeasured ⇒ one shelf, exactly the board of today.
  🔑 It is a `<Link>`, never a form: App Router prefetches, so a side effect
  behind a card fires when the card scrolls past.
- **🛑 THE "ACCEPT VENDOR OFFERS" TOGGLE IS REMOVED** — owner: *"will forever be
  on… all users can be deemed content creators."* `users.creator_accepts_offers`
  is **kept and still read** (vendor browse + the `CREATOR_OFFERS_OFF` hold), so
  the opt-out mechanism survives if a privacy review asks for it back; only the
  writer is gone. 🔑 **This was safe because the column DEFAULTS TRUE** — had it
  defaulted FALSE, deleting the toggle would have blocked every vendor offer in
  the product, silently and permanently. Read the default before you take away a
  handle.
- **🪤 A DATE FORMATTER FIXED ON THE WAY PAST.** The public timeline's
  `formatChapterDate` did `new Date(iso)` — fine for a publish timestamp, and
  the 12-Dec-reads-as-11-Dec bug for the bare calendar day it now receives. It
  delegates to `formatEventDate`, which builds the date from its parts.
- **`isFinishedEvent` now reads `event_end_date` when there is one**, so a
  celebration that runs to Sunday is not "finished" on Saturday. Behaviour-neutral
  today: no production event has an end date.

**Tests:** 12 new unit tests over the chronicle + 7 over the board split + 7
source guards on Your Story; the launcher board guard is updated (its invariant
— *nobody's memories sit behind a switch* — is now proved by position, not by
name) and gains a proof that every finished celebration lands on exactly one
shelf. 7918 lib + 882 app tests pass; the 4 lib failures are the worktree's
missing optional deps (pglite / anthropic sdk), not this change. Typecheck: 270
errors, the documented baseline, unchanged.

**Port-controls baseline regenerated** (`80a3a64da` → `3bf12d351`). It absorbs
exactly two removals: `setCreatorAcceptsOffers` (this change) and `PageMasthead`
on `/dashboard/(account)/year`, which arrived with #4599 — **verified not a real
removal**, the component is still imported and rendered at that page's line 170.

SPEC IMPACT: `DECISION_LOG.md` — the chapter/volume/number vocabulary is settled
here (a chapter is a milestone; the year is a heading; "Volume" belongs to
Setnayan's edition masthead and is not reused).

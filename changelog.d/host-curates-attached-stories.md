## 2026-08-15 · feat(stories): suppliers may write about a day they worked — and the host decides what appears on it

Owner, two rulings that only work together:
*"vendors who are part of that event can create a content for that event."* ·
*"they can create a column for that story, and the user can decide to add it or
not."*

🔑 **THIS IS NOT ASK-BEFORE-YOU-WRITE, AND THAT IS THE OWNER'S CORRECTION TO MY
DESIGN.** D2 had the supplier send a request and wait. His shape is better: the
supplier is **never blocked** — the piece is theirs and lives on their own page
either way — and the couple decides only whether it is **added to their day**.
Nobody waits on anybody to create. **D2's handshake is retired.**

🛑 **THE TWO HALVES SHIP AS ONE UNIT.** Widening who may attach *without* the
host's control would put a business's public page on a family's wedding with no
say from that family — **strictly worse than the hosts-only behaviour it
replaces.** Never land the widening alone.

**What changed**
- `loadLinkableEvents` now offers celebrations you **host** *and* ones your shop
  was **booked on** (`event_vendors.linked_vendor_profile_id` — the same evidence
  a credit is already trusted on). Hosting outranks supplying, so a couple who
  also owns a shop is never asked to approve themselves.
- `creator_chapters.host_included_at` — NULL means attached but **not** shown on
  the couple's surfaces. `loadChapterCutsForEvents` now requires it. **That
  predicate is the load-bearing line of this PR.**
- A host screen at `/dashboard/[eventId]/website/stories` — **Add to my day** /
  **Take off my day**, both directions reachable.

🔒 **THE ROW IS YOURS, THE FIELD IS NOT.** `creator_chapters` RLS is Pattern A
(`user_id = auth.uid()`), which has no opinion about a field recording somebody
else's decision — so an author could have stamped their own piece onto another
family's wedding through PostgREST. `host_included_at` is **REVOKEd (UPDATE *and*
INSERT — a PERMISSIVE policy admits both)** from `authenticated`.

🔑 **WHICH IS WHY A TRIGGER STAMPS IT, NOT THE APP.** Postgres checks privileges
against columns **NAMED**, so an app-side stamp would fail for the legitimate
case too — a couple attaching their own celebration. `set_chapter_host_inclusion`
auto-includes when the author IS the host, and **clears the flag when a chapter
is re-pointed at a different day** (that judgement was about another wedding).

🪤 **`vendor_profiles.user_id`, not `owner_user_id`.** The phantom name would
have resolved to `{ error }` rather than throwing, leaving **every supplier's
list silently empty** — the feature would have looked built and done nothing.
Column names verified against prod before writing.

🛡 12 guards. **A pre-existing guard went RED and was RESPELLED, not relaxed** —
it asserted the membership check lived inside the action, and the check moved
into the shared module when suppliers became eligible. That is the guard working.
🔬 **Five sabotages, each verified landed by occurrence count**, and **one of them
exposed a decorative guard of my own**: renaming the query to
`DISABLED_event_vendors` left the sabotage green, because a bare `/event_vendors/`
still matches the disabled name — the `f.event_dateX` prefix trap again. Anchored
on `.from('event_vendors')` and re-run: RED. All five now caught.

✅ 8382 unit tests pass · typecheck clean · both required Ugat db guards pass
(so the migration replays) · migration allocator + 3 lints pass.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-15 · design record D2 **retired**, replaced
by the column model.

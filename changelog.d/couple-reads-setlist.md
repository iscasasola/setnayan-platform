## 2026-08-06 · feat(playlist): the couple can see what their band is actually playing

Owner: **"make it On. couple or host of event should see the song list for their
event."**

The set list has shipped for a while — the tables, the band's editor, and a
tested builder that even cross-references the couple's own requests. **The couple
could not see any of it.** Each table carried exactly ONE policy, `*_act_manage`,
whose audience is the vendor, a day-of grantee, or an admin. There was no couple
leg. One missing predicate was the entire feature.

**Shipped:** two additive `SELECT` policies, a host-shaped reader, and a
read-only panel on the couple's existing playlist page. Nothing revoked, the
write path untouched, no grant changes — `SELECT` was already granted to
`authenticated`; only RLS was refusing.

🔑 **THE COUPLE, NOT COUPLE-OR-COORDINATOR.** Both would have read plausibly, but
the two sibling reads on that same page are couple-only — a coordinator admitted
here would see the band's sets on a page where they can read neither the couple's
picks nor the act's name. In this codebase "host" *means* the couple
(`buildHostPlaylist`, `hostPicksBySlot`), so "couple or host" is one person.

🔑 **NO `is_admin()`.** The existing `FOR ALL` policy already contains it and
permissive policies OR together — repeating it would be dead predicate a future
reader has to re-verify.

🚨 **A REFUSED READ AND AN EMPTY SET LIST ARE THE SAME VALUE.** The vendor-side
reader returns empty on error *by design* — justified by "the vendor is reading
their own". That justification does not transfer: rendering empty here would tell
the couple **"your band hasn't built a set list yet"**, a confident false claim
about someone else's work, possibly on the day they are checking it. The host
reader returns `failed` and the panel says so.

🪤 **NOT gated on the page's existing music-vendor lookup** — that query is
`.limit(1)` and filtered by a hand-kept category list, so an act filed under any
other category has built real sets that would never render. Act names come from
an unfiltered lookup, falling back to "Your band" when the join legitimately
misses (an act can hold a day-of grant with no booking row at all).

🪤 **One block per ACT.** The builder groups by SET and never by vendor, and
uniqueness is per act — two booked acts may each have a "Set 1". One combined
call would merge two bands' running orders into a single list.

🐛 **AND A REAL BUG IN MY OWN TEST HELPER, caught by it failing.** The
comment-stripper I wrote used `{\s*/\*…\*/\s*}` for JSX comments; the `}: {`
opening a props type is a `{` followed by a docblock, so the match ran on to a
later `*/}` and **ate 2.4 KB of real code — including the line under test.** It
now strips block comments first, which turns `{/* … */}` into a harmless `{}` and
can never consume code. I re-checked the same helper in the already-merged
booking-fee test: it removed only the stray braces there and that assertion is
genuinely passing, not vacuous.

**Verified:** full suite 6,940 pass under `Asia/Manila` · scoped `tsc` clean ·
13/13 lint scripts clean · baseline regenerated in this PR and reviewed —
**exactly +2 policy lines, both SELECT, both couple-scoped, nothing else.**

SPEC IMPACT: `DECISION_LOG.md` 2026-08-06. ⏭ The other half — every booked
supplier, not only the musicians, can read the couple's song picks — was NOT
ruled on and is untouched here.

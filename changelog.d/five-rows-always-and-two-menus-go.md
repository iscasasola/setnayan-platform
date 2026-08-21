## 2026-08-21 · change(dashboard): five rows always, and two menus retire into them

Owner 2026-08-21: *"we show the different rows and leave it blank when no event
is there. remove the your year and your story. we already have the your year
inside my events. we already have your story on untold."* Then: *"Events /
Memories / People will be the ones remaining."*

### The board keeps its shape

⚠ **REVERSES A CALL THIS FEATURE SHIPPED WITH THIS MORNING.** "Now happening"
hid itself on every ordinary day, on the reasoning that a permanent
*"nothing today"* row would be the loudest thing on the board saying the least.
🔑 **The owner's call is the better one for a board people LEARN**: five rows
always in the same place can be navigated from memory; rows that appear and
vanish make the page a different shape every visit. "Told" had the same problem
and now renders empty too.

🔑 **AN EMPTY LINE MAY NOT CLAIM "YOU HAVE NONE"** — `fetchUserEvents`
graceful-degrades to `[]` on an RLS denial, so an empty read and an empty life
are the same value. Told has TWO empty states for that reason: measured (invite
them to write one) and unmeasured (say what the row is for, claim nothing).

### Your year — retired as a MENU, not as a place

The ⌘K row, the rail row and both *"See the year →"* links are gone, and
`/dashboard/year` **redirects** to the shelf.

🔑 **THE HOLIDAYS MOVED FIRST, AND THAT IS WHAT MAKES IT HONEST.** The shelf was
built `includeHolidays: false` *because* that page existed to carry them —
Christmas and Valentine's, which are exactly the dates a "books out early" shelf
is for. Retiring the page without flipping that flag would have deleted them
from the product silently. Its own sections were already called *"Worth planning
for"* and *"The year ahead"*.

⚠ **A REDIRECT, NOT A DELETE, BECAUSE OF LINKS WE DO NOT CONTROL** — the daily
digest email has carried `/dashboard/year` as its call to action, and bookmarks
exist. Deleting the route 404s people who did nothing wrong. The email CTA is
repointed at the shelf directly: *a link that survives one hop today is a link
that 404s the day somebody deletes the redirect.*

### Your Story — retired as a MENU, not as a place

The rail row and the ⌘K row are gone. `/dashboard/creator` keeps **two** visible
doors on the first screen after sign-in: the *"Write the story of &lt;name&gt;"*
chips on Untold, and the link at the foot of Told — which now also renders an
*"Open Your Story"* line when Told is empty, because *"These days are chapters
now"* beside an empty shelf names days that are not there.

### Alaala → Memories

🔁 **THIS REVERSES THE 2026-07-31 RENAME**, which went the other way ("Memories
Hub" → "Alaala"). The owner has now said Memories twice. **The reversal is left
visible in the comment rather than tidied away**, so nobody re-applies the older
decision from the note that justified it. Renamed: the registry label (so admin
overrides still work), the rail label + caption, the phone tab, and the
destination page's title and heading.
⏭ **NOT renamed, deliberately:** the public `/alaala` marketing page and route
(a sitemapped public address — an SEO/brand call, not a menu call), and the
internal identifiers.

Guards: `the-controls-have-a-home.test.ts` rewritten to assert the REPLACEMENTS
rather than the removals — a test that only checked the old rows were gone would
pass just as happily if the destinations had been orphaned. Four mutations, each
verified to land by occurrence count, each red: holidays excluded again · the
year page stops redirecting · Untold loses its write chips · the story rail row
returns.

SPEC IMPACT: DECISION_LOG.md 2026-08-21 (five rows always; Your year + Your
Story retired as menus; Alaala → Memories, reversing 2026-07-31).

### 🚨 The first cut of this DELETED A FEATURE, and only a guard caught it

Redirecting `/dashboard/year` took **"start planning from a moment"** with it.
The affordance — *"Open plan"* / *"Start planning"*, carrying the event type in
the URL and the day + age + "this is mine" in sessionStorage — lived **only** on
that page. The shelf's rows were plain non-navigating `<div>`s: they printed a
date and offered nothing to do about it.

🔑 **RETIRING A PAGE MEANS MOVING WHAT IT DID, NOT ONLY WHERE IT LIVED.** Twelve
assertions across five suites went red and are the only reason this was caught —
typecheck was clean, the board rendered perfectly, and the rows looked right.

`StartPlanningLink` moved to the launcher, `YearMomentView` grew the four fields
that make a row actionable (`createEventType` · `dateISO` · `forSelf` · `age`),
and the strip's mapper now passes them. ⚠ **THE MAPPER IS THE SEAM WHERE A
PORTED FEATURE SILENTLY BECOMES INERT** — a field it forgets reads `undefined`
and the row renders perfectly with nothing behind it.

**Every one of the twelve was RE-AIMED, never deleted with the page.** A guard
whose subject moves is a guard that must move; deleting it is how the next
retirement goes uncaught. `year-page-answers-created-or-not.test.ts` now reads
the shelf, `year-view-has-a-door.test.ts` keeps the half that still binds (the
birthday must be READ, a day must never print twice, the empty state must not
state a fact it has not established) and drops only the door-counting, and
`rail-active.test.ts` gained the both-sides retirement rule it already applied
to `/realstories`.

**M26** (remove the Start planning affordance, 1 → 0) → **red**.
**M27** (drop the handover wrapper, 3 → 0) → **red**.

## 2026-08-13 · feat(home): the front door is built and mounted at `/`, behind its flag

**Session 4 of the ten-session redesign — the port, built on the groundwork
from the same session's first PR (#4394), which this branch now contains.**
Ported from the binding drawing
(`prototypes/front_door_and_seam_2026-08-12.html` rev 3 +
`FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md`) — not redrawn. A delta between the
shipped page and the prototype is a defect in the PORT.

**The owner gate was closed first.** Asked whether the new front door replaces
the homepage: *"yes we want the new website"*; asked what becomes of the
cinematic opening: **"Retire it completely."** This reverses the 2026-06-29
owner approval of `HomeReskin`, and the destructive consequence was put in the
question rather than inferred from a yes (`DECISION_LOG.md` 2026-08-13).

### What a person gets

A front page that looks full on launch day: a uniform four-across grid carried
by the writing, a left rail whose second group is the account slot (sign-in
prompt when out, their own destinations when in), a centred search with its own
button, and honest headings where the shelves are thin.

### Ported

- Top bar — hamburger + wordmark left, centred search **with its own button**
  and a mic, account cluster right (`+ Create` · bell · avatar signed in;
  `⋮` + Sign in signed out).
- Left rail **240px**, five groups, **account slot second**. Cards carry **no
  border and no shadow** — the thumbnail is the object.
- Breakpoints: feed 1064px at ≥1440 (shorts 6-up) · 960 at 1280 (5-up) · 72px
  icon rail below 1280 (4-up) · off-canvas under 1024 · 2-up on a phone.
- Gold `#8C6932` buttons with cream labels and the system typeface, this page
  only (owner 2026-08-11, measured 4.86:1). Light mode only, 44×44 tap targets,
  counts in monospace.

### Decided by data, not hardcoded

Every rail asks the data what shape to take, so the page re-composes itself
without anyone coming back to change it:

| Rail | Rule |
|---|---|
| Stories | ONE shelf — articles and storytellers' pieces together, the card says which kind |
| Real weddings | a written invitation below **2** published; a grid at or above |
| Shops | **"The first shops"** below **12** live; "Trending" only at or above |

**"Trending" over a field of one is a lie**, and an unknown count never prints
"Trending" either — both halves are asserted.

### Corrections found while building

- **The prompt's launch-day figures were already stale.** Prod now holds 1
  published chapter (Session 2 shipped yesterday) — but `showcase_featured_at`
  is NULL, so the public shelf loader returns nothing. The storyteller rail is
  still absent, for a different reason than "0 chapters". The threshold is
  therefore keyed on what reaches the PUBLIC shelf, not on a chapter existing —
  keying it on existence would render the empty shelf the design forbids.
- **`owner_user_id` does not exist on `vendor_profiles`** (it is `user_id`). The
  first cut named it; PostgREST would have rejected the query and a vendor would
  simply never have seen their own shop in the rail, silently.
- **Sign out is POST-only.** A `<Link>` to `/auth/sign-out` renders a row that
  answers 405 — and would be prefetched, i.e. a control that can sign you out by
  being near the pointer. It is a form.
- **Three rail links pointed at routes that do not exist** (`/sign-in`,
  `/dashboard/alaala`, `/policy-and-safety`). Repointed to `/login`,
  `/dashboard/library` (whose own metadata title is "Alaala") and the shipped
  legal set. **No fake doors** is a locked rule and a 404 in a nav is invisible
  until somebody presses it.
- **The off-canvas rail stayed in the tab order when closed.** Now
  `display:none`, which actually removes it — `aria-hidden` +
  `pointer-events:none` would have left a dozen focusable links behind the scrim.
- **The category count had two definitions.** `FOLDER_SERVICE_COUNT` lived
  privately in `explore/page.tsx` and is shown to a customer ("in Photo & video
  · 12 services"); the rail shows the same number. Extracted to
  `lib/taxonomy-folder-counts.ts` and imported by both, so a taxonomy edit moves
  both or neither.

### Two sessions built Session 4 — they are now one branch

PR #4394 (groundwork: the flag, the composition module, the cron-free-jobs
guard) was open and **stuck red on `every feature-flag module has at least one
non-test importer`** — it had built a flag nothing consumed, and this port is its
only consumer. The two PRs needed each other. This branch is rebased on that one
and supersedes it: the port now imports `composeFrontDoor` and
`newFrontDoorEnabled` instead of carrying its own duplicates, which is the same
"one definition, not two" rule applied to a sibling branch.

Dropped from this PR as a result: a second copy of the thresholds, and a second
guard on the cron-free jobs (theirs is stricter — it requires each job to sit
inside an `after(() => …)` call rather than merely appear).

### Guards

`front-door-invariants.test.ts` (9 assertions) + `taxonomy-folder-counts.test.ts`
(4), alongside the groundwork's own 15. **All 10 sabotages mutation-tested with
occurrence counts printed before and after, and all files restored
byte-identical.** One was decorative on its first run and is
recorded here because it is the recurring shape: the JSON-LD guard matched the
`const softwareAppJsonLd` **declaration**, so pointing the second `<script>` at
the wrong variable — which stops the SoftwareApplication node rendering at all —
left it GREEN. Re-anchored to count the **serialisations**. *A guard can match a
string rather than the act.*

### The swap is behind a flag, and that is about ORDER, not doubt

`NEXT_PUBLIC_NEW_FRONT_DOOR=1` chooses the new door; `HomeReskin` still renders
until it is set. The owner HAS ruled the cinematic page retired — but deleting a
finished, approved page before its replacement has been looked at on a real
screen is the one step here that cannot be undone, and the standing rule is that
**the owner looking beats every automated check**. The June design is retired IN
THE FLIP: one commit, once somebody has actually seen what replaces it.

⚠ The value must be exactly `'1'` (`true` reads as OFF), and `NEXT_PUBLIC_*`
inlines at BUILD time — flipping it in Vercel needs a rebuild **without build
cache** or the old value stays compiled in.

### Named costs, not side effects

- **ISR is preserved, deliberately.** An earlier cut of this change set
  `force-dynamic`, which would have made the page dynamic for BOTH branches —
  costing the *currently live* homepage its edge caching for the whole flag-off
  window, for a page that never reads the session. Instead `revalidate = 300`
  stays and Next's own dynamic bailout handles it: the session is read only
  inside the new door, so the route becomes dynamic when the flag flips, not
  now. ⏭ Follow-up named for the flip: if per-request rendering proves
  expensive under real traffic, cache the four feed reads so only the session
  lookup stays per-request.
- **The Marketplace group and "Find a supplier" are signed-in only** (owner
  2026-08-12). A crawler is always signed out, so those category links leave the
  front page for Google too. The category pages stay in the sitemap and keep
  working — the front page just stops pointing at them.

### Preserved deliberately

Both JSON-LD nodes and **all three cron-free `after()` jobs** — the admin
morning digest, the daily email jobs and the interconnection probes. These have
no scheduler; they ride this page's guaranteed public traffic, so dropping one
while rewriting the page would have silently stopped the anniversary digests,
the renewal reminders and the Papic drop warning. Both are pinned by tests.

**Retired with the page:** the catalog-driven pricing read, the admin background
videos and the Spotlight strip — props of the cinematic homepage only.
`/pricing` remains the source of truth for prices and is untouched.

🪤 **Pakanta is deliberately absent from the rail.** It is sold and reachable
only from inside the app; it has no public page, so a row would be a fake door.

SPEC IMPACT: `DECISION_LOG.md` already carries the 2026-08-13 owner ruling that
retires the ELN cinematic homepage and unblocks Session 4 — no new row needed
for the build. `REDESIGN_SESSIONS_2026-08-12.md` is deliberately NOT marked
shipped here: the register's own recorded lesson is that a session marked
shipped while its PR is open is how that file went stale twice. It is updated
after the merge is confirmed, and Session 4 is not DONE until the flag flips.

---

## 2026-08-13 · fix(front-door): 13 defects an adversarial review found before merge

A 73-agent adversarial pass over this port — five independent lenses, then TWO
skeptics per finding with either able to kill it. **34 candidates · 13 survived
refutation · 21 refuted.** Every survivor was re-verified by hand before acting.

### The one that mattered most — the page's own premise was dead code

This page is written around *"a count that failed to load says so, never 0"*.
**It could not happen.** `loadFeaturedChapters` and `loadPublishedShowcases`
both return `[]` for a REJECTED query as well as an empty one, so the
`.catch(() => null)` around them was unreachable, `?? []` erased what was left,
and the heading rendered `stories.length` — a literal **0**. On a day when eight
storytellers were published and the read broke, the front page would have said
*"0 theirs"*, every card would have vanished, and nothing anywhere would have
said a word. Under the "Their stories" chip it would additionally have claimed
*"Nothing under 'Their stories' yet."*

🔑 **And my own guard passed over it** — it matched the string `value === null`,
proving the branch was WRITTEN, not that anything could reach it. *A guard can
match a string rather than the act*, one file after I wrote that sentence about
a different guard.

Fixed at the source: `lib/storytellers.ts` gains `loadFeaturedChaptersResult`,
which reports whether the read succeeded. `loadFeaturedChapters` keeps its exact
behaviour by discarding the flag, so **/realstories is untouched**.

### Also fixed

- **The hamburger was live at every width.** Pressing it on a desktop mounted a
  scrim whose only styles live below 1024px — unstyled it became grid item #1
  and shoved the rail and feed into the wrong columns, collapsing the layout.
  It also announced "Menu, collapsed" for navigation that was fully on screen.
- **Three top-bar buttons were focusable, labelled and dead** — the voice-search
  mic, the bell, and the signed-out overflow. A handler-less button is a fake
  door in button form. The bell is now a real link to notifications; the mic and
  the overflow are **not ported** until the things behind them exist.
- **The front page understated the archive**: it printed the length of the
  12-item slice it renders, so it said *"12 pieces"* while 33 are published —
  a number that shrinks as the page gets busier.
- **Both section headings rendered as body text.** The 19px/bold rule targeted a
  child `<h2>` that does not exist (the port made the heading itself the classed
  element), and Tailwind preflight resets `h1..h6` to inherit.
- **Media-query gaps at 1279–1280 and 700–701** — a viewport at 1279.5px matched
  neither band and every rail row rendered its label twice. Fractional upper
  bounds throughout.
- **The rail's Events count contradicted the dashboard**: it counted raw
  memberships, while `/dashboard` filters `hidden_at` and drops archived. The
  rail would promise 5 and the board show 3.
- **No `<h1>`**, and under a filter chip the first heading was an `<h3>`.
- **Focus escaped the open drawer** — Tab walked into the feed behind the scrim.
- **`await searchParams` opted `/` out of static generation in BOTH flag
  states** — the exact ISR regression the `revalidate` note claimed to avoid.
  The read is now gated on the build-inlined flag.

### Three more of my guards were decorative, and are now proven

- "Trending is earned" checked the DECLARATION and never that the value reaches
  the screen, nor that the two arms differ.
- The Marketplace-synonym gate scanned BACKWARDS for `account.signedIn` and
  found the account slot's gate above it — so replacing the row's own gate with
  `{true ?` passed.
- The shared-count guard asserted an import PATH that cannot disappear, because
  the same module also supplies the folder lists.

🛡 **12 sabotages, each looking like the real regression, occurrence counts
printed before and after, every file restored byte-identical — all 12 RED.**
Two rounds were needed: the first found three guards still decorative, including
one where my new assertion matched the TYPE DECLARATION (`storyCount: number |
null;`) instead of the assignment. Object entries end in a comma; type members
end in a semicolon.

⚠ **REVERTED after the review refuted it:** gating the retired page's four reads
on the flag. It forces every downstream prop nullable for a saving that exists
only in the flag-ON state, and the pass explicitly refuted "the retired reads are
wasted work" as a defect.

SPEC IMPACT: None beyond the existing row.

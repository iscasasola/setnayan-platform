## 2026-08-16 · fix(shell): one search per person, not one per page

Owner, 2026-08-16, over two screenshots of two PUBLIC pages: *"i think the top
nav is still not fixed. the search tab looks different. i thought this was
already fixed?"*

He had. The 2026-08-14 ruling settled that one bar means one search, and it
settled it on the grounds that **"every surface this bar mounts on is INSIDE
the person's own app"** — true that day: slice 0 mounted five signed-in trees.

🔴 **THEN THE PREMISE MOVED AND NOBODY RE-ASKED THE QUESTION.** On 2026-08-15
the eight product doorways, About, Explore, Pricing, Real Stories and the legal
chrome mounted the same shell with `variant="doorway"` — **thirteen PUBLIC
pages**, where the visitor is a stranger with no events, no people and no
vendors. Measured live on `www.setnayan.com` before this change:

| where | what a stranger saw |
|---|---|
| `/` | the marketplace box — "Search suppliers, stories and guides" |
| the other twelve | a palette — "Search events, people, vendors ⌘K" |

`resolveCommandItems` returns `[]` without a session, so that palette **opened
empty**, and typing into it produced exactly one row — the marketplace escape.
**Two presses to reach what `/` answers with Enter**, under a label naming two
things it could not search.

🚨 **AND A SECOND HALF THAT WAS INVISIBLE ON A LAPTOP.** `.fd-searchwrap` is
`display:none` below 701px and `.fd-searchrow` takes over — and that row
rendered `<SearchBox />` outright, ignoring whatever the page handed in. So
every doorway showed the **palette at 701px and the marketplace form at 700px**.
One page, two searches, decided by the width of the window.

**THE RULE NOW: the search follows WHO IS LOOKING, not which page they are on**
— the same answer this file family already gave for the Studio rows (2026-08-15)
and the account cluster (2026-08-15).

- signed out → the marketplace box, on `/` and on all thirteen shelled pages
- signed in → the palette over their own things, on all fourteen

Nothing is lost either way: the palette carries the marketplace as an escape
row, which is the whole reason it was allowed to win the 2026-08-14 ruling.
What that ruling settled is now true across every surface instead of five.

🔑 **THE SPLIT WAS TWO CORRECT FILES DISAGREEING.** Neither was broken alone —
`/` carried a comment explaining why its search was the marketplace form
*"deliberately"*, and the rail carried one explaining why its search was the
palette. Both were written before the doorways joined. So the new guard
compares the expression **between** the two mounts, not just within each.

🛡 **THREE GUARDS, ALL MUTATION-PROVED WITH THE LANDING MEASURED** (occurrence
count before → after, per the standing rule that an unmeasured mutation proves
nothing): rail palette back to unconditional → 2 red · front-door mount made to
differ → 2 red · phone row hardcoded again → 1 red. Restored green.

⏭ **NAMED, NOT FIXED — ten public pages are still on the OLD floating glass
nav** and have **no search at all**: `/vendors` `/blog` `/features` `/creators`
`/how-it-works` `/our-story` `/download` `/waitlist` `/monogram`
`/why-setnayan`. Several are linked from the footer on the very pages the owner
screenshotted ("For suppliers", "Articles", "Download"), so pressing them still
jumps between two websites. Seven of the ten are static or ISR, and mounting
the shared shell on a `force-static` page serves a **permanently signed-out
shell from the edge cache** with nothing logged — so each needs `force-dynamic`
first, which is a caching cost on content pages and a page-port decision, not
part of a search fix.

Verified: 8423 unit tests green · typecheck clean · all 24 `lint-*.mjs` guards
green. Not verified on a rendered page — a local preview needs Supabase
credentials this session does not hold, so the Vercel preview on this PR is the
first render.

SPEC IMPACT: None — no price, SKU, schema or locked decision moves. The
2026-08-14 "one bar, one search" ruling is upheld, not reversed; only its
premise is re-stated now that the bar mounts on public pages.

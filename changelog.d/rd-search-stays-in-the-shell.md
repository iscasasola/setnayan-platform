## 2026-10-22 · fix(search): a signed-in search answers inside the shell, and your own suppliers are findable

Owner, 22 Oct, iPhone, signed in: searching "seda" (Seda Vertis North, a
supplier he booked on his event, added by hand) sent him to `/explore?q=seda` —
the old top bar with "+ Create event", a second search box, an "Off-season
savings" pill, "No suppliers match exactly… Clear all filters", no account bar.
*"I tried to search for seda and brought me here away from our shell."*

Two hops took him out: the palette's "Search Setnayan" row opened the public
front door (`/?q=`), and its results handed the words to the marketplace. And
the search index held no suppliers at all, so the supplier he had booked could
not be found.

- The step-out row now opens `/dashboard/search?q=` — a page of the `(account)`
  layout (app top bar, account bar; Discover lit where it is a tab). It renders
  the same results view as the front door (`FrontDoorResults`, `place="shell"`):
  your things, the shops we publish, our stories and guides — and no row out to
  `/explore`. The empty state names the words and where it looked. On the web,
  a host with one event gets "Find suppliers for <event>" (that event's
  Suppliers page). The store app gets no marketplace link.
- A signed-in `/?q=` (old link, paste) redirects to the shell's results.
  Signed out, the front door is unchanged.
- Every supplier on an event you organise (booked or hand-added, published or
  not; not the ones put away) is in the search index, tagged "On your event",
  and opens that supplier's page on that event. It shows in the palette on
  Discover and on the Events board ("Search your events"), and on the results
  page. Published shops still come only through the shared publish gate.

Guards: `lib/shell-search.test.ts` (every step-out row, in every scope,
resolves to a page under a layout that draws the account bar; the shell results
draw no link to `/explore` or `/`, checked by rendering; a member's `/?q=` is
redirected) and `lib/own-supplier-items.test.ts` (every named supplier row on
your events is found by its name, whole or in part, in both scopes and by the
results filter; the index really reads and adds them). 12 sabotages, all red.
`search-answers-here.test.ts` and `front-door-invariants.test.ts` were updated
to the new destination. They were not loosened: they still require the same
results view and still forbid `/explore`.

Not done: People results on the shell's results page. A person hit has nowhere
to open yet (the People page takes no query), so it needs a ruling on where it
should go.

SPEC IMPACT: None. This applies the 2026-09-23 "the search searches the place
you are standing in" ruling to suppliers already on your events and to where
the results are drawn. No new rule.

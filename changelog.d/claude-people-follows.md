## 2026-09-28 · feat(people): one page, one picker — Requests · Connected · Following · Followers · Alaga · Samahan

Owner, approving `people-redesign.html`: *"build it"*. Rulings built: followers vs connected people ·
connected people follow each other · accepted guests auto-follow co-hosts · *"People is same as Alaga and
Samahan"* · "Add an alaga" / "New samahan" live only at the head of their own views (*"we already agreed
this will be on the alaga and samahan row"* — supersedes the 2026-08-22 header row) · the Followers list is
visible only to its owner · you can unfollow a connected person and stay connected · Requests pinned at
the top of Connected and first in the picker (with a dot) while any wait.

- **Views by URL** — `/dashboard/people?view=` requests · connected (default = the bare page) · following ·
  followers · alaga · samahan, resolved by one module (`lib/people-views.ts`) that the page, the picker and
  the rail all share. The header holds only the picker: the shipped `PickMenu` (value = option KEY), counts
  in the labels, a count that could not be read left off rather than printed as 0. `PickMenu` gained an
  optional `dotNote` (default "live today") so Requests reads "· waiting on you".
- **Rail** — People's rows are the same `?view=` links and they light (Requests with its count while any
  wait · People · Following · Followers · Alaga · Samahan). The dead `#connection-tree` and `#alaga`
  anchors are gone (`id="alaga"` existed nowhere).
- **Connected** — the facet pill row is deleted; requests are pinned at the top in the owner's words
  (*"{name} is trying to add you from your {event name} {event type} event"* · **Accept** / Decline; the
  plain sentence without an event); "Waiting for them" is its own section, last; one heading style across
  the page; alaga are no longer drawn in the roster (the Alaga view owns them — they stay in the roster
  DATA, which the guest list's "Add from people" sheet reads). A refused read now says *"We couldn't load
  your people just now"* instead of "Nobody here yet" (`connectionsUnavailable`). Fixed on the way: an
  incoming request whose sender's name could not be resolved showed the name THEY typed for YOU.
- **Following / Followers** (`lib/people-follows.ts`) — own-session reads scoped to the viewer explicitly,
  names through a new edge-scoped RPC; Unfollow (works on a connected person, who stays connected; the
  PR #6077 tombstone makes it stick), Follow back (public profiles only), "You follow each other".
- **Follow from search** — `PersonHit` gained `followable` / `following`; Follow sits beside Add; new action
  `setFollowByPublicId` resolves the public handle server-side (never a raw user_id from the browser).
  `follow-button.tsx`'s one-way sentence — which its own docblock said becomes a lie the day a follower
  list ships — is retired: *"No request needed — they'll see you among their followers. Unfollow any time."*
- **Requests say where they came from** — the roster reads `created_by_event_id` and names the event only
  through `events_host` (never `events`); the `connection_request` bell title is the owner's sentence
  (`connectionRequestSentence`, one function for the row and the bell).
- **The celebrants, on the guest's Me tab** — for a guest whose seat is linked to their own account: this
  event's celebrants (`isHonoreeRole`) who hold accounts, with Follow and Add. Add (`addCelebrantFromEvent`)
  re-checks the sender is on the event and the target is its celebrant, then sends the ordinary request
  tagged `created_by_event_id`.
- Samahan's second-degree chip: `Connect` → `Add`. First-visit tour `customer_people_v1` on the shipped
  MiniTour. Alaga/samahan server-action redirects now land on their own views.
- **Migration `20271253740454_followers_are_yours_and_requests_say_where_from`** — `user_follows` SELECT
  policy `followed_user_id = auth.uid()` (you read only edges pointing at you); `follow_people_names(uuid[])`
  SECURITY DEFINER, answers only for ids with a live edge to/from the caller (anon revoked); a BEFORE
  INSERT/UPDATE trigger refusing a `created_by_event_id` whose sender does not belong to that event.
  Tested in `tests/db/followers-are-yours.db.test.ts` (8).

SPEC IMPACT: DECISION_LOG.md — an "AS BUILT — THE PEOPLE REDESIGN" row is owed under the 2026-09-28 People
rows (views by URL, the migration's three parts, the celebrants list's account rule, and the known limit
below); left for the controller to record at merge. Known limit: a celebrant who is NOT a co-host sees the
plain "is trying to add you." (no event name), because the name is read only through `events_host`.

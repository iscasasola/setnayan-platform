## 2026-09-06 · feat(rail): the rail splits by KIND — Planner and Together get their own rows

Owner, with Studio standing at fourteen rows: *"should all of these be in studio or studio should
only be for the ones with payment/upgrades? and we will cluster all free for life on a different
cluster?"* — and, given the choice, ruled **split by kind, not by price**.

**Why price was the wrong key, stated before the decision.** The rail's groups have always been
identities and their own subtitles say so — Studio *"the things you make"*, Planner *"things you
plan with"*, Builder *"things you book & pay with"*, Together *"things you do with people"*. And a
price-keyed rail reshuffles itself: in the two days before this ruling the 3D Plan became free, the
Custom QR became free and the monogram halved. Three products are free-with-a-paid-upgrade (Papic
and its credits, the Event Hub and its Pro, the free monogram maker and its ₱500 animation), so each
would have had to sit in both clusters at once.

`StudioApp.railGroup` now says which group renders a row; absent means `studio`, so every product
that predates the split keeps its place untouched.

| group | rows |
|---|---|
| **Studio** — the things you make | Setnayan AI · Event Hub · Papic · Live Studio · Patiktok · 3D Plan · Mood Board · Pakanta · Logo Maker |
| **Planner** — things you plan with | Marketplace · Guest list · Seat plan · **Budget** · **Schedule** |
| **Together** — things you do with people | **Samahan** |

**Two new free-tool doorways** (owner: *"add these"*): `/budget` and `/schedule`, the last two of the
free workspace without a page. Both `doorwayOnly`, so Planner is empty inside an event — the event's
own rail already carries them.

⚠ **The Schedule page does NOT repeat two claims from the old `/features` page.** Checked, not
assumed: `.ics` calendar sync and *"every vendor on that block gets a notification"* are **not
shipped** — the only `.ics` in the repo is the save-the-date, the budget feed and a single vendor
appointment, and the route's only notification fires when the couple resolves a vendor's suggestion.
The page describes what the code does instead.

**And a Samahan doorway** (owner: *"we also want to feature our samahan/groups"*). `/samahan`
existed only as `/samahan/join/[token]` — the door an invited person walks through — so the word was
reserved while nothing public explained what a samahan IS. Together, not Studio, and not
`doorwayOnly`: Samahan is account-level, so nothing doubles it inside an event.

🔑 **"Stories every hour" was right, and I was wrong to doubt it.** The API enforces one clip per
member per hour (`UNIQUE (community_id, user_id, hour_bucket)`; the strip header reads *"one an
hour, gone after 24"*). The page carries the 24-hour LIFETIME rather than the hourly CAP: the
lifetime is the promise a reader needs, the cap is a rate limit and a number.

Migration `20271208401830` reserves `budget` and `schedule` — body read from production's own
`pg_get_functiondef` today, per the collision lesson of 2026-09-05. `samahan` was already reserved
in 2026-08-11.

Guards moved with the structure, none weakened: the doorway list is 15+2, `suiteKeys` and
`studio-follows-you-in` now filter by group as well as `doorwayOnly`, and two new tests pin the
halves a count cannot see — the Planner rows present with no event and absent inside one, and
Samahan in Together and never in Studio.

SPEC IMPACT: DECISION_LOG row added (rail structure, 2026-09-06).

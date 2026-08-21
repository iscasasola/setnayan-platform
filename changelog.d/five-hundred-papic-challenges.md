## 2026-08-21 · feat(papic): 631 challenges, searchable, and a board that knows what kind of party it is

Owner: *"we want to create a 500 papic challenges … activities that they can talk
make people do during the event. or something they can share to the host. like a
greeting, a story."* Then the seven shapes, verbatim: a confession box · an
on-the-spot anywhere challenge · one that includes the host · one that includes
other people · a selfie · a flex of what they wore or brought · a special message
for the couple. Plus: *"here they can filter it so they can pick which challenge
they like. also search. but we will show the top 20 most picked challenges."*

**The pool: 60 → 631** (346 photo · 285 video). Five of the seven shapes already
had a home and were GROWN, not replaced — `stories` (the confession box),
`couple_family`, `meet_room`, `fashion_candids`. Three categories are new:
`selfie`, `anywhere`, `greeting`.

**🚨 A live defect is fixed, measured not assumed.** Every one of the 60 shipped
challenges was written for a wedding and the library had no way to say so. Read
out of production 2026-08-21: the event `movie-night` is of type `date` and was
carrying a full 20-slot board asking two people to *"dance with the bride or
groom"*, to *"catch the newlyweds mid-kiss"* and to get *"a photo with one of the
couple's parents."* `event_types` scopes a row; both lanes of
`ensure_papic_board` now ask for it. 475 of the 631 fit any celebration, so no
board goes short. Zero completions exist in production, so no guest is
un-finished by a row leaving a board.

**🔒 A wedding's board does not move.** All 571 new rows are unranked and numbered
above `library_id` 99, and the Setnayan lane backfills `ORDER BY priority_rank
NULLS LAST, library_id` — so the shipped sixty still win every slot they won
yesterday. Asserted against the exact 20-id board read out of production, not
argued.

**The picker.** Search + twelve theme chips + Photo/Video, running as a URL query
— the chips are links and the search box is a GET form, so there is no client
bundle and it works with JavaScript off. Default view is the owner's top-20 most
picked, from a new aggregate-only RPC (`papic_challenge_pick_counts`); with zero
picks in production today the shelf **says so** and shows recommendations under a
different heading, rather than presenting our own list as other people's choices.

**Tokens.** `{host}` · `{hosts}` · `{event}` join `{who}`, resolved per event at
READ time from `event_type_profiles.terminology` — so a birthday's Papic board
and a birthday's seating page finally say "the celebrant" together. `{host}` is
only ever an object: "the couple" takes a plural verb and "the celebrant" a
singular one, and a test refuses any prompt that lets it start a clause.

Guards: 18 pool assertions (the wording lock, the ten-second rule, token scope,
board-move safety), 9 picker assertions (the search box is a PostgREST filter
expression — allow-list, never escape), 12 db assertions that CALL the board and
the guest reader. The migration is GENERATED from
`apps/web/lib/papic-challenge-pool.ts`; `scripts/emit-papic-challenge-pool.mjs
--check` fails CI if the two drift.

SPEC IMPACT: `0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md` §9 —
the library is 631 rows across 12 categories, rows carry an event-type scope, and
the couple's picker is search + filter over the whole pool rather than a list of
the story questions. `DECISION_LOG.md` row 2026-08-21.

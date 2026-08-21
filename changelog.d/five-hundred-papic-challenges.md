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

### Follow-up, same day: the drift guard could not run

Wired as its own `ci.yml` step it died on every PR with `ERR_MODULE_NOT_FOUND:
Cannot find package 'tsx'` — `tsx` is a devDependency of `apps/web`, not of the
repo root, and the step ran from the root. **All three ci.yml edits (step, env
binding, check line) were correct; the RUNTIME was not there.**

🔑 **A guard that cannot execute is worse than no guard** — it fails loudly, for
a reason unrelated to what it guards, and teaches whoever sees it to look past
it. Moved into the unit suite, which already runs under tsx; the three CI edits
are reversed and the `--check` CLI is kept for humans. Mutation-verified in its
new home (occurrences 1 → 0, test red, restore asserted, green again).

### A real screen, and the couple may pick all twenty (owner, 2026-08-21)

> *"the need to have a real screen to pick their challenges up to 20 challenges."*

**New route `/dashboard/[eventId]/studio/papic/challenges`.** The picker left the
Papic setup page, where it sat under the camera ladder, the pool balance, the
Drive connection and the seat list. Defensible for twenty story questions; not
for 631 — this is a *choosing* task, and a choosing task buried under a settings
page is one people abandon. The setup page keeps a summary and a door, rendered
by **the same component** with `standalone` off, so the two cannot disagree about
how many are chosen.

**🚨 THE COUPLE LANE WAS CAPPED AT TEN WHILE THE BOARD SHOWED TWENTY.** A couple
who picked twelve got ten. The other two had no board position, and the only
sentence anywhere that mentioned it sat at the *bottom* of the picker, after they
had already chosen. Migration `20271155952591` lifts the ceiling to the whole
board; the count now leads the screen and counts down as they pick.

**⚠ ONE THING IS NOT LIFTED, AND IT IS ABOUT SOMEBODY ELSE'S MONEY.** A booth
mission a supplier PAID for keeps its slot: the ceiling is `20 - sold`, measured
vendor-lane-first. A flat 20 makes the Setnayan target go **negative** the moment
a sponsorship exists (`20 - 20 - 5 = -5`) and the allocator would place 25 rows
in 20 seats — and, worse than the arithmetic, a paid placement would vanish the
instant the couple added a twentieth of their own, silently. Today the ceiling is
exactly 20: production holds zero sponsorships. The screen says so when it isn't.

**The limit is enforced twice, deliberately.** The Add button becomes a disabled
*Full* chip, and the server action refuses independently — this is a POST
reachable from a stale tab, and `lib/supabase/client.ts` ships a browser client
to every visitor by construction. 🔑 *A limit that only exists in the UI is not a
limit*; without the server half the extra rows would exist, be counted on the
couple's own list, and never reach a guest — the same silent drop, one layer
down. Both refusals write an outcome into the URL and the page **renders it**:
a guard that refuses in silence is indistinguishable from one that passed.

🪤 **The mutation run caught its own harness again.** Reverting the ceiling to 10
turned two tests red (correct), but the restore failed — the migration is a NEW
file, untracked, so `git checkout --` had nothing to restore from and left the
sabotage in place. Only the asserted restore-count found it. **Restore from an
explicit backup, not from git, when the file is not yet committed.**

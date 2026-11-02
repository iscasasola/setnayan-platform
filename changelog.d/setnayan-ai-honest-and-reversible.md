## 2026-08-12 · fix(setnayan-ai): the card lists only what ships, and the product can be switched off

Owner 2026-08-12, on the paid Setnayan AI card: *"if they are free, do not add
them. just list what is true."* A verification pass had found that four of the
nine claims on that card — which sits directly above a buy button — should not
have been there.

### The card

| claim | verdict |
|---|---|
| *"Sends your first inquiry to the best fit"* | **No implementation existed anywhere.** Three hits in the repo: the id, the icon, the sentence. The only inquiry fan-out is the FREE one at sign-up. **Removed.** |
| *"Chases the vendors who go quiet"* | Fires internally but reaches nobody — notifications carry GUARDS only, and the home rail is handed an empty inquiry list. Blocked twice over. **Removed.** |
| *"Sorts by distance to your venue"* | **FREE.** Nearest-first is the default order for everyone. **Removed.** |
| *"Ranks every vendor by how well they fit"* | The "% match" is **FREE** too — `category-search.ts` says it outright: *"the paid layer is the concierge, not the score"*. But the SUGGESTED TEAM's rank mode genuinely is paid (`compat` vs `cheapest`). **Reworded, not removed.** |

🔑 **A card can lie in three directions.** Selling something unbuilt takes money
for nothing. Selling something already free takes money for nothing just as much.
And deleting `rank` outright would have **under**-claimed a real paid capability.
That is why the guard pins an exact id set rather than a count.

Three genuinely-paid capabilities that were never on the card have been added in
their place, so the card is honest without being thinner: watched-vendor price
changes, watched-vendor date changes, and run-of-show clashes. All three verified
against shipped guard code.

⚠ **The removed ones are coming back.** The owner's ruling is BUILD them, not
delete them — `first_inquiry` specifically becomes a real Setnayan AI feature
(the planner writing and sending a requirement-filled inquiry to the single best
fit, then following it up), distinct from the free fan-out, which stays free.
Each id goes back on the card in the same commit that makes it work.

### 🔴 And you could not switch it off

`setPlanningMode` — the flip between guided and manual — has existed since
2026-06-05 with **zero callers anywhere in the app**. A couple who bought
Setnayan AI and switched to manual had no way back on, and a button reading *"Turn
on Assisted planning"* was a `<Link>` to `/dashboard`, **a page with no such
control**. It spent the one moment someone was willing to act.

Both directions are now real forms posting to the action: turn it on from the
manual state, switch to manual from the active one. Access is kept either way —
this stops the ranking and the nudges, it is not a cancellation.

### Guards, all four mutation-tested

`lib/setnayan-ai-card-lists-only-what-ships.test.ts` fails when an unbuilt claim
returns, when a free feature returns, when the off-ramp is deleted, and when the
on-switch reverts to a link. Each was reproduced by hand and confirmed red.

### Two existing guards caught me

- **A wedding-ism in my own new copy** — "a wedding-day one". Setnayan AI ships on
  16 event types; corrected to "a problem on the day itself".
- **A stale assertion pinning the wording of the capability I deleted.** Retired
  with its reason rather than forced back — the "reception" sweep beside it still
  runs over every word, and that is the half that actually guards the event types.

🪤 Running the copy test directly printed **`# tests 0 … # fail 0`** — the
`[eventId]` brackets are a glob character class, so it executed nothing and
exited green. Verified through the real suite instead.

The port-control baseline is regenerated in this PR; the only removal in the diff
is the fake `/dashboard` link, and the guard had named exactly one route before
regeneration, so no other route's removal is absorbed.

Verified: 7710 unit · 1185 db · `tsc --noEmit` clean · eslint 0 errors · 10 lint
scripts pass.

SPEC IMPACT: None — no pricing, SKU or schema change. The owner ruling is in
`DECISION_LOG.md` 2026-08-12.

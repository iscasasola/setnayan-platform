## 2026-08-05 · fix(guest-site): a guest can reach their RSVP again — the Save-the-Date film stops being a wall on every event, not just one

**On the one real wedding site, a guest could not RSVP at all.** Verified against the live page: `setnayan.com/cale-ice` served film beats, "Add to calendar" and a bottom bar — **1,748 characters of text in total**. No RSVP. No venue details. No seat. No door to their invitation. `/maria-and-jose` served all of it.

The difference was one column: `events.website_open_browse` — TRUE on the sample event, FALSE on the real one.

**The RSVP was not hidden behind the film. It was never rendered.** With the flag off, `site-body` rendered `stdFilmView()` *alone* — `normalBody()` was not in the tree. And both film-exit controls carried the same flag, so **the way out shipped in #4096 could not reach a real event either**. The body decision is identity-independent, so a guest holding their personal QR hit the same wall — until 19 September for that wedding, and **forever for a couple with no date set**.

**The gate conflated two questions.** *"May this visitor browse the new open site?"* is what `openBrowse` decides. *"May this visitor LEAVE a full-screen takeover?"* was never a flag's business. `StdFilmHandoff` is now mounted unconditionally.

### It does not touch the no-backfill verdict

The 2026-07-22 council rule — *"existing launched events opt in via the board toggle; a couple 60 days out must never have her site reshape overnight"* — is about a site **reshaping**. Nothing reshapes here: `normalBody()` is that event's **own** body, the same one it already renders inside 90 days. The film still plays first and in full, so nothing bought is skipped. The only change is that the site now exists to step into.

And this is what the owner asked for on 2026-08-03, recorded in the wrapper's own docblock: *"we want them to navigate around right away."* The fix was built that day and gated behind a flag his wedding does not have.

### Two stale guards corrected rather than deleted

- **`std-film-handoff.test.ts` was inverted.** It asserted the *old* gate — that only open-browse wraps, and `canExit={plan.openBrowse}`. It now asserts the opposite and says why, so a re-gating is caught as a defect rather than read as configuration. **Mutation-verified:** restoring the gate fails with *"the handoff has been re-gated on openBrowse — that is the defect, not a config."*
- **A test I wrote hours earlier was deleted, with its reason kept in place.** It pinned *"the resolver renames the home tab by phase; the live bar does not"* — true when written, false an hour later when #4089 wired the bar to the resolver. `siteMenuTabs` now has **zero production consumers**, so the test asked a dead module and could never fail. Its own escape hatch said to delete it once the bar became phase-aware. **A guard pointed at something nothing uses is worse than no guard: it reads as coverage.**

Verified: 6505/6505 unit tests, `tsc --noEmit` clean, lint clean.

SPEC IMPACT: Recorded in `DECISION_LOG.md` — the finding, the live verification, and why the no-backfill verdict is untouched.

## 2026-08-05 · fix(guest-site): the wedding day is on the venue's clock, and two tabs stop doing nothing

Three defects from the event-website sweep, all live, all silent.

### 1 · The wedding day ran on the wrong clock — 8 hours out

`getDayOfPhase` anchored midnight with `new Date(y, m, d)`, and its comment said that gives *"the dashboard user's local midnight"* — true in a **browser**. It also runs in server components, and Vercel runs **UTC**. For a Manila wedding the anchor landed at 08:00 local, so day-of mode covered roughly **07:00–16:00**: off before the reception started, and never on for the evening, which is when a Filipino wedding actually happens.

The five clock PRs merged 2026-08-04 fixed the schedule, the broadcast and the vendor countdown — and stopped one file short of the one that decides whether the guest page is in `live` at all.

`getDayOfPhase` / `isInDayOfWindow` now take the venue's IANA zone (Intl-only, no new dependency) and both guest routes pass `eventTimezoneFromCoords(...)`. Omitting it keeps the old behaviour, so no caller changed meaning by accident. An unrecognised zone falls back rather than throwing — a bad string must not take the guest page down mid-wedding.

⚠ **The test had to compare two EXPLICIT zones, not local-vs-venue.** On a Manila dev machine `new Date(y,m,d)` and Manila-midnight are identical, so the obvious test passes while the server is 8 hours out. **That is exactly why this survived.** It now asserts Asia/Manila leads UTC by precisely 8 hours across 48 sampled hours. Mutation-verified.

### 2 · Two tabs in the bottom bar did nothing when tapped

The same defect twice — a slot emitted without asking whether its destination exists.

- **Details** was pushed for every `before`-phase page regardless of whether a details section rendered. Now gated on presence.
- **Join**, shown to a visitor with no invite, pointed at an in-page anchor that is an empty `aria-hidden` div when open-browse is off. Meanwhile `/[slug]/invite` — which actually adds a relative to the guest list — was linked from **nowhere**. A stranger's Join now leaves for that page, and **locks** rather than pretending if the caller could not build the link.

### 3 · The Camera button dead-ended the people it was built for

`/papic/guest` with no guest session rendered a heading, a sentence, and **nothing to press**. It is reached from the public day-of bar by exactly the visitors who have no invite — the cousin who scanned the poster at the venue — so on the wedding day the browser back button was their only way out. It now offers a way back.

Verified: 6511/6511 unit tests, `tsc --noEmit` clean, lint clean.

⚠ **Surfaced, not fixed — a product question, not a bug.** The `live` window is `T-1h .. T+8h` from **midnight**, i.e. roughly **11pm the night before to 8am on the day**. Even with the timezone corrected, a 7pm reception is never inside it. That is the shipped semantic and changing "when is a wedding live" is an owner decision, not a silent redefinition. Recorded in `DECISION_LOG.md`.

SPEC IMPACT: None for the three fixes. The window question is logged for the owner.

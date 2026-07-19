## 2026-07-01 · feat(routing): /u/[user] profile + /u/[user]/[event] nesting (PR3 of 8)

Introduces the user-facing nested URL scheme, additively (nothing removed; the
bare-root event URLs on printed QR codes keep working in parallel).

- **Middleware rewrite** — `/u/{userSlug}/{eventSlug}[/rest]` internally rewrites
  to the existing `/{eventSlug}[/rest]` route subtree, so the event landing page
  **and all 12 of its subroutes** (hub, recap, welcome, venue, invite,
  find-my-table, find-seat, seat, seat/claim, redeem, live-wall, sign-out) render
  under the pretty nested URL with **zero route duplication**. Mirrors the
  existing vendor-subdomain rewrite pattern. Bare `/u/{userSlug}` (no event
  segment) is not rewritten — it falls through to the new profile page.
- **New `app/u/[userSlug]/page.tsx`** — public account profile. Dispatch (owner
  ruling 2026-07-01): exactly 1 ongoing event → redirect straight into it; 2+ →
  picker; 0 → the couple's published editorials (past public celebrations), with
  a graceful empty state. Only surfaces *effectively public* events (reuses
  `resolveEffectiveVisibility`), so unlisted / pre-STD-launch pages stay hidden.

Additive & safe: the QR/link cutover to `/u/` URLs and the permanent
bare-root→`/u/` redirect (for already-printed codes) land in a later, flagged PR.

SPEC IMPACT: New public-URL surface `/u/[user-slug]` and `/u/[user-slug]/[event-slug]`. Supersedes the locked iteration-0002 bare-root `setnayan.com/[event-slug]` as the canonical event URL (old form still resolves; redirect cutover pending). DECISION_LOG row to follow.

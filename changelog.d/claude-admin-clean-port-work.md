## 2026-11-19 · refactor(admin): 17 Work screens on the clean template (admin clean port 2 of 6)

This is the same owner ruling as Money (19 Nov, "ok" on the Money drawing; DECISION_LOG "ADMIN CLEAN PORT"). It is a repositioning only: same reads, actions, posted names and copy. Explanations moved word for word behind ⓘ tips.

- **Ported:** work, repost-watch, force-majeure/[flagId], reviews, corrections, pax-changes, demo-vendors (+ inquiries, [threadId]), concierge-abuse, fraud, integrity-watch, pakanta, editorial-review (+ [editorialId]), account-deletions, help, chat-flags.
  - No cards, visible titles or ledes, and no typewriter capitals.
  - Filter-pill strips became one dropdown (same addresses).
  - Failed reads are the amber line; empty states are the template line.
  - Buttons use the shared action-button class.
- **Held for a follow-up** (other open PRs edit the same files): disputes, approvals, event-deletions, the force-majeure list page, user-reports, and the Work landing's queue list (`queues-triage-feed.tsx`).
- Baselines were lowered by a fresh regeneration.

SPEC IMPACT: None. Covered by the 2026-11-19 DECISION_LOG row "ADMIN CLEAN PORT".

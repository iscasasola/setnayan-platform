## 2026-07-15 · refactor(vendors): remove the Merkado desktop section tab strip (Shortlist · Build · Budget · Compare)

Owner: the top-of-page section nav on the couple Merkado (`/dashboard/[eventId]/vendors`)
"is no longer needed since they are all there already." Since the 2026-07-09
integrated single-scroll + two-column desktop layout, every section is already on
screen at once (shortlist left; build / budget / compare in the sticky right rail),
so the in-page anchor nav duplicated what the eye can see.

- Removed the desktop `sn-seg` anchor nav from `services-takeover.tsx`, plus the
  now-orphaned `active` scroll-spy state, IntersectionObserver, and scroll-lock ref.
- The `BB_TAB_EVENT` bus + `?tab=` contract is UNCHANGED: the mobile docked sub-nav
  (`customer-section-subnav.tsx`) and `goToBuildTab` callers still smooth-scroll to
  sections, and `?tab=compare` / `?tab=budget` deep-links still auto-expand.
- `eventId` / `initialTab` stay in the props contract (no longer read) so the page
  caller is untouched.

SPEC IMPACT: DECISION_LOG.md row appended 2026-07-15 (Merkado desktop tab strip removed; sections all-visible). Code is canonical per the 2026-07-02 stub reset.

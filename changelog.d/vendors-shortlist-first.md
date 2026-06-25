## 2026-06-25 · feat(vendors): drop Summary tab — Services takeover opens on Shortlist

The couple's Services/Explore takeover (`/dashboard/[eventId]/vendors`) no longer
has a Summary cover tab. It now opens directly on the **Shortlist** bench, so the
section set is **Shortlist · Build · Compare** (owner: "remove the summary part and
start with shortlist right away").

- `lib/budget-build.ts` — removed `'summary'` from `BUDGET_BUILD_TABS` + its
  `TAB_META` entry (and the now-unused `Gauge` import). The desktop tab strip,
  the docked mobile section sub-nav, and `customer-nav-config.ts` all derive from
  this constant, so they drop Summary automatically.
- `vendors/page.tsx` — `initialTab` default flips `summary` → `shortlist`; the
  `BuildSummary` slot is gone.
- **Relocated the Setnayan AI on/off toggle** (`SummaryAiToggle`) from the deleted
  Summary cover to the top of the Shortlist content. It was the workspace's only
  in-context AI-personalization control (no `/details` fallback), so it keeps a
  home rather than being orphaned.
- `services-takeover.tsx` — dropped the `summarySlot` prop + slot.
- `nav-registry-defaults.ts` — removed the `customer.budget-subnav.summary` slot
  default and renumbered (Shortlist = sortOrder 0), mirroring the 2026-06-20
  lock-tab removal precedent.
- Deleted the orphaned `_components/build-summary.tsx`.

SPEC IMPACT: 0021 couple dashboard / Budget_Build_Services_Takeover_2026-06-08 —
the takeover is now a 3-section flow (Shortlist · Build · Compare); the Summary
cover (Phase-5 progress cover) is retired and the Setnayan AI toggle lives on
Shortlist. Corpus note to follow in DECISION_LOG.md.

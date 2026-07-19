## 2026-07-15 · fix+feat(overview): proto-fidelity 2-column grid, countdown bug, date-predicate unification

The event Overview (`apps/web/app/dashboard/[eventId]/_components/event-dashboard.tsx`)
now matches the approved prototype (`prototypes/event_dashboard_v2_2026-07-15.html`)
after the owner's side-by-side against Glass PR-2 (#3256).

**Two bugs fixed (shared root cause):**

- **Countdown numeral rendered "—" on a dated event.** `daysOut` gated on
  `event_date_precision === 'day'`, but this surface defaulted a NULL precision
  column to `'year'`, so any real dated event whose precision column was null
  (migration drift; the column DEFAULT is `'year'` while the sibling backfill
  rule is "event_date present ⇒ 'day'") resolved `daysOut = null` → "—". Now a
  present `event_date` with a null/invalid precision resolves to `'day'` (matching
  the migration's own backfill and the details/vendors readers), so the numeral
  SSRs the real value and CountUp animates it.
- **Focal said "The date is locked" while the Countdown tile said "no firm date
  yet" for the same event.** Both now derive from a single `hasFirmDate`
  predicate (`precision === 'day' && event_date present`); the duplicate
  countdown tile is gone (countdown lives ONLY in the focal). `focalDateLabel`
  is also precision-aware now (year/month no longer masquerade as a full day).

**Recomposition to proto fidelity:**

- Top grid is now the proto's 2-column grammar (≥lg): LEFT = the obsidian Big-Day
  focal as a tall column (date · locked line · countdown numeral · % planned bar ·
  and, in the AI state, the Suri briefing + "The Watch" attention rows INSIDE it —
  the watch rows keep their #3265 inspector triggers). RIGHT = the decisions digest
  panel (mono open-count + top-3 rows with inline real-CTA buttons + "All N
  decisions ↗" → `#decisions`) over a 2×2 of live minis (Guests · Budget ·
  Schedule · Messages), each real-data-or-nothing (hidden when zero).
- The old separate 4-ring bento and the standalone "Suri on watch" section
  dissolve into the grid. The full Decisions board, "Around your event" band, and
  Journey rail (with its existing "You are here" chip) stay below as shipped. Hero
  simplified to greeting + sentence (one home per number). Blur budget above the
  fold = focal(1) + digest(1) + ≤4 minis + chrome(2) ≤ 8 (§ 1.6).

**Chrome (event-scoped only; shared nav primitives untouched):**

- New flat "Also in this event" sidebar group (Schedule · Seat plan · Budget) in
  `customer-nav-config.ts` — plain links with matchPrefix, no submenus; Budget
  respects the Simple-Event `budget` hideKey.
- Event identity plaque atop `customer-sidebar.tsx` (monogram chip + name +
  `{type}·{date}` mono line) linking to `/dashboard` — reuses the existing
  all-events picker as the switcher affordance; the shared `DoorwaySidebarHeader`
  was not touched. Topbar breadcrumb skipped (section-awareness needs client
  pathname / shell surgery).

SPEC IMPACT: None (UI fidelity + bug fix; no schema, price, SKU, or flag change).
Design source: App_Wide_Glass_Rollout_Plan_2026-07-15.md § 3.1.

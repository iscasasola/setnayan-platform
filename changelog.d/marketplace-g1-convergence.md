## 2026-07-27 · feat(marketplace): Explore Replan PR-G1 — build-candidate schedule convergence, the SOFT tier (flag-dark)

The owner's sentence (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §6, decision #12):
*"when they add someone to the build, the options on the bench change — some become
incompatible to the schedules of the service chosen. the goal is to bring everything
down to one choice."*

The Marketplace bench now reasons over the build's **shared-date window** — the
intersection of every locked + candidate vendor's declared calendar, inside the
couple's own date-probe window. Each candidate they add narrows it. A bench vendor
with no free day left inside that window dims, has its Add-to-build and Lock
withheld, and sinks behind a **"Doesn't fit your build"** divider with the clashing
candidate NAMED — and comes straight back the moment that candidate is removed.

Everything below is behind `isExploreReplanEnabled()` (`NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED`,
default OFF, not flipped here). Flag OFF: no extra query, no banner, no divider, no
dim, no new DOM — the bench renders byte-identically to production.

### What landed

- **`apps/web/lib/build-date-window.ts` (new · pure · 34 unit tests)** — the whole core:
  `resolveProbeWindow` (what window is even convergeable), `resolveBuildDateWindow`
  (the intersection + the guilty-pair hint), `classifyAgainstBuildWindow` (the per-card
  verdict), `partitionByBuildFit` (the stable sink), and the copy functions
  (`convergenceBanner`, `noSharedDateBadge`, `freeDaysLine`, `doesntFitReason`).
- **`apps/web/app/dashboard/[eventId]/vendors/page.tsx`** — the window + per-vendor
  verdicts, resolved server-side. Reuses the shipped engines exactly as the spec
  directs: `getBatchVendorAvailableDays` (already batched on the bench for the
  single event-date probe) extended to the window set — **ONE extra read for the
  whole bench, only under the flag. No new query pattern, no N+1, no per-card probe.**
  Team membership comes off rows already in memory (`vendors` + `buildPicksByGroup`).
- **`apps/web/lib/shortlist-taxonomy.ts`** — three new `ShortlistVendor` fields
  (`buildFit`, `buildClashWith`, `freeDaysLine`), fed from maps resolved once upstream.
- **`apps/web/lib/bench-card-actions.ts`** — new `schedule_clash` build action.
  Withholds **only** Add-to-build and Lock; the Inquire leg survives ("Ask anyway",
  decision #3). A vendor already IN the build is exempt — it helped define the window,
  and it keeps the Remove control that fixes the clash.
- **`_components/shortlist-categories.tsx`** — the convergence banner between the
  Coverage Strip and the bench (narrowing → the shared dates · one left → "Only {day}
  works for everyone" · empty → the shipped Compare copy "No single date works — swap
  one"), the in-rail sink divider, the dim, the amber "No shared date with {candidate}"
  fit-badge, and the card's mono "Free: …" line.
- **`_components/bench-vendor-actions.tsx`** — the withheld-CTA note that names both
  the reason and the fix.

### Design note — behaviour, not appearance

The playable prototype is the BEHAVIOURAL reference only. Its emoji, red pills and
generic cards are **not** reproduced: every new element here is drawn inside the
bench's own scoped `.slcat` stylesheet with Lucide icons and the app's `var(--sans)` /
`var(--mono)` / `var(--ink)` / `var(--gold-deep)` tokens, and the clash reads **amber**
(the shipped `.fit.warn` tone), never red — the vendor is fine, it is the couple's own
build that narrowed past them.

### Honesty rules kept (each one is load-bearing)

1. **Fail-open, end to end.** `getBatchVendorAvailableDays` returns a full window on a
   read error; a vendor with no calendar signal gets a `null` verdict, never a clash;
   any throw clears the whole block. A calendar flake reads "free", never a false
   "booked" — and it never sinks a vendor.
2. **A build's own conflict is never a vendor's fault.** When the shared window is
   ALREADY empty, no per-card verdicts are issued at all and the entire bench stays
   browsable; the banner says "swap one" instead. (The prototype sinks every card in
   that state — fine with its 3 fixture vendors, a dead surface on a real 40-card
   bench. Deliberate, documented divergence.)
3. **This tier reserves nothing.** It reads vendor-declared calendars and says so — the
   converged banner explicitly states "nothing is held yet". That is exactly why PR-G1
   was unblocked from the lock-reserves-date gate that still governs the HARD anchor
   tier (PR-G2, not in this PR).
4. **Column-explicit reads only.** No new query; the one read this adds reuses the
   shipped batched helper's existing select list.

### Prerequisite verified, not re-fixed

The spec named the `/date-selection` dead vendor pool (Postgres 42703, two non-existent
columns on `vendor_profiles`) as a prereq. **It is already fixed on `main`** (2026-07-26):
the select list now lives in `apps/web/lib/date-selection-vendor-pool.ts` as
`VENDOR_POOL_SELECT = 'vendor_profile_id, services'`, guarded by
`date-selection-vendor-pool.columns.test.ts` against `supabase/migrations`, with a Sentry
capture so a read error and an empty result can no longer look the same. Nothing to do.

### Verification

`pnpm exec tsc --noEmit` clean · `pnpm lint` no new warnings in touched files ·
`pnpm run test:unit` green, including **34 new** tests in `build-date-window.test.ts`
and **6 new** clash cases in `bench-card-actions.test.ts`.

SPEC IMPACT: None — this implements `Explore_Replan_BUILD_SPEC_2026-07-27.md` §6
(decision #12, SOFT tier) as written. The one deviation (an empty build window issues
no per-card verdicts rather than sinking the whole bench) is recorded above and in the
`build-date-window.ts` module docblock. The spec's PR-G1 prerequisite — the
`/date-selection` 42703 dead pool — was already closed on `main`; no spec edit needed.

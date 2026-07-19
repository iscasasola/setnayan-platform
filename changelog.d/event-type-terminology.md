## 2026-06-24 · feat(event-type): terminology resolver + high-visibility copy pass — iteration 0053 Phase 4 (Unit 3)

Replaces the highest-visibility wedding-literal **copy** on non-wedding-reachable dashboard surfaces with profile-driven variants, so a non-wedding event stops reading like a broken wedding. **Weddings byte-identical** — the diff confirms every wedding string is verbatim.

- **`apps/web/lib/event-term-copy.ts`** (new) — `term(profile, { wedding, generic })`: returns the `wedding` string **verbatim** when `profile.eventType === 'wedding'`, else the hand-authored `generic`. Pure + client-safe (no Supabase/cookies). Keyed variant pairs (not a `wedding`→`eventWord` substitution) so the wedding arm is a literal the diff/compiler verifies and the generic arm can drop wedding-only beats.
- **`budget/page.tsx`** — the intro `Set your total wedding budget…` (deferred from Unit 2) now renders an `isWeddingBudget ? <>verbatim</> : <>…event…</>` JSX pair (JSX whitespace-collapse keeps the wedding render identical).
- **`schedule/page.tsx`** — the two intros (`Your run-up to the wedding…` / `Build your wedding-day timeline…`, deferred from Unit 1) via `term()`.
- **`documents/page.tsx`** — `Your wedding documents` H1 via `term()`; static `metadata` converted to `generateMetadata` so the page `<title>` is per-event-type.
- **`dashboard/[eventId]/page.tsx`** — the `'Your wedding'` countdown-header fallback name (used only when `display_name` is null) is now `'Your event'` for non-weddings.

Discriminator everywhere is `event_type === 'wedding'` / `profile.eventType === 'wedding'` (the canonical identity). No migration; copy-only.

**Deferred (documented long-tail, low-visibility — not engine-blocking):** the schedule EventDayView empty-state + the guests empty-state (both need a resolved-string prop threaded into a nested component), and the documents `Government paperwork` section sub-label (the section is already data-empty for non-weddings post-Unit-1). These are deep/per-feature microcopy, safe to leave.

**Verify:** `pnpm typecheck` clean · `pnpm lint` clean (no flagged files) · unit suite green · **`git diff` confirms every wedding-variant string is byte-identical to the original** (curly quotes `’ “ ”`, em-dash `—`, `.ics` backticks all preserved); `term()` returns the wedding arm verbatim → wedding render unchanged by construction.

SPEC IMPACT: Iteration 0053 Phase 4 Unit 3 (terminology, bounded high-visibility pass). Logged in `DECISION_LOG.md`. [[project_setnayan_event_type_engine]]

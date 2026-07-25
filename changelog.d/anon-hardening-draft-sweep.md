## 2026-07-18 · feat(privacy): abandoned anonymous-draft cleanup sweep (anon-onboarding hardening PR-3)

Closes the retention gap in the anon-draft onboarding feature
(`NEXT_PUBLIC_ANON_ONBOARDING_ENABLED`). Anon drafts commit a real account +
event holding third-party guest PII under an unidentifiable controller; many
never convert, and no existing sweep touched them — so they persisted forever.
`public.events` has no owner FK, so deleting the anon auth user alone would
ORPHAN the event. This adds a safe, cron-free sweep.

- **`lib/anon-draft-sweep.ts`** — `runAnonDraftSweep()` finds unconverted anon
  drafts (placeholder `@anon.setnayan.local` email + past a TTL), **re-confirms
  `auth.users.is_anonymous === true`** via `getUserById` before any delete (the
  placeholder email can linger on a converted account, so this guards against
  deleting a real account), then deletes in the only safe order: **event(s)
  first** (cascades every event-scoped child AND the NO-ACTION user-FK children
  that would otherwise block the auth delete), **then the auth user** (cascades
  `public.users`). Excludes any event carrying an `orders` row (BIR/contract
  legal hold). Batched (50/run), skip-on-throw, best-effort. `maybeRunAnonDraftSweep()`
  is the cron-free wrapper (DAILY DB claim via `claimPeriodicJob`).
- **`app/api/cron/anon-draft-sweep/route.ts`** — retained manual/curl trigger,
  `CRON_SECRET`-guarded (timing-safe, fail-closed), mirroring the retention-sweep
  route.
- **`app/admin/layout.tsx`** — fires `maybeRunAnonDraftSweep()` from the existing
  `after()` block alongside the retention + Papic sweeps.

⚠ **Owner/DPO decision:** the retention window (`ANON_DRAFT_TTL_DAYS = 30`) is a
conservative default and a sign-off item — tighten as directed before enabling
the feature. **Follow-up:** R2 objects an abandoned draft may have uploaded are
not reached by DB cascade; pair with an R2 lifecycle rule / prefix purge (tracks
with the PR-4 upload-scoping item). Feature stays flag-OFF; the sweep is a no-op
until a real abandoned draft exists.

SPEC IMPACT: None. (Launch-posture + RA 10173 retention hardening; new internal
sweep lib + cron route, no product/pricing/SKU/schema change.)

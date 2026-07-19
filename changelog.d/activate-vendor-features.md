## 2026-06-21 · chore(flags): activate the vendor feature set — service wizard, verified experience, bundle nudge, named calendars (owner "make it live")

Their migrations are applied to prod (`20270208451790`, `20270209713470`, `20270209420471`, `20270209750853`) and — for Named Calendars — the conservation check passed (0 orphaned booking pools; 193 service→calendar memberships backfilled). So the four feature flags graduate from opt-in build gates to **LIVE by default**, with an env kill-switch retained (set the flag to `"false"` to disable).

Mechanism: each read flips from `process.env.X === 'true'` to `!== 'false'`. NEXT_PUBLIC vars are unset in prod, so they now evaluate ON; setting any to `false` in Vercel reverts that one feature. (Done in code rather than via Vercel dashboard env so activation is deterministic + consistent across all read sites.)

- `NEXT_PUBLIC_SERVICE_WIZARD_ENABLED` → guided create-a-service flow (services/page.tsx)
- `NEXT_PUBLIC_VENDOR_EXPERIENCE_ENABLED` → declared/DTI-verified experience (vendor-experience.ts helper)
- `NEXT_PUBLIC_BUNDLE_NUDGE_ENABLED` → inquiry bundle nudge (inquiry-composer.tsx)
- `NEXT_PUBLIC_NAMED_CALENDARS_ENABLED` → named calendars (schedule-pools.ts resolver + vendor-schedule.ts + calendar/page.tsx — all three flipped together for consistency)

Safety: Named Calendars is behavior-preserving for existing services (backfill guarantees calendar pool == category pool → identical `pool_id`s → the acquire RPC is unchanged); the marketplace is still founder-only (pre-public-vendor-launch), so blast radius is minimal. `.env.example` comments updated to reflect live-by-default + the kill-switch. tsc clean.

SPEC IMPACT: activates 0022 service wizard / vendor experience / named calendars + the inquiry bundle nudge. Logged in `DECISION_LOG.md`.

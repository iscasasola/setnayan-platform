## 2026-06-30 · feat(setnayan-ai): wire the per-USER subscription gate into every experience surface

Setnayan AI is finalizing as a per-USER subscription (₱499 / 28-day cycle) that
covers ALL of a user's events, replacing the per-EVENT one-time unlock. The
library + buy/entitlement plumbing already shipped, but the new per-user gate
`isSetnayanAiActiveForUser` had ZERO call sites — every surface still gated on the
per-event `isSetnayanAiActive`. This PR threads the per-user-aware path through the
surfaces so that, once the owner flips
`platform_settings.setnayan_ai_per_user_enabled=true`, a subscriber gets AI on
every event.

- New `lib/setnayan-ai-server.ts` · `getEventHostAiSubscription(admin, eventId)`
  — resolves the LATEST `active_until` among an event's host/co-host members
  (`event_members.member_type='couple'` → `user_ai_subscription`), EVENT-level so
  it works identically on dashboards and the public guest page. Admin/service
  client (works without a session). Fail-soft (`{ active_until: null }`).
- New `lib/integration-config.ts` · `resolveSetnayanAiPerUserEnabled()` — DB-first
  tri-state read of the per-user flag, mirroring `resolveSetnayanAiPaywallEnabled`
  (no env fallback; default OFF). UNCACHED so a console flip takes effect next
  request.
- New pure gate `shouldOfferSetnayanAiPurchaseForUser` in `lib/setnayan-ai.ts`
  (mirrors `shouldOfferSetnayanAiPurchase`): suppresses the per-event buy CTA for
  a host with an active subscription when the per-user flag is on.
- Threaded into 6 surfaces (dashboard home, /studio/setnayan-ai, vendors page +
  its category-search + build-3state actions, public /v/[slug]) plus the vendors
  buy-CTA. Each site SHORT-CIRCUITS the subscription DB query when the per-user
  flag is off, so there is ZERO added query/perf cost while it's off.
- Account nav: linked the eventless per-user buy page (`/dashboard/setnayan-ai`)
  into `account-nav-config.ts` (Sparkles icon · on the nav-icon allowlist). Safe
  now — the page renders "coming soon" while the flag is off.
- Migration `20270328922621_setnayan_ai_sub_billing_period_and_retire_stories.sql`
  (FILE ONLY · NOT applied to prod): data hygiene — `SETNAYAN_AI_SUB`
  billing_period one_time → per_28d; deactivate stale paid `PAPIC_ADDON_STORIES`
  (Guest Stories is owner-locked FREE). Idempotent. Does NOT flip the per-user
  flag, does NOT activate `SETNAYAN_AI_SUB`, does NOT deactivate per-event
  `SETNAYAN_AI` — those are owner-gated go-live steps handled separately.

HARD CONSTRAINT held: byte-identical when the flag is OFF (the new gate delegates
to the per-event gate; the subscription query is skipped). Entitlement is ADDITIVE
(`events.setnayan_ai_active === true OR host has an active subscription`) — never
strips access from couples who bought the per-event unlock.

Public copy: swept marketing/pricing/llms.txt/help.ts/JSON-LD; all already
catalog-driven or aligned to "₱499 / 28-day cycle" (PR #2437 de-staling held).
The only "₱3,999 / one-time" mentions left are historical docstrings + a dormant
retired component, not user-facing. No copy changes were needed.

SPEC IMPACT: Corpus already reflects the per-user subscription model (owner
session — `project_setnayan_ai_subscription_redesign`, `project_setnayan_pricing_tiers`).
This PR is code wiring only; no new spec delta. Go-live (flipping the flag +
activating the SKU + reconciling public /pricing) remains owner-gated.

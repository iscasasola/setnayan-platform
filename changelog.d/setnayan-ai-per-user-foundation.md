## 2026-06-29 · feat(setnayan-ai): per-user subscription foundation + template renderer (INERT)

Foundation PR for reframing Setnayan AI from a per-event ₱3,999 one-time
entitlement to a per-USER monthly subscription that covers ALL of a user's
events at once (brainstorm 2026-06-29; corpus `Setnayan_AI_Template_Library.md`
+ `Setnayan_AI_Subscription_Decisions_2026-06-29.md`). Everything here is
ADDITIVE + INERT behind a default-OFF flag — zero change to live behaviour.

- **Migration `20270321174775_setnayan_ai_user_subscription.sql`** — new
  `user_ai_subscription` table (one window `active_until` per user; RLS at create:
  self-read + admin-write, no client self-grant) + a tri-state feature flag
  `platform_settings.setnayan_ai_per_user_enabled` (NULL/default = OFF, mirroring
  `setnayan_ai_paywall_enabled`). Additive + idempotent; touches no live table and
  leaves the per-event `events.setnayan_ai_active` flag untouched.
- **`lib/setnayan-ai.ts`** — additive per-user helpers: `userAiSubscriptionActive()`
  (lazy/cron-free window check) + `isSetnayanAiActiveForUser()` which is
  byte-identical to `isSetnayanAiActive()` while the per-user flag is OFF, and only
  when ON fans the subscription out to entitle the event (per-event flag OR active
  sub; Manual toggle still wins; either co-host's sub covers a shared event →
  never double-charged). Existing gates unchanged.
- **`lib/setnayan-ai-templates.ts`** — the deterministic template library (33
  templates × 5 categories: Secretary 9 · Guard 10 · Commend 4 · Inference 5 ·
  Trend 5) as typed data + a pure `renderTemplate()` (terminology resolution +
  string substitution, NO LLM → free). Event-type-aware via the 0053 terminology
  slots; GRD-02 (PH statutory) is wedding-only. Client-safe (type-only profile
  import).
- **Tests** — `setnayan-ai-templates.test.ts` + `setnayan-ai.test.ts` (18 cases):
  renderer substitution/terminology/pluralize/variants/wedding-only gating, and
  the gate's inert-by-default + fan-out behaviour.

NOT in this PR (later inert PRs, gated on owner sign-off): the trigger engine,
weekly-digest assembly, consent-gated Inference/Trend activation, term-pass SKU
rows (need the price), `/admin/integrations` toggle, and recurring billing.

SPEC IMPACT: None to the live product — additive/inert foundation. Corpus design
docs (`Setnayan_AI_Template_Library.md` v1.1, `Setnayan_AI_Subscription_Decisions_2026-06-29.md`)
+ DECISION_LOG row already landed 2026-06-29; this is the matching code spine,
dormant until the per-user flag is flipped after the 6 sign-off items are settled.

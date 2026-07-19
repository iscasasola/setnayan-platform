## 2026-07-12 · feat(anti-fraud): Phase D — lead trust badge (informed accept)

Fourth slice of fake-inquiry protection (corpus: `Vendor_Fake_Inquiry_Protection_Build_Plan_2026-07-11.md`). Surfaces a POSITIVE, non-PII trust cue on the masked lead so a vendor's accept — and, under Phase B, their held token — is informed. Mirrors the shape + gating of the existing returning-client badge.

- **`supabase/migrations/20270727940889_get_lead_trust_flags.sql`** — `get_lead_trust_flags(vendor_profile_id, event_ids[])` (SECURITY DEFINER, ownership-checked, batched, granted to `authenticated`). Returns `active_planner` = the couple already has ≥1 ACCEPTED vendor thread on the event (real engagement / social proof). Scoped to the caller-vendor's own inquiry events; returns only the boolean (the count of competing vendors is deliberately NOT exposed).
- **`apps/web/lib/chat.ts`** — `fetchLeadTrustActivePlanner()` wrapper (fail-soft: any error → `false`, so the masked lead still renders).
- **`apps/web/lib/inquiry-gate.ts`** — flag `leadTrustBadgeEnabled()` (`NEXT_PUBLIC_LEAD_TRUST_BADGE_ENABLED`, default OFF).
- **`apps/web/app/vendor-dashboard/messages/[threadId]/page.tsx`** — fetches (pending-only, flag-gated, fail-soft) and renders an "Active planner" chip on the masked lead, next to the existing basics + returning-client + AI chips.

**Presumption-of-a-real-couple, in code:** the badge is *purely positive* — there is no "risky"/"suspicious" tier, a brand-new couple simply gets no chip (never a warning), the couple never sees it, and it never gates anything. With Phase B's hold model a newcomer accept is refundable anyway, so this only nudges, never scares vendors off fresh couples.

Merging changes nothing until `NEXT_PUBLIC_LEAD_TRUST_BADGE_ENABLED=true` + the migration is applied. Independent of Phases B/C. Follow-ups: surface the chip on the inbox list too; add account-age / event-completeness signals.

SPEC IMPACT: None (flag-gated additive vendor-only UI; no schema change beyond a new read-only RPC, no pricing/SKU change). Logged in DECISION_LOG 2026-07-12 + the corpus build-plan Build-progress table.

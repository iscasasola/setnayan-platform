# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-13 · feat(vendor): explicit lead-token reconciliation on event deletion

Implements §6 of `Vendor_Token_Settlement_and_Lifecycle_2026-07-13.md` (corpus): when an event is deleted, its outstanding **HELD** lead-token holds are released (refund — the reservation was never debited) while **CONSUMED** holds are left spent (already settled). Rides the existing `NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED` flag — no-op when off.

Note: a hard-delete already frees held reservations *implicitly* (both `lead_token_holds.event_id` and `vendor_event_unlocks.event_id` are `ON DELETE CASCADE`, and a held row was never debited, so dropping it frees the reservation). This change makes that release **explicit and intentional** instead of a silent cascade side-effect: it stamps a `release_reason`, drops the never-charged unlock rows (frees the verified weekly cap), and — the real forward value — **returns the affected vendors** so the caller can notify them, and gives a **reusable primitive** for the future couple-facing soft-cancel.

- **Migration `20270806687608_release_event_lead_holds_on_delete.sql`** — `release_event_lead_holds(p_event_id, p_reason)`: a CTE modeled on `sweep_ghosted_lead_holds`, scoped by `event_id` instead of age — releases `held` holds → `released` (reason), drops their unlock rows, leaves `consumed` untouched; returns `{hold_id, vendor_profile_id, tokens}`. Service-role.
- **`lib/lead-token-holds.ts`** — `reconcileEventLeadHoldsOnDelete(eventId, reason)`: flag-gated (returns `[]` when off), admin-client, best-effort (never throws — a delete must not fail because reconciliation hiccuped), returns the released vendors for future notification.
- **`app/admin/events/actions.ts`** — `deleteEvent` calls it BEFORE the cascade delete.

No behavior change while the hold flag is off (no holds exist to release). The end-state token math for a hard-delete is unchanged from cascade; this adds intentionality + auditability + the notification/soft-cancel seam.

SPEC IMPACT: implements `Vendor_Token_Settlement_and_Lifecycle_2026-07-13.md` §6 token math. Still to come per that spec (a distinct UX feature): the couple-facing **cancel/postpone** flow + vendor **notification delivery** + settled-hold **record retention** — none exist today (only admin hard-delete). No new product surface, pricing, or schema beyond the one function.

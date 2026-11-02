## 2026-06-20 · feat(vendor): guided "create a service" wizard (flag-gated) — Services builder redesign

The UI half of the Services builder redesign (the diff-5 vendor-retention surface). Replaces the see-everything-at-once create form (four independent saves) with a step-by-step flow that ends in ONE atomic save (the `save_vendor_service` RPC). Behind `NEXT_PUBLIC_SERVICE_WIZARD_ENABLED` (default OFF) so it's inert until the migration is applied.

- **`_components/service-wizard.tsx`** (new client) — one `<form>` → `commitVendorService`, 7 toggled steps (3 required to publish: category · price · Setnayan-Exclusive perk; optional: comes-with links, availability/capacity, payment plan; then review & publish). All step fields live in the DOM so a single submit gathers everything; back/continue nav; "Publish" disabled until a perk is set, plus "Save as draft". Reuses `Field` + `SubmitButton`; a lightweight inline installment editor emits the same `item_*` field names the legacy schedule editor uses.
- **`services/actions.ts` → `commitVendorService` + `parseScheduleRows`** — validates everything in TypeScript (reusing the legacy `parse*` helpers + the create-time tier-cap check — single source of truth, no SQL/TS drift), builds the JSONB args, and calls the atomic `save_vendor_service` RPC. Handles create (no id) and is edit-capable (id present) for a later edit route.
- **`services/new/[category]/page.tsx`** (new route) — hosts the wizard for a chosen category (the category is picked on the Services page, fixed for the flow); loads the vendor's other categories (link options) + tier (capacity ceiling).
- **`services/page.tsx`** — left-rail picker links route to `/services/new/<cat>` when the flag is on, else the legacy `?add=` form (unchanged). The existing edit card is KEPT as the quick-tweak path (owner 2026-06-20).
- **`.env.example`** — documents the flag + go-live step.

Time-slots stay on the legacy add/delete actions (Enterprise-only + booking-lock). Edit-via-wizard deferred (the card remains the edit path); `commitVendorService` already supports it for a follow-up. Honest difficulty: 5 → 3 (Stepper-pattern + capacity-vs-slots residual; the kept card stays lossy on its path). Owner go-live: apply migration `20270208451790`, then set the flag true. tsc clean.

SPEC IMPACT: 0022 vendor services builder. Logged in `DECISION_LOG.md`. Spec: `Services_Builder_Create_Flow_Design_2026-06-20.md`.

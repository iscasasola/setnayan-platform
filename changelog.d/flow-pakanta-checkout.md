## 2026-06-21 · fix(pakanta): couples can actually buy — checkout drawer replaces the dead /orders/new loop (flow wave D, critical)

The user-flow audit's #1 **critical**: Pakanta's "Continue to payment" saved the brief then redirected to `/dashboard/[eventId]/orders/new?service=pakanta_basic` — a **retired route** that silently bounced back to Studio. The couple literally could not buy their wedding song (revenue-blocking dead-end).

Wired Pakanta to the **proven `InlineCheckoutDrawer`** (the same in-page checkout custom-qr / papic / setnayan-ai use), reusing existing payment infra rather than writing new payment logic:

- **`studio/pakanta/page.tsx`** — fetches `fetchPlatformSettings()` (BDO/GCash) and passes it to the form (mirrors custom-qr).
- **`studio/pakanta/_components/pakanta-music-form.tsx`** — on "Continue to payment", `savePakantaIntake` saves the brief (`status='purchase_pending'`), then the form reveals `<InlineCheckoutDrawer serviceKey="PAKANTA" …>` (`originalPriceCentavos` from the catalog `pricePhp`, settings threaded) with a "Your music notes are saved — complete payment" note. The drawer's trigger is `type="button"` → safe inside the form. Brief save and payment are decoupled (the admin `/admin/pakanta` queue reads the draft).
- **`pakanta-actions.ts`** — `savePakantaIntake` no longer returns the dead `/orders/new` URL (`redirectTo` is always `null` now); docblocks corrected.

Verified: drawer props match custom-qr's proven set (eventId/serviceKey/displayName/originalPriceCentavos/settings/trigger*); `readyToPay` reveals the drawer; settings threaded page→form→drawer; 0 leftover `res.redirectTo` usage; no dead route in the code path; all 3 files pre-flighted clear of open PRs. tsc/lint/build via CI; payment behavior is the existing, proven drawer (not new logic).

SPEC IMPACT: none (bug fix — restores a purchasable SKU). Last of the 6 audit criticals. Backlog: `02_Specifications/User_Flow_Audit_Backlog_2026-06-20.md`.

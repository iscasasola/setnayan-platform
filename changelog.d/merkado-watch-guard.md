## 2026-07-10 · feat(vendors): Merkado watch guard + demand watch (PR-4 · S4)

Setnayan AI now watches the couple's picked **build** for feasibility conflicts and demand contention, warn-only (it flags, never blocks — owner-locked). A banner renders above the Build engine when AI is active and the team has picks.

- **`lib/merkado-guard.ts`** — pure `computeBuildGuard`: across the picked team it checks **budget** (Σ pick costs vs total), **shared date** (do the date-constrained picks share a candidate date?), and **reach** (does every pick reach the venue?). Fail-open — an unknown input never raises an issue (never fabricates an unavailability). 7 unit tests.
- **`MerkadoGuardBanner`** — green "Suri's watching — your team fits" when clear, else an amber list of specific things to review; plus a **demand-watch** note per picked vendor another event is eyeing on the couple's date ("lock it in soon"). Server-rendered, no new query — reuses the fit-badge data already resolved on the page (`buildPicksByGroup`, `enrichmentByVendorId` reach, `dateFitByVendorId`, `eyeingByVendorId`, the budget).
- Gated on `aiActive` (the watch guard is a Setnayan-AI feature) + a non-empty build; behind `BUDGET_BUILD_ENABLED` with the takeover.

Also fixed a **phantom-class bug** shipped in the fit-check QR page (#2960): it used `sage-*` Tailwind classes, but the green scale is named **`success`** — so the "fits" verdict rendered with no green tint. Swapped `sage-*` → `success-*` (the guard banner uses the correct tokens from the start).

Files: `apps/web/lib/merkado-guard.ts`, `apps/web/lib/merkado-guard.test.ts`, `apps/web/app/dashboard/[eventId]/vendors/_components/merkado-guard-banner.tsx`, `apps/web/app/dashboard/[eventId]/vendors/page.tsx`, `apps/web/app/vendor/fit/[ref]/page.tsx`.

SPEC IMPACT: None — surfaces existing fit/demand data as a warn-only build guard; no schema, pricing, SKU, or engine change. (Advances the deferred "watch guard + demand watch" item.)

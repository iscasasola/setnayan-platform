# 0018 Supplies Marketplace — SPEC COMPLETION BRIEF (not engineering)

> **⚠️ READ FIRST — this is NOT an engineering brief. 0018 is a placeholder iteration. The spec at `/Users/icecasasola/Documents/Claude/Projects/Setnayan/0018_supplies_marketplace/` is not yet fleshed out enough for engineering. The next session in this worktree should run a SPEC SPRINT (Cowork pattern) before any code lands.**

**Worktree:** `~/Setnayan/.claude/worktrees/0018-supplies-marketplace/`
**Branch:** `claude/0018-supplies-marketplace` (off `origin/main` at `efe5521`)
**Iteration spec:** `/Users/icecasasola/Documents/Claude/Projects/Setnayan/0018_supplies_marketplace/`
**Estimated effort:**
- **Spec sprint:** 1-2 weeks (Cowork sessions with owner to define scope, taxonomy, SKUs, vendor model)
- **Engineering (after spec):** TBD — depends on spec outcome; rough estimate 4-8 weeks

**External blockers:** None at engineering time; spec definition is the blocker.

---

## How to start this work

```
cd ~/Setnayan/.claude/worktrees/0018-supplies-marketplace
claude
```

Prompt the fresh session with: **"Read SPEC_COMPLETION_BRIEF.md and continue. We're in spec-sprint mode, not engineering mode."**

---

## 1. Current state of 0018

Per CLAUDE.md iteration table: "Supplies marketplace placeholder — third-vertical 'Supplies' exploration (deferred; precursor to the second-vertical car-services concept)."

Per App_Build_Status.md: "🟡 V1 build pending (promoted from V1.5+ 2026-05-18). Now visible as 'Coming soon' in add-ons grid (PR #22); promotion is spec-side only — engineering capacity planning pending."

**What this means:** 0018 was promoted to V1 on 2026-05-18 but the underlying spec is still a placeholder. The "Coming soon" tile is live; the actual marketplace + flow does not exist.

---

## 2. What the spec sprint needs to define

The next session should run a Cowork sprint with the owner to lock these decisions. Don't start coding until each of these is settled:

### Scope decisions

1. **What is a "Supply"?** Is it:
   - Disposable wedding consumables (napkins · table linens · centerpieces · candles · favors)?
   - Rental goods (chairs · tables · arches · backdrops)?
   - Both?
   - Something else (food ingredients, decor purchase, etc.)?
2. **First-party (Setnayan-owned inventory) vs Marketplace (third-party sellers)?** Each model has wildly different ops + capital requirements.
3. **Geographic scope.** Metro Manila only at V1? Nationwide? Per-region inventory?
4. **Delivery model.** Setnayan-coordinated logistics OR seller-direct delivery OR couple pickup?

### Taxonomy

5. **Category list.** What categories of supplies? Take from existing 0006 canonical_services? Or define new?
6. **Per-category attribute schemas** (mirror 0044 Per-Category Vendor Attribute Schemas pattern). Different supplies need different filters (size · color · material · capacity · etc.).
7. **Search + filter UX.** Mirror 0006 vendors filter popup pattern, or different?

### SKU + pricing model

8. **Pricing model.** Per-unit purchase? Per-event rental? Bundle pricing?
9. **Commission structure.** Setnayan Pay 5% flat (per 0034) or different rate for supplies?
10. **Payment flow.** Same apply-then-pay model as vendor bookings (0034), or different (e.g., immediate-pay for inventory-light items)?
11. **Refund/return policy.** What happens if a supply order is cancelled? Damaged? Wrong item delivered?

### Seller-side model (if marketplace pattern)

12. **Who can sell?** Existing verified vendors (0006) only, OR a separate seller registration path?
13. **Inventory management.** Does the seller list inventory + Setnayan facilitates discovery + checkout? Or are sellers fully external (we just send leads)?
14. **Seller verification.** Same 12-doc checklist as 0006 vendor verification, or different?
15. **Seller payout model.** Same T+1 verified / 3-stage milestone as 0006, or different?

### Couple-side flow

16. **Surface placement.** Inside the dashboard add-ons grid? A separate top-nav item? Integrated into the vendor marketplace?
17. **Add-to-event flow.** Same cart pattern as 0034, or a separate flow?
18. **Day-of integration.** Do supplies have a day-of mode integration (0031) for guest-visible items like favors?

### Strategic relationship to second-vertical car-services

19. Per CLAUDE.md memory `project_setnayan_second_vertical_car_services`, Supplies is a "precursor to the second-vertical car-services concept." Clarify: is Supplies a **stepping stone** to launching car services, or a **standalone** V1 iteration that doesn't require the car-services context?

---

## 3. Recommended spec-sprint sequence

| Step | What | How long | Output |
|---|---|---|---|
| 1 | Owner conversation to lock the 19 questions above | 1-2 calls (~2 hours total) | Decision document in `0018_supplies_marketplace/decisions_2026-05-XX.md` |
| 2 | Draft 0018 spec body (mirror 0006 vendors_management structure) | 3-5 days | `0018_supplies_marketplace/0018_supplies_marketplace.md` ~ 500-800 lines |
| 3 | Draft 0018 prototype (HTML mockup) | 2-3 days | `0018_supplies_marketplace/0018_supplies_marketplace.html` |
| 4 | Decision log entry in CLAUDE.md + iteration table update | 30 min | New decision log row |
| 5 | Cross-iteration impact assessment (0034 cart? 0006 vendor model extension? 0044 attribute schemas?) | 1 day | `0018_supplies_marketplace/cross_iteration_impacts.md` |
| 6 | Engineering brief — replace this file with one based on the locked spec | 1 day | `ENGINEERING_BRIEF.md` |

After step 6 lands, treat this worktree as a normal engineering worktree and start building.

---

## 4. Pre-flight questions to ask the owner

Bring these to the first owner call:

1. "Is 0018 actually a V1.0 iteration, or should it be V1.1/V1.2 — the spec is genuinely incomplete and rushing it may hurt V1 launch quality."
2. "What problem are couples trying to solve when they need Supplies that isn't already solved by Vendors (0006)? Examples: caterers handle consumables; venues handle linens; etc."
3. "Is the strategic intent 'sell things on the platform' or 'help couples find suppliers'? Different products."
4. "Do we have any seed sellers / suppliers identified? Without 5-10 launch sellers, the marketplace is empty on day 1."
5. "Is car-services Vertical 2 still on the roadmap? If yes, Supplies' design should pre-build the vertical-agnostic pattern."

---

## 5. What this worktree should NOT do

- ❌ Do NOT write engineering code yet — the spec doesn't exist
- ❌ Do NOT replace the "Coming soon" placeholder with anything — that's correct UX while spec is being defined
- ❌ Do NOT copy 0006 vendor schema wholesale — supplies may need a fundamentally different data model
- ❌ Do NOT promise the marketplace will ship in V1 — the spec sprint may surface that V1.1 is more realistic

---

## 6. Pointers

- Spec placeholder: `/Users/icecasasola/Documents/Claude/Projects/Setnayan/0018_supplies_marketplace/`
- Memory: `project_setnayan_second_vertical_car_services` — strategic context for the second vertical
- Reference pattern (for spec structure): 0006 vendors_management, 0044 vendor attribute schemas, 0045 vendor product catalogs
- COWORK.md (corpus root) — Cowork workflow doc; lines 44-54 are the canonical update sequence

---

## 7. When this brief gets replaced

Once the spec sprint is complete (steps 1-5 above), replace this file with a standard `ENGINEERING_BRIEF.md` matching the 0009 / 0005 / 0011 / 0012 / 0017 pattern. At that point this worktree behaves like any other iteration worktree.

---

**End of spec completion brief.**

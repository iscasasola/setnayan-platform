## 2026-07-02 · feat(vendor-services): coverage polish — ownership check, wizard select, visual nesting (rework follow-ups)

Three refinements closing out the coverage-first Services rework:

- **Ownership validation** — `createVendorService` / `updateVendorService` / `commitVendorService` now resolve `coverage_id` via `resolveOwnedCoverageId()`, which returns it only if the coverage belongs to this vendor (else null). Defense-in-depth on top of the UI already scoping to the vendor's own coverages.
- **Wizard coverage select** — the guided create flow (`services/new/[category]`) offers a "Coverage" picker (the vendor's coverages), so new cards can be assigned at creation, not just via edit.
- **Visual nesting** — the service list is grouped under `Parent › Branch › Leaf` coverage headers (assigned coverages first, in the coverage panel's order; unassigned last), via a stable sort + a header row when the coverage changes (card interior untouched).

tsc + vendor-layout + nav-icon + ESLint clean.

SPEC IMPACT: None. Rework fully complete; only the owner sign-off on public-id letters `V`/`O` remains.

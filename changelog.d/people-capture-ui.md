## 2026-07-12 · feat(family-graph): dependent capture UI on the People page (Phase 3 · flag-off)

The guardian adds the people they care for — a child (<18) or elder (>50) — on the People page, behind `dependentPeopleEnabled()` (default OFF). Builds on the dependent foundation.

- **`dependent-actions.ts`** — `addDependent` (age-fence enforced authoritatively: 18–50 refused with a friendly "invite them instead"; birthdate required; per-field consent stamped; owner-scoped via RLS) + `deleteDependent` (RA 10173 erasure). Both hard-gated on the flag.
- **`_components/dependents-section.tsx`** — the list (name · relationship · fence band · **derived next milestone**) + the add form (name · birthday · relationship · optional sex for 18F/21M · optional religion). Remove uses the in-app confirm.
- **`people/page.tsx`** — renders the section when `dependentPeopleEnabled()`; both flags off → the existing coming-soon preview (unchanged). Fence-error flash wired.

Inert in production (flag off) — stores no dependent data until the DPO clears counsel + flips the flag.

SPEC IMPACT: master plan Phase-3 People capture UI (dependent layer), flag-off.

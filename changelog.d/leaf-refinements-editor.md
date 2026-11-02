## 2026-07-03 · feat(taxonomy): leaf refinements (attribute schema) editor in the Studio

The Taxonomy Studio's Services tab now edits each leaf's **Refinements** — the
per-leaf vendor attributes stored in
`canonical_service_schemas.category_specific_attributes` (owner clarification:
"the refinements are the attributes of the leaf categories"). Previously the
Studio only showed a count badge and a one-shot "starter refinement" at leaf
creation; there was no way to grow or curate a leaf's attribute schema.

Each canonical service row gets an expandable **Refinements (vendor attributes)**
panel:

- **Add refinement** — label → immutable snake_case key (collision-checked),
  type picked from the vendor-form-supported set (yes/no · number · short/long
  text · pick-one · pick-many · free tags); pick-one/pick-many carry an initial
  comma-separated option list.
- **Add option** to a pick-one / pick-many refinement.
- **Rename** a refinement's display label (label is pure display — safe; the key
  never changes).
- **Retire / restore** a whole refinement or a single option (soft — the entry
  stays in the schema so saved vendor answers keep validating; only new picks
  are hidden).
- Shared attribute groups (faith / dietary / pricing) are shown read-only.

All edits are **ADDITIVE-ONLY** per the 0044 never-orphan contract: field keys
and option **values** are immutable (an option string IS the value a vendor
stored, so **option-relabel is deliberately NOT offered** — it would orphan every
saved payload). Each mutation bumps `schema_version` +1, writes one
`admin_audit_log` row (`taxonomy.leaf_attr_*`, before/after of the touched
field), and revalidates the Studio, `/vendor-dashboard/attributes`, and
`/explore`.

Retire is honoured at the two render consumers: the vendor attributes form and
the fast service-card chips now hide retired fields/options from new picks — but
the form keeps any retired field/option a vendor **already answered** so the
saved value is never dropped on re-save. The parse/validate path uses the full
schema unchanged, so past answers remain valid forever. The couple-side matcher
(`preference-match.ts`) reads stored payload values only and needs no change.

Pure JSONB logic + validation live in `lib/leaf-attribute-schema.ts` (immutable
keys/values, retire round-trip, version-bump semantics) with node:test coverage;
the server actions stay thin.

SPEC IMPACT: None. Additive JSONB editing within existing `canonical_service_schemas`
rows — no migration, no schema change, no pricing/SKU impact.

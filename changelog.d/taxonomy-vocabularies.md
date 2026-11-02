## 2026-07-03 · feat(taxonomy): vocabularies join the Studio — event types, faiths, leaf flags

The Taxonomy Studio (`/admin/taxonomy`) becomes the single classification control
room. A new **Vocabularies** rail group folds in the scoping vocabularies and the
per-canonical leaf flags:

- **Event types** (`event_type_vocab`) — first editor anywhere: relabel, reorder,
  activate/deactivate (soft — status → `retired`), and add-new (snake_case key
  slugified from the label, immutable, additive-only). Per-event-type usage counts
  (tiles + canonicals that scope to it) make deactivation informed. Vocab edits
  NEVER touch the `events.event_type` enum/CHECK or the couple-side Event-Type
  Engine gating — the UI says so ("used for category scoping").
- **Faiths (wedding types)** (`faith_vocab`) — relabel, reorder, activate/deactivate,
  add-new (Title-Case key minted from the label, acronyms preserved, immutable),
  plus the **per-faith launch gate folded from the retired `/admin/wedding-types`**
  (Live / Coming soon / Disabled + readiness threshold + vendor/venue readiness
  counts). Per-faith tagged-service counts shown. ⚠ Faith keys stay Title-Case and
  case-sensitive — nothing lowercases them; the faith_key ↔ ceremony_type mapping
  goes through `lib/faith-registry`.
- **Leaf flags** — the inspector's Services tab gains a quiet "Scoping flags" panel
  making `is_tradition` / `is_ph` / `is_rental` / `marketplace_hidden` editable
  (toggles) and `secondary_tiles` editable (cross-listing checkboxes) — previously
  settable only at leaf creation. `dietary` stays read-only (a dietary canonical
  must never be faith-gated — mirrors `setServiceFaith`'s de-faith guard).

`/admin/wedding-types` is retired to `redirect('/admin/taxonomy?view=vocab-faith')`;
its nav entries were removed (sidebar, bottom-nav route list, `nav-registry-defaults`
seed with a dated tombstone, `routes.ts` + `route-meta.ts` helpers), the
`/admin/onboarding` cross-link + `/admin/more` tile repointed. Launch-gate write
logic moved to a shared `lib/wedding-types-mutations.ts` core (called by both the
Studio actions and the legacy form wrappers), now audit-logged.

Faith-list consolidation: new `lib/faith-vocab.ts` is the ONE shared faith module —
DB-first read of `faith_vocab` (respecting status) with a Title-Case fallback,
re-exporting the derived types (`WeddingFaithKey`, `FaithKey`) and folding in the
`getActiveFaithKeys` validation-set read (old `lib/faith-vocab-db.ts` is now a thin
re-export shim). The ~17-list debt was already largely consolidated by
`lib/faith-registry.ts` (2026-06-12); the remaining lowercase ceremony-type pickers
(venue-form, vendor profile, onboarding flows) stay put — they key off
`events.ceremony_type` CHECK, not Title-Case `faith_vocab`, so a swap would be a
casing/behavior change (documented remainder, not converted).

All writes single-admin + `admin_audit_log` (before/after) + redirect-back. No
migration (both vocab tables + all leaf-flag columns already exist). No new deps.
Lucide-only. `getTaxonomy()` fallback contract intact.

SPEC IMPACT: None — admin-console internal reorganization; no couple/vendor-facing
behavior, pricing, SKU, or schema change. The per-faith launch gate and the
event-type/faith vocabularies are unchanged in meaning; only their editing surface
moved into the Taxonomy Studio.

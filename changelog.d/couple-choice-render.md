## 2026-07-27 · feat(packages): couple-side choice tree — follow-ups, pick-N, quantities, and the pricing rule that makes them safe

Ships the couple-side RENDERER for branching packages, behind the existing
`NEXT_PUBLIC_PACKAGE_CREDIT` flag (`packageCreditEnabled()`). No new flag. With
the flag OFF the configurator is byte-identical to what shipped: the branching
columns are not even selected, so every line arrives top-level with null pick
bounds and the new tree degenerates to the old flat `is_default_included` list.

**New:** `apps/web/lib/package-choice-tree.ts` — a pure module (no React, no
env, no I/O) holding visibility, pick bounds, quantity bounds, and the
CHARGEABLE BOUNDARY.

- **Follow-up lines** (`parent_option_id`) render only while the option they
  hang from is in force, to unlimited depth, drawn as an indented chain rather
  than a flat list. Unpicking a parent collapses the whole subtree — grandchildren
  included — and forgets the picks underneath it, so a hidden answer can never be
  silently re-committed when the parent is picked again.
- **Choice lines** honour `pick_min`/`pick_max` with a live "2 of 3 chosen"
  counter. Below the minimum the send button BLOCKS, and the copy says why:
  answering fewer questions is an unfinished order, not a cheaper one. Above the
  maximum further options stop accepting picks.
- **Quantities**: a line priced by the hour gets a stepper bounded by
  `max_extra_hours`.
- **Live total** now comes from `choiceTotals`, which calls the same
  `priceCustomizedPackage` the lock action calls. There is no second pricer.

**⛔ THE RULING — a picked follow-up is RENDER-ONLY and priced at exactly zero
in this slice, and so are extra pick-N picks and extra hours.** Not a
simplification: `lockPackage` reads its items with `VENDOR_PACKAGE_ITEM_SELECT`,
which asks for none of `parent_option_id` / `pick_min` / `pick_max` /
`max_extra_hours`, so the server that commits the money cannot see the columns
that define them. Putting those names on the lock path's select is the
documented PostgREST-400-on-a-money-action hazard (see the header on
`PACKAGE_ITEM_AUTHORING_COLUMNS`), in a repo whose migrations auto-apply
unreliably. Independently, the credit engine refuses both shapes outright
(`option_on_excluded_item`, `multiple_options_for_item`), which would fail the
whole lock rather than just the upgrade. Making a picked follow-up chargeable
means teaching the LOCK PATH first; that is a separate wave.

The other half of "zero-priced": `isOptionSelectable` refuses to OFFER a priced
option inside the non-chargeable region, so a preference is always genuinely
free and free is exactly what is committed. It judges the whole line, not just
the option being added — a hole found by a test: `resolveChosenOption` charges
for whichever picked option sorts FIRST, so adding a free option that sorts
earlier than an already-picked priced one would have demoted a ₱1,500 upgrade to
₱0 while the vendor still delivered it.

**Pricer touched, minimally and in the safe direction:** `lockPackage` no longer
spells out its own option narrowing — it calls the new exported
`chargeableOptionIds`, which is the same expression it always used
(`keptItems` + `resolveChosenOption`). Display set and committed set are now ONE
function rather than two copies that agree today. `computeCustomization`,
`keptItems` and the credit engine are otherwise unchanged.

Also: `LockPackageModal` takes a server-resolved `paxCount` (wired from
`/v/[slug]` via `resolveLivePax`, the same call `lockPackage` makes), closing a
pre-existing drift where a per-head upgrade was quoted at pax 0 on the client and
charged at live pax on the server.

Tests: `apps/web/lib/package-choice-tree.test.ts` (48). Every bullet of the
hard constraint is a named test, plus a `display === commit` matrix run over 9
package shapes × both flag states — asserted by running the lock path's own
composition, including the hostile case where a client submits every id it
holds. NEUTRALISATION verified: deleting the follow-up guard in `keptItems`
makes "an unpicked follow-up contributes zero even in its ILLEGAL in-memory
shape" fail with a WRONG TOTAL (₱15,000 vs ₱10,000), then restored.

The follow-up guard in `package-followup-not-priced.test.ts` that pinned the
modal's inline `.filter((i) => i.is_default_included)` was repointed — the rule
moved into `visibleLineTree` — and strengthened: it now pins that the modal
delegates, that it does NOT filter `pkg.items` itself again, and that both root
rules live at the new source.

SPEC IMPACT: None. No schema change, no migration, no pricing model change — the
flag stays OFF and no vendor can author a branching package yet (authoring is
behind `NEXT_PUBLIC_PACKAGE_AUTHORING`, also OFF, and prod has zero
`vendor_packages` rows). The follow-up/pick-N/hours pricing question is recorded
here and in the module header rather than in the corpus, per the code-is-canonical
rule; it becomes a decision only when the lock path is taught these columns.

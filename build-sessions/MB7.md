# MB7 — Port section 04: the render surface, free tier first

**Goal:** 04 exists, honest and free, before a single peso moves.

**Model:** Sonnet · high effort — with one caveat worth an Opus reviewer: the derived panel must
read the **same selection state `buildPrompt()` reads**, or it drifts. That drift is the whole
point of the decision.
**Size:** 1 day. **Depends on:** MB2 (schema), MB3 (shell). Can land after MB5.

## Delivers

- **Designed-parts-only tiles** — never twenty empty boxes. Plus one "Render another part"
  chooser, grouped Room / People / Places
- The whole-look hero
- **The free recoloured-stock preview on every box, forever** — this is the free lane and it never
  expires
- Costs stated **in credits, never in pesos**
- Visible credit balance + purchase button, wired to the MB2 SKU via apply-then-pay
- **The derived "what your render already knows" panel** — reads `RECEPTION_PARTS` +
  `role_palette`, printing human labels (`Option.label`, `nearestColorName()`), never prompt
  phrases
- The per-part note field — length-capped, treated as untrusted input
- Lock, Keep photo, and stale marking as UI state

## Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- `node apps/web/scripts/port-controls.mjs`
- guard: **never pesos in 04** — sabotage: print ₱, confirm red
- guard: the panel **derives**, is not hand-written — add a zone, the panel gains it with no panel
  edit. Sabotage: hand-list the parts, confirm red.
- guard: the stale marker reaches the **render**, not just the state

## Owner decides first

Nothing.

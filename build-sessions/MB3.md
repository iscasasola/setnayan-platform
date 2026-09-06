# MB3 — Port the shell + sections 00 and 01

**Goal:** the real app gets the prototype's spine — the blank-start fork, the selection loop,
Overall Theme, Inspiration.

**Model:** Sonnet · high effort. The prototype is the authoritative reference — *translate, don't
reinterpret* — but the state model makes this the heaviest porting job, so high effort.
**Size:** 1.5 days. **Depends on:** MB0, **and the prototype defect fixes being final.**
Do not port a section whose reference still carries known defects.

## Delivers

- The **two-path blank-start fork** — pick a theme, or create your own. Three empty slots, not
  three pre-filled ones (the couple must be able to delete what they never chose)
- The **selection loop** scoping Setnayan AI — AI advises on the create-your-own path, and on an
  applied theme only once the board becomes the couple's own
- **Section 00** — overall theme name + description, wired to MB0's interpreter
- **Section 01** — inspiration carousels, 3-photo slots, plain labels, the (i) affordances

## Deliberately NOT here

The **gallery picker** is MB10. Inspiration stays upload-your-own plus existing behaviour in this
session. Build the picker once, with the supplier-credit chain attached — not twice.

## Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- `node apps/web/scripts/port-controls.mjs`
- existing mood-board unit tests, run **from `apps/web`**
- a guard that the blank-start fork renders both paths — sabotage: unmount one, confirm red

## Owner decides first

Nothing.

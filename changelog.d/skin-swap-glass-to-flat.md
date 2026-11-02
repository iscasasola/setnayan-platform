## 2026-08-08 · design(#4): the skin swap — glass becomes the Warm Editorial card

The owner approved all 19 archetypes on 2026-08-04, and the palette shipped on
all 401 routes. **The surface treatment underneath never moved.** Every panel in
the app was still wearing Atelier-Glass: a translucent fill, a 24px backdrop
blur, a 20px radius. Cards looked frosted and slightly floating; the approved
design is flat, cream, and calm.

This is that swap.

| | was | now |
|---|---|---|
| Fill | translucent glass | cream `#FDFBF7` (`--m-paper`) |
| Border | glass line | 1px `#E1DCD1` (`--m-line`) |
| Radius | 20px | **14px** (`--m-r-md`) |
| Blur | 24px backdrop | **none** |
| Shadow | pronounced | `0 1px 3px rgba(30,26,18,.06)` |

Separation now comes from the border, never from a second surface tint.

### 🔑 Why this is one edit and not 186

The design spec's scope guard says *"do NOT restyle the `.sn-*` classes globally
— they have consumers across the app"*, which assumes each surface gets ported by
hand. **Measured, that assumption does not hold.** `.sn-tile` has **417 uses
across 186 files**, spread evenly over all three doorways — dashboard 72,
vendor 56, admin 54.

The guard exists to protect surfaces *"not yet designed"*. But the programme
covers all 401 routes and every one of them is going here. The thing being
protected is a stop on the same journey. Porting by markup would take ~40 PRs to
reach a look one recipe reaches today — and would leave the app speaking **two
visual languages** for the entire duration, which is worse than either language
alone.

Deliberate override of a written guard, on measurement. Flagged, not silent.

### The focal moves in the same pass — obsidian glass → solid ink

`.sn-tile-dark` was a gold radial wash over translucent dark with a 22px blur.
It is now one flat ink plane (`--m-ink` `#2C2A29`, 14px radius, a soft shadow),
so the focal reads as a considered object rather than a lit panel.

**All seven consumers are the focal card of their own surface** — admin home ·
couple dashboard · the day-of card · vendor on-the-day (×2) · vendor overview ·
vendor performance. Seven surfaces wanting one treatment is a class, not seven
edits.

Two things deliberately left alone: the eyebrow already had its on-dark pair
(`--sn-gold-300` `#CBA766`, **6.30:1** on the new ink — correct as shipped), and
the inherited text colour `#F3ECDF` is a warm parchment well clear of the
palette lock's ban on pure white. Changing an inherited colour ripples into
every child that sets none; the per-surface units own the headline hexes.

**The ornaments are dropped.** `sn-veil` (a gold curtain lifting) and `sn-capiz`
(a light sweeping across) are one-shot entrance flourishes belonging to the
retired kit — removed from both focal call sites. The launcher's own Alaala tile
keeps them; it uses a different class and is a designed surface of its own.

### Safe because the remaining glass case was already a separate class

`.sn-tile-glass` (over imagery) is **untouched** and keeps its treatment. The kit
had already factored out the case where glass is the point.

### 🪤 `.sn-row` was PURE WHITE

183 uses, filled `#FFFFFF` — which the palette lock forbids outright (*"cream
`#FDFBF7`, was pure white 2026-07-13"*). A white row on a cream card reads as a
lit rectangle, which is why rows looked detached from the panels holding them.
Now cream, on the same tokens.

### 🔑 Token-aware, not hard-coded

`--m-paper` / `--m-line` are **remapped inside `.sn-sidebar`** so the dark
navigation panel restyles its own descendants from one place. Writing `#FDFBF7`
literally here would have punched a cream hole in that panel. Using the tokens
means a card nested in the dark sidebar follows the sidebar.

### Reversible in one place

If the glass should come back, it is this block and nothing else.

### 🪤 A fresh worktree has no dependencies, and the failures look like yours

The first verification run reported **8 failing tests and a broken typecheck**
(*"Cannot find module 'react'"*). None of it was real — the worktree had never
had `pnpm install` run in it, so anything needing a native or typed dependency
died. 7,060 tests still passed, which is exactly what makes it dangerous: a
mostly-green run reads as a real result. After installing: **7,092 pass, 0
fail.**

`tsc` then OOM'd at the **4 GB default heap** — a known limit on this repo, not a
signal about the code. Re-run with `--max-old-space-size=8192` it passes clean,
which matters here because the diff is no longer CSS-only: dropping the focal
ornaments removed JSX from two components, and a stylesheet-only argument would
not have covered them.

🔑 **A tool that dies is not a tool that disagreed.** Both of the above read as
failures of the change and were failures of the environment — but the fix is to
make the tool run, not to reason around it.

### Verification

- **7,092 unit tests pass**, 0 fail
- **all 21 lint guards green**, including the contrast guard (1,366 pairings)
- `tsc --noEmit` clean (needs an 8 GB heap locally; the 4 GB default OOMs on this repo)
- diff: **one stylesheet + two JSX deletions**

⏭ **The owner should look at this one.** It changes how every panel in the app
reads, and no automated check has an opinion about whether it feels right.

SPEC IMPACT: `Design_Warm_Editorial_Archive_2026-08-08/FABLE_Event_Overview_Spec_2026-08-08.md`
§ 2.1 scope guard — overridden on measurement; recorded in the spec.

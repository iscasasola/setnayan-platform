## 2026-07-28 · fix(design-system): the admin console gets its edges back — hand-rolled white borders → the ink hairline (45 sites)

Admin half of the warm-white-ground edge sweep; the customer half is `changelog.d/edge-sweep-customer.md`. Same defect: the ground moved to a flat `#F7F5F0` (PRs #3855/#3856) and the systemic surfaces were fixed at the **token** level (`--sn-glass-line` et al), but a token cannot reach a panel whose border is **hardcoded**. Highest-impact single site here is `_overview-tile.tsx:71` — the whole admin tile grid.

**`_overview-tile.tsx` is the bug in miniature.** Its `disabled` branch already renders `border border-dashed border-ink/15 bg-white/45` — a visible edge — while the *enabled* tile eight lines below renders `border border-white/60 bg-white/72`. Every clickable tile on the Overview had no edge; only the greyed-out ones did.

**Measured** (sRGB; border composited over its own fill per `background-clip: border-box`, fill over `#F7F5F0`):

| fill | old border | **`border-ink/10`** | **`border-ink/15`** | `--sn-glass-line` (shipped ref) |
|---|---|---|---|---|
| `bg-white/70` | `white/60` → **1.015** | **1.223** | **1.361** | 1.373 |
| `bg-white/72` (the tile grid) | `white/60` → **1.014** | **1.223** | **1.361** | 1.372 |
| `bg-white/75` | `white/60` → **1.013** | **1.224** | **1.362** | 1.374 |
| `var(--sn-danger-soft)` `#F3E1DC` | `white/50` → **1.127** | **1.216** | **1.348** | — |
| `var(--sn-warning-soft)` `#F6EAD2` | `white/50` → **1.093** | **1.218** | **1.352** | — |

The two warm semantic tints scored better than the white fills (1.09–1.13 — a white line does pick up a little against a tint) but still well under the ~1.22–1.37 band the rest of the app now uses, and they are two rungs of a four-rung tone ladder whose other two rungs are plain white — so all four move together or the ladder goes incoherent.

**Which alpha, per site** — the admin console already has a crisp two-value idiom, and the 45 sites split cleanly along it:
- **`/15` — 16 sites — controls.** The console's control recipe is literally `border border-ink/15 text-ink/70 hover:bg-ink/[0.04]` (filter tabs) and `inline-flex … rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium` (row actions). Every button, search input and select in the sweep is that same recipe with a white border swapped in: repost-watch 240/408/471/583, integrity-watch 318/499, user-reports 420/437, chat-flags 252, wedding-traditions 157/175/186/196/224, integrations 246 — plus `_overview-tile.tsx:71`, which takes `/15` on its own disabled twin's precedent.
- **`/10` — 29 sites — containers, note boxes, previews.** The console's container recipe is `rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm` and its note recipe `rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 text-xs`. That covers the empty-state and note paragraphs (chat-flags 182/233, repost-watch 304/495, integrity-watch 426, user-reports 297/402, completions 166, disputes 304, corrections 208), the container divs/sections (concierge-abuse 484/490/517/523, vendor-recommendations 311, pricing-surface 622, tokens 271, force-majeure 316), the `<details>` disclosures and `<img>` preview frames in social-queue-surface (1318/1408/1512/1628), the letterboxed QR preview in payment-methods 355, and the four nested tone cards in `page.tsx` (841/850/859/867), which sit *inside* the lane's glass `.sn-tile` and so should read lighter than their parent. `taxonomy.tsx` 635/693 are the neatest case — both already carry `divide-y divide-ink/10`, so `/10` makes the outer border match the dividers it contains exactly.

**Deliberately NOT changed.** `page.tsx:401` and `:434` keep `border-t border-white/10`. They are inside the **"EXCEPTION DESK · the obsidian focal … the one `.sn-tile-dark` this view is allowed"** — the siblings are `text-white/55` / `text-white/60`. A white rule on obsidian is correct; an ink one would vanish. That the sweep list omitted these two was right.

**Dark mode:** no `dark:` variant in any touched file, and none needed — `border-ink/*` resolves through `--color-ink`, which flips under `html.dark`, so the hairline inverts by construction (the hardcoded white it replaces could not). Moot anyway: `theme-provider.tsx` is light-locked (owner 2026-06-04) and strips `.dark` in both the `<head>` bootstrap and post-hydration.

Branched off `main` at `b62ef2343`, **not** off the customer PR (#3858), which was still awaiting CI. The two PRs touch disjoint file sets, so they cannot conflict.

No token changes (`globals.css` untouched), no migration, no flag changes.

SPEC IMPACT: None

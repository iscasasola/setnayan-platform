## 2026-07-28 · fix(design-system): customer surfaces get their edge back — hand-rolled white borders → the ink hairline (19 sites)

Follow-on to the warm-white ground (`#F7F5F0`, PRs #3855/#3856). The systemic surfaces were fixed at the token level — `--sn-glass-line`, `--m-sidebar-line`, `.sn-row`, the `--sn-sh-tile`/`--sn-sh-hi` contact shadows — but the token can't reach a panel whose border is **hardcoded**. ~60 components hand-roll `border-white/{50…80}` on a translucent-white or cream fill. A white line on a near-white panel over a near-white page is not a soft edge; it is no edge. This PR is the customer-facing half.

**Measured, not assumed** (sRGB contrast, border composited over its own fill per `background-clip: border-box`, fill composited over `#F7F5F0`):

| fill | fill\|ground | `border-white/60` | **`border-ink/10`** | **`border-ink/15`** | `--sn-glass-line` (shipped) |
|---|---|---|---|---|---|
| `bg-white/55` | 1.049 | 1.023 | **1.223** | **1.361** | 1.372 |
| `bg-white/60` | 1.053 | 1.021 | **1.223** | **1.361** | 1.372 |
| `bg-white/70` | 1.062 | 1.015 | **1.223** | **1.361** | 1.373 |
| `bg-white/85` | 1.076 | 1.008 | **1.224** | **1.362** | 1.374 |
| `bg-cream` (opaque) | 1.090 | **1.000** | **1.224** | **1.363** | — |

The old border ranged 1.000–1.023 — on an opaque cream panel it is *mathematically* zero contrast. The fill can't rescue it either: fill-vs-ground is only 1.049–1.090, which is the exact point the `.sn-ambient` comment already makes ("The fill can NOT carry the panel; the border must"). `border-ink/15` lands at **1.361 vs the shipped token's 1.372** — parity, so a hand-rolled panel now reads identically to a `.sn-glass`/`.sn-card`/`.sn-tile` one instead of ~1.2 pt softer.

**Which alpha, per site** — matched to local precedent rather than applied uniformly:
- **`/15` (18 sites)** — elevated or floating panels that are hand-rolled `.sn-glass`/`.sn-modal-panel` analogues (samahan's six shadowed page panels, the launcher event card beside its own `.sn-tile-glass` siblings, the command-palette dialog, the top-bar utility pill, the sticky budget save bar, the sticky guest-filter strip), plus interactive controls that must read as controls (day-of Planning pill, `.ics` export button, guest filter chips, report-modal radio rows + textarea). `guests/page.tsx` and `budget-allocation-planner.tsx` already use `/15` throughout; samahan already uses `/15` on its buttons.
- **`/10` (1 site)** — `checklist-full.tsx:83`, a static category pill nested *inside* a `.sn-tile` that already carries the glass hairline. A child edge lighter than its parent's is the correct hierarchy, and `/10` is the file's own only `border-ink` value.

**One site the sweep list missed:** `dashboard/(launcher)/layout.tsx:74` — the top-bar utility capsule (bell + avatar), `border-white/[0.65] bg-white/45`, floating directly on the ambient ground. Same defect, same fix, included here.

**Deliberately NOT changed** — a white border is correct wherever the panel sits on something that is *not* the light page ground. `dashboard/(launcher)/page.tsx:1213` keeps its `border-2 border-white/80`: that is the event monogram's cut-out ring riding the edge of the `.sn-texture-band` cover, an avatar-ring idiom, not a panel edge. The QR reticles (`tag-sheet.tsx`, `checkin-desk.tsx`), the photo-picker glass (`event-type-photo-picker.tsx`), the 3D-canvas overlays (`seating-lab-3d.tsx`, `guest-venue-3d.tsx`), the dark `bg-ink` cards (`life-flash-home-card.tsx`, `alaala-*`, `setnayan-ai`), and the over-video/over-photo chrome (`panood/program`, `realstories/gallery`) are all untouched for the same reason.

**Dark mode:** no `dark:` variant exists in any touched file, and none is needed. `border-ink/*` resolves through `--color-ink`, which already flips (`27 26 23` → `251 250 247`) under `html.dark`, so the hairline inverts to a light edge by construction — unlike the hardcoded `border-white/*` it replaces. Moot in practice regardless: `theme-provider.tsx` is light-locked (owner 2026-06-04) and strips `.dark` both in the `<head>` bootstrap and post-hydration, so `html.dark` is unreachable at runtime.

No token changes (`globals.css` untouched), no migration, no flag changes.

SPEC IMPACT: None

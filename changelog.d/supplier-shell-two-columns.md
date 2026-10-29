## 2026-10-29 · feat(supplier-shell): the supplier dashboard's frame at every width + two shared pin behaviours

Owner, 29 Oct: *"desktop mode is wrong"* · *"and tablet"*; prototype v13 approved (*"Approved."*); DECISION_LOG
2026-10-29 "SUPPLIER DASHBOARD — LAST ROUND OF OWNER NOTES" item 12 and "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS
COMPRESS"; *"remember to animate them properly."* Builder S1 (the shell) — the frame the S2–S6 page builders drop into.

- **≥1100 / 701–1099** — the shared rail (`AppRailShell` / `FrontDoorShell`, one rail, not a supplier fork) runs the
  window's full height: icon + word from 1100 (was 1280 for this tree), the 72-px strip 701–1099. The ONE app bar
  becomes the pinned row over the content column (`pinnedBar` prop → `.fd[data-pinned-bar]`): LEFT the page menu ▾
  (`supplier-page-menu.tsx`, shared `PickMenu`, each tab's sections from its own source), RIGHT the page's search · ⇅ · ＋
  (its thumb row, portalled up by `SupplierThumbRow` into `[data-pin-tools]`) and the same ✉ · 🔔 · avatar cluster —
  no wordmark, no centre title. The page's own Customers/Shop picker steps aside from 701.
- **<701** — the phone shell as shipped, plus a soft fade behind the floating thumb row.
- **Two columns** — `SupplierColumns` (list · required pane, 1:1 then 5:6, pane sticky on the pin line, not drawn on a
  phone). No page adopts it in this PR: every page keeps its own full-width body until its builder hands a pane default.
- **Top rows compress on scroll** — `usePinFold` (the Guests sticky block's attribute-not-state pattern, prototype
  hysteresis 44/6) folds Today's and Customers' count rows into one slim line; taps still filter.
- **Open fold heads pin slim, app-wide** — the shared `Fold` pins its open head on the pin line (`--sn-pin-top`,
  `pin-line.ts`), ~40 px, sub-line/aside hidden, nested heads flush under their parent, hands over, restores.
- **Glide** — both pins play ONE animation (`pin-glide.css`: the Guests pin's 6-px rise + fade, reversed on the way
  back), stilled under reduced motion.

Guards: `the-supplier-frame-holds.test.ts`, `a-top-row-folds-on-scroll.test.ts`, `the-open-fold-head-pins-slim.test.ts`.

SPEC IMPACT: None — builds the approved v13 frame and the 2026-10-29 rulings already in DECISION_LOG; no new decision.

- Fix (CI ugat-both-ends): the two-column `SupplierColumns` is not shipped in this PR — no page mounts it yet, and a component no page mounts is a wish. It arrives with S3 (Today + Customers › Events), the first page with a right column to show.

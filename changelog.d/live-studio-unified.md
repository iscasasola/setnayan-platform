## 2026-07-25 · feat(live-studio): unified switching Live Studio — merge Cast + Roam into one ₱2,999/event SKU

Merged **Cast (Panood)** and **Roam** into ONE customer-facing **Live Studio** product with a
switching-based controller — a directed **Main Stage** (channel 1) plus switchable guest cameras.
Built **additively on the Roam substrate** (does not fork a parallel system); everything ships
**DARK behind the existing `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` flag** — no behavior change when
off. Opened as a **DRAFT** PR (no auto-merge) because it stages the retirement of a live-priced SKU.

- **SKU** — new `LIVE_STUDIO` @ **₱2,999 · per event** (`one_time`, no `/day` suffix), `is_active=TRUE`
  but excluded from `/pricing` by name while the flag is off (mirrors the Roam idiom). Price is
  re-resolved server-side from the catalog (`submitOrderAction` → `resolvePaxPricedOrderCentavos`),
  never hardcoded. Migration `20271001110000_live_studio_unify_sku.sql`.
- **Retirements** — `LIVE_STUDIO_ROAM` set `is_active=false` (safe now: flag-dark, zero orders,
  folded into `LIVE_STUDIO`). `PANOOD_SYSTEM` (Cast, **live + selling**) is deliberately **NOT**
  flipped in this dark PR — a migration auto-applies on merge and can't read the flag, so retiring it
  now would stop live Cast sales while the unified product is dark. The Cast retirement is staged as
  the documented **launch cutover** (owner-run, alongside the flag flip). No dead buy buttons: the
  retired-Roam tile now sells the active `LIVE_STUDIO`; a test guards that no tile sells a retired SKU.
- **Controller** — extended the Roam setup controller with **Main Stage directing**: a live monitor +
  one-tap **"Cut to Main Stage"** per camera + "Take off air", alongside the existing
  add-camera/QR/default-view. New actions `cutToMainStage` / `clearMainStage`; new additive column
  `live_studio_roam_zones.is_main_stage` (RLS unchanged). Switching only — **no compositing/PiP**
  (explicit V1 non-goal; deferred to a later Pro layer). Migration `20271001100000_live_studio_main_stage.sql`.
- **Viewer** — one unified guest experience: a directed **Main Stage** channel (plays the current cut,
  falls back to the featured zone) plus guest-pick to any camera. Reuses the Roam picker; manifest
  entries gained a `mainStage` field (`parseRoamManifest` + `buildRoamManifest`).
- **Tests** — switching logic (`selectMainStageZone`, `mainStage` parse + manifest carry-through),
  and no-dead-buy-button / SKU-mapping guards. `pnpm typecheck` clean on touched files; scoped
  `next lint` + retired-strings + masthead guards clean; 122 unit tests green.

SPEC IMPACT: Unifies Live Studio Cast + Roam into one **Live Studio** SKU (**₱2,999 · per event**);
retires `LIVE_STUDIO_ROAM` and stages `PANOOD_SYSTEM` (Cast ₱2,500/day) retirement for the launch
cutover. Corpus canon: `Live_Studio_Unified_Spec_2026-07-25.md`. The per-day Cast/Roam pricing and the
"two variants" framing in older corpus/memory notes are superseded by the single per-event product.

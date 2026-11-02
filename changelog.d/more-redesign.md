## 2026-06-21 · feat(nav): redesign the admin "More" into grouped sections

Brings the admin `/more` overflow up to the vendor `/more` design (already grouped). The shared `MobileLandingGrid` gains an optional `groups` prop — labeled sections, each a mono eyebrow header + its own `.m-card` grid; the flat `items` path stays for `/admin/directory` + `/admin/money`. `admin/more/page.tsx` now renders **Insights** (the 7 analytics surfaces, mirroring the desktop sidebar Insights group 1:1) + **Platform** sections — expanding the single Insights card from the ≤5 reroster.

Both "More" menus are now grouped, labeled, `.m-card`-based, Clean Editorial. Per-card counts + a search box deferred. `pnpm typecheck` 0 · `pnpm lint` 0 · `lint:botnav` ✓.

SPEC IMPACT: Nav presentation — admin "More" grouped to match vendor. No SKU/schema/pricing change.

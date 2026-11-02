## 2026-07-19 · feat(suite): rename Silid surface to Suite + flag-gated nav doorway replacing Studio

Owner decisions 2026-07-19 (#1 "Suite" + #2 "replace"): the shipped services surface is
renamed **Silid → Suite**, and it gets a nav doorway that **replaces Studio** — all
gated on `NEXT_PUBLIC_SUITE`, so production is byte-identical until the owner flips the
var (no back-compat `NEXT_PUBLIC_SILID` shim: the surface was flag-dark in prod, so
nothing live ever read the old var).

**Rename (mechanical, no behavior change):**

- Route dir `apps/web/app/dashboard/[eventId]/silid/` → `…/suite/` (git mv). Inside:
  flag reader `NEXT_PUBLIC_SILID` → `NEXT_PUBLIC_SUITE`, `SILID_NAME` → `SUITE_NAME =
  'Suite'`, `metadata.title` `'Silid'` → `'Suite'`, `SilidPage` → `SuitePage`. The
  preview-deploy visibility rule (`VERCEL_ENV==='preview'` shows the page without env
  vars) is unchanged.
- Guardrail tests `apps/web/lib/silid-doorway-guardrails.test.ts` →
  `suite-doorway-guardrails.test.ts` — source-scan path, identifiers, and test names
  follow the surface; all 13 assertions unchanged in substance.

**Nav doorway (flag-gated Studio → Suite swap; keys stay `studio`):**

- `apps/web/app/dashboard/[eventId]/_components/customer-nav-config.ts` — desktop rail:
  flag ON → the Studio slot renders **Suite → `/dashboard/[eventId]/suite`** (label +
  href + matchPrefix); flag OFF → Studio exactly as today.
- `apps/web/lib/customer-menu.ts` — mobile bottom-nav/sub-nav SSOT: same swap; the
  tab's `activeMatch` keeps every existing /studio (+design/site-editor/monogram)
  prefix and adds `/suite`, and `sectionMatch` stays on the /studio hub so its docked
  anchor sub-nav keeps working on deep links.
- `apps/web/lib/nav-registry-defaults.ts` — the `customer.bottom-nav.studio` +
  `customer.sidebar.studio` code-default label/route follow the flag (necessary: the
  nav renderers prefer the registry slot label over the tree label, and
  `getNavSlotMap()` serves a default for every slot — a tree-only swap would never
  reach the UI). Slot keys stay stable; an explicit admin override still wins.

`/studio` routes themselves stay fully reachable in both flag states (existing deep
links + buy pages untouched) — only the nav doorway swaps.

SPEC IMPACT: Owner 2026-07-19: surface name locked = Suite (supersedes shipped Silid naming); nav doorway = replace Studio, flag-gated via NEXT_PUBLIC_SUITE. Whats_Next_Suite_AI_Pricing do-now #1 now valid as originally written.

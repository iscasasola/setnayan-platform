## 2026-06-28 · feat(nav): rename Collection → Memories Hub (5-focus reframe, app-shell PR 1)

Promote the existing cross-event account hub to the flagship "Memories Hub" name (owner 5-focus reframe 2026-06-28). The surface at `/dashboard/library` already aggregates every event the user hosts or attends (Photos & Videos · Saved Vendors · Editorials) with the owned-vs-attended RLS split solved — this is a label rename, not new code.

- `apps/web/app/dashboard/(account)/_components/account-nav-config.ts` — sidebar item label `Collection` → `Memories Hub`. Key `library`, href `/dashboard/library`, and slot key unchanged (public URL stable; admin overrides key off the slot).
- `apps/web/lib/nav-registry-defaults.ts` — `customer.account.library` registry default label `Collection` → `Memories Hub` (admin-editable at `/admin/menus`).
- `apps/web/app/dashboard/(account)/library/page.tsx` — metadata title + h1 → "Memories Hub"; subhead refreshed to the lifelong-archive framing ("Every photo, video, and memory — kept for life, across every event you host or attend.").

Registry-compliant (the chokepoint still consumes `navSlots`); no BottomNav fork; no route/schema change. Part of `03_Strategy/App_Shell_Memories_Hub_Plan_2026-06-28.md` (PR 1). Subsequent PRs promote Memories Hub to a primary focus + the 4-focus nav remap.

SPEC IMPACT: Recorded in `03_Strategy/App_Shell_Memories_Hub_Plan_2026-06-28.md` + DECISION_LOG 2026-06-28. In-app label only.

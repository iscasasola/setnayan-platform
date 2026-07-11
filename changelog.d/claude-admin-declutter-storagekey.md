## 2026-07-11 · fix(admin): let the Overview declutter win over a stale pre-declutter localStorage pref

The 2026-07-10 declutter made the admin sidebar's Overview (`queues`) menu default COLLAPSED on the `/admin` landing (via `collapsedWhenActive`), so the rail reads as six clean menus instead of dumping ~22 queue rows that duplicate the page's own tiles. But `AdminSidebarMenu` honors a stored `setnayan.nav.section.queues.open` preference over the default — and for months *before* the declutter, Overview was an always-open `<SidebarSection>` that persisted `'1'` under that exact key. So any browser carrying that stale `'1'` kept seeing the old expanded clutter, defeating the declutter (reported from a live screenshot).

Fix: the `collapsedWhenActive` menu now reads/writes a **versioned** key (`setnayan.nav.section.queues.declutter.open`). A fresh namespace means no pre-declutter value leaks in, so the collapsed default actually takes — a one-time reset to the intended clean rail. The user can still toggle Overview open (which persists under the versioned key). The other five menus keep the original key (they default closed and never had a stale-open problem).

Verification: typecheck + build clean. Behavior is deterministic (new key → no stored value → collapsed default). Observable on the deployed admin once merged.

SPEC IMPACT: None (admin nav polish).
